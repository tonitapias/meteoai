// src/components/solar/preloadSolarModal.ts
// Al paquet principal: precàrrega del modal Cicle solar en l'intent (pointerdown/focus de la targeta) i
// registre de l'esquelet de càrrega a la pantalla, perquè el modal no torni a fer l'animació d'entrada a sobre.

type SolarModalModule = typeof import('../SolarModal');

let pending: Promise<SolarModalModule> | null = null;
let loaded: SolarModalModule | null = null;

/** import() memoritzat del modal; si falla (xarxa), es buida perquè el pròxim intent ho torni a provar. */
export function preloadSolarModal(): Promise<SolarModalModule> {
  if (!pending) {
    pending = import('../SolarModal').then(
      (mod) => {
        loaded = mod;
        return mod;
      },
      (err: unknown) => {
        pending = null;
        throw err;
      },
    );
    // La precàrrega de l'intent no escolta el resultat: sense això, una fallada (fora de línia) seria un
    // "unhandled rejection". Qui encadena la promesa (lazy, un await) continua rebent l'error.
    pending.catch(() => {});
  }
  return pending;
}

/**
 * Carregador per a lazy(). Si el mòdul ja és a memòria (precarregat en el pointerdown), retorna un thenable
 * que resol de manera síncrona: lazy() el llegeix sense suspendre i el modal s'obre al primer render. Amb
 * una Promise nativa, React mostraria l'esquelet i, en revelar el contingut, l'endarreriria fins a 300 ms
 * (FALLBACK_THROTTLE_MS de React 19) encara que el codi ja fos aquí. Només per a lazy(): no té catch/finally.
 */
export function loadSolarModal(): Promise<SolarModalModule> {
  const mod = loaded;
  if (mod) {
    const syncThenable = { then: (resolve: (m: SolarModalModule) => void) => resolve(mod) };
    return syncThenable as unknown as Promise<SolarModalModule>;
  }
  return preloadSolarModal();
}

// Esquelets de càrrega muntats ara mateix. Quan el codi arriba, React renderitza el modal mentre l'esquelet
// encara és a la pantalla (el treu en el mateix commit), així que el modal hi llegeix si n'ha de prendre el
// relleu sense repetir l'entrada, per molt que hagi trigat la càrrega. En obertures posteriors (codi ja a
// memòria) no hi ha esquelet i el comptador és 0.
let skeletonsOnScreen = 0;

/** Per al useLayoutEffect de l'esquelet: el registra i retorna la neteja. */
export function registerSolarSkeleton(): () => void {
  skeletonsOnScreen++;
  return () => { skeletonsOnScreen = Math.max(0, skeletonsOnScreen - 1); };
}

/** Hi ha un esquelet de càrrega a la pantalla (el modal el substituirà). */
export function isSolarSkeletonOnScreen(): boolean {
  return skeletonsOnScreen > 0;
}
