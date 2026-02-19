// src/hooks/useWeather.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useWeather } from './useWeather';
// [CORRECCIÓ] Eliminat import de cacheService que no s'usava explícitament
import { WeatherRepository } from '../repositories/WeatherRepository';
import type { AirQualityData } from '../types/weather';
import type { ExtendedWeatherData } from '../types/weatherLogicTypes'; // [FIX] Import correcte

// --- MOCKS ---

// 1. CacheService (Encara s'usa al useEffect per fer clean, així que el mockegem per path)
vi.mock('../services/cacheService', () => ({
    cacheService: {
        clean: vi.fn().mockResolvedValue(undefined),
        generateWeatherKey: vi.fn() 
    }
}));

// 2. AromeWorker (S'injecta des del hook)
vi.mock('./useAromeWorker', () => ({
    useAromeWorker: () => ({
        runAromeWorker: vi.fn((data) => Promise.resolve(data)) 
    })
}));

// 3. WeatherRepository (NOVA DEPENDÈNCIA PRINCIPAL)
vi.mock('../repositories/WeatherRepository', () => ({
    WeatherRepository: {
        get: vi.fn()
    }
}));

// --- DADES DE PROVA ---
const MOCK_WEATHER_DATA = {
    current: { temperature_2m: 20 },
    location: { name: 'Barcelona', latitude: 41.38, longitude: 2.17 }
} as unknown as ExtendedWeatherData;

const MOCK_AQI = { current: { us_aqi: 50 } } as unknown as AirQualityData;

describe('useWeather Hook (Integration with Repository)', () => {
    
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('hauria d\'inicialitzar-se amb estat buit', () => {
        const { result } = renderHook(() => useWeather('ca', 'C'));
        
        expect(result.current.weatherData).toBeNull();
        expect(result.current.loading).toBe(false);
        expect(result.current.error).toBeNull();
    });

    it('hauria de gestionar una resposta EXITOSA del Repositori', async () => {
        // CONFIGURACIÓ: Simulem que el Repositori respon dades
        vi.mocked(WeatherRepository.get).mockResolvedValue({
            success: true,
            data: MOCK_WEATHER_DATA,
            aqi: MOCK_AQI
        });

        const { result } = renderHook(() => useWeather('ca', 'C'));

        // ACCIÓ
        await act(async () => {
            // [FIX] Afegim 'Barcelona' com a 3r argument
            await result.current.fetchWeatherByCoords(41.38, 2.17, 'Barcelona');
        });

        // VERIFICACIÓ
        expect(result.current.loading).toBe(false);
        expect(result.current.weatherData).toEqual(MOCK_WEATHER_DATA);
        expect(result.current.aqiData).toEqual(MOCK_AQI);
        expect(result.current.error).toBeNull();
        
        // [FIX] Verifiquem que ha cridat al Repositori amb 'Barcelona'
        expect(WeatherRepository.get).toHaveBeenCalledWith(
            41.38, 2.17, 'C', 'ca', 'Barcelona', undefined, expect.any(Function)
        );
    });

    it('hauria de gestionar un ERROR del Repositori', async () => {
        // CONFIGURACIÓ: Simulem que el Repositori falla
        vi.mocked(WeatherRepository.get).mockRejectedValue(new Error('Network Error'));

        const { result } = renderHook(() => useWeather('ca', 'C'));

        // ACCIÓ
        await act(async () => {
            // [FIX] Afegim 'Barcelona' com a 3r argument
            const res = await result.current.fetchWeatherByCoords(41.38, 2.17, 'Barcelona');
            expect(res.success).toBe(false);
        });

        // VERIFICACIÓ
        expect(result.current.loading).toBe(false);
        expect(result.current.weatherData).toBeNull();
        expect(result.current.error).toBeTruthy();
    });
});