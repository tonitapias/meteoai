import { describe, it, expect } from 'vitest';
import { injectHighResModels } from './regionalModelEngine';
import { REGIONAL_MODELS } from '../constants/regionalModels';
import type { ExtendedWeatherData } from '../types/weatherLogicTypes';

const AROME_MODEL = REGIONAL_MODELS.find(m => m.id === 'AROME_HD')!;

// 3 dies (21, 22 i 23 de setembre), 72 hores. El model global diu pluja poc probable (10 %) tot el temps.
const DATES = ['2026-09-21', '2026-09-22', '2026-09-23'];
const HOURS = DATES.flatMap(d => Array.from({ length: 24 }, (_, h) => `${d}T${String(h).padStart(2, '0')}:00`));

const baseData = (opts: { dailyProb?: Array<number | null> | undefined; hourlyProb?: number | null; noDaily?: boolean } = {}) => {
    const { dailyProb = [10, 10, 10], hourlyProb = 10, noDaily = false } = opts;
    return {
        current: { temperature_2m: 20, is_day: 1, time: HOURS[0] },
        hourly: {
            time: [...HOURS],
            temperature_2m: HOURS.map(() => 20),
            precipitation_probability: HOURS.map(() => hourlyProb),
        },
        ...(noDaily ? {} : { daily: { time: [...DATES], precipitation_probability_max: dailyProb } }),
    } as unknown as ExtendedWeatherData;
};

// El model regional només cobreix els dos primers dies (48 h) i porta `mm` a les hores indicades (dia, hora).
// `hours` permet una sèrie amb forats (hores absents).
const regionalData = (rain: Array<[dayIndex: number, hour: number, mm: number]> = [], hours: number[] = Array.from({ length: 48 }, (_, i) => i)) => {
    const times = hours.map(i => HOURS[i]);
    const precipitation = hours.map(i => rain.find(([d, h]) => d * 24 + h === i)?.[2] ?? 0);
    return {
        current: { temperature_2m: 23 },
        hourly: { time: times, temperature_2m: times.map(() => 23), precipitation },
    } as unknown as ExtendedWeatherData;
};

const dailyProb = (d: ExtendedWeatherData) => d.daily.precipitation_probability_max;
const hourlyProb = (d: ExtendedWeatherData) => (d.hourly as unknown as Record<string, number[]>).precipitation_probability;

describe('injectHighResModels — la pluja regional és evidència, no una probabilitat', () => {
    it('una hora amb pluja regional puja fins a la freqüència observada (PoP 10 % -> 20 %), no a 70 %', () => {
        const result = injectHighResModels(baseData(), regionalData([[1, 15, 1.2]]), AROME_MODEL);
        expect(hourlyProb(result)[24 + 15]).toBe(20);
    });

    it("l'evidència s'estén ±1 hora (errors de fase d'una hora), però no més enllà", () => {
        const result = injectHighResModels(baseData(), regionalData([[1, 15, 1.2]]), AROME_MODEL);
        const p = hourlyProb(result);
        expect([p[24 + 14], p[24 + 15], p[24 + 16]]).toEqual([20, 20, 20]);
        expect([p[24 + 13], p[24 + 17]]).toEqual([10, 10]);
    });

    it("l'evidència no travessa un forat de la sèrie regional (una veïna que no és l'hora següent no compta)", () => {
        // El regional té les hores 10 i 12 del dia 1 però no l'11: la pluja a les 12 no és evidència per a les 10.
        const hours = [24 + 9, 24 + 10, 24 + 12, 24 + 13];
        const result = injectHighResModels(baseData(), regionalData([[1, 12, 2]], hours), AROME_MODEL);
        const p = hourlyProb(result);
        expect(p[24 + 12]).toBe(20);
        expect(p[24 + 13]).toBe(20);
        expect(p[24 + 10]).toBe(10);
        expect(p[24 + 9]).toBe(10);
    });

    it('una probabilitat global de 0 % puja al 10 % observat, no més', () => {
        const result = injectHighResModels(baseData({ hourlyProb: 0, dailyProb: [0, 0, 0] }), regionalData([[1, 15, 1.2]]), AROME_MODEL);
        expect(hourlyProb(result)[24 + 15]).toBe(10);
        expect(dailyProb(result)).toEqual([0, 10, 0]);
    });

    it('una hora que la global ja porta al 34 % o més no es toca', () => {
        for (const global of [34, 60, 90]) {
            const result = injectHighResModels(baseData({ hourlyProb: global, dailyProb: [global, global, global] }), regionalData([[1, 15, 2]]), AROME_MODEL);
            expect(hourlyProb(result)[24 + 15]).toBe(global);
            expect(dailyProb(result)).toEqual([global, global, global]);
        }
    });

    it('el dia puja fins a la hora més alta escrita i els altres dies queden igual', () => {
        const result = injectHighResModels(baseData(), regionalData([[1, 15, 1.2]]), AROME_MODEL);
        expect(dailyProb(result)).toEqual([10, 20, 10]);
    });

    it('no baixa mai una probabilitat diària que ja era més alta (un 90 % del model global no es toca)', () => {
        const result = injectHighResModels(baseData({ dailyProb: [10, 90, 10] }), regionalData([[1, 15, 1.2]]), AROME_MODEL);
        expect(dailyProb(result)).toEqual([10, 90, 10]);
    });

    it('una probabilitat diària absent (null) i evidència real donen el valor de l\'evidència, no un 0', () => {
        const result = injectHighResModels(baseData({ dailyProb: [null, null, null] }), regionalData([[0, 9, 0.5]]), AROME_MODEL);
        expect(dailyProb(result)).toEqual([20, null, null]);
    });

    it('sense pluja regional (o sota 0,1 mm) no es toca cap probabilitat', () => {
        const dry = injectHighResModels(baseData(), regionalData(), AROME_MODEL);
        expect(dailyProb(dry)).toEqual([10, 10, 10]);
        expect(hourlyProb(dry).every(v => v === 10)).toBe(true);

        const drizzle = injectHighResModels(baseData(), regionalData([[1, 15, 0.05]]), AROME_MODEL);
        expect(dailyProb(drizzle)).toEqual([10, 10, 10]);
    });

    it("els dies fora de l'abast del model regional no canvien", () => {
        const result = injectHighResModels(baseData(), regionalData([[0, 10, 3], [1, 10, 3]]), AROME_MODEL);
        expect(dailyProb(result)).toEqual([20, 20, 10]);
    });

    it('no muta les dades base (la probabilitat diària original queda intacta)', () => {
        const base = baseData();
        const before = [...(dailyProb(base) as number[])];
        const result = injectHighResModels(base, regionalData([[1, 15, 1.2]]), AROME_MODEL);

        expect(dailyProb(base)).toEqual(before);
        expect(result.daily).not.toBe(base.daily);
    });

    it('sense previsió diària a les dades base no peta i no n\'inventa cap', () => {
        const result = injectHighResModels(baseData({ noDaily: true }), regionalData([[1, 15, 1.2]]), AROME_MODEL);
        expect(result.daily).toBeUndefined();
        expect(hourlyProb(result)[24 + 15]).toBe(20);
    });

    it('sense model regional (highResData null) les dades tornen tal com eren', () => {
        const base = baseData();
        expect(injectHighResModels(base, null, AROME_MODEL)).toBe(base);
    });
});
