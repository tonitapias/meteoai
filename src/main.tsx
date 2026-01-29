// src/main.tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import * as Sentry from "@sentry/react";
import App from './App';
import './index.css';

// Contexts
import { PreferencesProvider } from './context/PreferencesContext';
import { GeoLocationProvider } from './context/GeoLocationContext'; // <--- NOU IMPORT

// --- 1. CONFIGURACIÓ DE SENTRY ---
// Mantenim la teva configuració exacta de producció
Sentry.init({
  dsn: "https://5d21e95a14abe6e5779f825cd519765c@o4510759217856512.ingest.de.sentry.io/4510759236075600",
  integrations: [
    Sentry.browserTracingIntegration(),
    Sentry.replayIntegration(),
  ],
  // Performance Monitoring
  tracesSampleRate: 1.0, 
  // Session Replay
  replaysSessionSampleRate: 0.1, 
  replaysOnErrorSampleRate: 1.0, 
});

// --- 2. RENDERITZACIÓ SEGURA ---
const rootElement = document.getElementById('root');

if (!rootElement) {
  // Això evita errors silenciosos si l'HTML està mal format
  throw new Error("ERROR CRÍTIC: No s'ha trobat l'element 'root' al index.html");
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    {/* Emboliquem l'App amb els proveïdors de dades globals */}
    <PreferencesProvider>
      <GeoLocationProvider>
        <App />
      </GeoLocationProvider>
    </PreferencesProvider>
  </React.StrictMode>,
);