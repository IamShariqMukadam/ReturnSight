import { useState } from 'react'
import { Badge } from '../ui/Badge'
import Button from '../ui/Button'
import SignalBreakdown from '../results/SignalBreakdown'
import { exportResultsCsv } from '../../utils/csvParser'
import { encodeResult } from '../../utils/shareUrl'
import { useToast } from '../../hooks/useToast'

const RISK_ROW = { high: 'rgba(239,68,68,0.05)', medium: 'rgba(245,158,11,0.04)', low: 'rgba(34,197,94,0.03)' }

export default function BatchResultsTable({ results }) {
  const toast = useToast()
  const [sortDesc, setSortDesc] = useState(true)
  const [expanded, setExpanded] = useState(null)

  if (!results?.length) return null

  const sorted = [...results].sort((a, b) => {
    const pa = a.result?.return_probability ?? -1
    const pb = b.result?.return_probability ?? -1
    return sortDesc ? pb - pa : pa - pb
  })

  const exportAll = () => {
    const csv = exportResultsCsv(results)
    const blob = new Blob([csv], { type: 'text/csv' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `returnsight_batch_${Date.now()}.csv`
    a.click()
    toast.success('CSV exported!')
  }

  const shareRow = (row) => {
    const url = encodeResult(row.result, row.request?.title || 'Product')
    navigator.clipboard?.writeText(url)
    toast.success('Link copied!')
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>{results.length} Products Analyzed</p>
        <Button variant="secondary" onClick={exportAll} className="text-xs">Export All CSV</Button>
      </div>
      <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--border)' }}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid var(--border)' }}>
              <th className="px-4 py-3 text-left text-xs font-medium" style={{ color: 'var(--muted)' }}>#</th>
              <th className="px-4 py-3 text-left text-xs font-medium" style={{ color: 'var(--muted)' }}>Title</th>
              <th className="px-4 py-3 text-left text-xs font-medium" style={{ color: 'var(--muted)' }}>Price</th>
              <th className="px-4 py-3 text-left text-xs font-medium cursor-pointer select-none" style={{ color: 'var(--muted)' }}
                onClick={() => setSortDesc(!sortDesc)}>
                Risk % {sortDesc ? '↓' : '↑'}
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium" style={{ color: 'var(--muted)' }}>Level</th>
              <th className="px-4 py-3 text-left text-xs font-medium" style={{ color: 'var(--muted)' }}>Top Signal</th>
              <th className="px-4 py-3 text-xs font-medium" style={{ color: 'var(--muted)' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((row, i) => {
              const prob = row.result?.return_probability
              const level = row.result?.risk_level?.toLowerCase()
              return (
                <>
                  <tr key={i} onClick={() => setExpanded(expanded === i ? null : i)}
                    className="cursor-pointer transition-colors hover:bg-white/5"
                    style={{ borderBottom: '1px solid var(--border)', background: level ? RISK_ROW[level] : 'transparent' }}>
                    <td className="px-4 py-3 text-xs" style={{ color: 'var(--muted)' }}>{i + 1}</td>
                    <td className="px-4 py-3 max-w-[200px]">
                      <p className="text-xs truncate" style={{ color: 'var(--text)' }}>{row.request?.title}</p>
                    </td>
                    <td className="px-4 py-3 text-xs font-mono" style={{ color: 'var(--text)' }}>
                      ${parseFloat(row.request?.price || 0).toFixed(2)}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm font-bold font-mono" style={{ color: level === 'high' ? '#EF4444' : level === 'medium' ? '#F59E0B' : '#22C55E' }}>
                        {prob !== undefined ? `${Math.round(prob * 100)}%` : '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {level && <Badge variant={level}>{row.result?.risk_level}</Badge>}
                    </td>
                    <td className="px-4 py-3 max-w-[160px]">
                      <p className="text-xs truncate" style={{ color: 'var(--muted)' }}>{row.result?.top_reason}</p>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1 justify-end" onClick={e => e.stopPropagation()}>
                        <button onClick={() => shareRow(row)} className="px-2 py-1 rounded text-xs border hover:bg-white/5 transition-colors"
                          style={{ borderColor: 'var(--border)', color: 'var(--muted)' }}>Share</button>
                      </div>
                    </td>
                  </tr>
                  {expanded === i && (
                    <tr key={`exp-${i}`}>
                      <td colSpan={7} className="px-4 py-4" style={{ background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid var(--border)' }}>
                        <SignalBreakdown signals={row.result?.signal_breakdown} />
                      </td>
                    </tr>
                  )}
                </>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
