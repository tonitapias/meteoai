// src/hooks/usePlanetHeadline.ts
// El xip del fenomen gros del dia a la Vista essencial (vegeu planetHeadline.ts). Fora del camí crític: la
// petició surt uns segons després que la previsió ja és a la pantalla, i el codi i els textos es baixen
// en aquell moment. És una sola petició al worker (bucket «aux», 45 per minut i IP) que comparteix la
// memòria de 15 min de fetchPlanetExtremes amb la Vista completa.
import { useEffect, useRef, useState } from 'react';
import type { Language } from '../translations';
import type { PlanetHeadline } from '../components/planet/planetHeadline';

// Prou perquè la previsió, la IA i els ginys de dalt hagin acabat de carregar i pintar.
export const PLANET_HEADLINE_DELAY_MS = 3000;
// En fred, el worker pot respondre sense els ciclons i omplir-los en segon pla: un sol reintent.
export const PLANET_HEADLINE_RETRY_MS = 8000;

export function usePlanetHeadline(enabled: boolean, lang: Language): PlanetHeadline | null {
  const [headline, setHeadline] = useState<PlanetHeadline | null>(null);
  // Un cop carregat, canviar d'idioma o tornar a l'essencial no espera: el codi i les dades ja hi són.
  const loadedRef = useRef(false);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const load = (isRetry: boolean) => {
      import('../components/planet/planetHeadline')
        .then(({ loadPlanetHeadline }) => loadPlanetHeadline(lang))
        .then((result) => {
          if (cancelled) return;
          if (result.status === 'incomplete') {
            if (!isRetry) timer = setTimeout(() => load(true), PLANET_HEADLINE_RETRY_MS);
            return;
          }
          loadedRef.current = true;
          setHeadline(result.headline);
        })
        // Sense xarxa o sense worker, la targeta queda com sempre.
        .catch(() => {});
    };
    timer = setTimeout(() => load(false), loadedRef.current ? 0 : PLANET_HEADLINE_DELAY_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [enabled, lang]);

  return enabled ? headline : null;
}
