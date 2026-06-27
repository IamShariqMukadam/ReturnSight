import { useEffect, useState } from 'react'

export default function ScrollProgressBar() {
  const [width, setWidth] = useState(0)

  useEffect(() => {
    const update = () => {
      const el = document.documentElement
      const pct = (el.scrollTop / (el.scrollHeight - el.clientHeight)) * 100
      setWidth(isNaN(pct) ? 0 : pct)
    }
    window.addEventListener('scroll', update, { passive: true })
    return () => window.removeEventListener('scroll', update)
  }, [])

  return <div id="scroll-progress" style={{ width: `${width}%` }} />
}
