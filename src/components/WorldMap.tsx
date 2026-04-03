import { useState } from 'react'
import { getAirport, toSVG } from '../data/airports'
import type { DiscoveredRoute, SavedRoute } from '../types/thrustline'

// ── Constants ─────────────────────────────────────────────────────────────

const W = 1000
const H = 500

// ── Live position types ───────────────────────────────────────────────────

export interface LivePosition {
  lat:     number
  lon:     number
  heading: number
}

// ── Aircraft icon path (top-down view, nose points up / North at rotation 0)
// Designed for a ~20-unit wingspan in the 1000×500 SVG coordinate space.
const AIRCRAFT_D =
  'M 0,-12 L 2.5,0 L 10,4 L 10,6 L 2.5,3 L 2,12 L 4,13 L 4,14.5 L 0,13 L -4,14.5 L -4,13 L -2,12 L -2.5,3 L -10,6 L -10,4 L -2.5,0 Z'

// ── Grid ─────────────────────────────────────────────────────────────────

function MapGrid() {
  const meridians = [-150, -120, -90, -60, -30, 0, 30, 60, 90, 120, 150]
  const parallels = [-60, -30, 0, 30, 60]

  return (
    <g>
      {meridians.map((lon) => {
        const x = toSVG(0, lon, W, H).x
        return (
          <line
            key={lon}
            x1={x} y1={0} x2={x} y2={H}
            stroke={lon === 0 ? '#1e3a4a' : '#111c2a'}
            strokeWidth={lon === 0 ? 0.8 : 0.5}
          />
        )
      })}
      {parallels.map((lat) => {
        const y = toSVG(lat, 0, W, H).y
        return (
          <line
            key={lat}
            x1={0} y1={y} x2={W} y2={y}
            stroke={lat === 0 ? '#1e3a4a' : '#111c2a'}
            strokeWidth={lat === 0 ? 0.8 : 0.5}
          />
        )
      })}
    </g>
  )
}

// ── Route arc ─────────────────────────────────────────────────────────────

interface ArcProps {
  route: DiscoveredRoute
  onHover: (r: DiscoveredRoute | null) => void
  hovered: boolean
  maxFlights: number
}

function RouteArc({ route, onHover, hovered, maxFlights }: ArcProps) {
  const src = getAirport(route.departureIcao)
  const dst = getAirport(route.arrivalIcao)
  if (!src || !dst) return null

  const p1 = toSVG(src.lat, src.lon, W, H)
  const p2 = toSVG(dst.lat, dst.lon, W, H)

  const lonDiff = dst.lon - src.lon
  let x2 = p2.x
  if (Math.abs(lonDiff) > 180) x2 = lonDiff > 0 ? p2.x - W : p2.x + W

  const mx = (p1.x + x2) / 2
  const my = (p1.y + p2.y) / 2
  const dx = x2 - p1.x
  const dy = p2.y - p1.y
  const dist = Math.sqrt(dx * dx + dy * dy)
  const scale = Math.min(dist * 0.18, 60)
  const perpNorm = dist > 0 ? { x: -dy / dist, y: dx / dist } : { x: 0, y: -1 }
  const sign = perpNorm.y < 0 ? 1 : -1
  const cx = mx + perpNorm.x * scale * sign
  const cy = my + perpNorm.y * scale * sign

  const opacity = 0.3 + (route.flightCount / maxFlights) * 0.5
  const isProfit = route.totalNet >= 0
  const color = isProfit ? '#4ade80' : '#f87171'
  const strokeW = hovered ? 2.5 : 1 + (route.flightCount / maxFlights) * 1.5

  return (
    <path
      d={`M${p1.x},${p1.y} Q${cx},${cy} ${x2},${p2.y}`}
      fill="none"
      stroke={color}
      strokeWidth={strokeW}
      strokeOpacity={hovered ? 0.9 : opacity}
      strokeLinecap="round"
      style={{ cursor: 'pointer', transition: 'stroke-opacity 0.15s' }}
      onMouseEnter={() => onHover(route)}
      onMouseLeave={() => onHover(null)}
    />
  )
}

// ── Airport dot ───────────────────────────────────────────────────────────

