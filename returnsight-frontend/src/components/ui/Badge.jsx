import clsx from 'clsx'

// ── Badge ────────────────────────────────────────────────────
export function Badge({ children, variant = 'default', className }) {
  const vars = {
    high: { bg: 'rgba(239,68,68,0.15)', color: '#EF4444', border: 'rgba(239,68,68,0.3)' },
    medium: { bg: 'rgba(245,158,11,0.15)', color: '#F59E0B', border: 'rgba(245,158,11,0.3)' },
    low: { bg: 'rgba(34,197,94,0.15)', color: '#22C55E', border: 'rgba(34,197,94,0.3)' },
    orange: { bg: 'rgba(255,92,26,0.15)', color: '#FF5C1A', border: 'rgba(255,92,26,0.3)' },
    default: { bg: 'rgba(255,255,255,0.07)', color: '#E5E7EB', border: 'rgba(255,255,255,0.1)' },
  }
  const s = vars[variant] || vars.default
  return (
    <span className={clsx('inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border', className)}
      style={{ background: s.bg, color: s.color, borderColor: s.border }}>
      {children}
    </span>
  )
}

// ── Tooltip ──────────────────────────────────────────────────
export function Tooltip({ children, content, className }) {
  return (
    <div className={clsx('relative group', className)}>
      {children}
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 rounded-lg text-xs whitespace-nowrap
        opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50"
        style={{ background: '#1e1f2a', border: '1px solid rgba(255,255,255,0.1)', color: 'var(--text)' }}>
        {content}
        <span className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent"
          style={{ borderTopColor: '#1e1f2a' }} />
      </div>
    </div>
  )
}
