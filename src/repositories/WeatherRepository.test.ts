// src/repositories/WeatherRepository.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { WeatherRepository } from './WeatherRepository';
import { fetchAllWeatherData } from '../services/weatherService';
import { getRegionalHDData } from '../services/weatherApi';
import { cacheService } from '../services/cacheService';
import { CACHE_TTL } from '../constants/cacheConfig';
import type { ExtendedWeatherData } from '../types/weatherLogicTypes';
import type { AirQualityData, WeatherData } from '../types/weather';
import type { FetchResult } from '../services/weatherService';

// Cache en memòria: el TTL de 15 minuts el posa cacheService (aquí no es prova); el que es prova és el que decideix
// el repositori (desar o no la marca i reaprofitar o no el paquet).
const { store } = vi.hoisted(() => ({ store: new Map<string, unknown>() }));

vi.mock('@sentry/react', () => ({ captureException: vi.fn(), addBreadcrumb: vi.fn() }));
vi.mock('../services/cacheService', () => ({
    cacheService: {
        generateWeatherKey: (lat: number, lon: number, unit: string, lang: string) => `weather_${lat}_${lon}_${unit}_${lang}`,
        get: vi.fn(async (key: string) => store.get(key) ?? null),
        set: vi.fn(async (key: string, data: unknown) => { store.set(key, data); })
    }
}));
vi.mock('../services/weatherService', () => ({ fetchAllWeatherData: vi.fn() }));
vi.mock('../services/weatherApi', () => ({ getRegionalHDData: vi.fn() }));

const GIRONA = { lat: 41.98, lon: 2.82 };        // zona d'AROME HD
const CAPE_TOWN = { lat: -33.92, lon: 18.42 };   // cap model regional

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

    it('un paquet antic (d\'abans d\'aquest canvi, sense camps) es reaprofita com sempre', async () => {
        store.set(`weather_${GIRONA.lat}_${GIRONA.lon}_C_ca`, { weather: { current: { source: 'AROME HD' } }, aqi: null });
        const result = await load(GIRONA, workerOk);
        expect(fetchAllWeatherData).not.toHaveBeenCalled();
        expect(result.data.current.source).toBe('AROME HD');
    });
});
