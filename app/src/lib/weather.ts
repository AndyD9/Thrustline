/**
 * METAR/TAF weather fetching via CheckWX or AVWX API.
 * Simple cache to avoid hammering the API.
 */

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const cache = new Map<string, { data: string; fetchedAt: number }>();

/**
 * Fetch METAR for an ICAO airport.
 * Uses CheckWX public endpoint (no key required for basic METAR).
 * Falls back to AVWX if available.
 */
export async function fetchMetar(icao: string, apiKey?: string): Promise<string | null> {
  const cacheKey = `metar:${icao}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL) return cached.data;

  try {
    // Try AVWX if API key provided
    if (apiKey) {
      const res = await fetch(`https://avwx.rest/api/metar/${icao}?format=json`, {
        headers: { Authorization: `BEARER ${apiKey}` },
      });
      if (res.ok) {
        const json = await res.json();
        const raw = json.raw ?? json.sanitized ?? JSON.stringify(json);
        cache.set(cacheKey, { data: raw, fetchedAt: Date.now() });
        return raw;
      }
    }

    // Fallback: fetch from aviationweather.gov (public, no key)
    const res = await fetch(
      `https://aviationweather.gov/api/data/metar?ids=${icao}&format=raw&taf=false`
    );
    if (res.ok) {
      const text = (await res.text()).trim();
      if (text) {
        cache.set(cacheKey, { data: text, fetchedAt: Date.now() });
        return text;
      }
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Fetch TAF for an ICAO airport.
 */
export async function fetchTaf(icao: string, apiKey?: string): Promise<string | null> {
  const cacheKey = `taf:${icao}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL) return cached.data;

  try {
    if (apiKey) {
      const res = await fetch(`https://avwx.rest/api/taf/${icao}?format=json`, {
        headers: { Authorization: `BEARER ${apiKey}` },
      });
      if (res.ok) {
        const json = await res.json();
        const raw = json.raw ?? json.sanitized ?? JSON.stringify(json);
        cache.set(cacheKey, { data: raw, fetchedAt: Date.now() });
        return raw;
      }
    }

    const res = await fetch(
      `https://aviationweather.gov/api/data/taf?ids=${icao}&format=raw`
    );
    if (res.ok) {
      const text = (await res.text()).trim();
      if (text) {
        cache.set(cacheKey, { data: text, fetchedAt: Date.now() });
        return text;
      }
    }

    return null;
  } catch {
    return null;
  }
}
