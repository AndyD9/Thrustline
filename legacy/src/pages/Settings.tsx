import { useEffect, useState } from 'react'
import { useSim } from '../contexts/SimContext'
import { useAuth } from '../contexts/AuthContext'
import { useSync } from '../contexts/SyncContext'
import { useCompany } from '../hooks/useCompany'
import { api } from '../lib/api'

export function Settings() {
  const { flightCount } = useSim()
  const { company, loading } = useCompany(flightCount)
  const { user, signOut } = useAuth()
  const { status: syncStatus, syncNow } = useSync()

  const [name,             setName]             = useState('')
  const [hubIcao,          setHubIcao]          = useState('')
  const [airlineCode,      setAirlineCode]      = useState('')
  const [simbriefUsername, setSimbriefUsername] = useState('')
  const [saving,           setSaving]           = useState(false)
  const [flash,            setFlash]            = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)

  // Reset dialog state
  const [resetPhase, setResetPhase] = useState<'idle' | 'confirm' | 'loading'>('idle')

  // Sync form when company loads
  useEffect(() => {
    if (company) {
      setName(company.name)
      setHubIcao(company.hubIcao ?? '')
      setAirlineCode(company.airlineCode ?? '')
      setSimbriefUsername(company.simbriefUsername ?? '')
    }
  }, [company])

  function showFlash(kind: 'ok' | 'err', text: string) {
    setFlash({ kind, text })
    setTimeout(() => setFlash(null), 4000)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      await api.updateCompany({
        name:             name.trim()             || undefined,
        hubIcao:          hubIcao.trim()          || undefined,
        airlineCode:      airlineCode.trim()      || undefined,
        simbriefUsername: simbriefUsername.trim() || undefined,
      })
      showFlash('ok', 'Settings saved')
    } catch (err: unknown) {
      showFlash('err', err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  async function handleReset() {
    setResetPhase('loading')
    try {
      await api.resetCompany()
      showFlash('ok', 'All data reset — flights, transactions and routes have been cleared')
    } catch (err: unknown) {
      showFlash('err', err instanceof Error ? err.message : 'Reset failed')
    } finally {
      setResetPhase('idle')
    }
  }

  if (loading) return <p className="text-sm text-gray-500">Loading…</p>

  return (
    <div className="space-y-8 max-w-lg">
      <h1 className="text-lg font-semibold text-gray-200">Settings</h1>

      {/* Flash */}
      {flash && (
        <div className={`text-xs px-4 py-2.5 rounded-lg border ${
          flash.kind === 'ok'
            ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20'
            : 'bg-red-500/10 text-red-300 border-red-500/20'
        }`}>
          {flash.text}
        </div>
      )}

      {/* Account */}
      <div className="rounded-lg border border-gray-800 bg-gray-900 p-5 space-y-4">
        <h2 className="text-sm font-semibold text-gray-300">Account</h2>
        <div className="text-xs text-gray-500 space-y-2">
          <p>Email: <span className="text-gray-300">{user?.email ?? '—'}</span></p>
          <p>
            Sync status:{' '}
            <span className={
              syncStatus === 'idle' ? 'text-emerald-400'
                : syncStatus === 'syncing' ? 'text-yellow-400'
                : syncStatus === 'error' ? 'text-red-400'
                : 'text-gray-500'
            }>
              {syncStatus}
            </span>
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={syncNow}
            className="px-3 py-1.5 rounded text-xs font-medium bg-gray-700 text-gray-300 hover:bg-gray-600 transition-colors"
          >
            Sync now
          </button>
          <button
            onClick={signOut}
            className="px-3 py-1.5 rounded text-xs font-medium bg-gray-700 text-red-400 hover:bg-gray-600 transition-colors"
          >
            Sign out
          </button>
        </div>
      </div>

      {/* Company settings */}
      <form onSubmit={handleSave} className="rounded-lg border border-gray-800 bg-gray-900 p-5 space-y-4">
        <h2 className="text-sm font-semibold text-gray-300">Company</h2>

        <div className="space-y-3">
          <div>
            <label className="text-xs text-gray-500 block mb-1">Airline name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={60}
              className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-gray-500"
            />
          </div>

          <div>
            <label className="text-xs text-gray-500 block mb-1">Hub ICAO</label>
            <input
              type="text"
              value={hubIcao}
              onChange={(e) => setHubIcao(e.target.value.toUpperCase())}
              maxLength={4}
              placeholder="LFPG"
              className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-gray-200 font-mono focus:outline-none focus:border-gray-500 uppercase placeholder-gray-600"
            />
          </div>

          <div>
            <label className="text-xs text-gray-500 block mb-1">Airline code <span className="text-gray-600">(2–3 chars, e.g. THL)</span></label>
            <input
              type="text"
              value={airlineCode}
              onChange={(e) => setAirlineCode(e.target.value.toUpperCase())}
              maxLength={3}
              placeholder="THL"
              className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-gray-200 font-mono focus:outline-none focus:border-gray-500 uppercase placeholder-gray-600"
            />
            <p className="text-xs text-gray-600 mt-1">Used to generate flight numbers (e.g. THL001) in SimBrief.</p>
          </div>

          <div>
            <label className="text-xs text-gray-500 block mb-1">SimBrief username / pilot ID</label>
            <input
              type="text"
              value={simbriefUsername}
              onChange={(e) => setSimbriefUsername(e.target.value)}
              maxLength={64}
              placeholder="your_simbrief_username"
              className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-gray-200 font-mono focus:outline-none focus:border-gray-500 placeholder-gray-600"
            />
            <p className="text-xs text-gray-600 mt-1">Required to fetch your OFP after dispatching via SimBrief.</p>
          </div>
        </div>

        <div className="flex items-center justify-between pt-2">
          <div className="text-xs text-gray-600">
            Capital:{' '}
            <span className="text-gray-400 font-mono">
              ${(company?.capital ?? 0).toLocaleString('en-US', { maximumFractionDigits: 0 })}
            </span>
            {'  ·  '}
            Flights:{' '}
            <span className="text-gray-400">{company?._count.flights ?? 0}</span>
          </div>
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-1.5 rounded text-sm font-semibold bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white transition-colors"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </form>

      {/* Export */}
      <div className="rounded-lg border border-gray-800 bg-gray-900 p-5 space-y-3">
        <h2 className="text-sm font-semibold text-gray-300">Export data</h2>
        <p className="text-xs text-gray-500">Download your data as CSV files.</p>
        <div className="flex gap-3">
          <button
            onClick={async () => {
              const result = await window.thrustline.exportFlights()
              if (result) showFlash('ok', `Exported to ${result}`)
            }}
            className="px-3 py-1.5 rounded text-xs font-medium bg-gray-700 text-gray-300 hover:bg-gray-600 transition-colors"
          >
            Export flights
          </button>
          <button
            onClick={async () => {
              const result = await window.thrustline.exportTransactions()
              if (result) showFlash('ok', `Exported to ${result}`)
            }}
            className="px-3 py-1.5 rounded text-xs font-medium bg-gray-700 text-gray-300 hover:bg-gray-600 transition-colors"
          >
            Export transactions
          </button>
        </div>
      </div>

      {/* Danger zone */}
      <div className="rounded-lg border border-red-500/20 bg-red-950/10 p-5 space-y-3">
        <h2 className="text-sm font-semibold text-red-400">Danger zone</h2>
        <p className="text-xs text-gray-500">
          Reset clears all flights, transactions and routes.
          Capital is restored to $1,000,000. Fleet is kept.
        </p>

        {resetPhase === 'idle' && (
          <button
            onClick={() => setResetPhase('confirm')}
            className="px-3 py-1.5 rounded text-xs font-medium bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 transition-colors"
          >
            Reset all data…
          </button>
        )}

        {resetPhase === 'confirm' && (
          <div className="space-y-2">
            <p className="text-xs text-red-300 font-medium">Are you sure? This cannot be undone.</p>
            <div className="flex gap-2">
              <button
                onClick={handleReset}
                className="px-3 py-1.5 rounded text-xs font-semibold bg-red-600 hover:bg-red-500 text-white transition-colors"
              >
                Yes, reset everything
              </button>
              <button
                onClick={() => setResetPhase('idle')}
                className="px-3 py-1.5 rounded text-xs font-medium bg-gray-700 text-gray-300 hover:bg-gray-600 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {resetPhase === 'loading' && (
          <p className="text-xs text-gray-500">Resetting…</p>
        )}
      </div>
    </div>
  )
}
