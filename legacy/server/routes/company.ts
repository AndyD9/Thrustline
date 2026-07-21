import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { getAllReputations, getCompanyReputation } from '../services/reputation'
import {
  getCompany,
  getFleet,
  getTransactions,
  leaseAircraft,
  purchaseAircraft,
  sellAircraft,
  resaleValue,
  maintainAircraft,
  maintenanceCost,
  AIRCRAFT_CATALOG,
  LOAN_OPTIONS,
  updateCompany,
  setActiveAircraft,
  resetCompanyData,
  setupCompany,
  getActiveLoan,
} from '../services/company'

const UpdateCompanyBody = z.object({
  name:            z.string().min(1).max(60).optional(),
  hubIcao:         z.string().min(3).max(4).toUpperCase().optional(),
  airlineCode:     z.string().min(2).max(3).toUpperCase().optional(),
  simbriefUsername:z.string().max(64).optional(),
})

const LeaseBody  = z.object({ icaoType: z.string().min(2) })
const MaintainParams = z.object({ id: z.string().min(1) })

export async function companyRoutes(fastify: FastifyInstance) {
  // ── Reads ──────────────────────────────────────────────────────────────

  fastify.get('/api/company', async (request, _reply) => {
    const company = await getCompany(fastify.prisma, request.userId)
    if (!company) return { onboarded: false }
    return company
  })

  fastify.get('/api/fleet', async (request) => {
    return getFleet(fastify.prisma, request.userId)
  })

  fastify.get('/api/transactions', async (request) => {
    const { limit } = request.query as { limit?: string }
    return getTransactions(fastify.prisma, request.userId, limit ? parseInt(limit, 10) : undefined)
  })

  // Return the static catalog so the UI can display lease options
  fastify.get('/api/catalog', async () => {
    return AIRCRAFT_CATALOG
  })

  // ── Onboarding ─────────────────────────────────────────────────────────

  // GET /api/company/loan-options — available loan presets
  fastify.get('/api/company/loan-options', async () => {
    return LOAN_OPTIONS.map((l) => {
      const r = l.rate / 12
      const monthly = r === 0
        ? l.principal / l.totalMonths
        : Math.round((l.principal * r / (1 - Math.pow(1 + r, -l.totalMonths))) * 100) / 100
      return { ...l, monthlyPayment: monthly }
    })
  })

  // POST /api/company/setup — onboarding: create company + loan + optional aircraft
  fastify.post('/api/company/setup', async (request, reply) => {
    const SetupBody = z.object({
      name:              z.string().min(1).max(60),
      airlineCode:       z.string().min(2).max(3),
      hubIcao:           z.string().min(3).max(4),
      loanOption:        z.enum(['conservative', 'standard', 'aggressive']),
      aircraftIcaoType:  z.string().optional(),
      aircraftMode:      z.enum(['lease', 'buy']).optional(),
      simbriefUsername:   z.string().max(64).optional(),
    })
    const parsed = SetupBody.safeParse(request.body)
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten() })
    try {
      const company = await setupCompany(fastify.prisma, request.userId, parsed.data)
      return reply.status(201).send(company)
    } catch (err: unknown) {
      return reply.status(400).send({ error: err instanceof Error ? err.message : String(err) })
    }
  })

  // GET /api/company/loan — current loan state (null if no company or no loan)
  fastify.get('/api/company/loan', async (request) => {
    return await getActiveLoan(fastify.prisma, request.userId) ?? null
  })

  // ── Actions ────────────────────────────────────────────────────────────

  // POST /api/fleet  { icaoType }  → lease a new aircraft (deducts first month)
  fastify.post('/api/fleet', async (request, reply) => {
    const parsed = LeaseBody.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() })
    }
    try {
      const aircraft = await leaseAircraft(fastify.prisma, request.userId, parsed.data.icaoType)
      return reply.status(201).send(aircraft)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      return reply.status(400).send({ error: msg })
    }
  })

  // POST /api/fleet/:id/maintain  → restore aircraft to 100 % health
  fastify.post('/api/fleet/:id/maintain', async (request, reply) => {
    const parsed = MaintainParams.safeParse(request.params)
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Invalid aircraft id' })
    }
    try {
      const result = await maintainAircraft(fastify.prisma, request.userId, parsed.data.id)
      return result
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      return reply.status(400).send({ error: msg })
    }
  })

  // PATCH /api/company  { name?, hubIcao? }
  fastify.patch('/api/company', async (request, reply) => {
    const parsed = UpdateCompanyBody.safeParse(request.body)
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten() })
    try {
      return await updateCompany(fastify.prisma, request.userId, parsed.data)
    } catch (err: unknown) {
      return reply.status(400).send({ error: err instanceof Error ? err.message : String(err) })
    }
  })

  // PATCH /api/fleet/:id/activate  → set active aircraft
  fastify.patch('/api/fleet/:id/activate', async (request, reply) => {
    const { id } = request.params as { id: string }
    try {
      await setActiveAircraft(fastify.prisma, request.userId, id)
      return reply.status(204).send()
    } catch (err: unknown) {
      return reply.status(400).send({ error: err instanceof Error ? err.message : String(err) })
    }
  })

  // POST /api/company/reset  → wipe flights/transactions/routes, reset capital
  fastify.post('/api/company/reset', async (request, reply) => {
    try {
      await resetCompanyData(fastify.prisma, request.userId)
      return reply.status(204).send()
    } catch (err: unknown) {
      return reply.status(500).send({ error: err instanceof Error ? err.message : String(err) })
    }
  })

  // GET /api/fleet/:id/maintain-cost  → preview cost without acting
  fastify.get('/api/fleet/:id/maintain-cost', async (request, reply) => {
    const { id } = request.params as { id: string }
    const aircraft = await fastify.prisma.aircraft.findUnique({ where: { id } })
    if (!aircraft) return reply.status(404).send({ error: 'Aircraft not found' })
    return { cost: maintenanceCost(aircraft.healthPct), healthPct: aircraft.healthPct }
  })

  // ── Purchase (buy outright) ───────────────────────────────────────────

  // POST /api/fleet/buy  { icaoType }  → purchase aircraft (deducts full price)
  fastify.post('/api/fleet/buy', async (request, reply) => {
    const parsed = LeaseBody.safeParse(request.body)
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten() })
    try {
      const aircraft = await purchaseAircraft(fastify.prisma, request.userId, parsed.data.icaoType)
      return reply.status(201).send(aircraft)
    } catch (err: unknown) {
      return reply.status(400).send({ error: err instanceof Error ? err.message : String(err) })
    }
  })

  // POST /api/fleet/:id/sell  → sell an owned aircraft
  fastify.post('/api/fleet/:id/sell', async (request, reply) => {
    const { id } = request.params as { id: string }
    try {
      const result = await sellAircraft(fastify.prisma, request.userId, id)
      return result
    } catch (err: unknown) {
      return reply.status(400).send({ error: err instanceof Error ? err.message : String(err) })
    }
  })

  // GET /api/fleet/:id/resale-value  → preview sale price without acting
  fastify.get('/api/fleet/:id/resale-value', async (request, reply) => {
    const { id } = request.params as { id: string }
    const aircraft = await fastify.prisma.aircraft.findUnique({ where: { id } })
    if (!aircraft) return reply.status(404).send({ error: 'Aircraft not found' })
    if (aircraft.ownership !== 'owned' || !aircraft.purchasePrice) {
      return reply.status(400).send({ error: 'Only owned aircraft can be sold' })
    }
    return { resaleValue: resaleValue(aircraft.purchasePrice, aircraft.healthPct), healthPct: aircraft.healthPct }
  })

  // ── Reputation ──────────────────────────────────────────────────────────

  // GET /api/reputation — all route reputations
  fastify.get('/api/reputation', async (request, reply) => {
    const company = await getCompany(fastify.prisma, request.userId)
    if (!company) return reply.status(404).send({ error: 'No company found' })
    return getAllReputations(fastify.prisma, request.userId, company.id)
  })

  // GET /api/reputation/score — company-wide average reputation
  fastify.get('/api/reputation/score', async (request, reply) => {
    const company = await getCompany(fastify.prisma, request.userId)
    if (!company) return reply.status(404).send({ error: 'No company found' })
    const score = await getCompanyReputation(fastify.prisma, request.userId, company.id)
    return { score }
  })
}
