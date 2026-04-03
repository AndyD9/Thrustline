import type { PrismaClient } from '@prisma/client'

// Coût de maintenance : 500$ par point de santé à récupérer
const MAINTENANCE_COST_PER_PCT = 500

// ── Aircraft catalog ─────────────────────────────────────────────────────
// Single source of truth for all aircraft specs used across the app
// (yield, dispatch, fleet UI, leasing).

export interface AircraftCatalogEntry {
  name:          string
  icaoType:      string
  category:      'regional' | 'narrowbody' | 'widebody'
  leaseCostMo:   number
  purchasePrice: number   // outright purchase price (≈ 20× lease)
  seatsEco:      number
  seatsBiz:      number
  rangeNm:       number
  cruiseKtas:    number
  fuelBurnGalH:  number   // gallons per hour at cruise
  fuelLbsPerNm:  number   // lbs fuel per nautical mile (for dispatch estimates)
  mtowLbs:       number
}

export const AIRCRAFT_CATALOG: AircraftCatalogEntry[] = [
  // ── Regional / Turboprop ──────────────────────────────────────────────
  { name: 'ATR 72-600',          icaoType: 'AT76', category: 'regional',   leaseCostMo:  15_000, purchasePrice:    300_000, seatsEco:  68, seatsBiz:  0, rangeNm:  825, cruiseKtas: 275, fuelBurnGalH:  240, fuelLbsPerNm: 18, mtowLbs:  50_700 },
  { name: 'Embraer E175',       icaoType: 'E175', category: 'regional',   leaseCostMo:  22_000, purchasePrice:    440_000, seatsEco:  72, seatsBiz: 12, rangeNm: 2000, cruiseKtas: 470, fuelBurnGalH:  450, fuelLbsPerNm: 25, mtowLbs:  82_700 },
  { name: 'Embraer E190',       icaoType: 'E190', category: 'regional',   leaseCostMo:  28_000, purchasePrice:    560_000, seatsEco:  88, seatsBiz: 12, rangeNm: 2450, cruiseKtas: 470, fuelBurnGalH:  500, fuelLbsPerNm: 28, mtowLbs: 105_400 },

  // ── Narrowbody ────────────────────────────────────────────────────────
  { name: 'Airbus A319neo',     icaoType: 'A19N', category: 'narrowbody', leaseCostMo:  35_000, purchasePrice:    700_000, seatsEco: 120, seatsBiz:  8, rangeNm: 3700, cruiseKtas: 450, fuelBurnGalH:  600, fuelLbsPerNm: 38, mtowLbs: 166_500 },
  { name: 'Airbus A320neo',     icaoType: 'A20N', category: 'narrowbody', leaseCostMo:  42_000, purchasePrice:    840_000, seatsEco: 150, seatsBiz: 15, rangeNm: 3400, cruiseKtas: 450, fuelBurnGalH:  650, fuelLbsPerNm: 40, mtowLbs: 174_200 },
  { name: 'Airbus A321neo',     icaoType: 'A21N', category: 'narrowbody', leaseCostMo:  52_000, purchasePrice:  1_040_000, seatsEco: 182, seatsBiz: 20, rangeNm: 4000, cruiseKtas: 450, fuelBurnGalH:  720, fuelLbsPerNm: 47, mtowLbs: 213_800 },
  { name: 'Boeing 737-800',     icaoType: 'B738', category: 'narrowbody', leaseCostMo:  45_000, purchasePrice:    900_000, seatsEco: 150, seatsBiz: 12, rangeNm: 2935, cruiseKtas: 453, fuelBurnGalH:  850, fuelLbsPerNm: 45, mtowLbs: 174_200 },
  { name: 'Boeing 737 MAX 8',   icaoType: 'B38M', category: 'narrowbody', leaseCostMo:  48_000, purchasePrice:    960_000, seatsEco: 162, seatsBiz: 12, rangeNm: 3550, cruiseKtas: 453, fuelBurnGalH:  720, fuelLbsPerNm: 42, mtowLbs: 182_200 },

  // ── Widebody ──────────────────────────────────────────────────────────
  { name: 'Airbus A330-300',    icaoType: 'A333', category: 'widebody',   leaseCostMo:  85_000, purchasePrice:  1_700_000, seatsEco: 277, seatsBiz: 30, rangeNm: 6350, cruiseKtas: 470, fuelBurnGalH: 1650, fuelLbsPerNm: 125, mtowLbs: 513_700 },
  { name: 'Airbus A330-900neo', icaoType: 'A339', category: 'widebody',   leaseCostMo:  92_000, purchasePrice:  1_840_000, seatsEco: 260, seatsBiz: 30, rangeNm: 7200, cruiseKtas: 470, fuelBurnGalH: 1450, fuelLbsPerNm: 110, mtowLbs: 533_500 },
  { name: 'Boeing 787-9',      icaoType: 'B789', category: 'widebody',   leaseCostMo:  95_000, purchasePrice:  1_900_000, seatsEco: 296, seatsBiz: 28, rangeNm: 7635, cruiseKtas: 488, fuelBurnGalH: 1400, fuelLbsPerNm: 105, mtowLbs: 560_000 },
  { name: 'Airbus A350-900',   icaoType: 'A359', category: 'widebody',   leaseCostMo: 115_000, purchasePrice:  2_300_000, seatsEco: 315, seatsBiz: 40, rangeNm: 8100, cruiseKtas: 488, fuelBurnGalH: 1500, fuelLbsPerNm: 115, mtowLbs: 617_300 },
  { name: 'Boeing 777-300ER',  icaoType: 'B77W', category: 'widebody',   leaseCostMo: 130_000, purchasePrice:  2_600_000, seatsEco: 350, seatsBiz: 46, rangeNm: 7370, cruiseKtas: 490, fuelBurnGalH: 2300, fuelLbsPerNm: 175, mtowLbs: 775_000 },
  { name: 'Airbus A380-800',   icaoType: 'A388', category: 'widebody',   leaseCostMo: 180_000, purchasePrice:  3_600_000, seatsEco: 500, seatsBiz: 55, rangeNm: 8000, cruiseKtas: 490, fuelBurnGalH: 2900, fuelLbsPerNm: 200, mtowLbs: 1_268_000 },
]

