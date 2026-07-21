import type { FastifyInstance } from 'fastify'
import { getAirport } from '../../src/data/airports'

// ── airport-data.com fallback ─────────────────────────────────────────────────
// Free, no auth, global coverage. Called server-side to avoid CORS.

interface AirportDataResponse {
  icao:         string
  name:         string
  location:     string   // "City, Region" or just "City"
  country_code: string
  latitude:     string
  longitude:    string
  status:       number
}

async function fetchFromAviationApi(icao: string) {
  const url = `https://www.airport-data.com/api/ap_info.json?icao=${encodeURIComponent(icao)}`
  const res  = await fetch(url, { signal: AbortSignal.timeout(5_000) })
  if (!res.ok) return null
  const data = await res.json() as AirportDataResponse
  if (!data || data.status === 0 || !data.latitude) return null

  // "location" can be "Paris, Ile-de-France" — take only the first segment as city
  const city    = data.location?.split(',')[0]?.trim() || ''
  const lat     = parseFloat(data.latitude)
  const lon     = parseFloat(data.longitude)
  if (isNaN(lat) || isNaN(lon)) return null

  return {
    icao:    icao.toUpperCase(),
    name:    data.name    || icao,
    city,
    country: data.country_code || '',
    lat,
    lon,
  }
}

// ── Route ────────────────────────────────────────────────────────────────────

export async function airportRoutes(fastify: FastifyInstance) {
  /**
   * GET /api/airport/:icao
   * Returns { icao, name, city, country, lat, lon } or 404.
   * First checks the bundled static DB, then falls back to airport-data.com.
   */
  fastify.get('/api/airport/:icao', async (request, reply) => {
    const { icao } = request.params as { icao: string }
    const code = icao.toUpperCase().trim()

    if (!/^[A-Z]{2,4}$/.test(code)) {
      return reply.status(400).send({ error: 'Invalid ICAO code' })
    }

    // 1. Static DB (instant)
    const local = getAirport(code)
    if (local) return local

    // 2. Live API fallback
    try {
      const remote = await fetchFromAviationApi(code)
      if (remote) return remote
    } catch (err) {
      fastify.log.warn(`[airports] API fallback failed for ${code}: ${err}`)
    }

    return reply.status(404).send({ error: `Airport ${code} not found` })
  })
}
