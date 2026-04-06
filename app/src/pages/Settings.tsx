import { useEffect, useState } from "react";
import { getHealth, type HealthResponse } from "@/lib/simBridge";
import { Settings as SettingsIcon, Server, Wifi, WifiOff, Cloud, Monitor } from "lucide-react";

export default function Settings() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

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

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/[0.04]">
          <SettingsIcon className="h-5 w-5 text-slate-400" />
        </div>
        <h1 className="text-2xl font-bold text-white">Settings</h1>
      </div>

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
              highlight={health.simConnect === "connected"}
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