// Quick lookup by ICAO type code
export const CATALOG_BY_TYPE = new Map(AIRCRAFT_CATALOG.map((a) => [a.icaoType, a]))

// ── Reads ─────────────────────────────────────────────────────────────────

export async function getCompany(prisma: PrismaClient, userId: string) {
  return prisma.company.findFirst({
    where: { userId },
    include: {
      fleet: true,
      _count: { select: { flights: true } },
    },
  })
}

export async function getFleet(prisma: PrismaClient, userId: string) {
  const company = await prisma.company.findFirstOrThrow({ where: { userId } })
  return prisma.aircraft.findMany({
    where: { companyId: company.id },
    orderBy: { name: 'asc' },
    include: { _count: { select: { flights: true } } },
  })
}

export async function getTransactions(prisma: PrismaClient, userId: string, limit = 50) {
  const company = await prisma.company.findFirstOrThrow({ where: { userId } })
  return prisma.transaction.findMany({
    where: { companyId: company.id },
    orderBy: { createdAt: 'desc' },
    take: limit,
  })
}

// ── Maintenance ──────────────────────────────────────────────────────────

export function maintenanceCost(currentHealthPct: number): number {
  return Math.round((100 - currentHealthPct) * MAINTENANCE_COST_PER_PCT)
}

export async function maintainAircraft(
  prisma: PrismaClient,
  aircraftId: string,
  userId: string,
) {
  const aircraft = await prisma.aircraft.findUniqueOrThrow({ where: { id: aircraftId } })
  const company  = await prisma.company.findFirstOrThrow({ where: { userId } })
  const cost     = maintenanceCost(aircraft.healthPct)

  if (company.capital < cost) {
    throw new Error(`Insufficient capital. Need $${cost.toLocaleString()}, have $${Math.round(company.capital).toLocaleString()}.`)
  }

  await prisma.$transaction([
    prisma.aircraft.update({
      where: { id: aircraftId },
      data:  { healthPct: 100 },
    }),
    prisma.transaction.create({
      data: {
        type:        'maintenance',
        amount:      -cost,
        description: `Full maintenance — ${aircraft.name} restored to 100%`,
        companyId:   company.id,
      },
    }),
    prisma.company.update({
      where: { id: company.id },
      data:  { capital: { decrement: cost } },
    }),
  ])

  return { cost, newHealth: 100 }
}

// ── Leasing ───────────────────────────────────────────────────────────────

