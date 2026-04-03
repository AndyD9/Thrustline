import Fastify from 'fastify'
import cors from '@fastify/cors'
import { PrismaClient } from '@prisma/client'
import { flightRoutes } from './routes/flights'
import { companyRoutes } from './routes/company'
import { routeRoutes } from './routes/routes'
import { dispatchRoutes } from './routes/dispatch'
import { airportRoutes } from './routes/airports'
import { crewRoutes } from './routes/crew'
import { eventRoutes } from './routes/events'
import { authMiddleware } from './middleware/auth'

declare module 'fastify' {
  interface FastifyInstance {
    prisma: PrismaClient
  }
  interface FastifyRequest {
    userId: string
  }
}

export async function createServer() {
  const prisma = new PrismaClient()
  const fastify = Fastify({ logger: false })

  await fastify.register(cors, {
    origin:  true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  })

  fastify.decorate('prisma', prisma)

  // Auth middleware — sets request.userId on every request
  await fastify.register(authMiddleware)

  await fastify.register(flightRoutes)
  await fastify.register(companyRoutes)
  await fastify.register(routeRoutes)
  await fastify.register(dispatchRoutes)
  await fastify.register(airportRoutes)
  await fastify.register(crewRoutes)
  await fastify.register(eventRoutes)

  fastify.addHook('onClose', async () => {
    await prisma.$disconnect()
  })

  return { fastify, prisma }
}
