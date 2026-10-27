// src/hooks/useWeather.test.tsx
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import * as Sentry from '@sentry/react';
import { useWeather } from './useWeather';
import { WeatherRepository } from '../repositories/WeatherRepository';
import type { AirQualityData } from '../types/weather';
import type { ExtendedWeatherData } from '../types/weatherLogicTypes'; // [FIX] Import correcte

// --- MOCKS ---
// (La cache no cal: el hook només parla amb WeatherRepository, que es mockeja sencer.)

// 1. RegionalModelWorker (S'injecta des del hook)
vi.mock('./useRegionalModelWorker', () => ({
    useRegionalModelWorker: () => ({
        runRegionalModelWorker: vi.fn((data) => Promise.resolve(data))
    })
}));

// 2. WeatherRepository (NOVA DEPENDÈNCIA PRINCIPAL)
vi.mock('../repositories/WeatherRepository', () => ({
    WeatherRepository: {
        get: vi.fn()
    }
}));

// 3. Sentry (per comprovar què es reporta i què no)
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
            41.38, 2.17, 'C', 'ca', 'Barcelona', undefined, expect.any(Function), expect.objectContaining({ onLateResult: expect.any(Function) })
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
            41.38, 2.17, 'C', 'ca', 'Barcelona', 'Spain', expect.any(Function), expect.any(Object)
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
            48.85, 2.35, 'C', 'ca', 'Paris', 'France', expect.any(Function), expect.any(Object)
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
// --- PREVISIÓ DESADA (WeatherRepository torna `offlineSnapshot` si la nova falla o tarda) ---

describe('useWeather — previsió desada', () => {
    const T0 = new Date('2026-09-27T12:00:00Z').getTime();
    const SAVED_AT = T0 - 3 * 60 * 60 * 1000;
    const snapshotResponse = (name: string) => ({
        success: true as const,
        data: { ...weatherAt(name), offlineSnapshot: { savedAt: SAVED_AT, issuedAt: '2026-09-27T11:00', distanceKm: null } } as ExtendedWeatherData,
        aqi: null
    });
    type RepoOptions = { onLateResult?: (response: ReturnType<typeof repoResponse>) => void };
    const nameOf = (data: ExtendedWeatherData | null) => (data?.location as { name: string } | undefined)?.name;

    beforeEach(() => {
        vi.clearAllMocks();
        vi.useFakeTimers({ toFake: ['Date'] });
        vi.setSystemTime(T0);
    });
    afterEach(() => { vi.useRealTimers(); });

    it('es mostra sense error ni esquelet, i "carregada" és quan es va desar (perquè es torni a provar tot sol)', async () => {
        vi.mocked(WeatherRepository.get).mockResolvedValue(snapshotResponse('Girona'));
        const { result } = renderHook(() => useWeather('ca', 'C'));

        await act(async () => { await result.current.fetchWeatherByCoords(41.98, 2.82, 'Girona', 'ES'); });

        expect(result.current.error).toBeNull();
        expect(result.current.loading).toBe(false);
        expect(result.current.weatherData?.offlineSnapshot?.savedAt).toBe(SAVED_AT);
        expect(result.current.aqiData).toBeNull();
        expect(result.current.getLastLoadedAt()).toBe(SAVED_AT);
    });

    it('la previsió nova que arriba tard substitueix la desada', async () => {
        let late!: RepoOptions['onLateResult'];
        vi.mocked(WeatherRepository.get).mockImplementation(async (...args: unknown[]) => {
            late = (args[7] as RepoOptions).onLateResult;
            return snapshotResponse('Girona desada');
        });
        const { result } = renderHook(() => useWeather('ca', 'C'));
        await act(async () => { await result.current.fetchWeatherByCoords(41.98, 2.82, 'Girona', 'ES'); });

        vi.setSystemTime(T0 + 5000);
        act(() => { late?.(repoResponse('Girona nova')); });

        expect(nameOf(result.current.weatherData)).toBe('Girona nova');
        expect(result.current.weatherData?.offlineSnapshot).toBeUndefined();
        expect(result.current.aqiData).toEqual(MOCK_AQI);
        expect(result.current.getLastLoadedAt()).toBe(T0 + 5000);
    });

    it('la que arriba tard es descarta si mentrestant l\'usuari ha demanat una altra ubicació', async () => {
        let late!: RepoOptions['onLateResult'];
        vi.mocked(WeatherRepository.get)
            .mockImplementationOnce(async (...args: unknown[]) => {
                late = (args[7] as RepoOptions).onLateResult;
                return snapshotResponse('Girona desada');
            })
            .mockResolvedValueOnce(repoResponse('Paris'));
        const { result } = renderHook(() => useWeather('ca', 'C'));
        await act(async () => { await result.current.fetchWeatherByCoords(41.98, 2.82, 'Girona', 'ES'); });
        await act(async () => { await result.current.fetchWeatherByCoords(48.85, 2.35, 'Paris', 'France'); });

        act(() => { late?.(repoResponse('Girona nova')); });

        expect(nameOf(result.current.weatherData)).toBe('Paris');
    });
});

