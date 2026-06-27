import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'

// Animated counter
function AnimatedStat({ value, suffix = '', prefix = '' }) {
  const [display, setDisplay] = useState(0)
  const ref = useRef()
  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return; obs.disconnect()
      const target = parseFloat(value), steps = 60; let i = 0
      const id = setInterval(() => { i++; setDisplay(+(target*(i/steps)).toFixed(1)); if(i>=steps){setDisplay(target);clearInterval(id)} }, 20)
    }, { threshold: 0.5 })
    obs.observe(ref.current)
    return () => obs.disconnect()
  }, [value])
  return <span ref={ref}>{prefix}{display}{suffix}</span>
}

// Modern SVG icons
const Icons = {
  Clipboard: () => (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="2" width="6" height="4" rx="1"/><path d="M8 4H6a2 2 0 00-2 2v14a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-2"/>
      <path d="M9 12h6M9 16h4"/>
    </svg>
  ),
  Star: () => (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26"/>
    </svg>
  ),
  Zap: () => (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="13,2 3,14 12,14 11,22 21,10 12,10"/>
    </svg>
  ),
  Target: () => (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>
    </svg>
  ),
  Layers: () => (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12,2 2,7 12,12 22,7"/><polyline points="2,17 12,22 22,17"/><polyline points="2,12 12,17 22,12"/>
    </svg>
  ),
  BarChart: () => (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/><line x1="2" y1="20" x2="22" y2="20"/>
    </svg>
  ),
  AlertTriangle: () => (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
      <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
    </svg>
  ),
  Tag: () => (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/>
    </svg>
  ),
  GitDiff: () => (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="18" cy="18" r="3"/><circle cx="6" cy="6" r="3"/>
      <path d="M13 6h3a2 2 0 012 2v7"/><line x1="6" y1="9" x2="6" y2="21"/>
    </svg>
  ),
}

// Fix 4: Full-width stats with bigger cards
export function StatsStrip() {
  const stats = [
    { value: 66, suffix: 'M', label: 'Reviews in training' },
    { value: 7.2, suffix: 'M', label: 'Listings processed' },
    { value: 27, suffix: '%', label: 'Avg return rate' },
    { value: 94, suffix: '%', label: 'AUC-ROC accuracy' },
    { value: 5, suffix: '', label: 'AI signals per listing' },
  ]
  return (
    <section className="py-8 border-y" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
      <div className="w-full max-w-7xl mx-auto px-2 grid grid-cols-5 gap-0">
        {stats.map((s, i) => (
          <div key={s.label} className="flex flex-col items-center justify-center py-6 px-4 relative">
            {i < 4 && <div className="absolute right-0 top-1/4 bottom-1/4 w-px" style={{ background: 'var(--border)' }} />}
            <p className="font-display font-bold text-3xl mb-1" style={{ color: 'var(--orange)' }}>
              <AnimatedStat value={s.value} suffix={s.suffix} />
            </p>
            <p className="text-xs text-center" style={{ color: 'var(--muted)' }}>{s.label}</p>
          </div>
        ))}
      </div>
    </section>
  )
}

// Fix 5+2: HowItWorks — full width, upgraded cards, modern SVG icons
export function HowItWorks() {
  const steps = [
    { Icon: Icons.Clipboard, num: '01', title: 'Paste your listing', desc: 'Title, description, and price from any platform. The AI reads it exactly as a buyer would — punctuation, phrasing, and all.', color: '#FF5C1A' },
    { Icon: Icons.Star, num: '02', title: 'Add customer reviews', desc: 'Paste raw reviews — the smart parser auto-detects sentiment and star ratings. Batch paste with --- separators.', color: '#F59E0B' },
    { Icon: Icons.Zap, num: '03', title: 'Run the AI pipeline', desc: 'CLIP + sentence-transformers + tabular signals fused via attention layer. 5 signals computed under 1 second.', color: '#7C3AED' },
    { Icon: Icons.Target, num: '04', title: 'Get actionable verdict', desc: 'Return probability 0–100% with SHAP-level signal explainability. Know exactly what to fix before scaling ad spend.', color: '#22C55E' },
  ]
  return (
    <section className="py-24 px-8" style={{ background: 'var(--bg)' }}>
      <div className="w-full max-w-7xl mx-auto">
        <div className="mb-16 text-center">
          <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: 'var(--orange)' }}>How it works</p>
          <h2 className="font-display font-bold mb-4" style={{ fontSize: 'clamp(1.8rem, 3vw, 2.5rem)' }}>From listing to verdict in seconds.</h2>
          <p className="text-sm max-w-lg mx-auto" style={{ color: 'var(--muted)', lineHeight: 1.7 }}>
            Most sellers discover return risk <em>after</em> scaling spend. ReturnSight catches it at listing time.
          </p>
        </div>

        <div className="grid grid-cols-4 gap-5">
          {steps.map((s, i) => (
            <motion.div key={s.title}
              initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.2 }} transition={{ delay: i * 0.1 }}
              className="group relative rounded-2xl p-6 border overflow-hidden transition-all duration-300 hover:-translate-y-1"
              style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>

              {/* Gradient top accent */}
              <div className="absolute top-0 left-0 right-0 h-px"
                style={{ background: `linear-gradient(90deg, transparent, ${s.color}80, transparent)` }} />
              {/* Hover glow */}
              <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none rounded-2xl"
                style={{ boxShadow: `inset 0 0 60px ${s.color}08` }} />

              <div className="flex items-start justify-between mb-5">
                {/* Icon container */}
                <div className="w-12 h-12 rounded-xl flex items-center justify-center"
                  style={{ background: `${s.color}15`, color: s.color, border: `1px solid ${s.color}25` }}>
                  <s.Icon />
                </div>
                <span className="font-mono font-bold text-2xl" style={{ color: `${s.color}30` }}>{s.num}</span>
              </div>

              <h3 className="font-display font-semibold text-base mb-2.5" style={{ color: 'var(--text)' }}>{s.title}</h3>
              <p className="text-sm leading-relaxed" style={{ color: 'var(--muted)' }}>{s.desc}</p>

              {/* Bottom connector arrow except last */}
              {i < steps.length - 1 && (
                <div className="hidden xl:block absolute -right-3 top-1/2 -translate-y-1/2 z-10 w-6 h-px"
                  style={{ background: `linear-gradient(90deg, ${s.color}60, transparent)` }} />
              )}
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}

