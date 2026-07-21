import { useEffect, useState } from 'react'
import { useSim } from '../contexts/SimContext'
import { api } from '../lib/api'
import type { Aircraft, CatalogEntry } from '../types/thrustline'

// ── Sub-components ────────────────────────────────────────────────────────

function HealthBar({ pct }: { pct: number }) {
  const color = pct >= 80 ? 'bg-emerald-500' : pct >= 50 ? 'bg-amber-500' : 'bg-red-500'
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-gray-800 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className={`text-xs font-mono w-10 text-right ${pct < 50 ? 'text-red-400' : pct < 80 ? 'text-amber-400' : 'text-emerald-400'}`}>
        {pct.toFixed(1)}%
      </span>
    </div>
  )
}

function StatusBadge({ healthPct }: { healthPct: number }) {
  if (healthPct < 50) {
    return (
      <span className="text-xs font-medium px-2 py-1 rounded bg-red-500/10 text-red-400 border border-red-500/20">
        GROUNDED
      </span>
    )
  }
  if (healthPct < 80) {
    return (
      <span className="text-xs font-medium px-2 py-1 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
        DEGRADED
      </span>
    )
  }
  return (
    <span className="text-xs font-medium px-2 py-1 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
      AIRWORTHY
    </span>
  )
}

function OwnershipBadge({ ownership }: { ownership: string }) {
  if (ownership === 'owned') {
    return (
      <span className="text-xs px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
        OWNED
      </span>
    )
  }
  return (
    <span className="text-xs px-1.5 py-0.5 rounded bg-gray-700 text-gray-400">
      LEASED
    </span>
  )
}

// ── Main component ────────────────────────────────────────────────────────

