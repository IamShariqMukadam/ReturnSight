import html2canvas from 'html2canvas'
import toast from 'react-hot-toast'

const slug = (title) => title.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40)
const dateStr = () => new Date().toISOString().slice(0, 10).replace(/-/g, '')

/** @param {string} title */
export async function captureCard(title) {
  const el = document.getElementById('export-card')
  if (!el) return

  const tid = toast.loading('Generating image...')
  try {
    el.style.display = 'block'
    const canvas = await html2canvas(el, { scale: 2, useCORS: true, backgroundColor: '#13141C' })
    el.style.display = 'none'

    const filename = `returnsight_${slug(title)}_${dateStr()}.png`

    // Try clipboard first
    if (navigator.clipboard?.write) {
      try {
        const blob = await new Promise(r => canvas.toBlob(r, 'image/png'))
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
        toast.success('Image copied to clipboard!', { id: tid })
        return
      } catch {}
    }

    // Fallback: download
    const a = document.createElement('a')
    a.href = canvas.toDataURL('image/png')
    a.download = filename
    a.click()
    toast.success('Download started!', { id: tid })
  } catch (err) {
    toast.error('Failed to generate image.', { id: tid })
    console.error(err)
  }
}
