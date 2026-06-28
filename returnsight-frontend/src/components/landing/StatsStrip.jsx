import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'

function AnimatedStat({ value, suffix = '' }) {
  const [display, setDisplay] = useState(0)
  const ref = useRef()
  useEffect(() => {
    const el = ref.current
    const obs = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return
      obs.disconnect()
      const target = parseFloat(value)
      const steps = 60, dec = target % 1 !== 0 ? 1 : 0
      let i = 0
      const id = setInterval(() => {
        i++
        setDisplay(+(target * (i / steps)).toFixed(dec))
        if (i >= steps) { setDisplay(target); clearInterval(id) }
      }, 20)
    }, { threshold: 0.5 })
    obs.observe(el)
    return () => obs.disconnect()
  }, [value])
  return <span ref={ref}>{display}{suffix}</span>
}

// SVG icons
const IconClipboard = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>
    <rect x="8" y="2" width="8" height="4" rx="1"/>
  </svg>
)
const IconStar = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
  </svg>
)
const IconZap = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
  </svg>
)
const IconTarget = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>
  </svg>
)
const IconImage = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/>
    <polyline points="21 15 16 10 5 21"/>
  </svg>
)
const IconAlert = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
    <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
  </svg>
)
const IconDollar = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
  </svg>
)
const IconSearch = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
  </svg>
)

// ── STATS STRIP ─────────────────────────────────────────────
export function StatsStrip() {
  const stats = [
    { value: 66, suffix: 'M', label: 'Reviews trained on' },
    { value: 7.2, suffix: 'M', label: 'Listings processed' },
    { value: 27, suffix: '%', label: 'Avg return rate' },
    { value: 94, suffix: '%', label: 'AUC-ROC accuracy' },
    { value: 5, suffix: '', label: 'AI signals/listing' },
  ]
  return (
    <section className="border-y" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5" style={{ borderColor: 'var(--border)' }}>
        {stats.map((s, i) => (
          <div key={s.label} className="py-6 px-4 text-center border-r border-b md:border-b-0 last:border-r-0"
            style={{ borderColor: 'var(--border)' }}>
            <p className="font-display font-bold text-2xl sm:text-3xl mb-1" style={{ color: 'var(--orange)' }}>
              <AnimatedStat value={s.value} suffix={s.suffix} />
            </p>
            <p className="text-xs leading-tight" style={{ color: 'var(--muted)' }}>{s.label}</p>
          </div>
        ))}
      </div>
    </section>
  )
}