export function Fleet() {
  const { flightCount, leaseCount, aircraftVersion } = useSim()

  // Data state
  const [fleet, setFleet]       = useState<Aircraft[]>([])
  const [capital, setCapital]   = useState(0)
  const [loading, setLoading]   = useState(true)
  const [catalog, setCatalog]   = useState<CatalogEntry[]>([])

  // Action state
  const [maintainingId, setMaintainingId] = useState<string | null>(null)
  const [sellingId, setSellingId]         = useState<string | null>(null)
  const [acquiring, setAcquiring]         = useState(false)
  const [selectedType, setSelectedType]   = useState('')
  const [acquireMode, setAcquireMode]     = useState<'lease' | 'buy'>('lease')
  const [showAddForm, setShowAddForm]     = useState(false)
  const [actionMsg, setActionMsg]         = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)

  // Re-fetch key — increments after manual actions + monthly lease events
  const [actionKey, setActionKey] = useState(0)
  const refreshKey = flightCount + leaseCount + actionKey + aircraftVersion

  // Load fleet + capital
  useEffect(() => {
    setLoading(true)
    Promise.all([api.company(), api.fleet()])
      .then(([company, fleet]) => {
        setCapital(company.capital)
        setFleet(fleet)
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [refreshKey])

  // Load catalog once
  useEffect(() => {
    api.catalog()
      .then((c) => {
        setCatalog(c)
        if (c.length > 0) setSelectedType(c[0].icaoType)
      })
      .catch(console.error)
  }, [])

  function flash(kind: 'ok' | 'err', text: string) {
    setActionMsg({ kind, text })
    setTimeout(() => setActionMsg(null), 4000)
  }

  // ── Maintain ─────────────────────────────────────────────────────────────
  async function handleMaintain(aircraft: Aircraft) {
    const cost = Math.round((100 - aircraft.healthPct) * 500)
    if (capital < cost) {
      flash('err', `Insufficient capital. Need $${cost.toLocaleString()}.`)
      return
    }
    setMaintainingId(aircraft.id)
    try {
      const res = await api.maintainAircraft(aircraft.id)
      flash('ok', `${aircraft.name} restored to 100% — cost $${res.cost.toLocaleString()}`)
      setActionKey((k) => k + 1)
    } catch (err: unknown) {
      flash('err', err instanceof Error ? err.message : 'Maintenance failed')
    } finally {
      setMaintainingId(null)
    }
  }

  // ── Acquire (Lease or Buy) ───────────────────────────────────────────────
  async function handleAcquire() {
    const entry = catalog.find((c) => c.icaoType === selectedType)
    if (!entry) return

    const cost = acquireMode === 'buy' ? entry.purchasePrice : entry.leaseCostMo
    if (capital < cost) {
      flash('err', `Insufficient capital. Need $${cost.toLocaleString()}.`)
      return
    }

    setAcquiring(true)
    try {
      if (acquireMode === 'buy') {
        await api.buyAircraft(selectedType)
        flash('ok', `${entry.name} purchased and added to your fleet!`)
      } else {
        await api.leaseAircraft(selectedType)
        flash('ok', `${entry.name} leased and added to your fleet!`)
      }
      setShowAddForm(false)
      setActionKey((k) => k + 1)
    } catch (err: unknown) {
      flash('err', err instanceof Error ? err.message : 'Acquisition failed')
    } finally {
      setAcquiring(false)
    }
  }

  // ── Sell ──────────────────────────────────────────────────────────────────
  async function handleSell(aircraft: Aircraft) {
    setSellingId(aircraft.id)
    try {
      const res = await api.sellAircraft(aircraft.id)
      flash('ok', `${res.aircraftName} sold for $${res.salePrice.toLocaleString()}`)
      setActionKey((k) => k + 1)
    } catch (err: unknown) {
      flash('err', err instanceof Error ? err.message : 'Sale failed')
    } finally {
      setSellingId(null)
    }
  }

  // ── Activate aircraft ─────────────────────────────────────────────────────
  const [activeAircraftId, setActiveAircraftIdState] = useState<string | null>(null)

  // Sync active aircraft from company data
  useEffect(() => {
    api.company().then((c) => setActiveAircraftIdState(c.activeAircraftId)).catch(console.error)
  }, [refreshKey])

  async function handleActivate(aircraft: Aircraft) {
    try {
      await api.activateAircraft(aircraft.id)
      setActiveAircraftIdState(aircraft.id)
      flash('ok', `${aircraft.name} set as active aircraft`)
    } catch (err: unknown) {
      flash('err', err instanceof Error ? err.message : 'Failed to activate')
    }
  }

  // ── Helpers ───────────────────────────────────────────────────────────────
  const selectedEntry = catalog.find((c) => c.icaoType === selectedType)
  const acquireCost   = selectedEntry
    ? (acquireMode === 'buy' ? selectedEntry.purchasePrice : selectedEntry.leaseCostMo)
    : 0

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-lg font-semibold text-gray-200">Fleet</h1>
          <p className="text-xs text-gray-500 mt-0.5">
            {fleet.length} aircraft · capital&nbsp;
            <span className="text-gray-400 font-mono">
              ${capital.toLocaleString('en-US', { maximumFractionDigits: 0 })}
            </span>
          </p>
        </div>
        <button
          onClick={() => setShowAddForm((v) => !v)}
          className="px-3 py-1.5 rounded text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 transition-colors"
        >
          {showAddForm ? 'Cancel' : '+ Add Aircraft'}
        </button>
      </div>

      {/* Flash message */}
      {actionMsg && (
        <div className={`text-xs px-4 py-2.5 rounded-lg border ${
          actionMsg.kind === 'ok'
            ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20'
            : 'bg-red-500/10 text-red-300 border-red-500/20'
        }`}>
          {actionMsg.text}
        </div>
      )}

      {/* Add Aircraft form */}
      {showAddForm && (
        <div className="rounded-lg border border-gray-700 bg-gray-900 p-5 space-y-4">
          {/* Lease / Buy toggle */}
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-gray-300 mr-auto">Add aircraft</h2>
            <button
              onClick={() => setAcquireMode('lease')}
              className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                acquireMode === 'lease'
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  : 'bg-gray-800 text-gray-500 border border-gray-700 hover:text-gray-300'
              }`}
            >
              Lease
            </button>
            <button
              onClick={() => setAcquireMode('buy')}
              className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                acquireMode === 'buy'
                  ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                  : 'bg-gray-800 text-gray-500 border border-gray-700 hover:text-gray-300'
              }`}
            >
              Buy
            </button>
          </div>

          <div className="grid grid-cols-1 gap-3">
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-gray-500"
            >
              {catalog.map((c) => (
                <option key={c.icaoType} value={c.icaoType}>
                  {c.name} ({c.icaoType}) — {acquireMode === 'buy'
                    ? `$${c.purchasePrice.toLocaleString()}`
                    : `$${c.leaseCostMo.toLocaleString()}/mo`}
                </option>
              ))}
            </select>

            {selectedEntry && (
              <div className="rounded bg-gray-800/50 p-3 text-xs text-gray-400 space-y-1">
                <div className="flex justify-between">
                  <span>Category</span>
                  <span className="font-mono text-gray-200 capitalize">{selectedEntry.category}</span>
                </div>
                <div className="flex justify-between">
                  <span>Seats</span>
                  <span className="font-mono text-gray-200">{selectedEntry.seatsEco} eco + {selectedEntry.seatsBiz} biz</span>
                </div>
                <div className="flex justify-between">
                  <span>Range</span>
                  <span className="font-mono text-gray-200">{selectedEntry.rangeNm.toLocaleString()} nm</span>
                </div>
                <div className="flex justify-between">
                  <span>Cruise speed</span>
                  <span className="font-mono text-gray-200">{selectedEntry.cruiseKtas} ktas</span>
                </div>
                <div className="flex justify-between">
                  <span>Fuel burn</span>
                  <span className="font-mono text-gray-200">{selectedEntry.fuelBurnGalH.toLocaleString()} gal/h</span>
                </div>
                <div className="border-t border-gray-700 my-1" />

                {acquireMode === 'buy' ? (
                  <>
                    <div className="flex justify-between">
                      <span>Purchase price</span>
                      <span className="font-mono text-gray-200">${selectedEntry.purchasePrice.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Monthly cost</span>
                      <span className="font-mono text-emerald-400">$0 (owned)</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Capital after</span>
                      <span className={`font-mono ${capital - selectedEntry.purchasePrice >= 0 ? 'text-gray-300' : 'text-red-400'}`}>
                        ${(capital - selectedEntry.purchasePrice).toLocaleString('en-US', { maximumFractionDigits: 0 })}
                      </span>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex justify-between">
                      <span>Monthly lease cost</span>
                      <span className="font-mono text-gray-200">${selectedEntry.leaseCostMo.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Due now (first month)</span>
                      <span className={`font-mono font-semibold ${capital >= selectedEntry.leaseCostMo ? 'text-emerald-400' : 'text-red-400'}`}>
                        ${selectedEntry.leaseCostMo.toLocaleString()}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Capital after</span>
                      <span className={`font-mono ${capital - selectedEntry.leaseCostMo >= 0 ? 'text-gray-300' : 'text-red-400'}`}>
                        ${(capital - selectedEntry.leaseCostMo).toLocaleString('en-US', { maximumFractionDigits: 0 })}
                      </span>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          <button
            onClick={handleAcquire}
            disabled={acquiring || !selectedEntry || capital < acquireCost}
            className={`w-full py-2 rounded text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed text-white transition-colors ${
              acquireMode === 'buy'
                ? 'bg-blue-600 hover:bg-blue-500'
                : 'bg-emerald-600 hover:bg-emerald-500'
            }`}
          >
            {acquiring
              ? 'Processing…'
              : acquireMode === 'buy'
                ? `Confirm Purchase — $${acquireCost.toLocaleString()}`
                : `Confirm Lease — $${acquireCost.toLocaleString()}/mo`}
          </button>
        </div>
      )}

      {/* Fleet list */}
      {loading ? (
        <p className="text-sm text-gray-500">Loading…</p>
      ) : fleet.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <p className="text-sm">No aircraft in fleet.</p>
          <p className="text-xs mt-1">Add your first aircraft using the button above.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {fleet.map((a) => {
            const cost = Math.round((100 - a.healthPct) * 500)
            const canMaintain = a.healthPct < 100
            const isMaintaining = maintainingId === a.id
            const isSelling = sellingId === a.id
            const estimatedResale = a.ownership === 'owned' && a.purchasePrice
              ? Math.round(a.purchasePrice * (a.healthPct / 100) * 0.70)
              : 0

            return (
              <div
                key={a.id}
                className={`rounded-lg border bg-gray-900 p-5 ${
                  a.healthPct < 50 ? 'border-red-500/30' : 'border-gray-800'
                }`}
              >
                {/* Top row */}
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="font-semibold text-gray-200">{a.name}</h2>
                      <OwnershipBadge ownership={a.ownership} />
                      {activeAircraftId === a.id && (
                        <span className="text-xs px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          ACTIVE
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5 font-mono">{a.icaoType}</p>
                  </div>
                  <StatusBadge healthPct={a.healthPct} />
                </div>

                {/* Health */}
                <div className="mb-4">
                  <p className="text-xs text-gray-500 mb-1.5">Airframe health</p>
                  <HealthBar pct={a.healthPct} />
                </div>

                {/* Stats grid */}
                <div className="grid grid-cols-3 gap-3 pt-3 border-t border-gray-800 mb-4">
                  <div>
                    <p className="text-xs text-gray-500">Total hours</p>
                    <p className="text-sm font-mono text-gray-300">{a.totalHours.toFixed(1)} h</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Cycles</p>
                    <p className="text-sm font-mono text-gray-300">{a.cycles}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">
                      {a.ownership === 'owned' ? 'Cost / mo' : 'Lease / mo'}
                    </p>
                    <p className="text-sm font-mono text-gray-300">
                      {a.ownership === 'owned'
                        ? <span className="text-emerald-400">$0</span>
                        : `$${a.leaseCostMo.toLocaleString()}`}
                    </p>
                  </div>
                </div>

                {/* Maintain action */}
                {canMaintain && (
                  <div className="pt-3 border-t border-gray-800 flex items-center justify-between gap-3">
                    <div className="text-xs text-gray-500">
                      Maintenance cost:&nbsp;
                      <span className={`font-mono font-medium ${capital >= cost ? 'text-amber-400' : 'text-red-400'}`}>
                        ${cost.toLocaleString()}
                      </span>
                      {capital < cost && (
                        <span className="ml-2 text-red-500">(insufficient capital)</span>
                      )}
                    </div>
                    <button
                      onClick={() => handleMaintain(a)}
                      disabled={isMaintaining || capital < cost}
                      className="px-3 py-1.5 rounded text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20 hover:bg-amber-500/20 disabled:opacity-40 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
                    >
                      {isMaintaining ? 'Working…' : 'Maintain to 100%'}
                    </button>
                  </div>
                )}

                {/* Sell (owned only) */}
                {a.ownership === 'owned' && (
                  <div className="pt-3 border-t border-gray-800 flex items-center justify-between gap-3">
                    <div className="text-xs text-gray-500">
                      Resale value:&nbsp;
                      <span className="font-mono font-medium text-blue-400">
                        ${estimatedResale.toLocaleString()}
                      </span>
                      <span className="ml-1 text-gray-600">
                        ({Math.round(a.healthPct)}% health, 30% depreciation)
                      </span>
                    </div>
                    <button
                      onClick={() => handleSell(a)}
                      disabled={isSelling}
                      className="px-3 py-1.5 rounded text-xs font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20 hover:bg-blue-500/20 disabled:opacity-40 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
                    >
                      {isSelling ? 'Selling…' : 'Sell Aircraft'}
                    </button>
                  </div>
                )}

                {/* Activate aircraft */}
                {activeAircraftId !== a.id && (
                  <div className={`pt-3 flex justify-end ${canMaintain || a.ownership === 'owned' ? '' : 'border-t border-gray-800'}`}>
                    <button
                      onClick={() => handleActivate(a)}
                      className="px-3 py-1.5 rounded text-xs font-medium bg-gray-700 text-gray-400 hover:text-gray-200 hover:bg-gray-600 transition-colors"
                    >
                      Set as active aircraft
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
