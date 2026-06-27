import { create } from 'zustand'

const DEFAULT_SETTINGS = {
  highRiskThreshold: 65,
  mediumRiskThreshold: 35,
  defaultCategory: 'Clothing_Shoes_and_Jewelry',
  apiUrlOverride: '',
}

const loadSettings = () => {
  try { return { ...DEFAULT_SETTINGS, ...JSON.parse(localStorage.getItem('returnsight_settings') || '{}') } }
  catch { return DEFAULT_SETTINGS }
}

export const useAppStore = create((set, get) => ({
  // Result state
  result: null,
  setResult: (result) => set({ result }),
  clearResult: () => set({ result: null }),

  // Mode: 'single' | 'batch' | 'compare'
  mode: 'single',
  setMode: (mode) => set({ mode }),

  // API health
  apiStatus: 'online', // 'online' | 'offline' | 'degraded'
  setApiStatus: (apiStatus) => set({ apiStatus }),

  // History drawer
  historyOpen: false,
  setHistoryOpen: (historyOpen) => set({ historyOpen }),

  // Settings modal
  settingsOpen: false,
  setSettingsOpen: (settingsOpen) => set({ settingsOpen }),

  // Shortcut palette
  paletteOpen: false,
  setPaletteOpen: (paletteOpen) => set({ paletteOpen }),

  // Compare mode results
  compareLeft: null,
  compareRight: null,
  setCompareLeft: (v) => set({ compareLeft: v }),
  setCompareRight: (v) => set({ compareRight: v }),

  // Settings
  settings: loadSettings(),
  updateSettings: (patch) => {
    const settings = { ...get().settings, ...patch }
    localStorage.setItem('returnsight_settings', JSON.stringify(settings))
    set({ settings })
  },

  // Shared result from URL hash
  sharedResult: null,
  setSharedResult: (sharedResult) => set({ sharedResult }),
}))
