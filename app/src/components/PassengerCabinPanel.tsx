import { Activity, Armchair, Gamepad2, HeartPulse, TrendingDown, TrendingUp, Minus, Users } from "lucide-react";
import type { PassengerExperiencePayload } from "@/hooks/useSimStream";

export default function PassengerCabinPanel({ experience }: { experience: PassengerExperiencePayload }) {
  const TrendIcon = experience.trend === "up" ? TrendingUp : experience.trend === "down" ? TrendingDown : Minus;
  const eventTone = experience.currentEvent.includes("Severe") || experience.currentEvent.includes("Hard")
    ? "text-red-400" : experience.currentEvent.includes("turbulence") || experience.currentEvent.includes("Firm")
      ? "text-amber-400" : "text-emerald-400";

  return (
    <div className="rounded-xl border border-white/[0.08] bg-[#0a0f18]/90 p-4 backdrop-blur-md">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.15em] text-slate-500">
          <Users className="h-3.5 w-3.5" /> Cabin
        </div>
        <div className="flex items-center gap-1.5">
          <TrendIcon className={`h-4 w-4 ${experience.trend === "down" ? "text-red-400" : experience.trend === "up" ? "text-emerald-400" : "text-slate-500"}`} />
          <span className="font-mono text-xl font-bold text-white">{Math.round(experience.satisfaction)}%</span>
        </div>
      </div>

      <div className="mb-3 grid grid-cols-2 gap-2">
        <CabinScore label="Economy" count={experience.economy.passengerCount} value={experience.economy.satisfaction} />
        <CabinScore label="Business" count={experience.business.passengerCount} value={experience.business.satisfaction} />
      </div>

      <div className="space-y-2">
        <Meter icon={Armchair} label="Comfort" value={experience.comfort} tone="bg-brand-400" />
        <Meter icon={HeartPulse} label="Stress" value={experience.stress} tone="bg-red-400" inverse />
        <Meter icon={Activity} label="Nausea" value={experience.nausea} tone="bg-amber-400" inverse />
        <Meter icon={Gamepad2} label="Entertainment" value={experience.entertainment} tone="bg-purple-400" />
      </div>

      <div className="mt-3 border-t border-white/[0.06] pt-2.5">
        <div className={`text-xs font-medium ${eventTone}`}>{experience.currentEvent}</div>
        <div className="mt-0.5 text-[10px] text-slate-500">
          {experience.affectedPassengers > 0
            ? `${experience.affectedPassengers} passengers affected`
            : "Cabin conditions are stable"}
        </div>
      </div>
    </div>
  );
}

function CabinScore({ label, count, value }: { label: string; count: number; value: number }) {
  return (
    <div className="rounded-lg bg-white/[0.035] px-2.5 py-2">
      <div className="flex items-center justify-between text-[9px] uppercase tracking-wider text-slate-500">
        <span>{label}</span><span>{count}</span>
      </div>
      <div className="mt-0.5 font-mono text-base font-semibold text-slate-200">{Math.round(value)}%</div>
    </div>
  );
}

function Meter({ icon: Icon, label, value, tone, inverse = false }: {
  icon: typeof Activity; label: string; value: number; tone: string; inverse?: boolean;
}) {
  const display = Math.round(value);
  return (
    <div>
      <div className="mb-1 flex items-center text-[10px] text-slate-500">
        <Icon className="mr-1.5 h-3 w-3" /><span>{label}</span>
        <span className={`ml-auto font-mono ${inverse && display > 45 ? "text-red-400" : "text-slate-300"}`}>{display}</span>
      </div>
      <div className="h-1 overflow-hidden rounded-full bg-white/[0.06]">
        <div className={`h-full rounded-full transition-all duration-500 ${tone}`} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
      </div>
    </div>
  );
}
