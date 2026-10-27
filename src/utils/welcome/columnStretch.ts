// src/utils/welcome/columnStretch.ts
// El gest secret de la benvinguda: estirar la columna del cel cap amunt tres cops seguits obre l'ascensor
// (utils/welcome/skyElevator.ts, que només es baixa llavors). Aquí només hi ha el que la benvinguda necessita
// sempre: comptar les estirades i com cedeix la columna, com una goma. Pur, sense React.

/** Estirades que obren l'ascensor i temps màxim entre la primera i l'última. */
export const STRETCH_PULLS = 3;
export const STRETCH_WINDOW_MS = 5000;
/** Una estirada compta si el dit (o el ratolí) puja almenys aquesta fracció de l'alçada de la columna. */
export const STRETCH_MIN_FRACTION = 0.12;

/** Compta estirades: `pull` torna true a la tercera dins la finestra de temps (i torna a començar). */
export function createStretchCounter(pulls = STRETCH_PULLS, windowMs = STRETCH_WINDOW_MS) {
  let times: number[] = [];
  return {
    pull(at: number): boolean {
      times = [...times.filter(t => at - t <= windowMs), at];
      if (times.length < pulls) return false;
      times = [];
      return true;
    },
    reset() { times = []; },
    get count() { return times.length; },
  };
}

/**
 * Allargament visual de la columna quan s'estira `dy` px (cap amunt): cedeix cada cop menys, com una goma, i mai
 * passa de `limit` px.
 */
export function rubberBand(dy: number, limit: number): number {
  if (dy <= 0 || limit <= 0) return 0;
  return limit * (1 - Math.exp(-dy / limit));
}
