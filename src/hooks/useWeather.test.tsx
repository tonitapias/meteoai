// src/hooks/useWeather.test.tsx
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import * as Sentry from '@sentry/react';
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

// 2. RegionalModelWorker (S'injecta des del hook)
vi.mock('./useRegionalModelWorker', () => ({
    useRegionalModelWorker: () => ({
        runRegionalModelWorker: vi.fn((data) => Promise.resolve(data))
    })
}));

// 3. WeatherRepository (NOVA DEPENDÈNCIA PRINCIPAL)
vi.mock('../repositories/WeatherRepository', () => ({
    WeatherRepository: {
        get: vi.fn()
    }
}));

// 4. Sentry (per comprovar què es reporta i què no)
vi.mock('@sentry/react', () => ({
    captureException: vi.fn()
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

// --- REFRESC SILENCIÓS (useRefreshOnResume) ---

const weatherAt = (name: string) => ({
    current: { temperature_2m: 20 },
    location: { name }
}) as unknown as ExtendedWeatherData;

const repoResponse = (name: string) => ({ success: true as const, data: weatherAt(name), aqi: MOCK_AQI });

function deferred<T>() {
    let resolve!: (value: T) => void;
    const promise = new Promise<T>((res) => { resolve = res; });
    return { promise, resolve };
}

describe('useWeather — refresc silenciós de la ubicació carregada', () => {
    // Només falsegem Date: el debounce de 3 s de useWeather compara Date.now().
    const advanceMinutes = (min: number) => vi.setSystemTime(Date.now() + min * 60 * 1000);

    beforeEach(() => {
        vi.clearAllMocks();
        vi.useFakeTimers({ toFake: ['Date'] });
        vi.setSystemTime(new Date('2026-09-21T10:00:00Z'));
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.restoreAllMocks();
    });

    const loadBarcelona = async (result: { current: ReturnType<typeof useWeather> }) => {
        await act(async () => {
            await result.current.fetchWeatherByCoords(41.38, 2.17, 'Barcelona', 'Spain');
        });
    };

    const nameOf = (data: ExtendedWeatherData | null) => (data?.location as { name: string } | undefined)?.name;

    it('no fa res (ni crida el repositori) si encara no hi ha cap ubicació carregada', async () => {
        const { result } = renderHook(() => useWeather('ca', 'C'));

        expect(result.current.getLastLoadedAt()).toBeNull();

        let res: unknown;
        await act(async () => { res = await result.current.refreshLoadedLocation(); });

        expect(res).toBeNull();
        expect(WeatherRepository.get).not.toHaveBeenCalled();
    });

    it('registra quan s\'ha carregat correctament una ubicació', async () => {
        vi.mocked(WeatherRepository.get).mockResolvedValue(repoResponse('Barcelona'));
        const { result } = renderHook(() => useWeather('ca', 'C'));

        await loadBarcelona(result);

        expect(result.current.getLastLoadedAt()).toBe(Date.now());
    });

    it('torna a demanar les mateixes coordenades, nom i país i actualitza les dades', async () => {
        vi.mocked(WeatherRepository.get)
            .mockResolvedValueOnce(repoResponse('Barcelona v1'))
            .mockResolvedValueOnce(repoResponse('Barcelona v2'));
        const { result } = renderHook(() => useWeather('ca', 'C'));
        await loadBarcelona(result);
        const firstLoadAt = result.current.getLastLoadedAt()!;

        // Més enllà del debounce de 3 s de fetchWeatherByCoords (mateixes coords) i del TTL.
        advanceMinutes(20);
        let res: unknown;
        await act(async () => { res = await result.current.refreshLoadedLocation(); });

        expect(res).toEqual({ success: true });
        expect(WeatherRepository.get).toHaveBeenCalledTimes(2);
        expect(WeatherRepository.get).toHaveBeenLastCalledWith(
            41.38, 2.17, 'C', 'ca', 'Barcelona', 'Spain', expect.any(Function)
        );
        expect(nameOf(result.current.weatherData)).toBe('Barcelona v2');
        expect(result.current.getLastLoadedAt()).toBeGreaterThan(firstLoadAt);
    });

    it('no posa loading a true durant el refresc (no parpelleja la UI)', async () => {
        const pending = deferred<ReturnType<typeof repoResponse>>();
        vi.mocked(WeatherRepository.get)
            .mockResolvedValueOnce(repoResponse('Barcelona v1'))
            .mockReturnValueOnce(pending.promise);
        const { result } = renderHook(() => useWeather('ca', 'C'));
        await loadBarcelona(result);
        advanceMinutes(20);

        let refreshing!: Promise<unknown>;
        act(() => { refreshing = result.current.refreshLoadedLocation() as Promise<unknown>; });
        expect(WeatherRepository.get).toHaveBeenCalledTimes(2);
        expect(result.current.loading).toBe(false);
        // Mentrestant es continua veient la previsió anterior.
        expect(nameOf(result.current.weatherData)).toBe('Barcelona v1');

        await act(async () => { pending.resolve(repoResponse('Barcelona v2')); await refreshing; });

        expect(result.current.loading).toBe(false);
        expect(nameOf(result.current.weatherData)).toBe('Barcelona v2');
    });

    it('si el refresc falla, conserva la previsió a pantalla i no posa error', async () => {
        vi.mocked(WeatherRepository.get)
            .mockResolvedValueOnce(repoResponse('Barcelona v1'))
            .mockRejectedValueOnce(new Error('Failed to fetch'));
        const { result } = renderHook(() => useWeather('ca', 'C'));
        await loadBarcelona(result);
        const loadedAt = result.current.getLastLoadedAt();
        advanceMinutes(20);

        let res: { success: boolean } | null = null;
        await act(async () => { res = await result.current.refreshLoadedLocation(); });

        expect(res).toMatchObject({ success: false });
        expect(result.current.error).toBeNull();
        expect(result.current.loading).toBe(false);
        expect(nameOf(result.current.weatherData)).toBe('Barcelona v1');
        // La càrrega correcta no avança: el hook de reprendre sap que segueix vella.
        expect(result.current.getLastLoadedAt()).toBe(loadedAt);
    });

    it('un refresc que falla sense connexió no es reporta a Sentry; amb connexió, sí', async () => {
        vi.mocked(WeatherRepository.get)
            .mockResolvedValueOnce(repoResponse('Barcelona v1'))
            .mockRejectedValue(new Error('Failed to fetch'));
        const { result } = renderHook(() => useWeather('ca', 'C'));
        await loadBarcelona(result);
        advanceMinutes(20);

        const onLine = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
        await act(async () => { await result.current.refreshLoadedLocation(); });
        expect(Sentry.captureException).not.toHaveBeenCalled();

        advanceMinutes(20);
        onLine.mockReturnValue(true);
        await act(async () => { await result.current.refreshLoadedLocation(); });
        expect(Sentry.captureException).toHaveBeenCalledTimes(1);
    });

    it('una càrrega explícita en curs invalida la ubicació carregada (no es pot refrescar la vella)', async () => {
        const pending = deferred<ReturnType<typeof repoResponse>>();
        vi.mocked(WeatherRepository.get)
            .mockResolvedValueOnce(repoResponse('Barcelona'))
            .mockReturnValueOnce(pending.promise);
        const { result } = renderHook(() => useWeather('ca', 'C'));
        await loadBarcelona(result);
        advanceMinutes(20);

        let loadingParis!: Promise<unknown>;
        act(() => { loadingParis = result.current.fetchWeatherByCoords(48.85, 2.35, 'Paris', 'France'); });

        expect(result.current.loading).toBe(true);
        expect(result.current.getLastLoadedAt()).toBeNull();
        let res: unknown;
        await act(async () => { res = await result.current.refreshLoadedLocation(); });
        expect(res).toBeNull();
        expect(WeatherRepository.get).toHaveBeenCalledTimes(2); // Barcelona + París, cap refresc.

        await act(async () => { pending.resolve(repoResponse('Paris')); await loadingParis; });

        // Ara la ubicació carregada és París, no Barcelona.
        expect(result.current.getLastLoadedAt()).toBe(Date.now());
        advanceMinutes(20);
        await act(async () => { await result.current.refreshLoadedLocation(); });
        expect(WeatherRepository.get).toHaveBeenLastCalledWith(
            48.85, 2.35, 'C', 'ca', 'Paris', 'France', expect.any(Function)
        );
    });

    it('si la càrrega explícita falla, no queda cap ubicació carregada que refrescar', async () => {
        vi.mocked(WeatherRepository.get)
            .mockResolvedValueOnce(repoResponse('Barcelona'))
            .mockRejectedValueOnce(new Error('Network Error'));
        const { result } = renderHook(() => useWeather('ca', 'C'));
        await loadBarcelona(result);
        advanceMinutes(20);

        await act(async () => { await result.current.fetchWeatherByCoords(48.85, 2.35, 'Paris'); });
        expect(result.current.error).toBeTruthy();
        expect(result.current.getLastLoadedAt()).toBeNull();

        let res: unknown;
        await act(async () => { res = await result.current.refreshLoadedLocation(); });
        expect(res).toBeNull();
        expect(WeatherRepository.get).toHaveBeenCalledTimes(2);
    });

    it('un refresc en curs es descarta si l\'usuari carrega una altra ubicació mentrestant', async () => {
        const slowRefresh = deferred<ReturnType<typeof repoResponse>>();
        vi.mocked(WeatherRepository.get)
            .mockResolvedValueOnce(repoResponse('Barcelona v1'))
            .mockReturnValueOnce(slowRefresh.promise)
            .mockResolvedValueOnce(repoResponse('Paris'));
        const { result } = renderHook(() => useWeather('ca', 'C'));
        await loadBarcelona(result);
        advanceMinutes(20);

        let refreshing!: Promise<unknown>;
        act(() => { refreshing = result.current.refreshLoadedLocation() as Promise<unknown>; });
        await act(async () => { await result.current.fetchWeatherByCoords(48.85, 2.35, 'Paris', 'France'); });
        expect(nameOf(result.current.weatherData)).toBe('Paris');

        // El refresc de Barcelona arriba tard: no ha de trepitjar París ni deixar loading encallat.
        await act(async () => { slowRefresh.resolve(repoResponse('Barcelona v2')); await refreshing; });

        expect(nameOf(result.current.weatherData)).toBe('Paris');
        expect(result.current.loading).toBe(false);
        expect(result.current.getLastLoadedAt()).toBe(Date.now());
    });
});