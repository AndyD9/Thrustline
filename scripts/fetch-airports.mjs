#!/usr/bin/env node
/**
 * Downloads the OurAirports CSV and generates src/data/airports-db.json.
 * Run once: npm run airports:fetch
 *
 * Includes: large_airport + medium_airport (always)
 *           small_airport with scheduled_service=yes
 * Filtered to 4-char ICAO codes only.
 */

import { writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const OUT = path.join(__dirname, '..', 'src', 'data', 'airports-db.json')
const CSV_URL = 'https://davidmegginson.github.io/ourairports-data/airports.csv'

const ALWAYS_INCLUDE = new Set(['large_airport', 'medium_airport'])
const ICAO_RE = /^[A-Z]{4}$/

// ── CSV parser (handles quoted fields) ───────────────────────────────────────
function parseCSVLine(line) {
  const result = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++ }
      else inQuotes = !inQuotes
    } else if (ch === ',' && !inQuotes) {
      result.push(current); current = ''
    } else {
      current += ch
    }
  }
  result.push(current)
  return result
}

// ── Fetch ────────────────────────────────────────────────────────────────────
console.log('[airports] Fetching OurAirports data…')
const res = await fetch(CSV_URL)
if (!res.ok) throw new Error(`HTTP ${res.status}`)
const text = await res.text()

const lines = text.split('\n')
const header = parseCSVLine(lines[0])

const col = (name) => header.indexOf(name)
const I = {
  ident:   col('ident'),
  type:    col('type'),
  name:    col('name'),
  lat:     col('latitude_deg'),
  lon:     col('longitude_deg'),
  country: col('iso_country'),
  city:    col('municipality'),
  sched:   col('scheduled_service'),
}

const airports = []

for (let i = 1; i < lines.length; i++) {
  const line = lines[i].trim()
  if (!line) continue

  const row = parseCSVLine(line)
  if (row.length < 10) continue

  const ident = row[I.ident]?.trim()
  if (!ICAO_RE.test(ident)) continue

  const type  = row[I.type]?.trim()
  const sched = row[I.sched]?.trim()

  if (!ALWAYS_INCLUDE.has(type) && !(type === 'small_airport' && sched === 'yes')) continue

  const lat = parseFloat(row[I.lat])
  const lon = parseFloat(row[I.lon])
  if (isNaN(lat) || isNaN(lon)) continue

  airports.push({
    icao:    ident,
    name:    row[I.name]?.trim()    || '',
    city:    row[I.city]?.trim()    || '',
    country: row[I.country]?.trim() || '',
    lat:     Math.round(lat * 1000) / 1000,
    lon:     Math.round(lon * 1000) / 1000,
  })
}

airports.sort((a, b) => a.icao.localeCompare(b.icao))

await writeFile(OUT, JSON.stringify(airports), 'utf8')
console.log(`[airports] ✓ ${airports.length} airports written to src/data/airports-db.json`)
