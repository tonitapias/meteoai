// src/hooks/useCurrentWeatherLogic.test.ts
import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useCurrentWeatherLogic } from './useCurrentWeatherLogic';
import type { ExtendedWeatherData } from '../types/weatherLogicTypes';

// Un dia sencer d'hores (00-23 h) d'avui més una hora de demà, amb la temperatura "regional" més alta que el diari global.
const hours = Array.from({ length: 25 }, (_, h) => (h < 24 ? `2026-09-26T${String(h).padStart(2, '0')}:00` : '2026-09-27T00:00'));
const temps = hours.map((_, h) => (h < 24 ? 18 + 12 * Math.sin(Math.PI * Math.max(0, h - 6) / 16) : 10));

const makeData = (withHours: boolean): ExtendedWeatherData => ({
    current: {
        time: '2026-09-26T14:15', temperature_2m: 29.5, apparent_temperature: 30, weather_code: 0,
        relative_humidity_2m: 40, wind_speed_10m: 10, is_day: 1, cloud_cover: 0
    },
    daily: {
        time: ['2026-09-26', '2026-09-27'],
        // Diari del model global: més fresc que les hores (com a Girona el 26-09-2026: 27,8° contra 30,8°).
        temperature_2m_max: [27.8, 26.8],
        temperature_2m_min: [14.7, 16.2]
    },
    hourly: withHours
        ? {
            time: hours,
            temperature_2m: temps,
            wind_speed_10m: hours.map(() => 10),
            cloud_cover_low: hours.map(() => 0),
            cloud_cover_mid: hours.map(() => 0),
            cloud_cover_high: hours.map(() => 0),
            is_day: hours.map((_, h) => (h >= 7 && h <= 19 ? 1 : 0))
        }
        : { time: [] },
    location: { name: 'Girona', country: 'ES', latitude: 41.98, longitude: 2.82 }
} as unknown as ExtendedWeatherData);

describe('useCurrentWeatherLogic — màxima i mínima d\'avui', () => {
    it('surten de les hores d\'avui (com el detall "Avui" i la llista), no del diari global en brut', () => {
        const { result } = renderHook(() => useCurrentWeatherLogic({ data: makeData(true), unit: 'C', lang: 'ca', effectiveCode: 0 }));
        const todayTemps = temps.slice(0, 24);
        expect(result.current?.temps.max).toBe(Math.round(Math.max(...todayTemps)));
        expect(result.current?.temps.min).toBe(Math.round(Math.min(...todayTemps)));
    });

    it('la màxima mai no queda per sota de la temperatura d\'ara quan totes dues surten de la mateixa sèrie', () => {
        const { result } = renderHook(() => useCurrentWeatherLogic({ data: makeData(true), unit: 'C', lang: 'ca', effectiveCode: 0 }));
        expect(Number(result.current?.temps.max)).toBeGreaterThanOrEqual(Number(result.current?.temps.main));
    });

    it('sense hores d\'avui, queda el valor diari del model', () => {
        const { result } = renderHook(() => useCurrentWeatherLogic({ data: makeData(false), unit: 'C', lang: 'ca', effectiveCode: 0 }));
        expect(result.current?.temps.max).toBe(28);
        expect(result.current?.temps.min).toBe(15);
    });
});
