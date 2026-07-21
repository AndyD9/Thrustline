// SimBrief OFP API integration

const API_URL = "https://www.simbrief.com/api/xml.fetcher.php";

export interface SimBriefNavlogFix {
  ident: string;
  lat: number;
  lon: number;
  alt: number;
  type: string;
}

export interface SimBriefOFP {
  origin: { icao: string; name: string; runway?: string; metar?: string; qnhHpa?: number };
  destination: { icao: string; name: string; runway?: string; metar?: string; qnhHpa?: number };
  general: {
    route: string;
    flightNumber: string;
    cruiseAlt: number;
    distance: number;
    airDistance: number;
    sid?: string;
    star?: string;
  };
  fuel: {
    plan: number;
    taxi: number;
    enroute: number;
    reserve: number;
    total: number;
  };
  weights: {
    paxCount: number;
    cargo: number;
    zfw: number;
    tow: number;
    ldw: number;
  };
  times: {
    schedOut: number;  // unix timestamp
    schedIn: number;   // unix timestamp
    estimEnroute: number; // seconds
  };
  aircraft: {
    icaoType: string;
    name: string;
  };
  navlog: SimBriefNavlogFix[];
}

/** Extract QNH from either ICAO (Q1013) or FAA (A2992) METAR notation. */
function qnhFromMetar(metar: string): number | undefined {
  const qnh = metar.match(/\bQ(\d{4})\b/i);
  if (qnh) return Number(qnh[1]);

  const altimeter = metar.match(/\bA(\d{4})\b/i);
  if (!altimeter) return undefined;
  return Math.round((Number(altimeter[1]) / 100) * 33.8639);
}

function qnhFromAltimeter(value: unknown): number | undefined {
  const altimeter = Number(value);
  if (!Number.isFinite(altimeter) || altimeter <= 0) return undefined;
  if (altimeter > 900) return Math.round(altimeter);
  return Math.round(altimeter * 33.8639);
}

function firstText(...values: unknown[]): string {
  const value = values.find((item) => typeof item === "string" && item.trim());
  return typeof value === "string" ? value.trim() : "";
}

/** Fetch the latest OFP for a SimBrief username. Returns null if not found. */
export async function fetchOFP(username: string): Promise<SimBriefOFP | null> {
  const res = await fetch(`${API_URL}?username=${encodeURIComponent(username)}&json=v2`);
  if (!res.ok) return null;

  const data = await res.json();
  if (!data?.origin?.icao_code) return null;

  const navlog: SimBriefNavlogFix[] = [];
  const fixes = data.navlog?.fix;
  if (Array.isArray(fixes)) {
    for (const f of fixes) {
      navlog.push({
        ident: f.ident ?? "",
        lat: parseFloat(f.pos_lat) || 0,
        lon: parseFloat(f.pos_long) || 0,
        alt: parseInt(f.altitude_feet) || 0,
        type: f.type ?? "",
      });
    }
  }

  const originMetar = firstText(data.weather?.orig_metar, data.origin?.metar);
  const destinationMetar = firstText(data.weather?.dest_metar, data.destination?.metar);
  const takeoffConditions = data.tlr?.takeoff?.conditions;
  const landingConditions = data.tlr?.landing?.conditions;
  const originRunway = firstText(
    data.origin?.plan_rwy,
    data.origin?.runway,
    takeoffConditions?.planned_runway,
    data.api_params?.origrwy,
  );
  const destinationRunway = firstText(
    data.destination?.plan_rwy,
    data.destination?.runway,
    landingConditions?.planned_runway,
    data.api_params?.destrwy,
  );

  return {
    origin: {
      icao: data.origin.icao_code ?? "",
      name: data.origin.name ?? "",
      runway: originRunway,
      metar: originMetar,
      qnhHpa: qnhFromMetar(originMetar) ?? qnhFromAltimeter(takeoffConditions?.altimeter),
    },
    destination: {
      icao: data.destination.icao_code ?? "",
      name: data.destination.name ?? "",
      runway: destinationRunway,
      metar: destinationMetar,
      qnhHpa: qnhFromMetar(destinationMetar) ?? qnhFromAltimeter(landingConditions?.altimeter),
    },
    general: {
      route: data.general?.route ?? "",
      flightNumber: data.general?.flight_number ?? "",
      cruiseAlt: parseInt(data.general?.initial_altitude) || 0,
      distance: parseInt(data.general?.route_distance) || 0,
      airDistance: parseInt(data.general?.air_distance) || 0,
      sid: data.general?.sid_ident ?? "",
      star: data.general?.star_ident ?? "",
    },
    fuel: {
      plan: parseInt(data.fuel?.plan_ramp) || 0,
      taxi: parseInt(data.fuel?.taxi) || 0,
      enroute: parseInt(data.fuel?.enroute_burn) || 0,
      reserve: parseInt(data.fuel?.reserve) || 0,
      total: parseInt(data.fuel?.plan_ramp) || 0,
    },
    weights: {
      paxCount: parseInt(data.weights?.pax_count) || 0,
      cargo: parseInt(data.weights?.cargo) || 0,
      zfw: parseInt(data.weights?.est_zfw) || 0,
      tow: parseInt(data.weights?.est_tow) || 0,
      ldw: parseInt(data.weights?.est_ldw) || 0,
    },
    times: {
      schedOut: parseInt(data.times?.sched_out) || 0,
      schedIn: parseInt(data.times?.sched_in) || 0,
      estimEnroute: parseInt(data.times?.est_time_enroute) || 0,
    },
    aircraft: {
      icaoType: data.aircraft?.icaocode ?? "",
      name: data.aircraft?.name ?? "",
    },
    navlog,
  };
}

