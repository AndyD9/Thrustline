import type { PrismaClient } from '../../generated/prisma/client/client'

// ── Constants ────────────────────────────────────────────────────────────

const BASE_SCORE  = 50
const MIN_SCORE   = 0
const MAX_SCORE   = 100
const SMOOTHING   = 0.85  // moving average: newScore = old × SMOOTHING + delta × (1 - SMOOTHING)

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v))
}

// ── Landing quality → reputation delta ───────────────────────────────────

function landingDelta(vsFpm: number): number {
  // vsFpm is negative (descent), so we compare absolute value
  const vs = Math.abs(vsFpm)
  if (vs < 50)  return 3    // butter
  if (vs < 150) return 2    // smooth
  if (vs < 300) return 1    // normal
  if (vs < 500) return 0    // firm
  if (vs < 700) return -3   // hard
  return -6                 // very hard / crash-like
}

// ── Compute reputation update factors ────────────────────────────────────

export interface ReputationFactors {
  landingVsFpm:    number
  loadFactor:      number   // 0–1
  avgFleetHealth:  number   // 0–100
}

function computeDelta(factors: ReputationFactors): number {
  let delta = landingDelta(factors.landingVsFpm)

  // High load factor → passengers satisfied (good demand management)
  if (factors.loadFactor > 0.85) delta += 1
  if (factors.loadFactor < 0.50) delta -= 1

  // Fleet health → public image
  if (factors.avgFleetHealth < 60) delta -= 2
  else if (factors.avgFleetHealth < 75) delta -= 1
  else if (factors.avgFleetHealth >= 95) delta += 1

  return delta
}

// ── CRUD ─────────────────────────────────────────────────────────────────

export async function getRouteReputation(
  prisma: PrismaClient,
  originIcao: string,
  destIcao: string,
  companyId: string,
): Promise<{ score: number; flightCount: number }> {
  const rep = await prisma.reputation.findUnique({
    where: { originIcao_destIcao_companyId: { originIcao, destIcao, companyId } },
  })
  return rep ?? { score: BASE_SCORE, flightCount: 0 }
}

export async function updateReputation(
  prisma: PrismaClient,
  originIcao: string,
  destIcao: string,
  companyId: string,
  factors: ReputationFactors,
): Promise<{ score: number; delta: number }> {
  const delta = computeDelta(factors)

  const existing = await prisma.reputation.findUnique({
    where: { originIcao_destIcao_companyId: { originIcao, destIcao, companyId } },
  })

  const oldScore = existing?.score ?? BASE_SCORE
  const newScore = clamp(
    oldScore * SMOOTHING + (oldScore + delta) * (1 - SMOOTHING),
    MIN_SCORE,
    MAX_SCORE,
  )

  await prisma.reputation.upsert({
    where: { originIcao_destIcao_companyId: { originIcao, destIcao, companyId } },
    create: {
      originIcao,
      destIcao,
      companyId,
      score:       newScore,
      flightCount: 1,
    },
    update: {
      score:       newScore,
      flightCount: { increment: 1 },
    },
  })

  return { score: Math.round(newScore * 10) / 10, delta }
}

// ── Reads ────────────────────────────────────────────────────────────────

export async function getAllReputations(prisma: PrismaClient, companyId: string) {
  return prisma.reputation.findMany({
    where: { companyId },
    orderBy: { score: 'desc' },
  })
}

export async function getCompanyReputation(prisma: PrismaClient, companyId: string): Promise<number> {
  const reps = await prisma.reputation.findMany({
    where: { companyId },
    select: { score: true },
  })
  if (reps.length === 0) return BASE_SCORE
  const avg = reps.reduce((s, r) => s + r.score, 0) / reps.length
  return Math.round(avg * 10) / 10
}
