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
export function buildSimbriefUrl(opts: {
  origin: string;
  dest: string;
  icaoType: string;
  airline?: string;
  flightNumber?: string;
  callsign?: string;
}): string {
  const params = new URLSearchParams({
    orig: opts.origin,
    dest: opts.dest,
    type: opts.icaoType,
  });
  if (opts.airline) params.set("airline", opts.airline);
  if (opts.flightNumber) params.set("fltnum", opts.flightNumber);
  if (opts.callsign) params.set("callsign", opts.callsign);
  return `https://dispatch.simbrief.com/options/custom?${params}`;
}
