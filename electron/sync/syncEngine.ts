import type { PrismaClient } from '../../generated/prisma/client'
import type { SupabaseClient } from '@supabase/supabase-js'

type SyncStatus = 'idle' | 'syncing' | 'error' | 'offline'

// camelCase → snake_case field mapping for Supabase
const TABLE_MAP: Record<string, string> = {
  Company:     'companies',
  Aircraft:    'aircraft',
  Flight:      'flights',
  Transaction: 'transactions',
  Route:       'routes',
  Dispatch:    'dispatches',
  CrewMember:  'crew_members',
  Loan:        'loans',
  GameEvent:   'game_events',
  Reputation:  'reputations',
}

function camelToSnake(str: string): string {
  return str.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`)
}

function toSnakeKeys(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(obj)) {
    result[camelToSnake(key)] = value
  }
  return result
}

export function createSyncEngine(prisma: PrismaClient, supabase: SupabaseClient, userId: string) {
  let status: SyncStatus = 'idle'
  let timer: ReturnType<typeof setInterval> | null = null
  let onStatusChange: ((s: SyncStatus) => void) | null = null

  function setStatus(s: SyncStatus) {
    status = s
    onStatusChange?.(s)
  }

  async function pushNow(): Promise<void> {
    if (status === 'syncing') return

    // Check connectivity
    try {
      const { error } = await supabase.from('profiles').select('id').limit(1)
      if (error) { setStatus('offline'); return }
    } catch {
      setStatus('offline')
      return
    }

    setStatus('syncing')

    try {
      const pending = await prisma.syncLog.findMany({
        where: { syncedAt: null },
        orderBy: { createdAt: 'asc' },
        take: 200,
      })

      if (pending.length === 0) {
        setStatus('idle')
        return
      }

      // Group by table for batch operations
      const grouped = new Map<string, typeof pending>()
      for (const entry of pending) {
        const list = grouped.get(entry.tableName) ?? []
        list.push(entry)
        grouped.set(entry.tableName, list)
      }

      for (const [tableName, entries] of grouped) {
        const supabaseTable = TABLE_MAP[tableName]
        if (!supabaseTable) continue

        // Handle deletes
        const deletes = entries.filter((e) => e.action === 'delete')
        if (deletes.length > 0) {
          const ids = deletes.map((e) => e.recordId)
          await supabase.from(supabaseTable).delete().in('id', ids)
        }

        // Handle creates and updates (upsert)
        const upserts = entries.filter((e) => e.action !== 'delete' && e.payload)
        if (upserts.length > 0) {
          const BATCH_SIZE = 50
          for (let i = 0; i < upserts.length; i += BATCH_SIZE) {
            const batch = upserts.slice(i, i + BATCH_SIZE)
            const rows = batch.map((e) => {
              const data = JSON.parse(e.payload!)
              const snakeData = toSnakeKeys(data)
              snakeData.user_id = userId
              return snakeData
            })
            await supabase.from(supabaseTable).upsert(rows, { onConflict: 'id' })
          }
        }

        // Mark as synced
        const ids = entries.map((e) => e.id)
        await prisma.syncLog.updateMany({
          where: { id: { in: ids } },
          data: { syncedAt: new Date() },
        })
      }

      // Update syncedAt on the local records
      const now = new Date()
      for (const entry of pending) {
        if (entry.action === 'delete') continue
        try {
          const model = (prisma as any)[entry.tableName.charAt(0).toLowerCase() + entry.tableName.slice(1)]
          if (model?.update) {
            await model.update({
              where: { id: entry.recordId },
              data: { syncedAt: now },
            })
          }
        } catch {
          // Record may have been deleted locally — ignore
        }
      }

      setStatus('idle')
    } catch (err) {
      console.error('[Sync] Push failed:', err)
      setStatus('error')
    }
  }

  async function pullOnStartup(): Promise<void> {
    setStatus('syncing')

    try {
      for (const [prismaModel, supabaseTable] of Object.entries(TABLE_MAP)) {
        // Get the latest syncedAt from local
        const modelKey = prismaModel.charAt(0).toLowerCase() + prismaModel.slice(1)
        const model = (prisma as any)[modelKey]
        if (!model?.findFirst) continue

        const latest = await model.findFirst({
          where: { syncedAt: { not: null } },
          orderBy: { syncedAt: 'desc' },
          select: { syncedAt: true },
        })

        const since = latest?.syncedAt ?? new Date(0)

        // Pull records updated after our last sync
        const { data, error } = await supabase
          .from(supabaseTable)
          .select('*')
          .gt('updated_at', since.toISOString())
          .order('updated_at', { ascending: true })
          .limit(500)

        if (error || !data?.length) continue

        // Upsert into local DB
        for (const row of data) {
          const camelData = snakeToCamelKeys(row)
          camelData.syncedAt = new Date()
          delete camelData.userId // userId is stored as user_id in cloud
          try {
            await model.upsert({
              where: { id: camelData.id },
              create: camelData,
              update: camelData,
            })
          } catch {
            // Schema mismatch or constraint violation — skip
          }
        }
      }

      setStatus('idle')
    } catch (err) {
      console.error('[Sync] Pull failed:', err)
      setStatus('error')
    }
  }

  function start() {
    if (timer) return
    timer = setInterval(() => pushNow().catch(console.error), 60_000)
  }

  function stop() {
    if (timer) {
      clearInterval(timer)
      timer = null
    }
  }

  function getStatus(): SyncStatus {
    return status
  }

  function onStatus(cb: (s: SyncStatus) => void) {
    onStatusChange = cb
  }

  return { start, stop, pushNow, pullOnStartup, getStatus, onStatus }
}

function snakeToCamelKeys(obj: Record<string, unknown>): Record<string, any> {
  const result: Record<string, any> = {}
  for (const [key, value] of Object.entries(obj)) {
    const camelKey = key.replace(/_([a-z])/g, (_, c) => c.toUpperCase())
    result[camelKey] = value
  }
  return result
}
