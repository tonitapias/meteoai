// src/hooks/useWeatherCalculations.test.ts
import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useWeatherCalculations } from './useWeatherCalculations';
import type { ExtendedWeatherData } from '../types/weatherLogicTypes';

// Mock simple de dades per a proves
const mockWeatherData = {
    latitude: 41.38,
    longitude: 2.17,
    generationtime_ms: 0,
    utc_offset_seconds: 3600, // UTC+1
    timezone: 'Europe/Madrid',
    timezone_abbreviation: 'CET',
    elevation: 10,
    current: {
        time: '2023-10-10T12:00',
        temperature_2m: 20,
        relative_humidity_2m: 50,
        apparent_temperature: 21,
        is_day: 1,
        precipitation: 0,
        weather_code: 1, // Sol
        cloud_cover: 10,
        pressure_msl: 1013,
        surface_pressure: 1013,
        wind_speed_10m: 10,
        wind_direction_10m: 180,
        wind_gusts_10m: 15
    },
    hourly: {
        time: ['2023-10-10T12:00', '2023-10-10T13:00'],
        temperature_2m: [20, 21],
        relative_humidity_2m: [50, 45],
        apparent_temperature: [21, 22],
        precipitation_probability: [0, 10],
        precipitation: [0, 0],
        weather_code: [1, 2],
        pressure_msl: 1013,
        surface_pressure: [1013, 1012],
        cloud_cover: [10, 20],
        wind_speed_10m: [10, 12],
        wind_direction_10m: [180, 190],
        wind_gusts_10m: [15, 18],
        dew_point_2m: [10, 10]
    },
    daily: {
        time: ['2023-10-10'],
        weather_code: [1],
        temperature_2m_max: [25],
        temperature_2m_min: [15],
        apparent_temperature_max: [26],
        apparent_temperature_min: [16],
        sunrise: ['2023-10-10T07:00'],
        sunset: ['2023-10-10T19:00'],
        uv_index_max: [5],
        precipitation_sum: [0],
        wind_speed_10m_max: [15],
        wind_gusts_10m_max: [20],
        wind_direction_10m_dominant: [180]
    }
} as unknown as ExtendedWeatherData;

