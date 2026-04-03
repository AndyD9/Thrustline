import type { PrismaClient } from '@prisma/client'
import { z } from 'zod'
import { CATALOG_BY_TYPE } from './company'
import { getCrewForAircraft } from './crew'
import { getActiveEvents, isRouteBlocked, isAircraftGroundedByEvent } from './events'

// Fallback when icaoType isn't in the catalog
const DEFAULT_DISPATCH = { seatsEco: 150, seatsBiz: 12, fuelLbsPerNm: 45 }

// ── Airport popularity → load factor bonus/malus ──────────────────────────

const MAJOR_HUBS = new Set([
  'EGLL','KJFK','LFPG','OMDB','OTHH','RJTT','ZBAA','WSSS',
  'EDDF','EHAM','KLAX','KORD','KATL','VHHH','CYYZ','YSSY',
  'KEWR','KBOS','KSFO','SBGR','LEMD','LIRF',
])
const SECONDARY_HUBS = new Set([
  'LSZH','EBBR','EKCH','ESSA','LTFM','LGAV','WMKK','RCTP',
  'VTBS','VABB','VIDP','RKSI','RJAA','YMML','YBBN','SAEZ','SCEL',
])

function airportFactor(icao: string): number {
  if (MAJOR_HUBS.has(icao))     return 1.08
  if (SECONDARY_HUBS.has(icao)) return 1.03
  return 0.92  // smaller / regional airport
}

function baseLoadFactor(distanceNm: number): number {
  if (distanceNm < 800)  return 0.72
  if (distanceNm < 2500) return 0.78
  return 0.85
}

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v))
}

function jitter(base: number, range = 0.05): number {
  return base + (Math.random() * 2 - 1) * range
}

function flightNumber(airlineCode: string, origin: string, dest: string): string {
  // Deterministic hash → consistent number for the same route
  let h = 5381
  for (const c of origin + dest) h = ((h << 5) + h + c.charCodeAt(0)) & 0x7fffffff
  return `${airlineCode.slice(0, 3).toUpperCase()}${1000 + (h % 8000)}`
}

function cruiseAltForDistance(nm: number): number {
  if (nm < 400)  return 28000
  if (nm < 1200) return 33000
  if (nm < 3500) return 37000
  return 39000
}

// ── Core generation ───────────────────────────────────────────────────────

export function generateNumbers(
  icaoType: string,
  originIcao: string,
  destIcao: string,
  distanceNm: number,
) {
  const cat = CATALOG_BY_TYPE.get(icaoType) ?? DEFAULT_DISPATCH

  const baseLF = baseLoadFactor(distanceNm)
  // Destination popularity drives passenger demand
  const lf     = clamp(jitter(baseLF * airportFactor(destIcao)), 0.45, 0.97)

  const ecoPax   = Math.round(cat.seatsEco * lf)
  const bizPax   = Math.round(cat.seatsBiz * clamp(jitter(lf + 0.05), 0.5, 1.0))
  const totalPax = ecoPax + bizPax

  // Cargo = checked bags + belly cargo
  const bagKg    = totalPax * 23
  const bellyKg  = distanceNm < 1500
    ? 1200 + Math.random() * 1000
    :  600 + Math.random() *  800
  const cargoKg  = Math.round(bagKg + bellyKg)

  // Fuel: burn * 1.22 (contingency + taxi + alternate)
  const burnLbs     = distanceNm * cat.fuelLbsPerNm
  const estimFuelLbs = Math.round(burnLbs * 1.22)

  const cruiseAlt = cruiseAltForDistance(distanceNm)

  return { ecoPax, bizPax, cargoKg, estimFuelLbs, cruiseAlt }
}

// ── Zod schema ────────────────────────────────────────────────────────────

export const CreateDispatchSchema = z.object({
  originIcao:  z.string().min(3).max(4).toUpperCase(),
  destIcao:    z.string().min(3).max(4).toUpperCase(),
  distanceNm:  z.number().positive(),
  aircraftId:  z.string().optional(),
})