// Fix 6+2: SignalsSection — huge upgrade, full width, modern cards
export function SignalsSection() {
  const signals = [
    {
      Icon: Icons.Layers, color: '#7C3AED',
      key: 'image_text_fusion', label: 'Image + Text Fusion',
      desc: 'CLIP visual embeddings fused with sentence-transformer text via learned attention weights.',
      stat: 'Multi-modal', impact: 'Architecture',
    },
    {
      Icon: Icons.BarChart, color: '#F59E0B',
      key: 'avg_rating', label: 'Average Rating',
      desc: 'Mean star rating across submitted reviews. Below 3.5 with 30+ reviews is a dominant return predictor.',
      stat: '<3.5 ⚠', impact: 'High signal',
    },
    {
      Icon: Icons.AlertTriangle, color: '#EF4444',
      key: 'one_star_pct', label: '1-Star Review %',
      desc: 'Above 25% correlates strongly with high return rates across Clothing & Jewelry categories.',
      stat: '>25% ⚠', impact: 'Strong signal',
    },
    {
      Icon: Icons.Tag, color: '#FF5C1A',
      key: 'price_anomaly', label: 'Price Anomaly',
      desc: 'Price-to-category-median ratio. Suspiciously cheap listings often signal misrepresented products.',
      stat: '<0.3 ⚠', impact: 'Price signal',
    },
    {
      Icon: Icons.GitDiff, color: '#22C55E',
      key: 'review_mismatch', label: 'Review Mismatch',
      desc: 'Cosine distance between your description and what buyers actually say. High gap = listing mismatch.',
      stat: '>0.6 ⚠', impact: 'Text signal',
    },
  ]

  return (
    <section className="py-24 px-8" style={{ background: 'var(--surface)' }}>
      <div className="w-full max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: 'var(--orange)' }}>5 AI signals</p>
          <h2 className="font-display font-bold mb-4" style={{ fontSize: 'clamp(1.8rem, 3vw, 2.5rem)' }}>Every prediction is explained.</h2>
          <p className="text-sm max-w-lg mx-auto" style={{ color: 'var(--muted)' }}>
            SHAP-backed signal breakdown for each listing. Not a black box — a precise audit.
          </p>
        </div>

        <div className="grid grid-cols-5 gap-4">
          {signals.map((s, i) => (
            <motion.div key={s.key}
              initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.2 }} transition={{ delay: i * 0.08 }}
              className="group rounded-2xl p-5 border relative overflow-hidden transition-all duration-300 hover:-translate-y-1"
              style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>

              {/* Top gradient line */}
              <div className="absolute top-0 left-0 right-0 h-0.5 rounded-t-2xl"
                style={{ background: `linear-gradient(90deg, ${s.color}, transparent)` }} />

              {/* Icon */}
              <div className="w-11 h-11 rounded-xl flex items-center justify-center mb-4"
                style={{ background: `${s.color}12`, color: s.color, border: `1px solid ${s.color}20` }}>
                <s.Icon />
              </div>

              <h3 className="font-display font-semibold text-sm mb-2" style={{ color: 'var(--text)' }}>{s.label}</h3>
              <p className="text-xs leading-relaxed mb-4" style={{ color: 'var(--muted)' }}>{s.desc}</p>

              {/* Risk threshold badge */}
              <div className="flex items-center justify-between">
                <span className="text-xs px-2 py-0.5 rounded-full font-mono"
                  style={{ background: `${s.color}15`, color: s.color, border: `1px solid ${s.color}25` }}>
                  {s.stat}
                </span>
                <span className="text-xs" style={{ color: 'var(--muted)' }}>{s.impact}</span>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Bottom CTA */}
        <div className="mt-12 rounded-2xl p-8 border text-center"
          style={{ background: 'linear-gradient(135deg, rgba(255,92,26,0.05), rgba(124,58,237,0.05))', borderColor: 'rgba(255,92,26,0.15)' }}>
          <p className="font-display font-bold text-lg mb-2">Before/After: Catch risk at listing time.</p>
          <p className="text-sm" style={{ color: 'var(--muted)' }}>
            Most sellers discover return problems after scaling ad spend. ReturnSight shifts that to before publishing.
          </p>
        </div>
      </div>
    </section>
  )
}
