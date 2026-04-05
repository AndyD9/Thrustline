import { useSim } from "@/contexts/SimContext";

export function SimStatusBadge() {
  const { connected, simActive } = useSim();

  let color = "bg-slate-500";
  let label = "sim-bridge offline";

  if (connected && simActive) {
    color = "bg-emerald-500";
    label = "Sim connected";
  } else if (connected && !simActive) {
    color = "bg-amber-500";
    label = "Waiting for MSFS";
  }

  return (
    <div className="glass flex items-center gap-2 px-3 py-1.5 text-xs">
      <span className={`h-2 w-2 rounded-full ${color} shadow-[0_0_8px_currentColor]`} />
      <span className="text-slate-300">{label}</span>
    </div>
  );
}
