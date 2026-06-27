import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAppStore } from '../../store/appStore'
import { useHistory } from '../../hooks/useHistory'
import { Badge } from '../ui/Badge'
import Modal from '../ui/Modal'
import { exportHistoryCsv } from '../../utils/csvParser'
import { useToast } from '../../hooks/useToast'

function relTime(iso) {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

function groupByDay(items) {
  const today = new Date().toDateString()
  const yesterday = new Date(Date.now() - 86400000).toDateString()
  return items.reduce((acc, item) => {
    const d = new Date(item.timestamp).toDateString()
    const key = d === today ? 'Today' : d === yesterday ? 'Yesterday' : 'Earlier'
    ;(acc[key] = acc[key] || []).push(item)
    return acc
  }, {})
}

export default function HistoryDrawer({ onLoad }) {
  const { historyOpen, setHistoryOpen, setResult } = useAppStore()
  const { history, clearHistory, loadAnalysis, deleteEntry } = useHistory()
  const [query, setQuery] = useState('')
  const [confirmClear, setConfirmClear] = useState(false)
  const toast = useToast()

  const filtered = useMemo(() =>
    history.filter(e => e.title?.toLowerCase().includes(query.toLowerCase())),
    [history, query]
  )
  const grouped = useMemo(() => groupByDay(filtered), [filtered])

  const handleLoad = (id) => {
    const data = loadAnalysis(id)
    if (data) { setResult(data.result); onLoad?.(data); setHistoryOpen(false) }
  }

  const exportCsv = () => {
    const csv = exportHistoryCsv(history)
    const blob = new Blob([csv], { type: 'text/csv' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `returnsight_history_${Date.now()}.csv`
    a.click()
    toast.success('History exported!')
  }

  return (
    <>
      <AnimatePresence>
        {historyOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100]" style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)' }}
            onClick={() => setHistoryOpen(false)} />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {historyOpen && (
          <motion.aside initial={{ x: 320 }} animate={{ x: 0 }} exit={{ x: 320 }}
            transition={{ type: 'spring', damping: 28, stiffness: 280 }}
            className="fixed right-0 top-0 bottom-0 z-[110] flex flex-col border-l"
            style={{ width: 320, background: 'var(--surface)', borderColor: 'var(--border)' }}>
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: 'var(--border)' }}>
              <h2 className="font-display font-semibold text-sm">Analysis History</h2>
              <button onClick={() => setHistoryOpen(false)} className="text-muted hover:text-text text-xl">×</button>
            </div>

            {/* Search */}
            <div className="p-3 border-b" style={{ borderColor: 'var(--border)' }}>
              <input value={query} onChange={e => setQuery(e.target.value)}
                placeholder="Search products..." className="w-full bg-transparent text-sm outline-none"
                style={{ color: 'var(--text)' }} />
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto p-3">
              {!history.length && (
                <p className="text-xs text-center mt-8" style={{ color: 'var(--muted)' }}>
                  No analyses yet. Run your first prediction!
                </p>
              )}
              {Object.entries(grouped).map(([day, items]) => (
                <div key={day} className="mb-4">
                  <p className="text-xs font-medium mb-2 px-1" style={{ color: 'var(--muted)' }}>{day}</p>
                  <div className="space-y-2">
                    {items.map(entry => {
                      const level = entry.result?.risk_level?.toLowerCase()
                      return (
                        <div key={entry.id} onClick={() => handleLoad(entry.id)}
                          className="rounded-xl p-3 border cursor-pointer transition-all hover:bg-white/5 group"
                          style={{ background: 'rgba(255,255,255,0.02)', borderColor: 'var(--border)' }}>
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-xs font-medium truncate" style={{ color: 'var(--text)', maxWidth: 180 }}>
                              {entry.title}
                            </p>
                            <button onClick={e => { e.stopPropagation(); deleteEntry(entry.id) }}
                              className="opacity-0 group-hover:opacity-100 text-muted hover:text-red-400 text-xs transition-all">✕</button>
                          </div>
                          <div className="flex items-center gap-2 mt-2">
                            {level && <Badge variant={level}>{entry.result?.risk_level}</Badge>}
                            <span className="text-xs font-mono" style={{ color: 'var(--muted)' }}>
                              {Math.round((entry.result?.return_probability || 0) * 100)}%
                            </span>
                            <span className="ml-auto text-xs" style={{ color: 'var(--muted)' }}>{relTime(entry.timestamp)}</span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>

            {/* Footer */}
            {history.length > 0 && (
              <div className="p-3 border-t flex gap-2" style={{ borderColor: 'var(--border)' }}>
                <button onClick={exportCsv} className="flex-1 text-xs py-2 rounded-lg border hover:bg-white/5 transition-colors"
                  style={{ borderColor: 'var(--border)', color: 'var(--muted)' }}>Export CSV</button>
                <button onClick={() => setConfirmClear(true)} className="flex-1 text-xs py-2 rounded-lg border border-red-500/20 hover:bg-red-500/10 transition-colors"
                  style={{ color: '#EF4444' }}>Clear All</button>
              </div>
            )}
          </motion.aside>
        )}
      </AnimatePresence>

      <Modal open={confirmClear} onClose={() => setConfirmClear(false)} title="Clear History">
        <p className="text-sm mb-6" style={{ color: 'var(--muted)' }}>This will permanently delete all {history.length} analyses. This action cannot be undone.</p>
        <div className="flex gap-3">
          <button onClick={() => setConfirmClear(false)} className="flex-1 py-2 rounded-lg border text-sm hover:bg-white/5 transition-colors"
            style={{ borderColor: 'var(--border)', color: 'var(--text)' }}>Cancel</button>
          <button onClick={() => { clearHistory(); setConfirmClear(false) }}
            className="flex-1 py-2 rounded-lg text-sm font-medium text-white transition-colors"
            style={{ background: '#EF4444' }}>Clear History</button>
        </div>
      </Modal>
    </>
  )
}
