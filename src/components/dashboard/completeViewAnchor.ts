// src/components/dashboard/completeViewAnchor.ts
// Punt on comença el contingut de la vista completa (el títol "Vista completa" del tauler).
export const COMPLETE_VIEW_ANCHOR_ID = 'vista-completa';

// Si es canvia a la vista completa des del xip de dalt, el contingut nou apareix unes quantes
// pantalles més avall i no es veuria cap canvi: hi baixem. rAF: després que React hagi pintat el títol.
export const scrollToCompleteView = () => {
  if (typeof window === 'undefined') return;
  window.requestAnimationFrame(() => {
    const anchor = document.getElementById(COMPLETE_VIEW_ANCHOR_ID);
    if (!anchor) return;
    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    anchor.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
  });
};
