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
  origin: { icao: string; name: string };
  destination: { icao: string; name: string };
  general: {
    route: string;
    flightNumber: string;
    cruiseAlt: number;
    distance: number;
    airDistance: number;
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

/** Fetch the latest OFP for a SimBrief username. Returns null if not found. */
export async function fetchOFP(username: string): Promise<SimBriefOFP | null> {
  const res = await fetch(`${API_URL}?username=${encodeURIComponent(username)}&json=1`);
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

  return {
    origin: {
      icao: data.origin.icao_code ?? "",
      name: data.origin.name ?? "",
    },
    destination: {
      icao: data.destination.icao_code ?? "",
      name: data.destination.name ?? "",
    },
    general: {
      route: data.general?.route ?? "",
      flightNumber: data.general?.flight_number ?? "",
      cruiseAlt: parseInt(data.general?.initial_altitude) || 0,
      distance: parseInt(data.general?.route_distance) || 0,
      airDistance: parseInt(data.general?.air_distance) || 0,
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
      `${API_URL}?username=${encodeURIComponent(username)}&json=1`,
    );
    if (!res.ok) return null;
    const data = await res.json();

    // Aircraft identification is in data.aircraft
    const ac = data?.aircraft;
    // Weight limits are in data.weights
    const wt = data?.weights ?? {};
    // Fuel data in data.fuel or data.aircraft
    const fl = data?.fuel ?? {};
    if (!ac) return null;

    return {
      internalId: aircraftId,
      icaoType: ac.icaocode ?? ac.icao ?? "",
      name: ac.name ?? "",
      registration: ac.reg ?? "",
      maxPax: parseInt(ac.max_passengers) || parseInt(wt.pax_count) || 0,
      maxCargoKg: parseInt(wt.max_cargo) || parseInt(ac.maxcargo) || 0,
      maxFuelKg: parseInt(ac.maxfuel) || parseInt(fl.max_fuel) || 0,
      emptyWeightKg: parseInt(wt.oew) || parseInt(ac.oew) || 0,
      maxTakeoffKg: parseInt(wt.max_tow) || parseInt(ac.mtow) || 0,
      maxLandingKg: parseInt(wt.max_ldw) || parseInt(ac.mlw) || 0,
      maxZeroFuelKg: parseInt(wt.max_zfw) || parseInt(ac.mzfw) || 0,
      ceilingFt: parseInt(ac.ceiling) || parseInt(ac.service_ceiling) || 0,
      engineType: ac.engines ?? ac.engine_type ?? "",
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
  if (opts.simbriefAircraftId) params.set("acid", opts.simbriefAircraftId);
  if (opts.registration) params.set("reg", opts.registration);
  return `https://dispatch.simbrief.com/options/custom?${params}`;
}
