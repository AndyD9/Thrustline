import { useEffect, useState, type FormEvent } from "react";
import { supabase } from "@/lib/supabase";
import { useCompany } from "@/contexts/CompanyContext";
import type { Aircraft, CrewMember, CrewRank, CrewStatus } from "@/lib/database.types";

const FIRST_NAMES = [
  "James", "Sarah", "Michael", "Emma", "Robert", "Olivia", "William", "Sophia",
  "David", "Isabella", "Thomas", "Mia", "Daniel", "Charlotte", "Matthew", "Amelia",
  "Carlos", "Yuki", "Ahmed", "Priya", "Luca", "Fatima", "Sven", "Aiko",
];
const LAST_NAMES = [
  "Anderson", "Mitchell", "Roberts", "Thompson", "Wilson", "Chen", "Kumar", "Müller",
  "Tanaka", "Garcia", "Rossi", "Dubois", "Kim", "Johansson", "Okafor", "Petrov",
];

const randomName = () => {
  const first = FIRST_NAMES[Math.floor(Math.random() * FIRST_NAMES.length)];
  const last = LAST_NAMES[Math.floor(Math.random() * LAST_NAMES.length)];
  return { first, last };
};

const statusColors: Record<CrewStatus, string> = {
  available: "bg-emerald-500/20 text-emerald-300",
  flying: "bg-brand-500/20 text-brand-300",
  resting: "bg-yellow-500/20 text-yellow-300",
};

const rankLabels: Record<CrewRank, string> = {
  captain: "CPT",
  first_officer: "FO",
};

const currency = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

export default function Crew() {
  const { company } = useCompany();
  const [crew, setCrew] = useState<CrewMember[]>([]);
  const [aircraft, setAircraft] = useState<Aircraft[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  const fetchCrew = async () => {
    if (!company) return;
    setLoading(true);
    const { data } = await supabase
      .from("crew_members")
      .select("*")
      .eq("company_id", company.id)
      .order("rank")
      .order("last_name");
    setCrew((data as CrewMember[]) ?? []);
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
    void fetchCrew();
    void fetchAircraft();
  }, [company?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const assignAircraft = async (crewId: string, aircraftId: string | null) => {
    await supabase
      .from("crew_members")
      .update({ aircraft_id: aircraftId })
      .eq("id", crewId);
    await fetchCrew();
  };

  const updateStatus = async (crewId: string, status: CrewStatus) => {
    await supabase.from("crew_members").update({ status }).eq("id", crewId);
    await fetchCrew();
  };

  if (!company) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Crew</h1>
          <p className="text-sm text-slate-400">
            {crew.length} member{crew.length !== 1 ? "s" : ""} &middot; Monthly payroll{" "}
            <span className="text-slate-200">
              {currency(crew.reduce((sum, c) => sum + c.salary_mo, 0))}
            </span>
          </p>
        </div>
        <button
          onClick={() => setShowForm((s) => !s)}
          className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-400"
        >
          {showForm ? "Cancel" : "+ Hire crew"}
        </button>
      </div>

      {showForm && (
        <HireCrewForm
          companyId={company.id}
          userId={company.user_id}
          onDone={() => {
            setShowForm(false);
            void fetchCrew();
          }}
        />
      )}

      {loading ? (
        <div className="text-slate-400">Loading...</div>
      ) : crew.length === 0 ? (
        <div className="glass px-5 py-8 text-center text-sm text-slate-400">
          No crew hired yet. Hire captains and first officers to staff your flights.
        </div>
      ) : (
        <div className="glass overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-white/5 text-[10px] uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-4 py-3 text-left">Name</th>
                <th className="px-4 py-3 text-left">Rank</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-left">Aircraft</th>
                <th className="px-4 py-3 text-right">XP</th>
                <th className="px-4 py-3 text-right">Duty h</th>
                <th className="px-4 py-3 text-right">Salary/mo</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {crew.map((c) => (
                <tr key={c.id} className="border-t border-white/5">
                  <td className="px-4 py-3 text-slate-200">
                    {c.first_name} {c.last_name}
                  </td>
                  <td className="px-4 py-3">
                    <span className="rounded bg-white/5 px-1.5 py-0.5 text-[10px] font-semibold tracking-wider text-slate-300">
                      {rankLabels[c.rank]}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${statusColors[c.status]}`}
                    >
                      {c.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={c.aircraft_id ?? ""}
                      onChange={(e) =>
                        void assignAircraft(c.id, e.target.value || null)
                      }
                      className="rounded border border-white/10 bg-white/5 px-2 py-1 text-xs text-slate-200 outline-none focus:border-brand-400"
                    >
                      <option value="">Unassigned</option>
                      {aircraft.map((ac) => (
                        <option key={ac.id} value={ac.id}>
                          {ac.name}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-slate-300">
                    {c.experience}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="font-mono text-slate-300">{c.duty_hours}</span>
                    <span className="text-slate-600">/{c.max_duty_h}</span>
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-slate-300">
                    {currency(c.salary_mo)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {c.status === "available" && (
                      <button
                        onClick={() => void updateStatus(c.id, "resting")}
                        className="text-[11px] text-slate-500 hover:text-yellow-300"
                      >
                        Rest
                      </button>
                    )}
                    {c.status === "resting" && (
                      <button
                        onClick={() => void updateStatus(c.id, "available")}
                        className="text-[11px] text-slate-500 hover:text-emerald-300"
                      >
                        Activate
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ---------- Hire Crew Form ---------- */

function HireCrewForm({
  companyId,
  userId,
  onDone,
}: {
  companyId: string;
  userId: string;
  onDone: () => void;
}) {
  const generated = randomName();
  const [firstName, setFirstName] = useState(generated.first);
  const [lastName, setLastName] = useState(generated.last);
  const [rank, setRank] = useState<CrewRank>("captain");
  const [salary, setSalary] = useState("8000");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const reroll = () => {
    const n = randomName();
    setFirstName(n.first);
    setLastName(n.last);
  };

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const { error: insertError } = await supabase.from("crew_members").insert({
        user_id: userId,
        company_id: companyId,
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        rank,
        experience: 0,
        salary_mo: Number(salary),
        duty_hours: 0,
        max_duty_h: 80,
        status: "available" as CrewStatus,
      });
      if (insertError) throw insertError;
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to hire crew member");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="glass space-y-4 px-5 py-4">
      <div className="flex items-center justify-between">
        <h2 className="text-[10px] uppercase tracking-wider text-slate-500">Hire crew member</h2>
        <button
          type="button"
          onClick={reroll}
          className="text-[11px] text-slate-500 hover:text-brand-300"
        >
          Reroll name
        </button>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <Field label="First name" value={firstName} onChange={setFirstName} required />
        <Field label="Last name" value={lastName} onChange={setLastName} required />
        <label className="block">
          <span className="mb-1 block text-[10px] uppercase tracking-wider text-slate-400">
            Rank
          </span>
          <select
            value={rank}
            onChange={(e) => setRank(e.target.value as CrewRank)}
            className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-100 outline-none focus:border-brand-400"
          >
            <option value="captain">Captain</option>
            <option value="first_officer">First Officer</option>
          </select>
        </label>
        <Field label="Salary / mo" value={salary} onChange={setSalary} type="number" required />
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
        {submitting ? "Hiring..." : "Hire"}
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