describe('useWeather — lloc carregat (per a l\'enllaç i per compartir)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.useFakeTimers({ toFake: ['Date'] });
        vi.setSystemTime(new Date('2026-10-27T10:00:00Z'));
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it("desa les coordenades demanades tal qual (les del GPS, no les de les dades) i l'origen", async () => {
        // Les dades porten un altre punt (p. ex. una previsió desada d'un poble del costat).
        vi.mocked(WeatherRepository.get).mockResolvedValue(repoResponse('Salt'));
        const { result } = renderHook(() => useWeather('ca', 'C'));

        await act(async () => {
            await result.current.fetchWeatherByCoords(41.9831458, 2.8249319, 'La Meva Ubicació', undefined, 'gps');
        });

        expect(result.current.loadedPlace).toEqual({
            lat: 41.9831458, lon: 2.8249319, name: 'La Meva Ubicació', country: undefined, origin: 'gps'
        });
    });

    it("sense origen és un lloc consultat (cercador, favorit, enllaç)", async () => {
        vi.mocked(WeatherRepository.get).mockResolvedValue(repoResponse('Girona'));
        const { result } = renderHook(() => useWeather('ca', 'C'));

        await act(async () => { await result.current.fetchWeatherByCoords(41.98, 2.82, 'Girona', 'Espanya'); });

        expect(result.current.loadedPlace?.origin).toBe('consulted');
    });

    it("el refresc en segon pla manté l'origen", async () => {
        vi.mocked(WeatherRepository.get).mockResolvedValue(repoResponse('Girona'));
        const { result } = renderHook(() => useWeather('ca', 'C'));
        await act(async () => { await result.current.fetchWeatherByCoords(41.9831458, 2.8249319, 'La Meva Ubicació', undefined, 'gps'); });

        vi.setSystemTime(Date.now() + 20 * 60 * 1000);
        await act(async () => { await result.current.refreshLoadedLocation(); });

        expect(WeatherRepository.get).toHaveBeenCalledTimes(2);
        expect(result.current.loadedPlace?.origin).toBe('gps');
    });

    it("el mateix punt tornat a triar amb el GPS just després de cercar-lo passa a ser la meva posició", async () => {
        vi.mocked(WeatherRepository.get).mockResolvedValue(repoResponse('Girona'));
        const { result } = renderHook(() => useWeather('ca', 'C'));

        await act(async () => { await result.current.fetchWeatherByCoords(41.98, 2.82, 'Girona', 'Espanya'); });
        await act(async () => { await result.current.fetchWeatherByCoords(41.98, 2.82, 'Girona', 'Espanya', 'gps'); });

        expect(result.current.loadedPlace?.origin).toBe('gps');
    });

    it("si la càrrega falla, el lloc carregat continua sent l'anterior (el de les dades a pantalla)", async () => {
        vi.mocked(WeatherRepository.get)
            .mockResolvedValueOnce(repoResponse('Girona'))
            .mockRejectedValueOnce(new Error('offline'));
        const { result } = renderHook(() => useWeather('ca', 'C'));

        await act(async () => { await result.current.fetchWeatherByCoords(41.98, 2.82, 'Girona', 'Espanya'); });
        await act(async () => { await result.current.fetchWeatherByCoords(42.18, 2.49, 'Olot', 'Espanya'); });

        expect(result.current.loadedPlace).toMatchObject({ lat: 41.98, name: 'Girona' });
    });
});