export async function leaseAircraft(
  prisma: PrismaClient,
  icaoType: string,
  userId: string,
) {
  const company = await prisma.company.findFirstOrThrow({ where: { userId } })
  const catalog = AIRCRAFT_CATALOG.find((a) => a.icaoType === icaoType)
  if (!catalog) throw new Error(`Unknown aircraft type: ${icaoType}`)

  if (company.capital < catalog.leaseCostMo) {
    throw new Error(`Insufficient capital for first month lease ($${catalog.leaseCostMo.toLocaleString()}).`)
  }

  const [aircraft] = await prisma.$transaction([
    prisma.aircraft.create({
      data: {
        name:        catalog.name,
        icaoType:    catalog.icaoType,
        leaseCostMo: catalog.leaseCostMo,
        companyId:   company.id,
      },
    }),
    prisma.transaction.create({
      data: {
        type:        'lease',
        amount:      -catalog.leaseCostMo,
        description: `First month lease — ${catalog.name}`,
        companyId:   company.id,
      },
    }),
    prisma.company.update({
      where: { id: company.id },
      data:  { capital: { decrement: catalog.leaseCostMo } },
    }),
  ])

  return aircraft
}

// ── Purchase (buy outright) ───────────────────────────────────────────────

const DEPRECIATION_RATE = 0.70  // resale = purchasePrice × health% × 0.70

export async function purchaseAircraft(
  prisma: PrismaClient,
  icaoType: string,
  userId: string,
) {
  const company = await prisma.company.findFirstOrThrow({ where: { userId } })
  const catalog = AIRCRAFT_CATALOG.find((a) => a.icaoType === icaoType)
  if (!catalog) throw new Error(`Unknown aircraft type: ${icaoType}`)

  if (company.capital < catalog.purchasePrice) {
    throw new Error(`Insufficient capital to purchase. Need $${catalog.purchasePrice.toLocaleString()}, have $${Math.round(company.capital).toLocaleString()}.`)
  }

  const [aircraft] = await prisma.$transaction([
    prisma.aircraft.create({
      data: {
        name:          catalog.name,
        icaoType:      catalog.icaoType,
        leaseCostMo:   0,
        ownership:     'owned',
        purchasePrice: catalog.purchasePrice,
        purchasedAt:   new Date(),
        companyId:     company.id,
      },
    }),
    prisma.transaction.create({
      data: {
        type:        'purchase',
        amount:      -catalog.purchasePrice,
        description: `Aircraft purchase — ${catalog.name}`,
        companyId:   company.id,
      },
    }),
    prisma.company.update({
      where: { id: company.id },
      data:  { capital: { decrement: catalog.purchasePrice } },
    }),
  ])

  return aircraft
}

export function resaleValue(purchasePrice: number, healthPct: number): number {
  return Math.round(purchasePrice * (healthPct / 100) * DEPRECIATION_RATE)
}

export async function sellAircraft(
  prisma: PrismaClient,
  aircraftId: string,
  userId: string,
) {
  const aircraft = await prisma.aircraft.findUniqueOrThrow({ where: { id: aircraftId } })
  if (aircraft.ownership !== 'owned') {
    throw new Error('Only owned aircraft can be sold. Return leased aircraft instead.')
  }
  if (!aircraft.purchasePrice) {
    throw new Error('Aircraft has no purchase price on record.')
  }

  const company = await prisma.company.findFirstOrThrow({ where: { userId } })
  const salePrice = resaleValue(aircraft.purchasePrice, aircraft.healthPct)

  // If this aircraft is active, unset it
  const unsetActive = company.activeAircraftId === aircraftId
    ? prisma.company.update({ where: { id: company.id }, data: { activeAircraftId: null } })
    : undefined

  await prisma.$transaction([
    // Unlink flights from this aircraft (keep flight records)
    prisma.flight.updateMany({
      where: { aircraftId },
      data:  { aircraftId: null },
    }),
    prisma.aircraft.delete({ where: { id: aircraftId } }),
    prisma.transaction.create({
      data: {
        type:        'sale',
        amount:      salePrice,
        description: `Aircraft sold — ${aircraft.name} (${Math.round(aircraft.healthPct)}% health)`,
        companyId:   company.id,
      },
    }),
    prisma.company.update({
      where: { id: company.id },
      data:  { capital: { increment: salePrice } },
    }),
    ...(unsetActive ? [unsetActive] : []),
  ])

  return { salePrice, aircraftName: aircraft.name }
}

