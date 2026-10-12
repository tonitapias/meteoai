// src/components/solar/scrubChannel.ts
// Canal mínim entre el gràfic (que pinta cada fotograma de l'arrossegament fora de React) i la brúixola
// de pantalla gran: la posició del sol (azimut, alçada aparent) arriba sense cap render. Recorda l'última
// posició perquè qui se subscriu tard (la brúixola es munta diferida) la rebi de seguida.

export type ScrubListener = (az: number, alt: number) => void;

export interface ScrubChannel {
  emit(az: number, alt: number): void;
  subscribe(fn: ScrubListener): () => void;
}

export function createScrubChannel(): ScrubChannel {
  const listeners = new Set<ScrubListener>();
  let last: [number, number] | null = null;
  return {
    emit(az, alt) {
      last = [az, alt];
      listeners.forEach(fn => fn(az, alt));
    },
    subscribe(fn) {
      listeners.add(fn);
      if (last) fn(last[0], last[1]);
      return () => { listeners.delete(fn); };
    },
  };
}
