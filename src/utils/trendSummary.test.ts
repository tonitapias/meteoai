import { describe, it, expect } from 'vitest';
import { summarizeTrend, type TrendSummaryDay, type ValueRange } from './trendSummary';

const days = (
    maxes: Array<number | null>,
    mins: Array<number | null> = maxes.map(() => 10),
    extra: Partial<Record<number, Partial<TrendSummaryDay>>> = {}
): TrendSummaryDay[] =>
    maxes.map((max, i) => ({ max, min: mins[i] ?? null, ...extra[i] }));

const lastDay = (range: { max?: ValueRange; min?: ValueRange }) => ({ 6: { maxProbable: range.max, minProbable: range.min } });

// La setmana real de Girona (2-11-2026): màximes planes fins dissabte i més suaus diumenge i dilluns; les nits passen
// de 5° a 15°. La frase d'abans hi deia "Escalfament ... al llarg de la setmana. Poc segur".
const GIRONA_MAX = [16, 18, 18, 18, 17, 20, 21];
const GIRONA_MIN = [9, 8, 5, 5, 5, 11, 15];

describe('summarizeTrend — forma de les màximes', () => {
    it('una setmana plana amb un salt al final és un graó, no un escalfament de tota la setmana', () => {
        expect(summarizeTrend(days(GIRONA_MAX, GIRONA_MIN))?.max).toEqual({
            kind: 'step', dir: 'up',
            before: { low: 16, high: 18, firstDay: 0, lastDay: 4 },
            after: { firstDay: 5, lastDay: 6, extreme: { day: 6, value: 21 } }
        });
    });

    it('un refredament sobtat a mitja setmana també és un graó (Estocolm, 2-11-2026)', () => {
        expect(summarizeTrend(days([8, 8.5, 9.3, 4.7, 4.3, 3.6, 1.1]))?.max).toMatchObject({
            kind: 'step', dir: 'down',
            before: { firstDay: 0, lastDay: 2 },
            after: { firstDay: 3, extreme: { day: 6, value: 1.1 } }
        });
    });

    it('un canvi que va de mica en mica és "gradual", del primer a l\'últim dia', () => {
        expect(summarizeTrend(days([18, 19, 21, 22, 24, 25, 27]))?.max).toEqual({
            kind: 'gradual', dir: 'up', from: { day: 0, value: 18 }, to: { day: 6, value: 27 }
        });
        // Milà, 2-11-2026: baixa a batzegades però sense cap salt clar.
        expect(summarizeTrend(days([14.4, 13, 13.4, 10.9, 11.7, 12.4, 9.9]))?.max).toMatchObject({ kind: 'gradual', dir: 'down' });
    });

    it('el llindar del canvi és de 3° (a 3° ja és canvi, a 2,9° no)', () => {
        expect(summarizeTrend(days([20, 21, 22, 23]))?.max).toMatchObject({ kind: 'gradual', dir: 'up' });     // +3
        expect(summarizeTrend(days([20, 20.5, 21, 22.9]))?.max.kind).toBe('stable');                          // +2,9
        expect(summarizeTrend(days([23, 22, 21, 20]))?.max).toMatchObject({ kind: 'gradual', dir: 'down' });   // -3
    });

    it('baixar i tornar a pujar és una vall, amb el fons i on torna (no "variable" ni "estable")', () => {
        // 30 -> 30, però baixa a 22 pel mig: dir "estable" amagaria un cop de fred.
        expect(summarizeTrend(days([30, 26, 22, 27, 30]))?.max).toEqual({ kind: 'valley', extreme: 22, firstDay: 2, lastDay: 2, end: 30 });
        // Fons de diversos dies (a menys d'1° del més baix).
        expect(summarizeTrend(days([20, 17, 14, 14.6, 14.3, 18, 19]))?.max)
            .toEqual({ kind: 'valley', extreme: 14, firstDay: 2, lastDay: 4, end: 19 });
    });

    it('pujar i tornar a baixar és un cim', () => {
        expect(summarizeTrend(days([24, 26, 28, 30, 27, 25, 23]))?.max).toEqual({ kind: 'peak', extreme: 30, firstDay: 3, lastDay: 3, end: 23 });
    });

    it('vall i cim demanen el canvi mínim a cada banda: si no hi torna prou, no és una vall', () => {
        // Baixa 8° però només en remunta 2: és un refredament, no una vall.
        expect(summarizeTrend(days([30, 28, 25, 22, 22, 23, 24]))?.max.kind).not.toBe('valley');
        // Ni una vall al primer o a l'últim dia.
        expect(summarizeTrend(days([22, 26, 28, 30, 30, 30, 30]))?.max.kind).not.toBe('valley');
    });

    it('sense cap forma clara però amb una oscil·lació gran és "variable", no "sense grans canvis"', () => {
        expect(summarizeTrend(days([30, 34, 27, 33, 28, 31, 26]))?.max).toEqual({ kind: 'variable', low: 26, high: 34 });
    });

    it('temperatures que gairebé no es mouen són "estables"', () => {
        expect(summarizeTrend(days([24, 25, 24, 26, 25, 24, 25]))?.max).toEqual({ kind: 'stable', low: 24, high: 26 });
    });

    it('una forma que no explica prou la setmana no es fa servir: "baixen de 30° a 26°" amagaria les dents de serra', () => {
        // El primer i l'últim dia diuen -4°, però pel mig puja i baixa cada dia: ni recta, ni graó, ni cim.
        expect(summarizeTrend(days([30, 34, 27, 33, 28, 31, 26]))?.max.kind).toBe('variable');
    });

    it('els dies sense màxima s\'ignoren, i amb menys de 3 dies amb dada no es diu res', () => {
        expect(summarizeTrend(days([30, null, 27, null, 24]))?.max).toMatchObject({
            kind: 'gradual', dir: 'down', from: { day: 0, value: 30 }, to: { day: 4, value: 24 }
        });
        expect(summarizeTrend(days([30, null, null, 24]))).toBeNull();
        expect(summarizeTrend(days([]))).toBeNull();
        expect(summarizeTrend(days([null, null, null, null]))).toBeNull();
    });
});

