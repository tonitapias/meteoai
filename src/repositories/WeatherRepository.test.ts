// src/repositories/WeatherRepository.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { WeatherRepository } from './WeatherRepository';
import { fetchAllWeatherData } from '../services/weatherService';
import { getRegionalHDData } from '../services/weatherApi';
import { cacheService } from '../services/cacheService';
import { CACHE_TTL, OFFLINE_SNAPSHOT } from '../constants/cacheConfig';
import type { ExtendedWeatherData } from '../types/weatherLogicTypes';
import type { AirQualityData, WeatherData } from '../types/weather';
import type { FetchResult } from '../services/weatherService';
import { TROPICAL_RAIN_GATE_KEY } from '../utils/tropicalRainGate';

// Cache en memòria amb l'instant de desar (com cacheService.getEntry): el TTL de 15 minuts l'aplica el repositori.
const { store } = vi.hoisted(() => ({ store: new Map<string, { data: unknown; savedAt: number }>() }));

vi.mock('@sentry/react', () => ({ captureException: vi.fn(), addBreadcrumb: vi.fn() }));
vi.mock('../services/cacheService', () => ({
    cacheService: {
        generateWeatherKey: (lat: number, lon: number, unit: string, lang: string) => `weather_${lat}_${lon}_${unit}_${lang}`,
        getEntry: vi.fn(async (key: string) => store.get(key) ?? null),
        set: vi.fn(async (key: string, data: unknown) => { store.set(key, { data, savedAt: Date.now() }); }),
        findWeatherKeysNear: vi.fn(async () => [])
    }
}));
vi.mock('../services/weatherService', () => ({ fetchAllWeatherData: vi.fn() }));
vi.mock('../services/weatherApi', () => ({ getRegionalHDData: vi.fn() }));

const GIRONA = { lat: 41.98, lon: 2.82 };        // zona d'AROME HD
const CAPE_TOWN = { lat: -33.92, lon: 18.42 };   // cap model regional
const NATAL = { lat: -5.79, lon: -35.21 };       // tròpic, cap model regional

// Resposta mínima del model global (objectes nous a cada crida: el repositori els transforma).
const globalResponse = (): FetchResult => ({
    weatherRaw: {
        current: { time: '2026-09-26T12:00', temperature_2m: 20 },
        hourly: { time: ['2026-09-26T12:00'], temperature_2m: [20] },
        daily: { time: ['2026-09-26'] }
    } as unknown as WeatherData,
    geoData: { city: 'Girona', country: 'ES' },
    aqiData: null as unknown as AirQualityData
});

type WorkerFn = (base: ExtendedWeatherData) => Promise<ExtendedWeatherData>;
const workerOk: WorkerFn = async (base) => ({ ...base, current: { ...base.current, source: 'AROME HD' } });
const workerTimedOut: WorkerFn = async (base) => base; // el hook, en esgotar els 4 s, torna les dades base
const workerFails: WorkerFn = async () => { throw new Error('Worker Critical Error'); };

const load = (where: { lat: number; lon: number }, worker: WorkerFn) =>
    WeatherRepository.get(where.lat, where.lon, 'C', 'ca', 'Lloc', 'ES', worker as never);

type Packet = { regionalMissing?: boolean; cachedAt?: number };
const lastPacket = (): Packet => {
    const calls = vi.mocked(cacheService.set).mock.calls;
    return calls[calls.length - 1]?.[1] as Packet;
};

const T0 = new Date('2026-09-26T10:00:00Z').getTime();
const MIN = 60 * 1000;

