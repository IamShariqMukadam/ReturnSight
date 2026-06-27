import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'react-hot-toast'
import App from './App'
import './globals.css'

const qc = new QueryClient()

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <QueryClientProvider client={qc}>
      <BrowserRouter>
        <App />
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              background: '#13141C',
              color: '#E5E7EB',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: '10px',
              padding: '12px 16px',
              maxWidth: '360px',
            },
            duration: 4000,
          }}
        />
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>
)
