interface KpiCardProps {
  label: string
  value: string
  sub?: string
  accent?: 'emerald' | 'blue' | 'amber' | 'red'
}

const ACCENT_CLASSES: Record<NonNullable<KpiCardProps['accent']>, string> = {
  emerald: 'text-emerald-400',
  blue:    'text-blue-400',
  amber:   'text-amber-400',
  red:     'text-red-400',
}

export function KpiCard({ label, value, sub, accent = 'emerald' }: KpiCardProps) {
  return (
    <div className="rounded-lg border border-gray-800 bg-gray-900 px-5 py-4 space-y-1">
      <p className="text-xs font-medium uppercase tracking-wider text-gray-500">{label}</p>
      <p className={`text-2xl font-bold tabular-nums ${ACCENT_CLASSES[accent]}`}>{value}</p>
      {sub && <p className="text-xs text-gray-500">{sub}</p>}
    </div>
  )
}
