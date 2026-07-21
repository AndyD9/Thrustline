import { CheckCircle2, CircleHelp, Plane, TriangleAlert } from "lucide-react";
import type { Dispatch } from "@/lib/database.types";
import type { SimData } from "@/hooks/useSimStream";
import { verifyAircraft, type AircraftMatch } from "@/lib/aircraftVerification";

export default function AircraftVerificationPanel({ dispatch, sim }: { dispatch: Dispatch; sim: SimData | null }) {
  const result = verifyAircraft(dispatch.icao_type, dispatch.ofp_data, sim);
  const overall = result.dispatchVsOfp === "mismatch" || result.simulatorVsPlan === "mismatch"
    ? "mismatch"
    : result.dispatchVsOfp === "match" && result.simulatorVsPlan === "match"
      ? "match"
      : "unknown";

  return (
    <div className={`rounded-xl border bg-[#0a0f18]/90 p-4 backdrop-blur-md ${borderStyle(overall)}`}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.15em] text-slate-400">
          <Plane className="h-3.5 w-3.5 text-brand-400" /> Aircraft check
        </div>
        <StatusIcon status={overall} />
      </div>
      <div className="space-y-2 text-xs">
        <VerificationRow label="Dispatch" value={result.expectedIcao} />
        <VerificationRow label="OFP" value={result.ofpIcao ?? "Not available"} status={result.dispatchVsOfp} />
        <VerificationRow label="Simulator" value={result.simulatorModel ?? "Waiting for MSFS"} status={result.simulatorVsPlan} />
        {sim?.aircraftRegistration && <VerificationRow label="Registration" value={sim.aircraftRegistration} />}
      </div>
      {overall === "mismatch" && (
        <div className="mt-3 rounded-lg bg-amber-500/10 px-2.5 py-2 text-[11px] leading-relaxed text-amber-300">
          The aircraft loaded in MSFS or the OFP does not match the dispatch.
        </div>
      )}
    </div>
  );
}

function VerificationRow({ label, value, status }: { label: string; value: string; status?: AircraftMatch }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="shrink-0 text-slate-500">{label}</span>
      <span className="flex min-w-0 items-center gap-1.5 text-right font-mono text-slate-200">
        <span className="truncate" title={value}>{value}</span>
        {status && <StatusIcon status={status} />}
      </span>
    </div>
  );
}

function StatusIcon({ status }: { status: AircraftMatch }) {
  if (status === "match") return <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-400" />;
  if (status === "mismatch") return <TriangleAlert className="h-3.5 w-3.5 shrink-0 text-amber-400" />;
  return <CircleHelp className="h-3.5 w-3.5 shrink-0 text-slate-500" />;
}

function borderStyle(status: AircraftMatch): string {
  if (status === "match") return "border-emerald-500/20";
  if (status === "mismatch") return "border-amber-500/30";
  return "border-white/[0.08]";
}
