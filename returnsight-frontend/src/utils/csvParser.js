import Papa from 'papaparse'

/** @param {string} csvText @returns {{data:object[],errors:string[]}} */
export function parseProductCsv(csvText) {
  const { data, errors } = Papa.parse(csvText.trim(), {
    header: true,
    skipEmptyLines: true,
    dynamicTyping: true,
  })
  const required = ['title', 'description', 'price']
  const errs = []
  if (errors.length) errs.push(...errors.map(e => e.message))
  if (data.length > 10) errs.push('Maximum 10 rows allowed in batch mode.')
  for (const row of data) {
    for (const f of required) {
      if (!row[f]) errs.push(`Missing field "${f}" in row: ${row.title || '(unknown)'}`)
    }
  }
  return { data: data.slice(0, 10), errors: errs }
}

/** @param {object[]} results @returns {string} CSV string */
export function exportResultsCsv(results) {
  return Papa.unparse(results.map(r => ({
    title: r.request?.title || '',
    price: r.request?.price || '',
    risk_level: r.result?.risk_level || '',
    return_probability: r.result?.return_probability || '',
    top_reason: r.result?.top_reason || '',
    image_text_fusion: r.result?.signal_breakdown?.image_text_fusion || '',
    avg_rating: r.result?.signal_breakdown?.avg_rating || '',
    one_star_pct: r.result?.signal_breakdown?.one_star_pct || '',
    price_anomaly: r.result?.signal_breakdown?.price_anomaly || '',
    review_mismatch: r.result?.signal_breakdown?.review_mismatch || '',
  })))
}

/** @param {object[]} history @returns {string} CSV string */
export function exportHistoryCsv(history) {
  return Papa.unparse(history.map(e => ({
    id: e.id,
    timestamp: e.timestamp,
    title: e.title,
    price: e.price,
    category: e.category,
    risk_level: e.result?.risk_level || '',
    return_probability: e.result?.return_probability || '',
    top_reason: e.result?.top_reason || '',
  })))
}
