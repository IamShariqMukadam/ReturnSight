import SmartReviewParser from './SmartReviewParser'

const CATEGORIES = [
  'Clothing_Shoes_and_Jewelry', 'Electronics', 'Home_and_Kitchen',
  'Sports_and_Outdoors', 'Beauty_and_Personal_Care', 'Toys_and_Games',
]

export default function ReviewSection({ reviews, setReviews }) {
  const addReview = () => setReviews([...reviews, { text: '', rating: 3 }])
  const removeReview = (i) => setReviews(reviews.filter((_, idx) => idx !== i))
  const updateReview = (i, field, value) => {
    const updated = [...reviews]
    updated[i] = { ...updated[i], [field]: value }
    setReviews(updated)
  }

  return (
    <div>
      <SmartReviewParser onParsed={(parsed) => setReviews([...reviews, ...parsed])} />
      <div className="space-y-3">
        {reviews.map((r, i) => (
          <div key={i} className="rounded-xl p-4 border" style={{ background: 'rgba(255,255,255,0.02)', borderColor: 'var(--border)' }}>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-medium" style={{ color: 'var(--muted)' }}>Review {i + 1}</p>
              <button onClick={() => removeReview(i)} className="text-xs hover:text-red-400 transition-colors" style={{ color: 'var(--muted)' }}>Remove</button>
            </div>
            <textarea value={r.text} onChange={e => updateReview(i, 'text', e.target.value)}
              placeholder="Review text..." rows={2}
              className="w-full rounded-lg p-3 text-sm resize-none outline-none mb-2"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)', color: 'var(--text)' }} />
            <div className="flex items-center gap-2">
              <label className="text-xs" style={{ color: 'var(--muted)' }}>Rating:</label>
              <div className="flex gap-1">
                {[1,2,3,4,5].map(n => (
                  <button key={n} onClick={() => updateReview(i, 'rating', n)}
                    className="w-7 h-7 rounded-md text-xs font-medium transition-all"
                    style={{ background: r.rating === n ? 'rgba(255,92,26,0.2)' : 'rgba(255,255,255,0.04)',
                      color: r.rating === n ? '#FF5C1A' : 'var(--muted)',
                      border: `1px solid ${r.rating === n ? 'rgba(255,92,26,0.4)' : 'var(--border)'}` }}>
                    {n}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
      <button onClick={addReview} className="mt-3 text-sm transition-colors hover:opacity-80" style={{ color: '#FF5C1A' }}>
        + Add Review
      </button>
    </div>
  )
}
