import type { FastifyInstance } from 'fastify'
import { getActiveEvents, getEventHistory } from '../services/events'
import { getCompany } from '../services/company'

export async function eventRoutes(fastify: FastifyInstance) {
  // GET /api/events — active events
  fastify.get('/api/events', async (_request, reply) => {
    const company = await getCompany(fastify.prisma)
    if (!company) return reply.status(404).send({ error: 'No company found' })
    return getActiveEvents(fastify.prisma, company.id)
  })

  // GET /api/events/history — recent events (including expired)
  fastify.get('/api/events/history', async (request, reply) => {
    const company = await getCompany(fastify.prisma)
    if (!company) return reply.status(404).send({ error: 'No company found' })
    const { limit } = request.query as { limit?: string }
    return getEventHistory(fastify.prisma, company.id, limit ? parseInt(limit, 10) : undefined)
  })
}
