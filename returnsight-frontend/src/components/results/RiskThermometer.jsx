export default function RiskThermometer({ probability = 0 }) {
  const pct = Math.round(probability * 100)
  const { settings } = window.__appStore?.getState?.() || { settings: { highRiskThreshold: 65, mediumRiskThreshold: 35 } }

  const segments = [
    { label: 'Low', color: '#22C55E', range: '0–35%', from: 0, to: 35 },
    { label: 'Medium', color: '#F59E0B', range: '35–65%', from: 35, to: 65 },
    { label: 'High', color: '#EF4444', range: '65–100%', from: 65, to: 100 },
  ]

  return (
    <div className="rounded-xl p-4 border h-full" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
      <p className="text-xs font-medium mb-3" style={{ color: 'var(--muted)' }}>RISK LEVEL</p>
      <div className="space-y-2">
        {segments.map(s => {
          const isActive = pct >= s.from && (s.to === 100 ? pct <= 100 : pct < s.to)
          return (
            <div key={s.label} className="flex items-center gap-3">
              <div className="w-2 h-8 rounded-full transition-all"
                style={{ background: isActive ? s.color : 'rgba(255,255,255,0.05)', boxShadow: isActive ? `0 0 8px ${s.color}60` : 'none' }} />
              <div>
                <p className="text-xs font-semibold" style={{ color: isActive ? s.color : 'var(--muted)' }}>
                  {s.label}
                </p>
                <p className="text-xs" style={{ color: 'var(--muted)' }}>{s.range}</p>
              </div>
              {isActive && (
                <span className="ml-auto text-xs font-mono font-bold" style={{ color: s.color }}>{pct}%</span>
              )}
            </div>
          )
        })}
      </div>
      {/* Gradient bar */}
      <div className="mt-4 rounded-full h-2 relative" style={{ background: 'linear-gradient(to right, #22C55E, #F59E0B, #EF4444)' }}>
        <div className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full border-2 border-white transition-all"
          style={{ left: `calc(${pct}% - 6px)`, background: 'white', boxShadow: '0 0 8px rgba(255,255,255,0.5)' }} />
      </div>
    </div>
  )
}
