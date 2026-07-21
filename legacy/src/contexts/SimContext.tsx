import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react'
import type { SimData, FlightRecord, Aircraft, GameEvent } from '../types/thrustline'

interface SimContextValue {
  simData: SimData | null
  simStatus: string
  isFlying: boolean
  lastFlight: FlightRecord | null
  flightCount: number
  /** Increments whenever a monthly lease is deducted — use as refreshKey */
  leaseCount: number
  /** Increments whenever the sim auto-detects a new aircraft — use as refreshKey in Fleet */
  aircraftVersion: number
  /** Increments whenever monthly salaries are deducted — use as refreshKey */
  salaryCount: number
  /** Increments whenever a game event starts or expires — use as refreshKey */
  eventVersion: number
  /** Increments whenever a loan payment is made */
  loanCount: number
}

const SimContext = createContext<SimContextValue>({
  simData:         null,
  simStatus:       'connecting...',
  isFlying:        false,
  lastFlight:      null,
  flightCount:     0,
  leaseCount:      0,
  aircraftVersion: 0,
  salaryCount:     0,
  eventVersion:    0,
  loanCount:       0,
})

export function SimProvider({ children }: { children: ReactNode }) {
  const [simData,    setSimData]    = useState<SimData | null>(null)
  const [simStatus,  setSimStatus]  = useState('connecting...')
  const [isFlying,   setIsFlying]   = useState(false)
  const [lastFlight, setLastFlight] = useState<FlightRecord | null>(null)
  const [flightCount,     setFlightCount]     = useState(0)
  const [leaseCount,      setLeaseCount]      = useState(0)
  const [aircraftVersion, setAircraftVersion] = useState(0)
  const [salaryCount,     setSalaryCount]     = useState(0)
  const [eventVersion,    setEventVersion]    = useState(0)
  const [loanCount,       setLoanCount]       = useState(0)

  const handleFlightStarted   = useCallback(() => { setIsFlying(true) }, [])
  const handleFlightEnded     = useCallback((record: FlightRecord) => {
    setIsFlying(false); setLastFlight(record); setFlightCount((c) => c + 1)
  }, [])
  const handleLeaseDeducted   = useCallback(() => { setLeaseCount((c) => c + 1) }, [])
  const handleAircraftChanged = useCallback((_aircraft: Aircraft) => {
    setAircraftVersion((v) => v + 1)
  }, [])
  const handleSalaryDeducted  = useCallback(() => { setSalaryCount((c) => c + 1) }, [])
  const handleEventNew        = useCallback((_event: GameEvent) => { setEventVersion((v) => v + 1) }, [])
  const handleEventExpired    = useCallback(() => { setEventVersion((v) => v + 1) }, [])
  const handleLoanPayment     = useCallback(() => { setLoanCount((c) => c + 1) }, [])

  useEffect(() => {
    if (!window.thrustline) return

    window.thrustline.getSimStatus().then(setSimStatus).catch(console.error)
    window.thrustline.onSimData(setSimData)
    window.thrustline.onSimStatus(setSimStatus)
    window.thrustline.onFlightStarted(handleFlightStarted)
    window.thrustline.onFlightEnded(handleFlightEnded)
    window.thrustline.onLeaseDeducted(handleLeaseDeducted)
    window.thrustline.onAircraftChanged(handleAircraftChanged)
    window.thrustline.onSalaryDeducted(handleSalaryDeducted)
    window.thrustline.onEventNew(handleEventNew)
    window.thrustline.onEventExpired(handleEventExpired)
    window.thrustline.onLoanPayment(handleLoanPayment)

    return () => { window.thrustline.offAll() }
  }, [handleFlightStarted, handleFlightEnded, handleLeaseDeducted, handleAircraftChanged, handleSalaryDeducted, handleEventNew, handleEventExpired, handleLoanPayment])

  return (
    <SimContext.Provider value={{
      simData, simStatus, isFlying, lastFlight,
      flightCount, leaseCount, aircraftVersion, salaryCount, eventVersion, loanCount,
    }}>
      {children}
    </SimContext.Provider>
  )
}

export function useSim() {
  return useContext(SimContext)
}
