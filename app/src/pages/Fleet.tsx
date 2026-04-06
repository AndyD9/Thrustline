import { useEffect, useState, type FormEvent } from "react";
import { supabase } from "@/lib/supabase";
import { useCompany } from "@/contexts/CompanyContext";
import { Plane, Wrench, Clock, Hash, Plus, X, ChevronRight, Download, Loader2 } from "lucide-react";
import type { Aircraft } from "@/lib/database.types";
import AircraftTypePicker from "@/components/AircraftTypePicker";
import { fetchSimbriefAircraft } from "@/lib/simbrief";
import { Info } from "lucide-react";

/** Generate realistic aircraft pricing based on MTOW.
 *  Purchase: ~$350-450/kg MTOW with ±10% market variance.
 *  Lease: ~1.0-1.4% of purchase price per month. */
function generatePricing(mtowKg: number): { purchase: number; leaseMo: number } {
  const pricePerKg = 350 + Math.random() * 100; // $350-450/kg
  const purchase = Math.round(mtowKg * pricePerKg / 100000) * 100000; // round to 100k
  const leaseRate = 0.010 + Math.random() * 0.004; // 1.0-1.4%/mo
  const leaseMo = Math.round(purchase * leaseRate / 1000) * 1000; // round to 1k
  return { purchase, leaseMo };
}

const pct = (n: number) => `${n.toFixed(1)}%`;
const currency = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

