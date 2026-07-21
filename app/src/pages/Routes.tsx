import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useCompany } from "@/contexts/CompanyContext";
import type { Flight, Reputation } from "@/lib/database.types";
import FlightMap, { type RouteArc } from "@/components/FlightMap";
import { airportByIcao } from "@/data/airports";
import {
  Route,
  Star,
  Plane,
  DollarSign,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

const currency = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

interface RouteStats {
  key: string;
  origin: string;
  dest: string;
  flightCount: number;
  avgRevenue: number;
  avgCost: number;
  avgNet: number;
  totalNet: number;
  reputation: number | null;
}

export default function RoutesPage() {
  const { company } = useCompany();
  const [flights, setFlights] = useState<Flight[]>([]);
  const [reputations, setReputations] = useState<Reputation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!company) return;
    setLoading(true);
    Promise.all([
      supabase
        .from("flights")
        .select("*")
        .eq("company_id", company.id)
        .order("completed_at", { ascending: false }),
      supabase
        .from("reputations")
        .select("*")
        .eq("company_id", company.id),
    ]).then(([fRes, rRes]) => {
      setFlights((fRes.data as Flight[]) ?? []);
      setReputations((rRes.data as Reputation[]) ?? []);
      setLoading(false);
    });
  }, [company?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Aggregate route stats
  const routeStats = useMemo<RouteStats[]>(() => {
    const map = new Map<string, Flight[]>();
    for (const f of flights) {
      const key = `${f.departure_icao}-${f.arrival_icao}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(f);
    }

    const repMap = new Map(reputations.map((r) => [`${r.origin_icao}-${r.dest_icao}`, r.score]));

    return Array.from(map.entries())
      .map(([key, flts]) => {
        const [origin, dest] = key.split("-");
        const totalRev = flts.reduce((s, f) => s + Number(f.revenue), 0);
        const totalCost = flts.reduce((s, f) => s + Number(f.fuel_cost) + Number(f.landing_fee), 0);
        const totalNet = flts.reduce((s, f) => s + Number(f.net_result), 0);
        return {
          key,
          origin,
          dest,
          flightCount: flts.length,
          avgRevenue: totalRev / flts.length,
          avgCost: totalCost / flts.length,
          avgNet: totalNet / flts.length,
          totalNet,
          reputation: repMap.get(key) ?? null,
        };
      })
      .sort((a, b) => b.totalNet - a.totalNet);
  }, [flights, reputations]);

  if (!company) return null;

  const totalRoutes = routeStats.length;
  const bestRoute = routeStats[0];
  const avgProfit = routeStats.length > 0
    ? routeStats.reduce((s, r) => s + r.avgNet, 0) / routeStats.length
    : 0;

  // Chart data — top 10 by avg net
  const chartData = routeStats.slice(0, 10).map((r) => ({
    name: `${r.origin}-${r.dest}`,
    net: Math.round(r.avgNet),
    fill: r.avgNet >= 0 ? "#34d399" : "#f87171",
  }));

  // Map route arcs colored by profitability
  const routeArcs: RouteArc[] = routeStats
    .map((r) => {
      const dep = airportByIcao[r.origin];
      const arr = airportByIcao[r.dest];
      if (!dep || !arr) return null;
      return {
        from: [dep.lat, dep.lon] as [number, number],
        to: [arr.lat, arr.lon] as [number, number],
        fromIcao: r.origin,
        toIcao: r.dest,
        color: r.avgNet >= 0 ? "#34d399" : "#f87171",
      };
    })
    .filter(Boolean) as RouteArc[];

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-white">Route Profitability</h1>
        <p className="text-sm text-slate-400">Analyze your most and least profitable routes</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <KpiCard label="Total Routes" value={String(totalRoutes)} icon={Route} iconColor="text-brand-300" />
        <KpiCard
          label="Best Route"
          value={bestRoute ? `${bestRoute.origin}-${bestRoute.dest}` : "--"}
          icon={Star}
          iconColor="text-amber-300"
          sub={bestRoute ? `Avg ${currency(bestRoute.avgNet)}/flight` : undefined}
        />
        <KpiCard
          label="Avg Profit/Flight"
          value={currency(avgProfit)}
          icon={DollarSign}
          iconColor={avgProfit >= 0 ? "text-emerald-400" : "text-red-400"}
        />
      </div>

      {/* Route Map */}
      <FlightMap
        origin={company.hub_icao ? airportByIcao[company.hub_icao] : undefined}
        routes={routeArcs}
        height="300px"
        interactive
      />

      {/* Top routes chart */}
      {chartData.length > 0 && (
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
          <div className="mb-4 text-[10px] uppercase tracking-[0.15em] text-slate-500">
            Top routes by avg profit
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartData}>
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
              <Bar dataKey="net" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Route cards */}
      {loading ? (
        <div className="text-slate-400">Loading...</div>
      ) : routeStats.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-white/[0.06] bg-white/[0.02] py-16 text-center">
          <Plane className="mb-3 h-8 w-8 text-slate-600" />
          <div className="text-sm text-slate-400">No routes yet. Complete some flights first.</div>
        </div>
      ) : (
        <div className="space-y-2">
          {routeStats.map((r) => (
            <div
              key={r.key}
              className="flex items-center justify-between rounded-xl border border-white/[0.04] bg-white/[0.02] px-5 py-4 transition-all hover:border-white/[0.08] hover:bg-white/[0.03]"
            >
              <div className="flex items-center gap-5">
                <div className="flex items-center gap-2.5 font-mono">
                  <span className="text-base font-bold text-white">{r.origin}</span>
                  <div className="flex items-center gap-1">
                    <div className="h-px w-6 bg-brand-500/40" />
                    <Plane className="h-3.5 w-3.5 text-brand-400 -rotate-45" />
                    <div className="h-px w-6 bg-brand-500/40" />
                  </div>
                  <span className="text-base font-bold text-white">{r.dest}</span>
                </div>
                <span className="text-xs text-slate-500">
                  {r.flightCount} flight{r.flightCount !== 1 ? "s" : ""}
                </span>
                {r.reputation != null && (
                  <span className={`flex items-center gap-1 text-xs font-mono ${
                    r.reputation >= 70 ? "text-emerald-400" : r.reputation >= 40 ? "text-amber-400" : "text-red-400"
                  }`}>
                    <Star className="h-3 w-3" />{r.reputation.toFixed(0)}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-6">
                <div className="text-right">
                  <div className="text-[10px] text-slate-500">Avg Revenue</div>
                  <div className="font-mono text-sm text-slate-200">{currency(r.avgRevenue)}</div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] text-slate-500">Avg Cost</div>
                  <div className="font-mono text-sm text-slate-400">{currency(r.avgCost)}</div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] text-slate-500">Avg Net</div>
                  <div className={`font-mono text-sm font-semibold ${
                    r.avgNet >= 0 ? "text-emerald-400" : "text-red-400"
                  }`}>
                    {r.avgNet >= 0 ? "+" : ""}{currency(r.avgNet)}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function KpiCard({
  label,
  value,
  icon: Icon,
  iconColor = "text-brand-300",
  sub,
}: {
  label: string;
  value: string;
  icon: LucideIcon;
  iconColor?: string;
  sub?: string;
}) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-5 py-4 transition-all hover:bg-white/[0.04]">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-[0.15em] text-slate-500">{label}</span>
        <div className={`flex h-8 w-8 items-center justify-center rounded-lg bg-white/[0.04] ${iconColor}`}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <div className="text-xl font-bold text-white">{value}</div>
      {sub && <div className="mt-1 text-xs text-slate-500">{sub}</div>}
    </div>
  );
}
