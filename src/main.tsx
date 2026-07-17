// src/main.tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import * as Sentry from "@sentry/react";
import './i18n'; // <--- NOU IMPORT: Inicialització global del motor d'idiomes
import App from './App';
import './index.css';

// Contexts
import { PreferencesProvider } from './context/PreferencesContext';
import { GeoLocationProvider } from './context/GeoLocationContext';

// --- 1. CONFIGURACIÓ DE SENTRY ---
Sentry.init({
  dsn: "https://5d21e95a14abe6e5779f825cd519765c@o4510759217856512.ingest.de.sentry.io/4510759236075600",
  integrations: [
    Sentry.browserTracingIntegration(),
    Sentry.replayIntegration(),
  ],
  tracesSampleRate: 1.0, 
  replaysSessionSampleRate: 0.1, 
  replaysOnErrorSampleRate: 1.0, 
});

// --- 2. RENDERITZACIÓ SEGURA ---
const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error("ERROR CRÍTIC: No s'ha trobat l'element 'root' al index.html");
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <PreferencesProvider>
      <GeoLocationProvider>
        <App />
      </GeoLocationProvider>
    </PreferencesProvider>
  </React.StrictMode>,
);