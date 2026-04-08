import { useEffect, useRef, useState } from 'react'
import { useSim } from '../contexts/SimContext'
import { useCompany } from '../hooks/useCompany'
import { api } from '../lib/api'
import { getAirport, AIRPORT_DB_SIZE } from '../data/airports'
import type { AirportInfo } from '../data/airports'
import type { Dispatch, SimbriefOFPSummary, Aircraft, CatalogEntry } from '../types/thrustline'

// ── Helpers ───────────────────────────────────────────────────────────────

function haversineNm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R   = 3440.065
  const φ1  = (lat1 * Math.PI) / 180, φ2 = (lat2 * Math.PI) / 180
  const Δφ  = ((lat2 - lat1) * Math.PI) / 180
  const Δλ  = ((lon2 - lon1) * Math.PI) / 180
  const a   = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)))
}

function fmtFuel(lbs: number) {
  return lbs >= 1000 ? `${(lbs / 1000).toFixed(1)}K lbs` : `${lbs} lbs`
}

function fmtFlightTime(t: string) {
  if (!t || t.length < 4) return t
  return `${t.slice(0, 2)}h${t.slice(2)}`
}

const STATUS_STYLES: Record<string, string> = {
  pending:    'bg-gray-700 text-gray-300',
  dispatched: 'bg-blue-500/15 text-blue-400 border border-blue-500/25',
  flying:     'bg-emerald-500/15 text-emerald-400 border border-emerald-500/25',
  completed:  'bg-emerald-500/10 text-emerald-600 border border-emerald-500/15',
}

const STATUS_LABELS: Record<string, string> = {
  pending:    'Pending',
  dispatched: 'Dispatched',
  flying:     '▶ Flying',
  completed:  '✓ Completed',
}

// ── OFP card ──────────────────────────────────────────────────────────────

function OFPSummaryCard({ ofp }: { ofp: SimbriefOFPSummary }) {
  return (
    <div className="mt-3 rounded bg-gray-800/60 p-3 space-y-2 text-xs">
      <div className="font-medium text-blue-300">OFP — {ofp.flightNumber} · {ofp.origin}→{ofp.destination}</div>
      <div className="text-gray-400 font-mono leading-relaxed break-all">{ofp.route || '—'}</div>
      <div className="grid grid-cols-3 gap-2 pt-2 border-t border-gray-700">
        <div>
          <span className="text-gray-500 block">Fuel (ramp)</span>
          <span className="text-gray-200 font-mono">{fmtFuel(ofp.fuelPlanLbs)}</span>
        </div>
        <div>
          <span className="text-gray-500 block">Block time</span>
          <span className="text-gray-200 font-mono">{fmtFlightTime(ofp.flightTime) || '—'}</span>
        </div>
        <div>
          <span className="text-gray-500 block">Cruise</span>
          <span className="text-gray-200 font-mono">FL{(parseInt(ofp.cruiseAlt) / 100).toFixed(0)}</span>
        </div>
        <div>
          <span className="text-gray-500 block">Pax</span>
          <span className="text-gray-200 font-mono">{ofp.paxCount}</span>
        </div>
        <div>
          <span className="text-gray-500 block">Cargo</span>
          <span className="text-gray-200 font-mono">{Math.round(ofp.cargoLbs * 0.453)} kg</span>
        </div>
        <div>
          <span className="text-gray-500 block">Generated</span>
          <span className="text-gray-200 font-mono">
            {ofp.generatedAt ? new Date(ofp.generatedAt * 1000).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : '—'}
          </span>
        </div>
      </div>
    </div>
  )
}

// ── Dispatch card ─────────────────────────────────────────────────────────

// ── Workflow stepper ──────────────────────────────────────────────────────

const STEPS = [
  { key: 'pending',    label: 'Plan' },
  { key: 'dispatched', label: 'SimBrief' },
  { key: 'flying',     label: 'Airborne' },
  { key: 'completed',  label: 'Done' },
] as const

const STEP_ORDER: Record<string, number> = { pending: 0, dispatched: 1, flying: 2, completed: 3 }

