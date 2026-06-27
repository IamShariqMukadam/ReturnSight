import { useEffect } from 'react'

const isInput = (el) => ['INPUT','TEXTAREA','SELECT'].includes(el.tagName)

/**
 * @param {Object} handlers — map of shortcut keys to callbacks
 * Keys format: 'ctrl+enter', 'ctrl+shift+e', 'escape', etc.
 */
export function useKeyboard(handlers) {
  useEffect(() => {
    const onKey = (e) => {
      const tag = e.target.tagName
      const inInput = isInput(e.target) || e.target.isContentEditable

      const parts = []
      if (e.ctrlKey || e.metaKey) parts.push('ctrl')
      if (e.shiftKey) parts.push('shift')
      if (e.altKey) parts.push('alt')
      parts.push(e.key.toLowerCase())
      const combo = parts.join('+')

      const handler = handlers[combo]
      if (!handler) return

      // Allow ctrl+enter inside inputs
      if (inInput && !['ctrl+enter','escape'].includes(combo)) return

      // Block browser R refresh
      if (combo === 'ctrl+r') e.preventDefault()

      handler(e)
    }

    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [handlers])
}
