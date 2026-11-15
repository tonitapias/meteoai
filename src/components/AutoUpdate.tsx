// src/components/AutoUpdate.tsx
import { useCallback, useEffect, useRef } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { canApplyUpdateNow, isOverlayOpen, shouldCheckForUpdate } from '../utils/autoUpdatePolicy';

// Posa sola la versió nova de l'app, sense cap avís per acceptar-la, en un moment en què la recàrrega no molesti
// (vegeu utils/autoUpdatePolicy.ts). No pinta res.

/** Cada quant es desperta el comptador que decideix si toca mirar si hi ha versió nova (la decisió és horària). */
const CHECK_TICK_MS = 10 * 60 * 1000;
const INTERACTION_EVENTS = ['pointerdown', 'touchstart', 'keydown', 'wheel'] as const;
/**
 * Quant s'espera abans de tornar a demanar el canvi si la versió nova continua en espera. El navegador no l'activa
 * mentre la versió antiga encara atén peticions (en obrir l'app, sempre): la petició queda ajornada fins que l'antiga
 * fa ~30 s que no fa res, i demanar-ho un altre cop en un moment tranquil l'activa a l'instant.
 */
const RETRY_APPLY_MS = 3_000;
/**
 * En amagar-se la pàgina, quant s'espera abans de demanar el canvi. Recarregar o navegar també l'amaguen, just
 * abans de descarregar-la: demanar-ho llavors fa que la versió nova prengui el control a mitja càrrega de la pàgina
 * següent (que es queda amb el codi antic, o aturada ~30 s). Una pàgina que es descarrega no arriba a esperar tant.
 */
const HIDDEN_APPLY_DELAY_MS = 1_000;

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
  const retryTimerRef = useRef<number | undefined>(undefined);
  const tryApplyRef = useRef<() => void>(() => {});

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
    // Si al cap d'una estona encara espera, la petició ha arribat amb la versió antiga ocupada: es torna a passar
    // per aquí, que torna a mirar si el moment encara és bo abans de demanar-ho un altre cop.
    window.clearTimeout(retryTimerRef.current);
    retryTimerRef.current = window.setTimeout(() => {
      if (!registrationRef.current?.waiting) return;
      applyingRef.current = false;
      tryApplyRef.current();
    }, RETRY_APPLY_MS);
  }, [updateServiceWorker]);

  useEffect(() => {
    tryApplyRef.current = tryApply;
  }, [tryApply]);

  useEffect(() => () => window.clearTimeout(retryTimerRef.current), []);

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
    let hiddenTimer: number | undefined;
    const onVisibilityChange = () => {
      window.clearTimeout(hiddenTimer);
      if (document.visibilityState === 'visible') {
        // Tornar a l'app compta com obrir-la: torna a començar la finestra de calma.
        shownAtRef.current = performance.now();
        interactedRef.current = false;
        checkForUpdate();
        tryApply();
        return;
      }
      // Amagada: només si ho continua sent d'aquí a un moment (vegeu HIDDEN_APPLY_DELAY_MS).
      hiddenTimer = window.setTimeout(tryApply, HIDDEN_APPLY_DELAY_MS);
    };
    const listenerOptions: AddEventListenerOptions = { capture: true, passive: true };
    INTERACTION_EVENTS.forEach((type) => window.addEventListener(type, onInteraction, listenerOptions));
    document.addEventListener('visibilitychange', onVisibilityChange);
    const tick = window.setInterval(checkForUpdate, CHECK_TICK_MS);
    return () => {
      INTERACTION_EVENTS.forEach((type) => window.removeEventListener(type, onInteraction, listenerOptions));
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.clearInterval(tick);
      window.clearTimeout(hiddenTimer);
    };
  }, [checkForUpdate, tryApply]);

  return null;
}
