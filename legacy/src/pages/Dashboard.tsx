import { useEffect, useRef, useState } from 'react'
import { useSim } from '../contexts/SimContext'
import { useCompany } from '../hooks/useCompany'
import { useFlights } from '../hooks/useFlights'
import { KpiCard } from '../components/KpiCard'
import { BarChart } from '../components/BarChart'
import { LiveMap } from '../components/LiveMap'
import { api } from '../lib/api'
import type { Dispatch, DiscoveredRoute, GameEvent, Loan } from '../types/thrustline'

function fmt(n: number) {
  return n.toLocaleString('en-US', { maximumFractionDigits: 0 })
}

function fmtUsd(n: number) {
  const abs = Math.abs(n)
  const sign = n < 0 ? '-' : ''
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(2)}M`
  if (abs >= 1_000)     return `${sign}$${(abs / 1_000).toFixed(1)}K`
  return `${sign}$${abs.toFixed(0)}`
}

function eventStyle(event: GameEvent): string {
  if (event.modifier === 0)  return 'bg-red-500/10 text-red-300 border-red-500/20'
  if (event.modifier > 1.0 && (event.type === 'fuel_spike'))
    return 'bg-amber-500/10 text-amber-300 border-amber-500/20'
  if (event.type === 'fuel_drop' || event.type === 'tourism_boom')
    return 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20'
  return 'bg-blue-500/10 text-blue-300 border-blue-500/20'
}

function eventIcon(event: GameEvent): string {
  switch (event.type) {
    case 'fuel_spike':    return '🛢️'
    case 'fuel_drop':     return '📉'
    case 'weather':       return '⛈️'
    case 'tourism_boom':  return '🏖️'
    case 'strike':        return '✊'
    case 'mechanical':    return '🔧'
    default:              return '🎲'
  }
}

export function Dashboard() {
  const { flightCount, simData, isFlying, eventVersion } = useSim()
  const { company }     = useCompany(flightCount)
  const { flights }     = useFlights(50, flightCount)

  // ── Active flying dispatch (destination orange line) ──────────────────
  const [flyingDispatch,    setFlyingDispatch]    = useState<Dispatch | null>(null)
  const [discoveredRoutes,  setDiscoveredRoutes]  = useState<DiscoveredRoute[]>([])

  useEffect(() => {
    api.discoveredRoutes().then(setDiscoveredRoutes).catch(console.error)
  }, [flightCount])

  useEffect(() => {
    if (!isFlying) { setFlyingDispatch(null); return }
    api.dispatches()
      .then((list) => setFlyingDispatch(list.find((d) => d.status === 'flying') ?? null))
      .catch(console.error)
  }, [isFlying])

  // ── Live flight trail ──────────────────────────────────────────────────
  // Accumulate a breadcrumb trail every 30 s while airborne.
  const trailRef       = useRef<Array<{ lat: number; lon: number }>>([])
  const lastTrailTs    = useRef(0)
  const [trail, setTrail] = useState<Array<{ lat: number; lon: number }>>([])

  // Reset trail when a flight ends
  useEffect(() => {
    trailRef.current = []; setTrail([]); lastTrailTs.current = 0
  }, [flightCount])

  // Append a position every 30 s while flying
  useEffect(() => {
    if (!isFlying || !simData || simData.groundSpeed < 30) return
    const now = Date.now()
    if (now - lastTrailTs.current < 30_000) return
    lastTrailTs.current = now
    const next = [...trailRef.current.slice(-80), { lat: simData.latitude, lon: simData.longitude }]
    trailRef.current = next
    setTrail(next)
  }, [simData, isFlying])

  const totalRevenue = flights.reduce((s, f) => s + f.revenue, 0)
  const totalFlights = company?._count?.flights ?? flights.length
  const avgHealth    = company?.fleet?.length
    ? company.fleet.reduce((s, a) => s + a.healthPct, 0) / company.fleet.length
    : null

  // Reputation score
  const [repScore, setRepScore] = useState<number | null>(null)
  useEffect(() => {
    api.reputationScore().then((r) => setRepScore(r.score)).catch(console.error)
  }, [flightCount])

  // Active events
  const [events, setEvents] = useState<GameEvent[]>([])
  useEffect(() => {
    api.activeEvents().then(setEvents).catch(console.error)
  }, [flightCount, eventVersion])

  // Loan
  const [loan, setLoan] = useState<Loan | null>(null)
  useEffect(() => {
    api.loan().then(setLoan).catch(console.error)
  }, [flightCount])

  // Best route by total net result
  const routeMap = new Map<string, number>()
  for (const f of flights) {
    const key = `${f.departureIcao}→${f.arrivalIcao}`
    routeMap.set(key, (routeMap.get(key) ?? 0) + f.netResult)
  }
  const bestRoute = [...routeMap.entries()].sort((a, b) => b[1] - a[1])[0]

  // Last 15 flights for bar chart (chronological order)
  const chartData = [...flights].reverse().slice(-15).map((f) => ({
    label: `${f.departureIcao}→${f.arrivalIcao}`,
    value: f.netResult,
  }))

  return (
    <div className="space-y-6">

      {/* KPIs */}
      <div className="grid grid-cols-5 gap-4">
        <KpiCard
          label="Capital"
          value={fmtUsd(company?.capital ?? 0)}
          sub="Current cash balance"
          accent="emerald"
        />
        <KpiCard
          label="Total Flights"
          value={fmt(totalFlights)}
          sub="All time"
          accent="blue"
        />
        <KpiCard
          label="Total Revenue"
          value={fmtUsd(totalRevenue)}
          sub="From recent flights"
          accent="amber"
        />
        <KpiCard
          label="Fleet Health"
          value={avgHealth !== null ? `${avgHealth.toFixed(1)}%` : '—'}
          sub={avgHealth !== null && avgHealth < 50 ? '⚠ Aircraft grounded' : 'All systems nominal'}
          accent={avgHealth !== null && avgHealth < 50 ? 'red' : avgHealth !== null && avgHealth < 80 ? 'amber' : 'emerald'}
        />
        <KpiCard
          label="Reputation"
          value={repScore !== null ? `${repScore.toFixed(1)}` : '—'}
          sub={repScore !== null ? (repScore >= 70 ? 'Excellent' : repScore >= 50 ? 'Average' : 'Poor') : 'No flights yet'}
          accent={repScore !== null ? (repScore >= 70 ? 'emerald' : repScore >= 50 ? 'amber' : 'red') : 'blue'}
        />
      </div>

      {/* Active events banner */}
      {events.length > 0 && (
        <div className="space-y-2">
          {events.map((e) => (
            <div key={e.id} className={`text-xs px-4 py-2.5 rounded-lg border flex items-center gap-2 ${eventStyle(e)}`}>
              <span>{eventIcon(e)}</span>
              <span className="font-medium">{e.title}</span>
              <span className="opacity-70">— {e.description}</span>
              {e.targetId && <span className="font-mono opacity-60 ml-auto">{e.targetId}</span>}
              <span className="ml-auto text-xs opacity-50">
                expires {new Date(e.expiresAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Loan status */}
      {loan && loan.paidMonths < loan.totalMonths && (
        <div className="text-xs px-4 py-2.5 rounded-lg border bg-blue-500/10 text-blue-300 border-blue-500/20 flex items-center gap-3">
          <span>🏦</span>
          <span>Loan: <span className="font-mono font-medium">{fmtUsd(loan.remainingAmount)}</span> remaining</span>
          <span className="text-blue-400/50">·</span>
          <span><span className="font-mono">{fmtUsd(loan.monthlyPayment)}</span>/mo</span>
          <span className="text-blue-400/50">·</span>
          <span>{loan.totalMonths - loan.paidMonths} months left</span>
          {loan.paidMonths >= loan.totalMonths && <span className="ml-auto text-emerald-400 font-medium">Paid off!</span>}
        </div>
      )}

      {/* Map — always visible; shows routes + live aircraft when flying */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          {isFlying && flyingDispatch ? (
            <h2 className="text-sm font-semibold text-gray-300">
              {flyingDispatch.flightNumber}
              <span className="text-gray-600 font-normal"> · </span>
              <span className="font-mono">{flyingDispatch.originIcao} → {flyingDispatch.destIcao}</span>
            </h2>
          ) : (
            <h2 className="text-sm font-semibold text-gray-300">Route network</h2>
          )}

          {isFlying && simData && (
            <div className="flex items-center gap-4 text-xs font-mono text-gray-400">
              <span>ALT <span className="text-gray-200">{Math.round(simData.altitude).toLocaleString()}</span> ft</span>
              <span>GS <span className="text-gray-200">{Math.round(simData.groundSpeed)}</span> kts</span>
              <span>VS <span className={simData.verticalSpeed < -500 ? 'text-red-400' : 'text-gray-200'}>{Math.round(simData.verticalSpeed)}</span> fpm</span>
              <span>HDG <span className="text-gray-200">{Math.round(simData.heading)}</span>°</span>
            </div>
          )}
        </div>

        <LiveMap
          routes={discoveredRoutes}
          {...(isFlying && simData ? {
            lat:      simData.latitude,
            lon:      simData.longitude,
            heading:  simData.heading,
            trail,
            destIcao: flyingDispatch?.destIcao,
          } : {})}
          height={360}
        />
      </div>

      {/* Cashflow mini chart */}
      {chartData.length > 0 && (
        <div className="rounded-lg border border-gray-800 bg-gray-900 p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-300">Net result per flight</h2>
            {bestRoute && (
              <span className="text-xs text-gray-500">
                Best route: <span className="text-emerald-400 font-mono">{bestRoute[0]}</span>
                {' '}({fmtUsd(bestRoute[1])})
              </span>
            )}
          </div>
          <BarChart data={chartData} height={80} />
          <div className="flex gap-4 mt-2 text-xs text-gray-600">
            <span className="flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-sm bg-emerald-500" /> Profit</span>
            <span className="flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-sm bg-red-400" /> Loss</span>
          </div>
        </div>
      )}

      {/* Recent flights */}
      <div>
        <h2 className="text-sm font-semibold text-gray-300 mb-3">Recent Flights</h2>
        {flights.length === 0 ? (
          <p className="text-gray-500 text-sm">No flights yet. Start flying in MSFS to log your first flight.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-gray-800">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800 bg-gray-900/50 text-left text-gray-400">
                  <th className="px-4 py-2.5 font-medium">Route</th>
                  <th className="px-4 py-2.5 font-medium">Aircraft</th>
                  <th className="px-4 py-2.5 font-medium text-right">Duration</th>
                  <th className="px-4 py-2.5 font-medium text-right">Distance</th>
                  <th className="px-4 py-2.5 font-medium text-right">VS</th>
                  <th className="px-4 py-2.5 font-medium text-right">Revenue</th>
                  <th className="px-4 py-2.5 font-medium text-right">Net</th>
                </tr>
              </thead>
              <tbody>
                {flights.slice(0, 10).map((f) => (
                  <tr key={f.id} className="border-b border-gray-800/50 hover:bg-gray-900/30">
                    <td className="px-4 py-2.5 font-mono text-gray-200">
                      {f.departureIcao} → {f.arrivalIcao}
                    </td>
                    <td className="px-4 py-2.5 text-gray-400">{f.aircraft?.icaoType ?? '—'}</td>
                    <td className="px-4 py-2.5 text-right text-gray-300">{f.durationMin} min</td>
                    <td className="px-4 py-2.5 text-right text-gray-300">{f.distanceNm} nm</td>
                    <td className={`px-4 py-2.5 text-right font-mono text-xs ${f.landingVsFpm < -600 ? 'text-red-400 font-bold' : 'text-gray-400'}`}>
                      {f.landingVsFpm} fpm
                    </td>
                    <td className="px-4 py-2.5 text-right text-gray-300">{fmtUsd(f.revenue)}</td>
                    <td className={`px-4 py-2.5 text-right font-semibold ${f.netResult >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {fmtUsd(f.netResult)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
