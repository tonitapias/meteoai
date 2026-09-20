import { describe, it, expect } from 'vitest';
import { summarizeTrend, type TrendSummaryDay } from './trendSummary';

const days = (maxes: Array<number | null>, ranges: Array<{ low: number; high: number } | null> = []): TrendSummaryDay[] =>
    maxes.map((max, i) => ({ max, maxRange: ranges[i] ?? null }));

describe('summarizeTrend', () => {
    it('un refredament net: de 35° a 25° (la setmana real de Girona)', () => {
        expect(summarizeTrend(days([35, 32, 28, 28, 29, 28, 25]))).toMatchObject({
            kind: 'cooling', from: 35, to: 25, low: 25, high: 35, uncertain: false
        });
    });

    it('un escalfament net', () => {
        expect(summarizeTrend(days([18, 19, 21, 22, 24, 25, 27]))).toMatchObject({ kind: 'warming', from: 18, to: 27 });
    });

    it('el llindar del canvi és de 3° (a 3° ja és canvi, a 2,9° no)', () => {
        expect(summarizeTrend(days([20, 21, 22, 23]))?.kind).toBe('warming');      // +3
        expect(summarizeTrend(days([20, 20.5, 21, 22.9]))?.kind).toBe('stable');   // +2,9
        expect(summarizeTrend(days([23, 22, 21, 20]))?.kind).toBe('cooling');      // -3
    });

    it('sense canvi net entre els extrems però amb una oscil·lació gran és "variable", no "estable"', () => {
        // 30 -> 30, però baixa a 22 pel mig: dir "estable" amagaria un cop de fred.
        expect(summarizeTrend(days([30, 26, 22, 27, 30]))).toMatchObject({ kind: 'variable', low: 22, high: 30 });
    });

    it('temperatures que gairebé no es mouen són "estables"', () => {
        expect(summarizeTrend(days([24, 25, 24, 26, 25, 24, 25]))).toMatchObject({ kind: 'stable', low: 24, high: 26 });
    });

    it('un refredament és incert si el canvi és menys del doble del desacord entre models a l\'últim dia', () => {
        const base = [30, 29, 28, 27];
        // Canvi de -3°; models a l'últim dia 25-30 (5° de rang): 3 < 10 -> incert
        expect(summarizeTrend(days(base, [null, null, null, { low: 25, high: 30 }]))?.uncertain).toBe(true);
        // Mateix canvi però models d'acord (1° de rang): 3 >= 2 -> segur
        expect(summarizeTrend(days(base, [null, null, null, { low: 26.5, high: 27.5 }]))?.uncertain).toBe(false);
        // Sense rang de models no s'inventa cap incertesa
        expect(summarizeTrend(days(base))?.uncertain).toBe(false);
    });

    it('un canvi gran no és incert encara que els models discrepin bastant (35° -> 25° amb 3° de rang)', () => {
        const r = summarizeTrend(days([35, 32, 28, 28, 29, 28, 25], [null, null, null, null, null, null, { low: 25, high: 28 }]));
        expect(r?.uncertain).toBe(false);   // 10 >= 2*3
    });

    it('"estable" i "variable" mai no són incerts (no afirmen cap canvi)', () => {
        const wide = { low: 20, high: 30 };
        expect(summarizeTrend(days([24, 25, 24, 25], [null, null, null, wide]))?.uncertain).toBe(false);
        expect(summarizeTrend(days([30, 26, 22, 30], [null, null, null, wide]))?.uncertain).toBe(false);
    });

    it('els dies sense màxima s\'ignoren, i amb menys de 3 dies amb dada no es diu res', () => {
        expect(summarizeTrend(days([30, null, 27, null, 24]))).toMatchObject({ kind: 'cooling', from: 30, to: 24 });
        expect(summarizeTrend(days([30, null, null, 24]))).toBeNull();
        expect(summarizeTrend(days([]))).toBeNull();
        expect(summarizeTrend(days([null, null, null, null]))).toBeNull();
    });
});
