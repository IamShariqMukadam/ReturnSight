import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import ScoreArc from './ScoreArc'
import RiskThermometer from './RiskThermometer'
import SignalBreakdown from './SignalBreakdown'
import ExportCard from './ExportCard'
import { Badge } from '../ui/Badge'
import Button from '../ui/Button'
import { encodeResult } from '../../utils/shareUrl'
import { captureCard } from '../../utils/exportImage'
import { useToast } from '../../hooks/useToast'

const RECS = [
  { key: 'review_mismatch', threshold: 0.6, msg: '⚠ Update your listing description to match buyer language. Gap between listing and reviews is the top return driver.' },
  { key: 'one_star_pct', threshold: 0.25, msg: '⚠ Address quality issues in 1-star reviews before scaling ad spend. High 1-star rate indicates a product-market fit problem.' },
  { key: 'price_anomaly', threshold: 0.3, compare: 'lt', msg: '⚠ Your price is significantly below category median. Buyers may perceive quality mismatch before purchasing.' },
  { key: 'avg_rating', threshold: 3.0, compare: 'lt', msg: '⚠ Average rating below 3.0 — consider pausing promotion until negative feedback root cause is addressed.' },
]

function getRecs(signals) {
  const triggered = RECS.filter(r => {
    const v = signals[r.key]
    if (v === undefined) return false
    return r.compare === 'lt' ? v < r.threshold : v > r.threshold
  })
  return triggered.length === 0
    ? ['✓ Low return risk profile. Safe to scale ad spend.']
    : triggered.map(r => r.msg)
}

// Fix 2: Proper bottom sheet with snap points
function MobileSheet({ children }) {
  const [snapState, setSnapState] = useState('expanded')
  const sheetRef = useRef(null)

  const snapY = { expanded: '15%', collapsed: '55%', dismissed: '100%' }

  return (
    <>
      {snapState !== 'dismissed' && (
        <motion.div
          className="fixed inset-0 z-[90] pointer-events-none"
          style={{ background: snapState === 'expanded' ? 'rgba(0,0,0,0.4)' : 'transparent', transition: 'background 0.3s' }}
        />
      )}
      <motion.div
        ref={sheetRef}
        className="bottom-sheet fixed left-0 right-0 bottom-0 z-[100]"
        style={{ top: snapY[snapState], transition: 'top 0.35s cubic-bezier(0.34,1.56,0.64,1)', overflowY: 'auto' }}
        drag="y"
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={0.1}
        onDragEnd={(e, info) => {
          const vel = info.velocity.y
          const offset = info.offset.y
          if (offset > 120 || vel > 500) {
            setSnapState(snapState === 'expanded' ? 'collapsed' : 'expanded')
          } else if (offset < -80 || vel < -500) {
            setSnapState('expanded')
          }
        }}
      >
        {/* Drag handle */}
        <div className="sticky top-0 flex justify-center pt-3 pb-2 cursor-grab active:cursor-grabbing"
          style={{ background: 'var(--card)' }}>
          <div className="w-8 h-1 rounded-full" style={{ background: 'rgba(255,255,255,0.2)' }} />
        </div>

        {snapState === 'collapsed' ? (
          <div className="flex items-center justify-between px-5 py-3" onClick={() => setSnapState('expanded')}>
            <span className="font-mono font-bold text-lg" style={{ color: 'var(--orange)' }}>
              {Math.round((children?.props?.result?.return_probability || 0) * 100)}%
            </span>
            <Badge variant={children?.props?.result?.risk_level?.toLowerCase()}>
              {children?.props?.result?.risk_level} Risk
            </Badge>
            <span className="text-xs" style={{ color: 'var(--muted)' }}>Tap to expand ↑</span>
          </div>
        ) : (
          <div className="px-4 pb-8">{children}</div>
        )}
      </motion.div>
    </>
  )
}