describe('useWeatherCalculations', () => {
    // Cas 1: Robustesa bàsica - No ha de petar amb dades nul·les
    it('retorna valors segurs quan weatherData és null', () => {
        const { result } = renderHook(() => 
            useWeatherCalculations(null, 'C', new Date())
        );

        // DOCTRINA RISC ZERO: sense weatherData no hi ha temperatura real per
        // validar — null (mai un 0 fals de "cel serè").
        expect(result.current.effectiveWeatherCode).toBe(null);
        expect(result.current.chartData24h).toEqual([]);
        expect(result.current.weeklyExtremes).toEqual({ min: 0, max: 40 }); // Valors per defecte segurs
    });

    // Cas 2: Càlcul correcte en Celsius
    it('processa correctament les dades en Celsius', () => {
        const now = new Date('2023-10-10T12:00:00Z');
        const { result } = renderHook(() => 
            useWeatherCalculations(mockWeatherData, 'C', now)
        );

        expect(result.current.chartData24h.length).toBeGreaterThan(0);
        expect(result.current.chartData24h[0].temp).toBe(20); // 20°C
    });

    // Cas 3: Conversió a Fahrenheit
    it('converteix correctament a Fahrenheit', () => {
        const now = new Date('2023-10-10T12:00:00Z');
        const { result } = renderHook(() => 
            useWeatherCalculations(mockWeatherData, 'F', now)
        );

        // 20°C * 9/5 + 32 = 68°F
        expect(result.current.chartData24h[0].temp).toBe(68);
    });

    // Cas 3b: la sèrie que dibuixen els gràfics d'Expert (línia principal + models)
    it('chartSeries: null sense dades; amb dades porta la temperatura en la unitat de l\'usuari', () => {
        const none = renderHook(() => useWeatherCalculations(null, 'C', new Date()));
        expect(none.result.current.chartSeries).toBeNull();

        const now = new Date('2023-10-10T12:00:00Z');
        const c = renderHook(() => useWeatherCalculations(mockWeatherData, 'C', now));
        const f = renderHook(() => useWeatherCalculations(mockWeatherData, 'F', now));
        expect(c.result.current.chartSeries?.primary[0].temp).toBe(20);
        expect(f.result.current.chartSeries?.primary[0].temp).toBe(68);
        // Sense models de comparació a les dades → null (no una comparació buida).
        expect(c.result.current.chartSeries?.comparison).toBeNull();
    });

    // Cas 4: Detecció d'extrems setmanals
    it('calcula correctament els extrems setmanals', () => {
        const now = new Date('2023-10-10T12:00:00Z');
        const { result } = renderHook(() => 
            useWeatherCalculations(mockWeatherData, 'C', now)
        );

        expect(result.current.weeklyExtremes.min).toBe(15);
        expect(result.current.weeklyExtremes.max).toBe(25);
    });
});
// L'"ara" i l'hora actual de l'evolució horària han de dir la mateixa intensitat de pluja: minutely_15 porta mm per
// quart d'hora i el motor treballa en mm/h (com a les hores). Abans 2 mm/h (0,5 mm cada quart) eren "pluja feble"
// a dalt i "moderada" a la taula.
describe('useWeatherCalculations — pluja d\'"ara" en mm/h', () => {
    const rainyData = (quarters: number[], hourlyMm: number) => ({
        ...mockWeatherData,
        current: { ...mockWeatherData.current, weather_code: 3, precipitation: quarters[0], cloud_cover: 100, cloud_cover_low: 100, cloud_cover_mid: 0, cloud_cover_high: 0, relative_humidity_2m: 90 },
        hourly: {
            ...mockWeatherData.hourly,
            precipitation: [hourlyMm, hourlyMm],
            weather_code: [3, 3],
            relative_humidity_2m: [90, 90],
            cloud_cover_low: [100, 100], cloud_cover_mid: [0, 0], cloud_cover_high: [0, 0]
        },
        minutely_15: {
            time: ['2023-10-10T12:00', '2023-10-10T12:15', '2023-10-10T12:30', '2023-10-10T12:45'],
            precipitation: quarters
        }
    }) as unknown as ExtendedWeatherData;

    // new Date('...T12:05') sense zona: el hook compara amb els temps de minutely_15 al mateix rellotge local.
    const now = new Date('2023-10-10T12:05');

    it('0,5 mm per quart d\'hora (2 mm/h) és pluja moderada, igual que l\'hora de 2 mm', () => {
        const { result } = renderHook(() => useWeatherCalculations(rainyData([0.5, 0.5, 0.5, 0.5], 2), 'C', now));
        expect(result.current.effectiveWeatherCode).toBe(63);
    });

    it('1,2 mm en un quart d\'hora (4,8 mm/h) és pluja forta', () => {
        const { result } = renderHook(() => useWeatherCalculations(rainyData([1.2, 0.8, 0.4, 0], 2.4), 'C', now));
        expect(result.current.effectiveWeatherCode).toBe(65);
    });

    it('sense minutely amb pluja, la pluja horària repartida en quarts torna a donar la intensitat de l\'hora', () => {
        const { result } = renderHook(() => useWeatherCalculations(rainyData([0, 0, 0, 0], 2), 'C', now));
        expect(result.current.effectiveWeatherCode).toBe(63);
    });

    it('els valors minutals que es mostren (gràfic, banner de radar) continuen en mm per quart d\'hora', () => {
        const { result } = renderHook(() => useWeatherCalculations(rainyData([0.5, 0.5, 0.5, 0.5], 2), 'C', now));
        expect(result.current.minutelyPreciseData).toEqual([0.5, 0.5, 0.5, 0.5]);
    });
});
