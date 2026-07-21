import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'
import type { AuthSession, AuthUser } from '../types/thrustline'

interface AuthContextValue {
  user: AuthUser | null
  session: AuthSession | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<string | null>
  signUp: (email: string, password: string) => Promise<string | null>
  signInOAuth: (provider: 'discord' | 'google') => Promise<string | null>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [session, setSession] = useState<AuthSession | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Restore session on mount
    window.thrustline.getSession().then((s) => {
      if (s) {
        setSession(s)
        setUser(s.user)
      }
      setLoading(false)
    })

    // Listen for auth changes (OAuth callback, sign out, etc.)
    window.thrustline.onAuthChange((s) => {
      setSession(s)
      setUser(s?.user ?? null)
    })
  }, [])

  async function signIn(email: string, password: string): Promise<string | null> {
    const result = await window.thrustline.signIn(email, password)
    if (result.error) return result.error
    if (result.session) {
      setSession(result.session)
      setUser(result.session.user)
    }
    return null
  }

  async function signUp(email: string, password: string): Promise<string | null> {
    const result = await window.thrustline.signUp(email, password)
    if (result.error) return result.error
    if (result.session) {
      setSession(result.session)
      setUser(result.session.user)
    }
    return null
  }

  async function signInOAuth(provider: 'discord' | 'google'): Promise<string | null> {
    const result = await window.thrustline.signInOAuth(provider)
    if (result.error) return result.error
    return null
  }

  async function signOut() {
    await window.thrustline.signOut()
    setUser(null)
    setSession(null)
  }

  return (
    <AuthContext.Provider value={{ user, session, loading, signIn, signUp, signInOAuth, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
