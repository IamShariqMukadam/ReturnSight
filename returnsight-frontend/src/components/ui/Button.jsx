import { useRef } from 'react'
import clsx from 'clsx'

export default function Button({ children, onClick, variant = 'primary', loading, disabled, className, ...props }) {
  const btnRef = useRef(null)

  const handleClick = (e) => {
    if (disabled || loading) return
    // Ripple
    const btn = btnRef.current
    const rect = btn.getBoundingClientRect()
    const ripple = document.createElement('span')
    const size = Math.max(rect.width, rect.height)
    ripple.className = 'ripple'
    ripple.style.cssText = `width:${size}px;height:${size}px;left:${e.clientX - rect.left - size/2}px;top:${e.clientY - rect.top - size/2}px`
    btn.appendChild(ripple)
    ripple.addEventListener('animationend', () => ripple.remove())
    onClick?.(e)
  }

  return (
    <button ref={btnRef} onClick={handleClick} disabled={disabled || loading}
      className={clsx('ripple-btn px-5 py-2.5 rounded-lg font-medium text-sm transition-all duration-200 flex items-center gap-2',
        variant === 'primary' && !loading && 'text-white hover:opacity-90 active:scale-95',
        variant === 'secondary' && 'border text-text hover:bg-white/5',
        loading && 'gradient-border-loading text-white cursor-not-allowed',
        (disabled && !loading) && 'opacity-40 cursor-not-allowed',
        className)}
      style={variant === 'primary' && !loading ? { background: 'linear-gradient(135deg,#FF5C1A,#e0450f)' } :
        variant === 'secondary' ? { borderColor: 'var(--border)' } : {}}
      {...props}>
      {loading && <span className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />}
      {children}
    </button>
  )
}
