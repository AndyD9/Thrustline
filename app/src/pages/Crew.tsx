import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useCompany } from "@/contexts/CompanyContext";
import { Select } from "@/components/Select";
import { Users, Plus, X, Shield, RefreshCw, Bed, Zap, UserPlus, Briefcase, Search } from "lucide-react";
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
  const [search, setSearch] = useState("");
  const [rankFilter, setRankFilter] = useState<CrewRank | "all">("all");
  const [aircraftFilter, setAircraftFilter] = useState("all");

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
      .is("disposed_at", null)
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
  const normalizedSearch = search.trim().toLowerCase();
  const filteredCrew = crew.filter((member) => {
    const matchesSearch = !normalizedSearch || `${member.first_name} ${member.last_name}`.toLowerCase().includes(normalizedSearch);
    const matchesRank = rankFilter === "all" || member.rank === rankFilter;
    const matchesAircraft = aircraftFilter === "all"
      || (aircraftFilter === "unassigned" ? !member.aircraft_id : member.aircraft_id === aircraftFilter);
    return matchesSearch && matchesRank && matchesAircraft;
  });

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
          aircraft={aircraft}
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
          <div className="text-sm text-slate-400">No crew hired yet. Hire pilots and cabin crew to staff your flights.</div>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="grid gap-2 rounded-xl border border-white/[0.05] bg-white/[0.02] p-3 md:grid-cols-[minmax(220px,1fr)_180px_240px]">
            <label className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search crew..."
                className="w-full rounded-xl border border-white/[0.08] bg-white/[0.03] py-2.5 pl-9 pr-3 text-sm text-slate-100 outline-none placeholder:text-slate-600 focus:border-brand-400/50"
              />
            </label>
            <Select
              value={rankFilter}
              onChange={(value) => setRankFilter(value as CrewRank | "all")}
              options={[
                { value: "all", label: "All roles" },
                { value: "captain", label: "Captains" },
                { value: "first_officer", label: "First Officers" },
                { value: "cabin_crew", label: "Cabin Crew" },
              ]}
            />
            <Select
              value={aircraftFilter}
              onChange={setAircraftFilter}
              options={[
                { value: "all", label: "All aircraft" },
                { value: "unassigned", label: "Unassigned" },
                ...aircraft.map((item) => ({ value: item.id, label: item.name })),
              ]}
            />
          </div>
          <div className="text-xs text-slate-500">Showing {filteredCrew.length} of {crew.length} members</div>
          {filteredCrew.map((c) => {
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
          {filteredCrew.length === 0 && (
            <div className="rounded-xl border border-dashed border-white/[0.08] py-10 text-center text-sm text-slate-500">
              No crew matches these filters.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ---------- Hire Crew Form — Candidate-based ---------- */

function HireCrewForm({
  companyId,
  userId,
  aircraft,
  onDone,
}: {
  companyId: string;
  userId: string;
  aircraft: Aircraft[];
  onDone: () => void;
}) {
  const [rank, setRank] = useState<CrewRank>("captain");
  const [candidateCount, setCandidateCount] = useState(4);
  const [candidates, setCandidates] = useState<CrewCandidate[]>(() => generateCandidates("captain", 4));
  const [selected, setSelected] = useState<Set<number>>(() => new Set([0, 1, 2, 3]));
  const [aircraftId, setAircraftId] = useState("");
  const [hiring, setHiring] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshCandidates = (r: CrewRank, count = candidateCount) => {
    setRank(r);
    setCandidateCount(count);
    setCandidates(generateCandidates(r, count));
    setSelected(new Set(Array.from({ length: count }, (_, index) => index)));
  };

  const hireSelected = async () => {
    const hires = candidates.filter((_, index) => selected.has(index));
    if (hires.length === 0) return;
    setHiring(true);
    setError(null);
    try {
      const { error: insertError } = await supabase.from("crew_members").insert(hires.map((candidate) => ({
        user_id: userId,
        company_id: companyId,
        aircraft_id: aircraftId || null,
        first_name: candidate.firstName,
        last_name: candidate.lastName,
        rank: candidate.rank,
        experience: candidate.experience,
        salary_mo: candidate.salaryMo,
        duty_hours: 0,
        max_duty_h: 80,
        status: "available" as CrewStatus,
      })));
      if (insertError) throw insertError;
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to hire");
    } finally {
      setHiring(false);
    }
  };

  const selectedCandidates = candidates.filter((_, index) => selected.has(index));
  const selectedPayroll = selectedCandidates.reduce((total, candidate) => total + candidate.salaryMo, 0);

  return (
    <div className="rounded-xl border border-brand-500/20 bg-brand-500/[0.03] p-5 space-y-4 animate-slide-up">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <h2 className="text-sm font-semibold text-white">Recruit crew</h2>
          <p className="mt-0.5 text-xs text-slate-500">Build and hire a complete candidate batch in one operation.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
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
          <div className="mx-1 hidden h-5 w-px bg-white/[0.08] sm:block" />
          {[4, 10, 20].map((count) => (
            <button key={count} type="button" onClick={() => refreshCandidates(rank, count)} className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-all ${candidateCount === count ? "bg-white/[0.08] text-white" : "text-slate-500 hover:text-slate-300"}`}>
              {count}
            </button>
          ))}
          <button
            type="button"
            onClick={() => refreshCandidates(rank)}
            className="flex items-center gap-1.5 text-[11px] text-slate-500 hover:text-brand-300 transition-colors ml-2"
          >
            <RefreshCw className="h-3 w-3" /> Refresh
          </button>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-[minmax(220px,320px)_1fr] md:items-end">
        <div>
          <div className="mb-1.5 text-[10px] uppercase tracking-wider text-slate-500">Assign new hires</div>
          <Select value={aircraftId} onChange={setAircraftId} options={[{ value: "", label: "Leave unassigned" }, ...aircraft.map((item) => ({ value: item.id, label: item.name }))]} />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/[0.06] bg-black/10 px-4 py-3">
          <button type="button" onClick={() => setSelected(selected.size === candidates.length ? new Set() : new Set(candidates.map((_, index) => index)))} className="text-xs font-semibold text-brand-300 hover:text-brand-200">
            {selected.size === candidates.length ? "Clear selection" : "Select all"}
          </button>
          <div className="text-right text-xs text-slate-400"><span className="font-semibold text-white">{selected.size}</span> selected · <span className="font-mono text-slate-200">{currency(selectedPayroll)}/mo</span></div>
        </div>
      </div>

      {/* Candidate cards */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {candidates.map((c, index) => {
          const key = `${c.firstName}-${c.lastName}-${index}`;
          const isSelected = selected.has(index);
          return (
            <button
              type="button"
              key={key}
              onClick={() => setSelected((current) => { const next = new Set(current); if (next.has(index)) next.delete(index); else next.add(index); return next; })}
              className={`flex items-center justify-between rounded-xl border px-4 py-3 text-left transition-all ${isSelected ? "border-brand-400/30 bg-brand-500/[0.08]" : "border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04]"}`}
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
                      {rankLabels[c.rank]}
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
              <span className={`flex h-5 w-5 items-center justify-center rounded border ${isSelected ? "border-brand-400 bg-brand-500 text-white" : "border-white/15"}`}>{isSelected ? "✓" : ""}</span>
            </button>
          );
        })}
      </div>

      <div className="flex justify-end border-t border-white/[0.06] pt-4">
        <button type="button" onClick={() => void hireSelected()} disabled={hiring || selected.size === 0} className="flex items-center gap-2 rounded-xl bg-brand-500 px-4 py-2.5 text-sm font-semibold text-white transition-all hover:bg-brand-400 disabled:cursor-not-allowed disabled:opacity-40">
          <UserPlus className="h-4 w-4" />
          {hiring ? "Hiring..." : `Hire ${selected.size} crew member${selected.size === 1 ? "" : "s"}`}
        </button>
      </div>

      {error && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/[0.06] px-4 py-2.5 text-xs text-red-300">{error}</div>
      )}
    </div>
  );
}

