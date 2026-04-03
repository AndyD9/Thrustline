import { useState } from 'react'
import { useSim } from '../contexts/SimContext'
import { useFlights } from '../hooks/useFlights'

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
  })
}

function fmtUsd(n: number) {
  const sign = n < 0 ? '-' : '+'
  return `${sign}$${Math.abs(n).toLocaleString('en-US', { maximumFractionDigits: 0 })}`
}

type SortKey = 'createdAt' | 'distanceNm' | 'netResult' | 'landingVsFpm'

const PAGE_SIZE = 25

export function Flights() {
  const { flightCount }            = useSim()
  const { flights, loading }       = useFlights(200, flightCount)
  const [sort, setSort]            = useState<SortKey>('createdAt')
  const [filter, setFilter]        = useState<'all' | 'hard' | 'profit' | 'loss'>('all')
  const [page, setPage]            = useState(0)

  const filtered = flights.filter((f) => {
    if (filter === 'hard')   return f.landingVsFpm < -600
    if (filter === 'profit') return f.netResult >= 0
    if (filter === 'loss')   return f.netResult < 0
    return true
  })

  const sorted = [...filtered].sort((a, b) => {
    if (sort === 'createdAt')    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    if (sort === 'distanceNm')   return b.distanceNm - a.distanceNm
    if (sort === 'netResult')    return b.netResult - a.netResult
    if (sort === 'landingVsFpm') return a.landingVsFpm - b.landingVsFpm
    return 0
  })

  const pageCount = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE))
  const safePage  = Math.min(page, pageCount - 1)
  const pageItems = sorted.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE)

  function handleFilter(f: typeof filter) { setFilter(f); setPage(0) }

  const totalNet     = flights.reduce((s, f) => s + f.netResult, 0)
  const hardLandings = flights.filter((f) => f.landingVsFpm < -600).length

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-gray-200">Flights</h1>
          <p className="text-xs text-gray-500 mt-0.5">
            {flights.length} flights · {hardLandings} hard landings · net {fmtUsd(totalNet)}
          </p>
        </div>

        {/* Filters + export */}
        <div className="flex gap-2">
          <button
            onClick={() => window.thrustline.exportFlights()}
            className="px-3 py-1.5 rounded text-xs font-medium bg-gray-800 text-gray-400 hover:text-gray-200 border border-gray-700 transition-colors"
            title="Export to CSV"
          >
            ↓ CSV
          </button>
          {(['all', 'profit', 'loss', 'hard'] as const).map((f) => (
            <button
              key={f}
              onClick={() => handleFilter(f)}
              className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                filter === f
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  : 'bg-gray-800 text-gray-400 hover:text-gray-200 border border-gray-700'
              }`}
            >
              {f === 'all' ? 'All' : f === 'hard' ? '⚠ Hard' : f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <p className="text-gray-500 text-sm">Loading…</p>
      ) : sorted.length === 0 ? (
        <p className="text-gray-500 text-sm">No flights match this filter.</p>
      ) : (
        <>
        <div className="overflow-x-auto rounded-lg border border-gray-800">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800 bg-gray-900/50 text-gray-400 text-left">
                <th className="px-4 py-2.5 font-medium">Date</th>
                <th className="px-4 py-2.5 font-medium">Route</th>
                <th className="px-4 py-2.5 font-medium">Aircraft</th>
                <th
                  className="px-4 py-2.5 font-medium text-right cursor-pointer hover:text-gray-200 select-none"
                  onClick={() => setSort('distanceNm')}
                >
                  Distance {sort === 'distanceNm' ? '↓' : ''}
                </th>
                <th className="px-4 py-2.5 font-medium text-right">Duration</th>
                <th className="px-4 py-2.5 font-medium text-right">Fuel</th>
                <th
                  className="px-4 py-2.5 font-medium text-right cursor-pointer hover:text-gray-200 select-none"
                  onClick={() => setSort('landingVsFpm')}
                >
                  VS {sort === 'landingVsFpm' ? '↑' : ''}
                </th>
                <th className="px-4 py-2.5 font-medium text-right">Revenue</th>
                <th className="px-4 py-2.5 font-medium text-right">Costs</th>
                <th
                  className="px-4 py-2.5 font-medium text-right cursor-pointer hover:text-gray-200 select-none"
                  onClick={() => setSort('netResult')}
                >
                  Net {sort === 'netResult' ? '↓' : ''}
                </th>
              </tr>
            </thead>
            <tbody>
              {pageItems.map((f) => {
                const isHard = f.landingVsFpm < -600
                const costs  = f.fuelCost + f.landingFee
                return (
                  <tr key={f.id} className={`border-b border-gray-800/50 hover:bg-gray-900/40 ${isHard ? 'bg-red-950/10' : ''}`}>
                    <td className="px-4 py-2.5 text-xs text-gray-500 whitespace-nowrap">{fmtDate(f.createdAt)}</td>
                    <td className="px-4 py-2.5 font-mono text-gray-200">{f.departureIcao} → {f.arrivalIcao}</td>
                    <td className="px-4 py-2.5 text-gray-400">{f.aircraft?.icaoType ?? '—'}</td>
                    <td className="px-4 py-2.5 text-right text-gray-300">{f.distanceNm} nm</td>
                    <td className="px-4 py-2.5 text-right text-gray-300">{f.durationMin} min</td>
                    <td className="px-4 py-2.5 text-right text-gray-400 text-xs">{f.fuelUsedGal} gal</td>
                    <td className={`px-4 py-2.5 text-right font-mono text-xs ${isHard ? 'text-red-400 font-bold' : 'text-gray-400'}`}>
                      {isHard && '⚠ '}{f.landingVsFpm} fpm
                    </td>
                    <td className="px-4 py-2.5 text-right text-emerald-400/80 text-xs">{fmtUsd(f.revenue)}</td>
                    <td className="px-4 py-2.5 text-right text-red-400/70 text-xs">{fmtUsd(-costs)}</td>
                    <td className={`px-4 py-2.5 text-right font-semibold ${f.netResult >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {fmtUsd(f.netResult)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pageCount > 1 && (
          <div className="flex items-center justify-between mt-3">
            <span className="text-xs text-gray-500">
              {sorted.length} flight{sorted.length !== 1 ? 's' : ''} · page {safePage + 1}/{pageCount}
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage(0)}
                disabled={safePage === 0}
                className="px-2 py-1 rounded text-xs bg-gray-800 text-gray-400 border border-gray-700 hover:text-gray-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                ««
              </button>
              <button
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={safePage === 0}
                className="px-2 py-1 rounded text-xs bg-gray-800 text-gray-400 border border-gray-700 hover:text-gray-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                ‹ Prev
              </button>
              <button
                onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
                disabled={safePage >= pageCount - 1}
                className="px-2 py-1 rounded text-xs bg-gray-800 text-gray-400 border border-gray-700 hover:text-gray-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                Next ›
              </button>
              <button
                onClick={() => setPage(pageCount - 1)}
                disabled={safePage >= pageCount - 1}
                className="px-2 py-1 rounded text-xs bg-gray-800 text-gray-400 border border-gray-700 hover:text-gray-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                »»
              </button>
            </div>
          </div>
        )}
        </>
      )}
    </div>
  )
}
