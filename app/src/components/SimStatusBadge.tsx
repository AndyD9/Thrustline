import { useSim } from "@/contexts/SimContext";
import { Wifi, WifiOff, MonitorSmartphone } from "lucide-react";

export function SimStatusBadge() {
  const { connected, simActive } = useSim();

  let color = "bg-slate-500";
  let glowColor = "shadow-none";
  let label = "sim-bridge offline";
  let Icon = WifiOff;

  if (connected && simActive) {
    color = "bg-emerald-400";
    glowColor = "shadow-[0_0_10px_rgba(52,211,153,0.4)]";
    label = "Sim connected";
    Icon = Wifi;
  } else if (connected && !simActive) {
    color = "bg-amber-400";
    glowColor = "shadow-[0_0_10px_rgba(251,191,36,0.3)]";
    label = "Waiting for MSFS";
    Icon = MonitorSmartphone;
  }

  return (
    <div className="flex items-center gap-2.5 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3.5 py-2 text-xs backdrop-blur-sm">
      <span className={`h-2 w-2 rounded-full ${color} ${glowColor}`} />
      <Icon className="h-3.5 w-3.5 text-slate-400" />
      <span className="text-slate-300">{label}</span>
    </div>
  );
}
