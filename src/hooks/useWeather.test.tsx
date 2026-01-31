// src/hooks/useWeather.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useWeather } from './useWeather';
import { cacheService } from '../services/cacheService';
import { fetchAllWeatherData } from './useWeatherQuery';
import * as weatherApi from '../services/weatherApi';
import { WeatherData, AirQualityData } from '../types/weather';
import { ExtendedWeatherData } from '../utils/weatherLogic';

// --- DEFINICIONS DE TIPUS PER A TESTS ---
// Repliquem la interfície privada per satisfer el linter
interface WeatherCachePacket {
    weather: ExtendedWeatherData;
    aqi: AirQualityData | null;
}

// --- 1. MOCKS (Simuladors) ---
vi.mock('../services/cacheService', () => ({
    cacheService: {
        get: vi.fn(),
        set: vi.fn(),
        generateWeatherKey: vi.fn(() => 'test-key'),
        clean: vi.fn().mockResolvedValue(undefined)
    }
}));

vi.mock('./useWeatherQuery', () => ({
    fetchAllWeatherData: vi.fn()
}));

vi.mock('./useAromeWorker', () => ({
    useAromeWorker: () => ({
        runAromeWorker: vi.fn((data) => Promise.resolve(data)) 
    })
}));

vi.mock('../services/weatherApi', async (importOriginal) => {
    const actual = await importOriginal<typeof weatherApi>();
    return {
        ...actual,
        getAromeData: vi.fn()
    };
});

// --- 2. DADES DE PROVA (Fixtures) ---
// Utilitzem 'unknown' com a pas intermedi per evitar el warning 'no-explicit-any'
// quan fem servir objectes parcials (Partial Mocks).
const MOCK_WEATHER_RAW = {
    current: { temperature_2m: 20, time: '2023-01-01T12:00' },
    hourly: { time: [], temperature_2m: [] },
    daily: { time: [], temperature_2m_max: [] },
    location: { name: 'Original', latitude: 0, longitude: 0 }
};

const MOCK_GEO = { city: 'Barcelona', country: 'ES' };
const MOCK_AQI = { current: { us_aqi: 50 } };

describe('useWeather Hook (Core Logic)', () => {
    
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('hauria d\'inicialitzar-se amb estat buit', () => {
        const { result } = renderHook(() => useWeather('ca', 'C'));
        
        expect(result.current.weatherData).toBeNull();
        expect(result.current.loading).toBe(false);
        expect(result.current.error).toBeNull();
    });

    it('hauria de fer una petició de xarxa si no hi ha cache (Cold Start)', async () => {
        // CONFIGURACIÓ: Cache buida, Xarxa respon OK
        vi.mocked(cacheService.get).mockResolvedValue(null);
        vi.mocked(fetchAllWeatherData).mockResolvedValue({
            weatherRaw: MOCK_WEATHER_RAW as unknown as WeatherData,
            geoData: MOCK_GEO,
            aqiData: MOCK_AQI as unknown as AirQualityData
        });

        const { result } = renderHook(() => useWeather('ca', 'C'));

        // ACCIÓ: Cridem a fetch
        await act(async () => {
            await result.current.fetchWeatherByCoords(41.38, 2.17);
        });

        // VERIFICACIÓ
        expect(result.current.loading).toBe(false);
        expect(result.current.weatherData).not.toBeNull();
        expect(result.current.weatherData?.location?.name).toBe('Barcelona');
        expect(result.current.aqiData).toEqual(MOCK_AQI);
        
        // Verifiquem que ha intentat guardar a la cache
        expect(cacheService.set).toHaveBeenCalledTimes(1);
    });

    it('hauria de recuperar dades de la CACHE si existeixen (Hot Start)', async () => {
        // CONFIGURACIÓ: Cache plena
        const cachedPayload: WeatherCachePacket = {
            weather: { 
                ...(MOCK_WEATHER_RAW as unknown as ExtendedWeatherData), 
                location: { name: 'Cached City', latitude: 0, longitude: 0 } 
            },
            aqi: MOCK_AQI as unknown as AirQualityData
        };
        
        // Cast a 'unknown' i després al tipus esperat pel mock per evitar errors de linter
        vi.mocked(cacheService.get).mockResolvedValue(cachedPayload as unknown as undefined);

        const { result } = renderHook(() => useWeather('ca', 'C'));

        await act(async () => {
            await result.current.fetchWeatherByCoords(41.38, 2.17);
        });

        // VERIFICACIÓ
        expect(result.current.weatherData?.location?.name).toBe('Cached City');
        // IMPORTANT: No hauria d'haver cridat a la xarxa
        expect(fetchAllWeatherData).not.toHaveBeenCalled();
    });

    it('hauria de gestionar errors de xarxa elegantment', async () => {
        // CONFIGURACIÓ: Cache buida, Xarxa falla
        vi.mocked(cacheService.get).mockResolvedValue(null);
        vi.mocked(fetchAllWeatherData).mockRejectedValue(new Error('Network Error'));

        const { result } = renderHook(() => useWeather('ca', 'C'));

        await act(async () => {
            const res = await result.current.fetchWeatherByCoords(41.38, 2.17);
            expect(res.success).toBe(false);
        });

        expect(result.current.weatherData).toBeNull();
        expect(result.current.error).toBeTruthy();
    });
});