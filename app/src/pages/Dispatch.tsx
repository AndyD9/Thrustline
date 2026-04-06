import { useEffect, useState, type FormEvent } from "react";
import { supabase } from "@/lib/supabase";
import { useCompany } from "@/contexts/CompanyContext";
import type { Aircraft, Dispatch as DispatchT, DispatchStatus } from "@/lib/database.types";

const statusColors: Record<DispatchStatus, string> = {
  pending: "bg-slate-500/20 text-slate-300",
  dispatched: "bg-blue-500/20 text-blue-300",
  flying: "bg-brand-500/20 text-brand-300",
  completed: "bg-emerald-500/20 text-emerald-300",
  cancelled: "bg-red-500/20 text-red-300",
};

export default function DispatchPage() {
  const { company } = useCompany();
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
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Dispatch</h1>
        <button
          onClick={() => setShowForm((s) => !s)}
          className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-400"
        >
          {showForm ? "Cancel" : "+ New dispatch"}
        </button>
      </div>

      {showForm && (
        <NewDispatchForm
          companyId={company.id}
          userId={company.user_id}
          airlineCode={company.airline_code}
          aircraft={aircraft}
          onDone={() => {
            setShowForm(false);
            void fetchDispatches();
          }}
        />
      )}

      {loading ? (
        <div className="text-slate-400">Loading...</div>
      ) : dispatches.length === 0 ? (
        <div className="glass px-5 py-8 text-center text-sm text-slate-400">
          No dispatches yet. Create one and set it to "flying" before takeoff.
        </div>
      ) : (
        <div className="space-y-3">
          {dispatches.map((d) => (
            <div key={d.id} className="glass px-5 py-4">
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-lg font-semibold text-slate-100">
                      {d.flight_number}
                    </span>
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${statusColors[d.status]}`}
                    >
                      {d.status}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-slate-400">
                    <span className="font-mono">
                      {d.origin_icao} &rarr; {d.dest_icao}
                    </span>
                    <span>{d.icao_type}</span>
                    <span>
                      {d.pax_eco}Y + {d.pax_biz}J
                    </span>
                    <span>FL{(d.cruise_alt / 100).toFixed(0)}</span>
                  </div>
                </div>

                <div className="flex gap-2">
                  {d.status === "pending" && (
                    <>
                      <ActionBtn
                        label="Dispatch"
                        onClick={() => void updateStatus(d.id, "dispatched")}
                      />
                      <ActionBtn
                        label="Cancel"
                        variant="danger"
                        onClick={() => void updateStatus(d.id, "cancelled")}
                      />
                    </>
                  )}
                  {d.status === "dispatched" && (
                    <ActionBtn
                      label="Start flying"
                      variant="primary"
                      onClick={() => void updateStatus(d.id, "flying")}
                    />
                  )}
                  {d.status === "flying" && (
                    <span className="flex items-center gap-1.5 text-xs text-brand-300">
                      <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-brand-400" />
                      In flight
                    </span>
                  )}
                </div>
              </div>

              <div className="mt-2 text-[11px] text-slate-600">
                Created {new Date(d.created_at).toLocaleString()}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------- Action button ---------- */

function ActionBtn({
  label,
  onClick,
  variant = "default",
}: {
  label: string;
  onClick: () => void;
  variant?: "default" | "primary" | "danger";
}) {
  const base = "rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors";
  const variants = {
    default: "border border-white/10 text-slate-300 hover:border-white/20 hover:text-white",
    primary: "bg-brand-500 text-white hover:bg-brand-400",
    danger: "border border-red-500/30 text-red-400 hover:bg-red-500/10",
  };
  return (
    <button onClick={onClick} className={`${base} ${variants[variant]}`}>
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
  onDone,
}: {
  companyId: string;
  userId: string;
  airlineCode: string;
  aircraft: Aircraft[];
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

  // Auto-fill icao_type when aircraft changes
  const onAircraftChange = (id: string) => {
    setAircraftId(id);
    const ac = aircraft.find((a) => a.id === id);
    if (ac) setIcaoType(ac.icao_type);
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
    <form onSubmit={onSubmit} className="glass space-y-4 px-5 py-4">
      <h2 className="text-[10px] uppercase tracking-wider text-slate-500">New dispatch</h2>

      <div className="grid grid-cols-3 gap-4">
        <Field
          label="Flight number"
          value={flightNumber}
          onChange={(v) => setFlightNumber(v.toUpperCase())}
          placeholder={`${airlineCode}001`}
          required
        />
        <Field
          label="Origin (ICAO)"
          value={originIcao}
          onChange={(v) => setOriginIcao(v.toUpperCase())}
          placeholder="LFPG"
          required
        />
        <Field
          label="Destination (ICAO)"
          value={destIcao}
          onChange={(v) => setDestIcao(v.toUpperCase())}
          placeholder="KJFK"
          required
        />
      </div>

      <div className="grid grid-cols-4 gap-4">
        <label className="block">
          <span className="mb-1 block text-[10px] uppercase tracking-wider text-slate-400">
            Aircraft
          </span>
          <select
            value={aircraftId}
            onChange={(e) => onAircraftChange(e.target.value)}
            className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-100 outline-none focus:border-brand-400"
          >
            <option value="">None</option>
            {aircraft.map((ac) => (
              <option key={ac.id} value={ac.id}>
                {ac.name} ({ac.icao_type})
              </option>
            ))}
          </select>
        </label>
        <Field label="Pax economy" value={paxEco} onChange={setPaxEco} type="number" required />
        <Field label="Pax business" value={paxBiz} onChange={setPaxBiz} type="number" required />
        <Field
          label="Cruise alt (ft)"
          value={cruiseAlt}
          onChange={setCruiseAlt}
          type="number"
          required
        />
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="rounded-lg bg-brand-500 px-6 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-400 disabled:opacity-50"
      >
        {submitting ? "Creating..." : "Create dispatch"}
      </button>
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
      <span className="mb-1 block text-[10px] uppercase tracking-wider text-slate-400">
        {label}
      </span>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        required={required}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-100 outline-none focus:border-brand-400"
      />
    </label>
  );
}
