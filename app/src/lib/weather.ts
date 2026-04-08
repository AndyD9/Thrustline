/**
 * METAR/TAF weather fetching via sim-bridge proxy.
 *
 * aviationweather.gov blocks CORS from browsers, so we proxy
 * through the local sim-bridge .NET backend which has no restrictions.
 */

const SIM_BRIDGE = import.meta.env.VITE_SIM_BRIDGE_URL ?? "http://127.0.0.1:5055";

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const cache = new Map<string, { data: string; fetchedAt: number }>();

/**
 * Fetch METAR for an ICAO airport via sim-bridge proxy.
 */
export async function fetchMetar(icao: string): Promise<string | null> {
  const cacheKey = `metar:${icao}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL) return cached.data;

  try {
    const res = await fetch(`${SIM_BRIDGE}/weather/metar/${icao}`);
    if (!res.ok) return null;
    const json = await res.json();
    const raw = json.raw ?? "";
    if (raw) {
      cache.set(cacheKey, { data: raw, fetchedAt: Date.now() });
    }
    return raw || null;
  } catch {
    return null;
  }
}

/**
 * Fetch TAF for an ICAO airport via sim-bridge proxy.
 */
export async function fetchTaf(icao: string): Promise<string | null> {
  const cacheKey = `taf:${icao}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL) return cached.data;

  try {
    const res = await fetch(`${SIM_BRIDGE}/weather/taf/${icao}`);
    if (!res.ok) return null;
    const json = await res.json();
    const raw = json.raw ?? "";
    if (raw) {
      cache.set(cacheKey, { data: raw, fetchedAt: Date.now() });
    }
    return raw || null;
  } catch {
    return null;
  }
}