function AirportDot({ icao, active }: { icao: string; active: boolean }) {
  const airport = getAirport(icao)
  if (!airport) return null
  const { x, y } = toSVG(airport.lat, airport.lon, W, H)
  return (
    <g>
      {active && <circle cx={x} cy={y} r={6} fill="#4ade80" fillOpacity={0.15} />}
      <circle
        cx={x} cy={y} r={active ? 3 : 2}
        fill={active ? '#4ade80' : '#374151'}
        stroke={active ? '#6ee7b7' : '#4b5563'}
        strokeWidth={0.5}
      />
    </g>
  )
}

// ── Flight trail ──────────────────────────────────────────────────────────

function FlightTrail({ points }: { points: Array<{ lat: number; lon: number }> }) {
  if (points.length < 2) return null
  const pts = points.map((p) => toSVG(p.lat, p.lon, W, H))
  const d   = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')
  return (
    <path
      d={d}
      fill="none"
      stroke="#34d399"
      strokeWidth={1.2}
      strokeOpacity={0.35}
      strokeDasharray="4 3"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  )
}

// ── Live aircraft marker ──────────────────────────────────────────────────

function LiveAircraftMarker({ lat, lon, heading }: LivePosition) {
  const { x, y } = toSVG(lat, lon, W, H)
  return (
    <g transform={`translate(${x.toFixed(2)},${y.toFixed(2)}) rotate(${heading})`}>
      {/* Pulse rings */}
      <circle r={22} fill="#10b981" fillOpacity={0.06} />
      <circle r={16} fill="#10b981" fillOpacity={0.08} />
      {/* Aircraft silhouette */}
      <path
        d={AIRCRAFT_D}
        fill="#34d399"
        fillOpacity={0.95}
        stroke="#a7f3d0"
        strokeWidth={0.6}
      />
    </g>
  )
}

// ── Tooltip ───────────────────────────────────────────────────────────────

