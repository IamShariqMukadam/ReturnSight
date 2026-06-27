import { useEffect, useRef } from 'react'

const riskColor = (prob) => {
  if (prob >= 0.65) return '#EF4444'
  if (prob >= 0.35) return '#F59E0B'
  return '#22C55E'
}

export default function ScoreArc({ probability = 0 }) {
  const pct = Math.round(probability * 100)
  const color = riskColor(probability)
  const r = 70, cx = 90, cy = 90
  const circumference = Math.PI * r  // half circle
  const strokeDash = (probability * circumference).toFixed(1)

  return (
    <div className="flex flex-col items-center">
      <svg viewBox="0 0 180 100" width="180" height="100" aria-label={`Return risk: ${pct}%`}>
        {/* Background arc */}
        <path d={`M ${cx-r},${cy} A ${r},${r} 0 0,1 ${cx+r},${cy}`}
          fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="12" strokeLinecap="round" />
        {/* Value arc */}
        <path d={`M ${cx-r},${cy} A ${r},${r} 0 0,1 ${cx+r},${cy}`}
          fill="none" stroke={color} strokeWidth="12" strokeLinecap="round"
          strokeDasharray={`${strokeDash} ${circumference}`}
          style={{ transition: 'stroke-dasharray 1s cubic-bezier(0.34,1.56,0.64,1)', filter: `drop-shadow(0 0 8px ${color}60)` }} />
        {/* Score text */}
        <text x={cx} y={cy - 8} textAnchor="middle" fontSize="30" fontWeight="700"
          fontFamily="Space Grotesk, sans-serif" fill={color}>{pct}%</text>
        <text x={cx} y={cy + 10} textAnchor="middle" fontSize="11" fill="#6B7280" fontFamily="Inter, sans-serif">
          return risk
        </text>
      </svg>
    </div>
  )
}
