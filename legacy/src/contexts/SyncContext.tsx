import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'

type SyncStatus = 'idle' | 'syncing' | 'error' | 'offline'

interface SyncContextValue {
  status: SyncStatus
  syncNow: () => void
}

const SyncContext = createContext<SyncContextValue | null>(null)

export function SyncProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<SyncStatus>('idle')

  useEffect(() => {
    if (!window.thrustline.onSyncStatus) return
    window.thrustline.onSyncStatus((s: SyncStatus) => setStatus(s))
  }, [])

  function syncNow() {
    window.thrustline.syncNow?.()
  }

  return (
    <SyncContext.Provider value={{ status, syncNow }}>
      {children}
    </SyncContext.Provider>
  )
}

export function useSync() {
  const ctx = useContext(SyncContext)
  if (!ctx) throw new Error('useSync must be used within SyncProvider')
  return ctx
}
