// src/utils/engineSnowfall.test.ts
import { describe, it, expect } from 'vitest';
import { injectEngineSnowfall, snowfallCmForHour, SNOW_CM_PER_MM, SLEET_SNOW_FRACTION } from './engineSnowfall';
import { getHourlyWeatherCode, type HourlySeries } from './hourlyWeatherCode';
import type { ExtendedWeatherData } from '../types/weatherLogicTypes';

const ELEVATION = 100;
type Hour = { t: number | null; code: number; mm: number | null; fl: number; modelCm: number };

// Tres tipus d'hora, amb 1 mm de pluja cadascuna:
const SNOW: Hour = { t: -2, code: 73, mm: 1, fl: 0, modelCm: 0 };            // freda: neu (el model global no n'hi posa)
const SLEET: Hour = { t: 2, code: 61, mm: 1, fl: ELEVATION + 100, modelCm: 0 }; // isoterma 0 °C just per sobre: aiguaneu
const RAIN: Hour = { t: 10, code: 61, mm: 1, fl: 2500, modelCm: 3 };          // 10 °C: pluja (el model global hi deia 3 cm)

const build = (day1: Hour[], day2: Hour[], dailySnow: Array<number | null> = [9, 9]): ExtendedWeatherData => {
    const hours = [...day1, ...day2];
    const time = [
        ...day1.map((_, h) => `2026-01-15T${String(h).padStart(2, '0')}:00`),
        ...day2.map((_, h) => `2026-01-16T${String(h).padStart(2, '0')}:00`)
    ];
    return {
        elevation: ELEVATION,
        hourly: {
            time,
            temperature_2m: hours.map(h => h.t),
            weather_code: hours.map(h => h.code),
            precipitation: hours.map(h => h.mm),
            freezing_level_height: hours.map(h => h.fl),
            relative_humidity_2m: hours.map(() => 90),
            cloud_cover_low: hours.map(() => 100),
            cloud_cover_mid: hours.map(() => 50),
            cloud_cover_high: hours.map(() => 0),
            snowfall: hours.map(h => h.modelCm)
        },
        daily: { time: ['2026-01-15', '2026-01-16'], snowfall_sum: dailySnow }
    } as unknown as ExtendedWeatherData;
};

const fullDay = (pattern: (h: number) => Hour) => Array.from({ length: 24 }, (_, h) => pattern(h));
const snowfallOf = (d: ExtendedWeatherData) => (d.hourly as unknown as Record<string, Array<number | null>>).snowfall;

describe('snowfallCmForHour', () => {
    it('neu: la pluja × 0,7; aiguaneu: la meitat; pluja i pluja engelant: 0', () => {
        expect(snowfallCmForHour(73, 2)).toBeCloseTo(2 * SNOW_CM_PER_MM, 5);
        expect(snowfallCmForHour(86, 1)).toBeCloseTo(SNOW_CM_PER_MM, 5);
        expect(snowfallCmForHour(69, 2)).toBeCloseTo(2 * SNOW_CM_PER_MM * SLEET_SNOW_FRACTION, 5);
        expect(snowfallCmForHour(63, 2)).toBe(0);
        expect(snowfallCmForHour(67, 2)).toBe(0);
    });

    it('sense codi o sense pluja: null, mai un 0 fals', () => {
        expect(snowfallCmForHour(null, 2)).toBeNull();
        expect(snowfallCmForHour(73, null)).toBeNull();
    });
});

describe('injectEngineSnowfall', () => {
    it('cada hora porta la neu del mateix codi que la seva icona', () => {
        const data = build(fullDay(h => (h < 8 ? SNOW : h < 16 ? SLEET : RAIN)), []);
        const result = injectEngineSnowfall(data);
        const hourly = result.hourly as unknown as HourlySeries;
        snowfallOf(result).forEach((cm, i) => {
            const code = getHourlyWeatherCode(hourly, i, ELEVATION);
            expect(cm).toBeCloseTo(snowfallCmForHour(code, 1) as number, 5);
        });
        expect(snowfallOf(result)[0]).toBeCloseTo(0.7, 5);   // neu
        expect(snowfallOf(result)[10]).toBeCloseTo(0.35, 5); // aiguaneu
        expect(snowfallOf(result)[20]).toBe(0);              // pluja: fora els 3 cm del model global
    });

    it('el total del dia és la suma de les hores, arrodonida al dècim', () => {
        const result = injectEngineSnowfall(build(fullDay(h => (h < 8 ? SNOW : h < 16 ? SLEET : RAIN)), []));
        expect(result.daily.snowfall_sum?.[0]).toBe(Math.round((8 * 0.7 + 8 * 0.35) * 10) / 10); // 8,4 cm
    });

    it('un dia de pluja on el model global posava neu passa a 0 cm (la xifra ja no contradiu la icona)', () => {
        const result = injectEngineSnowfall(build(fullDay(() => RAIN), [], [5, null]));
        expect(result.daily.snowfall_sum?.[0]).toBe(0);
    });

    it('un dia incomplet (menys de 23 hores) conserva el total del model', () => {
        const result = injectEngineSnowfall(build(fullDay(() => SNOW), [SNOW, SNOW, SNOW], [9, 4.2]));
        expect(result.daily.snowfall_sum?.[1]).toBe(4.2);
    });

    it('una hora sense temperatura real (sense codi) conserva la dada del model i el dia no se substitueix', () => {
        const day = fullDay(() => SNOW);
        day[5] = { ...SNOW, t: null, modelCm: 1.4 };
        const result = injectEngineSnowfall(build(day, [], [9, null]));
        expect(snowfallOf(result)[5]).toBe(1.4);
        expect(result.daily.snowfall_sum?.[0]).toBe(9);
    });

    it('no muta les dades d\'entrada', () => {
        const data = build(fullDay(() => RAIN), []);
        const before = JSON.stringify(data);
        injectEngineSnowfall(data);
        expect(JSON.stringify(data)).toBe(before);
    });

    it('sense sèrie horària no fa res', () => {
        const data = { daily: { time: [] } } as unknown as ExtendedWeatherData;
        expect(injectEngineSnowfall(data)).toBe(data);
    });
});
