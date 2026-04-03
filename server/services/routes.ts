import type { PrismaClient } from '@prisma/client'
import { z } from 'zod'

export const CreateRouteSchema = z.object({
  originIcao: z.string().min(3).max(4).toUpperCase(),
  destIcao:   z.string().min(3).max(4).toUpperCase(),
})

// ── Discovered routes (aggregated from flight history) ────────────────────

export async function getDiscoveredRoutes(prisma: PrismaClient) {
  const rows = await prisma.flight.groupBy({
    by: ['departureIcao', 'arrivalIcao'],
    _count:  { id: true },
    _sum:    { revenue: true, netResult: true, fuelCost: true, landingFee: true, distanceNm: true },
    _avg:    { landingVsFpm: true, distanceNm: true, netResult: true },
    _min:    { landingVsFpm: true },
    orderBy: { _count: { id: 'desc' } },
  })

  return rows.map((r) => ({
    departureIcao: r.departureIcao,
    arrivalIcao:   r.arrivalIcao,
    flightCount:   r._count.id,
    totalRevenue:  Math.round(r._sum.revenue    ?? 0),
    totalNet:      Math.round(r._sum.netResult  ?? 0),
    avgNet:        Math.round(r._avg.netResult  ?? 0),
    avgVsFpm:      Math.round(r._avg.landingVsFpm ?? 0),
    avgDistanceNm: Math.round(r._avg.distanceNm  ?? 0),
    worstVsFpm:    Math.round(r._min.landingVsFpm ?? 0),
  }))
}

// ── Saved routes (user-bookmarked) ────────────────────────────────────────

export async function getSavedRoutes(prisma: PrismaClient) {
  return prisma.route.findMany({
    where:   { active: true },
    orderBy: { originIcao: 'asc' },
  })
}

export async function createRoute(
  prisma: PrismaClient,
  data: z.infer<typeof CreateRouteSchema>,
) {
  const company = await prisma.company.findFirstOrThrow()

  // Avoid duplicate saved routes
  const existing = await prisma.route.findFirst({
    where: { originIcao: data.originIcao, destIcao: data.destIcao, companyId: company.id },
  })
  if (existing) {
    // Re-activate if previously soft-deleted
    return prisma.route.update({
      where: { id: existing.id },
      data:  { active: true },
    })
  }

  return prisma.route.create({
    data: {
      originIcao: data.originIcao,
      destIcao:   data.destIcao,
      distanceNm: 0,   // updated after first flight
      basePrice:  0,
      companyId:  company.id,
    },
  })
}

export async function deleteRoute(prisma: PrismaClient, id: string) {
  return prisma.route.update({
    where: { id },
    data:  { active: false },
  })
}
