// src/utils/dayNavigation.ts
// Dies veïns d'un dia del detall. Es pot anar i venir només entre els dies que la previsió setmanal
// ja llista (ForecastSection i TrendChartModal mostren els índexs 1..7 de `daily`; 0 és avui).

export const FIRST_LISTED_DAY = 1;
export const LAST_LISTED_DAY = 7;

export interface NeighbourDays {
    /** Índex del dia anterior, o null si aquest és el primer de la llista. */
    prev: number | null;
    /** Índex del dia següent, o null si aquest és l'últim de la llista o no n'hi ha dades. */
    next: number | null;
}

/** `dayCount`: nombre de dies que porta `daily` (un dia sense entrada no es pot obrir). */
export const neighbourDays = (dayIndex: number, dayCount: number): NeighbourDays => {
    const last = Math.min(LAST_LISTED_DAY, dayCount - 1);
    return {
        prev: dayIndex > FIRST_LISTED_DAY ? dayIndex - 1 : null,
        next: dayIndex < last ? dayIndex + 1 : null
    };
};

/** Gest horitzontal d'un dit: prou llarg i prou més horitzontal que vertical (així no s'hi confon un scroll). */
export const SWIPE_MIN_DISTANCE = 70;
export const SWIPE_DOMINANCE = 1.8;

/** -1 = anar al dia anterior (dit cap a la dreta), 1 = al següent (dit cap a l'esquerra), 0 = no és un gest de canvi de dia. */
export const swipeDirection = (dx: number, dy: number): -1 | 0 | 1 => {
    if (Math.abs(dx) < SWIPE_MIN_DISTANCE) return 0;
    if (Math.abs(dx) < Math.abs(dy) * SWIPE_DOMINANCE) return 0;
    return dx < 0 ? 1 : -1;
};
