interface LineChartProps {
  data: number[]
  height?: number
  color?: string
}

export function LineChart({ data, height = 120, color = '#10b981' }: LineChartProps) {
  if (data.length < 2) return null

  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = max - min || 1
  const pad = 4

  const w = 100
  const h = height

  // Map data to SVG coordinates
  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * (w - pad * 2) + pad
    const y = h - pad - ((v - min) / range) * (h - pad * 2)
    return `${x},${y}`
  })

  const polyline = points.join(' ')

  // Fill area under line
  const first = points[0]
  const last  = points[points.length - 1]
  const [, firstY] = first.split(',')
  const [lastX]    = last.split(',')
  const fillPath = `M ${first} L ${polyline.slice(polyline.indexOf(' ') + 1)} L ${lastX},${h - pad} L ${pad},${h - pad} Z`

  return (
    <svg
      width="100%"
      height={height}
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none"
      className="overflow-visible"
    >
      <defs>
        <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor={color} stopOpacity="0.2" />
          <stop offset="100%" stopColor={color} stopOpacity="0"   />
        </linearGradient>
      </defs>

      {/* Area fill */}
      <path d={fillPath} fill="url(#areaGrad)" />

      {/* Line */}
      <polyline
        points={polyline}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />

      {/* Last point dot */}
      {points.length > 0 && (() => {
        const [lx, ly] = (points[points.length - 1]).split(',')
        return <circle cx={lx} cy={ly} r="2" fill={color} vectorEffect="non-scaling-stroke" />
      })()}
    </svg>
  )
}
