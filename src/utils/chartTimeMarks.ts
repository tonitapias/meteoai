// src/utils/chartTimeMarks.ts
// Marques de temps dels gràfics horaris: les hores de nit (ombra de fons), el canvi de dia (separador de
// mitjanit amb el nom del dia) i la posició d'"ara". Funcions pures sobre la sèrie que ja es dibuixa.

export interface NightRun {
    /** Primer i últim índex (tots dos inclosos) d'un tram seguit d'hores de nit. */
    start: number;
    end: number;
}

/** Trams seguits d'hores de nit. Una hora sense `isDay` (no és un booleà) no compta com a nit. */
export const nightRuns = (points: ReadonlyArray<{ isDay: boolean }>): NightRun[] => {
    const runs: NightRun[] = [];
    let start = -1;
    points.forEach((p, i) => {
        if (p.isDay === false) {
            if (start === -1) start = i;
        } else if (start !== -1) {
            runs.push({ start, end: i - 1 });
            start = -1;
        }
    });
    if (start !== -1) runs.push({ start, end: points.length - 1 });
    return runs;
};

const datePart = (time: string): string => time.slice(0, 10);

/** Índexs on comença un dia nou respecte de l'hora anterior (mai el 0: no hi ha "anterior"). */
export const dayChangeIndices = (points: ReadonlyArray<{ time: string }>): number[] => {
    const out: number[] = [];
    for (let i = 1; i < points.length; i++) {
        if (datePart(points[i].time) !== datePart(points[i - 1].time)) out.push(i);
    }
    return out;
};

/**
 * "dt. 22" / "Tue 22": dia de la setmana curt + dia del mes d'una data ISO. Es calcula en UTC a migdia
 * perquè el fus horari del navegador no pugui moure la data un dia.
 */
export const formatDayLabel = (isoTime: string, locale: string): string => {
    const [y, m, d] = datePart(isoTime).split('-').map(Number);
    if (!y || !m || !d) return '';
    const date = new Date(Date.UTC(y, m - 1, d, 12));
    const parts = new Intl.DateTimeFormat(locale, { weekday: 'short', day: 'numeric', timeZone: 'UTC' }).formatToParts(date);
    const weekday = parts.find(p => p.type === 'weekday')?.value ?? '';
    const day = parts.find(p => p.type === 'day')?.value ?? '';
    return `${weekday} ${day}`.trim();
};
