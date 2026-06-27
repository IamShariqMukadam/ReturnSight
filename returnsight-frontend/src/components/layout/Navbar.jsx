import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useAppStore } from '../../store/appStore'

export default function Navbar() {
  const { apiStatus, setHistoryOpen, setSettingsOpen, mode, setMode, setPaletteOpen } = useAppStore()
  const navigate = useNavigate()
  const location = useLocation()
  const statusColor = { online: '#22C55E', offline: '#EF4444', degraded: '#F59E0B' }[apiStatus]
  const statusLabel = { online: 'API Online', offline: 'API Offline', degraded: 'Loading' }[apiStatus]

  // Fix 2: navigate to '/' when clicking mode tabs so dashboard can go back
  const handleMode = (m) => {
    setMode(m)
    if (location.pathname !== '/') navigate('/')
  }

  const modeItems = ['Single', 'Batch', 'Compare']

  return (
    // Fix 1: h-14 (56px) → h-[68px] (+20%), larger font, wider spacing
    <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between border-b"
      style={{ height: 68, paddingLeft: 32, paddingRight: 32, background: 'rgba(9,10,14,0.97)', backdropFilter: 'blur(16px)', borderColor: 'var(--border)' }}>

      <Link to="/" className="flex items-center gap-3 font-display font-bold text-xl">
        <span className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ background: '#000', border: '1px solid rgba(255,92,26,0.4)', boxShadow: '0 0 14px rgba(255,92,26,0.2)' }}>
          <span style={{ color: '#FF5C1A', fontFamily: 'Space Grotesk', fontSize: 13, fontWeight: 800, letterSpacing: '-0.5px' }}>RS</span>
        </span>
        ReturnSight
      </Link>

      {/* Fix 1: wider gap between nav items */}
      <div className="hidden md:flex items-center gap-1">
        {modeItems.map(m => (
          <button key={m} onClick={() => handleMode(m.toLowerCase())}
            className="px-5 py-2 rounded-lg text-sm font-medium transition-all"
            style={{
              background: mode === m.toLowerCase() && location.pathname === '/' ? 'rgba(255,92,26,0.15)' : 'transparent',
              color: mode === m.toLowerCase() && location.pathname === '/' ? '#FF5C1A' : '#6B7280',
            }}>
            {m}
          </button>
        ))}
        {/* Fix 2: Dashboard as navigate link, visually distinct */}
        <button onClick={() => navigate('/dashboard')}
          className="px-5 py-2 rounded-lg text-sm font-medium transition-all ml-2"
          style={{
            background: location.pathname === '/dashboard' ? 'rgba(124,58,237,0.15)' : 'transparent',
            color: location.pathname === '/dashboard' ? '#7C3AED' : '#6B7280',
          }}>
          Dashboard
        </button>
      </div>

      <div className="flex items-center gap-4">
        <div className="hidden sm:flex items-center gap-1.5 text-xs" style={{ color: statusColor }}>
          <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: statusColor }} />
          {statusLabel}
        </div>
        <button onClick={() => setHistoryOpen(true)} title="History (Ctrl+H)"
          className="w-9 h-9 rounded-lg flex items-center justify-center hover:bg-white/5 transition-colors" style={{ color: '#6B7280' }}>
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/><polyline points="12,6 12,12 16,14"/>
          </svg>
        </button>
        <button onClick={() => setSettingsOpen(true)} title="Settings"
          className="w-9 h-9 rounded-lg flex items-center justify-center hover:bg-white/5 transition-colors" style={{ color: '#6B7280' }}>
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
          </svg>
        </button>
        <button onClick={() => setPaletteOpen(true)}
          className="hidden md:flex items-center gap-1 px-2.5 py-1 rounded-md text-xs border hover:bg-white/5 transition-colors"
          style={{ borderColor: 'var(--border)', color: 'var(--muted)' }}>
          <kbd className="font-mono">⌘K</kbd>
        </button>
      </div>
    </nav>
  )
}
