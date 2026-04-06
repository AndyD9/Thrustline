import { useSim } from "@/contexts/SimContext";
import { useUnits } from "@/contexts/UnitsContext";
import { Gauge, Navigation, Compass, Fuel, ArrowUpDown, Plane } from "lucide-react";
import type { LucideIcon } from "lucide-react";

/**
 * Bandeau persistant affichant les SimVars en temps réel quand un vol est en cours.
 * Ne rend rien si pas de données.
 */
export function LiveFlightBar() {
  const { latest, simActive } = useSim();
  const { fmt } = useUnits();
  if (!latest || !simActive) return null;

  const {
    altitudeFt,
    groundSpeedKts,
    indicatedAirspeedKts,
    headingDeg,
    verticalSpeedFpm,
    fuelTotalGal,
    onGround,
  } = latest;

  return (
    <div className="mx-3 mb-3 flex flex-wrap items-center gap-5 rounded-xl border border-brand-500/20 bg-brand-500/[0.04] px-5 py-3 text-xs glow-brand-sm animate-fade-in">
      <Stat label="PHASE" value={onGround ? "GROUND" : "AIRBORNE"} icon={Plane} accent />
      <div className="h-4 w-px bg-white/[0.06]" />
      <Stat label="ALT" value={fmt.altitude(altitudeFt)} icon={ArrowUpDown} />
      <Stat label="GS"  value={fmt.speed(groundSpeedKts)} icon={Gauge} />
      <Stat label="IAS" value={fmt.speed(indicatedAirspeedKts)} icon={Navigation} />
      <Stat label="HDG" value={`${Math.round(headingDeg)}\u00B0`} icon={Compass} />
      <Stat label="V/S" value={fmt.vs(verticalSpeedFpm)} icon={ArrowUpDown} />
      <Stat label="FUEL" value={fmt.fuel(fuelTotalGal)} icon={Fuel} />
    </div>
  );
}

function Stat({
  label,
  value,
  icon: Icon,
  accent = false,
}: {
  label: string;
  value: string;
  icon: LucideIcon;
  accent?: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      <Icon className={`h-3.5 w-3.5 ${accent ? "text-brand-300" : "text-slate-500"}`} />
      <div className="flex items-baseline gap-1.5">
        <span className="text-[10px] uppercase tracking-wider text-slate-500">
          {label}
        </span>
        <span
          className={`font-mono text-sm font-medium ${accent ? "text-brand-300" : "text-slate-100"}`}
        >
          {value}
        </span>
      </div>
    </div>
  );
}
