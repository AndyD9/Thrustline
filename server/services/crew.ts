import type { PrismaClient } from '@prisma/client'

// ── Constants ────────────────────────────────────────────────────────────

const CREW_POOL_SIZE = 8

const BASE_SALARY: Record<string, number> = {
  captain:       8_000,
  first_officer: 5_000,
}

// Salary = base × (1 + experience × 0.1)
function computeSalary(rank: string, experience: number): number {
  const base = BASE_SALARY[rank] ?? BASE_SALARY.first_officer
  return Math.round(base * (1 + experience * 0.1))
}

// ── Name generation ──────────────────────────────────────────────────────

const FIRST_NAMES = [
  'James', 'Sarah', 'Michael', 'Emma', 'David', 'Olivia', 'Daniel', 'Sophie',
  'Thomas', 'Laura', 'Alexandre', 'Marie', 'Lucas', 'Isabelle', 'Matteo', 'Chloé',
  'William', 'Charlotte', 'Benjamin', 'Amelia', 'Henrik', 'Astrid', 'Carlos', 'Elena',
  'Kenji', 'Yuki', 'Raj', 'Priya', 'Ahmed', 'Fatima', 'Chen', 'Mei',
]

const LAST_NAMES = [
  'Anderson', 'Baker', 'Chen', 'Dubois', 'Evans', 'Fischer', 'Garcia', 'Hughes',
  'Ibrahim', 'Jensen', 'Kim', 'Laurent', 'Müller', 'Nakamura', 'O\'Brien', 'Petrov',
  'Quinn', 'Rossi', 'Schmidt', 'Torres', 'Underwood', 'Varga', 'Williams', 'Xu',
  'Yamamoto', 'Zimmerman', 'Patel', 'Singh', 'Johansson', 'Hernandez', 'Kowalski', 'Nguyen',
]

function randomFrom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

// ── Crew pool (candidates for hiring) ────────────────────────────────────

export interface CrewCandidate {
  firstName:  string
  lastName:   string
  rank:       string
  experience: number
  salaryMo:   number
}

export function generateCrewPool(): CrewCandidate[] {
  const pool: CrewCandidate[] = []
  for (let i = 0; i < CREW_POOL_SIZE; i++) {
    const rank       = i < 3 ? 'captain' : 'first_officer'
    const experience = Math.floor(Math.random() * 9) + 1  // 1–9
    pool.push({
      firstName:  randomFrom(FIRST_NAMES),
      lastName:   randomFrom(LAST_NAMES),
      rank,
      experience,
      salaryMo:   computeSalary(rank, experience),
    })
  }
  return pool
}

// ── CRUD ─────────────────────────────────────────────────────────────────

export async function getCrew(prisma: PrismaClient) {
  return prisma.crewMember.findMany({
    orderBy: [{ aircraftId: 'asc' }, { rank: 'asc' }, { lastName: 'asc' }],
    include: { aircraft: { select: { id: true, name: true, icaoType: true } } },
  })
}

export async function getCrewForAircraft(prisma: PrismaClient, aircraftId: string) {
  return prisma.crewMember.findMany({
    where: { aircraftId },
    orderBy: { rank: 'asc' },
  })
}

export async function hireCrew(prisma: PrismaClient, candidate: CrewCandidate) {
  const company = await prisma.company.findFirstOrThrow()

  if (company.capital < candidate.salaryMo) {
    throw new Error(`Insufficient capital for first month salary ($${candidate.salaryMo.toLocaleString()}).`)
  }

  const [member] = await prisma.$transaction([
    prisma.crewMember.create({
      data: {
        firstName:  candidate.firstName,
        lastName:   candidate.lastName,
        rank:       candidate.rank,
        experience: candidate.experience,
        salaryMo:   candidate.salaryMo,
        companyId:  company.id,
      },
    }),
    prisma.transaction.create({
      data: {
        type:        'salary',
        amount:      -candidate.salaryMo,
        description: `First month salary — ${candidate.rank === 'captain' ? 'Cpt' : 'FO'} ${candidate.firstName} ${candidate.lastName}`,
        companyId:   company.id,
      },
    }),
    prisma.company.update({
      where: { id: company.id },
      data:  { capital: { decrement: candidate.salaryMo } },
    }),
  ])

  return member
}

export async function fireCrew(prisma: PrismaClient, crewId: string) {
  const member = await prisma.crewMember.findUniqueOrThrow({ where: { id: crewId } })
  await prisma.crewMember.delete({ where: { id: crewId } })
  return member
}

export async function assignCrew(prisma: PrismaClient, crewId: string, aircraftId: string) {
  // Verify aircraft exists and belongs to the same company
  const member   = await prisma.crewMember.findUniqueOrThrow({ where: { id: crewId } })
  const aircraft = await prisma.aircraft.findUniqueOrThrow({ where: { id: aircraftId } })
  if (member.companyId !== aircraft.companyId) {
    throw new Error('Crew member and aircraft belong to different companies.')
  }
  return prisma.crewMember.update({
    where: { id: crewId },
    data:  { aircraftId },
    include: { aircraft: { select: { id: true, name: true, icaoType: true } } },
  })
}

export async function unassignCrew(prisma: PrismaClient, crewId: string) {
  return prisma.crewMember.update({
    where: { id: crewId },
    data:  { aircraftId: null },
    include: { aircraft: { select: { id: true, name: true, icaoType: true } } },
  })
}

// ── Duty hours (called after each flight) ────────────────────────────────

export async function addDutyHours(prisma: PrismaClient, aircraftId: string, hours: number) {
  await prisma.crewMember.updateMany({
    where: { aircraftId },
    data:  { dutyHours: { increment: hours } },
  })
}

// ── Monthly salary deduction (called by Electron interval) ───────────────

export async function deductMonthlySalaries(prisma: PrismaClient) {
  const company = await prisma.company.findFirstOrThrow({
    include: { crew: true },
  })
  if (company.crew.length === 0) return

  const totalSalary = company.crew.reduce((s, c) => s + c.salaryMo, 0)

  await prisma.$transaction([
    ...company.crew.map((member) =>
      prisma.transaction.create({
        data: {
          type:        'salary',
          amount:      -member.salaryMo,
          description: `Monthly salary — ${member.rank === 'captain' ? 'Cpt' : 'FO'} ${member.firstName} ${member.lastName}`,
          companyId:   company.id,
        },
      }),
    ),
    // Reset duty hours for the new month
    prisma.crewMember.updateMany({
      where: { companyId: company.id },
      data:  { dutyHours: 0 },
    }),
    prisma.company.update({
      where: { id: company.id },
      data:  { capital: { decrement: totalSalary } },
    }),
  ])

  console.log(`[Thrustline] Monthly salaries deducted: $${totalSalary.toLocaleString()} (${company.crew.length} crew)`)
}
