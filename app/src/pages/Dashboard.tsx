import { useEffect, useMemo, useState } from "react";
import { useCompany } from "@/contexts/CompanyContext";
import { useSim } from "@/contexts/SimContext";
import { useUnits } from "@/contexts/UnitsContext";
import { supabase } from "@/lib/supabase";
import {
  DollarSign,
  Wifi,
  Plane,
  TrendingUp,
  TrendingDown,
  Fuel,
  Clock,
  Route,
  Star,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from "recharts";
import type { Flight, Transaction, Reputation, GameEvent } from "@/lib/database.types";
import { fetchActiveEvents } from "@/lib/gameEvents";
import { gradeToScore, gradeColors } from "@/lib/landingGrade";
import FlightMap, { type RouteArc } from "@/components/FlightMap";
import { airportByIcao } from "@/data/airports";

const currency = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

export default function Dashboard() {
  const { company, loading } = useCompany();
  const { lastLanding, lastTakeoff, simActive, latest } = useSim();
  const { fmt: u } = useUnits();
  const [recentFlights, setRecentFlights] = useState<Flight[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [reputations, setReputations] = useState<Reputation[]>([]);
  const [activeEvents, setActiveEvents] = useState<GameEvent[]>([]);

  useEffect(() => {
    if (!company) return;
    // Fetch recent flights + transactions for charts
    Promise.all([
      supabase
        .from("flights")
        .select("*")
        .eq("company_id", company.id)
        .order("completed_at", { ascending: false })
        .limit(20),
      supabase
        .from("transactions")
        .select("*")
        .eq("company_id", company.id)
        .order("created_at", { ascending: false })
        .limit(50),
      supabase
        .from("reputations")
        .select("*")
        .eq("company_id", company.id)
        .order("score", { ascending: false }),
    ]).then(([flightsRes, txRes, repRes]) => {
      setRecentFlights((flightsRes.data as Flight[]) ?? []);
      setTransactions((txRes.data as Transaction[]) ?? []);
      setReputations((repRes.data as Reputation[]) ?? []);
    });
    // Fetch active events separately
    fetchActiveEvents(company.id).then((events) => setActiveEvents(events as GameEvent[]));
  }, [company?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) return <Placeholder label="Loading company…" />;
  if (!company) return <Placeholder label="No company — complete onboarding." />;

  // Compute stats
  const totalFlights = recentFlights.length;
  const totalRevenue = transactions.filter(t => t.amount > 0).reduce((s, t) => s + t.amount, 0);
  const totalExpenses = transactions.filter(t => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0);

  // Chart data — revenue per flight (last 10, reversed for chronological order)
  const revenueChartData = [...recentFlights]
    .reverse()
    .slice(-10)
    .map((f, i) => ({
      name: `${f.departure_icao}-${f.arrival_icao}`,
      revenue: Number(f.revenue) || 0,
      net: Number(f.net_result) || 0,
      index: i,
    }));

  // P&L summary for bar chart
  const plData = [
    { name: "Revenue", value: totalRevenue, fill: "oklch(0.66 0.18 195)" },
    { name: "Expenses", value: totalExpenses, fill: "oklch(0.64 0.22 340)" },
    { name: "Profit", value: totalRevenue - totalExpenses, fill: totalRevenue - totalExpenses >= 0 ? "#34d399" : "#f87171" },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Page header */}
      <header>
        <h1 className="text-2xl font-bold text-white">{company.name}</h1>
        <p className="text-sm text-slate-400">
          <span className="font-mono text-brand-300">{company.airline_code}</span>
          <span className="mx-2 text-slate-600">·</span>
          Hub {company.hub_icao}
        </p>
      </header>

      {/* Active world events */}
      {activeEvents.length > 0 && (
        <div className="space-y-2">
          {activeEvents.map((ev) => {
            const isPositive = ev.modifier > 1;
            const remaining = Math.max(0, Math.ceil((new Date(ev.expires_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24)));
            const colors = isPositive
              ? "border-emerald-500/20 bg-emerald-500/[0.04] text-emerald-300"
              : "border-red-500/20 bg-red-500/[0.04] text-red-300";
            return (
              <div key={ev.id} className={`flex items-center justify-between rounded-xl border px-4 py-3 text-xs ${colors}`}>
                <div className="flex items-center gap-3">
                  <span className="font-semibold">{ev.title}</span>
                  <span className="text-slate-400">{ev.description}</span>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="font-mono font-bold">{isPositive ? "+" : ""}{Math.round((ev.modifier - 1) * 100)}%</span>
                  <span className="text-slate-500">{remaining}d left</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Capital"
          value={currency(company.capital)}
          icon={DollarSign}
          iconColor="text-brand-300"
          glow
        />
        <KpiCard
          label="Sim Status"
          value={simActive ? "Connected" : "Offline"}
          icon={Wifi}
          iconColor={simActive ? "text-emerald-400" : "text-slate-500"}
        />
        <KpiCard
          label="Total Revenue"
          value={currency(totalRevenue)}
          icon={TrendingUp}
          iconColor="text-emerald-400"
          sub={`${totalFlights} flights`}
        />
        <KpiCard
          label="Total Expenses"
          value={currency(totalExpenses)}
          icon={TrendingDown}
          iconColor="text-red-400"
          sub={`Net: ${currency(totalRevenue - totalExpenses)}`}
        />
        <KpiCard
          label="Global Reputation"
          value={`${(company.global_reputation ?? 50).toFixed(0)}/100`}
          icon={Star}
          iconColor="text-amber-300"
          sub={(company.global_reputation ?? 50) >= 70 ? "Excellent" : (company.global_reputation ?? 50) >= 40 ? "Average" : "Poor"}
        />
      </div>

      {/* Flight in progress */}
      {lastTakeoff && !lastLanding && (
        <div className="rounded-xl border border-brand-500/20 bg-brand-500/[0.04] px-5 py-4 glow-brand-sm animate-slide-up">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-500/15">
              <Plane className="h-4 w-4 text-brand-300 animate-pulse" />
            </div>
            <div>
              <div className="text-sm font-semibold text-brand-300">Flight in progress</div>
              <div className="text-xs text-slate-400">
                Takeoff at {new Date(lastTakeoff.timestamp).toLocaleTimeString()} —
                fuel on board {lastTakeoff.fuelTotalGal.toFixed(0)} gal
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Flight Network Map — shows all flown routes as arcs */}
      <FlightMap
        origin={company.hub_icao ? airportByIcao[company.hub_icao] : undefined}
        routes={recentFlights.reduce<RouteArc[]>((acc, f) => {
          const dep = airportByIcao[f.departure_icao];
          const arr = airportByIcao[f.arrival_icao];
          if (dep && arr) {
            // Deduplicate: only add if this route pair isn't already in the list
            const key = `${f.departure_icao}-${f.arrival_icao}`;
            const reverseKey = `${f.arrival_icao}-${f.departure_icao}`;
            if (!acc.some((r) => `${r.fromIcao}-${r.toIcao}` === key || `${r.fromIcao}-${r.toIcao}` === reverseKey)) {
              acc.push({
                from: [dep.lat, dep.lon],
                to: [arr.lat, arr.lon],
                fromIcao: f.departure_icao,
                toIcao: f.arrival_icao,
              });
            }
          }
          return acc;
        }, [])}
        aircraft={
          latest && !latest.onGround
            ? { lat: latest.latitude, lon: latest.longitude, heading: latest.headingDeg }
            : undefined
        }
        height="300px"
        interactive
      />

      {/* Last landing */}
      {lastLanding && (
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-5 py-4">
          <div className="mb-3 text-[10px] uppercase tracking-[0.15em] text-slate-500">Last landing</div>
          <div className="grid grid-cols-3 gap-4">
            <MiniStat icon={Route} label="Distance" value={u.distance(lastLanding.distanceNm)} />
            <MiniStat icon={Plane} label="Landing VS" value={u.vs(Math.abs(lastLanding.landingVsFpm))} />
            <MiniStat icon={Fuel} label="Fuel used" value={u.fuel(lastLanding.fuelStartGal - lastLanding.fuelEndGal)} />
          </div>
        </div>
      )}

      {/* Charts */}
      {revenueChartData.length > 1 && (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {/* Revenue per flight */}
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
            <div className="mb-4 text-[10px] uppercase tracking-[0.15em] text-slate-500">
              Revenue per flight
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={revenueChartData}>
                <defs>
                  <linearGradient id="gradRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="oklch(0.58 0.18 195)" stopOpacity={0.3} />
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
                />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  stroke="oklch(0.66 0.18 195)"
                  strokeWidth={2}
                  fill="url(#gradRevenue)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* P&L summary */}
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
            <div className="mb-4 text-[10px] uppercase tracking-[0.15em] text-slate-500">
              Profit & Loss
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={plData}>
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
                />
                <Bar dataKey="value" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Landing Progression */}
      {(() => {
        const gradeData = [...recentFlights]
          .reverse()
          .filter((f) => f.landing_grade)
          .slice(-15)
          .map((f) => ({
            name: `${f.departure_icao}-${f.arrival_icao}`,
            score: gradeToScore(f.landing_grade!),
            grade: f.landing_grade!,
            pax: f.pax_satisfaction != null ? Math.round(f.pax_satisfaction) : null,
          }));
        return gradeData.length > 1 ? (
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
            <div className="mb-4 text-[10px] uppercase tracking-[0.15em] text-slate-500">
              Landing progression
            </div>
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={gradeData}>
                <defs>
                  <linearGradient id="gradGrade" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#34d399" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#34d399" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                <YAxis domain={[0, 10]} tick={{ fontSize: 10 }} ticks={[2, 4, 6, 8, 10]} />
                <Tooltip
                  contentStyle={{
                    background: "rgba(10, 16, 24, 0.95)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    borderRadius: "0.75rem",
                    fontSize: 12,
                  }}
                  formatter={(value: number, name: string) => {
                    if (name === "score") {
                      const labels: Record<number, string> = { 10: "A+", 9: "A", 8: "B+", 7: "B", 6: "C+", 5: "C", 4: "D", 3: "D-", 2: "F+", 1: "F" };
                      return [labels[value] ?? value, "Grade"];
                    }
                    return [value + "%", "Pax"];
                  }}
                />
                <Area type="monotone" dataKey="score" stroke="#34d399" strokeWidth={2} fill="url(#gradGrade)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        ) : null;
      })()}

      {/* Route Reputation */}
      {reputations.length > 0 && (
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
          <div className="mb-4 flex items-center justify-between">
            <span className="flex items-center gap-2 text-[10px] uppercase tracking-[0.15em] text-slate-500">
              <Star className="h-3.5 w-3.5" /> Route reputation
            </span>
            <span className="text-[10px] text-slate-500">{reputations.length} routes</span>
          </div>
          <div className="space-y-2">
            {reputations.slice(0, 8).map((r) => {
              const mult = (0.5 + r.score / 100).toFixed(1);
              const isPremium = r.score >= 80;
              return (
                <div
                  key={r.id}
                  className="flex items-center justify-between rounded-lg border border-white/[0.04] bg-white/[0.01] px-4 py-2.5 transition-colors hover:bg-white/[0.03]"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 font-mono text-sm">
                      <span className="font-semibold text-white">{r.origin_icao}</span>
                      <span className="text-slate-600">{"\u2192"}</span>
                      <span className="font-semibold text-white">{r.dest_icao}</span>
                    </div>
                    <span className="text-xs text-slate-500">{r.flight_count} flight{r.flight_count !== 1 ? "s" : ""}</span>
                    {isPremium && (
                      <span className="flex items-center gap-1 rounded-full bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 text-[10px] font-bold text-amber-300">
                        <Star className="h-2.5 w-2.5" /> Premium
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`font-mono text-sm font-semibold ${
                      r.score >= 70 ? "text-emerald-400" : r.score >= 40 ? "text-amber-400" : "text-red-400"
                    }`}>
                      {r.score.toFixed(0)}/100
                    </span>
                    <span className="text-xs text-slate-500">{mult}x</span>
                    <div className="w-20 h-1.5 overflow-hidden rounded-full bg-white/[0.04]">
                      <div
                        className={`h-full rounded-full transition-all ${
                          r.score >= 70 ? "bg-emerald-400" : r.score >= 40 ? "bg-amber-400" : "bg-red-400"
                        }`}
                        style={{ width: `${r.score}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Recent flights mini table */}
      {recentFlights.length > 0 && (
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
          <div className="mb-4 flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-[0.15em] text-slate-500">Recent flights</span>
            <span className="text-[10px] text-slate-500">{recentFlights.length} flights</span>
          </div>
          <div className="space-y-2">
            {recentFlights.slice(0, 5).map((f) => (
              <div
                key={f.id}
                className="flex items-center justify-between rounded-lg border border-white/[0.04] bg-white/[0.01] px-4 py-3 transition-colors hover:bg-white/[0.03]"
              >
                <div className="flex items-center gap-4">
                  {/* Route visualization */}
                  <div className="flex items-center gap-2 font-mono text-sm">
                    <span className="font-semibold text-white">{f.departure_icao}</span>
                    <div className="flex items-center gap-1">
                      <div className="h-px w-6 bg-brand-500/40" />
                      <Plane className="h-3 w-3 text-brand-400 -rotate-45" />
                      <div className="h-px w-6 bg-brand-500/40" />
                    </div>
                    <span className="font-semibold text-white">{f.arrival_icao}</span>
                  </div>
                  <span className="text-xs text-slate-500">{Number(f.distance_nm).toFixed(0)} nm</span>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-xs text-slate-400">{f.duration_min} min</span>
                  <span
                    className={`font-mono text-sm font-semibold ${Number(f.net_result) >= 0 ? "text-emerald-400" : "text-red-400"}`}
                  >
                    {currency(Number(f.net_result))}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Sub-components ──────────────────────────────────── */

function KpiCard({
  label,
  value,
  icon: Icon,
  iconColor = "text-brand-300",
  glow,
  sub,
}: {
  label: string;
  value: string;
  icon: LucideIcon;
  iconColor?: string;
  glow?: boolean;
  sub?: string;
}) {
  return (
    <div
      className={`rounded-xl border border-white/[0.06] bg-white/[0.02] px-5 py-4 transition-all hover:bg-white/[0.04] ${glow ? "glow-brand-sm" : ""}`}
    >
      <div className="mb-3 flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-[0.15em] text-slate-500">{label}</span>
        <div className={`flex h-8 w-8 items-center justify-center rounded-lg bg-white/[0.04] ${iconColor}`}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <div className="text-2xl font-bold text-white">{value}</div>
      {sub && <div className="mt-1 text-xs text-slate-500">{sub}</div>}
    </div>
  );
}

function MiniStat({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <Icon className="h-4 w-4 text-slate-500" />
      <div>
        <div className="text-[10px] uppercase tracking-wider text-slate-500">{label}</div>
        <div className="font-mono text-sm font-medium text-slate-200">{value}</div>
      </div>
    </div>
  );
}

function Placeholder({ label }: { label: string }) {
  return (
    <div className="flex h-full items-center justify-center text-slate-400">
      {label}
    </div>
  );
}
