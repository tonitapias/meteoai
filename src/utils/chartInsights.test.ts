// src/utils/chartInsights.test.ts
import { describe, it, expect } from 'vitest';
import {
    AGREEMENT_THRESHOLDS,
    averageSpread,
    buildChartInsights,
    isSeriesIdentical,
    maxSpread,
    modelsIdenticalToPrimary,
    type ComparisonSeries
} from './chartInsights';
import type { HourlyChartPoint } from './hourlyChartSeries';

const N = 24;
const pt = (i: number, over: Partial<HourlyChartPoint> = {}): HourlyChartPoint => ({
    time: `2026-09-21T${String(i % 24).padStart(2, '0')}:00`,
    temp: null, rain: null, precip: null, wind: null, gusts: null, snowLevel: null, regional: false,
    ...over
});
const series = (f: (i: number) => Partial<HourlyChartPoint>): HourlyChartPoint[] => Array.from({ length: N }, (_, i) => pt(i, f(i)));
const NONE: HourlyChartPoint[] = [];
const cmp = (over: Partial<ComparisonSeries>): ComparisonSeries => ({ ecmwf: NONE, gfs: NONE, icon: NONE, aifs: NONE, ...over });

describe('averageSpread / maxSpread', () => {
    it('la dispersió és max − min entre models, hora a hora, i se\'n fa la mitjana', () => {
        const c = cmp({
            ecmwf: series(() => ({ temp: 10 })),
            gfs: series(i => ({ temp: 10 + (i < 12 ? 2 : 4) })) // dispersió 2° 12 h i 4° 12 h → mitjana 3°
        });
        expect(averageSpread(c, 'temp')).toBeCloseTo(3, 10);
        expect(maxSpread(c, 'temp')).toEqual({ value: 4, index: 12 });
    });

    it('amb menys de dos models NO hi ha comparació (mai un "acord perfecte" fingit)', () => {
        expect(averageSpread(cmp({ gfs: series(() => ({ temp: 10 })) }), 'temp')).toBeNull();
        expect(averageSpread(null, 'temp')).toBeNull();
        expect(maxSpread(cmp({}), 'temp')).toBeNull();
    });

    it('només compten les hores en què hi ha dos models amb dada; amb massa poques hores, null', () => {
        const few = cmp({
            ecmwf: series(i => ({ temp: i < 3 ? 10 : null })),
            gfs: series(i => ({ temp: i < 3 ? 12 : null }))
        });
        expect(averageSpread(few, 'temp')).toBeNull();
        const enough = cmp({
            ecmwf: series(i => ({ temp: i < 8 ? 10 : null })),
            gfs: series(i => ({ temp: i < 8 ? 12 : null }))
        });
        expect(averageSpread(enough, 'temp')).toBeCloseTo(2, 10);
    });

    it('un model sense la magnitud (AIFS sense cota de neu) no fa de segon model', () => {
        const c = cmp({
            gfs: series(() => ({ snowLevel: 1000 })),
            aifs: series(() => ({ temp: 5 }))
        });
        expect(averageSpread(c, 'snowLevel')).toBeNull();
    });
});

describe('buildChartInsights: llindars d\'acord', () => {
    const tempWith = (spread: number) => cmp({ ecmwf: series(() => ({ temp: 10 })), gfs: series(() => ({ temp: 10 + spread })) });

    it.each([
        [0.5, 'high'],
        [AGREEMENT_THRESHOLDS.temp.high, 'high'],
        [2, 'medium'],
        [AGREEMENT_THRESHOLDS.temp.medium, 'medium'],
        [3.5, 'low']
    ])('temperatura: dispersió mitjana de %f° → %s', (spread, expected) => {
        expect(buildChartInsights([], tempWith(spread)).temp.agreement).toBe(expected);
    });

    it.each([[3, 'high'], [6, 'medium'], [9, 'low']])('vent: dispersió mitjana de %f km/h → %s', (spread, expected) => {
        const c = cmp({ ecmwf: series(() => ({ wind: 10 })), gfs: series(() => ({ wind: 10 + spread })) });
        expect(buildChartInsights([], c).wind.agreement).toBe(expected);
    });

    it.each([[50, 'high'], [100, 'medium'], [300, 'low']])('cota de neu: dispersió mitjana de %f m → %s', (spread, expected) => {
        const c = cmp({ gfs: series(() => ({ snowLevel: 1500 })), icon: series(() => ({ snowLevel: 1500 + spread })) });
        expect(buildChartInsights([], c).snowLevel.agreement).toBe(expected);
    });

    it('sense models de comparació, cap acord és null (no "alt" ni "mitjà" inventat)', () => {
        const i = buildChartInsights(series(() => ({ temp: 10, wind: 5, precip: 0 })), null);
        expect(i.temp.agreement).toBeNull();
        expect(i.wind.agreement).toBeNull();
        expect(i.rain.agreement).toBeNull();
        expect(i.snowLevel.agreement).toBeNull();
    });
});