// ── EMPTY STATE ──────────────────────────────────────────────
function PulsingArc() {
  const [pct, setPct] = useState(42)
  useEffect(() => {
    const vals = [42, 71, 28, 85, 19, 63]
    let i = 0
    const id = setInterval(() => { i = (i + 1) % vals.length; setPct(vals[i]) }, 2200)
    return () => clearInterval(id)
  }, [])
  const color = pct >= 65 ? '#EF4444' : pct >= 35 ? '#F59E0B' : '#22C55E'
  const r = 42, circ = 2 * Math.PI * r
  const offset = circ * (1 - pct / 100)
  return (
    <div className="relative" style={{ width: 120, height: 120 }}>
      <svg viewBox="0 0 100 100" width="120" height="120">
        <circle cx="50" cy="50" r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="6" />
        <motion.circle cx="50" cy="50" r={r} fill="none" strokeWidth="6" strokeLinecap="round"
          stroke={color} strokeDasharray={circ}
          animate={{ strokeDashoffset: offset, stroke: color }}
          transition={{ duration: 1.2, ease: [0.22, 0.61, 0.36, 1] }}
          style={{ transformOrigin: '50% 50%', transform: 'rotate(-90deg)' }} />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <motion.span className="font-display font-bold" style={{ fontSize: 28, color, lineHeight: 1 }}
          animate={{ color }} transition={{ duration: 0.8 }}>
          {pct}%
        </motion.span>
      </div>
    </div>
  )
}

const SIGNAL_LABELS = ['Review Mismatch', 'Avg Rating', '1-Star Rate', 'Price Anomaly', 'Image Fusion']
const SIGNAL_WIDTHS = [82, 61, 74, 45, 38]
const SIGNAL_COLORS = ['#EF4444', '#F59E0B', '#EF4444', '#22C55E', '#6B7280']

function EmptyState() {
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
      className="rounded-2xl border overflow-hidden"
      style={{ background: 'var(--card)', borderColor: 'rgba(255,92,26,0.15)' }}>

      <div className="px-6 py-4 border-b flex items-center justify-between"
        style={{ borderColor: 'var(--border)', background: 'rgba(255,92,26,0.03)' }}>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: 'var(--orange)' }} />
          <span className="font-mono text-xs" style={{ color: 'var(--orange)', letterSpacing: '0.1em' }}>AWAITING ANALYSIS</span>
        </div>
        <span className="font-mono text-xs" style={{ color: 'var(--muted)' }}>SHAP · LightGBM · CLIP</span>
      </div>

      <div className="p-6 space-y-6">
        <div className="flex flex-col items-center gap-3 py-4">
          <PulsingArc />
          <div className="text-center">
            <p className="text-xs font-semibold mb-1 uppercase tracking-widest" style={{ color: 'var(--muted)' }}>Return Probability</p>
            <p className="text-xs" style={{ color: 'rgba(255,255,255,0.2)' }}>Preview — submit a product to get real score</p>
          </div>
        </div>

        <div className="h-px" style={{ background: 'var(--border)' }} />

        <div className="space-y-3">
          <p className="font-mono text-xs mb-4 uppercase tracking-widest" style={{ color: 'var(--muted)' }}>Signal Attribution</p>
          {SIGNAL_LABELS.map((label, i) => (
            <motion.div key={label} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.08 + 0.3 }}>
              <div className="flex justify-between items-center mb-1.5">
                <span className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>{label}</span>
                <span className="font-mono text-xs" style={{ color: 'rgba(255,255,255,0.15)' }}>—</span>
              </div>
              <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.05)' }}>
                <motion.div className="h-full rounded-full"
                  style={{ background: `${SIGNAL_COLORS[i]}40`, width: 0 }}
                  animate={{ width: `${SIGNAL_WIDTHS[i]}%` }}
                  transition={{ duration: 1.2, delay: i * 0.1 + 0.5, ease: [0.22, 0.61, 0.36, 1] }} />
              </div>
            </motion.div>
          ))}
        </div>

        <div className="h-px" style={{ background: 'var(--border)' }} />

        <div className="rounded-xl p-4 text-center" style={{ background: 'rgba(255,92,26,0.06)', border: '1px solid rgba(255,92,26,0.15)' }}>
          <p className="font-display font-semibold text-sm mb-1" style={{ color: '#fff' }}>Your verdict appears here</p>
          <p className="text-xs leading-relaxed" style={{ color: 'var(--muted)' }}>
            Fill in the product listing and hit{' '}
            <span style={{ color: 'var(--orange)' }}>Analyze Return Risk</span> to get a real prediction with SHAP attribution.
          </p>
        </div>

        <div className="flex flex-wrap gap-2 justify-center">
          {['Score 0–100%', 'Risk Level', 'Top Signal', 'Recommendations', 'Share Link'].map(f => (
            <span key={f} className="text-xs px-2.5 py-1 rounded-full font-mono"
              style={{ background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.25)', border: '1px solid var(--border)' }}>
              {f}
            </span>
          ))}
        </div>
      </div>
    </motion.div>
  )
}