/** Build SimBrief dispatch URL with pre-filled fields. */
/** Fetched SimBrief saved aircraft profile. */
export interface SimbriefAircraft {
  internalId: string;
  icaoType: string;
  name: string;
  registration: string;
  maxPax: number;
  maxCargoKg: number;
  maxFuelKg: number;
  emptyWeightKg: number;
  maxTakeoffKg: number;
  maxLandingKg: number;
  maxZeroFuelKg: number;
  ceilingFt: number;
  engineType: string;
}

/**
 * Fetch a SimBrief saved aircraft profile by internal ID.
 * Uses the SimBrief API via the latest OFP to get aircraft details.
 * If no OFP exists, returns null.
 */
export async function fetchSimbriefAircraft(
  username: string,
  aircraftId: string,
): Promise<SimbriefAircraft | null> {
  try {
    // SimBrief doesn't have a direct aircraft-by-ID endpoint.
    // We fetch the user's latest OFP and check if it matches, or we parse
    // the aircraft data from a dispatch generated with this aircraft.
    // Best approach: fetch the fleet list via the API.
    const res = await fetch(
      `${API_URL}?username=${encodeURIComponent(username)}&json=v2`,
    );
    if (!res.ok) return null;
    const data = await res.json();

    // Aircraft identification is in data.aircraft
    const ac = data?.aircraft ?? {};
    // Weight limits are in data.weights
    const wt = data?.weights ?? {};
    // Fuel data in data.fuel
    const fl = data?.fuel ?? {};
    if (!ac.icaocode && !ac.icao_code) return null;

    return {
      internalId: ac.internal_id ?? aircraftId,
      icaoType: ac.icaocode ?? ac.icao_code ?? "",
      name: ac.name ?? "",
      registration: ac.reg ?? "",
      maxPax: parseInt(ac.max_passengers) || 0,
      maxCargoKg: parseInt(wt.cargo) || 0,
      maxFuelKg: parseInt(fl.max_tanks) || 0,         // fuel.max_tanks = max fuel capacity
      emptyWeightKg: parseInt(wt.oew) || 0,
      maxTakeoffKg: parseInt(wt.max_tow_struct) || parseInt(wt.max_tow) || 0, // structural MTOW for pricing
      maxLandingKg: parseInt(wt.max_ldw) || 0,
      maxZeroFuelKg: parseInt(wt.max_zfw) || 0,
      ceilingFt: 0, // not in OFP response
      engineType: ac.engines ?? "",
    };
  } catch {
    return null;
  }
}

export function buildSimbriefUrl(opts: {
  origin: string;
  dest: string;
  icaoType: string;
  airline?: string;
  flightNumber?: string;
  callsign?: string;
  pax?: number;
  cargoKg?: number;
  manualZfwKg?: number;
  scheduledBlockHours?: number;
  scheduledBlockMinutes?: number;
  departureRunway?: string;
  arrivalRunway?: string;
  altitudeFt?: number;
  /** SimBrief saved aircraft internal ID — overrides type with exact aircraft profile */
  simbriefAircraftId?: string | null;
  registration?: string | null;
}): string {
  const params = new URLSearchParams({
    orig: opts.origin,
    dest: opts.dest,
    type: opts.icaoType,
  });
  if (opts.airline) params.set("airline", opts.airline);
  if (opts.flightNumber) params.set("fltnum", opts.flightNumber);
  if (opts.callsign) params.set("callsign", opts.callsign);
  if (opts.pax && opts.pax > 0) params.set("pax", String(opts.pax));
  params.set("units", "KGS");
  if (opts.cargoKg !== undefined && opts.cargoKg >= 0) params.set("cargo", String(opts.cargoKg / 1000));
  if (opts.manualZfwKg && opts.manualZfwKg > 0) params.set("manualzfw", String(opts.manualZfwKg / 1000));
  if (opts.scheduledBlockHours !== undefined) params.set("steh", String(opts.scheduledBlockHours));
  if (opts.scheduledBlockMinutes !== undefined) params.set("stem", String(opts.scheduledBlockMinutes));
  if (opts.departureRunway) params.set("origrwy", opts.departureRunway);
  if (opts.arrivalRunway) params.set("destrwy", opts.arrivalRunway);
  if (opts.altitudeFt && opts.altitudeFt > 0) params.set("fl", String(opts.altitudeFt));
  if (opts.simbriefAircraftId) params.set("acid", opts.simbriefAircraftId);
  if (opts.registration) params.set("reg", opts.registration);
  return `https://dispatch.simbrief.com/options/custom?${params}`;
}
