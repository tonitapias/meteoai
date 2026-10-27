// src/main.tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import * as Sentry from "@sentry/react";
import './i18n'; // <--- NOU IMPORT: Inicialització global del motor d'idiomes
import App from './App';
import './index.css';

// Contexts
import { GeoLocationProvider } from './context/GeoLocationContext';
import { APP_VERSION } from './utils/appVersion';
import { createSentryPrivacy } from './utils/telemetryPrivacy';

// Privadesa: res del que va a Sentry porta la posició exacta (coordenades a ~1 km, l'adreça de l'app sense el lloc).
// Només es neteja la còpia que s'envia; l'enllaç per compartir i les peticions conserven tota la precisió.
const sentryPrivacy = createSentryPrivacy({
  appOrigin: typeof window !== 'undefined' ? window.location.origin : '',
  appBase: import.meta.env.BASE_URL,
});

// --- 1. CONFIGURACIÓ DE SENTRY ---
// environment/release separen el trànsit de `npm run dev` de producció i permeten
// atribuir errors a una versió concreta. tracesSampleRate baix en producció evita
// esgotar la quota amb trànsit real (en dev mantenim 100% per depurar còmodament).
Sentry.init({
  dsn: "https://5d21e95a14abe6e5779f825cd519765c@o4510759217856512.ingest.de.sentry.io/4510759236075600",
  environment: import.meta.env.MODE,
  release: `meteoai@${APP_VERSION}`,
  integrations: [
    Sentry.browserTracingIntegration(),
    // Errors, traces i repeticions hi passen abans d'enviar-se (l'adreça de la pàgina, les dades extra, les traces).
    sentryPrivacy.integration,
  ],
  // Les molles de pa (navegacions, peticions, consola) es netegen en crear-se: Replay ja rep la versió neta.
  beforeBreadcrumb: sentryPrivacy.beforeBreadcrumb,
  tracesSampleRate: import.meta.env.PROD ? 0.2 : 1.0,
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
});

// Replay s'afegeix un cop el navegador ha respirat (idle) o, com a màxim, als 3s —
// el seu propi arrencament (observadors DOM, snapshot inicial) és treball síncron que
// Lighthouse marcava com el gruix del Total Blocking Time durant la càrrega inicial.
// Els sampling rates de dalt ja decideixen quines sessions es graven; ajornar l'inici
// uns instants no en perd cap de real, només deixa sense repetició els errors dels
// primers instants de vida de la pàgina (abans que aquest callback s'executi).
// beforeAddRecordingEvent: les navegacions i les peticions que la gravació desa pel seu compte (els elements de pàgina
// amb coordenades als atributs porten data-sentry-block: el mapa de Windy i la posició compartida).
const startReplay = () => {
  Sentry.addIntegration(Sentry.replayIntegration({
    beforeAddRecordingEvent: sentryPrivacy.beforeAddRecordingEvent,
  }));
};
if (typeof window !== 'undefined') {
  if ('requestIdleCallback' in window) {
    window.requestIdleCallback(startReplay, { timeout: 3000 });
  } else {
    setTimeout(startReplay, 1500);
  }
}

// --- 2. RENDERITZACIÓ SEGURA ---
const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error("ERROR CRÍTIC: No s'ha trobat l'element 'root' al index.html");
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <GeoLocationProvider>
      <App />
    </GeoLocationProvider>
  </React.StrictMode>,
);