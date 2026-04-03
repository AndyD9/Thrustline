import { useEffect, useRef, useState } from 'react'
import Map, {
  Source,
  Layer,
  Marker,
  NavigationControl,
  type MapRef,
  type LayerProps,
} from 'react-map-gl/maplibre'
import 'maplibre-gl/dist/maplibre-gl.css'
import { getAirport } from '../data/airports'
import type { DiscoveredRoute, SavedRoute } from '../types/thrustline'

// ── Dark tile style — CartoDB Dark Matter (free, no API key) ──────────────
const MAP_STYLE = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json'

// ── Layer definitions ─────────────────────────────────────────────────────

const discoveredLayer: LayerProps = {
  id:   'routes-discovered',
  type: 'line',
  paint: {
    'line-color':   ['case', ['get', 'profit'], '#4ade80', '#f87171'],
    'line-width':   ['interpolate', ['linear'], ['get', 'count'], 1, 1.5, 20, 3.5],
    'line-opacity': 0.7,
  },
  layout: { 'line-join': 'round', 'line-cap': 'round' },
}

const plannedRoutesLayer: LayerProps = {
  id:   'routes-planned',
  type: 'line',
  paint: {
    'line-color':       '#6b7280',
    'line-width':       1.5,
    'line-opacity':     0.6,
    'line-dasharray':   [4, 3],
  },
  layout: { 'line-join': 'round', 'line-cap': 'butt' },
}

const airportCircleLayer: LayerProps = {
  id:   'airports-dot',
  type: 'circle',
  paint: {
    'circle-radius':       4,
    'circle-color':        '#22d3ee',
    'circle-stroke-color': '#67e8f9',
    'circle-stroke-width': 1,
    'circle-opacity':      0.85,
  },
}

const airportLabelLayer: LayerProps = {
  id:     'airports-label',
  type:   'symbol',
  layout: {
    'text-field':    ['get', 'icao'],
    'text-font':     ['Open Sans Regular', 'Arial Unicode MS Regular'],
    'text-size':     10,
    'text-offset':   [0, 1.1],
    'text-anchor':   'top',
    'text-optional': true,
  },
  paint: {
    'text-color':      '#94a3b8',
    'text-halo-color': '#020617',
    'text-halo-width': 1.2,
  },
}

const trailLayer: LayerProps = {
  id:   'trail',
  type: 'line',
  paint: {
    'line-color':   '#3b82f6',
    'line-width':   2.5,
    'line-opacity': 0.85,
  },
  layout: { 'line-join': 'round', 'line-cap': 'round' },
}

const plannedFlightLayer: LayerProps = {
  id:   'planned-flight',
  type: 'line',
  paint: {
    'line-color':       '#f97316',
    'line-width':       2,
    'line-opacity':     0.75,
    'line-dasharray':   [3, 3],
  },
  layout: { 'line-join': 'round', 'line-cap': 'butt' },
}

// ── Build GeoJSON helpers ─────────────────────────────────────────────────

function buildRoutesGeoJSON(routes: DiscoveredRoute[]): GeoJSON.FeatureCollection {
  return {
    type:     'FeatureCollection',
    features: routes.flatMap((r) => {
      const src = getAirport(r.departureIcao)
      const dst = getAirport(r.arrivalIcao)
      if (!src || !dst) return []
      return [{
        type:       'Feature' as const,
        properties: { profit: r.totalNet >= 0, count: r.flightCount },
        geometry:   {
          type:        'LineString' as const,
          coordinates: [[src.lon, src.lat], [dst.lon, dst.lat]],
        },
      }]
    }),
  }
}

function buildPlannedGeoJSON(planned: SavedRoute[]): GeoJSON.FeatureCollection {
  return {
    type:     'FeatureCollection',
    features: planned.flatMap((r) => {
      const src = getAirport(r.originIcao)
      const dst = getAirport(r.destIcao)
      if (!src || !dst) return []
      return [{
        type:       'Feature' as const,
        properties: {},
        geometry:   {
          type:        'LineString' as const,
          coordinates: [[src.lon, src.lat], [dst.lon, dst.lat]],
        },
      }]
    }),
  }
}

function buildAirportsGeoJSON(icaos: string[]): GeoJSON.FeatureCollection {
  return {
    type:     'FeatureCollection',
    features: icaos.flatMap((icao) => {
      const apt = getAirport(icao)
      if (!apt) return []
      return [{
        type:       'Feature' as const,
        properties: { icao: apt.icao, city: apt.city },
        geometry:   { type: 'Point' as const, coordinates: [apt.lon, apt.lat] },
      }]
    }),
  }
}

// ── Aircraft marker ───────────────────────────────────────────────────────

