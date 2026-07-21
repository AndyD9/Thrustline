import { useSync } from '../contexts/SyncContext'

const STATUS_CONFIG = {
  idle:    { color: 'bg-emerald-400', label: 'Synced' },
  syncing: { color: 'bg-yellow-400 animate-pulse', label: 'Syncing...' },
  error:   { color: 'bg-red-400', label: 'Sync error' },
  offline: { color: 'bg-zinc-500', label: 'Offline' },
} as const

export function SyncIndicator() {
  const { status, syncNow } = useSync()
  const config = STATUS_CONFIG[status]

  return (
    <button
      onClick={syncNow}
      title={`${config.label} — click to sync now`}
      className="flex items-center gap-2 px-2 py-1 rounded hover:bg-zinc-800 transition-colors text-xs text-zinc-400"
    >
      <span className={`w-2 h-2 rounded-full ${config.color}`} />
      {config.label}
    </button>
  )
}
