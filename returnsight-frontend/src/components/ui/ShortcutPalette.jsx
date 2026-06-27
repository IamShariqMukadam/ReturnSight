import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAppStore } from '../../store/appStore'

const SHORTCUTS = [
  { group: 'Analysis', key: '⌘ + Enter', desc: 'Submit / trigger analysis', action: 'submit' },
  { group: 'Analysis', key: '⌘ + Shift + E', desc: 'Load example data', action: 'example' },
  { group: 'Analysis', key: '⌘ + R', desc: 'Reset form', action: 'reset' },
  { group: 'Navigation', key: '⌘ + H', desc: 'Toggle history drawer', action: 'history' },
  { group: 'Navigation', key: '⌘ + K', desc: 'Open shortcut palette', action: 'palette' },
  { group: 'Navigation', key: '⌘ + B', desc: 'Switch to batch mode', action: 'batch' },
  { group: 'Navigation', key: 'Escape', desc: 'Close modal / drawer', action: 'escape' },
]

export default function ShortcutPalette({ onAction }) {
  const { paletteOpen, setPaletteOpen } = useAppStore()
  const [query, setQuery] = useState('')

  const filtered = SHORTCUTS.filter(s =>
    s.desc.toLowerCase().includes(query.toLowerCase()) ||
    s.group.toLowerCase().includes(query.toLowerCase())
  )
  const groups = [...new Set(filtered.map(s => s.group))]

  const execute = (action) => {
    setPaletteOpen(false)
    setQuery('')
    onAction?.(action)
  }

  return (
    <AnimatePresence>
      {paletteOpen && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-[300] flex items-start justify-center pt-24 px-4"
          style={{ backdropFilter: 'blur(8px)', background: 'rgba(0,0,0,0.6)' }}
          onClick={e => e.target === e.currentTarget && setPaletteOpen(false)}>
          <motion.div initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
            className="w-full max-w-md rounded-xl border overflow-hidden"
            style={{ background: 'var(--card)', borderColor: 'rgba(255,255,255,0.08)' }}>
            <div className="p-3 border-b" style={{ borderColor: 'var(--border)' }}>
              <input autoFocus value={query} onChange={e => setQuery(e.target.value)}
                placeholder="Search shortcuts..." className="w-full bg-transparent text-sm outline-none"
                style={{ color: 'var(--text)' }} />
            </div>
            <div className="max-h-80 overflow-y-auto p-2">
              {groups.map(group => (
                <div key={group} className="mb-3">
                  <p className="px-3 py-1 text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--muted)' }}>{group}</p>
                  {filtered.filter(s => s.group === group).map(s => (
                    <button key={s.action} onClick={() => execute(s.action)}
                      className="w-full flex items-center justify-between px-3 py-2 rounded-md hover:bg-white/5 text-sm transition-colors">
                      <span style={{ color: 'var(--text)' }}>{s.desc}</span>
                      <kbd className="px-2 py-0.5 rounded text-xs font-mono" style={{ background: 'rgba(255,255,255,0.07)', color: 'var(--muted)' }}>{s.key}</kbd>
                    </button>
                  ))}
                </div>
              ))}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
