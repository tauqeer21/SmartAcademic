import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import App from './App'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
      <Toaster position="top-right" toastOptions={{
        style: { background: 'var(--surface2)', color: 'var(--text1)', border: '1px solid var(--border)', fontSize: 13 },
        success: { iconTheme: { primary: 'var(--green)', secondary: 'var(--bg)' } },
        error:   { iconTheme: { primary: 'var(--red)',   secondary: 'var(--bg)' } },
      }}/>
    </BrowserRouter>
  </React.StrictMode>
)
