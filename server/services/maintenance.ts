/**
 * MaintenanceEngine — calcule l'usure de l'avion après chaque vol,
 * crée les Transactions de maintenance si nécessaire.
 */
import type { PrismaClient, Prisma } from '../../generated/prisma/client'

// Usure par heure de vol (%)
const WEAR_PER_FLIGHT_HOUR = 0.1

// Pénalité hard landing (VS < -600 fpm)
const HARD_LANDING_PENALTY = 2

// Coûts de maintenance
const LIGHT_MAINTENANCE_COST = 5_000   // USD
const HEAVY_MAINTENANCE_COST = 40_000  // USD

export interface MaintenanceResult {
  newHealthPct:    number
  isHardLanding:   boolean
  lightMaintenance: boolean
  heavyMaintenance: boolean
  grounded:        boolean
}

export function computeWear(
  currentHealthPct: number,
  durationMin:      number,
  landingVsFpm:     number,
): MaintenanceResult {
  const isHardLanding = landingVsFpm < -600

  let newHealthPct = currentHealthPct
  newHealthPct -= (durationMin / 60) * WEAR_PER_FLIGHT_HOUR
  if (isHardLanding) newHealthPct -= HARD_LANDING_PENALTY
  newHealthPct = Math.max(0, Math.round(newHealthPct * 100) / 100)

  return {
    newHealthPct,
    isHardLanding,
    lightMaintenance:  newHealthPct < 80 && currentHealthPct >= 80,
    heavyMaintenance:  newHealthPct < 50 && currentHealthPct >= 50,
    grounded:          newHealthPct < 50,
  }
}

export interface ApplyMaintenanceParams {
  prisma:       PrismaClient
  aircraftId:   string
  companyId:    string
  flightId:     string
  result:       MaintenanceResult
}

export async function applyMaintenance(params: ApplyMaintenanceParams): Promise<void> {
  const { prisma, aircraftId, companyId, flightId, result } = params

  const ops: Prisma.PrismaPromise<unknown>[] = [
    // Mise à jour santé + compteurs
    prisma.aircraft.update({
      where: { id: aircraftId },
      data:  { healthPct: result.newHealthPct },
    }),
  ]

  if (result.lightMaintenance) {
    ops.push(
      prisma.transaction.create({
        data: {
          type:        'maintenance',
          amount:      -LIGHT_MAINTENANCE_COST,
          description: 'Light maintenance check (health < 80%)',
          flightId,
          companyId,
        },
      }),
      prisma.company.update({
        where: { id: companyId },
        data:  { capital: { decrement: LIGHT_MAINTENANCE_COST } },
      }),
    )
  }

  if (result.heavyMaintenance) {
    ops.push(
      prisma.transaction.create({
        data: {
          type:        'maintenance',
          amount:      -HEAVY_MAINTENANCE_COST,
          description: 'Heavy maintenance required (health < 50%) — aircraft grounded',
          flightId,
          companyId,
        },
      }),
      prisma.company.update({
        where: { id: companyId },
        data:  { capital: { decrement: HEAVY_MAINTENANCE_COST } },
      }),
    )
  }

  await prisma.$transaction(ops)
}
