import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { parseReviews, summarizeDetected } from '../../utils/sentimentDetector'
import Button from '../ui/Button'

export default function SmartReviewParser({ onParsed }) {
  const [open, setOpen] = useState(false)
  const [raw, setRaw] = useState('')
  const [parsed, setParsed] = useState(null)

  const parse = () => {
    const reviews = parseReviews(raw)
    const summary = summarizeDetected(reviews)
    setParsed({ reviews, summary })
  }

  const apply = () => {
    onParsed?.(parsed.reviews)
    setOpen(false)
    setRaw('')
    setParsed(null)
  }

  return (
    <div className="rounded-xl border mb-4" style={{ borderColor: 'var(--border)' }}>
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between p-4 text-left">
        <div>
          <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>Smart Review Parser</p>
          <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>Paste raw review text — auto-detects sentiment & rating</p>
        </div>
        <span className="text-xs" style={{ color: 'var(--muted)' }}>{open ? '▲' : '▼'}</span>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden">
            <div className="px-4 pb-4 space-y-3">
              <textarea value={raw} onChange={e => setRaw(e.target.value)} rows={5}
                placeholder="Paste multiple reviews separated by --- or blank lines..."
                className="w-full rounded-lg p-3 text-sm resize-none outline-none"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)', color: 'var(--text)' }} />
              <div className="flex items-center gap-2">
                <Button onClick={parse} variant="secondary" disabled={!raw.trim()}>Parse Reviews</Button>
                {parsed && (
                  <Button onClick={apply}>Apply {parsed.summary.total} Reviews</Button>
                )}
              </div>
              {parsed && (
                <div className="rounded-lg p-3 text-xs" style={{ background: 'rgba(255,255,255,0.04)' }}>
                  <p style={{ color: 'var(--text)' }}>
                    Detected {parsed.summary.total} reviews:
                    <span style={{ color: '#EF4444' }}> {parsed.summary.negative} negative</span>,
                    <span style={{ color: '#22C55E' }}> {parsed.summary.positive} positive</span>,
                    <span style={{ color: 'var(--muted)' }}> {parsed.summary.neutral} neutral</span>
                  </p>
                  <div className="mt-2 space-y-1 max-h-32 overflow-y-auto">
                    {parsed.reviews.map((r, i) => (
                      <p key={i} style={{ color: 'var(--muted)' }}>
                        ★{r.rating} — {r.text.slice(0, 60)}...
                      </p>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
