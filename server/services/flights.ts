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

export async function getAllFlights(prisma: PrismaClient, limit = 50) {
  return prisma.flight.findMany({
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

export async function createFlight(prisma: PrismaClient, data: CreateFlightInput) {
  const validated = CreateFlightSchema.parse(data)
  return prisma.flight.create({ data: validated })
}