// --- TORNAR A L'INICI (botó Inici del tauler: la benvinguda no pot tornar a carregar el lloc tota sola) ---
describe("useWeather — tornar a l'inici", () => {
    const T0 = new Date('2026-10-27T10:00:00Z').getTime();
    type RepoOptions = { onLateResult?: (response: ReturnType<typeof repoResponse>) => void };

    beforeEach(() => {
        vi.clearAllMocks();
        vi.useFakeTimers({ toFake: ['Date'] });
        vi.setSystemTime(T0);
    });
    afterEach(() => { vi.useRealTimers(); });

    it("buida la previsió, l'aire, el lloc carregat i l'error", async () => {
        vi.mocked(WeatherRepository.get).mockResolvedValue(repoResponse('Girona'));
        const { result } = renderHook(() => useWeather('ca', 'C'));
        await act(async () => { await result.current.fetchWeatherByCoords(41.98, 2.82, 'Girona', 'Espanya'); });

        act(() => { result.current.clearWeather(); });

        expect(result.current.weatherData).toBeNull();
        expect(result.current.aqiData).toBeNull();
        expect(result.current.loadedPlace).toBeNull();
        expect(result.current.error).toBeNull();
        expect(result.current.loading).toBe(false);
    });

    it("també treu l'error d'una càrrega fallida (el tauler mostrava l'avís d'error)", async () => {
        vi.mocked(WeatherRepository.get).mockRejectedValue(new Error('offline'));
        const { result } = renderHook(() => useWeather('ca', 'C'));
        await act(async () => { await result.current.fetchWeatherByCoords(41.98, 2.82, 'Girona', 'Espanya'); });
        expect(result.current.error).not.toBeNull();

        act(() => { result.current.clearWeather(); });

        expect(result.current.error).toBeNull();
    });

    it('ja no hi ha res a refrescar: ni en tornar a l\'app (getLastLoadedAt) ni amb "Reintenta"', async () => {
        vi.mocked(WeatherRepository.get).mockResolvedValue(repoResponse('Girona'));
        const { result } = renderHook(() => useWeather('ca', 'C'));
        await act(async () => { await result.current.fetchWeatherByCoords(41.98, 2.82, 'Girona', 'Espanya'); });

        act(() => { result.current.clearWeather(); });
        vi.setSystemTime(T0 + 60 * 60 * 1000);

        expect(result.current.getLastLoadedAt()).toBeNull();
        let res: unknown = 'no';
        await act(async () => { res = await result.current.refreshLoadedLocation(); });
        expect(res).toBeNull();
        expect(WeatherRepository.get).toHaveBeenCalledTimes(1);
        expect(result.current.weatherData).toBeNull();
    });

    it('una càrrega en curs que respon després es descarta i no deixa loading encallat', async () => {
        const slow = deferred<ReturnType<typeof repoResponse>>();
        vi.mocked(WeatherRepository.get).mockReturnValueOnce(slow.promise);
        const { result } = renderHook(() => useWeather('ca', 'C'));

        let loading!: Promise<unknown>;
        act(() => { loading = result.current.fetchWeatherByCoords(41.98, 2.82, 'Girona', 'Espanya'); });
        expect(result.current.loading).toBe(true);

        act(() => { result.current.clearWeather(); });
        expect(result.current.loading).toBe(false);

        await act(async () => { slow.resolve(repoResponse('Girona')); await loading; });

        expect(result.current.weatherData).toBeNull();
        expect(result.current.loadedPlace).toBeNull();
        expect(result.current.loading).toBe(false);
        expect(result.current.getLastLoadedAt()).toBeNull();
    });

    it('un refresc en segon pla en curs que respon després es descarta', async () => {
        const slowRefresh = deferred<ReturnType<typeof repoResponse>>();
        vi.mocked(WeatherRepository.get)
            .mockResolvedValueOnce(repoResponse('Girona v1'))
            .mockReturnValueOnce(slowRefresh.promise);
        const { result } = renderHook(() => useWeather('ca', 'C'));
        await act(async () => { await result.current.fetchWeatherByCoords(41.98, 2.82, 'Girona', 'Espanya'); });
        vi.setSystemTime(T0 + 20 * 60 * 1000);

        let refreshing!: Promise<unknown>;
        act(() => { refreshing = result.current.refreshLoadedLocation() as Promise<unknown>; });
        act(() => { result.current.clearWeather(); });
        await act(async () => { slowRefresh.resolve(repoResponse('Girona v2')); await refreshing; });

        expect(result.current.weatherData).toBeNull();
        expect(result.current.getLastLoadedAt()).toBeNull();
    });

    it('la previsió nova que arriba tard darrere d\'una de desada es descarta', async () => {
        let late!: RepoOptions['onLateResult'];
        vi.mocked(WeatherRepository.get).mockImplementation(async (...args: unknown[]) => {
            late = (args[7] as RepoOptions).onLateResult;
            return {
                success: true as const,
                data: { ...weatherAt('Girona desada'), offlineSnapshot: { savedAt: T0 - 3600000, issuedAt: '2026-10-27T09:00', distanceKm: null } } as ExtendedWeatherData,
                aqi: null
            };
        });
        const { result } = renderHook(() => useWeather('ca', 'C'));
        await act(async () => { await result.current.fetchWeatherByCoords(41.98, 2.82, 'Girona', 'Espanya'); });

        act(() => { result.current.clearWeather(); });
        act(() => { late?.(repoResponse('Girona nova')); });

        expect(result.current.weatherData).toBeNull();
        expect(result.current.loadedPlace).toBeNull();
        expect(result.current.getLastLoadedAt()).toBeNull();
    });

    it('el mateix lloc tornat a triar just després es torna a carregar (sense l\'antirrebot de 3 s)', async () => {
        vi.mocked(WeatherRepository.get).mockResolvedValue(repoResponse('Girona'));
        const { result } = renderHook(() => useWeather('ca', 'C'));
        await act(async () => { await result.current.fetchWeatherByCoords(41.98, 2.82, 'Girona', 'Espanya'); });

        act(() => { result.current.clearWeather(); });
        vi.setSystemTime(T0 + 1000);
        await act(async () => { await result.current.fetchWeatherByCoords(41.98, 2.82, 'Girona', 'Espanya'); });

        expect(WeatherRepository.get).toHaveBeenCalledTimes(2);
        expect((result.current.weatherData?.location as { name: string } | undefined)?.name).toBe('Girona');
        expect(result.current.getLastLoadedAt()).toBe(T0 + 1000);
    });
});