function WorkflowStepper({ status }: { status: string }) {
  const current = STEP_ORDER[status] ?? 0
  return (
    <div className="flex items-center gap-0 text-xs select-none">
      {STEPS.map((step, i) => {
        const done   = current > i
        const active = current === i
        return (
          <div key={step.key} className="flex items-center">
            <span className={`px-2 py-0.5 rounded-full font-medium transition-colors ${
              done   ? 'text-emerald-500'       :
              active ? 'text-gray-200 bg-gray-700 ring-1 ring-gray-600' :
                       'text-gray-700'
            }`}>
              {done ? '✓ ' : ''}{step.label}
            </span>
            {i < STEPS.length - 1 && (
              <span className={`mx-1 ${done ? 'text-emerald-700' : 'text-gray-800'}`}>›</span>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── Dispatch card ─────────────────────────────────────────────────────────

function DispatchCard({
  dispatch,
  hasSimbriefUsername,
  onDelete,
  onRefresh,
}: {
  dispatch: Dispatch
  hasSimbriefUsername: boolean
  onDelete: (id: string) => void
  onRefresh: () => void
}) {
  const [fetchingOfp, setFetchingOfp] = useState(false)
  const [boarding,    setBoarding]    = useState(false)
  const [fetchError,  setFetchError]  = useState<string | null>(null)

  const src  = getAirport(dispatch.originIcao)
  const dst  = getAirport(dispatch.destIcao)
  const ofp  = dispatch.ofpData ? (JSON.parse(dispatch.ofpData) as SimbriefOFPSummary) : null
  const isCompleted = dispatch.status === 'completed'
  const isFlying    = dispatch.status === 'flying'

  async function handleOpenSimbrief() {
    try {
      const { url } = await api.simbriefUrl(dispatch.id)
      await window.thrustline.openExternal(url)
      onRefresh()
    } catch (err: unknown) {
      console.error(err)
    }
  }

  async function handleFetchOfp() {
    setFetchingOfp(true)
    setFetchError(null)
    try {
      await api.fetchOfp(dispatch.id)
      onRefresh()
    } catch (err: unknown) {
      setFetchError(err instanceof Error ? err.message : 'Fetch failed')
    } finally {
      setFetchingOfp(false)
    }
  }

  async function handleBoard() {
    setBoarding(true)
    try {
      await api.setDispatchStatus(dispatch.id, 'flying')
      onRefresh()
    } catch (err: unknown) {
      setFetchError(err instanceof Error ? err.message : 'Failed')
    } finally {
      setBoarding(false)
    }
  }

  return (
    <div className={`rounded-lg border p-4 space-y-3 ${
      isCompleted ? 'border-gray-800 opacity-70' :
      isFlying    ? 'border-emerald-600/30 bg-emerald-950/10' :
                    'border-gray-700 bg-gray-900'
    }`}>
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="font-mono font-semibold text-gray-100">{dispatch.flightNumber}</span>
            <span className="font-mono text-gray-400">
              {dispatch.originIcao} → {dispatch.destIcao}
            </span>
            <span className="text-xs font-mono bg-gray-800 text-gray-500 px-1.5 py-0.5 rounded">
              {dispatch.icaoType}
            </span>
          </div>
          {(src || dst) && (
            <div className="text-xs text-gray-600">
              {src?.city ?? dispatch.originIcao} → {dst?.city ?? dispatch.destIcao}
              {dispatch.distanceNm > 0 && ` · ${Math.round(dispatch.distanceNm)} nm`}
            </div>
          )}
          <WorkflowStepper status={dispatch.status} />
        </div>
        {!isCompleted && (
          <button
            onClick={() => onDelete(dispatch.id)}
            className="text-gray-700 hover:text-red-400 text-sm transition-colors mt-0.5"
            title="Delete dispatch"
          >
            ✕
          </button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3 text-xs">
        <div>
          <span className="text-gray-500 block">Economy</span>
          <span className="text-gray-300 font-mono">{dispatch.ecoPax} pax</span>
        </div>
        <div>
          <span className="text-gray-500 block">Business</span>
          <span className="text-gray-300 font-mono">{dispatch.bizPax} pax</span>
        </div>
        <div>
          <span className="text-gray-500 block">Cargo</span>
          <span className="text-gray-300 font-mono">{Math.round(dispatch.cargoKg).toLocaleString()} kg</span>
        </div>
        <div>
          <span className="text-gray-500 block">Est. fuel</span>
          <span className="text-gray-300 font-mono">{fmtFuel(dispatch.estimFuelLbs)}</span>
        </div>
      </div>

      {/* OFP data */}
      {ofp && <OFPSummaryCard ofp={ofp} />}
      {fetchError && <p className="text-xs text-red-400">{fetchError}</p>}

      {/* Actions — contextual per status */}
      {isFlying && (
        <div className="flex items-center gap-3 pt-1 border-t border-gray-800">
          <span className="text-xs text-emerald-500 animate-pulse">● Airborne — waiting for landing…</span>
          {hasSimbriefUsername && (
            <button
              onClick={handleFetchOfp}
              disabled={fetchingOfp}
              className="ml-auto px-3 py-1.5 rounded text-xs font-medium bg-gray-700 text-gray-300 hover:bg-gray-600 disabled:opacity-40 transition-colors"
            >
              {fetchingOfp ? 'Fetching…' : '↓ Fetch OFP'}
            </button>
          )}
        </div>
      )}

      {!isCompleted && !isFlying && (
        <div className="flex flex-wrap gap-2 pt-1 border-t border-gray-800">
          {/* SimBrief */}
          <button
            onClick={handleOpenSimbrief}
            className="px-3 py-1.5 rounded text-xs font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20 hover:bg-blue-500/20 transition-colors"
          >
            ✈ Open in SimBrief
          </button>

          {/* Fetch OFP */}
          {hasSimbriefUsername && (
            <button
              onClick={handleFetchOfp}
              disabled={fetchingOfp}
              className="px-3 py-1.5 rounded text-xs font-medium bg-gray-700 text-gray-300 hover:bg-gray-600 disabled:opacity-40 transition-colors"
            >
              {fetchingOfp ? 'Fetching…' : '↓ Fetch OFP'}
            </button>
          )}

          {/* Board — manual start */}
          <button
            onClick={handleBoard}
            disabled={boarding}
            className="ml-auto px-3 py-1.5 rounded text-xs font-semibold bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-600/30 disabled:opacity-40 transition-colors"
            title="Mark this flight as started — happens automatically on takeoff if SimConnect is active"
          >
            {boarding ? 'Starting…' : '▶ Board'}
          </button>
        </div>
      )}

      {isCompleted && dispatch.flightId && (
        <div className="text-xs text-gray-600 pt-1 border-t border-gray-800">
          ✓ Flight logged · ID {dispatch.flightId.slice(0, 8)}…
        </div>
      )}

      {!hasSimbriefUsername && !isCompleted && !isFlying && (
        <p className="text-xs text-gray-700">Add SimBrief username in Settings to fetch OFP</p>
      )}
    </div>
  )
}

// ── Airport lookup with API fallback ─────────────────────────────────────────

type ResolvedAirport = AirportInfo | null | 'loading'

function useAirportLookup(icao: string): ResolvedAirport {
  const cache  = useRef<Record<string, AirportInfo | null>>({})
  const [info, setInfo] = useState<ResolvedAirport>(null)

  useEffect(() => {
    const code = icao.trim().toUpperCase()
    if (code.length < 3) { setInfo(null); return }

    // 1. Static DB — instant
    const local = getAirport(code)
    if (local) { setInfo(local); return }

    // 2. Cache hit from a previous API call
    if (code in cache.current) { setInfo(cache.current[code]); return }

    // 3. Only query API once the code looks like a complete ICAO (≥4 chars)
    if (code.length < 4) { setInfo(null); return }

    setInfo('loading')
    api.lookupAirport(code)
      .then((result) => { cache.current[code] = result; setInfo(result) })
      .catch(() => { cache.current[code] = null; setInfo(null) })
  }, [icao])

  return info
}

function AirportHint({ info }: { info: ResolvedAirport }) {
  if (info === 'loading') return <p className="text-xs text-gray-500 mt-0.5 animate-pulse">Looking up…</p>
  if (info)               return <p className="text-xs text-gray-600 mt-0.5">{info.city}{info.country ? ` · ${info.country}` : ''}</p>
  return null
}

// ── New dispatch form ─────────────────────────────────────────────────────

function NewDispatchForm({
  fleet,
  catalog,
  activeAircraftId,
  onCreated,
}: {
  fleet: Aircraft[]
  catalog: CatalogEntry[]
  activeAircraftId: string | null
  onCreated: () => void
}) {
  const [origin,     setOrigin]     = useState('')
  const [dest,       setDest]       = useState('')
  const [aircraftId, setAircraftId] = useState(activeAircraftId ?? fleet[0]?.id ?? '')
  const [loading,    setLoading]    = useState(false)
  const [error,      setError]      = useState<string | null>(null)

  const originInfo = useAirportLookup(origin)
  const destInfo   = useAirportLookup(dest)

  // Sync active aircraft default when it loads
  useEffect(() => {
    if (activeAircraftId) setAircraftId(activeAircraftId)
  }, [activeAircraftId])

  // Selected aircraft specs from catalog
  const selectedAircraft = fleet.find((a) => a.id === aircraftId)
  const selectedSpec     = catalog.find((c) => c.icaoType === selectedAircraft?.icaoType)

  // Compute preview when both airports are resolved
  const srcApt = originInfo !== 'loading' ? originInfo : null
  const dstApt = destInfo   !== 'loading' ? destInfo   : null

  const preview = srcApt && dstApt ? (() => {
    const distNm  = haversineNm(srcApt.lat, srcApt.lon, dstApt.lat, dstApt.lon)
    const ecoSeats   = selectedSpec?.seatsEco ?? 150
    const bizSeats   = selectedSpec?.seatsBiz ?? 12
    const fuelPerNm  = selectedSpec?.fuelLbsPerNm ?? 45
    const baseLf  = distNm < 800 ? 0.72 : distNm < 2500 ? 0.78 : 0.85
    const ecoPax  = Math.round(ecoSeats * baseLf)
    const bizPax  = Math.round(bizSeats * baseLf)
    const cargoKg = Math.round((ecoPax + bizPax) * 23 + 1000)
    const fuelLbs = Math.round(distNm * fuelPerNm * 1.22)
    return { ecoPax, bizPax, cargoKg, estimFuelLbs: fuelLbs, distanceNm: distNm }
  })() : null

  // Range check
  const outOfRange = !!(preview && selectedSpec && preview.distanceNm > selectedSpec.rangeNm)

  async function handleCreate() {
    setError(null)
    const o = origin.trim().toUpperCase()
    const d = dest.trim().toUpperCase()
    if (o.length < 3 || d.length < 3) { setError('Enter valid ICAO codes (3-4 chars)'); return }
    if (o === d)                        { setError('Origin and destination must differ'); return }

    // Resolve airports — use already-fetched state, or fall back to direct API call
    let src = srcApt
    let dst = dstApt
    if (!src) {
      try { src = await api.lookupAirport(o) } catch { /* will error below */ }
    }
    if (!dst) {
      try { dst = await api.lookupAirport(d) } catch { /* will error below */ }
    }
    if (!src) { setError(`Airport "${o}" not found — check the ICAO code`); return }
    if (!dst) { setError(`Airport "${d}" not found — check the ICAO code`); return }

    const distNm = haversineNm(src.lat, src.lon, dst.lat, dst.lon)

    setLoading(true)
    try {
      await api.createDispatch({ originIcao: o, destIcao: d, distanceNm: distNm, aircraftId })
      setOrigin(''); setDest(''); setError(null)
      onCreated()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create dispatch')
    } finally {
      setLoading(false)
    }
  }

  const originUnknown = origin.length >= 4 && originInfo === null
  const destUnknown   = dest.length   >= 4 && destInfo   === null

  return (
    <div className="rounded-lg border border-gray-700 bg-gray-900 p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-300">New dispatch</h2>
        <span className="text-xs text-gray-700">{AIRPORT_DB_SIZE.toLocaleString()} airports in DB</span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {/* Origin */}
        <div>
          <label className="text-xs text-gray-500 block mb-1">Origin ICAO</label>
          <input
            type="text" maxLength={4} placeholder="LFPG"
            value={origin}
            onChange={(e) => setOrigin(e.target.value.toUpperCase())}
            className={`w-full bg-gray-800 border rounded px-3 py-2 text-sm text-gray-200 font-mono focus:outline-none uppercase placeholder-gray-600 ${
              originUnknown ? 'border-amber-500/50 focus:border-amber-400' : 'border-gray-700 focus:border-gray-500'
            }`}
          />
          {origin.length >= 3 && (
            originUnknown
              ? <p className="text-xs text-amber-500/80 mt-0.5">Unknown airport</p>
              : <AirportHint info={originInfo} />
          )}
        </div>

        {/* Destination */}
        <div>
          <label className="text-xs text-gray-500 block mb-1">Destination ICAO</label>
          <input
            type="text" maxLength={4} placeholder="LSGG"
            value={dest}
            onChange={(e) => setDest(e.target.value.toUpperCase())}
            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            className={`w-full bg-gray-800 border rounded px-3 py-2 text-sm text-gray-200 font-mono focus:outline-none uppercase placeholder-gray-600 ${
              destUnknown ? 'border-amber-500/50 focus:border-amber-400' : 'border-gray-700 focus:border-gray-500'
            }`}
          />
          {dest.length >= 3 && (
            destUnknown
              ? <p className="text-xs text-amber-500/80 mt-0.5">Unknown airport</p>
              : <AirportHint info={destInfo} />
          )}
        </div>
      </div>

      {/* Aircraft selector */}
      {fleet.length > 1 && (
        <div>
          <label className="text-xs text-gray-500 block mb-1">Aircraft</label>
          <select
            value={aircraftId}
            onChange={(e) => setAircraftId(e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-gray-500"
          >
            {fleet.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name} ({a.icaoType}){activeAircraftId === a.id ? ' — Active' : ''}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Live preview */}
      {preview && (
        <div className="space-y-2">
          <div className="rounded bg-gray-800/50 p-3 text-xs grid grid-cols-4 gap-3">
            <div>
              <span className="text-gray-500 block">Distance</span>
              <span className={`font-mono ${outOfRange ? 'text-red-400' : 'text-gray-300'}`}>{preview.distanceNm} nm</span>
            </div>
            <div>
              <span className="text-gray-500 block">Pax (est.)</span>
              <span className="text-gray-300 font-mono">{preview.ecoPax + preview.bizPax}</span>
            </div>
            <div>
              <span className="text-gray-500 block">Cargo (est.)</span>
              <span className="text-gray-300 font-mono">{preview.cargoKg.toLocaleString()} kg</span>
            </div>
            <div>
              <span className="text-gray-500 block">Fuel (est.)</span>
              <span className="text-gray-300 font-mono">{fmtFuel(preview.estimFuelLbs)}</span>
            </div>
          </div>
          {outOfRange && selectedSpec && (
            <div className="text-xs px-3 py-2 rounded-lg border bg-red-500/10 text-red-300 border-red-500/20">
              Out of range — {selectedAircraft?.name ?? selectedSpec.icaoType} can fly {selectedSpec.rangeNm.toLocaleString()} nm max, this route is {preview.distanceNm.toLocaleString()} nm.
              Use a longer-range aircraft.
            </div>
          )}
        </div>
      )}

      {error && <p className="text-xs text-red-400">{error}</p>}

      <button
        onClick={handleCreate}
        disabled={loading || outOfRange}
        className="w-full py-2 rounded text-sm font-semibold bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-white transition-colors"
      >
        {loading ? 'Generating…' : outOfRange ? 'Out of range' : 'Generate dispatch'}
      </button>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────

export function DispatchPage() {
  const { flightCount } = useSim()
  const { company }     = useCompany(flightCount)

  const [dispatches,  setDispatches]  = useState<Dispatch[]>([])
  const [loading,     setLoading]     = useState(true)
  const [showForm,    setShowForm]    = useState(false)
  const [actionKey,   setActionKey]   = useState(0)

  const refreshKey = flightCount + actionKey

  useEffect(() => {
    setLoading(true)
    api.dispatches()
      .then(setDispatches)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [refreshKey])

  // Auto-refresh when Electron fires dispatch:updated (takeoff detection, landing link)
  useEffect(() => {
    window.thrustline.onDispatchUpdated(() => setActionKey((k) => k + 1))
    return () => window.thrustline.offAll()
  }, [])

  async function handleDelete(id: string) {
    await api.deleteDispatch(id).catch(console.error)
    setActionKey((k) => k + 1)
  }

  // Load catalog for range checking
  const [catalog, setCatalog] = useState<CatalogEntry[]>([])
  useEffect(() => {
    api.catalog().then(setCatalog).catch(console.error)
  }, [])

  const active    = dispatches.filter((d) => d.status !== 'completed')
  const completed = dispatches.filter((d) => d.status === 'completed')
  const fleet     = company?.fleet ?? []
  const hasSimbriefUsername = !!(company?.simbriefUsername?.trim())

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-lg font-semibold text-gray-200">Dispatch</h1>
          <p className="text-xs text-gray-500 mt-0.5">
            {active.length} active · {completed.length} completed
            {!hasSimbriefUsername && (
              <span className="ml-2 text-amber-500">— Add SimBrief username in Settings</span>
            )}
          </p>
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="px-3 py-1.5 rounded text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 transition-colors"
        >
          {showForm ? 'Cancel' : '+ New dispatch'}
        </button>
      </div>

      {/* New dispatch form */}
      {showForm && (
        <NewDispatchForm
          fleet={fleet}
          catalog={catalog}
          activeAircraftId={company?.activeAircraftId ?? null}
          onCreated={() => { setShowForm(false); setActionKey((k) => k + 1) }}
        />
      )}

      {/* No SimBrief username warning */}
      {!hasSimbriefUsername && dispatches.length > 0 && (
        <div className="text-xs px-4 py-2.5 rounded-lg border bg-amber-500/10 text-amber-300 border-amber-500/20">
          SimBrief username not set — go to Settings to enable OFP fetching. You can still open SimBrief with pre-filled data.
        </div>
      )}

      {loading ? (
        <p className="text-sm text-gray-500">Loading…</p>
      ) : dispatches.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <p className="text-sm">No dispatches yet.</p>
          <p className="text-xs mt-1">Create a dispatch to pre-fill SimBrief and track your flights.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Active dispatches */}
          {active.map((d) => (
            <DispatchCard
              key={d.id}
              dispatch={d}
              hasSimbriefUsername={hasSimbriefUsername}
              onDelete={handleDelete}
              onRefresh={() => setActionKey((k) => k + 1)}
            />
          ))}

          {/* Completed — collapsible */}
          {completed.length > 0 && (
            <details className="group">
              <summary className="cursor-pointer text-xs text-gray-600 hover:text-gray-400 select-none list-none flex items-center gap-1 py-1">
                <span className="group-open:rotate-90 transition-transform inline-block">›</span>
                {completed.length} completed dispatch{completed.length > 1 ? 'es' : ''}
              </summary>
              <div className="space-y-3 mt-2">
                {completed.map((d) => (
                  <DispatchCard
                    key={d.id}
                    dispatch={d}
                    hasSimbriefUsername={hasSimbriefUsername}
                    onDelete={handleDelete}
                    onRefresh={() => setActionKey((k) => k + 1)}
                  />
                ))}
              </div>
            </details>
          )}
        </div>
      )}
    </div>
  )
}
