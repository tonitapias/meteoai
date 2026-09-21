// src/hooks/useRefreshOnResume.ts
//
// L'app només carregava la previsió en canviar d'ubicació: amb la PWA oberta
// hores (o reoberta des de segon pla) la finestra de 24 h no avançava i tot
// mostrava dades velles. Aquest hook torna a demanar la ubicació ja carregada
// quan l'app "es desperta" — la pestanya torna a ser visible, es restaura de la
// bfcache o torna la connexió — sempre que la darrera càrrega correcta sigui
// més vella que el TTL de la cache. I, com que cap d'aquests esdeveniments es
// dispara si la finestra no deixa mai de ser visible, un comprovador lleuger
// (només compara timestamps) cobreix la pestanya oberta en primer pla.
import { useEffect, useRef } from 'react';
import { CACHE_TTL } from '../constants/cacheConfig';

// Cada quant mira el comprovador si les dades s'han fet velles (no és cap petició).
const CHECK_INTERVAL_MS = 60 * 1000;

interface RefreshOnResumeOptions {
  /** Instant (ms epoch) de l'última càrrega correcta; null si no hi ha cap ubicació carregada. */
  getLastLoadedAt: () => number | null;
  /** Torna a carregar la ubicació actual (la seva pròpia gestió d'errors, no ha de llançar). */
  refresh: () => Promise<unknown>;
  /** Antiguitat a partir de la qual es refresca. Per defecte, el TTL de la cache del repositori. */
  staleAfterMs?: number;
}

export function useRefreshOnResume({
  getLastLoadedAt,
  refresh,
  staleAfterMs = CACHE_TTL.WEATHER
}: RefreshOnResumeOptions) {
  // Sempre l'última versió de les props, perquè els listeners es registrin un sol
  // cop i no es tornin a subscriure a cada render (refresh canvia amb lang/unit).
  const latest = useRef({ getLastLoadedAt, refresh, staleAfterMs });
  useEffect(() => {
    latest.current = { getLastLoadedAt, refresh, staleAfterMs };
  });

  useEffect(() => {
    let running = false;
    let lastAttemptAt = -Infinity;

    const refreshIfStale = (viaTimer: boolean) => {
      if (running || document.visibilityState !== 'visible') return;

      const { getLastLoadedAt, refresh, staleAfterMs } = latest.current;
      const loadedAt = getLastLoadedAt();
      if (loadedAt === null) return; // Cap ubicació carregada: no hi ha res a refrescar.

      // Estrictament més vella que el TTL: així la cache del repositori (que
      // caduca amb el mateix comparador) garanteix una petició real, no un
      // "refresc" servit de la cache.
      const now = Date.now();
      if (now - loadedAt <= staleAfterMs) return;

      // Si el refresc falla, loadedAt no avança: perquè el comprovador no
      // martelli l'API cada minut durant una caiguda, només reintenta un cop
      // per TTL. Els esdeveniments (visible/online) sí que reintenten al moment.
      if (viaTimer && now - lastAttemptAt <= staleAfterMs) return;

      lastAttemptAt = now;
      running = true;
      void (async () => {
        try {
          await refresh();
        } catch {
          // refresh() ja reporta els seus errors; aquí només cal no quedar-se "running".
        } finally {
          running = false;
        }
      })();
    };

    const onVisibilityChange = () => refreshIfStale(false);
    const onOnline = () => refreshIfStale(false);
    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) refreshIfStale(false); // Restauració des de la bfcache.
    };

    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('online', onOnline);
    window.addEventListener('pageshow', onPageShow);
    const timer = setInterval(() => refreshIfStale(true), CHECK_INTERVAL_MS);

    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('online', onOnline);
      window.removeEventListener('pageshow', onPageShow);
      clearInterval(timer);
    };
  }, []);
}