// ── MAIN PANEL ───────────────────────────────────────────────
export default function ResultPanel({ result, request, isShared, isMobile }) {
  const toast = useToast()
  const [recsOpen, setRecsOpen] = useState(false)

  if (!result) return <EmptyState />

  const riskVariant = result.risk_level?.toLowerCase()
  const recs = getRecs(result.signal_breakdown || {})

  const share = () => {
    const url = encodeResult(result, request?.title || 'Product')
    navigator.clipboard?.writeText(url)
    toast.success('Link copied!')
  }

  const copyJson = () => {
    navigator.clipboard?.writeText(JSON.stringify(result.signal_breakdown, null, 2))
    toast.success('JSON copied!')
  }

  const PanelContent = () => (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
      aria-live="polite" className="mt-4">
      {isShared && (
        <div className="mb-4 px-4 py-2 rounded-lg text-sm"
          style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)', color: '#F59E0B' }}>
          ⚠ Shared result — click Analyze to run a fresh prediction
        </div>
      )}
      <div className="bento-grid">
        <div className="bento-score rounded-xl p-6 border glass" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
          <div className="flex flex-col items-center gap-4">
            <ScoreArc probability={result.return_probability} />
            <Badge variant={riskVariant}>
              {riskVariant === 'high' ? '⚠ HIGH' : riskVariant === 'low' ? '✓ LOW' : '~ MEDIUM'} RISK
            </Badge>
            <p className="text-sm text-center" style={{ color: 'var(--muted)', maxWidth: 260 }}>{result.top_reason}</p>
            <p className="text-xs font-mono" style={{ color: 'var(--muted)' }}>Latency: {result.latency_ms?.toFixed(0)}ms</p>
            <div className="flex gap-2 flex-wrap justify-center">
              <Button variant="secondary" onClick={share} className="text-xs px-3 py-1.5">Share</Button>
              <Button variant="secondary" onClick={copyJson} className="text-xs px-3 py-1.5">Copy JSON</Button>
              <Button variant="secondary" onClick={() => captureCard(request?.title || 'product')} className="text-xs px-3 py-1.5">Export PNG</Button>
            </div>
          </div>
        </div>
        <div className="bento-thermo"><RiskThermometer probability={result.return_probability} /></div>
        <div className="bento-signals"><SignalBreakdown signals={result.signal_breakdown} /></div>
        <div className="bento-meta rounded-xl border" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
          <button onClick={() => setRecsOpen(!recsOpen)} className="w-full flex items-center justify-between p-4 text-left">
            <span className="text-xs font-medium" style={{ color: 'var(--muted)' }}>SELLER RECOMMENDATIONS</span>
            <span className="text-xs" style={{ color: 'var(--muted)' }}>{recsOpen ? '▲' : '▼'}</span>
          </button>
          <AnimatePresence>
            {recsOpen && (
              <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden px-4 pb-4">
                <div className="space-y-2">
                  {recs.map((r, i) => (
                    <p key={i} className="text-sm leading-relaxed" style={{ color: r.startsWith('✓') ? '#22C55E' : '#F59E0B' }}>{r}</p>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
      <ExportCard result={result} productTitle={request?.title || 'Product'} />
    </motion.div>
  )

  if (isMobile) {
    return (
      <MobileSheet>
        <PanelContent result={result} />
      </MobileSheet>
    )
  }

  return <PanelContent />
}