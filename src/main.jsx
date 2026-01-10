// src/main.jsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
// IMPORTA EL PROVIDER
import { PreferencesProvider } from './context/PreferencesContext'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {/* EMBOLCALLEM L'APP */}
    <PreferencesProvider>
      <App />
    </PreferencesProvider>
  </React.StrictMode>,
)