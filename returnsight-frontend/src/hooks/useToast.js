import toast from 'react-hot-toast'

export function useToast() {
  return {
    success: (msg, opts) => toast.success(msg, opts),
    error: (msg, opts) => toast.error(msg, opts),
    info: (msg, opts) => toast(msg, { icon: '💡', ...opts }),
    warning: (msg, opts) => toast(msg, { icon: '⚠️', style: { borderLeft: '3px solid #F59E0B' }, ...opts }),
  }
}
