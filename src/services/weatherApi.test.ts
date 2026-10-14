// src/services/weatherApi.test.ts
// Política de reintents davant d'Open-Meteo (vegeu fetchWithRetry): un sol intent llarg per a les peticions a
// api.open-meteo.com, reintents espaiats (3 s, 8 s) quan torna 5xx o cau la xarxa, i cap reintent amb un 4xx (429).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as Sentry from '@sentry/react';
import { getWeatherData, getAirQualityData, getRegionalHDData } from './weatherApi';
import { REGIONAL_MODELS } from '../constants/regionalModels';

vi.mock('@sentry/react', () => ({ captureException: vi.fn(), addBreadcrumb: vi.fn() }));

const BODY = { latitude: 41.98, longitude: 2.82 };
const ok = () => new Response(JSON.stringify(BODY), { status: 200, headers: { 'Content-Type': 'application/json' } });
const status = (code: number, text = '') => new Response('{"error":true}', { status: code, statusText: text });

// Com el fetch del navegador: només acaba quan l'AbortController del temps d'espera l'avorta.
const hangUntilAborted = (_url: string, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
    init?.signal?.addEventListener('abort', () => reject(new DOMException('The operation was aborted.', 'AbortError')));
});

const fetchMock = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>();

// Deixa córrer el rellotge fals i les promeses pendents fins a `ms`.
const advance = (ms: number) => vi.advanceTimersByTimeAsync(ms);

describe('fetchWithRetry — política de reintents', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.clearAllMocks();
        fetchMock.mockReset();
        vi.stubGlobal('fetch', fetchMock);
        vi.spyOn(console, 'warn').mockImplementation(() => {});
        vi.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });

    it('amb 503 reintenta als 3 s i als 8 s, i arriba la previsió', async () => {
        fetchMock.mockResolvedValueOnce(status(503)).mockResolvedValueOnce(status(503)).mockResolvedValueOnce(ok());

        const result = getWeatherData(41.98, 2.82, 'C');
        await advance(0);
        expect(fetchMock).toHaveBeenCalledTimes(1);

        await advance(2999);
        expect(fetchMock).toHaveBeenCalledTimes(1);
        await advance(1);
        expect(fetchMock).toHaveBeenCalledTimes(2);

        await advance(7999);
        expect(fetchMock).toHaveBeenCalledTimes(2);
        await advance(1);
        expect(fetchMock).toHaveBeenCalledTimes(3);

        await expect(result).resolves.toMatchObject(BODY);
        expect(Sentry.captureException).not.toHaveBeenCalled();
    });

    it('tres 503 seguits: falla després dels 3 intents amb l\'estat a Sentry', async () => {
        fetchMock.mockResolvedValue(status(503));

        const result = getWeatherData(41.98, 2.82, 'C');
        const settled = expect(result).rejects.toThrow('Server Error: 503');
        await advance(11000);
        await settled;

        expect(fetchMock).toHaveBeenCalledTimes(3);
        expect(Sentry.captureException).toHaveBeenCalledTimes(1);
        expect(vi.mocked(Sentry.captureException).mock.calls[0][1]).toMatchObject({
            tags: { type: 'network_critical', context: 'getWeatherData', http_status: '503' },
            extra: { attempts: 3 }
        });
    });

    it('un 429 (quota d\'Open-Meteo) no es reintenta', async () => {
        fetchMock.mockResolvedValue(status(429, 'Too Many Requests'));

        const result = getWeatherData(41.98, 2.82, 'C');
        const settled = expect(result).rejects.toThrow('API Error: 429 Too Many Requests');
        await advance(20000);
        await settled;

        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(vi.mocked(Sentry.captureException).mock.calls[0][1]).toMatchObject({
            tags: { http_status: '429' },
            extra: { attempts: 1 }
        });
    });

    it('cap altre 4xx no es reintenta tampoc', async () => {
        fetchMock.mockResolvedValue(status(400, 'Bad Request'));

        const settled = expect(getAirQualityData(41.98, 2.82)).rejects.toThrow('API Error: 400');
        await advance(20000);
        await settled;

        expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('una caiguda de xarxa ("Failed to fetch") sí que es reintenta', async () => {
        fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch')).mockResolvedValueOnce(ok());

        const result = getWeatherData(41.98, 2.82, 'C');
        await advance(3000);

        await expect(result).resolves.toMatchObject(BODY);
        expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it('la petició principal espera fins a 25 s en un sol intent (no la talla als 10 s)', async () => {
        fetchMock.mockImplementation(hangUntilAborted);

        const result = getWeatherData(41.98, 2.82, 'C');
        const settled = expect(result).rejects.toMatchObject({ name: 'AbortError' });

        await advance(10000);
        expect(fetchMock.mock.calls[0][1]?.signal?.aborted).toBe(false);
        await advance(14999);
        expect(fetchMock.mock.calls[0][1]?.signal?.aborted).toBe(false);
        await advance(1);
        await settled;

        await advance(30000);
        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(vi.mocked(Sentry.captureException).mock.calls[0][1]).toMatchObject({
            tags: { type: 'network_timeout' },
            extra: { attempts: 1, is_timeout: true }
        });
    });

    it('si el servidor respon dins els 25 s, arriba la previsió', async () => {
        fetchMock.mockImplementation(() => new Promise<Response>(resolve => setTimeout(() => resolve(ok()), 14000)));

        const result = getWeatherData(41.98, 2.82, 'C');
        await advance(14000);

        await expect(result).resolves.toMatchObject(BODY);
        expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('el model regional (mateix servidor, en cua darrere la principal) té el mateix marge de 25 s', async () => {
        fetchMock.mockImplementation(hangUntilAborted);

        const settled = expect(getRegionalHDData(41.98, 2.82, REGIONAL_MODELS[0])).rejects.toMatchObject({ name: 'AbortError' });
        await advance(24999);
        expect(fetchMock.mock.calls[0][1]?.signal?.aborted).toBe(false);
        await advance(1);
        await settled;

        await advance(30000);
        expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('la qualitat de l\'aire (un altre servidor, secundària) es talla als 10 s i no es reintenta', async () => {
        fetchMock.mockImplementation(hangUntilAborted);

        const settled = expect(getAirQualityData(41.98, 2.82)).rejects.toMatchObject({ name: 'AbortError' });
        await advance(10000);
        await settled;

        await advance(30000);
        expect(fetchMock).toHaveBeenCalledTimes(1);
    });
});
