import { useState } from 'react'
import ProductForm from '../form/ProductForm'
import ResultPanel from '../results/ResultPanel'
import SignalBreakdown from '../results/SignalBreakdown'
import { Badge } from '../ui/Badge'
import { useAnalysis } from '../../hooks/useAnalysis'
import client from '../../api/client'
import { encodeCompare } from '../../utils/shareUrl'
import { useToast } from '../../hooks/useToast'

export default function CompareView() {
  const toast = useToast()
  const [leftResult, setLeftResult] = useState(null)
  const [rightResult, setRightResult] = useState(null)
  const [leftReq, setLeftReq] = useState(null)
  const [rightReq, setRightReq] = useState(null)
  const [leftStage, setLeftStage] = useState('idle')
  const [rightStage, setRightStage] = useState('idle')

  const runSide = async (req, side) => {
    const setStage = side === 'left' ? setLeftStage : setRightStage
    const setResult = side === 'left' ? setLeftResult : setRightResult
    const setReq = side === 'left' ? setLeftReq : setRightReq
    setStage('predicting')
    setReq(req)
    try {
      const { data } = await client.post('/predict', req)
      setResult(data)
    } catch (err) {
      toast.error(`${side} analysis failed`)
    } finally { setStage('idle') }
  }

  const shareCompare = () => {
    if (!leftResult || !rightResult) { toast.warning('Run both analyses first'); return }
    const url = encodeCompare({ request: leftReq, result: leftResult }, { request: rightReq, result: rightResult })
    navigator.clipboard?.writeText(url)
    toast.success('Comparison link copied!')
  }

  const lpct = Math.round((leftResult?.return_probability || 0) * 100)
  const rpct = Math.round((rightResult?.return_probability || 0) * 100)

  return (
    <div>
      <div className="hidden md:grid grid-cols-2 gap-6">
        {/* Left */}
        <div>
          <p className="text-xs font-medium mb-3 px-1" style={{ color: 'var(--muted)' }}>PRODUCT A</p>
          <div className="rounded-2xl p-5 relative overflow-hidden" style={{ background: 'linear-gradient(145deg, rgba(19,20,30,0.98), rgba(12,13,22,0.99))', border: '1px solid rgba(255,92,26,0.18)', boxShadow: '0 24px 48px rgba(0,0,0,0.4)' }}>
            <ProductForm onSubmit={req => runSide(req, 'left')} stage={leftStage} />
          </div>
          {leftResult && <ResultPanel result={leftResult} request={leftReq} />}
        </div>
        {/* Right */}
        <div>
          <p className="text-xs font-medium mb-3 px-1" style={{ color: 'var(--muted)' }}>PRODUCT B</p>
          <div className="rounded-2xl p-5 relative overflow-hidden" style={{ background: 'linear-gradient(145deg, rgba(19,20,30,0.98), rgba(12,13,22,0.99))', border: '1px solid rgba(255,92,26,0.18)', boxShadow: '0 24px 48px rgba(0,0,0,0.4)' }}>
            <ProductForm onSubmit={req => runSide(req, 'right')} stage={rightStage} />
          </div>
          {rightResult && <ResultPanel result={rightResult} request={rightReq} />}
        </div>
      </div>
      <p className="md:hidden text-sm text-center mt-8" style={{ color: 'var(--muted)' }}>
        Compare mode is available on desktop only.
      </p>

      {/* Comparison Summary */}
      {leftResult && rightResult && (
        <div className="mt-6 rounded-xl border p-6" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display font-semibold text-sm">Comparison Summary</h3>
            <button onClick={shareCompare} className="text-xs px-3 py-1.5 rounded-lg border hover:bg-white/5 transition-colors"
              style={{ borderColor: 'var(--border)', color: 'var(--muted)' }}>Share Comparison</button>
          </div>
          <div className="grid grid-cols-2 gap-4 mb-4">
            {[['Product A', lpct, leftResult.risk_level], ['Product B', rpct, rightResult.risk_level]].map(([name, pct, level], i) => (
              <div key={i} className="text-center p-4 rounded-xl" style={{ background: 'rgba(255,255,255,0.03)' }}>
                <p className="text-xs mb-2" style={{ color: 'var(--muted)' }}>{name}</p>
                <p className="font-bold font-mono text-2xl" style={{ color: pct >= 65 ? '#EF4444' : pct >= 35 ? '#F59E0B' : '#22C55E' }}>{pct}%</p>
                <div className="mt-2 flex justify-center">
                  <Badge variant={level?.toLowerCase()}>{level}</Badge>
                </div>
                {lpct !== rpct && ((i === 0 && lpct < rpct) || (i === 1 && rpct < lpct)) && (
                  <p className="text-xs mt-2" style={{ color: '#22C55E' }}>✓ Lower Risk</p>
                )}
              </div>
            ))}
          </div>
          <p className="text-sm text-center" style={{ color: 'var(--muted)' }}>
            {Math.abs(lpct - rpct) < 5 ? 'Similar risk profile.' :
              lpct < rpct ? `Product A has ${rpct - lpct}% lower return risk.` : `Product B has ${lpct - rpct}% lower return risk.`}
          </p>
        </div>
      )}
    </div>
  )
}