function fmtUsd(n: number) {
  const abs = Math.abs(n)
  const sign = n < 0 ? '-' : '+'
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(2)}M`
  if (abs >= 1_000)     return `${sign}$${(abs / 1_000).toFixed(1)}K`
  return `${sign}$${abs.toFixed(0)}`
}

function MapTooltip({ route }: { route: DiscoveredRoute }) {
  const srcInfo = getAirport(route.departureIcao)
  const dstInfo = getAirport(route.arrivalIcao)
  return (
    <div className="pointer-events-none absolute bottom-3 left-3 rounded-lg border border-gray-700 bg-gray-900/95 backdrop-blur p-3 text-xs space-y-1 min-w-[200px]">
      <div className="font-semibold text-gray-100 font-mono">
        {route.departureIcao} → {route.arrivalIcao}
      </div>
      {(srcInfo || dstInfo) && (
        <div className="text-gray-500">
          {srcInfo?.city ?? route.departureIcao} → {dstInfo?.city ?? route.arrivalIcao}
        </div>
      )}
      <div className="pt-1 border-t border-gray-800 grid grid-cols-2 gap-x-4 gap-y-0.5">
        <span className="text-gray-500">Flights</span>
        <span className="text-gray-200 text-right">{route.flightCount}</span>
        <span className="text-gray-500">Avg distance</span>
        <span className="text-gray-200 text-right">{route.avgDistanceNm} nm</span>
        <span className="text-gray-500">Total revenue</span>
        <span className="text-emerald-400 text-right">{fmtUsd(route.totalRevenue)}</span>
        <span className="text-gray-500">Avg net / flight</span>
        <span className={`text-right font-semibold ${route.avgNet >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
          {fmtUsd(route.avgNet)}
        </span>
        <span className="text-gray-500">Avg VS</span>
        <span className={`text-right ${route.avgVsFpm < -600 ? 'text-red-400' : 'text-gray-300'}`}>
          {route.avgVsFpm} fpm
        </span>
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────

interface WorldMapProps {
  routes?:        DiscoveredRoute[]
  plannedRoutes?: SavedRoute[]
  height?:        number
  /** Live aircraft position — shows an animated marker + flight trail */
  livePosition?:  LivePosition
  /** Breadcrumb trail — array of past positions during this flight */
  trail?:         Array<{ lat: number; lon: number }>
}

export function WorldMap({
  routes        = [],
  plannedRoutes = [],
  height        = 320,
  livePosition,
  trail         = [],
}: WorldMapProps) {
  const [hovered, setHovered] = useState<DiscoveredRoute | null>(null)

  const hasContent = routes.length > 0 || plannedRoutes.length > 0 || !!livePosition

  if (!hasContent) {
    return (
      <div
        className="rounded-lg border border-gray-800 bg-gray-950 flex items-center justify-center text-gray-600 text-sm"
        style={{ height }}
      >
        Fly some routes to see them appear on the map
      </div>
    )
  }

  const maxFlights = Math.max(1, ...routes.map((r) => r.flightCount))

  const activeIcaos = new Set<string>()
  routes.forEach((r) => { activeIcaos.add(r.departureIcao); activeIcaos.add(r.arrivalIcao) })
  plannedRoutes.forEach((r) => { activeIcaos.add(r.originIcao); activeIcaos.add(r.destIcao) })
  const knownIcaos = Array.from(activeIcaos).filter((icao) => !!getAirport(icao))

  return (
    <div className="relative rounded-lg border border-gray-800 overflow-hidden bg-gray-950" style={{ height }}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="xMidYMid meet"
        className="w-full h-full"
      >
        {/* Background */}
        <rect width={W} height={H} fill="#050a12" />

        {/* Grid */}
        <MapGrid />

        {/* Planned routes — dashed gray */}
        {plannedRoutes.map((r) => {
          const src = getAirport(r.originIcao)
          const dst = getAirport(r.destIcao)
          if (!src || !dst) return null
          const p1 = toSVG(src.lat, src.lon, W, H)
          const p2 = toSVG(dst.lat, dst.lon, W, H)
          const lonDiff = dst.lon - src.lon
          let x2 = p2.x
          if (Math.abs(lonDiff) > 180) x2 = lonDiff > 0 ? p2.x - W : p2.x + W
          const mx = (p1.x + x2) / 2, my = (p1.y + p2.y) / 2
          const dx = x2 - p1.x, dy = p2.y - p1.y
          const dist = Math.sqrt(dx * dx + dy * dy)
          const scale = Math.min(dist * 0.18, 60)
          const perpNorm = dist > 0 ? { x: -dy / dist, y: dx / dist } : { x: 0, y: -1 }
          const sign = perpNorm.y < 0 ? 1 : -1
          const cx = mx + perpNorm.x * scale * sign
          const cy = my + perpNorm.y * scale * sign
          return (
            <path
              key={`planned-${r.id}`}
              d={`M${p1.x},${p1.y} Q${cx},${cy} ${x2},${p2.y}`}
              fill="none" stroke="#4b5563" strokeWidth={1}
              strokeOpacity={0.6} strokeDasharray="4 4" strokeLinecap="round"
            />
          )
        })}

        {/* Route arcs */}
        {routes
          .filter((r) => hovered?.departureIcao !== r.departureIcao || hovered?.arrivalIcao !== r.arrivalIcao)
          .map((r) => (
            <RouteArc
              key={`${r.departureIcao}-${r.arrivalIcao}`}
              route={r} onHover={setHovered} hovered={false} maxFlights={maxFlights}
            />
          ))}
        {hovered && (
          <RouteArc key="hovered" route={hovered} onHover={setHovered} hovered maxFlights={maxFlights} />
        )}

        {/* Airport dots */}
        {knownIcaos.map((icao) => (
          <AirportDot key={icao} icao={icao} active={activeIcaos.has(icao)} />
        ))}

        {/* Flight trail — drawn before marker so marker is on top */}
        {livePosition && <FlightTrail points={trail} />}

        {/* Live aircraft marker — always on top */}
        {livePosition && <LiveAircraftMarker {...livePosition} />}
      </svg>

      {/* Route hover tooltip */}
      {hovered && <MapTooltip route={hovered} />}

      {/* Legend */}
      <div className="absolute top-2 right-3 flex items-center gap-3 text-xs text-gray-500">
        {livePosition && (
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-400" />
            <span className="text-emerald-500">Live</span>
          </span>
        )}
        {routes.length > 0 && (
          <>
            <span className="flex items-center gap-1">
              <span className="inline-block w-4 h-0.5 bg-emerald-400 rounded" /> Profit
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block w-4 h-0.5 bg-red-400 rounded" /> Loss
            </span>
          </>
        )}
      </div>
    </div>
  )
}
