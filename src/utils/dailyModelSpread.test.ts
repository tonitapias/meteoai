import { describe, it, expect } from 'vitest';
import { resolveDailySpread } from './dailyModelSpread';
import type { ExtendedWeatherData, StrictDailyWeather } from '../types/weatherLogicTypes';

type Comparison = NonNullable<ExtendedWeatherData['dailyComparison']>;

const daily = (max: Array<number | null>, min: Array<number | null>, precip: Array<number | null> = max.map(() => 0)) =>
    ({ time: max.map((_, i) => `2026-09-${20 + i}`), temperature_2m_max: max, temperature_2m_min: min, precipitation_sum: precip }) as unknown as StrictDailyWeather;

const model = (max: Array<number | null>, min: Array<number | null>, precip: Array<number | null> = max.map(() => 0)) =>
    ({ temperature_2m_max: max, temperature_2m_min: min, precipitation_sum: precip });

// Setmana de Girona del 20/09/2026 (dades reals d'Open-Meteo): dia 4 = dijous.
const GIRONA_DAILY = daily([29.5, 32, 30.6, 28.1, 27.6, 25.5, 28.5, 27.2], [14.6, 15.2, 15.8, 13.6, 14.1, 16.7, 12.8, 12.7]);
const GIRONA_CMP: Comparison = {
    ecmwf: model([29.6, 32.2, 29.1, 28.4, 31.3, 28.2, 28.2, 27], [13.9, 14.8, 18.6, 14.6, 14.3, 18, 17.5, 16.6]),
    gfs: model([30.5, 33.5, 29.9, 30, 31.3, 29.7, 28.1, 25], [17.8, 20.1, 20.4, 19, 18.6, 19.7, 17.7, 18.3]),
    icon: model([29.5, 32, 30.6, 28.1, 27.6, 25.5, 28.5, null], [14.6, 15.2, 15.8, 13.6, 14.1, 16.7, 12.8, null]),
};

describe('resolveDailySpread — rang entre models', () => {
    it('el rang de la màxima i de la mínima abasta tots els models amb dada d\'aquell dia', () => {
        // Dijous (índex 4): ICON/best 27,6 contra ECMWF/GFS 31,3
        const s = resolveDailySpread(4, 27.6, 14.1, GIRONA_DAILY, GIRONA_CMP);
        expect(s.maxRange).toEqual({ low: 27.6, high: 31.3 });
        expect(s.minRange).toEqual({ low: 14.1, high: 18.6 });
    });

    it('un model sense dada aquell dia (ICON més enllà de ~7,5 dies) no hi compta ni el trenca', () => {
        const s = resolveDailySpread(7, 27.2, 12.7, GIRONA_DAILY, GIRONA_CMP);
        expect(s.maxRange).toEqual({ low: 25, high: 27.2 });
        expect(s.minRange).toEqual({ low: 12.7, high: 18.3 });
    });

    it('el valor mostrat (p. ex. d\'un model regional que no és a la comparació) sempre queda dins el rang', () => {
        // Dilluns (índex 1): AROME HD 35°/19,4° per sobre dels globals (32-33,5° / 14,8-20,1°)
        const s = resolveDailySpread(1, 35, 19.4, GIRONA_DAILY, GIRONA_CMP);
        expect(s.maxRange).toEqual({ low: 32, high: 35 });
        expect(s.minRange).toEqual({ low: 14.8, high: 20.1 });
    });

    it('sense cap model per comparar (o un de sol), no hi ha rang: no s\'inventa una dispersió', () => {
        expect(resolveDailySpread(1, 30, 15, null, null)).toMatchObject({ maxRange: null, minRange: null });
        expect(resolveDailySpread(1, 32, 15.2, GIRONA_DAILY, null)).toMatchObject({ maxRange: null, minRange: null });
        expect(resolveDailySpread(1, null, null, daily([null, null], [null, null]), null)).toMatchObject({ maxRange: null, minRange: null });
    });

    it('els valors absents (null) s\'ignoren, mai no compten com a 0', () => {
        const s = resolveDailySpread(1, null, null, daily([20, 25], [10, 12]), { ecmwf: model([20, null], [10, null]), gfs: model([20, 26], [10, 13]), icon: {} });
        expect(s.maxRange).toEqual({ low: 25, high: 26 });
        expect(s.minRange).toEqual({ low: 12, high: 13 });
    });
});

describe('resolveDailySpread — fiabilitat', () => {
    const cmp = (delta: number): Comparison => ({
        ecmwf: model([20 + delta], [10]), gfs: model([20], [10]), icon: model([20], [10]),
    });

    it('models que coincideixen: alta; discrepància moderada: mitjana; gran: baixa', () => {
        const d = daily([20], [10]);
        expect(resolveDailySpread(0, 20, 10, d, cmp(1)).reliability).toBe('high');
        expect(resolveDailySpread(0, 20, 10, d, cmp(3)).reliability).toBe('medium');
        expect(resolveDailySpread(0, 20, 10, d, cmp(6)).reliability).toBe('low');
    });

    it('sense comparació de models no hi ha fiabilitat (null), no un "mitjana" fingit', () => {
        expect(resolveDailySpread(0, 20, 10, daily([20], [10]), null).reliability).toBeNull();
        expect(resolveDailySpread(0, 20, 10, null, cmp(1)).reliability).toBeNull();
    });

    it("la setmana real de Girona: el desacord de la mínima també compta (GFS 4-5° més càlid de nit)", () => {
        const level = (i: number) => resolveDailySpread(i, null, null, GIRONA_DAILY, GIRONA_CMP).reliability;
        // Dilluns: màxima d'acord (32 / 32,2 / 33,5 -> 1,5°) però mínima 14,8 / 15,2 / 20,1 -> 5,3°. Abans sortia "alta"
        // perquè només es mirava la màxima; a l'aeroport de Girona l'error mitjà de la mínima és de 2,3 °C.
        expect(level(1)).toBe('medium');
        // Dijous: màxima 27,6 / 31,3 (3,7°) i mínima 14,1 / 18,6 (4,5°).
        expect(level(4)).toBe('medium');
        // Dia 6: màxima quasi idèntica (0,4°) però mínima 12,8 / 17,7 (4,9°).
        expect(level(6)).toBe('medium');
    });

    it('un dia en què màxima i mínima coincideixen entre els models és de fiabilitat alta', () => {
        const d = daily([25], [12]);
        const cmp: Comparison = { ecmwf: model([25.3], [12.4]), gfs: model([24.8], [11.9]), icon: model([25], [12.2]) };
        expect(resolveDailySpread(0, 25, 12, d, cmp).reliability).toBe('high');
    });
});
