import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useCompany } from "@/contexts/CompanyContext";
import { fetchMetar, fetchTaf } from "@/lib/weather";
import { DEFAULT_CHECKLIST } from "@/lib/checklists";
import type { Dispatch } from "@/lib/database.types";
import {
  Cloud,
  CheckSquare,
  Square,
  FileText,
  RefreshCw,
  Plane,
  ChevronDown,
  ChevronRight,
} from "lucide-react";

export default function EFB() {
  const { company } = useCompany();
  const [dispatch, setDispatch] = useState<Dispatch | null>(null);
  const [depMetar, setDepMetar] = useState<string | null>(null);
  const [arrMetar, setArrMetar] = useState<string | null>(null);
  const [depTaf, setDepTaf] = useState<string | null>(null);
  const [arrTaf, setArrTaf] = useState<string | null>(null);
  const [wxLoading, setWxLoading] = useState(false);

  // Checklist state: track which items are checked
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [expandedSections, setExpandedSections] = useState<Set<number>>(new Set([0]));

  // Load active dispatch (flying or dispatched)
  useEffect(() => {
    if (!company) return;
    supabase
      .from("dispatches")
      .select("*")
      .eq("company_id", company.id)
      .in("status", ["flying", "dispatched"])
      .order("created_at", { ascending: false })
      .limit(1)
      .then(({ data }) => {
        const d = (data as Dispatch[] | null)?.[0] ?? null;
        setDispatch(d);
        // Auto-fetch weather if dispatch available
        if (d) fetchWeather(d.origin_icao, d.dest_icao);
      });
  }, [company?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchWeather = useCallback(async (dep: string, arr: string) => {
    setWxLoading(true);
    const [dm, am, dt, at_] = await Promise.all([
      fetchMetar(dep),
      fetchMetar(arr),
      fetchTaf(dep),
      fetchTaf(arr),
    ]);
    setDepMetar(dm);
    setArrMetar(am);
    setDepTaf(dt);
    setArrTaf(at_);
    setWxLoading(false);
  }, []);

  const toggleCheck = (key: string) => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleSection = (idx: number) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  if (!company) return null;

  // Count checklist progress
  const totalItems = DEFAULT_CHECKLIST.reduce((s, sec) => s + sec.items.length, 0);
  const checkedCount = checked.size;
  const checkProgress = totalItems > 0 ? Math.round((checkedCount / totalItems) * 100) : 0;

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-white">Electronic Flight Bag</h1>
        <p className="text-sm text-slate-400">
          {dispatch
            ? `${dispatch.flight_number} · ${dispatch.origin_icao} → ${dispatch.dest_icao}`
            : "No active dispatch"}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        {/* Weather Panel */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.15em] text-slate-500">
              <Cloud className="h-3.5 w-3.5" /> Weather
            </div>
            {dispatch && (
              <button
                onClick={() => fetchWeather(dispatch.origin_icao, dispatch.dest_icao)}
                disabled={wxLoading}
                className="flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] text-slate-400 transition-colors hover:bg-white/[0.04] hover:text-slate-300"
              >
                <RefreshCw className={`h-3 w-3 ${wxLoading ? "animate-spin" : ""}`} />
                Refresh
              </button>
            )}
          </div>

          {dispatch ? (
            <div className="grid grid-cols-2 gap-3">
              <WeatherCard icao={dispatch.origin_icao} metar={depMetar} taf={depTaf} label="Departure" />
              <WeatherCard icao={dispatch.dest_icao} metar={arrMetar} taf={arrTaf} label="Arrival" />
            </div>
          ) : (
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-8 text-center text-sm text-slate-500">
              Create a dispatch to see weather information
            </div>
          )}
        </div>

        {/* Flight Plan Summary */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.15em] text-slate-500">
            <FileText className="h-3.5 w-3.5" /> Flight Plan
          </div>

          {dispatch?.ofp_data ? (
            <OFPSummary ofpData={dispatch.ofp_data} />
          ) : (
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-8 text-center text-sm text-slate-500">
              {dispatch ? "No SimBrief OFP loaded for this dispatch" : "No active dispatch"}
            </div>
          )}
        </div>
      </div>

      {/* Interactive Checklist */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.15em] text-slate-500">
            <CheckSquare className="h-3.5 w-3.5" /> Checklist
          </div>
          <div className="flex items-center gap-3">
            <span className="font-mono text-xs text-slate-400">
              {checkedCount}/{totalItems}
            </span>
            <div className="h-1.5 w-24 overflow-hidden rounded-full bg-white/[0.04]">
              <div
                className="h-full rounded-full bg-brand-400 transition-all duration-300"
                style={{ width: `${checkProgress}%` }}
              />
            </div>
            {checkedCount > 0 && (
              <button
                onClick={() => setChecked(new Set())}
                className="text-[10px] text-slate-500 hover:text-slate-300"
              >
                Reset
              </button>
            )}
          </div>
        </div>

        <div className="space-y-2">
          {DEFAULT_CHECKLIST.map((section, si) => {
            const isExpanded = expandedSections.has(si);
            const sectionChecked = section.items.filter((_, ii) => checked.has(`${si}-${ii}`)).length;
            const sectionDone = sectionChecked === section.items.length;

            return (
              <div key={si} className="rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
                <button
                  onClick={() => toggleSection(si)}
                  className="flex w-full items-center justify-between px-5 py-3 text-left"
                >
                  <div className="flex items-center gap-3">
                    {isExpanded
                      ? <ChevronDown className="h-3.5 w-3.5 text-slate-500" />
                      : <ChevronRight className="h-3.5 w-3.5 text-slate-500" />}
                    <span className={`text-sm font-semibold ${sectionDone ? "text-emerald-400" : "text-white"}`}>
                      {section.title}
                    </span>
                  </div>
                  <span className="font-mono text-[10px] text-slate-500">
                    {sectionChecked}/{section.items.length}
                  </span>
                </button>

                {isExpanded && (
                  <div className="border-t border-white/[0.04] px-5 py-2">
                    {section.items.map((item, ii) => {
                      const key = `${si}-${ii}`;
                      const isChecked = checked.has(key);
                      return (
                        <button
                          key={key}
                          onClick={() => toggleCheck(key)}
                          className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors hover:bg-white/[0.03]"
                        >
                          {isChecked ? (
                            <CheckSquare className="h-4 w-4 shrink-0 text-emerald-400" />
                          ) : (
                            <Square className="h-4 w-4 shrink-0 text-slate-600" />
                          )}
                          <span className={`text-sm ${isChecked ? "text-slate-500 line-through" : "text-slate-200"}`}>
                            {item.label}
                          </span>
                          {item.detail && (
                            <span className={`ml-auto font-mono text-xs ${
                              isChecked ? "text-emerald-400/50" : "text-brand-400"
                            }`}>
                              {item.detail}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ─── Sub-components ──────────────────────────────────── */

function WeatherCard({
  icao,
  metar,
  taf,
  label,
}: {
  icao: string;
  metar: string | null;
  taf: string | null;
  label: string;
}) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
      <div className="mb-2 flex items-center gap-2">
        <Plane className="h-3.5 w-3.5 text-brand-400" />
        <span className="text-[10px] uppercase tracking-[0.15em] text-slate-500">{label}</span>
        <span className="font-mono text-sm font-bold text-white">{icao}</span>
      </div>
      <div className="space-y-2">
        <div>
          <div className="text-[9px] uppercase tracking-wider text-slate-600">METAR</div>
          <div className="font-mono text-[11px] leading-relaxed text-slate-300">
            {metar ?? <span className="text-slate-600">No data</span>}
          </div>
        </div>
        {taf && (
          <div>
            <div className="text-[9px] uppercase tracking-wider text-slate-600">TAF</div>
            <div className="max-h-20 overflow-y-auto font-mono text-[11px] leading-relaxed text-slate-400">
              {taf}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function OFPSummary({ ofpData }: { ofpData: unknown }) {
  const ofp = typeof ofpData === "string" ? (() => { try { return JSON.parse(ofpData); } catch { return null; } })() : ofpData;
  if (!ofp) return null;

  const route = ofp.general?.route ?? ofp.route ?? null;
  const cruiseAlt = ofp.general?.initial_altitude ?? ofp.cruise_altitude ?? null;
  const fuelTotal = ofp.fuel?.plan_ramp ?? null;
  const fuelEnroute = ofp.fuel?.enroute_burn ?? null;
  const estTime = ofp.times?.est_time_enroute ?? null;

  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 space-y-3">
      {route && (
        <div>
          <div className="text-[9px] uppercase tracking-wider text-slate-600">Route</div>
          <div className="font-mono text-[11px] leading-relaxed text-slate-300 max-h-16 overflow-y-auto">
            {route}
          </div>
        </div>
      )}
      <div className="grid grid-cols-3 gap-3">
        {cruiseAlt && (
          <div>
            <div className="text-[9px] uppercase tracking-wider text-slate-600">Cruise Alt</div>
            <div className="font-mono text-sm text-white">FL{Math.round(Number(cruiseAlt) / 100)}</div>
          </div>
        )}
        {fuelTotal && (
          <div>
            <div className="text-[9px] uppercase tracking-wider text-slate-600">Total Fuel</div>
            <div className="font-mono text-sm text-white">{Number(fuelTotal).toLocaleString()} lbs</div>
          </div>
        )}
        {fuelEnroute && (
          <div>
            <div className="text-[9px] uppercase tracking-wider text-slate-600">Enroute Burn</div>
            <div className="font-mono text-sm text-white">{Number(fuelEnroute).toLocaleString()} lbs</div>
          </div>
        )}
        {estTime && (
          <div>
            <div className="text-[9px] uppercase tracking-wider text-slate-600">Est. Time</div>
            <div className="font-mono text-sm text-white">
              {Math.floor(Number(estTime) / 3600)}h {Math.floor((Number(estTime) % 3600) / 60)}m
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