describe('WeatherRepository — cache quan el model regional falla', () => {
    beforeEach(() => {
        store.clear();
        vi.clearAllMocks();
        vi.useFakeTimers({ toFake: ['Date'] });
        vi.setSystemTime(T0);
        vi.mocked(fetchAllWeatherData).mockImplementation(async () => globalResponse());
        vi.mocked(getRegionalHDData).mockResolvedValue({} as WeatherData);
    });
    afterEach(() => { vi.useRealTimers(); });

    it('amb el model regional aplicat: es desa sense marca i es reaprofita (cache normal de 15 min)', async () => {
        const first = await load(GIRONA, workerOk);
        expect(first.data.current.source).toBe('AROME HD');
        expect(lastPacket().regionalMissing).toBeUndefined();

        vi.setSystemTime(T0 + 10 * MIN);
        await load(GIRONA, workerOk);
        expect(fetchAllWeatherData).toHaveBeenCalledTimes(1);
    });

    it('worker esgotat: l\'usuari veu la global de seguida, el paquet es marca i als 2 min es torna a provar', async () => {
        const first = await load(GIRONA, workerTimedOut);
        expect(first.success).toBe(true);
        expect(first.data.current.source).toBeUndefined();
        expect(lastPacket()).toMatchObject({ regionalMissing: true, cachedAt: T0 });

        // Dins dels 2 minuts: es reaprofita (una fallada permanent no fa demanar-ho tot a cada visita).
        vi.setSystemTime(T0 + 1 * MIN);
        await load(GIRONA, workerOk);
        expect(fetchAllWeatherData).toHaveBeenCalledTimes(1);

        // Passats els 2 minuts: es torna a demanar i, si ara funciona, arriba AROME i el paquet ja no porta marca.
        vi.setSystemTime(T0 + CACHE_TTL.WEATHER_REGIONAL_RETRY + 1000);
        const retry = await load(GIRONA, workerOk);
        expect(fetchAllWeatherData).toHaveBeenCalledTimes(2);
        expect(retry.data.current.source).toBe('AROME HD');
        expect(lastPacket().regionalMissing).toBeUndefined();
    });

    it('worker fallit (error): es mostra la global i el paquet es marca', async () => {
        const result = await load(GIRONA, workerFails);
        expect(result.success).toBe(true);
        expect(result.data.current.source).toBeUndefined();
        expect(lastPacket().regionalMissing).toBe(true);
    });

    it('petició regional fallida: no es crida el worker, es mostra la global i el paquet es marca', async () => {
        vi.mocked(getRegionalHDData).mockRejectedValue(new Error('HTTP 502'));
        const worker = vi.fn(workerOk);
        const result = await load(GIRONA, worker);
        expect(worker).not.toHaveBeenCalled();
        expect(result.data.current.source).toBeUndefined();
        expect(lastPacket().regionalMissing).toBe(true);
    });

    it('un lloc sense model regional es desa com sempre (sense marca) i es reaprofita', async () => {
        await load(CAPE_TOWN, workerOk);
        expect(getRegionalHDData).not.toHaveBeenCalled();
        expect(lastPacket().regionalMissing).toBeUndefined();

        vi.setSystemTime(T0 + 10 * MIN);
        await load(CAPE_TOWN, workerOk);
        expect(fetchAllWeatherData).toHaveBeenCalledTimes(1);
    });

    it('passats els 15 minuts, es torna a demanar', async () => {
        await load(CAPE_TOWN, workerOk);
        vi.setSystemTime(T0 + CACHE_TTL.WEATHER + 1000);
        const again = await load(CAPE_TOWN, workerOk);
        expect(fetchAllWeatherData).toHaveBeenCalledTimes(2);
        expect(again.data.offlineSnapshot).toBeUndefined();
    });

    it('un paquet antic (d\'abans d\'aquest canvi, sense camps) es reaprofita com sempre', async () => {
        store.set(`weather_${GIRONA.lat}_${GIRONA.lon}_C_ca`, { data: { weather: { current: { source: 'AROME HD' } }, aqi: null }, savedAt: T0 });
        const result = await load(GIRONA, workerOk);
        expect(fetchAllWeatherData).not.toHaveBeenCalled();
        expect(result.data.current.source).toBe('AROME HD');
    });
});

