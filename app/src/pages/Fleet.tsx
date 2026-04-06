import { useEffect, useState, type FormEvent } from "react";
import { supabase } from "@/lib/supabase";
import { useCompany } from "@/contexts/CompanyContext";
import type { Aircraft } from "@/lib/database.types";

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
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Fleet</h1>
        <button
          onClick={() => setShowForm((s) => !s)}
          className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-400"
        >
          {showForm ? "Cancel" : "+ Add aircraft"}
        </button>
      </div>

      {showForm && (
        <AddAircraftForm
          companyId={company.id}
          userId={company.user_id}
          onDone={() => {
            setShowForm(false);
            void fetchFleet();
          }}
        />
      )}

      {loading ? (
        <div className="text-slate-400">Loading...</div>
      ) : aircraft.length === 0 ? (
        <div className="glass px-5 py-8 text-center text-sm text-slate-400">
          No aircraft yet. Add one to start dispatching flights.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {aircraft.map((ac) => {
            const isActive = company.active_aircraft_id === ac.id;
            return (
              <div key={ac.id} className="glass space-y-3 px-5 py-4">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="font-semibold text-slate-100">{ac.name}</div>
                    <div className="text-xs text-slate-500">
                      {ac.icao_type} &middot; {ac.ownership}
                    </div>
                  </div>
                  {isActive ? (
                    <span className="rounded-full bg-brand-500/20 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-brand-300">
                      Active
                    </span>
                  ) : (
                    <button
                      onClick={() => void setActive(ac.id)}
                      className="rounded-full border border-white/10 px-2.5 py-0.5 text-[10px] uppercase tracking-wider text-slate-400 transition-colors hover:border-brand-400 hover:text-brand-300"
                    >
                      Set active
                    </button>
                  )}
                </div>

                {/* Health bar */}
                <div>
                  <div className="mb-1 flex items-center justify-between text-[10px] uppercase tracking-wider text-slate-500">
                    <span>Health</span>
                    <span className={ac.health_pct < 50 ? "text-red-400" : "text-slate-300"}>
                      {pct(ac.health_pct)}
                    </span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-white/5">
                    <div
                      className={`h-full rounded-full transition-all ${
                        ac.health_pct > 70
                          ? "bg-emerald-400"
                          : ac.health_pct > 40
                            ? "bg-yellow-400"
                            : "bg-red-400"
                      }`}
                      style={{ width: `${ac.health_pct}%` }}
                    />
                  </div>
                </div>

                {/* Stats */}
                <dl className="grid grid-cols-3 gap-2 text-center text-xs">
                  <div>
                    <dt className="text-[10px] uppercase tracking-wider text-slate-500">Cycles</dt>
                    <dd className="font-mono text-slate-200">{ac.cycles}</dd>
                  </div>
                  <div>
                    <dt className="text-[10px] uppercase tracking-wider text-slate-500">Hours</dt>
                    <dd className="font-mono text-slate-200">{ac.total_hours.toFixed(1)}</dd>
                  </div>
                  <div>
                    <dt className="text-[10px] uppercase tracking-wider text-slate-500">
                      {ac.ownership === "leased" ? "Lease/mo" : "Value"}
                    </dt>
                    <dd className="font-mono text-slate-200">
                      {currency(ac.ownership === "leased" ? ac.lease_cost_mo : ac.purchase_price)}
                    </dd>
                  </div>
                </dl>
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
  onDone,
}: {
  companyId: string;
  userId: string;
  onDone: () => void;
}) {
  const [name, setName] = useState("");
  const [icaoType, setIcaoType] = useState("");
  const [ownership, setOwnership] = useState<"leased" | "owned">("leased");
  const [leaseCost, setLeaseCost] = useState("50000");
  const [purchasePrice, setPurchasePrice] = useState("0");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const { error: insertError } = await supabase.from("aircraft").insert({
        user_id: userId,
        company_id: companyId,
        name: name.trim(),
        icao_type: icaoType.trim().toUpperCase(),
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
    <form onSubmit={onSubmit} className="glass space-y-4 px-5 py-4">
      <h2 className="text-[10px] uppercase tracking-wider text-slate-500">New aircraft</h2>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Name" value={name} onChange={setName} placeholder="Thrustline One" required />
        <Field
          label="ICAO type"
          value={icaoType}
          onChange={(v) => setIcaoType(v.toUpperCase())}
          placeholder="B738"
          required
        />
      </div>

      <div className="grid grid-cols-3 gap-4">
        <label className="block">
          <span className="mb-1 block text-[10px] uppercase tracking-wider text-slate-400">
            Ownership
          </span>
          <select
            value={ownership}
            onChange={(e) => setOwnership(e.target.value as "leased" | "owned")}
            className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-100 outline-none focus:border-brand-400"
          >
            <option value="leased">Leased</option>
            <option value="owned">Owned</option>
          </select>
        </label>
        {ownership === "leased" ? (
          <Field
            label="Lease cost / mo"
            value={leaseCost}
            onChange={setLeaseCost}
            placeholder="50000"
            type="number"
            required
          />
        ) : (
          <Field
            label="Purchase price"
            value={purchasePrice}
            onChange={setPurchasePrice}
            placeholder="80000000"
            type="number"
            required
          />
        )}
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
        {submitting ? "Adding..." : "Add aircraft"}
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
