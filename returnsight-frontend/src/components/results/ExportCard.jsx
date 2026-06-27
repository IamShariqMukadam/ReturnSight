import ScoreArc from './ScoreArc'
import { Badge } from '../ui/Badge'

export default function ExportCard({ result, productTitle }) {
  if (!result) return null
  const ts = new Date().toLocaleString()
  const riskVariant = result.risk_level?.toLowerCase() || 'default'
  const signals = result.signal_breakdown || {}
  const maxAbs = Math.max(...Object.values(signals).map(v => Math.abs(v)), 0.01)

  const LABELS = {
    image_text_fusion: 'Image+Text', avg_rating: 'Avg Rating',
    one_star_pct: '1-Star %', price_anomaly: 'Price', review_mismatch: 'Mismatch',
  }

  return (
    <div id="export-card" style={{ display: 'none', width: 1200, height: 630, background: '#13141C',
      fontFamily: 'Inter, sans-serif', color: '#E5E7EB', padding: 0, overflow: 'hidden' }}>
      {/* Orange gradient header strip */}
      <div style={{ height: 6, background: 'linear-gradient(90deg,#FF5C1A,#EC4899,#7C3AED)' }} />
      <div style={{ display: 'flex', padding: '40px 48px', height: 'calc(100% - 6px)', gap: 48 }}>
        {/* Left 60% */}
        <div style={{ flex: '0 0 60%', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <p style={{ fontSize: 13, color: '#6B7280', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 2 }}>Return Risk Analysis</p>
          <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 24, lineHeight: 1.3, fontFamily: 'Space Grotesk' }}>{productTitle}</h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 24, marginBottom: 28 }}>
            <ScoreArc probability={result.return_probability} />
            <div>
              <span style={{ display: 'inline-block', padding: '4px 14px', borderRadius: 20, fontSize: 13, fontWeight: 600,
                background: riskVariant === 'high' ? 'rgba(239,68,68,0.15)' : riskVariant === 'medium' ? 'rgba(245,158,11,0.15)' : 'rgba(34,197,94,0.15)',
                color: riskVariant === 'high' ? '#EF4444' : riskVariant === 'medium' ? '#F59E0B' : '#22C55E',
                border: `1px solid ${riskVariant === 'high' ? 'rgba(239,68,68,0.3)' : riskVariant === 'medium' ? 'rgba(245,158,11,0.3)' : 'rgba(34,197,94,0.3)'}` }}>
                {result.risk_level} Risk
              </span>
              <p style={{ marginTop: 12, fontSize: 13, color: '#9CA3AF', maxWidth: 320, lineHeight: 1.5 }}>{result.top_reason}</p>
            </div>
          </div>
        </div>
        {/* Right 40% */}
        <div style={{ flex: '0 0 40%', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 14 }}>
          <p style={{ fontSize: 12, color: '#6B7280', textTransform: 'uppercase', letterSpacing: 2, marginBottom: 4 }}>Signal Breakdown</p>
          {Object.entries(signals).map(([k, v]) => (
            <div key={k}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: 12, color: '#9CA3AF' }}>{LABELS[k]}</span>
                <span style={{ fontSize: 12, fontFamily: 'monospace', color: Math.abs(v) > 0.1 ? '#EF4444' : '#22C55E' }}>{v.toFixed(4)}</span>
              </div>
              <div style={{ height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.07)' }}>
                <div style={{ height: '100%', borderRadius: 2, width: `${(Math.abs(v)/maxAbs)*100}%`,
                  background: Math.abs(v) > 0.1 ? '#EF4444' : '#22C55E' }} />
              </div>
            </div>
          ))}
        </div>
      </div>
      {/* Bottom bar */}
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '12px 48px',
        borderTop: '1px solid rgba(255,255,255,0.07)', display: 'flex', justifyContent: 'space-between',
        fontSize: 11, color: '#6B7280' }}>
        <span>returnsight.app | AI-powered return risk</span>
        <span>{ts}</span>
      </div>
    </div>
  )
}
