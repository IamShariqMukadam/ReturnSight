import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import ReviewSection from './ReviewSection'
import Button from '../ui/Button'
import { useToast } from '../../hooks/useToast'

const SESSION_KEY = 'returnsight_form'
const EXAMPLE = {
  title: "Women's Floral Summer Dress - V-Neck Wrap Midi",
  description: 'Elegant wrap midi dress with floral print. Perfect for casual and semi-formal occasions. Made from 100% polyester with stretch comfort waistband. Available in sizes XS-3XL.',
  price: '29.99', image_url: '', category: 'Clothing_Shoes_and_Jewelry',
  reviews: [
    { text: 'Terrible quality, fabric is cheap and see-through. Returned immediately.', rating: 1 },
    { text: 'Wrong size, runs very small. Disappointed with the fit.', rating: 2 },
    { text: 'Looks nothing like the photos. Complete scam, demanded refund.', rating: 1 },
    { text: 'Average dress, nothing special but okay for the price.', rating: 3 },
  ],
}

const CATEGORIES = [
  ['Clothing & Jewelry', 'Clothing_Shoes_and_Jewelry'],
  ['Electronics', 'Electronics'],
  ['Home & Kitchen', 'Home_and_Kitchen'],
  ['Sports', 'Sports_and_Outdoors'],
  ['Beauty', 'Beauty_and_Personal_Care'],
  ['Toys', 'Toys_and_Games'],
]

const STAGE_LABELS = {
  idle:       { text: 'Analyze Return Risk →' },
  validating: { text: 'Checking inputs...' },
  predicting: { text: 'Running AI pipeline' },
  done:       { text: '✓ Analysis complete' },
  error:      { text: 'Retry Analysis' },
}

// Fix 5: Premium input focus state hook
function useInputFocus() {
  const [focused, setFocused] = useState(null)
  const inputProps = (name) => ({
    onFocus: () => setFocused(name),
    onBlur: () => setFocused(null),
  })
  const style = (name) => ({
    background: focused === name ? 'rgba(255,92,26,0.04)' : 'rgba(255,255,255,0.03)',
    border: `1px solid ${focused === name ? 'rgba(255,92,26,0.45)' : 'rgba(255,255,255,0.08)'}`,
    color: 'var(--text)',
    outline: 'none',
    transition: 'all 0.2s ease',
    boxShadow: focused === name ? '0 0 0 3px rgba(255,92,26,0.1), 0 4px 20px rgba(255,92,26,0.06)' : 'none',
  })
  return { inputProps, style, focused }
}

// Section divider component
function SectionDivider({ label }) {
  return (
    <div className="flex items-center gap-3 my-1">
      <div className="h-px flex-1" style={{ background: 'linear-gradient(90deg, rgba(255,92,26,0.3), transparent)' }} />
      <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'rgba(255,92,26,0.6)' }}>{label}</span>
      <div className="h-px flex-1" style={{ background: 'linear-gradient(90deg, transparent, rgba(255,92,26,0.1))' }} />
    </div>
  )
}