// ── Settings ──────────────────────────────────────────────────────────────

export async function updateCompany(
  prisma: PrismaClient,
  userId: string,
  data: { name?: string; hubIcao?: string; airlineCode?: string; simbriefUsername?: string },
) {
  const company = await prisma.company.findFirstOrThrow({ where: { userId } })
  return prisma.company.update({ where: { id: company.id }, data })
}

export async function setActiveAircraft(prisma: PrismaClient, userId: string, aircraftId: string) {
  const company = await prisma.company.findFirstOrThrow({ where: { userId } })
  // Verify the aircraft belongs to this company
  await prisma.aircraft.findFirstOrThrow({ where: { id: aircraftId, companyId: company.id } })
  return prisma.company.update({
    where: { id: company.id },
    data:  { activeAircraftId: aircraftId },
  })
}

export async function resetCompanyData(prisma: PrismaClient, userId: string) {
  const company = await prisma.company.findFirstOrThrow({ where: { userId } })
  await prisma.$transaction([
    prisma.flight.deleteMany({ where: { companyId: company.id } }),
    prisma.transaction.deleteMany({ where: { companyId: company.id } }),
    prisma.route.deleteMany({ where: { companyId: company.id } }),
    prisma.company.update({
      where: { id: company.id },
      data:  { capital: 1_000_000, activeAircraftId: null },
    }),
  ])
}

// ── Monthly lease deduction (called by Electron on interval) ─────────────

export async function deductMonthlyLeases(prisma: PrismaClient, userId: string) {
  const company = await prisma.company.findFirstOrThrow({ where: { userId }, include: { fleet: true } })
  const leased  = company.fleet.filter((a) => a.ownership === 'leased')
  if (leased.length === 0) return

  const totalLease = leased.reduce((s, a) => s + a.leaseCostMo, 0)

  await prisma.$transaction([
    ...leased.map((aircraft) =>
      prisma.transaction.create({
        data: {
          type:        'lease',
          amount:      -aircraft.leaseCostMo,
          description: `Monthly lease — ${aircraft.name}`,
          companyId:   company.id,
        },
      }),
    ),
    prisma.company.update({
      where: { id: company.id },
      data:  { capital: { decrement: totalLease } },
    }),
  ])

  console.log(`[Thrustline] Monthly lease deducted: $${totalLease.toLocaleString()} (${leased.length} leased aircraft)`)
}

// ── Onboarding setup ─────────────────────────────────────────────────────

export const LOAN_OPTIONS = [
  { key: 'conservative', label: 'Conservative', principal: 5_000_000,  totalMonths: 60, rate: 0.03 },
  { key: 'standard',     label: 'Standard',     principal: 10_000_000, totalMonths: 60, rate: 0.03 },
  { key: 'aggressive',   label: 'Aggressive',   principal: 20_000_000, totalMonths: 60, rate: 0.03 },
] as const

export type LoanOptionKey = (typeof LOAN_OPTIONS)[number]['key']

function computeMonthlyPayment(principal: number, annualRate: number, months: number): number {
  const r = annualRate / 12
  if (r === 0) return principal / months
  return Math.round((principal * r / (1 - Math.pow(1 + r, -months))) * 100) / 100
}

export interface SetupCompanyInput {
  name:              string
  airlineCode:       string
  hubIcao:           string
  loanOption:        LoanOptionKey
  aircraftIcaoType?: string
  aircraftMode?:     'lease' | 'buy'
  simbriefUsername?:  string
}

