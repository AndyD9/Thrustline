import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import {
  getCrew,
  generateCrewPool,
  hireCrew,
  fireCrew,
  assignCrew,
  unassignCrew,
} from '../services/crew'

const HireBody = z.object({
  firstName:  z.string().min(1),
  lastName:   z.string().min(1),
  rank:       z.enum(['captain', 'first_officer']),
  experience: z.number().int().min(1).max(10),
  salaryMo:   z.number().positive(),
})

const AssignBody = z.object({
  aircraftId: z.string().min(1),
})

export async function crewRoutes(fastify: FastifyInstance) {
  // GET /api/crew — list all crew
  fastify.get('/api/crew', async (request) => {
    return getCrew(fastify.prisma, request.userId)
  })

  // GET /api/crew/pool — generate hiring candidates
  fastify.get('/api/crew/pool', async () => {
    return generateCrewPool()
  })

  // POST /api/crew/hire — hire a candidate
  fastify.post('/api/crew/hire', async (request, reply) => {
    const parsed = HireBody.safeParse(request.body)
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten() })
    try {
      const member = await hireCrew(fastify.prisma, request.userId, parsed.data)
      return reply.status(201).send(member)
    } catch (err: unknown) {
      return reply.status(400).send({ error: err instanceof Error ? err.message : String(err) })
    }
  })

  // DELETE /api/crew/:id — fire a crew member
  fastify.delete('/api/crew/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    try {
      await fireCrew(fastify.prisma, request.userId, id)
      return reply.status(204).send()
    } catch (err: unknown) {
      return reply.status(400).send({ error: err instanceof Error ? err.message : String(err) })
    }
  })

  // PATCH /api/crew/:id/assign — assign crew to an aircraft
  fastify.patch('/api/crew/:id/assign', async (request, reply) => {
    const { id } = request.params as { id: string }
    const parsed = AssignBody.safeParse(request.body)
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten() })
    try {
      const member = await assignCrew(fastify.prisma, request.userId, id, parsed.data.aircraftId)
      return member
    } catch (err: unknown) {
      return reply.status(400).send({ error: err instanceof Error ? err.message : String(err) })
    }
  })

  // PATCH /api/crew/:id/unassign — unassign crew from aircraft
  fastify.patch('/api/crew/:id/unassign', async (request, reply) => {
    const { id } = request.params as { id: string }
    try {
      const member = await unassignCrew(fastify.prisma, request.userId, id)
      return member
    } catch (err: unknown) {
      return reply.status(400).send({ error: err instanceof Error ? err.message : String(err) })
    }
  })
}
