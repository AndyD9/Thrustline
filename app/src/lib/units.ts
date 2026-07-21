// Unit conversion and formatting system

export type UnitSystem = "imperial" | "metric";

// Conversion factors
const GAL_TO_KG = 3.03907; // Jet-A ~6.7 lbs/gal ≈ 3.04 kg/gal
const LBS_TO_KG = 0.453592;
const FT_TO_M = 0.3048;
const NM_TO_KM = 1.852;
const KTS_TO_KMH = 1.852;
const FPM_TO_MS = 0.00508;

export interface UnitFormatters {
  fuel(gal: number): string;
  fuelUnit: string;
  weight(lbs: number): string;
  weightUnit: string;
  altitude(ft: number): string;
  altUnit: string;
  distance(nm: number): string;
  distUnit: string;
  speed(kts: number): string;
  speedUnit: string;
  vs(fpm: number): string;
  vsUnit: string;
}

function fmt(n: number, decimals = 0): string {
  return n.toLocaleString("en-US", { maximumFractionDigits: decimals });
}

export const imperialFormatters: UnitFormatters = {
  fuel: (gal) => `${fmt(gal)} gal`,
  fuelUnit: "gal",
  weight: (lbs) => `${fmt(lbs)} lbs`,
  weightUnit: "lbs",
  altitude: (ft) => `${fmt(ft)} ft`,
  altUnit: "ft",
  distance: (nm) => `${fmt(nm)} nm`,
  distUnit: "nm",
  speed: (kts) => `${fmt(kts)} kt`,
  speedUnit: "kt",
  vs: (fpm) => `${fmt(fpm)} fpm`,
  vsUnit: "fpm",
};

export const metricFormatters: UnitFormatters = {
  fuel: (gal) => `${fmt(gal * GAL_TO_KG)} kg`,
  fuelUnit: "kg",
  weight: (lbs) => `${fmt(lbs * LBS_TO_KG)} kg`,
  weightUnit: "kg",
  altitude: (ft) => `${fmt(ft * FT_TO_M)} m`,
  altUnit: "m",
  distance: (nm) => `${fmt(nm * NM_TO_KM)} km`,
  distUnit: "km",
  speed: (kts) => `${fmt(kts * KTS_TO_KMH)} km/h`,
  speedUnit: "km/h",
  vs: (fpm) => `${fmt(fpm * FPM_TO_MS, 1)} m/s`,
  vsUnit: "m/s",
};

export function getFormatters(system: UnitSystem): UnitFormatters {
  return system === "metric" ? metricFormatters : imperialFormatters;
}
