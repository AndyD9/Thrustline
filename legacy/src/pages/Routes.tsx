import { useEffect, useState } from 'react'
import { useSim } from '../contexts/SimContext'
import { api } from '../lib/api'
import { getAirport } from '../data/airports'
import { LiveMap } from '../components/LiveMap'
import type { DiscoveredRoute, SavedRoute, RouteReputation } from '../types/thrustline'

// ── Helpers ───────────────────────────────────────────────────────────────

function fmtUsd(n: number) {
  const abs = Math.abs(n)
  const sign = n < 0 ? '-' : '+'
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(2)}M`
  if (abs >= 1_000)     return `${sign}$${(abs / 1_000).toFixed(1)}K`
  return `${sign}$${abs.toFixed(0)}`
}

type SortKey = 'flightCount' | 'totalRevenue' | 'avgNet' | 'avgDistanceNm'

// ── Route row ─────────────────────────────────────────────────────────────

function RepBadge({ score }: { score: number | null }) {
  if (score === null) return <span className="text-xs text-gray-700">—</span>
  const color = score >= 70 ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
              : score >= 40 ? 'text-amber-400 bg-amber-500/10 border-amber-500/20'
              :               'text-red-400 bg-red-500/10 border-red-500/20'
  return (
    <span className={`text-xs font-mono px-1.5 py-0.5 rounded border ${color}`}>
      {score.toFixed(0)}
    </span>
  )
}

function RouteRow({ route, saved, repScore, onSave, onUnsave }: {
  route: DiscoveredRoute
  saved: boolean
  repScore: number | null
  onSave: () => void
  onUnsave: () => void
}) {
  const src = getAirport(route.departureIcao)
  const dst = getAirport(route.arrivalIcao)

  return (
    <tr className="border-b border-gray-800/50 hover:bg-gray-900/40">
      <td className="px-4 py-2.5">
        <div className="font-mono text-gray-200 text-sm">
          {route.departureIcao} → {route.arrivalIcao}
        </div>
        {(src || dst) && (
          <div className="text-xs text-gray-500 mt-0.5">
            {src?.city ?? '?'} → {dst?.city ?? '?'}
          </div>
        )}
      </td>
      <td className="px-4 py-2.5 text-center text-sm text-gray-300">{route.flightCount}</td>
      <td className="px-4 py-2.5 text-right text-sm text-gray-300">{route.avgDistanceNm} nm</td>
      <td className="px-4 py-2.5 text-right text-sm text-emerald-400/80">{fmtUsd(route.totalRevenue)}</td>
      <td className={`px-4 py-2.5 text-right text-sm font-semibold ${route.avgNet >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
        {fmtUsd(route.avgNet)}
      </td>
      <td className="px-4 py-2.5 text-center"><RepBadge score={repScore} /></td>
      <td className={`px-4 py-2.5 text-right text-xs font-mono ${route.avgVsFpm < -600 ? 'text-red-400' : 'text-gray-500'}`}>
        {route.avgVsFpm} fpm
      </td>
      <td className="px-4 py-2.5 text-center">
        <button
          onClick={saved ? onUnsave : onSave}
          title={saved ? 'Remove bookmark' : 'Bookmark route'}
          className={`text-base leading-none transition-colors ${saved ? 'text-emerald-400 hover:text-gray-500' : 'text-gray-700 hover:text-emerald-400'}`}
        >
          {saved ? '★' : '☆'}
        </button>
      </td>
    </tr>
  )
}

// ── Main component ────────────────────────────────────────────────────────

