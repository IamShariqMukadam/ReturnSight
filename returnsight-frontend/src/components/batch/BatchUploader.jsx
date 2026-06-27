import { useState, useRef } from 'react'
import Papa from 'papaparse'
import Button from '../ui/Button'
import client from '../../api/client'
import { exportResultsCsv } from '../../utils/csvParser'
import { useToast } from '../../hooks/useToast'

const CSV_TEMPLATE = `title,description,price,category
"Women's Summer Dress","Floral wrap dress, polyester blend",29.99,Clothing_Shoes_and_Jewelry
"Men's Running Shoes","Lightweight mesh sneakers with foam sole",79.99,Sports_and_Outdoors`

export function BatchUploader({ onResults }) {
  const toast = useToast()
  const [rows, setRows] = useState([])
  const [errors, setErrors] = useState([])
  const [progress, setProgress] = useState(null)
  const fileRef = useRef()

  const parse = (text) => {
    const { data, errors: errs } = Papa.parse(text.trim(), { header: true, skipEmptyLines: true, dynamicTyping: true })
    const errsOut = [...errs.map(e => e.message)]
    if (data.length > 10) errsOut.push('Max 10 rows allowed.')
    setErrors(errsOut)
    setRows(data.slice(0, 10))
  }

  const onFile = (e) => {
    const f = e.target.files[0]
    if (!f) return
    const reader = new FileReader()
    reader.onload = ev => parse(ev.target.result)
    reader.readAsText(f)
  }

  const run = async () => {
    if (!rows.length) return
    const results = []
    setProgress({ current: 0, total: rows.length })
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]
      setProgress({ current: i + 1, total: rows.length })
      toast.info(`Analyzing ${i + 1}/${rows.length}...`)
      try {
        const { data } = await client.post('/predict', {
          title: String(row.title || ''), description: String(row.description || ''),
          price: parseFloat(row.price || 0), category: row.category || 'Clothing_Shoes_and_Jewelry',
          reviews: [{ text: 'batch analysis — no reviews provided', rating: 3 }],
        })
        results.push({ request: row, result: data })
      } catch (err) {
        results.push({ request: row, result: null, error: err.message })
      }
      if (i < rows.length - 1) await new Promise(r => setTimeout(r, 500))
    }
    setProgress(null)
    onResults(results)
    toast.success(`Batch complete: ${results.length} products analyzed`)
  }

  return (
    <div className="space-y-6">
      {/* CSV format preview */}
      <div className="rounded-xl p-5 border" style={{ borderColor: 'var(--border)', background: 'rgba(255,255,255,0.02)' }}>
        <p className="text-xs font-semibold mb-3 uppercase tracking-wider" style={{ color: 'var(--muted)' }}>CSV FORMAT</p>
        <pre className="text-xs font-mono overflow-x-auto leading-relaxed" style={{ color: '#22C55E' }}>{CSV_TEMPLATE}</pre>
      </div>

      {/* Fix 5: centered buttons with effects */}
      <div className="flex items-center justify-center gap-4">
        <input type="file" accept=".csv" ref={fileRef} onChange={onFile} className="hidden" />
        <button
          onClick={() => fileRef.current?.click()}
          className="group relative px-6 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 overflow-hidden"
          style={{ background: 'rgba(255,92,26,0.1)', border: '1px solid rgba(255,92,26,0.3)', color: '#FF5C1A' }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,92,26,0.2)'; e.currentTarget.style.boxShadow = '0 0 20px rgba(255,92,26,0.25)' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,92,26,0.1)'; e.currentTarget.style.boxShadow = 'none' }}>
          <span className="flex items-center gap-2">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17,8 12,3 7,8"/><line x1="12" y1="3" x2="12" y2="15"/>
            </svg>
            Upload CSV
          </span>
        </button>

        <span className="text-xs" style={{ color: 'var(--muted)' }}>or</span>

        <button
          onClick={() => parse(CSV_TEMPLATE)}
          className="px-6 py-2.5 rounded-lg text-sm font-medium transition-all duration-200"
          style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)', color: 'var(--text)' }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.borderColor = 'var(--border)' }}>
          Load Template
        </button>
      </div>

      {errors.map((e, i) => <p key={i} className="text-xs text-center" style={{ color: '#EF4444' }}>⚠ {e}</p>)}

      {rows.length > 0 && (
        <div className="text-center space-y-4">
          <p className="text-sm" style={{ color: 'var(--muted)' }}>{rows.length} products loaded</p>
          {progress && (
            <div className="max-w-sm mx-auto">
              <div className="flex justify-between text-xs mb-1" style={{ color: 'var(--muted)' }}>
                <span>Analyzing {progress.current}/{progress.total}...</span>
                <span>{Math.round((progress.current/progress.total)*100)}%</span>
              </div>
              <div className="h-1.5 rounded-full" style={{ background: 'rgba(255,255,255,0.07)' }}>
                <div className="h-full rounded-full transition-all" style={{ width: `${(progress.current/progress.total)*100}%`, background: 'var(--orange)' }} />
              </div>
            </div>
          )}
          <div className="flex justify-center">
            <Button onClick={run} loading={!!progress} disabled={!!errors.length}>Run Batch Analysis</Button>
          </div>
        </div>
      )}
    </div>
  )
}
