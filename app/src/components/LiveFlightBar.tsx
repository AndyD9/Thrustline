import { useSim } from "@/contexts/SimContext";

function formatNumber(n: number, digits = 0) {
  return n.toLocaleString(undefined, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

/**
 * Bandeau persistant affichant les SimVars en temps réel quand un vol est en cours.
 * Ne rend rien si pas de données.
 */
export function LiveFlightBar() {
  const { latest, simActive } = useSim();
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
    <div className="glass mx-3 mb-3 flex flex-wrap items-center gap-6 px-5 py-3 text-xs">
      <Stat label="PHASE" value={onGround ? "GROUND" : "AIRBORNE"} accent />
      <Stat label="ALT" value={`${formatNumber(altitudeFt)} ft`} />
      <Stat label="GS"  value={`${formatNumber(groundSpeedKts)} kt`} />
      <Stat label="IAS" value={`${formatNumber(indicatedAirspeedKts)} kt`} />
      <Stat label="HDG" value={`${formatNumber(headingDeg)}°`} />
      <Stat label="V/S" value={`${formatNumber(verticalSpeedFpm)} fpm`} />
      <Stat label="FUEL" value={`${formatNumber(fuelTotalGal)} gal`} />
    </div>
  );
}

function Stat({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="flex items-baseline gap-2">
      <span className="text-[10px] uppercase tracking-wider text-slate-500">
        {label}
      </span>
      <span
        className={`font-mono text-sm ${accent ? "text-brand-300" : "text-slate-100"}`}
      >
        {value}
      </span>
    </div>
  );
}