// ── HOW IT WORKS ─────────────────────────────────────────────
export function HowItWorks() {
  const steps = [
    { icon: <IconClipboard />, num: '01', title: 'Paste your listing', desc: 'Title, description, and price from any platform. The model reads it exactly as a buyer would — punctuation, phrasing and all.', accent: '#FF5C1A' },
    { icon: <IconStar />, num: '02', title: 'Add customer reviews', desc: 'Paste raw reviews — the smart parser auto-detects sentiment and star ratings. Batch paste with --- separators.', accent: '#7C3AED' },
    { icon: <IconZap />, num: '03', title: 'Run the AI pipeline', desc: 'CLIP + sentence-transformers + tabular signals fused via attention layer. 5 signals computed under 1 second.', accent: '#EC4899' },
    { icon: <IconTarget />, num: '04', title: 'Get actionable verdict', desc: 'Return probability 0–100% with SHAP-level signal explainability. Know exactly what to fix before scaling ad spend.', accent: '#22C55E' },
  ]
  return (
    <section className="py-16 md:py-24 w-full" style={{ background: 'var(--bg)' }}>
      <div className="w-full px-4 sm:px-8 lg:px-16">
        <motion.div className="mb-10 md:mb-16 text-center"
          initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }} transition={{ duration: 0.5 }}>
          <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: 'var(--orange)' }}>How it works</p>
          <h2 className="font-display font-bold mb-3" style={{ fontSize: 'clamp(24px,4vw,48px)', color: '#fff' }}>
            From listing to verdict in seconds.
          </h2>
          <p className="text-sm max-w-lg mx-auto px-4" style={{ color: 'var(--muted)', lineHeight: 1.7 }}>
            Most sellers discover return risk <em>after</em> scaling spend. ReturnSight catches it at listing time.
          </p>
        </motion.div>

        {/* Mobile: 1 col stacked. Tablet: 2 col. Desktop: 4 col */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {steps.map((s, i) => (
            <motion.div key={s.num}
              initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.2 }} transition={{ delay: i * 0.08, duration: 0.5 }}
              className="relative rounded-2xl p-6 border overflow-hidden"
              style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
              <div className="absolute top-3 right-4 font-display font-bold select-none"
                style={{ fontSize: 48, color: `${s.accent}10`, lineHeight: 1 }}>{s.num}</div>
              <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-4"
                style={{ background: `${s.accent}15`, color: s.accent }}>
                {s.icon}
              </div>
              <div className="w-7 h-0.5 mb-3 rounded-full" style={{ background: s.accent }} />
              <h3 className="font-display font-semibold text-sm mb-2" style={{ color: '#E5E7EB' }}>{s.title}</h3>
              <p className="text-xs leading-relaxed" style={{ color: 'var(--muted)' }}>{s.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ── SIGNALS SECTION ──────────────────────────────────────────
export function SignalsSection() {
  const signals = [
    { icon: <IconImage />, label: 'Image + Text Fusion', badge: 'Supporting', badgeColor: '#6B7280', desc: 'CLIP visual embeddings fused with sentence-transformer text via learned attention weights.', metric: 'Attn: 0.214' },
    { icon: <IconStar />, label: 'Average Rating', badge: 'High Signal', badgeColor: '#F59E0B', desc: 'Mean star rating across submitted reviews. Below 3.5 with 30+ reviews is a dominant return predictor.', metric: 'Threshold: 3.5★' },
    { icon: <IconAlert />, label: '1-Star Review %', badge: 'High Signal', badgeColor: '#F59E0B', desc: 'Above 25% correlates strongly with high return rates in Clothing & Jewelry categories.', metric: '>25% threshold' },
    { icon: <IconDollar />, label: 'Price Anomaly', badge: 'Reliable', badgeColor: '#22C55E', desc: 'Price-to-category-median ratio. Suspiciously cheap listings often signal misrepresented products.', metric: '<0.3 = risky' },
    { icon: <IconSearch />, label: 'Review Mismatch', badge: 'Strongest', badgeColor: '#EF4444', desc: 'Cosine distance between your description and what buyers actually say. High gap = listing mismatch.', metric: '>0.6 = high risk' },
  ]
  return (
    <section className="py-16 md:py-24 w-full" style={{ background: 'var(--surface)' }}>
      <div className="w-full px-4 sm:px-8 lg:px-16">
        <motion.div className="text-center mb-10 md:mb-16"
          initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }} transition={{ duration: 0.5 }}>
          <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: 'var(--orange)' }}>5 AI signals</p>
          <h2 className="font-display font-bold mb-3" style={{ fontSize: 'clamp(24px,4vw,48px)', color: '#fff' }}>
            Every prediction is explained.
          </h2>
          <p className="text-sm max-w-lg mx-auto px-4" style={{ color: 'var(--muted)', lineHeight: 1.7 }}>
            SHAP-backed signal breakdown for each listing. Not a black box — a precise audit.
          </p>
        </motion.div>

        {/* Mobile: 1 col. sm: 2 col. lg: 5 col */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {signals.map((s, i) => (
            <motion.div key={s.label}
              initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.15 }} transition={{ delay: i * 0.07, duration: 0.5 }}
              className="rounded-2xl p-5 border flex flex-col gap-3"
              style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
              <div className="flex items-start justify-between gap-2">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: `${s.badgeColor}15`, color: s.badgeColor }}>
                  {s.icon}
                </div>
                <span className="text-xs font-mono px-2 py-0.5 rounded-full flex-shrink-0"
                  style={{ background: `${s.badgeColor}15`, color: s.badgeColor, border: `1px solid ${s.badgeColor}30` }}>
                  {s.badge}
                </span>
              </div>
              <div>
                <h3 className="font-display font-semibold text-sm mb-1.5" style={{ color: '#E5E7EB' }}>{s.label}</h3>
                <p className="text-xs leading-relaxed" style={{ color: 'var(--muted)' }}>{s.desc}</p>
              </div>
              <div className="mt-auto pt-2 border-t font-mono text-xs" style={{ borderColor: 'var(--border)', color: `${s.badgeColor}CC` }}>
                {s.metric}
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}