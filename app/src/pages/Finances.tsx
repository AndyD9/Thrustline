import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useCompany } from "@/contexts/CompanyContext";
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
  revenue: "text-emerald-300",
  fuel: "text-red-300",
  landing_fee: "text-red-300",
  lease: "text-red-300",
  maintenance: "text-red-300",
  salary: "text-red-300",
  purchase: "text-red-300",
  sale: "text-emerald-300",
  loan_payment: "text-red-300",
};

export default function Finances() {
  const { company } = useCompany();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loans, setLoans] = useState<Loan[]>([]);
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
    ]).then(([txRes, loanRes]) => {
      setTransactions((txRes.data as Transaction[]) ?? []);
      setLoans((loanRes.data as Loan[]) ?? []);
      setLoading(false);
    });
  }, [company?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!company) return null;

  // Aggregate P&L from loaded transactions
  const totals = transactions.reduce(
    (acc, tx) => {
      if (tx.amount > 0) acc.income += tx.amount;
      else acc.expenses += Math.abs(tx.amount);
      return acc;
    },
    { income: 0, expenses: 0 },
  );

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Finances</h1>

      {/* Summary cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <SummaryCard label="Capital" value={currency(company.capital)} accent />
        <SummaryCard label="Total income" value={currency(totals.income)} color="text-emerald-300" />
        <SummaryCard label="Total expenses" value={currency(totals.expenses)} color="text-red-300" />
        <SummaryCard
          label="Net profit"
          value={currency(totals.income - totals.expenses)}
          color={totals.income - totals.expenses >= 0 ? "text-emerald-300" : "text-red-300"}
        />
      </div>

      {/* Loans */}
      {loans.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Loans</h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {loans.map((loan) => {
              const progress = loan.total_months > 0
                ? (loan.paid_months / loan.total_months) * 100
                : 0;
              return (
                <div key={loan.id} className="glass space-y-3 px-5 py-4">
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-slate-200">
                      {currency(loan.principal)} loan
                    </div>
                    <div className="text-xs text-slate-400">
                      {loan.interest_rate}% APR
                    </div>
                  </div>
                  <dl className="grid grid-cols-3 gap-2 text-center text-xs">
                    <div>
                      <dt className="text-[10px] uppercase tracking-wider text-slate-500">
                        Monthly
                      </dt>
                      <dd className="font-mono text-slate-200">
                        {currency(loan.monthly_payment)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[10px] uppercase tracking-wider text-slate-500">
                        Remaining
                      </dt>
                      <dd className="font-mono text-slate-200">
                        {currency(loan.remaining_amount)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[10px] uppercase tracking-wider text-slate-500">
                        Payments
                      </dt>
                      <dd className="font-mono text-slate-200">
                        {loan.paid_months}/{loan.total_months}
                      </dd>
                    </div>
                  </dl>
                  {/* Progress bar */}
                  <div className="h-1.5 overflow-hidden rounded-full bg-white/5">
                    <div
                      className="h-full rounded-full bg-brand-400 transition-all"
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
        <h2 className="text-lg font-semibold">Transaction ledger</h2>

        {loading ? (
          <div className="text-slate-400">Loading...</div>
        ) : transactions.length === 0 ? (
          <div className="glass px-5 py-8 text-center text-sm text-slate-400">
            No transactions yet. Complete a flight to generate revenue.
          </div>
        ) : (
          <div className="glass overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-white/5 text-[10px] uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-4 py-3 text-left">Date</th>
                  <th className="px-4 py-3 text-left">Type</th>
                  <th className="px-4 py-3 text-left">Description</th>
                  <th className="px-4 py-3 text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((tx) => (
                  <tr key={tx.id} className="border-t border-white/5">
                    <td className="px-4 py-3 text-[11px] text-slate-500">
                      {new Date(tx.created_at).toLocaleString()}
                    </td>
                    <td className="px-4 py-3">
                      <span className="rounded bg-white/5 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-slate-300">
                        {typeLabels[tx.type]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-300">{tx.description}</td>
                    <td
                      className={`px-4 py-3 text-right font-mono ${typeColors[tx.type]}`}
                    >
                      {tx.amount >= 0 ? "+" : ""}
                      {currency(tx.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

/* ---------- Summary Card ---------- */

function SummaryCard({
  label,
  value,
  accent,
  color,
}: {
  label: string;
  value: string;
  accent?: boolean;
  color?: string;
}) {
  return (
    <div className="glass px-5 py-4">
      <div className="text-[10px] uppercase tracking-wider text-slate-500">{label}</div>
      <div
        className={`mt-1 text-xl font-semibold ${accent ? "text-brand-300" : color ?? "text-slate-100"}`}
      >
        {value}
      </div>
    </div>
  );
}
