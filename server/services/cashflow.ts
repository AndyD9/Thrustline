/**
 * CashflowEngine — calcule les coûts d'un vol, crée les Transactions,
 * met à jour Company.capital.
 */
import type { PrismaClient } from '@prisma/client'

const FUEL_PRICE_PER_GAL = parseFloat(process.env.FUEL_PRICE_PER_GAL ?? '3.20')

// Landing fees par catégorie d'aéroport (USD)
const LANDING_FEES = {
  hub:    800,
  large:  400,
  medium: 150,
  small:   50,
} as const

type AirportCategory = keyof typeof LANDING_FEES

// Aéroports hub majeurs mondiaux
const HUB_AIRPORTS = new Set([
  'EGLL', 'KLAX', 'KJFK', 'KORD', 'KATL', 'KDFW', 'KDEN',
  'LFPG', 'EDDF', 'EHAM', 'LEMD', 'LIRF', 'LEBL',
  'OMDB', 'VHHH', 'RJTT', 'YSSY', 'ZBAA', 'WSSS',
  'EGKK', 'EDDM', 'UUEE',
])

// Aéroports large (trafic important mais pas hub)
const LARGE_AIRPORTS = new Set([
  'EGCC', 'EDDL', 'EDDB', 'EDDH', 'LSZH', 'LSGG',
  'KBOS', 'KIAD', 'KSFO', 'KMIA', 'KLAS', 'KSEA',
  'LTBA', 'UKBB', 'LFLL', 'LFMN', 'LPPT', 'LPPR',
  'CYYZ', 'CYVR', 'CYUL', 'YSME',
])

export function getAirportCategory(icao: string): AirportCategory {
  const code = icao.toUpperCase()
  if (HUB_AIRPORTS.has(code))   return 'hub'
  if (LARGE_AIRPORTS.has(code)) return 'large'
  // Heuristique : aéroports commençant par K/E/L/Y sont souvent medium+
  if (/^[KELY]/.test(code))     return 'medium'
  return 'small'
}

export interface CashflowResult {
  fuelCost:   number
  landingFee: number
  netResult:  number  // revenue - fuelCost - landingFee
}

export function computeCosts(
  fuelUsedGal: number,
  arrivalIcao: string,
  revenue: number,
  fuelMultiplier = 1.0,
): CashflowResult {
  const fuelCost   = Math.round(fuelUsedGal * FUEL_PRICE_PER_GAL * fuelMultiplier * 100) / 100
  const category   = getAirportCategory(arrivalIcao)
  const landingFee = LANDING_FEES[category]
  const netResult  = Math.round((revenue - fuelCost - landingFee) * 100) / 100

  return { fuelCost, landingFee, netResult }
}

export interface RecordCashflowParams {
  prisma:      PrismaClient
  companyId:   string
  flightId:    string
  fuelCost:    number
  landingFee:  number
  revenue:     number
  netResult:   number
}

export async function recordCashflow(params: RecordCashflowParams): Promise<void> {
  const { prisma, companyId, flightId, fuelCost, landingFee, revenue, netResult } = params

  await prisma.$transaction([
    // Transaction revenus
    prisma.transaction.create({
      data: {
        type:        'revenue',
        amount:      revenue,
        description: 'Ticket sales',
        flightId,
        companyId,
      },
    }),
    // Transaction carburant
    prisma.transaction.create({
      data: {
        type:        'fuel',
        amount:      -fuelCost,
        description: `Fuel cost (${(fuelCost / (parseFloat(process.env.FUEL_PRICE_PER_GAL ?? '3.20'))).toFixed(0)} gal)`,
        flightId,
        companyId,
      },
    }),
    // Transaction landing fee
    prisma.transaction.create({
      data: {
        type:        'landing_fee',
        amount:      -landingFee,
        description: 'Landing fee',
        flightId,
        companyId,
      },
    }),
    // Mise à jour capital
    prisma.company.update({
      where: { id: companyId },
      data:  { capital: { increment: netResult } },
    }),
  ])
}
