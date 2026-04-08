import { useEffect, useState } from "react";
import { getHealth, type HealthResponse } from "@/lib/simBridge";
import { supabase } from "@/lib/supabase";
import { useCompany } from "@/contexts/CompanyContext";
import { Settings as SettingsIcon, Server, Wifi, WifiOff, Cloud, Monitor, ExternalLink, Save, Ruler, Trash2, AlertTriangle, X } from "lucide-react";
import { useUnits } from "@/contexts/UnitsContext";
import type { UnitSystem } from "@/lib/units";

export default function Settings() {
  const { company, refetch: refetchCompany } = useCompany();
  const { system: unitSystem, setSystem: setUnitSystem } = useUnits();
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  // SimBrief username
  const [simbriefUsername, setSimbriefUsername] = useState(company?.simbrief_username ?? "");
  const [savingSimbrief, setSavingSimbrief] = useState(false);
  const [simbriefSaved, setSimbriefSaved] = useState(false);

  // Delete company modal
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const handleDeleteCompany = async () => {
    if (!company || deleteConfirm !== company.name) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      const { error: delErr } = await supabase
        .from("companies")
        .delete()
        .eq("id", company.id);
      if (delErr) throw delErr;
      // refetch sets company to null → App.tsx redirects to /onboarding
      await refetchCompany();
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Failed to delete company");
      setDeleting(false);
    }
  };

  useEffect(() => {
    if (company?.simbrief_username) setSimbriefUsername(company.simbrief_username);
  }, [company?.simbrief_username]);

  useEffect(() => {
    const ctrl = new AbortController();
    getHealth(ctrl.signal)
      .then(setHealth)
      .catch((e) => {
        if (ctrl.signal.aborted) return;
        setError(e instanceof Error ? e.message : "unreachable");
      });
    return () => ctrl.abort();
  }, []);

  const saveSimbriefUsername = async () => {
    if (!company) return;
    setSavingSimbrief(true);
    await supabase
      .from("companies")
      .update({ simbrief_username: simbriefUsername.trim() || null })
      .eq("id", company.id);
    await refetchCompany();
    setSavingSimbrief(false);
    setSimbriefSaved(true);
    setTimeout(() => setSimbriefSaved(false), 2000);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/[0.04]">
          <SettingsIcon className="h-5 w-5 text-slate-400" />
        </div>
        <h1 className="text-2xl font-bold text-white">Settings</h1>
      </div>

      {/* Units */}
      <section className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
        <div className="mb-4 flex items-center gap-2">
          <Ruler className="h-4 w-4 text-slate-400" />
          <h2 className="text-[10px] uppercase tracking-[0.15em] text-slate-500">Units</h2>
        </div>
        <div className="flex gap-2">
          {(["imperial", "metric"] as UnitSystem[]).map((s) => (
            <button
              key={s}
              onClick={() => setUnitSystem(s)}
              className={`rounded-xl px-4 py-2.5 text-sm font-semibold transition-all ${
                unitSystem === s
                  ? "bg-brand-500 text-white shadow-[0_0_16px_oklch(0.58_0.18_195_/_0.2)]"
                  : "border border-white/[0.08] text-slate-400 hover:border-white/[0.15] hover:text-white"
              }`}
            >
              {s === "imperial" ? "Imperial (gal, lbs, ft, kt)" : "Metric (kg, m, km/h)"}
            </button>
          ))}
        </div>
      </section>

      {/* SimBrief */}
      <section className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
        <div className="mb-4 flex items-center gap-2">
          <ExternalLink className="h-4 w-4 text-slate-400" />
          <h2 className="text-[10px] uppercase tracking-[0.15em] text-slate-500">SimBrief integration</h2>
        </div>
        <div className="flex items-end gap-3">
          <label className="block flex-1">
            <span className="mb-1.5 block text-[10px] uppercase tracking-[0.15em] text-slate-400">
              SimBrief username
            </span>
            <input
              type="text"
              value={simbriefUsername}
              onChange={(e) => setSimbriefUsername(e.target.value)}
              placeholder="your_simbrief_username"
              className="w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2.5 text-sm text-slate-100 outline-none transition-all placeholder:text-slate-600 focus:border-brand-400/50"
            />
          </label>
          <button
            onClick={() => void saveSimbriefUsername()}
            disabled={savingSimbrief}
            className="flex items-center gap-1.5 rounded-xl bg-brand-500 px-4 py-2.5 text-sm font-semibold text-white transition-all hover:bg-brand-400 disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            {simbriefSaved ? "Saved!" : savingSimbrief ? "Saving..." : "Save"}
          </button>
        </div>
        <p className="mt-2 text-xs text-slate-600">
          Your SimBrief username is used to fetch OFP data. Find it at simbrief.com under your account settings.
        </p>
      </section>

      {/* sim-bridge status */}
      <section className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
        <div className="mb-4 flex items-center gap-2">
          <Server className="h-4 w-4 text-slate-400" />
          <h2 className="text-[10px] uppercase tracking-[0.15em] text-slate-500">sim-bridge</h2>
        </div>

        {error && (
          <div className="rounded-xl border border-red-500/20 bg-red-500/[0.06] px-4 py-3 text-sm text-red-300">
            <WifiOff className="mr-2 inline h-4 w-4" />
            Error: {error}
          </div>
        )}

        {!health && !error && (
          <div className="text-sm text-slate-400">Probing…</div>
        )}

        {health && (
          <div className="grid grid-cols-2 gap-3">
            <StatusRow icon={Monitor} label="Version" value={health.version} />
            <StatusRow
              icon={Wifi}
              label="SimConnect"
              value={health.simConnect}
              highlight={health.simConnect === "native"}
            />
            <StatusRow
              icon={Cloud}
              label="Supabase configured"
              value={String(health.supabaseConfigured)}
              highlight={health.supabaseConfigured}
            />
            <StatusRow
              icon={Server}
              label="Session active"
              value={String(health.hasSession)}
              highlight={health.hasSession}
            />
          </div>
        )}
      </section>

      {/* Danger Zone */}
      <section className="rounded-xl border border-red-500/20 bg-red-500/[0.03] p-5">
        <div className="mb-4 flex items-center gap-2">
          <Trash2 className="h-4 w-4 text-red-400" />
          <h2 className="text-[10px] uppercase tracking-[0.15em] text-red-400">Danger Zone</h2>
        </div>
        <p className="mb-4 text-sm text-slate-400">
          Delete your company and all associated data (flights, aircraft, crew, finances, routes). You will be redirected to create a new company with $1,000,000 starting capital.
        </p>
        <button
          onClick={() => { setShowDeleteModal(true); setDeleteConfirm(""); setDeleteError(null); }}
          className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-sm font-semibold text-red-400 transition-all hover:bg-red-500/20 hover:text-red-300"
        >
          Delete company &amp; start over
        </button>
      </section>

      {/* Delete confirmation modal */}
      {showDeleteModal && company && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-white/[0.08] bg-surface-100 p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2 text-red-400">
                <AlertTriangle className="h-5 w-5" />
                <h3 className="text-lg font-bold">Delete company</h3>
              </div>
              <button
                onClick={() => setShowDeleteModal(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-white/[0.06] hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <p className="mb-4 text-sm text-slate-400">
              This will permanently delete <strong className="text-white">{company.name}</strong> and all associated data. This action cannot be undone.
            </p>

            <label className="mb-4 block">
              <span className="mb-1.5 block text-[10px] uppercase tracking-[0.15em] text-slate-400">
                Type <strong className="text-red-400">{company.name}</strong> to confirm
              </span>
              <input
                type="text"
                value={deleteConfirm}
                onChange={(e) => setDeleteConfirm(e.target.value)}
                placeholder={company.name}
                className="w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2.5 text-sm text-slate-100 outline-none transition-all placeholder:text-slate-600 focus:border-red-400/50"
                autoFocus
              />
            </label>

            {deleteError && (
              <div className="mb-4 rounded-xl border border-red-500/20 bg-red-500/[0.06] px-4 py-2.5 text-xs text-red-300">
                {deleteError}
              </div>
            )}

            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="rounded-xl border border-white/[0.08] px-4 py-2.5 text-sm text-slate-400 transition-all hover:border-white/[0.15] hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={() => void handleDeleteCompany()}
                disabled={deleteConfirm !== company.name || deleting}
                className="rounded-xl bg-red-500 px-4 py-2.5 text-sm font-semibold text-white transition-all hover:bg-red-400 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                {deleting ? "Deleting..." : "Delete everything"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatusRow({
  icon: Icon,
  label,
  value,
  highlight,
}: {
  icon: typeof Monitor;
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg bg-white/[0.02] px-4 py-3">
      <Icon className={`h-4 w-4 ${highlight ? "text-emerald-400" : "text-slate-500"}`} />
      <div>
        <div className="text-[10px] uppercase tracking-wider text-slate-500">{label}</div>
        <div className={`font-mono text-sm ${highlight ? "text-emerald-400" : "text-slate-200"}`}>{value}</div>
      </div>
    </div>
  );
}
