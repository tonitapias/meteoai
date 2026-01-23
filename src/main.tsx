// src/main.tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import * as Sentry from "@sentry/react"; 
import App from './App';
import './index.css';
import { PreferencesProvider } from './context/PreferencesContext';

// Inicialització de Sentry amb la teva DSN real
Sentry.init({
  dsn: "https://5d21e95a14abe6e5779f825cd519765c@o4510759217856512.ingest.de.sentry.io/4510759236075600",
  integrations: [
    Sentry.browserTracingIntegration(),
    Sentry.replayIntegration(),
  ],
  // Performance Monitoring: Captura el 100% de les transaccions per a proves
  tracesSampleRate: 1.0, 
  // Session Replay
  replaysSessionSampleRate: 0.1, 
  replaysOnErrorSampleRate: 1.0, 
});

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error("No s'ha trobat l'element 'root' al HTML.");
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <PreferencesProvider>
      <App />
    </PreferencesProvider>
  </React.StrictMode>,
);