describe('summarizeTrend — mínimes', () => {
    it('es diuen quan canvien de veritat (Girona: baixen a 5° de dijous a dissabte i pugen a 15°)', () => {
        expect(summarizeTrend(days(GIRONA_MAX, GIRONA_MIN))?.min).toEqual({ kind: 'valley', extreme: 5, firstDay: 2, lastDay: 4, end: 15 });
        // L'endemà, amb la passada nova: 11° dimarts en lloc de 9°, la mateixa vall.
        expect(summarizeTrend(days(GIRONA_MAX, [10.6, 8, 4.5, 5.09, 5.02, 10.6, 14.65]))?.min)
            .toEqual({ kind: 'valley', extreme: 4.5, firstDay: 2, lastDay: 4, end: 14.65 });
    });

    it('un canvi de menys de 4° a les mínimes no es diu (són més sorolloses que les màximes)', () => {
        expect(summarizeTrend(days(GIRONA_MAX, [10, 11, 12, 13, 13, 13, 13]))?.min).toBeNull();
        expect(summarizeTrend(days(GIRONA_MAX, [5, 6, 7, 8, 9, 10, 11]))?.min).toMatchObject({ kind: 'gradual', dir: 'up' });
    });

    it('mínimes estables o de pujades i baixades no es diuen', () => {
        expect(summarizeTrend(days(GIRONA_MAX, [10, 3, 11, 4, 10, 3, 10]))?.min).toBeNull();
    });
});

