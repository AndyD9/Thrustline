import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import type { Transaction } from '../types/thrustline'

export function useTransactions(limit = 100, refreshKey = 0) {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    api.transactions(limit)
      .then(setTransactions)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }, [limit, refreshKey])

  return { transactions, loading, error }
}
