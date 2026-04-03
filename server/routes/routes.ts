import type { FastifyInstance } from 'fastify'
import {
  getDiscoveredRoutes,
  getSavedRoutes,
  createRoute,
  deleteRoute,
  CreateRouteSchema,
} from '../services/routes'

export async function routeRoutes(fastify: FastifyInstance) {
  // GET /api/routes/discovered — aggregated from flight history
  fastify.get('/api/routes/discovered', async () => {
    return getDiscoveredRoutes(fastify.prisma)
  })

  // GET /api/routes — user-saved routes
  fastify.get('/api/routes', async () => {
    return getSavedRoutes(fastify.prisma)
  })

  // POST /api/routes { originIcao, destIcao }
  fastify.post('/api/routes', async (request, reply) => {
    const parsed = CreateRouteSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() })
    }
    try {
      const route = await createRoute(fastify.prisma, parsed.data)
      return reply.status(201).send(route)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      return reply.status(400).send({ error: msg })
    }
  })

  // DELETE /api/routes/:id — soft-delete
  fastify.delete('/api/routes/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    try {
      await deleteRoute(fastify.prisma, id)
      return reply.status(204).send()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      return reply.status(400).send({ error: msg })
    }
  })
}
