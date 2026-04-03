import { useState } from 'react'
import { useSim } from '../contexts/SimContext'
import { useCompany } from '../hooks/useCompany'
import { useTransactions } from '../hooks/useTransactions'
import { LineChart } from '../components/LineChart'
import { KpiCard } from '../components/KpiCard'

const TYPE_LABELS: Record<string, string> = {
  revenue:     'Revenue',
  fuel:        'Fuel',
  landing_fee: 'Landing fee',
  lease:       'Lease',
  maintenance: 'Maintenance',
  salary:       'Salary',
  purchase:     'Purchase',
  sale:         'Sale',
  loan_payment: 'Loan',
}

const TYPE_COLORS: Record<string, string> = {
  revenue:      'text-emerald-400',
  fuel:         'text-amber-400',
  landing_fee:  'text-blue-400',
  lease:        'text-purple-400',
  maintenance:  'text-red-400',
  salary:       'text-cyan-400',
  purchase:     'text-orange-400',
  sale:         'text-teal-400',
  loan_payment: 'text-indigo-400',
}

type FilterType = 'all' | 'revenue' | 'fuel' | 'landing_fee' | 'maintenance' | 'lease' | 'salary' | 'purchase' | 'sale' | 'loan_payment'

const PAGE_SIZE = 25

function fmtUsd(n: number) {
  const abs = Math.abs(n)
  const sign = n < 0 ? '-' : '+'
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(2)}M`
  if (abs >= 1_000)     return `${sign}$${(abs / 1_000).toFixed(1)}K`
  return `${sign}$${abs.toFixed(0)}`
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
  })
}

export function Finances() {
  const { flightCount }              = useSim()
  const { company }                  = useCompany(flightCount)
  const { transactions, loading }    = useTransactions(200, flightCount)

  // Running cumulative sum for the line chart (chronological)
  const chronoTx = [...transactions].reverse()
  const runningCapital = chronoTx.reduce<number[]>((acc, tx) => {
    const prev = acc.length ? acc[acc.length - 1] : (company?.capital ?? 0) - chronoTx.reduce((s, t) => s + t.amount, 0)
    acc.push(prev + tx.amount)
    return acc
  }, [])

  // Totals by type
  const totals = transactions.reduce<Record<string, number>>((acc, tx) => {
    acc[tx.type] = (acc[tx.type] ?? 0) + tx.amount
    return acc
  }, {})

  const totalRevenue = totals['revenue'] ?? 0
  const totalCosts   = Object.entries(totals)
    .filter(([k]) => k !== 'revenue')
    .reduce((s, [, v]) => s + v, 0)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-gray-200">Finances</h1>
        <button
          onClick={() => window.thrustline.exportTransactions()}
          className="px-3 py-1.5 rounded text-xs font-medium bg-gray-800 text-gray-400 hover:text-gray-200 border border-gray-700 transition-colors"
          title="Export transactions to CSV"
        >
          ↓ CSV
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-4">
        <KpiCard
          label="Current Capital"
          value={`$${(company?.capital ?? 0).toLocaleString('en-US', { maximumFractionDigits: 0 })}`}
          sub="Cash on hand"
          accent="emerald"
        />
        <KpiCard
          label="Total Revenue"
          value={fmtUsd(totalRevenue)}
          sub="All ticket sales"
          accent="blue"
        />
        <KpiCard
          label="Total Costs"
          value={fmtUsd(totalCosts)}
          sub="Fuel + fees + maintenance"
          accent={totalCosts < 0 ? 'red' : 'amber'}
        />
      </div>

      {/* Capital curve */}
      {runningCapital.length >= 2 && (
        <div className="rounded-lg border border-gray-800 bg-gray-900 p-5">
          <h2 className="text-sm font-semibold text-gray-300 mb-4">Capital evolution</h2>
          <LineChart data={runningCapital} height={120} />
          <div className="flex justify-between text-xs text-gray-600 mt-1">
            <span>Earliest</span>
            <span>Latest</span>
          </div>
        </div>
      )}

      {/* Breakdown by type */}
      <div className="grid grid-cols-2 gap-4">
        {/* Summary cards */}
        <div className="rounded-lg border border-gray-800 bg-gray-900 p-5 space-y-3">
          <h2 className="text-sm font-semibold text-gray-300">By category</h2>
          {Object.entries(totals).map(([type, amount]) => (
            <div key={type} className="flex items-center justify-between text-sm">
              <span className="text-gray-400">{TYPE_LABELS[type] ?? type}</span>
              <span className={`font-mono font-semibold ${amount >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {fmtUsd(amount)}
              </span>
            </div>
          ))}
        </div>

        {/* Ratio bar */}
        <div className="rounded-lg border border-gray-800 bg-gray-900 p-5 space-y-3">
          <h2 className="text-sm font-semibold text-gray-300">Cost breakdown</h2>
          {Object.entries(totals)
            .filter(([k]) => k !== 'revenue')
            .map(([type, amount]) => {
              const pct = totalCosts !== 0 ? Math.abs(amount / totalCosts) * 100 : 0
              return (
                <div key={type} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className={TYPE_COLORS[type] ?? 'text-gray-400'}>{TYPE_LABELS[type] ?? type}</span>
                    <span className="text-gray-500">{pct.toFixed(0)}%</span>
                  </div>
                  <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full bg-current opacity-70"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              )
            })}
        </div>
      </div>

      {/* Transactions table with pagination */}
      <TransactionTable transactions={transactions} loading={loading} />
    </div>
  )
}

