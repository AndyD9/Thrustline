import type { PrismaClient } from '@prisma/client'
import { z } from 'zod'

export const CreateFlightSchema = z.object({
  departureIcao: z.string().min(3).max(4),
  arrivalIcao: z.string().min(3).max(4),
  durationMin: z.number().int().min(0),
  fuelUsedGal: z.number().min(0),
  distanceNm: z.number().min(0),
  landingVsFpm: z.number(),
  revenue: z.number().default(0),
  fuelCost: z.number().default(0),
  landingFee: z.number().default(0),
  netResult: z.number().default(0),
  companyId: z.string(),
  aircraftId: z.string().optional(),
})

export type CreateFlightInput = z.infer<typeof CreateFlightSchema>

export async function getAllFlights(prisma: PrismaClient, userId: string, limit = 50) {
  const company = await prisma.company.findFirstOrThrow({ where: { userId } })
  return prisma.flight.findMany({
    where: { companyId: company.id },
    orderBy: { createdAt: 'desc' },
    take: limit,
    include: { aircraft: true },
  })
}

export async function getFlightById(prisma: PrismaClient, id: string) {
  return prisma.flight.findUnique({
    where: { id },
    include: { aircraft: true },
  })
}

export async function createFlight(prisma: PrismaClient, userId: string, data: CreateFlightInput) {
  const validated = CreateFlightSchema.parse(data)
  // Verify the company belongs to this user
  await prisma.company.findFirstOrThrow({ where: { userId, id: validated.companyId } })
  return prisma.flight.create({ data: validated })
}
