import { useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

export default function Modal({ open, onClose, title, children, width = 480 }) {
  const panelRef = useRef(null)

  // Focus trap
  useEffect(() => {
    if (!open) return
    const el = panelRef.current
    const focusable = el?.querySelectorAll('button,input,select,textarea,[tabindex="0"]')
    if (focusable?.length) focusable[0].focus()

    const trap = (e) => {
      if (e.key !== 'Tab' || !focusable?.length) return
      const first = focusable[0], last = focusable[focusable.length - 1]
      if (e.shiftKey ? document.activeElement === first : document.activeElement === last) {
        e.preventDefault()
        ;(e.shiftKey ? last : first).focus()
      }
    }
    const esc = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', trap)
    window.addEventListener('keydown', esc)
    return () => { window.removeEventListener('keydown', trap); window.removeEventListener('keydown', esc) }
  }, [open, onClose])

  return (
    <AnimatePresence>
      {open && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-[200] flex items-center justify-center p-4"
          style={{ backdropFilter: 'blur(8px)', background: 'rgba(0,0,0,0.6)' }}
          onClick={e => e.target === e.currentTarget && onClose()}>
          <motion.div ref={panelRef} initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }} transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="rounded-xl border p-6 relative" role="dialog" aria-modal="true" aria-label={title}
            style={{ background: 'var(--card)', borderColor: 'rgba(255,255,255,0.08)', width: '100%', maxWidth: width }}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display font-semibold text-base">{title}</h2>
              <button onClick={onClose} className="w-7 h-7 rounded-md hover:bg-white/5 flex items-center justify-center text-muted hover:text-text text-lg">×</button>
            </div>
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
