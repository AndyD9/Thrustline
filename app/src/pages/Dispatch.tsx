import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { useCompany } from "@/contexts/CompanyContext";
import { Plane, Plus, X, Play, Ban, Radio, Users, Mountain, AlertTriangle, ExternalLink, Download, Loader2, FileText } from "lucide-react";
import type { Aircraft, Dispatch as DispatchT, DispatchStatus } from "@/lib/database.types";
import AirportPicker from "@/components/AirportPicker";
import AircraftTypePicker from "@/components/AircraftTypePicker";
import FlightMap from "@/components/FlightMap";
import OFPModal from "@/components/OFPModal";
import { airportByIcao } from "@/data/airports";
import { aircraftTypeByIcao } from "@/data/aircraftTypes";
import { haversineNm } from "@/lib/geo";
import { fetchOFP, buildSimbriefUrl, type SimBriefOFP } from "@/lib/simbrief";

const statusConfig: Record<DispatchStatus, { bg: string; text: string; dot: string }> = {
  pending:    { bg: "bg-slate-500/10 border-slate-500/20",   text: "text-slate-300",   dot: "bg-slate-400" },
  dispatched: { bg: "bg-blue-500/10 border-blue-500/20",     text: "text-blue-300",    dot: "bg-blue-400" },
  flying:     { bg: "bg-brand-500/10 border-brand-500/20",   text: "text-brand-300",   dot: "bg-brand-400" },
  completed:  { bg: "bg-emerald-500/10 border-emerald-500/20", text: "text-emerald-300", dot: "bg-emerald-400" },
  cancelled:  { bg: "bg-red-500/10 border-red-500/20",       text: "text-red-300",     dot: "bg-red-400" },
};

