import { useEffect, useState } from "react";
import { getHealth, type HealthResponse } from "@/lib/simBridge";

export default function Settings() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const ctrl = new AbortController();
    getHealth(ctrl.signal)
      .then(setHealth)
      .catch((e) => setError(e instanceof Error ? e.message : "unreachable"));
    return () => ctrl.abort();
  }, []);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Settings</h1>

      <section className="glass space-y-3 px-5 py-4 text-sm">
        <h2 className="text-[10px] uppercase tracking-wider text-slate-500">
          sim-bridge
        </h2>
        {error && <div className="text-red-300">Error: {error}</div>}
        {!health && !error && <div className="text-slate-400">Probing…</div>}
        {health && (
          <dl className="grid grid-cols-2 gap-2 font-mono text-xs">
            <dt className="text-slate-500">Version</dt>
            <dd className="text-slate-200">{health.version}</dd>
            <dt className="text-slate-500">SimConnect</dt>
            <dd className="text-slate-200">{health.simConnect}</dd>
            <dt className="text-slate-500">Supabase configured</dt>
            <dd className="text-slate-200">{String(health.supabaseConfigured)}</dd>
            <dt className="text-slate-500">Session active</dt>
            <dd className="text-slate-200">{String(health.hasSession)}</dd>
          </dl>
        )}
      </section>
    </div>
  );
}
