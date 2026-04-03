import { useEffect, useRef, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import Map, { Marker, type MapRef } from 'react-map-gl/maplibre'
import 'maplibre-gl/dist/maplibre-gl.css'
import { api } from '../lib/api'
import type { CatalogEntry, LoanOption } from '../types/thrustline'

// ── Helpers ──────────────────────────────────────────────────────────────

function fmtUsd(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000)     return `$${(n / 1_000).toFixed(0)}K`
  return `$${n.toFixed(0)}`
}

// ── Animated background map ──────────────────────────────────────────────

const MAP_STYLE = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json'

// Predefined routes for animated planes
const FLIGHT_ROUTES: Array<{ from: [number, number]; to: [number, number] }> = [
  { from: [2.55, 49.01],    to: [-73.78, 40.64] },   // LFPG → KJFK
  { from: [-0.46, 51.47],   to: [55.36, 25.25] },    // EGLL → OMDB
  { from: [103.99, 1.35],   to: [139.78, 35.55] },   // WSSS → RJTT
  { from: [-118.41, 33.94], to: [151.18, -33.95] },   // KLAX → YSSY
  { from: [8.57, 50.03],    to: [116.60, 40.08] },    // EDDF → ZBAA
  { from: [-43.24, -22.81], to: [12.65, 41.80] },     // SBGR → LIRF
  { from: [28.81, 41.26],   to: [-3.57, 40.47] },     // LTFM → LEMD
  { from: [100.75, 13.69],  to: [126.45, 37.47] },    // VTBS → RKSI
  { from: [-99.07, 19.44],  to: [-73.78, 40.64] },    // MMMX → KJFK
  { from: [77.10, 28.57],   to: [-0.46, 51.47] },     // VIDP → EGLL
]

interface AnimPlane {
  id:       number
  from:     [number, number]
  to:       [number, number]
  progress: number      // 0–1
  speed:    number       // progress per frame
  heading:  number
  lon:      number
  lat:      number
}

function lerp(a: number, b: number, t: number) { return a + (b - a) * t }

/**
 * Screen-space heading: angle from point A to B as rendered on a Mercator map.
 * 0° = north (up), 90° = east (right). Uses atan2 on the lon/lat deltas directly
 * since linear interpolation on lon/lat = straight line on screen.
 */
function screenHeading(lonA: number, latA: number, lonB: number, latB: number): number {
  const dx = lonB - lonA
  const dy = latB - latA
  // atan2(dx, dy) → 0° when moving north (+lat), 90° when moving east (+lon)
  return ((Math.atan2(dx, dy) * 180) / Math.PI + 360) % 360
}

function initPlane(id: number): AnimPlane {
  const route = FLIGHT_ROUTES[id % FLIGHT_ROUTES.length]
  const progress = Math.random()
  const speed = 0.0004 + Math.random() * 0.0003 // varied speeds
  const lon = lerp(route.from[0], route.to[0], progress)
  const lat = lerp(route.from[1], route.to[1], progress)
  // Heading from current position toward destination
  const hdg = screenHeading(lon, lat, route.to[0], route.to[1])
  return { id, from: route.from, to: route.to, progress, speed, heading: hdg, lon, lat }
}

function PlaneIcon({ heading }: { heading: number }) {
  return (
    <div style={{ transform: `rotate(${heading}deg)`, transformOrigin: 'center center' }}>
      <svg width="18" height="18" viewBox="-12 -14 24 28" overflow="visible">
        <path
          d="M 0,-10 L 2,0 L 8,3 L 8,5 L 2,3 L 1.5,9 L 3,10.5 L 3,12 L 0,11 L -3,12 L -3,10.5 L -1.5,9 L -2,3 L -8,5 L -8,3 L -2,0 Z"
          fill="#4ade80"
          fillOpacity={0.7}
          stroke="#4ade80"
          strokeWidth={0.5}
          strokeOpacity={0.4}
        />
      </svg>
    </div>
  )
}

