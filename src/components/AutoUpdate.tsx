// src/components/AutoUpdate.tsx
import { useCallback, useEffect, useRef } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { canApplyUpdateNow, isOverlayOpen, shouldCheckForUpdate } from '../utils/autoUpdatePolicy';

// Posa sola la versió nova de l'app, sense cap avís per acceptar-la, en un moment en què la recàrrega no molesti
// (vegeu utils/autoUpdatePolicy.ts). No pinta res.

/** Cada quant es desperta el comptador que decideix si toca mirar si hi ha versió nova (la decisió és horària). */
const CHECK_TICK_MS = 10 * 60 * 1000;
const INTERACTION_EVENTS = ['pointerdown', 'touchstart', 'keydown', 'wheel'] as const;

export default function AutoUpdate(): null {
  const registrationRef = useRef<ServiceWorkerRegistration | null>(null);
  const lastCheckRef = useRef(0);
  const { needRefresh: [needRefresh], updateServiceWorker } = useRegisterSW({
    onRegisteredSW: (_swUrl, registration) => {
      registrationRef.current = registration ?? null;
      // En registrar-se (en obrir l'app) el navegador ja ha mirat si n'hi ha una de nova.
      lastCheckRef.current = Date.now();
    },
  });

  const needRefreshRef = useRef(needRefresh);
  const applyingRef = useRef(false);
  const interactedRef = useRef(false);
  // performance.now() compta des que s'ha obert la pàgina: 0 és el moment d'obrir-la.
  const shownAtRef = useRef(0);

  const tryApply = useCallback(() => {
    if (!needRefreshRef.current || applyingRef.current) return;
    const ready = canApplyUpdateNow({
      hidden: document.visibilityState === 'hidden',
      overlayOpen: isOverlayOpen(),
      interacted: interactedRef.current,
      msSinceShown: performance.now() - shownAtRef.current,
    });
    if (!ready) return;
    applyingRef.current = true;
    // Activa la versió en espera; quan pren el control, vite-plugin-pwa recarrega la pàgina.
    void updateServiceWorker(true);
  }, [updateServiceWorker]);

  const checkForUpdate = useCallback(() => {
    const registration = registrationRef.current;
    if (!registration || registration.installing || registration.waiting) return;
    const due = shouldCheckForUpdate({
      now: Date.now(),
      lastCheck: lastCheckRef.current,
      online: navigator.onLine,
      visible: document.visibilityState === 'visible',
    });
    if (!due) return;
    lastCheckRef.current = Date.now();
    // Sense xarxa o amb el servidor caigut, falla: ja es tornarà a provar d'aquí a una hora.
    registration.update().catch(() => {});
  }, []);

  useEffect(() => {
    needRefreshRef.current = needRefresh;
    if (needRefresh) tryApply();
  }, [needRefresh, tryApply]);

  useEffect(() => {
    const onInteraction = () => {
      interactedRef.current = true;
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        // Tornar a l'app compta com obrir-la: torna a començar la finestra de calma.
        shownAtRef.current = performance.now();
        interactedRef.current = false;
        checkForUpdate();
      }
      tryApply();
    };
    const listenerOptions: AddEventListenerOptions = { capture: true, passive: true };
    INTERACTION_EVENTS.forEach((type) => window.addEventListener(type, onInteraction, listenerOptions));
    document.addEventListener('visibilitychange', onVisibilityChange);
    const tick = window.setInterval(checkForUpdate, CHECK_TICK_MS);
    return () => {
      INTERACTION_EVENTS.forEach((type) => window.removeEventListener(type, onInteraction, listenerOptions));
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.clearInterval(tick);
    };
  }, [checkForUpdate, tryApply]);

  return null;
}
