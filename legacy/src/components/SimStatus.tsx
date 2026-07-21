import { useSim } from '../contexts/SimContext'

export function SimStatus() {
  const { simStatus } = useSim()

  const isConnected = simStatus === 'connected' || simStatus === 'mock'
  const label = simStatus === 'mock' ? 'Mock' : simStatus === 'connected' ? 'Connected' : 'Disconnected'

  return (
    <div className="flex items-center gap-2 text-sm">
      <div
        className={`h-2.5 w-2.5 rounded-full ${
          isConnected ? 'bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.5)]' : 'bg-red-500'
        }`}
      />
      <span className="text-gray-400">SimConnect: {label}</span>
    </div>
  )
}