export function Routes() {
  const { flightCount, simData, isFlying } = useSim()

  const [discovered, setDiscovered]     = useState<DiscoveredRoute[]>([])
  const [saved, setSaved]               = useState<SavedRoute[]>([])
  const [reputations, setReputations]   = useState<RouteReputation[]>([])
  const [loading, setLoading]           = useState(true)
  const [actionKey, setActionKey]       = useState(0)

  const [sort, setSort] = useState<SortKey>('flightCount')
  const [showAddForm, setShowAddForm] = useState(false)
  const [origin, setOrigin] = useState('')
  const [dest, setDest]     = useState('')
  const [addError, setAddError]   = useState<string | null>(null)
  const [addLoading, setAddLoading] = useState(false)
  const [flashMsg, setFlashMsg]   = useState<string | null>(null)

  const refreshKey = flightCount + actionKey

  useEffect(() => {
    setLoading(true)
    Promise.all([api.discoveredRoutes(), api.savedRoutes(), api.reputations()])
      .then(([d, s, r]) => {
        setDiscovered(d)
        setSaved(s)
        setReputations(r)
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [refreshKey])

  // Build reputation lookup map
  const repMap = new Map(reputations.map((r) => [`${r.originIcao}-${r.destIcao}`, r.score]))

  function flash(msg: string) {
    setFlashMsg(msg)
    setTimeout(() => setFlashMsg(null), 3500)
  }

  const savedSet = new Set(saved.map((s) => `${s.originIcao}-${s.destIcao}`))

  async function handleSave(route: DiscoveredRoute) {
    try {
      await api.saveRoute(route.departureIcao, route.arrivalIcao)
      flash(`${route.departureIcao} → ${route.arrivalIcao} bookmarked`)
      setActionKey((k) => k + 1)
    } catch (err: unknown) {
      flash(err instanceof Error ? err.message : 'Failed to bookmark')
    }
  }

  async function handleUnsave(route: DiscoveredRoute) {
    const match = saved.find(
      (s) => s.originIcao === route.departureIcao && s.destIcao === route.arrivalIcao,
    )
    if (!match) return
    try {
      await api.deleteRoute(match.id)
      flash(`${route.departureIcao} → ${route.arrivalIcao} removed`)
      setActionKey((k) => k + 1)
    } catch (err: unknown) {
      flash(err instanceof Error ? err.message : 'Failed to remove')
    }
  }

  async function handleAddRoute() {
    setAddError(null)
    const o = origin.trim().toUpperCase()
    const d = dest.trim().toUpperCase()
    if (o.length < 3 || d.length < 3) {
      setAddError('Both ICAO codes must be at least 3 characters.')
      return
    }
    if (o === d) {
      setAddError('Origin and destination must differ.')
      return
    }
    setAddLoading(true)
    try {
      await api.saveRoute(o, d)
      flash(`Route ${o} → ${d} saved`)
      setOrigin('')
      setDest('')
      setShowAddForm(false)
      setActionKey((k) => k + 1)
    } catch (err: unknown) {
      setAddError(err instanceof Error ? err.message : 'Failed to save route')
    } finally {
      setAddLoading(false)
    }
  }

  // Saved routes that have no flight history yet (not in discovered)
  const discoveredKeys = new Set(discovered.map((r) => `${r.departureIcao}-${r.arrivalIcao}`))
  const plannedOnly = saved.filter(
    (s) => !discoveredKeys.has(`${s.originIcao}-${s.destIcao}`),
  )

  // Sort the discovered routes
  const sorted = [...discovered].sort((a, b) => {
    if (sort === 'flightCount')    return b.flightCount    - a.flightCount
    if (sort === 'totalRevenue')   return b.totalRevenue   - a.totalRevenue
    if (sort === 'avgNet')         return b.avgNet         - a.avgNet
    if (sort === 'avgDistanceNm')  return b.avgDistanceNm  - a.avgDistanceNm
    return 0
  })

  // Summary stats
  const totalFlights = discovered.reduce((s, r) => s + r.flightCount, 0)
  const totalNet     = discovered.reduce((s, r) => s + r.totalNet, 0)
  const bestRoute    = discovered.length > 0
    ? discovered.reduce((best, r) => r.avgNet > best.avgNet ? r : best)
    : null

  function SortTh({ label, k }: { label: string; k: SortKey }) {
    return (
      <th
        className="px-4 py-2.5 font-medium text-right cursor-pointer hover:text-gray-200 select-none"
        onClick={() => setSort(k)}
      >
        {label} {sort === k ? '↓' : ''}
      </th>
    )
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-lg font-semibold text-gray-200">Routes</h1>
          <p className="text-xs text-gray-500 mt-0.5">
            {discovered.length} routes · {totalFlights} flights ·{' '}
            <span className={totalNet >= 0 ? 'text-emerald-400' : 'text-red-400'}>
              net {fmtUsd(totalNet)}
            </span>
            {bestRoute && (
              <> · best <span className="text-gray-400 font-mono">{bestRoute.departureIcao}→{bestRoute.arrivalIcao}</span> ({fmtUsd(bestRoute.avgNet)}/flight)</>
            )}
          </p>
        </div>
        <button
          onClick={() => setShowAddForm((v) => !v)}
          className="px-3 py-1.5 rounded text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 transition-colors"
        >
          {showAddForm ? 'Cancel' : '+ Plan Route'}
        </button>
      </div>

      {/* Flash */}
      {flashMsg && (
        <div className="text-xs px-4 py-2.5 rounded-lg border bg-emerald-500/10 text-emerald-300 border-emerald-500/20">
          {flashMsg}
        </div>
      )}

      {/* Map — routes network + optional live aircraft */}
      <LiveMap
        routes={discovered}
        plannedRoutes={plannedOnly}
        {...(isFlying && simData ? {
          lat:     simData.latitude,
          lon:     simData.longitude,
          heading: simData.heading,
        } : {})}
        height={360}
      />

      {/* Add route form */}
      {showAddForm && (
        <div className="rounded-lg border border-gray-700 bg-gray-900 p-5 space-y-3">
          <h2 className="text-sm font-semibold text-gray-300">Plan a new route</h2>
          <p className="text-xs text-gray-500">Save a route for reference — it appears immediately on the map as a dashed line until you fly it.</p>
          <div className="flex gap-3 items-end">
            <div className="flex-1">
              <label className="text-xs text-gray-500 block mb-1">Origin ICAO</label>
              <input
                type="text"
                maxLength={4}
                placeholder="LFPG"
                value={origin}
                onChange={(e) => setOrigin(e.target.value.toUpperCase())}
                className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-gray-200 font-mono focus:outline-none focus:border-gray-500 uppercase placeholder-gray-600"
              />
            </div>
            <div className="text-gray-600 pb-2">→</div>
            <div className="flex-1">
              <label className="text-xs text-gray-500 block mb-1">Destination ICAO</label>
              <input
                type="text"
                maxLength={4}
                placeholder="KJFK"
                value={dest}
                onChange={(e) => setDest(e.target.value.toUpperCase())}
                onKeyDown={(e) => e.key === 'Enter' && handleAddRoute()}
                className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-gray-200 font-mono focus:outline-none focus:border-gray-500 uppercase placeholder-gray-600"
              />
            </div>
            <button
              onClick={handleAddRoute}
              disabled={addLoading}
              className="px-4 py-2 rounded text-sm font-semibold bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white transition-colors whitespace-nowrap"
            >
              {addLoading ? 'Saving…' : 'Save route'}
            </button>
          </div>
          {addError && <p className="text-xs text-red-400">{addError}</p>}
        </div>
      )}

      {/* Routes table */}
      {loading ? (
        <p className="text-sm text-gray-500">Loading…</p>
      ) : discovered.length === 0 && plannedOnly.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <p className="text-sm">No routes yet.</p>
          <p className="text-xs mt-1">Routes are discovered automatically after each flight, or plan one above.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-800">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800 bg-gray-900/50 text-gray-400 text-left">
                <th className="px-4 py-2.5 font-medium">Route</th>
                <SortTh label="Flights"   k="flightCount"   />
                <SortTh label="Avg dist"  k="avgDistanceNm" />
                <SortTh label="Revenue"   k="totalRevenue"  />
                <SortTh label="Avg net"   k="avgNet"        />
                <th className="px-4 py-2.5 font-medium text-center">Rep</th>
                <th className="px-4 py-2.5 font-medium text-right">Avg VS</th>
                <th className="px-4 py-2.5 font-medium text-center">★</th>
              </tr>
            </thead>
            <tbody>
              {/* Discovered routes (have flight history) */}
              {sorted.map((r) => (
                <RouteRow
                  key={`${r.departureIcao}-${r.arrivalIcao}`}
                  route={r}
                  saved={savedSet.has(`${r.departureIcao}-${r.arrivalIcao}`)}
                  repScore={repMap.get(`${r.departureIcao}-${r.arrivalIcao}`) ?? null}
                  onSave={() => handleSave(r)}
                  onUnsave={() => handleUnsave(r)}
                />
              ))}

              {/* Planned-only rows (saved but not yet flown) */}
              {plannedOnly.map((s) => {
                const src = getAirport(s.originIcao)
                const dst = getAirport(s.destIcao)
                return (
                  <tr key={s.id} className="border-b border-gray-800/50 opacity-60">
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-gray-400 text-sm">{s.originIcao} → {s.destIcao}</span>
                        <span className="text-xs px-1.5 py-0.5 rounded bg-gray-700 text-gray-500">Planned</span>
                      </div>
                      {(src || dst) && (
                        <div className="text-xs text-gray-600 mt-0.5">
                          {src?.city ?? '?'} → {dst?.city ?? '?'}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-center text-gray-600 text-sm">—</td>
                    <td className="px-4 py-2.5 text-center text-gray-600 text-sm">—</td>
                    <td className="px-4 py-2.5 text-right text-gray-600 text-sm">—</td>
                    <td className="px-4 py-2.5 text-right text-gray-600 text-sm">—</td>
                    <td className="px-4 py-2.5 text-right text-gray-600 text-sm">—</td>
                    <td className="px-4 py-2.5 text-center text-gray-600 text-sm">—</td>
                    <td className="px-4 py-2.5 text-center">
                      <button
                        onClick={async () => {
                          try {
                            await api.deleteRoute(s.id)
                            flash(`${s.originIcao} → ${s.destIcao} removed`)
                            setActionKey((k) => k + 1)
                          } catch { /* ignore */ }
                        }}
                        title="Remove planned route"
                        className="text-base leading-none text-emerald-500 hover:text-gray-500 transition-colors"
                      >
                        ★
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
