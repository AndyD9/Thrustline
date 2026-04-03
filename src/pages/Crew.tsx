import { useEffect, useState } from 'react'
import { useSim } from '../contexts/SimContext'
import { api } from '../lib/api'
import type { CrewMember, CrewCandidate, Aircraft } from '../types/thrustline'

// ── Sub-components ────────────────────────────────────────────────────────

function RankBadge({ rank }: { rank: string }) {
  if (rank === 'captain') {
    return (
      <span className="text-xs px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
        CPT
      </span>
    )
  }
  return (
    <span className="text-xs px-1.5 py-0.5 rounded bg-gray-700 text-gray-400">
      FO
    </span>
  )
}

function DutyBar({ hours, max }: { hours: number; max: number }) {
  const pct = Math.min((hours / max) * 100, 100)
  const color = pct >= 90 ? 'bg-red-500' : pct >= 70 ? 'bg-amber-500' : 'bg-emerald-500'
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-gray-800 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className={`text-xs font-mono w-16 text-right ${pct >= 90 ? 'text-red-400' : 'text-gray-400'}`}>
        {hours.toFixed(1)}/{max}h
      </span>
    </div>
  )
}

function ExpStars({ level }: { level: number }) {
  return (
    <span className="text-xs font-mono text-amber-400">
      {'★'.repeat(Math.min(level, 5))}
      {'☆'.repeat(Math.max(5 - level, 0))}
      {level > 5 && <span className="text-amber-300 ml-1">+{level - 5}</span>}
    </span>
  )
}

// ── Hire modal ────────────────────────────────────────────────────────────