function OnboardingMap() {
  const mapRef = useRef<MapRef>(null)
  const [ready, setReady] = useState(false)
  const [planes, setPlanes] = useState<AnimPlane[]>(() =>
    Array.from({ length: FLIGHT_ROUTES.length }, (_, i) => initPlane(i)),
  )
  const planesRef = useRef(planes)
  planesRef.current = planes

  // Animate planes
  useEffect(() => {
    if (!ready) return
    let raf: number
    function tick() {
      setPlanes((prev) =>
        prev.map((p) => {
          let next = p.progress + p.speed
          if (next >= 1) {
            // Pick a new random route
            const route = FLIGHT_ROUTES[Math.floor(Math.random() * FLIGHT_ROUTES.length)]
            const hdg = screenHeading(route.from[0], route.from[1], route.to[0], route.to[1])
            return { ...p, from: route.from, to: route.to, progress: 0, heading: hdg, lon: route.from[0], lat: route.from[1], speed: 0.0004 + Math.random() * 0.0003 }
          }
          const newLon = lerp(p.from[0], p.to[0], next)
          const newLat = lerp(p.from[1], p.to[1], next)
          // Recalculate heading from current position toward destination
          const hdg = screenHeading(newLon, newLat, p.to[0], p.to[1])
          return {
            ...p,
            progress: next,
            lon: newLon,
            lat: newLat,
            heading: hdg,
          }
        }),
      )
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [ready])

  return (
    <div className="absolute inset-0">
      <Map
        ref={mapRef}
        initialViewState={{ longitude: 15, latitude: 30, zoom: 1.8, bearing: 0, pitch: 0 }}
        onLoad={() => setReady(true)}
        mapStyle={MAP_STYLE}
        style={{ width: '100%', height: '100%' }}
        attributionControl={false}
        interactive={false}
      >
        {ready && planes.map((p) => (
          <Marker key={p.id} longitude={p.lon} latitude={p.lat} anchor="center">
            <PlaneIcon heading={p.heading} />
          </Marker>
        ))}
      </Map>
      {/* Dark overlay so text is readable */}
      <div className="absolute inset-0 bg-gray-950/75 backdrop-blur-[1px]" />
    </div>
  )
}

// ── Stepper ──────────────────────────────────────────────────────────────

const STEPS = ['Identity', 'Loan', 'Aircraft', 'SimBrief'] as const

function Stepper({ current }: { current: number }) {
  return (
    <div className="flex items-center gap-0 mb-8">
      {STEPS.map((label, i) => (
        <div key={label} className="flex items-center">
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
            i < current  ? 'text-emerald-500' :
            i === current ? 'text-gray-100 bg-gray-700/80 ring-1 ring-gray-600' :
                           'text-gray-600'
          }`}>
            {i < current ? '✓' : i + 1}
            <span className="hidden sm:inline">{label}</span>
          </div>
          {i < STEPS.length - 1 && (
            <span className={`mx-2 ${i < current ? 'text-emerald-700' : 'text-gray-800'}`}>—</span>
          )}
        </div>
      ))}
    </div>
  )
}

// ── Main ─────────────────────────────────────────────────────────────────

export function OnboardingPage({ onComplete }: { onComplete: () => void }) {
  const navigate = useNavigate()
  const [step, setStep] = useState(0)

  // Step 1 — Identity
  const [name, setName]               = useState('')
  const [airlineCode, setAirlineCode] = useState('')
  const [hubIcao, setHubIcao]         = useState('')

  // Step 2 — Loan
  const [loanOptions, setLoanOptions] = useState<LoanOption[]>([])
  const [selectedLoan, setSelectedLoan] = useState('standard')

  // Step 3 — Aircraft
  const [catalog, setCatalog]             = useState<CatalogEntry[]>([])
  const [selectedType, setSelectedType]   = useState('')
  const [aircraftMode, setAircraftMode]   = useState<'lease' | 'buy'>('lease')
  const [skipAircraft, setSkipAircraft]   = useState(false)

  // Step 4 — SimBrief
  const [simbriefUsername, setSimbriefUsername] = useState('')

  // State
  const [submitting, setSubmitting] = useState(false)
  const [error, setError]           = useState<string | null>(null)

  // Load data
  useEffect(() => {
    api.loanOptions().then(setLoanOptions).catch(console.error)
    api.catalog().then((c) => {
      setCatalog(c)
      if (c.length > 0) setSelectedType(c[0].icaoType)
    }).catch(console.error)
  }, [])

  const chosenLoan    = loanOptions.find((l) => l.key === selectedLoan)
  const chosenAircraft = catalog.find((c) => c.icaoType === selectedType)
  const capital        = chosenLoan?.principal ?? 0
  const aircraftCost   = (!skipAircraft && chosenAircraft)
    ? (aircraftMode === 'buy' ? chosenAircraft.purchasePrice : chosenAircraft.leaseCostMo)
    : 0
  const capitalAfter   = capital - aircraftCost

  // ── Submit ───────────────────────────────────────────────────────────────

  async function handleSubmit() {
    setError(null)
    setSubmitting(true)
    try {
      await api.setupCompany({
        name:             name.trim(),
        airlineCode:      airlineCode.trim(),
        hubIcao:          hubIcao.trim(),
        loanOption:       selectedLoan,
        aircraftIcaoType: skipAircraft ? undefined : selectedType,
        aircraftMode:     skipAircraft ? undefined : aircraftMode,
        simbriefUsername:  simbriefUsername.trim() || undefined,
      })
      onComplete()
      navigate('/')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Setup failed')
    } finally {
      setSubmitting(false)
    }
  }

  // ── Validation per step ──────────────────────────────────────────────────

  const step1Valid = name.trim().length >= 1 && airlineCode.trim().length >= 2 && hubIcao.trim().length >= 3
  const step2Valid = !!chosenLoan
  const step3Valid = skipAircraft || (!!chosenAircraft && capitalAfter >= 0)

  function canAdvance() {
    if (step === 0) return step1Valid
    if (step === 1) return step2Valid
    if (step === 2) return step3Valid
    return true
  }

  function handleNext() {
    if (step < 3) setStep(step + 1)
    else handleSubmit()
  }

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="relative min-h-screen text-gray-100 overflow-hidden">
      {/* Animated map background */}
      <OnboardingMap />

      {/* Content overlay */}
      <div className="relative z-10 flex items-center justify-center min-h-screen p-8">
        <div className="w-full max-w-2xl">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold tracking-tight">
              <span className="text-emerald-400">Thrust</span>line
            </h1>
            <p className="text-gray-400 text-sm mt-2">Set up your airline</p>
          </div>

          <Stepper current={step} />

          {/* Step content */}
          <div className="rounded-xl border border-gray-700/50 bg-gray-900/90 backdrop-blur-md p-8 space-y-6 shadow-2xl">

            {/* ── Step 1: Identity ──────────────────────────────────────── */}
            {step === 0 && (
              <>
                <h2 className="text-lg font-semibold text-gray-200">Your airline</h2>
                <div className="space-y-4">
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">Airline name</label>
                    <input
                      type="text" maxLength={60} placeholder="My Airline"
                      value={name} onChange={(e) => setName(e.target.value)}
                      className="w-full bg-gray-800/80 border border-gray-700 rounded px-4 py-2.5 text-sm text-gray-200 focus:outline-none focus:border-emerald-500/50 placeholder-gray-600"
                      autoFocus
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs text-gray-500 block mb-1">Airline code (2-3 chars)</label>
                      <input
                        type="text" maxLength={3} placeholder="THL"
                        value={airlineCode} onChange={(e) => setAirlineCode(e.target.value.toUpperCase())}
                        className="w-full bg-gray-800/80 border border-gray-700 rounded px-4 py-2.5 text-sm text-gray-200 font-mono focus:outline-none focus:border-emerald-500/50 placeholder-gray-600 uppercase"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 block mb-1">Hub airport (ICAO)</label>
                      <input
                        type="text" maxLength={4} placeholder="LFPG"
                        value={hubIcao} onChange={(e) => setHubIcao(e.target.value.toUpperCase())}
                        className="w-full bg-gray-800/80 border border-gray-700 rounded px-4 py-2.5 text-sm text-gray-200 font-mono focus:outline-none focus:border-emerald-500/50 placeholder-gray-600 uppercase"
                      />
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* ── Step 2: Loan ──────────────────────────────────────────── */}
            {step === 1 && (
              <>
                <h2 className="text-lg font-semibold text-gray-200">Starting capital</h2>
                <p className="text-xs text-gray-500">Choose a bank loan to fund your airline. Repaid monthly over 5 years at 3% interest.</p>
                <div className="grid grid-cols-3 gap-4">
                  {loanOptions.map((l) => (
                    <button
                      key={l.key}
                      onClick={() => setSelectedLoan(l.key)}
                      className={`rounded-lg border p-5 text-left transition-all ${
                        selectedLoan === l.key
                          ? 'border-emerald-500/50 bg-emerald-500/5 ring-1 ring-emerald-500/30'
                          : 'border-gray-700 bg-gray-800/50 hover:border-gray-600'
                      }`}
                    >
                      <div className="text-xs text-gray-500 mb-1">{l.label}</div>
                      <div className="text-xl font-bold text-gray-100 font-mono">{fmtUsd(l.principal)}</div>
                      <div className="text-xs text-gray-500 mt-2">
                        {fmtUsd(l.monthlyPayment)}/mo for {l.totalMonths} months
                      </div>
                      <div className="text-xs text-gray-600 mt-1">
                        Total repaid: {fmtUsd(l.monthlyPayment * l.totalMonths)}
                      </div>
                    </button>
                  ))}
                </div>
              </>
            )}

            {/* ── Step 3: Aircraft ──────────────────────────────────────── */}
            {step === 2 && (
              <>
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-gray-200">First aircraft</h2>
                  <label className="flex items-center gap-2 text-xs text-gray-500 cursor-pointer">
                    <input
                      type="checkbox" checked={skipAircraft}
                      onChange={(e) => setSkipAircraft(e.target.checked)}
                      className="rounded border-gray-600"
                    />
                    Skip — I'll add one later
                  </label>
                </div>

                {!skipAircraft && (
                  <div className="space-y-4">
                    {/* Mode toggle */}
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setAircraftMode('lease')}
                        className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                          aircraftMode === 'lease'
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                            : 'bg-gray-800 text-gray-500 border border-gray-700'
                        }`}
                      >Lease</button>
                      <button
                        onClick={() => setAircraftMode('buy')}
                        className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                          aircraftMode === 'buy'
                            ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                            : 'bg-gray-800 text-gray-500 border border-gray-700'
                        }`}
                      >Buy</button>
                      <span className="text-xs text-gray-600 ml-2">
                        Capital: <span className="font-mono text-gray-400">{fmtUsd(capital)}</span>
                      </span>
                    </div>

                    <select
                      value={selectedType}
                      onChange={(e) => setSelectedType(e.target.value)}
                      className="w-full bg-gray-800/80 border border-gray-700 rounded px-3 py-2.5 text-sm text-gray-200 focus:outline-none focus:border-gray-500"
                    >
                      {catalog.map((c) => (
                        <option key={c.icaoType} value={c.icaoType}>
                          {c.name} ({c.icaoType}) — {aircraftMode === 'buy'
                            ? fmtUsd(c.purchasePrice)
                            : `${fmtUsd(c.leaseCostMo)}/mo`}
                        </option>
                      ))}
                    </select>

                    {chosenAircraft && (
                      <div className="rounded bg-gray-800/60 p-4 text-xs text-gray-400 space-y-1.5">
                        <div className="grid grid-cols-3 gap-3">
                          <div><span className="text-gray-500 block">Category</span><span className="text-gray-200 capitalize">{chosenAircraft.category}</span></div>
                          <div><span className="text-gray-500 block">Seats</span><span className="text-gray-200">{chosenAircraft.seatsEco + chosenAircraft.seatsBiz}</span></div>
                          <div><span className="text-gray-500 block">Range</span><span className="text-gray-200">{chosenAircraft.rangeNm.toLocaleString()} nm</span></div>
                        </div>
                        <div className="border-t border-gray-700 pt-1.5 flex justify-between">
                          <span>Cost</span>
                          <span className="font-mono text-gray-200">
                            {aircraftMode === 'buy' ? fmtUsd(chosenAircraft.purchasePrice) : `${fmtUsd(chosenAircraft.leaseCostMo)}/mo`}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span>Capital after</span>
                          <span className={`font-mono font-semibold ${capitalAfter >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                            {fmtUsd(capitalAfter)}
                          </span>
                        </div>
                        {capitalAfter < 0 && (
                          <p className="text-red-400 mt-1">Insufficient capital — choose a smaller aircraft or a bigger loan.</p>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </>
            )}

            {/* ── Step 4: SimBrief ──────────────────────────────────────── */}
            {step === 3 && (
              <>
                <h2 className="text-lg font-semibold text-gray-200">SimBrief integration</h2>
                <p className="text-xs text-gray-500">
                  Connect your SimBrief account to generate flight plans directly from Thrustline.
                  You can always add this later in Settings.
                </p>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">SimBrief username</label>
                  <input
                    type="text" maxLength={64} placeholder="Your SimBrief username (optional)"
                    value={simbriefUsername} onChange={(e) => setSimbriefUsername(e.target.value)}
                    className="w-full bg-gray-800/80 border border-gray-700 rounded px-4 py-2.5 text-sm text-gray-200 focus:outline-none focus:border-emerald-500/50 placeholder-gray-600"
                  />
                </div>

                {/* Summary */}
                <div className="rounded bg-gray-800/60 p-4 text-xs space-y-2 border border-gray-700/50">
                  <h3 className="text-sm font-semibold text-gray-300 mb-2">Summary</h3>
                  <div className="flex justify-between"><span className="text-gray-500">Airline</span><span className="text-gray-200">{name || '—'} ({airlineCode || '—'})</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Hub</span><span className="text-gray-200 font-mono">{hubIcao || '—'}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Loan</span><span className="text-gray-200 font-mono">{fmtUsd(chosenLoan?.principal ?? 0)} at {fmtUsd(chosenLoan?.monthlyPayment ?? 0)}/mo</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Aircraft</span><span className="text-gray-200">{skipAircraft ? 'None' : `${chosenAircraft?.name ?? '—'} (${aircraftMode})`}</span></div>
                  {simbriefUsername && <div className="flex justify-between"><span className="text-gray-500">SimBrief</span><span className="text-gray-200">{simbriefUsername}</span></div>}
                </div>
              </>
            )}

            {/* Error */}
            {error && (
              <div className="text-xs px-4 py-2.5 rounded-lg border bg-red-500/10 text-red-300 border-red-500/20">
                {error}
              </div>
            )}

            {/* Navigation */}
            <div className="flex items-center justify-between pt-2">
              {step > 0 ? (
                <button
                  onClick={() => setStep(step - 1)}
                  className="px-4 py-2 rounded text-sm text-gray-400 hover:text-gray-200 transition-colors"
                >
                  ← Back
                </button>
              ) : <div />}

              <button
                onClick={handleNext}
                disabled={!canAdvance() || submitting}
                className="px-6 py-2.5 rounded-lg text-sm font-semibold bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-white transition-colors"
              >
                {submitting
                  ? 'Creating…'
                  : step === 3
                    ? 'Launch your airline'
                    : 'Continue →'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
