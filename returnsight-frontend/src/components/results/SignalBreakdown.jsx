import SignalTooltip from './SignalTooltip'

const SIGNAL_LABELS = {
  image_text_fusion: 'Image + Text Fusion',
  avg_rating: 'Average Rating',
  one_star_pct: '1-Star Review %',
  price_anomaly: 'Price Anomaly',
  review_mismatch: 'Review Mismatch',
}

const barColor = (v) => {
  const abs = Math.abs(v)
  if (abs > 0.15) return '#EF4444'
  if (abs > 0.07) return '#F59E0B'
  return '#22C55E'
}

export default function SignalBreakdown({ signals, loading }) {
  if (loading) {
    return (
      <div className="space-y-3">
        {Object.keys(SIGNAL_LABELS).map((_, i) => (
          <div key={i} className="rounded-lg p-4 border" style={{ borderColor: 'var(--border)', animationDelay: `${i * 0.15}s` }}>
            <div className="shimmer h-3 rounded w-1/3 mb-2" />
            <div className="shimmer h-2 rounded w-full" />
          </div>
        ))}
      </div>
    )
  }
  if (!signals) return null

  const maxAbs = Math.max(...Object.values(signals).map(Math.abs), 0.01)

  return (
    <div className="rounded-xl p-4 border" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
      <p className="text-xs font-medium mb-4" style={{ color: 'var(--muted)' }}>SIGNAL BREAKDOWN</p>
      <div className="space-y-3">
        {Object.entries(signals).map(([key, value]) => {
          const abs = Math.abs(value)
          const pct = (abs / maxAbs) * 100
          const color = barColor(value)
          return (
            <div key={key}>
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium" style={{ color: 'var(--text)' }}>{SIGNAL_LABELS[key]}</span>
                  <SignalTooltip signal={key} value={value} />
                </div>
                <span className="text-xs font-mono" style={{ color }}>{value > 0 ? '+' : ''}{value.toFixed(4)}</span>
              </div>
              <div className="h-1.5 rounded-full" style={{ background: 'rgba(255,255,255,0.07)' }}>
                <div className="h-full rounded-full transition-all duration-700"
                  style={{ width: `${pct}%`, background: color, boxShadow: `0 0 6px ${color}60` }} />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
