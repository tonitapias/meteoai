// src/components/solar/useMinWidth.ts
// Si una media query es compleix ara (p. ex. la brúixola només a partir de 1024 px). Fa servir addListener
// on no hi ha addEventListener (Safari < 14) i retorna false si no hi ha matchMedia (jsdom).
import { useCallback, useSyncExternalStore } from 'react';

// Una MediaQueryList per consulta, reaprofitada (getSnapshot es crida a cada render), però lligada a la
// funció matchMedia que l'ha creada: si la funció canvia (proves que la substitueixen), no se'n serveix una vella.
const cache = new WeakMap<typeof window.matchMedia, Map<string, MediaQueryList>>();

const mediaQuery = (query: string): MediaQueryList | null => {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return null;
  const mm = window.matchMedia;
  let byQuery = cache.get(mm);
  if (!byQuery) {
    byQuery = new Map();
    cache.set(mm, byQuery);
  }
  let mql = byQuery.get(query);
  if (!mql) {
    mql = mm.call(window, query);
    byQuery.set(query, mql);
  }
  return mql;
};

const serverSnapshot = () => false;

export function useMinWidth(query: string): boolean {
  const subscribe = useCallback((onChange: () => void) => {
    const mql = mediaQuery(query);
    if (!mql) return () => {};
    if (typeof mql.addEventListener === 'function') {
      mql.addEventListener('change', onChange);
      return () => mql.removeEventListener('change', onChange);
    }
    mql.addListener(onChange);
    return () => mql.removeListener(onChange);
  }, [query]);
  const getSnapshot = useCallback(() => mediaQuery(query)?.matches === true, [query]);
  return useSyncExternalStore(subscribe, getSnapshot, serverSnapshot);
}
