import { useSim } from '../contexts/SimContext'

function formatNum(n: number, decimals = 0): string {
  return n.toFixed(decimals).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

export function LiveFlightBar() {
  const { simData, isFlying } = useSim()

  if (!isFlying || !simData) return null

  const items = [
    { label: 'ALT', value: `${formatNum(simData.altitude)} ft` },
    { label: 'GS', value: `${formatNum(simData.groundSpeed)} kts` },
    { label: 'VS', value: `${simData.verticalSpeed > 0 ? '+' : ''}${formatNum(simData.verticalSpeed)} fpm` },
    { label: 'HDG', value: `${formatNum(simData.heading)}°` },
    { label: 'FUEL', value: `${formatNum(simData.fuelQuantity)} gal` },
  ]

  return (
    <div className="flex items-center gap-6 rounded-lg bg-gray-800/80 px-5 py-3 font-mono text-sm border border-gray-700/50">
      <div className="flex items-center gap-2">
        <div className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
        <span className="text-emerald-400 font-semibold">IN FLIGHT</span>
      </div>
      {items.map((item) => (
        <div key={item.label} className="flex items-center gap-1.5">
          <span className="text-gray-500">{item.label}</span>
          <span className="text-gray-200">{item.value}</span>
        </div>
      ))}
    </div>
  )
}