export default function ProductForm({ onSubmit, stage, retryCountdown = 0, onLoadExample }) {
  const toast = useToast()
  const { inputProps, style } = useInputFocus()

  const loadSession = () => { try { return JSON.parse(sessionStorage.getItem(SESSION_KEY) || 'null') } catch { return null } }
  const defaults = loadSession() || { title: '', description: '', price: '', image_url: '', category: 'Clothing_Shoes_and_Jewelry', reviews: [{ text: '', rating: 3 }] }
  const [form, setForm] = useState(defaults)

  useEffect(() => { sessionStorage.setItem(SESSION_KEY, JSON.stringify(form)) }, [form])
  const set = (field, value) => setForm(f => ({ ...f, [field]: value }))

  const handleSubmit = (e) => {
    e?.preventDefault?.()
    if (!form.title.trim())       { toast.error('Product title is required'); return }
    if (!form.description.trim()) { toast.error('Product description is required'); return }
    if (!form.price || isNaN(form.price)) { toast.error('Valid price is required'); return }
    if (!form.reviews.some(r => r.text.trim())) { toast.error('At least one review is required'); return }
    onSubmit({
      title: form.title.trim(), description: form.description.trim(),
      price: parseFloat(form.price), image_url: form.image_url.trim() || null,
      category: form.category,
      reviews: form.reviews.filter(r => r.text.trim()).map(r => ({ text: r.text, rating: Number(r.rating) })),
    })
  }

  const loadExample = () => { setForm(EXAMPLE); onLoadExample?.() }
  const reset = () => { setForm({ title:'',description:'',price:'',image_url:'',category:'Clothing_Shoes_and_Jewelry',reviews:[{text:'',rating:3}] }); sessionStorage.removeItem(SESSION_KEY) }

  useEffect(() => {
    window.__rs_submit = handleSubmit; window.__rs_reset = reset; window.__rs_example = loadExample
    return () => { delete window.__rs_submit; delete window.__rs_reset; delete window.__rs_example }
  })

  const isLoading = stage === 'validating' || stage === 'predicting'
  const stageInfo = STAGE_LABELS[stage] || STAGE_LABELS.idle
  const descLen = form.description.length

  const labelStyle = { color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }
  const inputClass = "w-full rounded-xl px-4 py-3 text-sm"

  return (
    <form onSubmit={handleSubmit} className="space-y-5" noValidate>
      {/* Form header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-md flex items-center justify-center"
            style={{ background: 'rgba(255,92,26,0.12)', border: '1px solid rgba(255,92,26,0.2)' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#FF5C1A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="9" y="2" width="6" height="4" rx="1"/><path d="M8 4H6a2 2 0 00-2 2v14a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-2"/><path d="M9 12h6M9 16h4"/>
            </svg>
          </div>
          <p className="font-display font-semibold text-sm" style={{ color: 'var(--text)' }}>Product Listing</p>
        </div>
        <div className="flex gap-2">
          <motion.button type="button" onClick={loadExample}
            whileHover={{ scale: 1.05, boxShadow: '0 0 14px rgba(255,92,26,0.3)' }}
            whileTap={{ scale: 0.95 }}
            className="px-4 py-1.5 rounded-lg text-xs font-semibold"
            style={{ color: '#fff', border: '1px solid #FF5C1A', background: '#FF5C1A', transition: 'box-shadow 0.2s' }}>
            Example
          </motion.button>
          <motion.button type="button" onClick={reset}
            whileHover={{ scale: 1.05, boxShadow: '0 0 14px rgba(255,92,26,0.2)' }}
            whileTap={{ scale: 0.95 }}
            className="px-4 py-1.5 rounded-lg text-xs font-semibold"
            style={{ color: '#fff', border: '1px solid #FF5C1A', background: '#FF5C1A', transition: 'box-shadow 0.2s' }}>
            Reset
          </motion.button>
        </div>
      </div>

      <SectionDivider label="Listing Details" />

      {/* Title */}
      <div>
        <label className="block mb-1.5" style={labelStyle}>Product Title <span style={{ color: '#EF4444' }}>*</span></label>
        <input value={form.title} onChange={e => set('title', e.target.value)}
          {...inputProps('title')} style={style('title')}
          placeholder="Exact listing title from Amazon/Shopify"
          className={inputClass} aria-required="true" />
        <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.25)' }}>Use the exact listing title — punctuation matters</p>
      </div>

      {/* Description */}
      <div>
        <div className="flex justify-between items-center mb-1.5">
          <label style={labelStyle}>Description <span style={{ color: '#EF4444' }}>*</span></label>
          <span className="text-xs font-mono" style={{ color: descLen > 500 ? '#F59E0B' : 'rgba(255,255,255,0.25)' }}>{descLen}/600</span>
        </div>
        <textarea value={form.description} onChange={e => set('description', e.target.value)}
          {...inputProps('desc')} style={style('desc')} rows={4}
          placeholder="Paste the seller's exact copy. More text = better prediction."
          className={`${inputClass} resize-none`} aria-required="true" />
      </div>

      {/* Price + Category */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block mb-1.5" style={labelStyle}>Price (USD) <span style={{ color: '#EF4444' }}>*</span></label>
          <input type="number" step="0.01" min="0" value={form.price}
            onChange={e => set('price', e.target.value)}
            onBlur={() => { const v = parseFloat(form.price); if (!isNaN(v)) set('price', v.toFixed(2)) }}
            {...inputProps('price')} style={style('price')}
            placeholder="29.99" className={inputClass} aria-required="true" />
        </div>
        <div>
          <label className="block mb-1.5" style={labelStyle}>Category</label>
          <select value={form.category} onChange={e => set('category', e.target.value)}
            {...inputProps('cat')}
            style={{ ...style('cat'), appearance: 'none', WebkitAppearance: 'none' }}
            className={inputClass}>
            {CATEGORIES.map(([label, val]) => <option key={val} value={val} style={{ background: '#13141C' }}>{label}</option>)}
          </select>
        </div>
      </div>

      {/* Image URL */}
      <div>
        <label className="block mb-1.5" style={labelStyle}>
          Image URL <span style={{ color: 'rgba(255,255,255,0.2)', fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(optional)</span>
        </label>
        <input value={form.image_url} onChange={e => set('image_url', e.target.value)}
          {...inputProps('img')} style={style('img')}
          placeholder="https://... direct link to product image (JPG/PNG)"
          className={inputClass} />
      </div>

      {/* Autofill placeholder */}
      <div>
        <label className="block mb-1.5" style={{ ...labelStyle, opacity: 0.4 }}>
          Autofill from URL <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>— coming soon</span>
        </label>
        <input type="url" disabled placeholder="Paste an Amazon product URL to auto-fill..."
          onClick={() => toast.info('Amazon auto-fill coming in v1.1!')}
          className={`${inputClass} cursor-not-allowed opacity-30`}
          style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', color: 'var(--muted)' }} />
      </div>

      <SectionDivider label="Customer Reviews" />

      <ReviewSection reviews={form.reviews} setReviews={v => set('reviews', v)} />

      {/* Submit */}
      <div className="pt-2">
        {/* Animated gradient border wrapper — visible only when loading */}
        <div className="relative rounded-xl p-[2px]"
          style={{
            background: isLoading
              ? 'conic-gradient(from var(--angle, 0deg), #FF5C1A, #7C3AED, #EC4899, #FF5C1A)'
              : 'transparent',
            animation: isLoading ? 'spin-border 2s linear infinite' : 'none',
          }}>
          <style>{`
            @property --angle { syntax: '<angle>'; initial-value: 0deg; inherits: false; }
            @keyframes spin-border { to { --angle: 360deg; } }
          `}</style>
          <motion.button type="submit" disabled={isLoading}
            whileHover={!isLoading ? { scale: 1.01, boxShadow: '0 0 30px rgba(255,92,26,0.4)' } : {}}
            whileTap={!isLoading ? { scale: 0.98 } : {}}
            className="w-full py-3.5 rounded-[10px] font-semibold text-sm text-white relative overflow-hidden"
            style={{
              background: isLoading
                ? '#0F1017'
                : 'linear-gradient(135deg, #FF5C1A 0%, #e0450f 100%)',
              cursor: isLoading ? 'not-allowed' : 'pointer',
            }}>
            {/* Shimmer on idle — fixed unicode minus bug */}
            {!isLoading && (
              <motion.div className="absolute inset-0 pointer-events-none"
                style={{ background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.12) 50%, transparent 100%)' }}
                animate={{ x: ['-100%', '200%'] }}
                transition={{ duration: 2.5, repeat: Infinity, repeatDelay: 1.5 }} />
            )}
            <AnimatePresence mode="wait">
              <motion.span key={stage}
                initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.2 }}
                className="flex items-center justify-center gap-2">
                {isLoading && (
                  <span className="w-4 h-4 border-2 rounded-full animate-spin"
                    style={{ borderColor: 'rgba(255,92,26,0.3)', borderTopColor: '#FF5C1A' }} />
                )}
                <span style={{ color: isLoading ? '#FF5C1A' : '#fff' }}>
                  {stageInfo.text}
                </span>
                {/* Animated pulsing dots for predicting state */}
                {stage === 'predicting' && (
                  <span className="flex gap-0.5">
                    {[0, 1, 2].map(i => (
                      <motion.span key={i}
                        className="w-1 h-1 rounded-full"
                        style={{ background: '#FF5C1A' }}
                        animate={{ opacity: [0.3, 1, 0.3], scale: [0.8, 1.2, 0.8] }}
                        transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }} />
                    ))}
                  </span>
                )}
              </motion.span>
            </AnimatePresence>
          </motion.button>
        </div>

        {retryCountdown > 0 && (
          <p className="text-xs text-center mt-2" style={{ color: 'var(--muted)' }}>Retry available in {retryCountdown}s...</p>
        )}
        {retryCountdown === 0 && stage === 'error' && (
          <motion.button onClick={handleSubmit}
            whileHover={{ scale: 1.02, borderColor: 'rgba(255,92,26,0.4)' }}
            whileTap={{ scale: 0.98 }}
            className="w-full mt-2 py-2 rounded-lg text-sm border transition-colors"
            style={{ borderColor: 'var(--border)', color: 'var(--text)', background: 'transparent' }}>
            Retry Analysis
          </motion.button>
        )}
      </div>
    </form>
  )
}
