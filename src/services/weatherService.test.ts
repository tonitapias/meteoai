// src/services/weatherService.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchAllWeatherData } from './weatherService';
import { getWeatherData, getAirQualityData } from './weatherApi';
import type { AirQualityData, WeatherData } from '../types/weather';

vi.mock('@sentry/react', () => ({ captureException: vi.fn() }));
vi.mock('./weatherApi', () => ({ getWeatherData: vi.fn(), getAirQualityData: vi.fn() }));
vi.mock('./geocodingService', () => ({ reverseGeocode: vi.fn() }));

const WEATHER = { current: { temperature_2m: 20 } } as unknown as WeatherData;

describe('fetchAllWeatherData — qualitat de l\'aire', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(getWeatherData).mockResolvedValue(WEATHER);
    });

    it('si l\'API de qualitat de l\'aire falla, la previsió arriba igualment (sense qualitat de l\'aire)', async () => {
        vi.mocked(getAirQualityData).mockRejectedValue(new Error('Server Error: 502'));

        const result = await fetchAllWeatherData(41.98, 2.82, 'C', 'ca', 'Girona', 'ES');

        expect(result.weatherRaw).toBe(WEATHER);
        expect(result.aqiData).toBeNull();
        expect(result.geoData).toEqual({ city: 'Girona', country: 'ES' });
    });

    it('amb les dues respostes, les torna totes dues', async () => {
        const aqi = { current: { european_aqi: 20 } } as unknown as AirQualityData;
        vi.mocked(getAirQualityData).mockResolvedValue(aqi);

        const result = await fetchAllWeatherData(41.98, 2.82, 'C', 'ca', 'Girona', 'ES');

        expect(result.aqiData).toBe(aqi);
    });

    it('si falla la previsió, l\'error arriba com sempre', async () => {
        vi.mocked(getWeatherData).mockRejectedValue(new Error('Failed to fetch'));
        vi.mocked(getAirQualityData).mockResolvedValue(null as unknown as AirQualityData);

        await expect(fetchAllWeatherData(41.98, 2.82, 'C', 'ca', 'Girona', 'ES')).rejects.toThrow('Failed to fetch');
    });
});
