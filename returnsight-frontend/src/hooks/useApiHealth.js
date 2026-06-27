import { useEffect, useRef } from 'react'
import client from '../api/client'
import { useAppStore } from '../store/appStore'

export function useApiHealth() {
  const setApiStatus = useAppStore(s => s.setApiStatus)
  const offlineSince = useRef(null)

  useEffect(() => {
    const check = async () => {
      try {
        const { data } = await client.get('/health')
        const status = data.models_loaded ? 'online' : 'degraded'
        setApiStatus(status)
        offlineSince.current = null
      } catch {
        if (!offlineSince.current) offlineSince.current = Date.now()
        setApiStatus('offline')
      }
    }

    check()
    const id = setInterval(check, 30_000)
    return () => clearInterval(id)
  }, [setApiStatus])
}
