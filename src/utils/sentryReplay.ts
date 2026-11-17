// src/utils/sentryReplay.ts
// La gravació de Sentry (Replay), en un fragment a part: main.tsx la carrega amb import() quan el navegador queda
// lliure. Importada directament anava dins el fragment d'entrada (125,6 kB de 831 kB, ~40 kB comprimits) i el mòbil
// la baixava i la compilava abans de pintar res (auditoria d'UX del 16/11/2026, X1). Ve del mateix paquet que la
// resta de Sentry (@sentry/react), sense CDN.
export { replayIntegration } from '@sentry/react';
