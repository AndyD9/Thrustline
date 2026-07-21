import type { SimData } from "@/hooks/useSimStream";

export type AircraftMatch = "match" | "mismatch" | "unknown";

export interface AircraftVerification {
  expectedIcao: string;
  ofpIcao: string | null;
  simulatorModel: string | null;
  dispatchVsOfp: AircraftMatch;
  simulatorVsPlan: AircraftMatch;
}

const ICAO_ALIASES: Record<string, string[]> = {
  A20N: ["A20N", "A320NEO", "A32NX"],
  A21N: ["A21N", "A321NEO", "A21NX"],
  A319: ["A319", "A319CEO"],
  A320: ["A320", "A320CEO"],
  A321: ["A321", "A321CEO"],
  B738: ["B738", "B737800", "737800", "B737-800"],
  B739: ["B739", "B737900", "737900", "B737-900"],
  B38M: ["B38M", "B737MAX8", "737MAX8", "737-8MAX"],
  B39M: ["B39M", "B737MAX9", "737MAX9", "737-9MAX"],
  B77W: ["B77W", "B777300ER", "777300ER", "B777-300ER"],
  B788: ["B788", "B7878", "7878", "B787-8"],
  B789: ["B789", "B7879", "7879", "B787-9"],
  B78X: ["B78X", "B78710", "78710", "B787-10"],
  C172: ["C172", "CESSNA172", "SKYHAWK"],
  TBM9: ["TBM9", "TBM930", "TBM900"],
  PC12: ["PC12", "PILATUSPC12"],
  AT76: ["AT76", "ATR72600", "ATR72-600"],
};

function compact(value: string): string {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function aliasesFor(icao: string): string[] {
  const normalized = compact(icao);
  return (ICAO_ALIASES[normalized] ?? [normalized]).map(compact);
}

function sameIcao(left: string | null, right: string | null): AircraftMatch {
  if (!left || !right) return "unknown";
  return compact(left) === compact(right) ? "match" : "mismatch";
}

function simulatorMatches(expected: string, sim: SimData | null): AircraftMatch {
  if (!sim) return "unknown";
  const candidates = [sim.aircraftAtcModel, sim.aircraftAtcType, sim.aircraftTitle]
    .filter((value): value is string => Boolean(value?.trim()))
    .map(compact);
  if (candidates.length === 0) return "unknown";

  const aliases = aliasesFor(expected);
  return candidates.some((candidate) => aliases.some((alias) => candidate === alias || candidate.includes(alias)))
    ? "match"
    : "mismatch";
}

export function verifyAircraft(dispatchIcao: string, ofpData: unknown, sim: SimData | null): AircraftVerification {
  let parsed = ofpData;
  if (typeof ofpData === "string") {
    try { parsed = JSON.parse(ofpData); } catch { parsed = null; }
  }

  const ofp = parsed as { aircraft?: { icaoType?: unknown; icaocode?: unknown } } | null;
  const rawOfpIcao = ofp?.aircraft?.icaoType ?? ofp?.aircraft?.icaocode;
  const ofpIcao = typeof rawOfpIcao === "string" && rawOfpIcao.trim() ? rawOfpIcao.trim().toUpperCase() : null;
  const expectedIcao = dispatchIcao.trim().toUpperCase();

  return {
    expectedIcao,
    ofpIcao,
    simulatorModel: sim?.aircraftAtcModel?.trim() || sim?.aircraftTitle?.trim() || null,
    dispatchVsOfp: sameIcao(expectedIcao, ofpIcao),
    simulatorVsPlan: simulatorMatches(expectedIcao, sim),
  };
}