function AircraftMarker({ heading }: { heading: number }) {
  return (
    <div
      style={{
        transform:       `rotate(${heading}deg)`,
        transformOrigin: 'center center',
        filter:          'drop-shadow(0 0 6px rgba(74, 222, 128, 0.8))',
      }}
    >
      <svg width="28" height="28" viewBox="-12 -14 24 28" overflow="visible">
        <circle r="11" fill="#10b981" fillOpacity={0.13} />
        <path
          d="M 0,-10 L 2,0 L 8,3 L 8,5 L 2,3 L 1.5,9 L 3,10.5 L 3,12 L 0,11 L -3,12 L -3,10.5 L -1.5,9 L -2,3 L -8,5 L -8,3 L -2,0 Z"
          fill="#4ade80"
          stroke="#a7f3d0"
          strokeWidth={0.7}
        />
      </svg>
    </div>
  )
}

// ── Destination marker ────────────────────────────────────────────────────

function DestMarker({ icao }: { icao: string }) {
  const apt = getAirport(icao)
  if (!apt) return null
  return (
    <Marker longitude={apt.lon} latitude={apt.lat} anchor="center">
      <div className="flex flex-col items-center" style={{ gap: 2 }}>
        <div className="w-3 h-3 rounded-full bg-orange-500 border-2 border-orange-300 shadow-lg" />
        <span className="text-[10px] font-mono font-bold text-orange-300 bg-gray-950/80 px-1 rounded leading-tight">
          {icao}
        </span>
      </div>
    </Marker>
  )
}

// ── Legend ────────────────────────────────────────────────────────────────