// ── Paginated transaction table ──────────────────────────────────────────

function TransactionTable({ transactions, loading }: { transactions: { id: string; type: string; description: string; amount: number; createdAt: string }[]; loading: boolean }) {
  const [page, setPage]     = useState(0)
  const [filter, setFilter] = useState<FilterType>('all')

  const filtered  = filter === 'all' ? transactions : transactions.filter((tx) => tx.type === filter)
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage  = Math.min(page, pageCount - 1)
  const pageItems = filtered.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE)

  // Reset to page 0 when filter changes
  const handleFilter = (f: FilterType) => { setFilter(f); setPage(0) }

  const FILTER_OPTIONS: { key: FilterType; label: string }[] = [
    { key: 'all',         label: 'All' },
    { key: 'revenue',     label: 'Revenue' },
    { key: 'fuel',        label: 'Fuel' },
    { key: 'landing_fee', label: 'Landing' },
    { key: 'lease',       label: 'Lease' },
    { key: 'salary',      label: 'Salary' },
    { key: 'maintenance', label: 'Maint.' },
    { key: 'purchase',     label: 'Purchase' },
    { key: 'sale',         label: 'Sale' },
    { key: 'loan_payment', label: 'Loan' },
  ]

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-gray-300">Transaction history</h2>
        <div className="flex items-center gap-1">
          {FILTER_OPTIONS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => handleFilter(key)}
              className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                filter === key
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  : 'bg-gray-800 text-gray-500 border border-gray-700 hover:text-gray-300'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-gray-500">Loading…</p>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-gray-500">{filter === 'all' ? 'No transactions yet.' : `No ${filter} transactions.`}</p>
      ) : (
        <>
          <div className="overflow-x-auto rounded-lg border border-gray-800">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800 bg-gray-900/50 text-left text-gray-400">
                  <th className="px-4 py-2.5 font-medium">Date</th>
                  <th className="px-4 py-2.5 font-medium">Type</th>
                  <th className="px-4 py-2.5 font-medium">Description</th>
                  <th className="px-4 py-2.5 font-medium text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {pageItems.map((tx) => (
                  <tr key={tx.id} className="border-b border-gray-800/50 hover:bg-gray-900/30">
                    <td className="px-4 py-2 text-xs text-gray-500 whitespace-nowrap">{fmtDate(tx.createdAt)}</td>
                    <td className="px-4 py-2">
                      <span className={`text-xs font-medium ${TYPE_COLORS[tx.type] ?? 'text-gray-400'}`}>
                        {TYPE_LABELS[tx.type] ?? tx.type}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-gray-400 text-xs">{tx.description}</td>
                    <td className={`px-4 py-2 text-right font-mono font-semibold text-sm ${tx.amount >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {fmtUsd(tx.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination controls */}
          {pageCount > 1 && (
            <div className="flex items-center justify-between mt-3">
              <span className="text-xs text-gray-500">
                {filtered.length} transaction{filtered.length !== 1 ? 's' : ''} · page {safePage + 1}/{pageCount}
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPage(0)}
                  disabled={safePage === 0}
                  className="px-2 py-1 rounded text-xs bg-gray-800 text-gray-400 border border-gray-700 hover:text-gray-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  ««
                </button>
                <button
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  disabled={safePage === 0}
                  className="px-2 py-1 rounded text-xs bg-gray-800 text-gray-400 border border-gray-700 hover:text-gray-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  ‹ Prev
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
                  disabled={safePage >= pageCount - 1}
                  className="px-2 py-1 rounded text-xs bg-gray-800 text-gray-400 border border-gray-700 hover:text-gray-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  Next ›
                </button>
                <button
                  onClick={() => setPage(pageCount - 1)}
                  disabled={safePage >= pageCount - 1}
                  className="px-2 py-1 rounded text-xs bg-gray-800 text-gray-400 border border-gray-700 hover:text-gray-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  »»
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
