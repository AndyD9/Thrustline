import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useCompany } from "@/contexts/CompanyContext";
import { Select } from "@/components/Select";
import { Users, Plus, X, Shield, RefreshCw, Bed, Zap, UserPlus, Briefcase } from "lucide-react";
import type { Aircraft, CrewMember, CrewRank, CrewStatus } from "@/lib/database.types";
import { generateCandidates, type CrewCandidate } from "@/lib/crewGen";

const statusConfig: Record<CrewStatus, { bg: string; text: string; dot: string }> = {
  available: { bg: "bg-emerald-500/10 border-emerald-500/20", text: "text-emerald-300", dot: "bg-emerald-400" },
  flying:    { bg: "bg-brand-500/10 border-brand-500/20",     text: "text-brand-300",   dot: "bg-brand-400" },
  resting:   { bg: "bg-yellow-500/10 border-yellow-500/20",   text: "text-yellow-300",  dot: "bg-yellow-400" },
};

const rankLabels: Record<CrewRank, string> = {
  captain: "CPT",
  first_officer: "FO",
  cabin_crew: "CC",
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
    await supabase.from("crew_members").update({ aircraft_id: aircraftId }).eq("id", crewId);
    await fetchCrew();
  };

  const updateStatus = async (crewId: string, status: CrewStatus) => {
    await supabase.from("crew_members").update({ status }).eq("id", crewId);
    await fetchCrew();
  };

  if (!company) return null;

  const monthlyPayroll = crew.reduce((sum, c) => sum + c.salary_mo, 0);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Crew</h1>
          <p className="text-sm text-slate-400">
            {crew.length} member{crew.length !== 1 ? "s" : ""} · Monthly payroll{" "}
            <span className="font-mono text-slate-200">{currency(monthlyPayroll)}</span>
          </p>
        </div>
        <button
          onClick={() => setShowForm((s) => !s)}
          className="flex items-center gap-2 rounded-xl bg-brand-500 px-4 py-2.5 text-sm font-semibold text-white transition-all hover:bg-brand-400 hover:shadow-[0_0_20px_oklch(0.58_0.18_195_/_0.25)]"
        >
          {showForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          {showForm ? "Cancel" : "Hire crew"}
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
        <div className="flex flex-col items-center justify-center rounded-xl border border-white/[0.06] bg-white/[0.02] py-16 text-center">
          <Users className="mb-3 h-8 w-8 text-slate-600" />
          <div className="text-sm text-slate-400">No crew hired yet. Hire captains and first officers to staff your flights.</div>
        </div>
      ) : (
        <div className="space-y-2">
          {crew.map((c) => {
            const cfg = statusConfig[c.status];
            const dutyPct = c.max_duty_h > 0 ? (c.duty_hours / c.max_duty_h) * 100 : 0;
            return (
              <div
                key={c.id}
                className="flex items-center justify-between rounded-xl border border-white/[0.04] bg-white/[0.02] px-5 py-4 transition-all hover:bg-white/[0.03]"
              >
                {/* Left: name + rank + status */}
                <div className="flex items-center gap-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/[0.04] text-sm font-bold text-slate-300">
                    {c.first_name[0]}{c.last_name[0]}
                  </div>
                  <div>
                    <div className="font-semibold text-white">{c.first_name} {c.last_name}</div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="flex items-center gap-1 rounded bg-white/[0.05] px-1.5 py-0.5 text-[10px] font-bold tracking-wider text-slate-300">
                        <Shield className="h-3 w-3" />{rankLabels[c.rank]}
                      </span>
                      <span className={`flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${cfg.bg} ${cfg.text}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
                        {c.status}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Middle: stats */}
                <div className="flex items-center gap-6">
                  {/* Aircraft assignment */}
                  <Select
                    value={c.aircraft_id ?? ""}
                    onChange={(v) => void assignAircraft(c.id, v || null)}
                    placeholder="Unassigned"
                    options={[
                      { value: "", label: "Unassigned" },
                      ...aircraft.map((ac) => ({ value: ac.id, label: ac.name })),
                    ]}
                  />

                  <div className="text-center">
                    <div className="text-[10px] uppercase tracking-wider text-slate-500">XP</div>
                    <div className="font-mono text-sm text-white">{c.experience}</div>
                  </div>

                  {/* Duty hours with mini bar */}
                  <div className="w-24">
                    <div className="flex items-center justify-between text-[10px] uppercase tracking-wider text-slate-500">
                      <span>Duty</span>
                      <span className="text-slate-300">{c.duty_hours}/{c.max_duty_h}h</span>
                    </div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/[0.04]">
                      <div
                        className={`h-full rounded-full transition-all ${dutyPct > 80 ? "bg-red-400" : dutyPct > 50 ? "bg-yellow-400" : "bg-emerald-400"}`}
                        style={{ width: `${dutyPct}%` }}
                      />
                    </div>
                  </div>

                  <div className="text-center">
                    <div className="text-[10px] uppercase tracking-wider text-slate-500">Salary</div>
                    <div className="font-mono text-sm text-white">{currency(c.salary_mo)}</div>
                  </div>
                </div>

                {/* Right: actions */}
                <div>
                  {c.status === "available" && (
                    <button
                      onClick={() => void updateStatus(c.id, "resting")}
                      className="flex items-center gap-1.5 rounded-lg border border-white/[0.08] px-2.5 py-1.5 text-[11px] text-slate-400 transition-all hover:border-yellow-500/30 hover:text-yellow-300"
                    >
                      <Bed className="h-3.5 w-3.5" /> Rest
                    </button>
                  )}
                  {c.status === "resting" && (
                    <button
                      onClick={() => void updateStatus(c.id, "available")}
                      className="flex items-center gap-1.5 rounded-lg border border-white/[0.08] px-2.5 py-1.5 text-[11px] text-slate-400 transition-all hover:border-emerald-500/30 hover:text-emerald-300"
                    >
                      <Zap className="h-3.5 w-3.5" /> Activate
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ---------- Hire Crew Form — Candidate-based ---------- */

function HireCrewForm({
  companyId,
  userId,
  onDone,
}: {
  companyId: string;
  userId: string;
  onDone: () => void;
}) {
  const [rank, setRank] = useState<CrewRank>("captain");
  const [candidates, setCandidates] = useState<CrewCandidate[]>(() => generateCandidates("captain"));
  const [hiring, setHiring] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refreshCandidates = (r: CrewRank) => {
    setRank(r);
    setCandidates(generateCandidates(r));
  };

  const hire = async (c: CrewCandidate) => {
    const key = `${c.firstName}-${c.lastName}`;
    setHiring(key);
    setError(null);
    try {
      const { error: insertError } = await supabase.from("crew_members").insert({
        user_id: userId,
        company_id: companyId,
        first_name: c.firstName,
        last_name: c.lastName,
        rank: c.rank,
        experience: c.experience,
        salary_mo: c.salaryMo,
        duty_hours: 0,
        max_duty_h: 80,
        status: "available" as CrewStatus,
      });
      if (insertError) throw insertError;
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to hire");
    } finally {
      setHiring(null);
    }
  };

  return (
    <div className="rounded-xl border border-brand-500/20 bg-brand-500/[0.03] p-5 space-y-4 animate-slide-up">
      <div className="flex items-center justify-between">
        <h2 className="text-[10px] uppercase tracking-[0.15em] text-slate-500">Find candidates</h2>
        <div className="flex items-center gap-2">
          {/* Rank toggle */}
          {(["captain", "first_officer", "cabin_crew"] as CrewRank[]).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => refreshCandidates(r)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                rank === r
                  ? "bg-brand-500/15 text-brand-300"
                  : "text-slate-500 hover:text-slate-300"
              }`}
            >
              {r === "captain" ? "Captain" : r === "first_officer" ? "First Officer" : "Cabin Crew"}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setCandidates(generateCandidates(rank))}
            className="flex items-center gap-1.5 text-[11px] text-slate-500 hover:text-brand-300 transition-colors ml-2"
          >
            <RefreshCw className="h-3 w-3" /> Refresh
          </button>
        </div>
      </div>

      {/* Candidate cards */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {candidates.map((c) => {
          const key = `${c.firstName}-${c.lastName}`;
          return (
            <div
              key={key}
              className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3 transition-all hover:bg-white/[0.04]"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/[0.04] text-sm font-bold text-slate-300">
                  {c.firstName[0]}{c.lastName[0]}
                </div>
                <div>
                  <div className="font-semibold text-white">{c.firstName} {c.lastName}</div>
                  <div className="flex items-center gap-3 mt-0.5 text-[11px] text-slate-500">
                    <span className="flex items-center gap-1">
                      <Shield className="h-3 w-3" />
                      {c.rank === "captain" ? "CPT" : "FO"}
                    </span>
                    <span className="flex items-center gap-1">
                      <Briefcase className="h-3 w-3" />
                      {c.experience} yr{c.experience !== 1 ? "s" : ""}
                    </span>
                    <span className="flex items-center gap-1 font-mono text-slate-300">
                      ${c.salaryMo.toLocaleString()}/mo
                    </span>
                  </div>
                </div>
              </div>
              <button
                onClick={() => void hire(c)}
                disabled={hiring === key}
                className="flex items-center gap-1.5 rounded-xl bg-brand-500 px-3 py-2 text-xs font-semibold text-white transition-all hover:bg-brand-400 disabled:opacity-50"
              >
                <UserPlus className="h-3.5 w-3.5" />
                {hiring === key ? "..." : "Hire"}
              </button>
            </div>
          );
        })}
      </div>

      {error && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/[0.06] px-4 py-2.5 text-xs text-red-300">{error}</div>
      )}
    </div>
  );
}

