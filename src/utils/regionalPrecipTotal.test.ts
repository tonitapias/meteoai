import { describe, it, expect } from 'vitest';
import { injectHighResModels } from './regionalModelEngine';
import { REGIONAL_MODELS } from '../constants/regionalModels';
import type { ExtendedWeatherData } from '../types/weatherLogicTypes';

const AROME_MODEL = REGIONAL_MODELS.find(m => m.id === 'AROME_HD')!;

// 3 dies (21, 22 i 23 de setembre), 72 hores. El model global: 0,2 mm cada hora del dia 22 (4,8 mm), la resta sec.
const DATES = ['2026-09-21', '2026-09-22', '2026-09-23'];
const HOURS = DATES.flatMap(d => Array.from({ length: 24 }, (_, h) => `${d}T${String(h).padStart(2, '0')}:00`));
const globalPrecip = (i: number): number | null => (Math.floor(i / 24) === 1 ? 0.2 : 0);

const baseData = (opts: { hourlyPrecip?: Array<number | null>; dailyTotals?: Array<number | null> | null; extraHours?: number } = {}) => {
    const { hourlyPrecip = HOURS.map((_, i) => globalPrecip(i)), dailyTotals = [3, 4.8, 0] } = opts;
    return {
        current: { temperature_2m: 20, is_day: 1, time: HOURS[0] },
        hourly: { time: [...HOURS], temperature_2m: HOURS.map(() => 20), precipitation: hourlyPrecip },
        daily: { time: [...DATES], ...(dailyTotals ? { precipitation_sum: dailyTotals } : {}) },
    } as unknown as ExtendedWeatherData;
};

// El model regional cobreix les primeres `covered` hores i porta la pluja que digui `precip(i)`; `precip` null = sense el camp.
const regionalData = (covered: number, precip: ((i: number) => number | null) | null) => {
    const times = HOURS.slice(0, covered);
    return {
        current: { temperature_2m: 23 },
        hourly: { time: times, temperature_2m: times.map(() => 23), ...(precip ? { precipitation: times.map((_, i) => precip(i)) } : {}) },
    } as unknown as ExtendedWeatherData;
};

const totals = (d: ExtendedWeatherData) => d.daily.precipitation_sum;

describe('injectHighResModels — el total diari és la suma de les hores', () => {
    it('un dia tot cobert pel model regional té com a total la suma de les seves hores (no el valor diari global)', () => {
        // Dia 21 (índex 0): el regional porta 0,5 mm a tres hores = 1,5 mm; el diari global deia 3 mm.
        const result = injectHighResModels(baseData(), regionalData(48, i => (i === 5 || i === 6 || i === 7 ? 0.5 : 0)), AROME_MODEL);
        expect(totals(result)![0]).toBe(1.5);
    });

    it('un dia a cavall (unes hores regionals i la resta globals) suma les hores que la taula mostra', () => {
        // El regional cobreix fins a les 05 h del dia 22 (30 hores): hores 24..29 regionals (0 mm) + 18 hores globals de 0,2 mm.
        const result = injectHighResModels(baseData(), regionalData(30, () => 0), AROME_MODEL);
        expect(totals(result)![1]).toBe(3.6);
    });

    it('un dia que el model regional no toca queda amb el valor diari', () => {
        const result = injectHighResModels(baseData(), regionalData(30, () => 0), AROME_MODEL);
        expect(totals(result)![2]).toBe(0);
    });

    it('sense pluja escrita pel model regional (camp absent) no es toca cap total', () => {
        const result = injectHighResModels(baseData(), regionalData(48, null), AROME_MODEL);
        expect(totals(result)).toEqual([3, 4.8, 0]);
    });

    it('un dia amb alguna hora sense dada de pluja no es fa passar per complet: queda el valor diari', () => {
        const hourlyPrecip = HOURS.map((_, i) => (i === 10 ? null : globalPrecip(i)));       // forat global a les 10 h del dia 21
        const result = injectHighResModels(baseData({ hourlyPrecip }), regionalData(48, i => (i === 10 ? null : 0.1)), AROME_MODEL);
        expect(totals(result)![0]).toBe(3);
        // El dia 22 sí que és complet: 24 hores de 0,1 mm regionals = 2,4 mm.
        expect(totals(result)![1]).toBe(2.4);
    });

    it('una sèrie horària truncada (menys de 23 hores del dia) no dona total', () => {
        const short = 24 + 12;                                                                // el dia 22 només té 12 hores
        const base = {
            current: { temperature_2m: 20, is_day: 1, time: HOURS[0] },
            hourly: { time: HOURS.slice(0, short), temperature_2m: HOURS.slice(0, short).map(() => 20), precipitation: HOURS.slice(0, short).map(() => 0.2) },
            daily: { time: [DATES[0], DATES[1]], precipitation_sum: [4.8, 2.4] },
        } as unknown as ExtendedWeatherData;
        const result = injectHighResModels(base, regionalData(short, () => 0.5), AROME_MODEL);
        expect(totals(result)![1]).toBe(2.4);
        expect(totals(result)![0]).toBe(12);
    });

    it('el total es dona a 0,1 mm (sense arrossegar decimals de coma flotant)', () => {
        const result = injectHighResModels(baseData(), regionalData(24, i => (i < 3 ? 0.1 : 0)), AROME_MODEL);
        expect(totals(result)![0]).toBe(0.3);
    });

    it('sense total diari a les dades base es pot calcular per als dies coberts i la resta queda null', () => {
        const result = injectHighResModels(baseData({ dailyTotals: null }), regionalData(24, i => (i === 0 ? 1 : 0)), AROME_MODEL);
        expect(totals(result)).toEqual([1, null, null]);
    });

    it('no muta les dades base', () => {
        const base = baseData();
        const before = [...(totals(base) as number[])];
        const result = injectHighResModels(base, regionalData(48, () => 0.3), AROME_MODEL);
        expect(totals(base)).toEqual(before);
        expect(result.daily).not.toBe(base.daily);
    });

    it('sense previsió diària a les dades base no peta', () => {
        const base = { ...baseData(), daily: undefined } as unknown as ExtendedWeatherData;
        const result = injectHighResModels(base, regionalData(48, () => 0.3), AROME_MODEL);
        expect(result.daily).toBeUndefined();
    });
});