describe('summarizeTrend — incertesa amb el rang probable calibrat (els bigotis del gràfic)', () => {
    it('Girona: el rang de dilluns (19-26°) no arriba al tram d\'abans (fins a 18°): la pujada és clara', () => {
        const extra = lastDay({ max: { low: 19.2, high: 26 }, min: { low: 10, high: 18 } });
        expect(summarizeTrend(days(GIRONA_MAX, GIRONA_MIN, extra))?.uncertain).toBeNull();
    });

    it('si el rang del dia d\'arribada encara arriba al nivell de sortida, no és segur', () => {
        // Milà: baixa de 14,4° a 9,9°, però dilluns pot fer fins a 15,6°.
        const milano = [14.4, 13, 13.4, 10.9, 11.7, 12.4, 9.9];
        expect(summarizeTrend(days(milano, undefined, lastDay({ max: { low: 8, high: 15.6 } })))?.uncertain)
            .toEqual({ temp: 'max', day: 6, low: 8, high: 15.6 });
        // Amb un rang que no hi arriba (fins a 13,6° < 14,4°), és segur.
        expect(summarizeTrend(days(milano, undefined, lastDay({ max: { low: 8, high: 13.6 } })))?.uncertain).toBeNull();
    });

    it('en un graó, el nivell de sortida és el del tram d\'abans (el més alt si puja)', () => {
        // Puja fins a 21°; el tram d'abans arriba a 18°: un rang de dilluns que baixa fins a 18° no ho assegura.
        expect(summarizeTrend(days(GIRONA_MAX, GIRONA_MIN, lastDay({ max: { low: 18, high: 25 } })))?.uncertain)
            .toMatchObject({ temp: 'max', day: 6 });
    });

    it('les mínimes també poden ser incertes, si les màximes són segures', () => {
        // Mínimes de 5° a 11° de mica en mica, però el rang de dilluns encara baixa fins a 4°.
        const extra = lastDay({ max: { low: 19.5, high: 26 }, min: { low: 4, high: 14 } });
        expect(summarizeTrend(days(GIRONA_MAX, [5, 6, 7, 8, 9, 10, 11], extra))?.uncertain).toEqual({ temp: 'min', day: 6, low: 4, high: 14 });
    });

    it('"estable", "variable", vall i cim mai no són incerts (no afirmen cap nivell nou), i sense rang no s\'inventa cap incertesa', () => {
        const wide = lastDay({ max: { low: 10, high: 40 }, min: { low: -10, high: 30 } });
        expect(summarizeTrend(days([24, 25, 24, 25, 24, 25, 24], undefined, wide))?.uncertain).toBeNull();
        expect(summarizeTrend(days([30, 34, 27, 33, 28, 31, 26], undefined, wide))?.uncertain).toBeNull();
        expect(summarizeTrend(days([30, 26, 22, 22, 25, 28, 30], undefined, wide))?.uncertain).toBeNull();
        expect(summarizeTrend(days(GIRONA_MAX, GIRONA_MIN, lastDay({ max: { low: 19.5, high: 26 }, min: { low: -10, high: 30 } })))?.uncertain).toBeNull();
        expect(summarizeTrend(days([14.4, 13, 13.4, 10.9, 11.7, 12.4, 9.9]))?.uncertain).toBeNull();
    });
});

describe('summarizeTrend — pluja', () => {
    const precip = (probs: Array<number | null>, sums: Array<number | null>, snows: number[] = []) =>
        summarizeTrend(probs.map((p, i) => ({ max: 20, min: 10, precipProb: p, precipSum: sums[i], snowSum: snows[i] ?? 0 })))?.precip;

    it('els dies amb probabilitat destacada (≥ 20 %) i la quantitat més gran d\'un dia', () => {
        expect(precip([80, 75, 15, 11, 12, 29, 34], [0.3, 1, 0, 0, 0.6, 0, 0.3])).toEqual({
            rainDays: [0, 1, 5, 6], snowDays: [], maxRain: 1, maxSnow: null, dry: false
        });
    });

    it('un dia amb neu va a part, amb els seus cm', () => {
        expect(precip([10, 60, 70, 10], [0, 4, 2, 0], [0, 0, 3.5, 0])).toMatchObject({ rainDays: [1], snowDays: [2], maxRain: 4, maxSnow: 3.5 });
    });

    it('probabilitat alta però cap quantitat: el dia hi és, sense xifra', () => {
        expect(precip([10, 40, 10], [0, 0, 0])).toMatchObject({ rainDays: [1], maxRain: null, dry: false });
    });

    it('"no es preveu pluja" només si cada dia té probabilitat baixa i 0 mm', () => {
        expect(precip([10, 15, 5, 0], [0, 0, 0, 0])?.dry).toBe(true);
        expect(precip([10, 12, 5, 0], [0, 0.6, 0, 0])?.dry).toBe(false);    // 0,6 mm amb un 12 %: el gràfic els mostra
        expect(precip([10, null, 5, 0], [0, 0, 0, 0])?.dry).toBe(false);    // un dia sense dada no es dona per sec
        expect(precip([10, 15, 5, 0], [0, null, 0, 0])?.dry).toBe(false);
    });
});
