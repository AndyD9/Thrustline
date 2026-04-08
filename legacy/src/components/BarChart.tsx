interface BarChartProps {
  data: { label: string; value: number }[]
  height?: number
}

export function BarChart({ data, height = 80 }: BarChartProps) {
  if (data.length === 0) return null

  const maxAbs = Math.max(...data.map((d) => Math.abs(d.value)), 1)
  const barW  = 100 / data.length
  const midY  = height / 2

  return (
    <svg
      width="100%"
      height={height}
      viewBox={`0 0 100 ${height}`}
      preserveAspectRatio="none"
      className="overflow-visible"
    >
      {/* Zero line */}
      <line x1="0" y1={midY} x2="100" y2={midY} stroke="#374151" strokeWidth="0.5" />

      {data.map((d, i) => {
        const ratio   = Math.abs(d.value) / maxAbs
        const barH    = ratio * (midY - 4)
        const isPos   = d.value >= 0
        const x       = i * barW + barW * 0.1
        const w       = barW * 0.8
        const y       = isPos ? midY - barH : midY
        const fill    = isPos ? '#10b981' : '#f87171'

        return (
          <g key={i}>
            <rect x={x} y={y} width={w} height={barH} fill={fill} opacity="0.8" rx="0.5" />
            <title>{d.label}: ${d.value.toLocaleString()}</title>
          </g>
        )
      })}
    </svg>
  )
}
