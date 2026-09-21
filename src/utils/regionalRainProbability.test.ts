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

// El model regional només cobreix els dos primers dies (48 h) i porta `rain` mm a les hores indicades (dia, hora).
const regionalData = (rain: Array<[dayIndex: number, hour: number, mm: number]> = []) => {
    const times = HOURS.slice(0, 48);
    const precipitation = times.map((_, i) => rain.find(([d, h]) => d * 24 + h === i)?.[2] ?? 0);
    return {
        current: { temperature_2m: 23 },
        hourly: { time: times, temperature_2m: times.map(() => 23), precipitation },
    } as unknown as ExtendedWeatherData;
};

const dailyProb = (d: ExtendedWeatherData) => d.daily.precipitation_probability_max;
const hourlyProb = (d: ExtendedWeatherData) => (d.hourly as unknown as Record<string, number[]>).precipitation_probability;

describe('injectHighResModels — el reforç de pluja arriba a la probabilitat diària', () => {
    it('un dia amb hores reforçades puja la probabilitat diària fins al valor del reforç; els altres queden igual', () => {
        // Pluja regional de 1,2 mm el dia 22 (índex 1) a les 15 h.
        const result = injectHighResModels(baseData(), regionalData([[1, 15, 1.2]]), AROME_MODEL);

        expect(hourlyProb(result)[24 + 15]).toBe(70);
        expect(dailyProb(result)).toEqual([10, 70, 10]);
    });

    it("no baixa mai una probabilitat diària que ja era més alta (un 90 % del model global no es toca)", () => {
        const result = injectHighResModels(baseData({ dailyProb: [10, 90, 10] }), regionalData([[1, 15, 1.2]]), AROME_MODEL);
        expect(dailyProb(result)).toEqual([10, 90, 10]);
    });

    it("una probabilitat diària absent (null) i un reforç real donen el valor del reforç, no un 0", () => {
        const result = injectHighResModels(baseData({ dailyProb: [null, null, null] }), regionalData([[0, 9, 0.5]]), AROME_MODEL);
        expect(dailyProb(result)).toEqual([70, null, null]);
    });

    it('sense pluja regional (o sota 0,1 mm) no es toca cap probabilitat', () => {
        const dry = injectHighResModels(baseData(), regionalData(), AROME_MODEL);
        expect(dailyProb(dry)).toEqual([10, 10, 10]);

        const drizzle = injectHighResModels(baseData(), regionalData([[1, 15, 0.05]]), AROME_MODEL);
        expect(dailyProb(drizzle)).toEqual([10, 10, 10]);
    });

    it("l'hora que ja estava a 50 % o més no es reforça i per tant no toca el dia", () => {
        const result = injectHighResModels(baseData({ hourlyProb: 60, dailyProb: [60, 60, 60] }), regionalData([[1, 15, 2]]), AROME_MODEL);
        expect(hourlyProb(result)[24 + 15]).toBe(60);
        expect(dailyProb(result)).toEqual([60, 60, 60]);
    });

    it('els dies fora de l\'abast del model regional no canvien', () => {
        const result = injectHighResModels(baseData(), regionalData([[0, 10, 3], [1, 10, 3]]), AROME_MODEL);
        expect(dailyProb(result)).toEqual([70, 70, 10]);
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
        expect(hourlyProb(result)[24 + 15]).toBe(70);
    });

    it('sense model regional (highResData null) les dades tornen tal com eren', () => {
        const base = baseData();
        expect(injectHighResModels(base, null, AROME_MODEL)).toBe(base);
    });
});
