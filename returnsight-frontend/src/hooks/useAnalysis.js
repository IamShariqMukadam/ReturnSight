import { useState, useCallback, useRef } from 'react'
import client from '../api/client'
import { useAppStore } from '../store/appStore'

export function useAnalysis() {
  const [stage, setStage] = useState('idle')
  const [error, setError] = useState(null)
  const [retryCountdown, setRetryCountdown] = useState(0)  // Fix 7
  const setResult = useAppStore(s => s.setResult)
  const countdownRef = useRef(null)

  const analyze = useCallback(async (payload) => {
    setError(null)
    setRetryCountdown(0)
    if (countdownRef.current) clearInterval(countdownRef.current)
    setStage('validating')
    await new Promise(r => setTimeout(r, 200))

    try {
      setStage('predicting')
      const { data } = await client.post('/predict', payload)
      setResult(data)
      setStage('done')
      setTimeout(() => setStage('idle'), 1500)
      return data
    } catch (err) {
      let msg
      if (err.code === 'ECONNABORTED') {
        msg = 'Analysis taking too long. Model may be cold-starting. Retry in 10 seconds.'
        // Fix 7: start countdown
        setRetryCountdown(10)
        countdownRef.current = setInterval(() => {
          setRetryCountdown(c => {
            if (c <= 1) { clearInterval(countdownRef.current); return 0 }
            return c - 1
          })
        }, 1000)
      } else {
        msg = err.response?.data?.detail || 'Prediction failed. Check API connection.'
      }
      setError(msg)
      setStage('error')
      return null
    }
  }, [setResult])

  const reset = useCallback(() => {
    setStage('idle')
    setError(null)
    setRetryCountdown(0)
    if (countdownRef.current) clearInterval(countdownRef.current)
    setResult(null)
  }, [setResult])

  return {
    stage, error, retryCountdown, analyze, reset,
    isLoading: stage === 'validating' || stage === 'predicting',
  }
}
