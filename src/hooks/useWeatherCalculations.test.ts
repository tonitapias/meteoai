// src/hooks/useWeatherCalculations.test.ts
import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useWeatherCalculations } from './useWeatherCalculations';
import { ExtendedWeatherData } from '../utils/weatherLogic';

// Mock simple de dades per a proves
const mockWeatherData: ExtendedWeatherData = {
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
};

describe('useWeatherCalculations', () => {
    // Cas 1: Robustesa bàsica - No ha de petar amb dades nul·les
    it('retorna valors segurs quan weatherData és null', () => {
        const { result } = renderHook(() => 
            useWeatherCalculations(null, 'C', new Date())
        );

        expect(result.current.effectiveWeatherCode).toBe(0);
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