import type { FastifyInstance } from 'fastify'
import {
  createDispatch,
  getDispatches,
  deleteDispatch,
  setDispatchStatus,
  buildSimbriefUrl,
  fetchSimbriefOFP,
  CreateDispatchSchema,
} from '../services/dispatch'

export async function dispatchRoutes(fastify: FastifyInstance) {
  // GET /api/dispatches
  fastify.get('/api/dispatches', async (request) => {
    return getDispatches(fastify.prisma, request.userId)
  })

  // POST /api/dispatches  { originIcao, destIcao, distanceNm, aircraftId? }
  fastify.post('/api/dispatches', async (request, reply) => {
    const parsed = CreateDispatchSchema.safeParse(request.body)
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten() })
    try {
      const dispatch = await createDispatch(fastify.prisma, request.userId, parsed.data)
      return reply.status(201).send(dispatch)
    } catch (err: unknown) {
      return reply.status(400).send({ error: err instanceof Error ? err.message : String(err) })
    }
  })

  // DELETE /api/dispatches/:id
  fastify.delete('/api/dispatches/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    try {
      await deleteDispatch(fastify.prisma, request.userId, id)
      return reply.status(204).send()
    } catch (err: unknown) {
      return reply.status(400).send({ error: err instanceof Error ? err.message : String(err) })
    }
  })

  // PATCH /api/dispatches/:id/status  { status }
  fastify.patch('/api/dispatches/:id/status', async (request, reply) => {
    const { id }     = request.params as { id: string }
    const { status } = request.body   as { status: string }
    try {
      return await setDispatchStatus(fastify.prisma, request.userId, id, status)
    } catch (err: unknown) {
      return reply.status(400).send({ error: err instanceof Error ? err.message : String(err) })
    }
  })

  // GET /api/dispatches/:id/simbrief-url  → returns URL string
  fastify.get('/api/dispatches/:id/simbrief-url', async (request, reply) => {
    const { id }  = request.params as { id: string }
    const dispatch = await fastify.prisma.dispatch.findUnique({ where: { id } })
    if (!dispatch) return reply.status(404).send({ error: 'Dispatch not found' })

    const company = await fastify.prisma.company.findFirst()
    const url     = buildSimbriefUrl(dispatch, company?.airlineCode ?? 'THL')

    // Mark as "dispatched" when the URL is requested (user opened SimBrief)
    await setDispatchStatus(fastify.prisma, request.userId, id, 'dispatched')
    return { url }
  })

  // POST /api/dispatches/:id/fetch-ofp  → fetch OFP from SimBrief API
  fastify.post('/api/dispatches/:id/fetch-ofp', async (request, reply) => {
    const { id } = request.params as { id: string }
    const company = await fastify.prisma.company.findFirst()
    try {
      const ofp = await fetchSimbriefOFP(
        fastify.prisma,
        request.userId,
        id,
        company?.simbriefUsername ?? '',
      )
      return ofp
    } catch (err: unknown) {
      return reply.status(400).send({ error: err instanceof Error ? err.message : String(err) })
    }
  })
}