// ── CRUD ──────────────────────────────────────────────────────────────────

export async function createDispatch(
  prisma: PrismaClient,
  input: z.infer<typeof CreateDispatchSchema>,
) {
  const { originIcao, destIcao, distanceNm, aircraftId } = input

  const company = await prisma.company.findFirstOrThrow()

  // Resolve aircraft: explicit → active → first in fleet
  const aircraft = aircraftId
    ? await prisma.aircraft.findUnique({ where: { id: aircraftId } })
    : company.activeAircraftId
      ? await prisma.aircraft.findUnique({ where: { id: company.activeAircraftId } })
      : await prisma.aircraft.findFirst({ where: { companyId: company.id } })

  if (!aircraft) throw new Error('No aircraft in fleet. Add one before dispatching.')

  // Range check — block if route exceeds aircraft range
  const spec = CATALOG_BY_TYPE.get(aircraft.icaoType)
  if (spec && distanceNm > spec.rangeNm) {
    throw new Error(
      `${aircraft.name} (${aircraft.icaoType}) has a range of ${spec.rangeNm.toLocaleString()} nm — this route is ${Math.round(distanceNm).toLocaleString()} nm. Choose a closer destination or a longer-range aircraft.`,
    )
  }

  // Event checks — route blocked or aircraft grounded by events
  const activeEvents = await getActiveEvents(prisma, company.id)
  const routeBlocker = isRouteBlocked(activeEvents, originIcao, destIcao)
  if (routeBlocker) {
    throw new Error(`Route ${originIcao}→${destIcao} is currently blocked: ${routeBlocker}.`)
  }
  const aircraftBlocker = isAircraftGroundedByEvent(activeEvents, aircraft.id)
  if (aircraftBlocker) {
    throw new Error(`${aircraft.name} is currently grounded: ${aircraftBlocker}.`)
  }

  // Crew check — need at least 2 crew members assigned to this aircraft
  const crew = await getCrewForAircraft(prisma, aircraft.id)
  if (crew.length < 2) {
    throw new Error(
      `${aircraft.name} needs at least 2 crew members assigned (has ${crew.length}). Go to Crew to assign pilots.`,
    )
  }
  const exhausted = crew.filter((c) => c.dutyHours >= c.maxDutyH)
  if (exhausted.length > 0) {
    throw new Error(
      `${exhausted[0].firstName} ${exhausted[0].lastName} has reached the duty hour limit (${exhausted[0].maxDutyH}h). Wait for monthly reset or assign different crew.`,
    )
  }

  const nums    = generateNumbers(aircraft.icaoType, originIcao, destIcao, distanceNm)
  const fltNum  = flightNumber(company.airlineCode ?? 'THL', originIcao, destIcao)

  return prisma.dispatch.create({
    data: {
      flightNumber: fltNum,
      originIcao,
      destIcao,
      icaoType:    aircraft.icaoType,
      distanceNm,
      ...nums,
      companyId:  company.id,
      aircraftId: aircraft.id,
    },
    include: { company: true },
  })
}

export async function getDispatches(prisma: PrismaClient) {
  return prisma.dispatch.findMany({
    orderBy: { createdAt: 'desc' },
    take: 50,
  })
}

export async function deleteDispatch(prisma: PrismaClient, id: string) {
  return prisma.dispatch.delete({ where: { id } })
}

export async function setDispatchStatus(prisma: PrismaClient, id: string, status: string) {
  return prisma.dispatch.update({ where: { id }, data: { status } })
}

// ── SimBrief integration ──────────────────────────────────────────────────

