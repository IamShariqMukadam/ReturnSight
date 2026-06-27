export default function Footer() {
  return (
    // Fix 4: py-10 → py-5 to reduce height
    <footer className="border-t py-5 px-8" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="w-7 h-7 rounded-md flex items-center justify-center"
            style={{ background: '#000', border: '1px solid rgba(255,92,26,0.3)' }}>
            <span style={{ color: '#FF5C1A', fontSize: 10, fontWeight: 800, fontFamily: 'Space Grotesk' }}>RS</span>
          </span>
          <div>
            <p className="font-display font-semibold text-sm" style={{ color: 'var(--text)' }}>ReturnSight</p>
            <p className="text-xs" style={{ color: 'var(--muted)' }}>AI-powered return risk for e-commerce sellers</p>
          </div>
        </div>
        <div className="flex items-center gap-6 text-xs" style={{ color: 'var(--muted)' }}>
          <span>Trained on 66M Amazon reviews</span>
          <span className="w-px h-3" style={{ background: 'var(--border)' }} />
          <span>returnsight.app</span>
          <span className="w-px h-3" style={{ background: 'var(--border)' }} />
          <span>Not affiliated with Amazon</span>
        </div>
      </div>
    </footer>
  )
}
