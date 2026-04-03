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

declare module 'fastify' {
  interface FastifyInstance {
    prisma: PrismaClient
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
