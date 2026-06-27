import { useState, useCallback } from 'react'

const KEY = 'returnsight_history'
const MAX = 20

/** @returns {object[]} history array */
const load = () => {
  try { return JSON.parse(localStorage.getItem(KEY) || '[]') }
  catch { return [] }
}

/** @param {object[]} items */
const save = (items) => localStorage.setItem(KEY, JSON.stringify(items))

export function useHistory() {
  const [history, setHistory] = useState(load)

  const refresh = useCallback(() => setHistory(load()), [])

  /** @param {object} request @param {object} result */
  const saveAnalysis = useCallback((request, result) => {
    const entry = {
      id: `rs_${Date.now()}`,
      timestamp: new Date().toISOString(),
      title: request.title,
      price: request.price,
      category: request.category,
      request,
      result,
    }
    const updated = [entry, ...load()].slice(0, MAX)
    save(updated)
    setHistory(updated)
    return entry.id
  }, [])

  const clearHistory = useCallback(() => {
    save([])
    setHistory([])
  }, [])

  /** @param {string} id @returns {{request,result}|null} */
  const loadAnalysis = useCallback((id) => {
    const found = load().find(e => e.id === id)
    return found ? { request: found.request, result: found.result } : null
  }, [])

  const deleteEntry = useCallback((id) => {
    const updated = load().filter(e => e.id !== id)
    save(updated)
    setHistory(updated)
  }, [])

  return { history, saveAnalysis, clearHistory, loadAnalysis, deleteEntry, refresh }
}
