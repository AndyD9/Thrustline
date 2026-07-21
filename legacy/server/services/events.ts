import type { PrismaClient, GameEvent } from '../../generated/prisma/client/client'

// ── Event templates ──────────────────────────────────────────────────────

interface EventTemplate {
  type:       string
  scope:      'global' | 'route' | 'aircraft'
  title:      string
  desc:       string
  modifier:   number    // 0 = blocked, >1 = cost/demand up, <1 = cost/demand down
  durationH:  [number, number]  // min–max hours
}

const EVENT_TEMPLATES: EventTemplate[] = [
  // Global — affect fuel costs
  { type: 'fuel_spike',    scope: 'global',   title: 'Fuel Price Surge',     desc: 'Oil prices surged due to geopolitical tensions.',       modifier: 1.30, durationH: [12, 48] },
  { type: 'fuel_drop',     scope: 'global',   title: 'Fuel Prices Drop',     desc: 'Oversupply brought fuel prices down.',                  modifier: 0.75, durationH: [12, 36] },

  // Route — affect demand or block route
  { type: 'weather',       scope: 'route',    title: 'Severe Weather',       desc: 'Route closed due to severe weather conditions.',        modifier: 0,    durationH: [4, 12]  },
  { type: 'tourism_boom',  scope: 'route',    title: 'Tourism Boom',         desc: 'Tourism surge — passenger demand increased!',           modifier: 1.20, durationH: [24, 72] },
  { type: 'strike',        scope: 'route',    title: 'Airport Strike',       desc: 'Airport staff on strike — departures suspended.',       modifier: 0,    durationH: [6, 24]  },

  // Aircraft — ground a specific aircraft
  { type: 'mechanical',    scope: 'aircraft', title: 'Mechanical Issue',     desc: 'Unexpected maintenance required — aircraft grounded.',  modifier: 0,    durationH: [6, 24]  },
]

// ── Helpers ──────────────────────────────────────────────────────────────

function randomBetween(min: number, max: number): number {
  return min + Math.random() * (max - min)
}

function randomFrom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

// ── Roll a random event ──────────────────────────────────────────────────

const EVENT_CHANCE = 0.15  // 15% chance per tick

export async function rollRandomEvent(
  prisma: PrismaClient,
  companyId: string,
): Promise<GameEvent | null> {
  if (Math.random() > EVENT_CHANCE) return null

  // Don't stack too many events
  const activeCount = await prisma.gameEvent.count({
    where: { companyId, expiresAt: { gt: new Date() } },
  })
  if (activeCount >= 3) return null

  const template = randomFrom(EVENT_TEMPLATES)
  const durationMs = randomBetween(template.durationH[0], template.durationH[1]) * 3600_000
  const expiresAt  = new Date(Date.now() + durationMs)

  // Resolve target for scoped events
  let targetId: string | null = null

  if (template.scope === 'route') {
    // Pick a random route that was actually flown
    const flights = await prisma.flight.findMany({
      where: { companyId },
      distinct: ['departureIcao', 'arrivalIcao'],
      select: { departureIcao: true, arrivalIcao: true },
      take: 20,
    })
    if (flights.length === 0) return null
    const f = randomFrom(flights)
    targetId = `${f.departureIcao}-${f.arrivalIcao}`
  } else if (template.scope === 'aircraft') {
    const aircraft = await prisma.aircraft.findMany({
      where: { companyId },
      select: { id: true },
    })
    if (aircraft.length === 0) return null
    targetId = randomFrom(aircraft).id
  }

  const event = await prisma.gameEvent.create({
    data: {
      type:        template.type,
      scope:       template.scope,
      targetId,
      title:       template.title,
      description: template.desc,
      modifier:    template.modifier,
      expiresAt,
      companyId,
    },
  })

  return event
}

// ── Reads ────────────────────────────────────────────────────────────────

export async function getActiveEvents(prisma: PrismaClient, companyId: string): Promise<GameEvent[]> {
  return prisma.gameEvent.findMany({
    where: { companyId, expiresAt: { gt: new Date() } },
    orderBy: { expiresAt: 'asc' },
  })
}

export async function getEventHistory(prisma: PrismaClient, companyId: string, limit = 20): Promise<GameEvent[]> {
  return prisma.gameEvent.findMany({
    where: { companyId },
    orderBy: { startsAt: 'desc' },
    take: limit,
  })
}

// ── Cleanup ──────────────────────────────────────────────────────────────

export async function cleanExpiredEvents(prisma: PrismaClient, companyId: string): Promise<number> {
  const result = await prisma.gameEvent.deleteMany({
    where: { companyId, expiresAt: { lt: new Date() } },
  })
  return result.count
}

// ── Query helpers for game logic ─────────────────────────────────────────

/** Returns fuel cost multiplier from all active global events (e.g., 1.3 for fuel spike) */
export function getFuelMultiplier(events: GameEvent[]): number {
  return events
    .filter((e) => e.scope === 'global' && (e.type === 'fuel_spike' || e.type === 'fuel_drop'))
    .reduce((mult, e) => mult * e.modifier, 1.0)
}

/** Returns load factor bonus from active route events (tourism_boom) */
export function getRouteLoadBonus(events: GameEvent[], originIcao: string, destIcao: string): number {
  const routeKey = `${originIcao}-${destIcao}`
  const matching = events.filter(
    (e) => e.scope === 'route' && e.type === 'tourism_boom' && e.targetId === routeKey,
  )
  // Return additive bonus: e.g., modifier 1.20 → +0.08 load factor bonus
  return matching.reduce((bonus, e) => bonus + (e.modifier - 1.0) * 0.4, 0)
}

/** Returns true if route is blocked by weather or strike */
export function isRouteBlocked(events: GameEvent[], originIcao: string, destIcao: string): string | null {
  const routeKey = `${originIcao}-${destIcao}`
  const blocker = events.find(
    (e) => e.scope === 'route' && e.modifier === 0 && e.targetId === routeKey,
  )
  return blocker ? blocker.title : null
}

/** Returns true if aircraft is grounded by a mechanical event */
export function isAircraftGroundedByEvent(events: GameEvent[], aircraftId: string): string | null {
  const blocker = events.find(
    (e) => e.scope === 'aircraft' && e.modifier === 0 && e.targetId === aircraftId,
  )
  return blocker ? blocker.title : null
}