export default function Fleet() {
  const { company, refetch: refetchCompany } = useCompany();
  const [aircraft, setAircraft] = useState<Aircraft[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  const fetchFleet = async () => {
    if (!company) return;
    setLoading(true);
    const { data } = await supabase
      .from("aircraft")
      .select("*")
      .eq("company_id", company.id)
      .order("created_at", { ascending: false });
    setAircraft((data as Aircraft[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    void fetchFleet();
  }, [company?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const setActive = async (id: string) => {
    if (!company) return;
    await supabase
      .from("companies")
      .update({ active_aircraft_id: id })
      .eq("id", company.id);
    await refetchCompany();
  };

  if (!company) return null;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Fleet</h1>
          <p className="text-sm text-slate-400">{aircraft.length} aircraft in fleet</p>
        </div>
        <button
          onClick={() => setShowForm((s) => !s)}
          className="flex items-center gap-2 rounded-xl bg-brand-500 px-4 py-2.5 text-sm font-semibold text-white transition-all hover:bg-brand-400 hover:shadow-[0_0_20px_oklch(0.58_0.18_195_/_0.25)]"
        >
          {showForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          {showForm ? "Cancel" : "Add aircraft"}
        </button>
      </div>

      {showForm && (
        <AddAircraftForm
          companyId={company.id}
          userId={company.user_id}
          simbriefUsername={company.simbrief_username ?? ""}
          onDone={() => {
            setShowForm(false);
            void fetchFleet();
          }}
        />
      )}

      {loading ? (
        <div className="text-slate-400">Loading...</div>
      ) : aircraft.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-white/[0.06] bg-white/[0.02] py-16 text-center">
          <Plane className="mb-3 h-8 w-8 text-slate-600" />
          <div className="text-sm text-slate-400">No aircraft yet. Add one to start dispatching flights.</div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {aircraft.map((ac) => {
            const isActive = company.active_aircraft_id === ac.id;
            const healthColor =
              ac.health_pct > 70 ? "from-emerald-500 to-emerald-400" :
              ac.health_pct > 40 ? "from-yellow-500 to-yellow-400" :
              "from-red-500 to-red-400";
            const healthGlow =
              ac.health_pct > 70 ? "shadow-[0_0_8px_rgba(52,211,153,0.3)]" :
              ac.health_pct > 40 ? "shadow-[0_0_8px_rgba(250,204,21,0.3)]" :
              "shadow-[0_0_8px_rgba(248,113,113,0.3)]";

            return (
              <div
                key={ac.id}
                className={`group rounded-xl border bg-white/[0.02] p-5 transition-all hover:bg-white/[0.04] ${
                  isActive ? "border-brand-500/30 glow-brand-sm" : "border-white/[0.06]"
                }`}
              >
                {/* Header */}
                <div className="mb-4 flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${isActive ? "bg-brand-500/15" : "bg-white/[0.04]"}`}>
                      <Plane className={`h-5 w-5 ${isActive ? "text-brand-300" : "text-slate-400"}`} />
                    </div>
                    <div>
                      <div className="font-semibold text-white">{ac.name}</div>
                      <div className="font-mono text-xs text-slate-500">
                        {ac.icao_type}{ac.registration ? ` · ${ac.registration}` : ""} · {ac.ownership}
                      </div>
                    </div>
                  </div>
                  {isActive ? (
                    <span className="rounded-full bg-brand-500/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-brand-300">
                      Active
                    </span>
                  ) : (
                    <button
                      onClick={() => void setActive(ac.id)}
                      className="flex items-center gap-1 rounded-full border border-white/[0.08] px-2.5 py-1 text-[10px] uppercase tracking-wider text-slate-400 transition-all hover:border-brand-400/40 hover:text-brand-300"
                    >
                      Set active <ChevronRight className="h-3 w-3" />
                    </button>
                  )}
                </div>

                {/* Health bar */}
                <div className="mb-4">
                  <div className="mb-2 flex items-center justify-between text-[10px] uppercase tracking-[0.15em]">
                    <span className="flex items-center gap-1.5 text-slate-500">
                      <Wrench className="h-3 w-3" /> Health
                    </span>
                    <span className={ac.health_pct < 50 ? "text-red-400" : "text-slate-300"}>
                      {pct(ac.health_pct)}
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-white/[0.04]">
                    <div
                      className={`h-full rounded-full bg-gradient-to-r ${healthColor} ${healthGlow} transition-all`}
                      style={{ width: `${ac.health_pct}%` }}
                    />
                  </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="rounded-lg bg-white/[0.03] px-3 py-2 text-center">
                    <div className="flex items-center justify-center gap-1 text-[10px] uppercase tracking-wider text-slate-500">
                      <Hash className="h-3 w-3" /> Cycles
                    </div>
                    <div className="mt-0.5 font-mono text-sm font-semibold text-white">{ac.cycles}</div>
                  </div>
                  <div className="rounded-lg bg-white/[0.03] px-3 py-2 text-center">
                    <div className="flex items-center justify-center gap-1 text-[10px] uppercase tracking-wider text-slate-500">
                      <Clock className="h-3 w-3" /> Hours
                    </div>
                    <div className="mt-0.5 font-mono text-sm font-semibold text-white">{ac.total_hours.toFixed(1)}</div>
                  </div>
                  <div className="rounded-lg bg-white/[0.03] px-3 py-2 text-center">
                    <div className="text-[10px] uppercase tracking-wider text-slate-500">
                      {ac.ownership === "leased" ? "Lease/mo" : "Value"}
                    </div>
                    <div className="mt-0.5 font-mono text-sm font-semibold text-white">
                      {currency(ac.ownership === "leased" ? ac.lease_cost_mo : ac.purchase_price)}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ---------- Add Aircraft Form ---------- */

function AddAircraftForm({
  companyId,
  userId,
  simbriefUsername,
  onDone,
}: {
  companyId: string;
  userId: string;
  simbriefUsername: string;
  onDone: () => void;
}) {
  const [name, setName] = useState("");
  const [registration, setRegistration] = useState("");
  const [icaoType, setIcaoType] = useState("");
  const [simbriefAircraftId, setSimbriefAircraftId] = useState("");
  const [ownership, setOwnership] = useState<"leased" | "owned">("leased");
  const [leaseCost, setLeaseCost] = useState("50000");
  const [purchasePrice, setPurchasePrice] = useState("0");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [fetchedSpecs, setFetchedSpecs] = useState<{
    maxPax: number; maxCargoKg: number; maxFuelKg: number;
    emptyWeightKg: number; maxTakeoffKg: number; maxLandingKg: number;
    maxZeroFuelKg: number; engineType: string;
  } | null>(null);

  const doFetchSimbrief = async () => {
    if (!simbriefUsername) { setError("Set your SimBrief username in Settings first"); return; }
    setFetching(true);
    setError(null);
    const ac = await fetchSimbriefAircraft(simbriefUsername, simbriefAircraftId);
    setFetching(false);
    if (!ac) { setError("Could not fetch aircraft. You need to generate at least one OFP with this aircraft on SimBrief first."); return; }
    // Auto-fill fields
    if (ac.icaoType) setIcaoType(ac.icaoType);
    if (ac.registration) setRegistration(ac.registration);
    if (ac.name) setName(ac.name);
    // Auto-generate pricing from MTOW
    if (ac.maxTakeoffKg > 0) {
      const pricing = generatePricing(ac.maxTakeoffKg);
      setLeaseCost(String(pricing.leaseMo));
      setPurchasePrice(String(pricing.purchase));
    }
    setFetchedSpecs({
      maxPax: ac.maxPax,
      maxCargoKg: ac.maxCargoKg,
      maxFuelKg: ac.maxFuelKg,
      emptyWeightKg: ac.emptyWeightKg,
      maxTakeoffKg: ac.maxTakeoffKg,
      maxLandingKg: ac.maxLandingKg,
      maxZeroFuelKg: ac.maxZeroFuelKg,
      engineType: ac.engineType,
    });
  };

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const { error: insertError } = await supabase.from("aircraft").insert({
        user_id: userId,
        company_id: companyId,
        name: name.trim(),
        registration: registration.trim().toUpperCase() || null,
        icao_type: icaoType.trim().toUpperCase(),
        simbrief_aircraft_id: simbriefAircraftId.trim() || null,
        ownership,
        lease_cost_mo: ownership === "leased" ? Number(leaseCost) : 0,
        purchase_price: ownership === "owned" ? Number(purchasePrice) : 0,
        health_pct: 100,
        total_hours: 0,
        cycles: 0,
      });
      if (insertError) throw insertError;
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add aircraft");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="rounded-xl border border-brand-500/20 bg-brand-500/[0.03] p-5 space-y-4 animate-slide-up">
      <h2 className="text-[10px] uppercase tracking-[0.15em] text-slate-500">New aircraft</h2>

      {/* SimBrief import */}
      {simbriefUsername && (
        <div className="flex items-end gap-3">
          <Field label="SimBrief Aircraft ID" value={simbriefAircraftId} onChange={setSimbriefAircraftId} placeholder="474071_1739520357047" />
          <button
            type="button"
            onClick={() => void doFetchSimbrief()}
            disabled={fetching || !simbriefAircraftId}
            className="flex items-center gap-1.5 rounded-xl border border-brand-500/20 px-3 py-2.5 text-xs font-semibold text-brand-300 transition-all hover:bg-brand-500/[0.06] disabled:opacity-50"
          >
            {fetching ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
            {fetching ? "Fetching..." : "Fetch from SimBrief"}
          </button>
        </div>
      )}

      {/* Info note */}
      {simbriefUsername && !fetchedSpecs && (
        <div className="flex items-start gap-2 rounded-lg border border-blue-500/10 bg-blue-500/[0.03] px-3 py-2 text-[11px] text-blue-300/70">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            Paste the Internal ID from your SimBrief saved aircraft page (visible at the top: "Internal ID: xxx").
            You must have generated at least one OFP with this aircraft on SimBrief for the fetch to work.
          </span>
        </div>
      )}

      {/* Fetched specs display */}
      {fetchedSpecs && (
        <div className="flex flex-wrap gap-2">
          <SpecPill label="Max Pax" value={String(fetchedSpecs.maxPax)} />
          <SpecPill label="MTOW" value={`${fetchedSpecs.maxTakeoffKg.toLocaleString()} kg`} />
          <SpecPill label="MLW" value={`${fetchedSpecs.maxLandingKg.toLocaleString()} kg`} />
          <SpecPill label="MZFW" value={`${fetchedSpecs.maxZeroFuelKg.toLocaleString()} kg`} />
          <SpecPill label="OEW" value={`${fetchedSpecs.emptyWeightKg.toLocaleString()} kg`} />
          <SpecPill label="Max Fuel" value={`${fetchedSpecs.maxFuelKg.toLocaleString()} kg`} />
          <SpecPill label="Max Cargo" value={`${fetchedSpecs.maxCargoKg.toLocaleString()} kg`} />
          <SpecPill label="Engines" value={fetchedSpecs.engineType} />
        </div>
      )}

      <div className="grid grid-cols-3 gap-4">
        <Field label="Name" value={name} onChange={setName} placeholder="Thrustline One" required />
        <Field label="Registration" value={registration} onChange={(v) => setRegistration(v.toUpperCase())} placeholder="F-GKXS" />
        <AircraftTypePicker
          label="ICAO type"
          value={icaoType}
          onChange={(v) => setIcaoType(v)}
          required
        />
      </div>

      <div className="grid grid-cols-3 gap-4">
        <label className="block">
          <span className="mb-1.5 block text-[10px] uppercase tracking-[0.15em] text-slate-400">
            Ownership
          </span>
          <select
            value={ownership}
            onChange={(e) => setOwnership(e.target.value as "leased" | "owned")}
            className="w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-brand-400/50"
          >
            <option value="leased">Leased</option>
            <option value="owned">Owned</option>
          </select>
        </label>
        {ownership === "leased" ? (
          <ReadOnlyField label="Lease cost / mo" value={`$${Number(leaseCost).toLocaleString()}`} />
        ) : (
          <ReadOnlyField label="Purchase price" value={`$${Number(purchasePrice).toLocaleString()}`} />
        )}
        <ReadOnlyField label={ownership === "leased" ? "Market value" : "Lease equivalent"} value={ownership === "leased" ? `$${Number(purchasePrice).toLocaleString()}` : `$${Number(leaseCost).toLocaleString()}/mo`} />
      </div>

      {error && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/[0.06] px-4 py-2.5 text-xs text-red-300">{error}</div>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="rounded-xl bg-brand-500 px-6 py-2.5 text-sm font-semibold text-white transition-all hover:bg-brand-400 disabled:opacity-50"
      >
        {submitting ? "Adding..." : "Add aircraft"}
      </button>
    </form>
  );
}

/* ---------- Read-only field ---------- */

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <div className="block">
      <span className="mb-1.5 block text-[10px] uppercase tracking-[0.15em] text-slate-400">{label}</span>
      <div className="w-full rounded-xl border border-white/[0.06] bg-white/[0.01] px-3 py-2.5 text-sm font-mono text-slate-300">
        {value}
      </div>
    </div>
  );
}

/* ---------- Spec pill ---------- */

function SpecPill({ label, value }: { label: string; value: string }) {
  return (
    <span className="flex items-center gap-1.5 rounded-lg border border-emerald-500/10 bg-emerald-500/[0.03] px-2.5 py-1 text-[11px]">
      <span className="text-slate-500">{label}</span>
      <span className="font-mono font-medium text-emerald-300">{value}</span>
    </span>
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
      <span className="mb-1.5 block text-[10px] uppercase tracking-[0.15em] text-slate-400">
        {label}
      </span>
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
