import React from 'react'
import ReactDOM from 'react-dom/client'
import './i18n'
import { initTheme } from './themeUtils'
import App from './App.tsx'
import './index.css'

// Initialize user custom or default theme palette
initTheme()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
