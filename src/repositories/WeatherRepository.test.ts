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