export function buildSimbriefUrl(dispatch: {
  originIcao: string
  destIcao: string
  icaoType: string
  ecoPax: number
  bizPax: number
  cargoKg: number
  cruiseAlt: number
  flightNumber: string
}, airlineCode: string) {
  const code    = airlineCode.slice(0, 3).toUpperCase()
  const fltNum  = dispatch.flightNumber.startsWith(code)
    ? dispatch.flightNumber.slice(code.length)
    : dispatch.flightNumber

  const params = new URLSearchParams({
    orig:      dispatch.originIcao,
    dest:      dispatch.destIcao,
    type:      dispatch.icaoType,
    airline:   code,
    fltnum:    fltNum,
    pax:       String(dispatch.ecoPax + dispatch.bizPax),
    cargo:     String(Math.round(dispatch.cargoKg)),
    cruisealt: String(dispatch.cruiseAlt),
    manualrmk: `Dispatched via Thrustline | ${dispatch.ecoPax} eco + ${dispatch.bizPax} biz pax`,
  })

  return `https://www.simbrief.com/system/dispatch.php?${params}`
}

export interface SimbriefOFPSummary {
  origin:       string
  destination:  string
  aircraft:     string
  flightNumber: string
  route:        string
  fuelPlanLbs:  number
  paxCount:     number
  cargoLbs:     number
  flightTime:   string   // e.g. "0205"
  cruiseAlt:    string
  generatedAt:  number   // unix timestamp
}

export async function fetchSimbriefOFP(
  prisma: PrismaClient,
  dispatchId: string,
  simbriefUsername: string,
): Promise<SimbriefOFPSummary> {
  if (!simbriefUsername?.trim()) {
    throw new Error('SimBrief username not set — add it in Settings.')
  }

  const url = `https://www.simbrief.com/api/xml.fetcher.php?username=${encodeURIComponent(simbriefUsername.trim())}&json=1`
  const res = await fetch(url, { signal: AbortSignal.timeout(10_000) })

  if (!res.ok) {
    throw new Error(`SimBrief API returned ${res.status}. Check your username.`)
  }

  const raw = await res.json() as Record<string, unknown>

  // SimBrief wraps data in various nested objects
  const params  = raw['params']  as Record<string, string>  ?? {}
  const fuel    = raw['fuel']    as Record<string, string>  ?? {}
  const weights = raw['weights'] as Record<string, string>  ?? {}
  const atc     = raw['atc']     as Record<string, string>  ?? {}
  const general = raw['general'] as Record<string, string>  ?? {}

  const summary: SimbriefOFPSummary = {
    origin:       params['orig_icao']      ?? '',
    destination:  params['dest_icao']      ?? '',
    aircraft:     params['type']           ?? '',
    flightNumber: `${params['icao_airline'] ?? ''}${params['flight'] ?? ''}`,
    route:        atc['route']             ?? '',
    fuelPlanLbs:  parseInt(fuel['plan_ramp'] ?? '0', 10),
    paxCount:     parseInt(weights['pax_count'] ?? '0', 10),
    cargoLbs:     parseInt(weights['cargo'] ?? '0', 10),
    flightTime:   general['time_enroute']  ?? '',
    cruiseAlt:    params['cruise_altitude'] ?? '',
    generatedAt:  parseInt(general['upd_time'] ?? '0', 10),
  }

  // Persist OFP + mark as dispatched
  await prisma.dispatch.update({
    where: { id: dispatchId },
    data: {
      ofpData: JSON.stringify(summary),
      status:  'dispatched',
    },
  })

  return summary
}

// ── Auto-link on flight events (called from main.ts) ──────────────────────

export async function findActiveDispatch(
  prisma: PrismaClient,
  originIcao: string,
  destIcao: string,
) {
  return prisma.dispatch.findFirst({
    where: {
      originIcao,
      destIcao,
      status: { in: ['pending', 'dispatched', 'flying'] },
    },
    orderBy: { createdAt: 'desc' },
  })
}

export async function linkFlightToDispatch(
  prisma: PrismaClient,
  dispatchId: string,
  flightId: string,
) {
  return prisma.dispatch.update({
    where: { id: dispatchId },
    data:  { status: 'completed', flightId },
  })
}
