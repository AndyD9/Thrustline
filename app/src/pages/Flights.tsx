import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useCompany } from "@/contexts/CompanyContext";
import { Plane, Clock, Fuel, Route, Users } from "lucide-react";
import type { Flight } from "@/lib/database.types";
import { gradeColors } from "@/lib/landingGrade";

const currency = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

export default function Flights() {
  const { company } = useCompany();
  const [flights, setFlights] = useState<Flight[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!company) return;
    setLoading(true);
    supabase
      .from("flights")
      .select("*")
      .eq("company_id", company.id)
      .order("completed_at", { ascending: false })
      .limit(50)
      .then(({ data }) => {
        setFlights((data as Flight[]) ?? []);
        setLoading(false);
      });
  }, [company?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!company) return null;

  // Compute stats
  const totalNm = flights.reduce((s, f) => s + Number(f.distance_nm), 0);
  const totalMin = flights.reduce((s, f) => s + (f.duration_min ?? 0), 0);
  const totalFuel = flights.reduce((s, f) => s + Number(f.fuel_used_gal), 0);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Flight log</h1>
          <p className="text-sm text-slate-400">{flights.length} flights recorded</p>
        </div>
      </div>

      {/* Stats strip */}
      {flights.length > 0 && (
        <div className="grid grid-cols-3 gap-4">
          <StatPill icon={Route} label="Total distance" value={`${totalNm.toFixed(0)} nm`} />
          <StatPill icon={Clock} label="Total time" value={`${Math.floor(totalMin / 60)}h ${totalMin % 60}m`} />
          <StatPill icon={Fuel} label="Total fuel" value={`${totalFuel.toFixed(0)} gal`} />
        </div>
      )}

      {loading ? (
        <div className="text-slate-400">Loading…</div>
      ) : flights.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-white/[0.06] bg-white/[0.02] py-16 text-center">
          <Plane className="mb-3 h-8 w-8 text-slate-600" />
          <div className="text-sm text-slate-400">No flights yet. Dispatch one and fly it in MSFS.</div>
        </div>
      ) : (
        <div className="space-y-2">
          {flights.map((f, i) => (
            <div
              key={f.id}
              className="group flex items-center justify-between rounded-xl border border-white/[0.04] bg-white/[0.02] px-5 py-4 transition-all hover:border-white/[0.08] hover:bg-white/[0.03]"
              style={{ animationDelay: `${i * 30}ms` }}
            >
              {/* Route */}
              <div className="flex items-center gap-5">
                <div className="flex items-center gap-2.5 font-mono">
                  <span className="text-base font-bold text-white">{f.departure_icao}</span>
                  <div className="flex items-center gap-1">
                    <div className="h-px w-8 bg-gradient-to-r from-brand-500/60 to-brand-500/20" />
                    <Plane className="h-3.5 w-3.5 text-brand-400 -rotate-45" />
                    <div className="h-px w-8 bg-gradient-to-l from-brand-500/60 to-brand-500/20" />
                  </div>
                  <span className="text-base font-bold text-white">{f.arrival_icao}</span>
                </div>

                <div className="flex items-center gap-4 text-xs text-slate-500">
                  <span>{Number(f.distance_nm).toFixed(0)} nm</span>
                  <span>{f.duration_min} min</span>
                  <span>{Number(f.fuel_used_gal).toFixed(0)} gal</span>
                </div>

                {/* Grade badge */}
                {f.landing_grade && (() => {
                  const gc = gradeColors(f.landing_grade);
                  return (
                    <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${gc.bgColor} ${gc.color}`}>
                      {f.landing_grade}
                    </span>
                  );
                })()}

                {/* Pax satisfaction */}
                {f.pax_satisfaction != null && (
                  <span className="flex items-center gap-1 text-xs text-slate-500">
                    <Users className="h-3 w-3" />
                    <span className={`font-mono font-semibold ${
                      f.pax_satisfaction >= 80 ? "text-emerald-400" : f.pax_satisfaction >= 50 ? "text-amber-400" : "text-red-400"
                    }`}>{Math.round(f.pax_satisfaction)}%</span>
                  </span>
                )}
              </div>

              {/* Financials + date */}
              <div className="flex items-center gap-6">
                <div className="text-right">
                  <div className="text-xs text-slate-500">Revenue</div>
                  <div className="font-mono text-sm text-slate-200">{currency(Number(f.revenue))}</div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-slate-500">Net</div>
                  <div
                    className={`font-mono text-sm font-semibold ${Number(f.net_result) >= 0 ? "text-emerald-400" : "text-red-400"}`}
                  >
                    {Number(f.net_result) >= 0 ? "+" : ""}{currency(Number(f.net_result))}
                  </div>
                </div>
                <div className="min-w-[120px] text-right text-[11px] text-slate-600">
                  {new Date(f.completed_at).toLocaleString()}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function StatPill({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Route;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3">
      <Icon className="h-4 w-4 text-brand-400" />
      <div>
        <div className="text-[10px] uppercase tracking-[0.15em] text-slate-500">{label}</div>
        <div className="font-mono text-sm font-semibold text-white">{value}</div>
      </div>
    </div>
  );
}