describe('WeatherRepository — barreja amb AIFS dels dies 4-7', () => {
    // 8 dies des de "ara". La sèrie principal ÉS ICON (mateixa temperatura, humitat i pluja) i plou 1 mm a les hores del
    // dia 6 amb un 10 % de probabilitat; AIFS fa 4 °C menys.
    const HOURS = Array.from({ length: 8 * 24 }, (_, i) => new Date(Date.UTC(2026, 8, 26, 0) + i * 3_600_000).toISOString().slice(0, 16));
    const RAIN_HOUR = 5 * 24 + 12;
    const response = (): FetchResult => {
        const temp = HOURS.map(() => 20);
        const rh = HOURS.map(() => 80);
        const mm = HOURS.map((_, i) => (i === RAIN_HOUR ? 1 : 0));
        return {
            weatherRaw: {
                current: { time: HOURS[0], temperature_2m: 20 },
                hourly: {
                    time: HOURS, temperature_2m: temp, relative_humidity_2m: rh, precipitation: mm,
                    precipitation_probability: HOURS.map(() => 10),
                    temperature_2m_icon_seamless: temp, relative_humidity_2m_icon_seamless: rh, precipitation_icon_seamless: mm,
                    temperature_2m_ecmwf_aifs025_single: HOURS.map(() => 16)
                },
                daily: { time: [] }
            } as unknown as WeatherData,
            geoData: { city: 'Ciutat del Cap', country: 'ZA' },
            aqiData: null as unknown as AirQualityData
        };
    };

    beforeEach(() => {
        store.clear();
        vi.clearAllMocks();
        vi.mocked(fetchAllWeatherData).mockImplementation(async () => response());
    });

    it('la temperatura dels dies 4-7 surt barrejada', async () => {
        const { data } = await load(CAPE_TOWN, workerOk);
        const t = (data.hourly as unknown as Record<string, number[]>).temperature_2m;
        expect(t[48]).toBe(20);
        expect(t[RAIN_HOUR]).toBeCloseTo(18, 10);
    });

    it('la barreja va després de l\'evidència de pluja: la sèrie segueix reconeixent-se com a ICON i no se n\'infla la probabilitat', async () => {
        const { data } = await load(CAPE_TOWN, workerOk);
        const prob = (data.hourly as unknown as Record<string, number[]>).precipitation_probability;
        expect(prob[RAIN_HOUR]).toBe(10);
    });
});

describe('WeatherRepository — filtre de pluja tropical', () => {
    beforeEach(() => {
        store.clear();
        vi.clearAllMocks();
        vi.mocked(fetchAllWeatherData).mockImplementation(async () => globalResponse());
    });

    it('un lloc tropical sense model regional surt amb les hores marcades', async () => {
        const { data } = await load(NATAL, workerOk);
        expect((data.hourly as unknown as Record<string, unknown>)[TROPICAL_RAIN_GATE_KEY]).toEqual([1]);
    });

    it('fora del tròpic (i dins d\'un model regional) no hi ha cap marca', async () => {
        for (const where of [CAPE_TOWN, GIRONA]) {
            store.clear();
            const { data } = await load(where, workerOk);
            expect((data.hourly as unknown as Record<string, unknown>)[TROPICAL_RAIN_GATE_KEY]).toBeUndefined();
        }
    });
});

