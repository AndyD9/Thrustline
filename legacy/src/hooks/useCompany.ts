import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import type { Company } from '../types/thrustline'

export function useCompany(refreshKey = 0) {
  const [company, setCompany] = useState<Company | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]   = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    api.company()
      .then(setCompany)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }, [refreshKey])

  return { company, loading, error }
}