describe('buildChartInsights: temperatura i vent de la línia principal', () => {
    it('màxima i mínima amb la seva posició (la primera si n\'hi ha d\'empatades); els forats s\'ignoren', () => {
        const primary = series(i => ({ temp: i === 5 ? null : 20 + Math.sin(i / 3) * 5 }));
        const t = buildChartInsights(primary, null).temp;
        expect(t.high?.value).toBeCloseTo(Math.max(...primary.map(p => p.temp ?? -Infinity)), 10);
        expect(t.low?.value).toBeCloseTo(Math.min(...primary.map(p => p.temp ?? Infinity)), 10);
        expect(primary[t.high!.index].temp).toBe(t.high!.value);
    });

    it('sense cap temperatura, res a resumir: null', () => {
        const t = buildChartInsights(series(() => ({})), null).temp;
        expect(t.high).toBeNull();
        expect(t.low).toBeNull();
    });

    it('ràfega i vent màxims; les ràfegues absents són null, no 0', () => {
        const withGusts = buildChartInsights(series(i => ({ wind: 8 + (i === 7 ? 6 : 0), gusts: 15 + (i === 9 ? 20 : 0) })), null).wind;
        expect(withGusts.maxGust).toEqual({ value: 35, index: 9 });
        expect(withGusts.maxWind).toEqual({ value: 14, index: 7 });
        const noGusts = buildChartInsights(series(() => ({ wind: 8 })), null).wind;
        expect(noGusts.maxGust).toBeNull();
    });
});

describe('buildChartInsights: pluja', () => {
    const rainSeries = (mm: Record<number, number>) => series(i => ({ precip: mm[i] ?? 0 }));

    it('total i inici de pluja de la línia principal', () => {
        const r = buildChartInsights(rainSeries({ 8: 0.1, 9: 0.4, 10: 1.2 }), null).rain;
        expect(r.total).toBeCloseTo(1.7, 10);
        expect(r.firstRain).toBe(8);
    });

    it('rang dels totals i de l\'inici entre models, i quants en preveuen', () => {
        const c = cmp({
            ecmwf: rainSeries({ 9: 0.1, 10: 0.6 }),   // 0,7 mm, comença a 9
            gfs: rainSeries({ 7: 0.3, 8: 1.1, 9: 2.6, 10: 3.2 }), // 7,2 mm, comença a 7
            icon: rainSeries({}),                     // sec
            aifs: rainSeries({ 12: 0.05 })            // 0,05 mm (< 0,2: no "té pluja") i no arriba a 0,1 mm/h
        });
        const r = buildChartInsights(rainSeries({ 8: 0.5 }), c).rain;
        expect(r.modelTotals?.min).toBeCloseTo(0, 10);
        expect(r.modelTotals?.max).toBeCloseTo(7.2, 10);
        expect(r.modelFirstRain).toEqual({ first: 7, last: 9 });
        expect(r.modelsCompared).toBe(4);
        expect(r.modelsWithRain).toBe(2);
        // Rang de 7,2 mm → per sobre de 3 mm i per sota de 10 mm: mitjà (mateix criteri que reliabilityRules).
        expect(r.agreement).toBe('medium');
    });

    it.each([[2, 'high'], [3, 'high'], [5, 'medium'], [12, 'low']])('rang de totals de %f mm → %s', (range, expected) => {
        const c = cmp({ ecmwf: rainSeries({}), gfs: rainSeries({ 10: range }) });
        expect(buildChartInsights([], c).rain.agreement).toBe(expected);
    });

    it('un model amb un total INCOMPLET (hores sense dada) no entra a la comparació', () => {
        const partial = series(i => ({ precip: i < 5 ? 1 : null }));
        const c = cmp({ ecmwf: partial, gfs: rainSeries({ 10: 4 }), icon: rainSeries({ 10: 4.5 }) });
        const r = buildChartInsights([], c).rain;
        expect(r.modelsCompared).toBe(2);
        expect(r.modelTotals).toEqual({ min: 4, max: 4.5 });
    });

    it('un total de la principal amb forats és null (no un total parcial fingit)', () => {
        expect(buildChartInsights(series(i => ({ precip: i === 3 ? null : 1 })), null).rain.total).toBeNull();
    });

    it('amb un sol model complet no hi ha acord de pluja (res a comparar)', () => {
        const r = buildChartInsights([], cmp({ gfs: rainSeries({ 10: 4 }) })).rain;
        expect(r.agreement).toBeNull();
        expect(r.modelsCompared).toBe(1);
    });
});

describe('models idèntics a la línia principal (best_match = ICON al sud d\'Europa)', () => {
    const primary = series(i => ({ temp: 10 + i / 4 }));

    it('detecta la sèrie que coincideix hora a hora i la deixa fora del dibuix', () => {
        const c = cmp({ icon: series(i => ({ temp: 10 + i / 4 })), gfs: series(i => ({ temp: 11 + i / 4 })) });
        expect(isSeriesIdentical(primary, c.icon)).toBe(true);
        expect(isSeriesIdentical(primary, c.gfs)).toBe(false);
        expect(modelsIdenticalToPrimary(primary, c)).toEqual(['icon']);
    });

    it('una sola hora diferent ja la fa distinta', () => {
        const almost = series(i => ({ temp: 10 + i / 4 + (i === 17 ? 0.5 : 0) }));
        expect(isSeriesIdentical(primary, almost)).toBe(false);
    });

    it('sense prou hores comparables, mai s\'assumeix idèntica', () => {
        const sparse = series(i => ({ temp: i < 3 ? 10 + i / 4 : null }));
        expect(isSeriesIdentical(primary, sparse)).toBe(false);
        expect(isSeriesIdentical(primary, NONE)).toBe(false);
        expect(modelsIdenticalToPrimary(primary, null)).toEqual([]);
    });

    it('un model idèntic SEGUEIX comptant a l\'acord (només s\'estalvia el dibuix)', () => {
        const c = cmp({ icon: series(i => ({ temp: 10 + i / 4 })), gfs: series(i => ({ temp: 14 + i / 4 })) });
        expect(buildChartInsights(primary, c).temp.agreement).toBe('low');
    });
});
