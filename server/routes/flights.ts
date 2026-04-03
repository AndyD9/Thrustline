import type { FastifyInstance } from 'fastify'
import { getAllFlights, getFlightById, createFlight, CreateFlightSchema } from '../services/flights'

export async function flightRoutes(fastify: FastifyInstance) {
  fastify.get('/api/flights', async (request) => {
    const { limit } = request.query as { limit?: string }
    return getAllFlights(fastify.prisma, limit ? parseInt(limit, 10) : undefined)
  })

  fastify.get<{ Params: { id: string } }>('/api/flights/:id', async (request, reply) => {
    const flight = await getFlightById(fastify.prisma, request.params.id)
    if (!flight) {
      return reply.status(404).send({ error: 'Flight not found', code: 'NOT_FOUND' })
    }
    return flight
  })

  fastify.post('/api/flights', async (request, reply) => {
    const parsed = CreateFlightSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.message, code: 'VALIDATION_ERROR' })
    }
    const flight = await createFlight(fastify.prisma, parsed.data)
    return reply.status(201).send(flight)
  })
}