describe('WeatherRepository — previsió desada quan no n\'arriba cap de nova', () => {
    // Ara són les 12:00 a Girona (UTC+2). La previsió es va desar a les 09:00 (fa 3 h) i cobreix 48 hores des de
    // les 00:00 d'avui; cada temperatura horària és el seu índex.
    const SAVED_AT = T0 - 3 * 60 * MIN;
    const HOURS = Array.from({ length: 48 }, (_, i) => new Date(Date.UTC(2026, 8, 26) + i * 3_600_000).toISOString().slice(0, 16));
    const savedWeather = (hours = HOURS) => ({
        timezone: 'Europe/Madrid',
        utc_offset_seconds: 7200,
        current: { time: '2026-09-26T09:00', temperature_2m: 15 },
        hourly: { time: hours, temperature_2m: hours.map((_, i) => i) },
        daily: { time: ['2026-09-26', '2026-09-27'] },
        location: { name: 'Girona', latitude: GIRONA.lat, longitude: GIRONA.lon }
    });
    const GIRONA_KEY = `weather_${GIRONA.lat}_${GIRONA.lon}_C_ca`;
    const storeSaved = (key: string, weather = savedWeather()) =>
        store.set(key, { data: { weather, aqi: { current: { european_aqi: 20 } } }, savedAt: SAVED_AT });

    const networkDown = () => vi.mocked(fetchAllWeatherData).mockRejectedValue(new Error('Failed to fetch'));

    beforeEach(() => {
        store.clear();
        vi.clearAllMocks();
        vi.useFakeTimers({ toFake: ['Date'] });
        vi.setSystemTime(T0);
        vi.mocked(fetchAllWeatherData).mockImplementation(async () => globalResponse());
        vi.mocked(getRegionalHDData).mockResolvedValue({} as WeatherData);
        vi.mocked(cacheService.findWeatherKeysNear).mockResolvedValue([]);
    });
    afterEach(() => {
        vi.useRealTimers();
        vi.restoreAllMocks();
    });

    it('la petició falla: es mostra la desada avançada fins a ara, marcada, sense qualitat de l\'aire i sense tornar-la a desar', async () => {
        storeSaved(GIRONA_KEY);
        networkDown();

        const result = await load(GIRONA, workerOk);

        expect(result.data.offlineSnapshot).toEqual({ savedAt: SAVED_AT, issuedAt: '2026-09-26T09:00', distanceKm: null });
        expect(result.data.current.time).toBe('2026-09-26T12:00');
        expect(result.data.current.temperature_2m).toBe(12);
        expect(result.aqi).toBeNull();
        expect(cacheService.set).not.toHaveBeenCalled();
    });

    it('sense cap previsió desada, l\'error arriba com abans', async () => {
        networkDown();
        await expect(load(GIRONA, workerOk)).rejects.toThrow('Failed to fetch');
    });

    it('una previsió desada que ja no arriba fins a ara no serveix: l\'error arriba com abans', async () => {
        storeSaved(GIRONA_KEY, savedWeather(HOURS.slice(0, 6)));
        networkDown();
        await expect(load(GIRONA, workerOk)).rejects.toThrow('Failed to fetch');
    });

    it('el GPS dona un altre punt: es fa servir la desada més propera i es diu a quants km és', async () => {
        const nearbyKey = 'weather_42_2.8_C_ca';
        storeSaved(nearbyKey);
        vi.mocked(cacheService.findWeatherKeysNear).mockResolvedValue([{ key: nearbyKey, distanceKm: 3 }]);
        networkDown();

        const result = await load(GIRONA, workerOk);

        expect(cacheService.findWeatherKeysNear).toHaveBeenCalledWith(GIRONA.lat, GIRONA.lon, 'C', 'ca', OFFLINE_SNAPSHOT.MAX_DISTANCE_KM);
        expect(result.data.offlineSnapshot?.distanceKm).toBe(3);
        expect((result.data.location as { name: string }).name).toBe('Girona');
    });

    it('amb la desada caducada però la petició bé, es mostra la nova (sense marca) i es desa', async () => {
        storeSaved(GIRONA_KEY);
        const result = await load(GIRONA, workerOk);
        expect(result.data.offlineSnapshot).toBeUndefined();
        expect(result.data.current.source).toBe('AROME HD');
        expect(cacheService.set).toHaveBeenCalledTimes(1);
    });

    it('petició lenta: passada l\'espera es mostra la desada; la nova, quan arriba, es lliura per onLateResult i es desa', async () => {
        vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] });
        vi.setSystemTime(T0);
        storeSaved(GIRONA_KEY);
        let deliver!: (value: FetchResult) => void;
        vi.mocked(fetchAllWeatherData).mockImplementation(() => new Promise<FetchResult>((resolve) => { deliver = resolve; }));
        const onLateResult = vi.fn();

        const pending = WeatherRepository.get(GIRONA.lat, GIRONA.lon, 'C', 'ca', 'Lloc', 'ES', workerOk as never, { onLateResult });
        await vi.advanceTimersByTimeAsync(OFFLINE_SNAPSHOT.WAIT_BEFORE_FALLBACK_MS);
        const result = await pending;

        expect(result.data.offlineSnapshot?.savedAt).toBe(SAVED_AT);
        expect(onLateResult).not.toHaveBeenCalled();

        deliver(globalResponse());
        await vi.waitFor(() => expect(onLateResult).toHaveBeenCalledTimes(1));
        const late = onLateResult.mock.calls[0][0];
        expect(late.data.offlineSnapshot).toBeUndefined();
        expect(late.data.current.source).toBe('AROME HD');
        expect(cacheService.set).toHaveBeenCalledTimes(1);
    });

    it('petició lenta sense cap previsió desada: s\'espera la nova com sempre', async () => {
        vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] });
        vi.setSystemTime(T0);
        let deliver!: (value: FetchResult) => void;
        vi.mocked(fetchAllWeatherData).mockImplementation(() => new Promise<FetchResult>((resolve) => { deliver = resolve; }));

        let settled = false;
        const pending = load(GIRONA, workerOk).finally(() => { settled = true; });
        await vi.advanceTimersByTimeAsync(OFFLINE_SNAPSHOT.WAIT_BEFORE_FALLBACK_MS * 2);
        expect(settled).toBe(false);

        deliver(globalResponse());
        const result = await pending;
        expect(result.data.offlineSnapshot).toBeUndefined();
    });

    it('sense connexió declarada no s\'espera: la desada surt de seguida encara que la petició no acabi mai', async () => {
        storeSaved(GIRONA_KEY);
        vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
        vi.mocked(fetchAllWeatherData).mockImplementation(() => new Promise<FetchResult>(() => {}));

        const result = await load(GIRONA, workerOk);

        expect(result.data.offlineSnapshot?.savedAt).toBe(SAVED_AT);
    });
});
