import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

const SIGNAL_INFO = {
  image_text_fusion: { label: 'Image + Text Fusion', desc: 'CLIP image + text embedding fusion score. Reflects listing visual quality and image-text consistency. Lower weight for AI-generated product photos.', threshold: '0.6' },
  avg_rating: { label: 'Average Rating', desc: 'Mean star rating across submitted reviews. Below 3.5 with 30+ reviews is a strong return predictor.', threshold: '3.5' },
  one_star_pct: { label: '1-Star %', desc: 'Percentage of 1-star reviews. Above 25% correlates strongly with high return rates in Clothing & Jewelry.', threshold: '0.25' },
  price_anomaly: { label: 'Price Anomaly', desc: 'Your price divided by category median. Score <0.3 = suspiciously underpriced, often signals misrepresented products.', threshold: '0.3' },
  review_mismatch: { label: 'Review Mismatch', desc: 'Cosine distance between seller description and review text embeddings. High score = buyers received something different from listing.', threshold: '0.6' },
}

export default function SignalTooltip({ signal, value }) {
  const [open, setOpen] = useState(false)
  // Fix 3: smart positioning
  const [side, setSide] = useState('right')
  const ref = useRef(null)
  const info = SIGNAL_INFO[signal]

  useEffect(() => {
    if (!open || !ref.current) return
    const rect = ref.current.getBoundingClientRect()
    setSide(rect.right + 280 > window.innerWidth ? 'left' : 'right')
  }, [open])

  if (!info) return null

  return (
    <div className="relative inline-block" ref={ref}>
      <button onClick={() => setOpen(!open)} aria-label={`Info: ${info.label}`}
        className="w-4 h-4 rounded-full text-xs flex items-center justify-center transition-colors"
        style={{ background: open ? 'rgba(255,92,26,0.3)' : 'rgba(255,255,255,0.07)', color: 'var(--muted)' }}>
        ⓘ
      </button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }} transition={{ duration: 0.15 }}
            className={`absolute top-0 z-50 w-64 rounded-xl p-4 shadow-xl ${side === 'right' ? 'left-6' : 'right-6'}`}
            style={{ background: '#1a1b26', border: '1px solid rgba(255,255,255,0.1)' }}>
            <button onClick={() => setOpen(false)} className="absolute top-2 right-2 w-5 h-5 flex items-center justify-center text-xs text-muted hover:text-text">×</button>
            <p className="font-semibold text-xs mb-2" style={{ color: 'var(--orange)' }}>{info.label}</p>
            <p className="text-xs leading-relaxed mb-2" style={{ color: 'var(--text)' }}>{info.desc}</p>
            {value !== undefined && (
              <p className="text-xs font-mono" style={{ color: 'var(--muted)' }}>
                Current: <span style={{ color: 'var(--orange)' }}>{Number(value).toFixed(3)}</span> (threshold: {info.threshold})
              </p>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