export default function DispatchPage() {
  const { company } = useCompany();
  const navigate = useNavigate();
  const [dispatches, setDispatches] = useState<DispatchT[]>([]);
  const [aircraft, setAircraft] = useState<Aircraft[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  const fetchDispatches = async () => {
    if (!company) return;
    setLoading(true);
    const { data } = await supabase
      .from("dispatches")
      .select("*")
      .eq("company_id", company.id)
      .order("created_at", { ascending: false })
      .limit(50);
    setDispatches((data as DispatchT[]) ?? []);
    setLoading(false);
  };

  const fetchAircraft = async () => {
    if (!company) return;
    const { data } = await supabase
      .from("aircraft")
      .select("*")
      .eq("company_id", company.id)
      .order("name");
    setAircraft((data as Aircraft[]) ?? []);
  };

  useEffect(() => {
    void fetchDispatches();
    void fetchAircraft();
  }, [company?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const updateStatus = async (id: string, status: DispatchStatus) => {
    await supabase.from("dispatches").update({ status }).eq("id", id);
    await fetchDispatches();
  };

  if (!company) return null;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Dispatch</h1>
          <p className="text-sm text-slate-400">{dispatches.length} dispatches</p>
        </div>
        <button
          onClick={() => setShowForm((s) => !s)}
          className="flex items-center gap-2 rounded-xl bg-brand-500 px-4 py-2.5 text-sm font-semibold text-white transition-all hover:bg-brand-400 hover:shadow-[0_0_20px_oklch(0.58_0.18_195_/_0.25)]"
        >
          {showForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          {showForm ? "Cancel" : "New dispatch"}
        </button>
      </div>

      {showForm && (
        <NewDispatchForm
          companyId={company.id}
          userId={company.user_id}
          airlineCode={company.airline_code}
          aircraft={aircraft}
          simbriefUsername={company.simbrief_username ?? ""}
          onDone={() => {
            setShowForm(false);
            void fetchDispatches();
          }}
        />
      )}

      {loading ? (
        <div className="text-slate-400">Loading...</div>
      ) : dispatches.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-white/[0.06] bg-white/[0.02] py-16 text-center">
          <Plane className="mb-3 h-8 w-8 text-slate-600" />
          <div className="text-sm text-slate-400">No dispatches yet. Create one and set it to "flying" before takeoff.</div>
        </div>
      ) : (
        <div className="space-y-3">
          {dispatches.map((d) => {
            const cfg = statusConfig[d.status];
            return (
              <div
                key={d.id}
                className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-5 py-4 transition-all hover:bg-white/[0.03]"
              >
                <div className="flex items-start justify-between">
                  <div className="space-y-2">
                    {/* Flight number + status */}
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-lg font-bold text-white">
                        {d.flight_number}
                      </span>
                      <span
                        className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${cfg.bg} ${cfg.text}`}
                      >
                        <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot} ${d.status === "flying" ? "animate-pulse" : ""}`} />
                        {d.status}
                      </span>
                    </div>

                    {/* Route visualization */}
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2.5 font-mono text-sm">
                        <span className="font-semibold text-white">{d.origin_icao}</span>
                        <div className="flex items-center gap-1">
                          <div className="h-px w-8 bg-gradient-to-r from-brand-500/60 to-brand-500/20" />
                          <Plane className="h-3.5 w-3.5 text-brand-400 -rotate-45" />
                          <div className="h-px w-8 bg-gradient-to-l from-brand-500/60 to-brand-500/20" />
                        </div>
                        <span className="font-semibold text-white">{d.dest_icao}</span>
                      </div>

                      <div className="flex items-center gap-3 text-xs text-slate-500">
                        <span className="font-mono">{d.icao_type}</span>
                        <span className="flex items-center gap-1">
                          <Users className="h-3 w-3" />
                          {d.pax_eco}Y + {d.pax_biz}J
                        </span>
                        <span className="flex items-center gap-1">
                          <Mountain className="h-3 w-3" />
                          FL{(d.cruise_alt / 100).toFixed(0)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2">
                    {d.status === "pending" && (
                      <>
                        <ActionBtn label="Dispatch" icon={Play} onClick={() => void updateStatus(d.id, "dispatched")} />
                        <ActionBtn label="Cancel" icon={Ban} variant="danger" onClick={() => void updateStatus(d.id, "cancelled")} />
                      </>
                    )}
                    {d.status === "dispatched" && (
                      <ActionBtn label="Start flying" icon={Plane} variant="primary" onClick={async () => {
                        await updateStatus(d.id, "flying");
                        navigate(`/live-flight?dispatch=${d.id}`);
                      }} />
                    )}
                    {d.status === "flying" && (
                      <span className="flex items-center gap-2 text-xs text-brand-300">
                        <Radio className="h-3.5 w-3.5 animate-pulse" />
                        In flight
                      </span>
                    )}
                  </div>
                </div>

                <div className="mt-2 text-[11px] text-slate-600">
                  Created {new Date(d.created_at).toLocaleString()}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ---------- Action button ---------- */

function ActionBtn({
  label,
  icon: Icon,
  onClick,
  variant = "default",
}: {
  label: string;
  icon: typeof Play;
  onClick: () => void;
  variant?: "default" | "primary" | "danger";
}) {
  const variants = {
    default: "border border-white/[0.08] text-slate-300 hover:border-white/[0.15] hover:text-white",
    primary: "bg-brand-500 text-white hover:bg-brand-400 hover:shadow-[0_0_16px_oklch(0.58_0.18_195_/_0.2)]",
    danger: "border border-red-500/20 text-red-400 hover:bg-red-500/[0.06]",
  };
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold transition-all ${variants[variant]}`}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </button>
  );
}

/* ---------- New Dispatch Form ---------- */

function NewDispatchForm({
  companyId,
  userId,
  airlineCode,
  aircraft,
  simbriefUsername,
  onDone,
}: {
  companyId: string;
  userId: string;
  airlineCode: string;
  aircraft: Aircraft[];
  simbriefUsername: string;
  onDone: () => void;
}) {
  const [flightNumber, setFlightNumber] = useState(airlineCode + "001");
  const [originIcao, setOriginIcao] = useState("");
  const [destIcao, setDestIcao] = useState("");
  const [aircraftId, setAircraftId] = useState(aircraft[0]?.id ?? "");
  const [icaoType, setIcaoType] = useState(aircraft[0]?.icao_type ?? "");
  const [paxEco, setPaxEco] = useState("160");
  const [paxBiz, setPaxBiz] = useState("12");
  const [cruiseAlt, setCruiseAlt] = useState("35000");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // SimBrief OFP
  const [ofp, setOfp] = useState<SimBriefOFP | null>(null);
  const [showOfpModal, setShowOfpModal] = useState(false);
  const [importingOFP, setImportingOFP] = useState(false);

  // Compute route distance for range validation
  const originApt = airportByIcao[originIcao];
  const destApt = airportByIcao[destIcao];
  const routeDistanceNm =
    originApt && destApt
      ? Math.round(haversineNm(originApt.lat, originApt.lon, destApt.lat, destApt.lon))
      : null;
  const acType = aircraftTypeByIcao[icaoType];
  const outOfRange = routeDistanceNm !== null && acType && routeDistanceNm > acType.rangeNm;

  const onAircraftChange = (id: string) => {
    setAircraftId(id);
    const ac = aircraft.find((a) => a.id === id);
    if (ac) {
      setIcaoType(ac.icao_type);
      // Auto-fill pax from aircraft type
      const type = aircraftTypeByIcao[ac.icao_type];
      if (type) {
        setPaxEco(String(type.maxPaxEco));
        setPaxBiz(String(type.maxPaxBiz));
      }
    }
  };

  const onTypeChange = (code: string) => {
    setIcaoType(code);
    const type = aircraftTypeByIcao[code];
    if (type) {
      setPaxEco(String(type.maxPaxEco));
      setPaxBiz(String(type.maxPaxBiz));
    }
  };

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const { error: insertError } = await supabase.from("dispatches").insert({
        user_id: userId,
        company_id: companyId,
        aircraft_id: aircraftId || null,
        flight_number: flightNumber.trim().toUpperCase(),
        origin_icao: originIcao.trim().toUpperCase(),
        dest_icao: destIcao.trim().toUpperCase(),
        icao_type: icaoType.trim().toUpperCase(),
        pax_eco: Number(paxEco),
        pax_biz: Number(paxBiz),
        cargo_kg: 0,
        estim_fuel_lbs: 0,
        cruise_alt: Number(cruiseAlt),
        status: "pending",
      });
      if (insertError) throw insertError;
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create dispatch");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="rounded-xl border border-brand-500/20 bg-brand-500/[0.03] p-5 space-y-4 animate-slide-up">
      <h2 className="text-[10px] uppercase tracking-[0.15em] text-slate-500">New dispatch</h2>

      <div className="grid grid-cols-3 gap-4">
        <Field label="Flight number" value={flightNumber} onChange={(v) => setFlightNumber(v.toUpperCase())} placeholder={`${airlineCode}001`} required />
        <AirportPicker label="Origin (ICAO)" value={originIcao} onChange={setOriginIcao} placeholder="LFPG" required />
        <AirportPicker label="Destination (ICAO)" value={destIcao} onChange={setDestIcao} placeholder="KJFK" required />
      </div>

      {/* Route distance info + map preview */}
      {routeDistanceNm !== null && (
        <div className="space-y-3">
          <div className={`flex items-center gap-2 text-xs ${outOfRange ? "text-amber-400" : "text-slate-500"}`}>
            {outOfRange && <AlertTriangle className="h-3.5 w-3.5" />}
            Route distance: {routeDistanceNm.toLocaleString()} nm
            {acType && ` / Aircraft range: ${acType.rangeNm.toLocaleString()} nm`}
            {outOfRange && " — out of range!"}
          </div>
          <FlightMap
            origin={originApt}
            destination={destApt}
            waypoints={ofp?.navlog?.map((f) => [f.lat, f.lon] as [number, number])}
            height="180px"
            interactive={false}
          />
        </div>
      )}

      <div className="grid grid-cols-5 gap-4">
        <label className="block">
          <span className="mb-1.5 block text-[10px] uppercase tracking-[0.15em] text-slate-400">Aircraft</span>
          <select
            value={aircraftId}
            onChange={(e) => onAircraftChange(e.target.value)}
            className="w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-brand-400/50"
          >
            <option value="">None</option>
            {aircraft.map((ac) => (
              <option key={ac.id} value={ac.id}>{ac.name} ({ac.icao_type})</option>
            ))}
          </select>
        </label>
        <AircraftTypePicker label="Type" value={icaoType} onChange={(v) => onTypeChange(v)} required />
        <Field label="Pax economy" value={paxEco} onChange={setPaxEco} type="number" required />
        <Field label="Pax business" value={paxBiz} onChange={setPaxBiz} type="number" required />
        <Field label="Cruise alt (ft)" value={cruiseAlt} onChange={setCruiseAlt} type="number" required />
      </div>

      {/* SimBrief buttons */}
      {simbriefUsername && (
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => {
              if (!originIcao || !destIcao || !icaoType) {
                setError("Fill origin, destination and aircraft type first");
                return;
              }
              window.open(buildSimbriefUrl(originIcao, destIcao, icaoType), "_blank");
            }}
            className="flex items-center gap-1.5 rounded-xl border border-white/[0.08] px-3 py-2 text-xs font-semibold text-slate-300 transition-all hover:border-white/[0.15] hover:text-white"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Generate on SimBrief
          </button>
          <button
            type="button"
            disabled={importingOFP}
            onClick={async () => {
              setImportingOFP(true);
              setError(null);
              // Poll every 5s for max 60s
              let attempts = 0;
              const poll = async (): Promise<SimBriefOFP | null> => {
                const result = await fetchOFP(simbriefUsername);
                if (result) return result;
                if (++attempts >= 12) return null;
                await new Promise((r) => setTimeout(r, 5000));
                return poll();
              };
              const result = await poll();
              setImportingOFP(false);
              if (result) {
                setOfp(result);
                setShowOfpModal(true);
              } else {
                setError("Could not fetch OFP. Generate a flight plan on SimBrief first.");
              }
            }}
            className="flex items-center gap-1.5 rounded-xl border border-brand-500/20 px-3 py-2 text-xs font-semibold text-brand-300 transition-all hover:bg-brand-500/[0.06]"
          >
            {importingOFP ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
            {importingOFP ? "Fetching OFP..." : "Import OFP"}
          </button>
          {ofp && (
            <button
              type="button"
              onClick={() => setShowOfpModal(true)}
              className="flex items-center gap-1.5 rounded-xl border border-emerald-500/20 px-3 py-2 text-xs font-semibold text-emerald-300 transition-all hover:bg-emerald-500/[0.06]"
            >
              <FileText className="h-3.5 w-3.5" />
              View OFP
            </button>
          )}
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/[0.06] px-4 py-2.5 text-xs text-red-300">{error}</div>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="rounded-xl bg-brand-500 px-6 py-2.5 text-sm font-semibold text-white transition-all hover:bg-brand-400 disabled:opacity-50"
      >
        {submitting ? "Creating..." : "Create dispatch"}
      </button>

      {/* OFP Modal */}
      {showOfpModal && ofp && (
        <OFPModal
          ofp={ofp}
          onClose={() => setShowOfpModal(false)}
          onApply={(o) => {
            // Apply OFP data to form fields
            if (o.origin.icao) setOriginIcao(o.origin.icao);
            if (o.destination.icao) setDestIcao(o.destination.icao);
            if (o.aircraft.icaoType) {
              setIcaoType(o.aircraft.icaoType);
              const type = aircraftTypeByIcao[o.aircraft.icaoType];
              if (type) {
                setPaxEco(String(type.maxPaxEco));
                setPaxBiz(String(type.maxPaxBiz));
              }
            }
            if (o.general.cruiseAlt) setCruiseAlt(String(o.general.cruiseAlt));
            if (o.weights.paxCount) setPaxEco(String(o.weights.paxCount));
            setShowOfpModal(false);
          }}
        />
      )}
    </form>
  );
}

/* ---------- Reusable field ---------- */

function Field({
  label,
  value,
  onChange,
  placeholder,
  required,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  required?: boolean;
  type?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[10px] uppercase tracking-[0.15em] text-slate-400">{label}</span>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        required={required}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2.5 text-sm text-slate-100 outline-none transition-all placeholder:text-slate-600 focus:border-brand-400/50"
      />
    </label>
  );
}
