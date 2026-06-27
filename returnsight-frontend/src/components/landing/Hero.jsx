import { useEffect, useRef, useState } from 'react'
import Button from '../ui/Button'

function ParticleCanvas() {
  const ref = useRef()
  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const resize = () => { canvas.width = canvas.offsetWidth; canvas.height = canvas.offsetHeight }
    resize()
    window.addEventListener('resize', resize)
    // Fix 8: 100 particles
    const dots = Array.from({ length: 100 }, () => ({
      x: Math.random() * canvas.width, y: Math.random() * canvas.height,
      vx: (Math.random() - 0.5) * 0.5, vy: (Math.random() - 0.5) * 0.5,
      r: Math.random() * 2 + 0.5, pulse: Math.random() * Math.PI * 2,
    }))
    let raf
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      for (const d of dots) {
        d.x += d.vx; d.y += d.vy; d.pulse += 0.02
        if (d.x < 0 || d.x > canvas.width) d.vx *= -1
        if (d.y < 0 || d.y > canvas.height) d.vy *= -1
        const alpha = 0.3 + Math.sin(d.pulse) * 0.3
        ctx.beginPath(); ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(255,92,26,${alpha})`; ctx.fill()
      }
      for (let i = 0; i < dots.length; i++) {
        for (let j = i + 1; j < dots.length; j++) {
          const dx = dots[i].x - dots[j].x, dy = dots[i].y - dots[j].y
          const dist = Math.sqrt(dx*dx + dy*dy)
          if (dist < 140) {
            ctx.beginPath(); ctx.moveTo(dots[i].x, dots[i].y); ctx.lineTo(dots[j].x, dots[j].y)
            ctx.strokeStyle = `rgba(124,58,237,${0.2*(1-dist/140)})`; ctx.lineWidth = 0.6; ctx.stroke()
          }
        }
      }
      raf = requestAnimationFrame(draw)
    }
    draw()
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', resize) }
  }, [])
  return <canvas ref={ref} className="absolute inset-0 w-full h-full pointer-events-none" />
}

function LiveCounter() {
  const [count, setCount] = useState(847)
  useEffect(() => {
    const id = setInterval(() => setCount(c => c + Math.floor(Math.random() * 4 + 1)), 30000)
    return () => clearInterval(id)
  }, [])
  return <span className="font-mono font-bold" style={{ color: 'var(--orange)' }}>{count}</span>
}

export default function Hero({ onAnalyze }) {
  return (
    <section className="relative min-h-screen flex flex-col items-center justify-center px-8 pt-20 pb-16 mesh-bg overflow-hidden">
      <ParticleCanvas />
      <div className="absolute left-0 top-1/4 w-80 h-80 rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(255,92,26,0.12) 0%, transparent 70%)', transform: 'translateX(-40%)' }} />
      <div className="absolute right-0 top-1/3 w-80 h-80 rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(124,58,237,0.12) 0%, transparent 70%)', transform: 'translateX(40%)' }} />

      <div className="relative z-10 w-full max-w-5xl mx-auto text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs mb-8 border"
          style={{ background: 'rgba(255,92,26,0.08)', borderColor: 'rgba(255,92,26,0.25)', color: '#FF5C1A' }}>
          <span className="w-1.5 h-1.5 rounded-full bg-orange-400 animate-pulse" />
          <LiveCounter /> products analyzed today
        </div>

        <h1 className="font-display font-bold leading-tight mb-6" style={{ fontSize: 'clamp(3rem, 7vw, 5rem)' }}>
          Know the risk before the{' '}
          <span className="gradient-text">return.</span>
        </h1>

        <p className="text-xl mb-10 max-w-2xl mx-auto" style={{ color: 'var(--muted)', lineHeight: 1.7 }}>
          The only AI tool that reads your listing the way a buyer does —
          then tells you if they'll send it back.
        </p>

        {/* Fix 7: only one centered CTA, no "See a live example" */}
        <div className="flex justify-center mb-16">
          <Button onClick={onAnalyze} className="px-12 py-3.5 text-base">Analyze a Product</Button>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-6 text-xs" style={{ color: 'var(--muted)' }}>
          {['Trusted by sellers managing $2M+ in returns', '66M Amazon reviews trained on', '5-signal AI explainability', 'Sub-second predictions'].map((t, i) => (
            <span key={i} className="flex items-center gap-3">
              {i > 0 && <span className="w-px h-3" style={{ background: 'var(--border)' }} />}
              {t}
            </span>
          ))}
        </div>
      </div>
    </section>
  )
}