export async function setupCompany(prisma: PrismaClient, userId: string, input: SetupCompanyInput) {
  // Prevent double setup
  const existing = await prisma.company.findFirst({ where: { userId } })
  if (existing?.onboarded) throw new Error('Company already set up.')

  const loan = LOAN_OPTIONS.find((l) => l.key === input.loanOption)
  if (!loan) throw new Error(`Invalid loan option: ${input.loanOption}`)

  const monthlyPayment = computeMonthlyPayment(loan.principal, loan.rate, loan.totalMonths)
  let capital = loan.principal

  // If existing un-onboarded company, delete it first
  if (existing) {
    await prisma.$transaction([
      prisma.flight.deleteMany({ where: { companyId: existing.id } }),
      prisma.transaction.deleteMany({ where: { companyId: existing.id } }),
      prisma.route.deleteMany({ where: { companyId: existing.id } }),
      prisma.aircraft.deleteMany({ where: { companyId: existing.id } }),
      prisma.crewMember.deleteMany({ where: { companyId: existing.id } }),
      prisma.reputation.deleteMany({ where: { companyId: existing.id } }),
      prisma.gameEvent.deleteMany({ where: { companyId: existing.id } }),
      prisma.dispatch.deleteMany({ where: { companyId: existing.id } }),
      prisma.loan.deleteMany({ where: { companyId: existing.id } }),
      prisma.company.delete({ where: { id: existing.id } }),
    ])
  }

  // Create company
  const company = await prisma.company.create({
    data: {
      name:            input.name,
      airlineCode:     input.airlineCode.toUpperCase(),
      hubIcao:         input.hubIcao.toUpperCase(),
      capital,
      onboarded:       true,
      simbriefUsername: input.simbriefUsername?.trim() || null,
      userId,
    },
  })

  // Create loan
  await prisma.loan.create({
    data: {
      principal:       loan.principal,
      monthlyPayment,
      remainingAmount: loan.principal,
      totalMonths:     loan.totalMonths,
      interestRate:    loan.rate,
      companyId:       company.id,
    },
  })

  // First aircraft (optional)
  if (input.aircraftIcaoType) {
    const catalog = AIRCRAFT_CATALOG.find((a) => a.icaoType === input.aircraftIcaoType)
    if (catalog) {
      const isOwned = input.aircraftMode === 'buy'
      const cost    = isOwned ? catalog.purchasePrice : catalog.leaseCostMo

      if (capital >= cost) {
        const aircraft = await prisma.aircraft.create({
          data: {
            name:          catalog.name,
            icaoType:      catalog.icaoType,
            leaseCostMo:   isOwned ? 0 : catalog.leaseCostMo,
            ownership:     isOwned ? 'owned' : 'leased',
            purchasePrice: isOwned ? catalog.purchasePrice : null,
            purchasedAt:   isOwned ? new Date() : null,
            companyId:     company.id,
          },
        })

        capital -= cost
        await prisma.$transaction([
          prisma.transaction.create({
            data: {
              type:        isOwned ? 'purchase' : 'lease',
              amount:      -cost,
              description: isOwned
                ? `Aircraft purchase — ${catalog.name}`
                : `First month lease — ${catalog.name}`,
              companyId: company.id,
            },
          }),
          prisma.company.update({
            where: { id: company.id },
            data:  { capital, activeAircraftId: aircraft.id },
          }),
        ])
      }
    }
  }

  return prisma.company.findFirstOrThrow({
    where: { userId },
    include: { fleet: true, _count: { select: { flights: true } } },
  })
}

// ── Loan management ──────────────────────────────────────────────────────

export async function getActiveLoan(prisma: PrismaClient, userId: string) {
  const company = await prisma.company.findFirst({ where: { userId } })
  if (!company) return null
  return prisma.loan.findFirst({
    where: { companyId: company.id },
    orderBy: { createdAt: 'desc' },
  })
}

export async function deductLoanPayment(prisma: PrismaClient, userId: string) {
  const company = await prisma.company.findFirstOrThrow({ where: { userId } })
  const loan = await prisma.loan.findFirst({
    where: { companyId: company.id },
    orderBy: { createdAt: 'desc' },
  })

  if (!loan || loan.paidMonths >= loan.totalMonths) return null

  const payment = loan.monthlyPayment
  const newRemaining = Math.max(0, loan.remainingAmount - payment)
  const newPaidMonths = loan.paidMonths + 1

  await prisma.$transaction([
    prisma.loan.update({
      where: { id: loan.id },
      data: {
        remainingAmount: newRemaining,
        paidMonths:      newPaidMonths,
      },
    }),
    prisma.transaction.create({
      data: {
        type:        'loan_payment',
        amount:      -payment,
        description: `Loan payment ${newPaidMonths}/${loan.totalMonths}`,
        companyId:   company.id,
      },
    }),
    prisma.company.update({
      where: { id: company.id },
      data:  { capital: { decrement: payment } },
    }),
  ])

  console.log(`[Thrustline] Loan payment: $${payment.toLocaleString()} (${newPaidMonths}/${loan.totalMonths}, remaining $${newRemaining.toLocaleString()})`)
  return { payment, paidMonths: newPaidMonths, totalMonths: loan.totalMonths, remaining: newRemaining }
}
