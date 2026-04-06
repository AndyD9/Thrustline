import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useCompany } from "@/contexts/CompanyContext";
import { DollarSign, TrendingUp, TrendingDown, CreditCard, Landmark, Users, Plane, Receipt } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { CrewMember } from "@/lib/database.types";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import type { Transaction, TransactionType, Loan } from "@/lib/database.types";

const currency = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

const typeLabels: Record<TransactionType, string> = {
  revenue: "Revenue",
  fuel: "Fuel",
  landing_fee: "Landing fee",
  lease: "Lease",
  maintenance: "Maintenance",
  salary: "Salary",
  purchase: "Purchase",
  sale: "Sale",
  loan_payment: "Loan payment",
};

const typeColors: Record<TransactionType, string> = {
  revenue: "text-emerald-400",
  fuel: "text-red-400",
  landing_fee: "text-red-400",
  lease: "text-red-400",
  maintenance: "text-red-400",
  salary: "text-red-400",
  purchase: "text-red-400",
  sale: "text-emerald-400",
  loan_payment: "text-red-400",
};

export default function Finances() {
  const { company } = useCompany();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [crewCount, setCrewCount] = useState(0);
  const [monthlySalaries, setMonthlySalaries] = useState(0);
  const [leasedCount, setLeasedCount] = useState(0);
  const [monthlyLeases, setMonthlyLeases] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!company) return;
    setLoading(true);

    Promise.all([
      supabase
        .from("transactions")
        .select("*")
        .eq("company_id", company.id)
        .order("created_at", { ascending: false })
        .limit(100),
      supabase
        .from("loans")
        .select("*")
        .eq("company_id", company.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("crew_members")
        .select("salary_mo")
        .eq("company_id", company.id),
      supabase
        .from("aircraft")
        .select("lease_cost_mo")
        .eq("company_id", company.id)
        .eq("ownership", "leased"),
    ]).then(([txRes, loanRes, crewRes, acRes]) => {
      setTransactions((txRes.data as Transaction[]) ?? []);
      setLoans((loanRes.data as Loan[]) ?? []);
      const crewData = (crewRes.data as Pick<CrewMember, "salary_mo">[]) ?? [];
      setCrewCount(crewData.length);
      setMonthlySalaries(crewData.reduce((s, c) => s + c.salary_mo, 0));
      const acData = (acRes.data as { lease_cost_mo: number }[]) ?? [];
      setLeasedCount(acData.length);
      setMonthlyLeases(acData.reduce((s, a) => s + a.lease_cost_mo, 0));
      setLoading(false);
    });
  }, [company?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!company) return null;

  const totals = transactions.reduce(
    (acc, tx) => {
      if (tx.amount > 0) acc.income += tx.amount;
      else acc.expenses += Math.abs(tx.amount);
      return acc;
    },
    { income: 0, expenses: 0 },
  );

  // Cashflow chart — running balance over last N transactions (chronological)
  const cashflowData = [...transactions]
    .reverse()
    .reduce<{ name: string; balance: number }[]>((arr, tx) => {
      const prev = arr.length > 0 ? arr[arr.length - 1].balance : company.capital - totals.income + totals.expenses;
      arr.push({
        name: new Date(tx.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
        balance: prev + tx.amount,
      });
      return arr;
    }, [])
    .slice(-20);

  return (
    <div className="space-y-6 animate-fade-in">
      <h1 className="text-2xl font-bold text-white">Finances</h1>

      {/* Summary cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <FinCard label="Capital" value={currency(company.capital)} icon={DollarSign} iconColor="text-brand-300" glow />
        <FinCard label="Total income" value={currency(totals.income)} icon={TrendingUp} iconColor="text-emerald-400" />
        <FinCard label="Total expenses" value={currency(totals.expenses)} icon={TrendingDown} iconColor="text-red-400" />
        <FinCard
          label="Net profit"
          value={currency(totals.income - totals.expenses)}
          icon={CreditCard}
          iconColor={totals.income - totals.expenses >= 0 ? "text-emerald-400" : "text-red-400"}
        />
      </div>

      {/* Monthly charges breakdown */}
      {(monthlySalaries > 0 || monthlyLeases > 0 || loans.some((l) => l.remaining_amount > 0)) && (
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
          <div className="mb-3 flex items-center gap-2 text-[10px] uppercase tracking-[0.15em] text-slate-500">
            <Receipt className="h-3.5 w-3.5" />
            Monthly charges (auto-deducted every 30 days)
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
            {monthlySalaries > 0 && (
              <div className="flex items-center gap-3 rounded-lg bg-white/[0.02] px-4 py-3">
                <Users className="h-4 w-4 text-slate-500" />
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-slate-500">Crew salaries</div>
                  <div className="font-mono text-sm text-red-400">{currency(-monthlySalaries)}</div>
                  <div className="text-[10px] text-slate-600">{crewCount} members</div>
                </div>
              </div>
            )}
            {monthlyLeases > 0 && (
              <div className="flex items-center gap-3 rounded-lg bg-white/[0.02] px-4 py-3">
                <Plane className="h-4 w-4 text-slate-500" />
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-slate-500">Aircraft leases</div>
                  <div className="font-mono text-sm text-red-400">{currency(-monthlyLeases)}</div>
                  <div className="text-[10px] text-slate-600">{leasedCount} aircraft</div>
                </div>
              </div>
            )}
            {loans.filter((l) => l.remaining_amount > 0).length > 0 && (
              <div className="flex items-center gap-3 rounded-lg bg-white/[0.02] px-4 py-3">
                <Landmark className="h-4 w-4 text-slate-500" />
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-slate-500">Loan payments</div>
                  <div className="font-mono text-sm text-red-400">
                    {currency(-loans.filter((l) => l.remaining_amount > 0).reduce((s, l) => s + l.monthly_payment, 0))}
                  </div>
                  <div className="text-[10px] text-slate-600">{loans.filter((l) => l.remaining_amount > 0).length} active</div>
                </div>
              </div>
            )}
            <div className="flex items-center gap-3 rounded-lg bg-white/[0.02] px-4 py-3">
              <Receipt className="h-4 w-4 text-amber-400" />
              <div>
                <div className="text-[10px] uppercase tracking-wider text-slate-500">Total / month</div>
                <div className="font-mono text-sm font-bold text-amber-400">
                  {currency(-(monthlySalaries + monthlyLeases + loans.filter((l) => l.remaining_amount > 0).reduce((s, l) => s + l.monthly_payment, 0)))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Cashflow chart */}
      {cashflowData.length > 2 && (
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
          <div className="mb-4 text-[10px] uppercase tracking-[0.15em] text-slate-500">Cashflow over time</div>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={cashflowData}>
              <defs>
                <linearGradient id="gradCashflow" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="oklch(0.58 0.18 195)" stopOpacity={0.25} />
                  <stop offset="100%" stopColor="oklch(0.58 0.18 195)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip
                contentStyle={{
                  background: "rgba(10, 16, 24, 0.95)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  borderRadius: "0.75rem",
                  fontSize: 12,
                }}
                formatter={(value: number) => [currency(value), "Balance"]}
              />
              <Area
                type="monotone"
                dataKey="balance"
                stroke="oklch(0.66 0.18 195)"
                strokeWidth={2}
                fill="url(#gradCashflow)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Loans */}
      {loans.length > 0 && (
        <section className="space-y-3">
          <h2 className="flex items-center gap-2 text-lg font-bold text-white">
            <Landmark className="h-5 w-5 text-slate-400" /> Loans
          </h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {loans.map((loan) => {
              const progress = loan.total_months > 0 ? (loan.paid_months / loan.total_months) * 100 : 0;
              return (
                <div key={loan.id} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-semibold text-white">{currency(loan.principal)} loan</div>
                    <div className="rounded-full bg-white/[0.05] px-2 py-0.5 text-xs text-slate-400">{loan.interest_rate}% APR</div>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="rounded-lg bg-white/[0.03] px-3 py-2 text-center">
                      <div className="text-[10px] uppercase tracking-wider text-slate-500">Monthly</div>
                      <div className="mt-0.5 font-mono text-sm text-white">{currency(loan.monthly_payment)}</div>
                    </div>
                    <div className="rounded-lg bg-white/[0.03] px-3 py-2 text-center">
                      <div className="text-[10px] uppercase tracking-wider text-slate-500">Remaining</div>
                      <div className="mt-0.5 font-mono text-sm text-white">{currency(loan.remaining_amount)}</div>
                    </div>
                    <div className="rounded-lg bg-white/[0.03] px-3 py-2 text-center">
                      <div className="text-[10px] uppercase tracking-wider text-slate-500">Payments</div>
                      <div className="mt-0.5 font-mono text-sm text-white">{loan.paid_months}/{loan.total_months}</div>
                    </div>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-white/[0.04]">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-brand-500 to-brand-400 shadow-[0_0_8px_oklch(0.58_0.18_195_/_0.3)] transition-all"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Transaction ledger */}
      <section className="space-y-3">
        <h2 className="text-lg font-bold text-white">Transaction ledger</h2>

        {loading ? (
          <div className="text-slate-400">Loading...</div>
        ) : transactions.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-white/[0.06] bg-white/[0.02] py-16 text-center">
            <DollarSign className="mb-3 h-8 w-8 text-slate-600" />
            <div className="text-sm text-slate-400">No transactions yet. Complete a flight to generate revenue.</div>
          </div>
        ) : (
          <div className="space-y-1.5">
            {transactions.map((tx) => (
              <div
                key={tx.id}
                className="flex items-center justify-between rounded-xl border border-white/[0.04] bg-white/[0.02] px-5 py-3 transition-all hover:bg-white/[0.03]"
              >
                <div className="flex items-center gap-4">
                  <span className="rounded-lg bg-white/[0.04] px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-300">
                    {typeLabels[tx.type]}
                  </span>
                  <span className="text-sm text-slate-300">{tx.description}</span>
                </div>
                <div className="flex items-center gap-4">
                  <span className={`font-mono text-sm font-semibold ${typeColors[tx.type]}`}>
                    {tx.amount >= 0 ? "+" : ""}{currency(tx.amount)}
                  </span>
                  <span className="text-[11px] text-slate-600">
                    {new Date(tx.created_at).toLocaleString()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

/* ---------- Finance Card ---------- */

function FinCard({
  label,
  value,
  icon: Icon,
  iconColor = "text-brand-300",
  glow,
}: {
  label: string;
  value: string;
  icon: LucideIcon;
  iconColor?: string;
  glow?: boolean;
}) {
  return (
    <div className={`rounded-xl border border-white/[0.06] bg-white/[0.02] px-5 py-4 transition-all hover:bg-white/[0.04] ${glow ? "glow-brand-sm" : ""}`}>
      <div className="mb-3 flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-[0.15em] text-slate-500">{label}</span>
        <div className={`flex h-8 w-8 items-center justify-center rounded-lg bg-white/[0.04] ${iconColor}`}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <div className="text-xl font-bold text-white">{value}</div>
    </div>
  );
}
