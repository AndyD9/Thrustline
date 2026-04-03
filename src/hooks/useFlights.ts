import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import type { FlightRecord } from '../types/thrustline'

export function useFlights(limit = 50, refreshKey = 0) {
  const [flights, setFlights] = useState<FlightRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError]    = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    api.flights(limit)
      .then(setFlights)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }, [limit, refreshKey])

  return { flights, loading, error }
}
