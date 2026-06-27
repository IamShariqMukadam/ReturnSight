/** @param {object} result @param {string} productTitle @returns {string} URL */
export function encodeResult(result, productTitle) {
  const payload = { v: 1, title: productTitle, result, ts: new Date().toISOString() }
  const encoded = btoa(encodeURIComponent(JSON.stringify(payload)))
  window.location.hash = `r=${encoded}`
  return window.location.href
}

/** @returns {{title:string,result:object,ts:string}|null} */
export function decodeResult() {
  const hash = window.location.hash
  if (!hash.startsWith('#r=')) return null
  try {
    const raw = decodeURIComponent(atob(hash.slice(3)))
    const parsed = JSON.parse(raw)
    if (parsed.v !== 1) return null
    return parsed
  } catch {
    return null
  }
}

/** @param {{left,right}} both */
export function encodeCompare(left, right) {
  const payload = { v: 1, left, right, ts: new Date().toISOString() }
  const encoded = btoa(encodeURIComponent(JSON.stringify(payload)))
  window.location.hash = `c=${encoded}`
  return window.location.href
}

export function decodeCompare() {
  const hash = window.location.hash
  if (!hash.startsWith('#c=')) return null
  try {
    const raw = decodeURIComponent(atob(hash.slice(3)))
    return JSON.parse(raw)
  } catch { return null }
}

export function clearHash() {
  history.replaceState(null, '', window.location.pathname + window.location.search)
}
