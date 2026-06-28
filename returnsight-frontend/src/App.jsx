import { useEffect, useRef, useState } from 'react'
import { Routes, Route, useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'

import Navbar from './components/layout/Navbar'
import Footer from './components/layout/Footer'
import ScrollProgressBar from './components/layout/ScrollProgressBar'
import Hero from './components/landing/Hero'
import { StatsStrip, HowItWorks, SignalsSection } from './components/landing/StatsStrip'
import ProductForm from './components/form/ProductForm'
import ResultPanel from './components/results/ResultPanel'
import HistoryDrawer from './components/history/HistoryDrawer'
import OnboardingModal from './components/onboarding/OnboardingModal'
import SettingsModal from './components/ui/SettingsModal'
import ShortcutPalette from './components/ui/ShortcutPalette'
import { BatchUploader } from './components/batch/BatchUploader'
import BatchResultsTable from './components/batch/BatchResultsTable'
import CompareView from './components/compare/CompareView'
import Dashboard from './pages/Dashboard'

import { useAppStore } from './store/appStore'
import { useAnalysis } from './hooks/useAnalysis'
import { useHistory } from './hooks/useHistory'
import { useKeyboard } from './hooks/useKeyboard'
import { useApiHealth } from './hooks/useApiHealth'
import { useIsMobile } from './hooks/useIsMobile'
import { decodeResult, decodeCompare, clearHash } from './utils/shareUrl'

function Workbench() {
  const { result, setResult, mode, setMode, setHistoryOpen, setPaletteOpen } = useAppStore()
  const { stage, error, retryCountdown, analyze } = useAnalysis()
  const { saveAnalysis } = useHistory()
  const [batchResults, setBatchResults] = useState([])
  const [currentRequest, setCurrentRequest] = useState(null)
  const [sharedData, setSharedData] = useState(null)
  const isMobile = useIsMobile()

  const [fabVisible, setFabVisible] = useState(false)
  useEffect(() => {
    const check = () => {
      try {
        const f = JSON.parse(sessionStorage.getItem('returnsight_form') || '{}')
        setFabVisible(!!(f.title?.trim() && f.description?.trim()))
      } catch {}
    }
    check()
    window.addEventListener('storage', check)
    const id = setInterval(check, 1000)
    return () => { window.removeEventListener('storage', check); clearInterval(id) }
  }, [])

  useEffect(() => {
    const single = decodeResult()
    if (single) { setSharedData(single); setResult(single.result); clearHash() }
    const compare = decodeCompare()
    if (compare) { setMode('compare'); clearHash() }
  }, [])

  const handleSubmit = async (payload) => {
    setCurrentRequest(payload)
    const res = await analyze(payload)
    if (res) saveAnalysis(payload, res)
  }

  useKeyboard({
    'ctrl+enter':   () => window.__rs_submit?.(),
    'ctrl+shift+e': () => window.__rs_example?.(),
    'ctrl+r':       () => window.__rs_reset?.(),
    'ctrl+h':       () => useAppStore.getState().setHistoryOpen(true),
    'ctrl+k':       () => setPaletteOpen(true),
    'ctrl+b':       () => setMode('batch'),
    'escape':       () => {
      useAppStore.getState().setHistoryOpen(false)
      setPaletteOpen(false)
      useAppStore.getState().setSettingsOpen(false)
    },
  })

  const handlePaletteAction = (action) => {
    const map = {
      submit: () => window.__rs_submit?.(),
      example: () => window.__rs_example?.(),
      reset: () => window.__rs_reset?.(),
      history: () => setHistoryOpen(true),
      palette: () => setPaletteOpen(true),
      batch: () => setMode('batch'),
      escape: () => {},
    }
    map[action]?.()
  }

  const workbenchRef = useRef(null)
  const scrollToWorkbench = () => workbenchRef.current?.scrollIntoView({ behavior: 'smooth' })

  return (
    <div>
      <Hero onAnalyze={scrollToWorkbench} />
      <StatsStrip />
      <HowItWorks />
      <SignalsSection />

      {/* ── WORKBENCH — full width ── */}
      <section ref={workbenchRef} className="py-14 md:py-20 w-full relative" style={{ background: 'var(--bg)' }}>

        {/* Grid texture + orange radial glow */}
        <div className="absolute inset-0 pointer-events-none" style={{
          backgroundImage: 'linear-gradient(rgba(255,92,26,0.04) 1px,transparent 1px),linear-gradient(90deg,rgba(255,92,26,0.04) 1px,transparent 1px)',
          backgroundSize: '48px 48px',
        }} />
        <div className="absolute inset-0 pointer-events-none" style={{
          background: 'radial-gradient(ellipse 60% 40% at 50% 0%,rgba(255,92,26,0.08) 0%,transparent 70%)',
        }} />

        <div className="relative w-full px-4 sm:px-8 lg:px-16">

          {/* Header */}
          <div className="mb-10 text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs mb-5 border"
              style={{ background: 'rgba(255,92,26,0.08)', borderColor: 'rgba(255,92,26,0.2)', color: '#FF5C1A' }}>
              <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: '#FF5C1A' }} />
              AI-Powered Risk Analysis
            </div>
            <h2 className="font-display font-bold mb-3"
              style={{
                fontSize: 'clamp(28px,4vw,48px)', color: 'transparent',
                background: 'linear-gradient(135deg,#fff 40%,#FF5C1A 100%)',
                WebkitBackgroundClip: 'text', backgroundClip: 'text',
              }}>
              Analyze a Product
            </h2>
            <p className="text-sm" style={{ color: 'var(--muted)' }}>
              Paste your listing. Get a return risk verdict in under 1 second.
            </p>
          </div>

          {/* Tabs — pill segmented control */}
          <div className="flex justify-center mb-10">
            <div className="relative flex gap-1 p-1 rounded-xl border"
              style={{ background: 'rgba(255,255,255,0.03)', borderColor: 'var(--border)' }}>
              {['single', 'batch', 'compare'].map(m => (
                <button key={m} onClick={() => setMode(m)}
                  className="relative px-6 py-2 rounded-lg text-sm capitalize font-medium transition-all duration-200"
                  style={{
                    color: mode === m ? '#fff' : 'var(--muted)',
                    background: mode === m ? 'var(--orange)' : 'transparent',
                    boxShadow: mode === m ? '0 0 20px rgba(255,92,26,0.35)' : 'none',
                    fontWeight: mode === m ? 600 : 400,
                  }}>
                  {m}
                </button>
              ))}
            </div>
          </div>

          <AnimatePresence mode="wait">
            {/* ── SINGLE MODE ── */}
            {mode === 'single' && (
              <motion.div key="single"
                initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }}
                className="grid lg:grid-cols-2 gap-6 items-start">

                {/* Form card — gradient border top */}
                <div className="relative rounded-2xl p-[1px]"
                  style={{ background: 'linear-gradient(180deg,rgba(255,92,26,0.35) 0%,rgba(255,255,255,0.07) 35%,rgba(255,255,255,0.04) 100%)' }}>
                  <div className="rounded-2xl p-8" style={{ background: 'var(--card)' }}>
                    <ProductForm
                      onSubmit={handleSubmit}
                      stage={stage}
                      retryCountdown={retryCountdown}
                      onLoadExample={() => window.__rs_example?.()}
                    />
                    {error && (
                      <p className="mt-4 text-sm p-3 rounded-lg"
                        style={{ background: 'rgba(239,68,68,0.08)', color: '#EF4444', border: '1px solid rgba(239,68,68,0.2)' }}>
                        {error}
                      </p>
                    )}
                  </div>
                </div>

                {/* Results — sticky, gradient border */}
                <div className="lg:sticky lg:top-20">
                  {sharedData && !result && (
                    <div className="mb-4 px-4 py-2 rounded-lg text-sm"
                      style={{ background: 'rgba(245,158,11,0.1)', color: '#F59E0B', border: '1px solid rgba(245,158,11,0.2)' }}>
                      Viewing shared result from {new Date(sharedData.ts).toLocaleDateString()}
                      <button onClick={() => setSharedData(null)} className="ml-2 underline">Run fresh</button>
                    </div>
                  )}
                  <div className="relative rounded-2xl p-[1px]"
                    style={{ background: 'linear-gradient(180deg,rgba(255,92,26,0.2) 0%,rgba(255,255,255,0.06) 40%,rgba(255,255,255,0.03) 100%)' }}>
                    <div className="rounded-2xl" style={{ background: 'var(--card)' }}>
                      <ResultPanel result={result} request={currentRequest} isShared={!!sharedData} isMobile={isMobile} />
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* ── BATCH MODE ── */}
            {mode === 'batch' && (
              <motion.div key="batch"
                initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }}
                className="relative rounded-2xl p-[1px]"
                style={{ background: 'linear-gradient(180deg,rgba(255,92,26,0.3) 0%,rgba(255,255,255,0.06) 40%)' }}>
                <div className="rounded-2xl p-8" style={{ background: 'var(--card)' }}>
                  <BatchUploader onResults={setBatchResults} />
                  {batchResults.length > 0 && <div className="mt-10"><BatchResultsTable results={batchResults} /></div>}
                </div>
              </motion.div>
            )}

            {/* ── COMPARE MODE ── */}
            {mode === 'compare' && (
              <motion.div key="compare"
                initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }}>
                <CompareView />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </section>

      {/* Mobile FAB */}
      <AnimatePresence>
        {fabVisible && isMobile && (
          <motion.button
            initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}
            className="fixed bottom-6 right-6 w-14 h-14 rounded-full text-white flex items-center justify-center text-xl z-40"
            style={{ background: 'var(--orange)', boxShadow: '0 0 24px rgba(255,92,26,0.45)' }}
            onClick={() => window.__rs_submit?.()}>
            →
          </motion.button>
        )}
      </AnimatePresence>

      <ShortcutPalette onAction={handlePaletteAction} />
      {/* NOTE: removed fixed bottom shortcut pill — ⌘K button is now in the Navbar */}
    </div>
  )
}

export default function App() {
  const { apiStatus } = useAppStore()
  useApiHealth()

  return (
    <>
      <ScrollProgressBar />
      <Navbar />

      {apiStatus !== 'online' && (
        <div className="fixed top-14 left-0 right-0 z-40 px-4 py-2 text-xs text-center"
          style={{
            background: apiStatus === 'offline' ? 'rgba(239,68,68,0.1)' : 'rgba(245,158,11,0.1)',
            color: apiStatus === 'offline' ? '#EF4444' : '#F59E0B',
            borderBottom: `1px solid ${apiStatus === 'offline' ? 'rgba(239,68,68,0.2)' : 'rgba(245,158,11,0.2)'}`,
          }}>
          {apiStatus === 'offline'
            ? '⚠ API unavailable — results may be from cache'
            : '⚡ Models loading — first request may be slow'}
        </div>
      )}

      <Routes>
        <Route path="/" element={<Workbench />} />
        <Route path="/dashboard" element={<Dashboard />} />
      </Routes>

      <HistoryDrawer />
      <OnboardingModal onLoadExample={() => window.__rs_example?.()} />
      <SettingsModal />
      <Footer />
    </>
  )
}