function HirePanel({
  capital,
  onHire,
  onClose,
}: {
  capital: number
  onHire: (candidate: CrewCandidate) => Promise<void>
  onClose: () => void
}) {
  const [pool, setPool]       = useState<CrewCandidate[]>([])
  const [loading, setLoading] = useState(true)
  const [hiring, setHiring]   = useState<number | null>(null)

  function refreshPool() {
    setLoading(true)
    api.crewPool().then(setPool).catch(console.error).finally(() => setLoading(false))
  }

  useEffect(refreshPool, [])

  async function handleHire(candidate: CrewCandidate, index: number) {
    setHiring(index)
    try {
      await onHire(candidate)
      // Remove hired candidate from the pool
      setPool((prev) => prev.filter((_, i) => i !== index))
    } finally {
      setHiring(null)
    }
  }

  return (
    <div className="rounded-lg border border-gray-700 bg-gray-900 p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-300">Hire crew</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={refreshPool}
            disabled={loading}
            className="px-3 py-1 rounded text-xs font-medium bg-gray-800 text-gray-400 hover:text-gray-200 border border-gray-700 transition-colors"
          >
            {loading ? 'Loading…' : 'Refresh pool'}
          </button>
          <button
            onClick={onClose}
            className="text-gray-600 hover:text-gray-400 text-sm transition-colors"
          >
            ✕
          </button>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-gray-500">Generating candidates…</p>
      ) : (
        <div className="grid grid-cols-1 gap-2">
          {pool.map((c, i) => (
            <div key={i} className="flex items-center gap-3 rounded bg-gray-800/50 p-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-200">{c.firstName} {c.lastName}</span>
                  <RankBadge rank={c.rank} />
                </div>
                <div className="flex items-center gap-3 mt-1">
                  <ExpStars level={c.experience} />
                  <span className="text-xs font-mono text-gray-500">
                    ${c.salaryMo.toLocaleString()}/mo
                  </span>
                </div>
              </div>
              <button
                onClick={() => handleHire(c, i)}
                disabled={hiring === i || capital < c.salaryMo}
                className="px-3 py-1.5 rounded text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 disabled:opacity-40 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
              >
                {hiring === i ? 'Hiring…' : capital < c.salaryMo ? 'No funds' : `Hire — $${c.salaryMo.toLocaleString()}`}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Main page ────────────────────────────────────────────────────────────

export function CrewPage() {
  const { flightCount, leaseCount, salaryCount } = useSim()

  const [crew, setCrew]         = useState<CrewMember[]>([])
  const [fleet, setFleet]       = useState<Aircraft[]>([])
  const [capital, setCapital]   = useState(0)
  const [loading, setLoading]   = useState(true)
  const [showHire, setShowHire] = useState(false)
  const [actionMsg, setActionMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)

  const [actionKey, setActionKey] = useState(0)
  const refreshKey = flightCount + leaseCount + salaryCount + actionKey

  useEffect(() => {
    setLoading(true)
    Promise.all([api.crew(), api.fleet(), api.company()])
      .then(([crew, fleet, company]) => {
        setCrew(crew)
        setFleet(fleet)
        setCapital(company.capital)
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [refreshKey])

  function flash(kind: 'ok' | 'err', text: string) {
    setActionMsg({ kind, text })
    setTimeout(() => setActionMsg(null), 4000)
  }

  async function handleHire(candidate: CrewCandidate) {
    try {
      await api.hireCrew(candidate)
      flash('ok', `${candidate.rank === 'captain' ? 'Cpt' : 'FO'} ${candidate.firstName} ${candidate.lastName} hired!`)
      setActionKey((k) => k + 1)
    } catch (err: unknown) {
      flash('err', err instanceof Error ? err.message : 'Hire failed')
    }
  }

  async function handleFire(member: CrewMember) {
    try {
      await api.fireCrew(member.id)
      flash('ok', `${member.firstName} ${member.lastName} dismissed`)
      setActionKey((k) => k + 1)
    } catch (err: unknown) {
      flash('err', err instanceof Error ? err.message : 'Fire failed')
    }
  }

  async function handleAssign(memberId: string, aircraftId: string) {
    try {
      if (aircraftId === '') {
        await api.unassignCrew(memberId)
      } else {
        await api.assignCrew(memberId, aircraftId)
      }
      setActionKey((k) => k + 1)
    } catch (err: unknown) {
      flash('err', err instanceof Error ? err.message : 'Assignment failed')
    }
  }

  // Group crew by aircraft
  const unassigned = crew.filter((c) => !c.aircraftId)
  const crewByAircraft = new Map<string, CrewMember[]>()
  for (const c of crew) {
    if (!c.aircraftId) continue
    const list = crewByAircraft.get(c.aircraftId) ?? []
    list.push(c)
    crewByAircraft.set(c.aircraftId, list)
  }

  // Aircraft with crew warnings
  const aircraftWarnings = fleet.filter((a) => {
    const assigned = crewByAircraft.get(a.id)
    return !assigned || assigned.length < 2
  })

  const totalSalary = crew.reduce((s, c) => s + c.salaryMo, 0)

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-lg font-semibold text-gray-200">Crew</h1>
          <p className="text-xs text-gray-500 mt-0.5">
            {crew.length} crew · salaries&nbsp;
            <span className="text-gray-400 font-mono">${totalSalary.toLocaleString()}/mo</span>
          </p>
        </div>
        <button
          onClick={() => setShowHire((v) => !v)}
          className="px-3 py-1.5 rounded text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 transition-colors"
        >
          {showHire ? 'Cancel' : '+ Hire Crew'}
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

      {/* Aircraft warnings */}
      {aircraftWarnings.length > 0 && !loading && (
        <div className="text-xs px-4 py-2.5 rounded-lg border bg-amber-500/10 text-amber-300 border-amber-500/20">
          {aircraftWarnings.map((a) => a.name).join(', ')} — needs at least 2 crew to dispatch flights.
        </div>
      )}

      {/* Hire panel */}
      {showHire && (
        <HirePanel
          capital={capital}
          onHire={handleHire}
          onClose={() => setShowHire(false)}
        />
      )}

      {/* Crew list */}
      {loading ? (
        <p className="text-sm text-gray-500">Loading…</p>
      ) : crew.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <p className="text-sm">No crew members.</p>
          <p className="text-xs mt-1">Hire your first crew using the button above.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Per-aircraft groups */}
          {fleet.map((aircraft) => {
            const members = crewByAircraft.get(aircraft.id) ?? []
            if (members.length === 0) return null
            return (
              <div key={aircraft.id} className="space-y-2">
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <span className="font-medium text-gray-400">{aircraft.name}</span>
                  <span className="font-mono">{aircraft.icaoType}</span>
                  {members.length < 2 && (
                    <span className="text-amber-400">— needs {2 - members.length} more</span>
                  )}
                </div>
                {members.map((m) => (
                  <CrewCard
                    key={m.id}
                    member={m}
                    fleet={fleet}
                    onAssign={handleAssign}
                    onFire={handleFire}
                  />
                ))}
              </div>
            )
          })}

          {/* Unassigned */}
          {unassigned.length > 0 && (
            <div className="space-y-2">
              <div className="text-xs text-gray-500 font-medium">Unassigned</div>
              {unassigned.map((m) => (
                <CrewCard
                  key={m.id}
                  member={m}
                  fleet={fleet}
                  onAssign={handleAssign}
                  onFire={handleFire}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Crew card ────────────────────────────────────────────────────────────

function CrewCard({
  member,
  fleet,
  onAssign,
  onFire,
}: {
  member: CrewMember
  fleet: Aircraft[]
  onAssign: (memberId: string, aircraftId: string) => Promise<void>
  onFire: (member: CrewMember) => Promise<void>
}) {
  const [confirming, setConfirming] = useState(false)

  return (
    <div className="rounded-lg border border-gray-800 bg-gray-900 p-4">
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-medium text-gray-200">
              {member.firstName} {member.lastName}
            </span>
            <RankBadge rank={member.rank} />
          </div>
          <div className="flex items-center gap-3 mt-1">
            <ExpStars level={member.experience} />
            <span className="text-xs font-mono text-gray-500">
              ${member.salaryMo.toLocaleString()}/mo
            </span>
          </div>
        </div>

        {/* Fire button */}
        {confirming ? (
          <div className="flex items-center gap-1">
            <button
              onClick={() => { onFire(member); setConfirming(false) }}
              className="px-2 py-1 rounded text-xs font-medium bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30 transition-colors"
            >
              Confirm
            </button>
            <button
              onClick={() => setConfirming(false)}
              className="px-2 py-1 rounded text-xs text-gray-500 hover:text-gray-300 transition-colors"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            onClick={() => setConfirming(true)}
            className="text-gray-700 hover:text-red-400 text-xs transition-colors"
            title="Dismiss crew member"
          >
            Dismiss
          </button>
        )}
      </div>

      {/* Duty hours */}
      <div className="mb-3">
        <p className="text-xs text-gray-500 mb-1">Duty hours this month</p>
        <DutyBar hours={member.dutyHours} max={member.maxDutyH} />
      </div>

      {/* Aircraft assignment */}
      <div className="flex items-center gap-2">
        <label className="text-xs text-gray-500">Aircraft:</label>
        <select
          value={member.aircraftId ?? ''}
          onChange={(e) => onAssign(member.id, e.target.value)}
          className="flex-1 bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-gray-200 focus:outline-none focus:border-gray-500"
        >
          <option value="">— Unassigned —</option>
          {fleet.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name} ({a.icaoType})
            </option>
          ))}
        </select>
      </div>
    </div>
  )
}
