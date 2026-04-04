import { createClient, type SupabaseClient, type Session } from '@supabase/supabase-js'

// In-memory storage adapter for Node.js (Electron main process)
class NodeStorageAdapter {
  private store = new Map<string, string>()

  getItem(key: string): string | null {
    return this.store.get(key) ?? null
  }

  setItem(key: string, value: string): void {
    this.store.set(key, value)
  }

  removeItem(key: string): void {
    this.store.delete(key)
  }
}

let client: SupabaseClient | null = null

export function getSupabaseClient(): SupabaseClient {
  if (client) return client

  // __SUPABASE_URL__ and __SUPABASE_ANON_KEY__ are injected by Vite's define at build time
  const url = __SUPABASE_URL__
  const anonKey = __SUPABASE_ANON_KEY__

  if (!url || !anonKey) {
    throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in env')
  }

  client = createClient(url, anonKey, {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
      storage: new NodeStorageAdapter(),
    },
  })

  return client
}

export async function setSessionFromTokens(accessToken: string, refreshToken: string): Promise<Session | null> {
  const sb = getSupabaseClient()
  const { data, error } = await sb.auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken,
  })
  if (error) throw error
  return data.session
}
