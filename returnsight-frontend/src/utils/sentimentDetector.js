const NEG = new Set(['terrible','broken','fake','wrong','awful','horrible','scam','trash',
  'return','refund','disappointed','poor','cheap','ugly','useless','waste',
  'defective','damaged','smell','stain'])
const POS = new Set(['excellent','amazing','perfect','love','fantastic','outstanding',
  'beautiful','incredible','superb','flawless','genuine','authentic',
  'recommend','impressed','quality'])

/** @param {string} text @returns {1|2|3|4|5} */
export function detectSentiment(text) {
  const words = text.toLowerCase().replace(/[^a-z\s]/g, '').split(/\s+/)
  let score = 0
  for (const w of words) {
    if (POS.has(w)) score++
    if (NEG.has(w)) score--
  }
  if (score > 1)  return 5
  if (score === 1) return 4
  if (score === 0) return 3
  if (score === -1) return 2
  return 1
}

/**
 * @param {string} raw — reviews separated by --- or blank lines
 * @returns {{text:string, rating:number}[]}
 */
export function parseReviews(raw) {
  const blocks = raw.split(/---|\n\s*\n/).map(s => s.trim()).filter(Boolean)
  return blocks.map(text => ({ text, rating: detectSentiment(text) }))
}

/** @param {{text,rating}[]} reviews @returns {{total:number,negative:number,positive:number,neutral:number}} */
export function summarizeDetected(reviews) {
  let positive = 0, negative = 0, neutral = 0
  for (const r of reviews) {
    if (r.rating >= 4) positive++
    else if (r.rating <= 2) negative++
    else neutral++
  }
  return { total: reviews.length, positive, negative, neutral }
}
