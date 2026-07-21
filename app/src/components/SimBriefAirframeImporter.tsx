import { useEffect, useState } from "react";
import { Check, Link, Loader2, Plane, Trash2 } from "lucide-react";
import {
  decodeSimBriefShareLink,
  loadImportedAirframes,
  removeImportedAirframe,
  removeSyncedAirframe,
  saveImportedAirframe,
  syncImportedAirframe,
  type ImportedAirframe,
} from "@/lib/simbriefAirframes";

const money = (value: number) => value.toLocaleString("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

export function SimBriefAirframeImporter({ companyId }: { companyId: string }) {
  const [shareLink, setShareLink] = useState("");
  const [preview, setPreview] = useState<ImportedAirframe | null>(null);
  const [profiles, setProfiles] = useState(loadImportedAirframes);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    void Promise.all(loadImportedAirframes().map((profile) => syncImportedAirframe(companyId, profile)))
      .catch((syncError) => setError(syncError instanceof Error ? syncError.message : "Could not sync the aircraft market."));
  }, [companyId]);

  const decode = () => {
    setError(null);
    setSaved(false);
    try {
      setPreview(decodeSimBriefShareLink(shareLink));
    } catch (decodeError) {
      setPreview(null);
      setError(decodeError instanceof Error ? decodeError.message : "Could not decode this link.");
    }
  };

  const save = async () => {
    if (!preview) return;
    setSyncing(true); setError(null);
    try {
      await syncImportedAirframe(companyId, preview);
      saveImportedAirframe(preview);
      setProfiles(loadImportedAirframes()); setSaved(true); setShareLink(""); setPreview(null);
    } catch (syncError) {
      setError(syncError instanceof Error ? syncError.message : "Could not add this profile to the market.");
    } finally { setSyncing(false); }
  };

  const remove = async (icaoType: string) => {
    setSyncing(true); setError(null);
    try {
      await removeSyncedAirframe(companyId, icaoType);
      removeImportedAirframe(icaoType);
      setProfiles(loadImportedAirframes());
    } catch (syncError) {
      setError(syncError instanceof Error ? syncError.message : "Could not remove this profile from the market.");
    } finally { setSyncing(false); }
  };

  return (
    <section className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
      <div className="mb-2 flex items-center gap-2">
        <Plane className="h-4 w-4 text-slate-400" />
        <h2 className="text-[10px] uppercase tracking-[0.15em] text-slate-500">SimBrief airframe catalog</h2>
      </div>
      <p className="mb-4 text-xs leading-5 text-slate-500">
        Paste an airframe share link. Thrustline estimates its economics and creates private new and pre-owned offers in your aircraft market. No aircraft is added to the fleet until you buy or lease it.
      </p>

      <div className="flex items-end gap-3">
        <label className="block flex-1">
          <span className="mb-1.5 block text-[10px] uppercase tracking-[0.15em] text-slate-400">Airframe share link</span>
          <input
            type="url"
            value={shareLink}
            onChange={(event) => { setShareLink(event.target.value); setSaved(false); }}
            placeholder="https://dispatch.simbrief.com/airframes/share/..."
            className="w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2.5 text-sm text-slate-100 outline-none transition-all placeholder:text-slate-600 focus:border-brand-400/50"
          />
        </label>
        <button
          type="button"
          onClick={decode}
          disabled={!shareLink.trim()}
          className="flex items-center gap-1.5 rounded-xl bg-brand-500 px-4 py-2.5 text-sm font-semibold text-white transition-all hover:bg-brand-400 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Link className="h-4 w-4" /> Decode
        </button>
      </div>

      {error && <div className="mt-3 rounded-xl border border-red-500/20 bg-red-500/[0.06] px-4 py-2.5 text-xs text-red-300">{error}</div>}
      {saved && <div className="mt-3 flex items-center gap-2 text-xs text-emerald-400"><Check className="h-4 w-4" /> Airframe added to the Thrustline catalog.</div>}

      {preview && (
        <div className="mt-4 rounded-xl border border-brand-500/20 bg-brand-500/[0.04] p-4">
          <div className="mb-3 flex items-start justify-between gap-4">
            <div>
              <div className="font-semibold text-white">{preview.manufacturer} {preview.name}</div>
              <div className="mt-0.5 font-mono text-xs text-brand-300">{preview.icaoType} · {preview.engines || "Engine not specified"}</div>
            </div>
            <button type="button" onClick={() => void save()} disabled={syncing} className="flex items-center gap-1.5 rounded-xl bg-emerald-500 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-400 disabled:opacity-50">
              {syncing && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Add to market
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Stat label="Max passengers" value={preview.maxPaxEco.toLocaleString()} />
            <Stat label="MTOW" value={`${preview.maxTakeoffKg.toLocaleString()} kg`} />
            <Stat label="Max fuel" value={`${preview.maxFuelKg.toLocaleString()} kg`} />
            <Stat label="Range" value={preview.rangeNm ? `${preview.rangeNm.toLocaleString()} nm` : "To review"} />
            <Stat label="Market value" value={money(preview.purchasePrice)} accent />
            <Stat label="Lease / month" value={money(preview.leaseCostMo)} accent />
            <Stat label="Maint. / flight hour" value={money(preview.maintenancePerHour)} />
            <Stat label="Fixed maint. / month" value={money(preview.maintenanceFixedMo)} />
          </div>
          <p className="mt-3 text-[11px] leading-4 text-slate-600">
            Economic values are deterministic gameplay estimates based on MTOW, aircraft generation, and engine count; they can be refined in future balancing updates.
          </p>
        </div>
      )}

      {profiles.length > 0 && (
        <div className="mt-5 space-y-2">
          <div className="text-[10px] uppercase tracking-[0.15em] text-slate-500">Imported profiles ({profiles.length})</div>
          {profiles.map((profile) => (
            <div key={profile.icaoType} className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3">
              <span className="w-12 font-mono text-sm font-bold text-brand-400">{profile.icaoType}</span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm text-slate-200">{profile.manufacturer} {profile.name}</div>
                <div className="text-[11px] text-slate-600">{profile.maxPaxEco} pax · {money(profile.purchasePrice)} · {money(profile.leaseCostMo)}/mo</div>
              </div>
              <button
                type="button"
                onClick={() => void remove(profile.icaoType)}
                disabled={syncing}
                aria-label={`Remove ${profile.icaoType}`}
                className="rounded-lg p-2 text-slate-500 transition-colors hover:bg-red-500/10 hover:text-red-400"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function Stat({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-lg bg-white/[0.03] px-3 py-2">
      <div className="text-[9px] uppercase tracking-wider text-slate-600">{label}</div>
      <div className={`mt-0.5 font-mono text-xs font-semibold ${accent ? "text-emerald-400" : "text-slate-200"}`}>{value}</div>
    </div>
  );
}
