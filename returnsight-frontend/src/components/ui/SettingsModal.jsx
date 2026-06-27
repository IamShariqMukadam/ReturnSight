import { useState } from 'react'
import Modal from '../ui/Modal'
import { useAppStore } from '../../store/appStore'
import { useToast } from '../../hooks/useToast'

// Fix 6: dark-themed select styles injected globally
const selectStyle = {
  background: '#13141C',
  border: '1px solid rgba(255,255,255,0.08)',
  color: '#E5E7EB',
  appearance: 'none',
  WebkitAppearance: 'none',
}

export default function SettingsModal() {
  const { settingsOpen, setSettingsOpen, settings, updateSettings } = useAppStore()
  const toast = useToast()
  const [local, setLocal] = useState(settings)

  const save = () => { updateSettings(local); setSettingsOpen(false); toast.success('Settings saved') }
  const set = (k, v) => setLocal(s => ({ ...s, [k]: v }))

  return (
    <Modal open={settingsOpen} onClose={() => setSettingsOpen(false)} title="Settings" width={440}>
      {/* Fix 6: inject style to override browser default select dropdown */}
      <style>{`
        .rs-select option { background: #13141C !important; color: #E5E7EB !important; }
        .rs-select:focus { outline: none; border-color: rgba(255,92,26,0.5) !important; box-shadow: 0 0 0 2px rgba(255,92,26,0.15) !important; }
      `}</style>
      <div className="space-y-5">
        <div>
          <div className="flex justify-between mb-1">
            <label className="text-sm" style={{ color: 'var(--text)' }}>High Risk Threshold</label>
            <span className="text-sm font-mono" style={{ color: 'var(--orange)' }}>{local.highRiskThreshold}%</span>
          </div>
          <input type="range" min={50} max={80} value={local.highRiskThreshold}
            onChange={e => set('highRiskThreshold', Number(e.target.value))} className="w-full accent-orange-500" />
          <div className="flex justify-between text-xs mt-1" style={{ color: 'var(--muted)' }}>
            <span>50%</span><span>80%</span>
          </div>
        </div>
        <div>
          <div className="flex justify-between mb-1">
            <label className="text-sm" style={{ color: 'var(--text)' }}>Medium Risk Threshold</label>
            <span className="text-sm font-mono" style={{ color: 'var(--orange)' }}>{local.mediumRiskThreshold}%</span>
          </div>
          <input type="range" min={20} max={50} value={local.mediumRiskThreshold}
            onChange={e => set('mediumRiskThreshold', Number(e.target.value))} className="w-full accent-orange-500" />
          <div className="flex justify-between text-xs mt-1" style={{ color: 'var(--muted)' }}>
            <span>20%</span><span>50%</span>
          </div>
        </div>
        <div>
          <label className="block text-sm mb-1.5" style={{ color: 'var(--text)' }}>Default Category</label>
          <div className="relative">
            <select value={local.defaultCategory} onChange={e => set('defaultCategory', e.target.value)}
              className="rs-select w-full rounded-lg px-3 py-2.5 text-sm pr-8"
              style={selectStyle}>
              {['Clothing_Shoes_and_Jewelry','Electronics','Home_and_Kitchen','Sports_and_Outdoors','Beauty_and_Personal_Care'].map(c => (
                <option key={c} value={c}>{c.replace(/_/g,' ')}</option>
              ))}
            </select>
            {/* Custom chevron since we removed native appearance */}
            <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--muted)' }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6,9 12,15 18,9"/></svg>
            </div>
          </div>
        </div>
        <div>
          <label className="block text-sm mb-1.5" style={{ color: 'var(--text)' }}>
            API URL Override <span className="text-xs" style={{ color: 'var(--muted)' }}>(self-hosted)</span>
          </label>
          <input value={local.apiUrlOverride} onChange={e => set('apiUrlOverride', e.target.value)}
            placeholder={import.meta.env.VITE_API_URL || 'http://localhost:8000'}
            className="w-full rounded-lg px-3 py-2 text-sm outline-none"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)', color: 'var(--text)' }} />
        </div>
        <div className="flex gap-3 pt-2">
          <button onClick={() => setSettingsOpen(false)}
            className="flex-1 py-2 rounded-lg border text-sm hover:bg-white/5 transition-colors"
            style={{ borderColor: 'var(--border)', color: 'var(--text)' }}>Cancel</button>
          <button onClick={save}
            className="flex-1 py-2 rounded-lg text-sm font-medium text-white transition-all hover:opacity-90"
            style={{ background: 'var(--orange)' }}>Save Settings</button>
        </div>
      </div>
    </Modal>
  )
}
