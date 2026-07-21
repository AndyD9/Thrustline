import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY

export async function authMiddleware(fastify: FastifyInstance) {
  if (!supabaseUrl || !supabaseAnonKey) {
    // No Supabase config → skip auth (local dev without Supabase)
    fastify.addHook('onRequest', async (request: FastifyRequest) => {
      ;(request as any).userId = 'local'
    })
    return
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey)

  fastify.addHook('onRequest', async (request: FastifyRequest, reply: FastifyReply) => {
    const authHeader = request.headers.authorization
    if (!authHeader?.startsWith('Bearer ')) {
      // No token → allow for local development (Electron direct calls)
      // In production, uncomment the line below to enforce auth:
      // return reply.code(401).send({ error: 'Missing authorization token' })
      ;(request as any).userId = 'local'
      return
    }

    const token = authHeader.slice(7)
    const { data, error } = await supabase.auth.getUser(token)

    if (error || !data.user) {
      return reply.code(401).send({ error: 'Invalid or expired token' })
    }

    ;(request as any).userId = data.user.id
  })
}
