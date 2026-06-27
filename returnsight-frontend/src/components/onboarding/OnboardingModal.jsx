import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

const SEEN_KEY = 'returnsight_seen'

const slides = [
  {
    title: 'What is ReturnSight?',
    content: ({ count }) => (
      <div>
        <div className="text-center mb-6">
          <div className="font-display font-bold mb-1" style={{ fontSize: 48, color: '#FF5C1A' }}>{count.toLocaleString()}</div>
          <p className="text-xs" style={{ color: 'var(--muted)' }}>reviews analyzed in training</p>
        </div>
        <p className="text-sm text-center leading-relaxed mb-6" style={{ color: 'var(--text)' }}>
          ReturnSight predicts return probability before you publish. Paste your listing, add reviews, and get an AI verdict in seconds.
        </p>
        {/* Pipeline SVG */}
        <svg viewBox="0 0 340 48" width="100%" height="48">
          {[['CLIP', 40], ['Text', 120], ['Tabular', 200], ['Score', 290]].map(([label, x], i) => (
            <g key={label}>
              <rect x={x - 28} y={8} width={56} height={28} rx={6}
                fill="rgba(255,92,26,0.12)" stroke="rgba(255,92,26,0.3)" strokeWidth="1" />
              <text x={x} y={26} textAnchor="middle" fontSize="9" fill="#FF5C1A" fontFamily="Inter">{label}</text>
              {i < 3 && <path d={`M ${x+28} 22 L ${x+62} 22`} stroke="rgba(255,255,255,0.2)" strokeWidth="1" markerEnd="url(#arr)" />}
            </g>
          ))}
          <defs><marker id="arr" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
            <path d="M0,0 L6,3 L0,6" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="1" />
          </marker></defs>
        </svg>
      </div>
    ),
  },
  {
    title: '3 steps to a verdict',
    content: () => (
      <div className="space-y-3">
        {[
          { n: 1, icon: '📋', title: 'Paste your listing', desc: 'Title, description, price from any e-commerce platform.' },
          { n: 2, icon: '⭐', title: 'Add reviews', desc: 'Paste raw reviews or use the smart parser for auto-detection.' },
          { n: 3, icon: '🎯', title: 'Get your score', desc: 'AI returns a return probability with signal-level explainability.' },
        ].map((step, i) => (
          <motion.div key={step.n} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.15 }} className="flex items-start gap-4 rounded-xl p-4 border"
            style={{ background: 'rgba(255,92,26,0.05)', borderColor: 'rgba(255,92,26,0.15)' }}>
            <span className="text-2xl">{step.icon}</span>
            <div>
              <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>{step.title}</p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>{step.desc}</p>
            </div>
          </motion.div>
        ))}
      </div>
    ),
  },
  {
    title: 'Try it now',
    content: ({ onExample, onClose }) => (
      <div className="text-center space-y-4 py-4">
        <div className="text-5xl mb-2">🚀</div>
        <p className="text-sm" style={{ color: 'var(--muted)' }}>Load a real high-risk product example and see the full analysis.</p>
        <button onClick={() => { onExample(); onClose() }}
          className="w-full py-3 rounded-xl font-semibold text-white transition-all hover:opacity-90"
          style={{ background: 'linear-gradient(135deg,#FF5C1A,#e0450f)' }}>
          Load Example Product
        </button>
        <button onClick={onClose} className="text-xs" style={{ color: 'var(--muted)' }}>Skip and explore</button>
      </div>
    ),
  },
]

export default function OnboardingModal({ onLoadExample }) {
  const [open, setOpen] = useState(() => !localStorage.getItem(SEEN_KEY))
  const [slide, setSlide] = useState(0)
  const [count, setCount] = useState(0)

  useEffect(() => {
    if (!open) return
    let n = 0
    const id = setInterval(() => {
      n += 2_200_000
      if (n >= 66_000_000) { setCount(66_000_000); clearInterval(id) }
      else setCount(n)
    }, 50)
    return () => clearInterval(id)
  }, [open])

  const close = () => { setOpen(false); localStorage.setItem(SEEN_KEY, '1') }

  if (!open) return null

  const Slide = slides[slide]

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      style={{ backdropFilter: 'blur(8px)', background: 'rgba(0,0,0,0.7)' }}>
      <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
        className="w-full max-w-md rounded-2xl border p-6"
        style={{ background: 'var(--card)', borderColor: 'rgba(255,255,255,0.08)' }}>
        {/* Progress dots */}
        <div className="flex justify-center gap-2 mb-6">
          {slides.map((_, i) => (
            <div key={i} className="h-1.5 rounded-full transition-all"
              style={{ width: i === slide ? 24 : 8, background: i === slide ? 'var(--orange)' : 'rgba(255,255,255,0.15)' }} />
          ))}
        </div>

        <h2 className="font-display font-bold text-lg mb-4 text-center">{Slide.title}</h2>

        <AnimatePresence mode="wait">
          <motion.div key={slide} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }}>
            <Slide.content count={count} onExample={onLoadExample} onClose={close} />
          </motion.div>
        </AnimatePresence>

        {slide < slides.length - 1 && (
          <div className="flex items-center justify-between mt-6">
            <button onClick={close} className="text-xs" style={{ color: 'var(--muted)' }}>Skip</button>
            <div className="flex gap-2">
              {slide > 0 && (
                <button onClick={() => setSlide(s => s - 1)}
                  className="px-4 py-2 rounded-lg text-sm border hover:bg-white/5 transition-colors"
                  style={{ borderColor: 'var(--border)', color: 'var(--text)' }}>Back</button>
              )}
              <button onClick={() => setSlide(s => s + 1)}
                className="px-4 py-2 rounded-lg text-sm font-medium text-white transition-all hover:opacity-90"
                style={{ background: 'var(--orange)' }}>Next →</button>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  )
}