function Legend({ hasRoutes, hasLive }: { hasRoutes: boolean; hasLive: boolean }) {
  return (
    <div className="absolute top-3 right-3 flex flex-col gap-1.5 text-xs pointer-events-none">
      {hasLive && (
        <div className="flex items-center gap-1.5 bg-gray-950/70 px-2 py-1 rounded">
          <span className="animate-pulse text-emerald-400">●</span>
          <span className="text-emerald-400 font-medium">LIVE</span>
        </div>
      )}
      {hasRoutes && (
        <div className="flex flex-col gap-1 bg-gray-950/70 px-2 py-1.5 rounded">
          <div className="flex items-center gap-1.5">
            <span className="inline-block w-4 h-0.5 bg-emerald-400 rounded" />
            <span className="text-gray-400">Profit</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="inline-block w-4 h-0.5 bg-red-400 rounded" />
            <span className="text-gray-400">Loss</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="inline-block w-4 border-t border-dashed border-gray-500" />
            <span className="text-gray-400">Planned</span>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Props ─────────────────────────────────────────────────────────────────

export interface LiveMapProps {
  // ── Live aircraft (optional — enables flight-tracking mode) ──────────
  lat?:      number
  lon?:      number
  heading?:  number
  trail?:    Array<{ lat: number; lon: number }>
  destIcao?: string

  // ── Routes overlay (optional) ─────────────────────────────────────────
  routes?:        DiscoveredRoute[]
  plannedRoutes?: SavedRoute[]

  height?: number
}

// ── Main component ────────────────────────────────────────────────────────

export function LiveMap({
  lat, lon, heading,
  trail        = [],
  destIcao,
  routes       = [],
  plannedRoutes = [],
  height       = 380,
}: LiveMapProps) {
  const mapRef      = useRef<MapRef>(null)
  const [ready,     setReady]    = useState(false)
  const [following, setFollowing] = useState(true)

  const hasLive   = lat !== undefined && lon !== undefined && heading !== undefined
  const hasRoutes = routes.length > 0 || plannedRoutes.length > 0

  // ── Initial view state ────────────────────────────────────────────────
  const initView = hasLive
    ? { longitude: lon!, latitude: lat!, zoom: 6.5, bearing: 0, pitch: 0 }
    : { longitude: 10,   latitude: 30,   zoom: 2.2, bearing: 0, pitch: 0 }

  // ── Follow aircraft — smooth pan when position updates ────────────────
  useEffect(() => {
    if (!following || !hasLive || !mapRef.current) return
    mapRef.current.easeTo({
      center:   [lon!, lat!],
      duration: 800,
      easing:   (t) => t,
    })
  }, [lat, lon, following, hasLive])

  // ── Auto-fit to route bounding box on first load ──────────────────────
  useEffect(() => {
    if (!ready || hasLive || !hasRoutes) return
    const coords: [number, number][] = []
    ;[...routes, ...plannedRoutes].forEach((r) => {
      const orig = 'departureIcao' in r ? r.departureIcao : r.originIcao
      const dest = 'arrivalIcao'   in r ? r.arrivalIcao   : r.destIcao
      const src = getAirport(orig), dst = getAirport(dest)
      if (src) coords.push([src.lon, src.lat])
      if (dst) coords.push([dst.lon, dst.lat])
    })
    if (coords.length < 2) return
    const lons = coords.map((c) => c[0]), lats = coords.map((c) => c[1])
    const bounds: [number, number, number, number] = [
      Math.min(...lons), Math.min(...lats),
      Math.max(...lons), Math.max(...lats),
    ]
    mapRef.current?.fitBounds(bounds, { padding: 60, duration: 600, maxZoom: 8 })
  }, [ready, hasLive, hasRoutes, routes, plannedRoutes])

  // ── GeoJSON data ──────────────────────────────────────────────────────
  const routesGeoJSON   = buildRoutesGeoJSON(routes)
  const plannedGeoJSON  = buildPlannedGeoJSON(plannedRoutes)

  // Airport dots — union of all unique airports in routes
  const airportIcaos = Array.from(new Set([
    ...routes.flatMap((r) => [r.departureIcao, r.arrivalIcao]),
    ...plannedRoutes.flatMap((r) => [r.originIcao, r.destIcao]),
  ]))
  const airportsGeoJSON = buildAirportsGeoJSON(airportIcaos)

  // Trail + planned flight line
  const allTrailPts = hasLive ? [...trail, { lat: lat!, lon: lon! }] : trail
  const trailGeoJSON: GeoJSON.Feature<GeoJSON.LineString> = {
    type: 'Feature', properties: {},
    geometry: { type: 'LineString', coordinates: allTrailPts.map((p) => [p.lon, p.lat]) },
  }
  const destApt = destIcao ? getAirport(destIcao) : null
  const flightLineGeoJSON: GeoJSON.Feature<GeoJSON.LineString> | null = (hasLive && destApt)
    ? {
        type: 'Feature', properties: {},
        geometry: { type: 'LineString', coordinates: [[lon!, lat!], [destApt.lon, destApt.lat]] },
      }
    : null

  const [styleError, setStyleError] = useState(false)

  return (
    <div
      className="relative rounded-lg overflow-hidden border border-gray-800"
      style={{ height }}
    >
      {/* Loading placeholder — shown until map tiles load */}
      {!ready && !styleError && (
        <div className="absolute inset-0 bg-gray-900 flex items-center justify-center z-10">
          <p className="text-xs text-gray-500 animate-pulse">Loading map…</p>
        </div>
      )}
      {styleError && (
        <div className="absolute inset-0 bg-gray-900 flex items-center justify-center z-10">
          <p className="text-xs text-gray-600">Map unavailable — check internet connection</p>
        </div>
      )}
      <Map
        ref={mapRef}
        initialViewState={initView}
        onMove={() => { /* user is panning — disable follow */ }}
        onDragStart={() => { if (hasLive) setFollowing(false) }}
        onLoad={() => setReady(true)}
        onError={() => setStyleError(true)}
        mapStyle={MAP_STYLE}
        style={{ width: '100%', height: '100%' }}
        attributionControl={false}
      >
        {ready && (
          <>
            {/* ── Route network ────────────────────────────────────── */}
            {hasRoutes && (
              <>
                <Source id="discovered" type="geojson" data={routesGeoJSON}>
                  <Layer {...discoveredLayer} />
                </Source>
                <Source id="planned-routes" type="geojson" data={plannedGeoJSON}>
                  <Layer {...plannedRoutesLayer} />
                </Source>
                <Source id="airports" type="geojson" data={airportsGeoJSON}>
                  <Layer {...airportCircleLayer} />
                  <Layer {...airportLabelLayer} />
                </Source>
              </>
            )}

            {/* ── Flight trail ─────────────────────────────────────── */}
            {hasLive && allTrailPts.length >= 2 && (
              <Source id="trail" type="geojson" data={trailGeoJSON}>
                <Layer {...trailLayer} />
              </Source>
            )}

            {/* ── Planned flight route ──────────────────────────────── */}
            {flightLineGeoJSON && (
              <Source id="planned-flight" type="geojson" data={flightLineGeoJSON}>
                <Layer {...plannedFlightLayer} />
              </Source>
            )}

            {/* ── Destination marker ────────────────────────────────── */}
            {destIcao && <DestMarker icao={destIcao} />}

            {/* ── Live aircraft ─────────────────────────────────────── */}
            {hasLive && (
              <Marker longitude={lon!} latitude={lat!} anchor="center">
                <AircraftMarker heading={heading!} />
              </Marker>
            )}
          </>
        )}

        <NavigationControl position="bottom-right" showCompass={false} />
      </Map>

      {/* Follow toggle — only in live mode */}
      {hasLive && (
        <button
          onClick={() => setFollowing((f) => !f)}
          className={`absolute top-3 left-3 px-2.5 py-1.5 rounded text-xs font-medium transition-colors border backdrop-blur-sm ${
            following
              ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
              : 'bg-gray-900/80 text-gray-400 border-gray-700 hover:text-gray-200'
          }`}
        >
          {following ? '⊕ Following' : '⊕ Follow'}
        </button>
      )}

      <Legend hasRoutes={hasRoutes} hasLive={hasLive} />

      <div className="absolute bottom-1 right-14 text-[9px] text-gray-700 pointer-events-none select-none">
        © CartoDB © OpenStreetMap
      </div>
    </div>
  )
}
