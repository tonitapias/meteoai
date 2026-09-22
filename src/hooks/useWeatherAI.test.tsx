// src/hooks/useWeatherAI.test.tsx
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

const generateAIPrediction = vi.fn();
const getGeminiAnalysis = vi.fn();

vi.mock('../utils/aiContext', () => ({
    generateAIPrediction: (...args: unknown[]) => generateAIPrediction(...args),
}));
vi.mock('../services/geminiService', () => ({
    getGeminiAnalysis: (...args: unknown[]) => getGeminiAnalysis(...args),
}));

import { useWeatherAI } from './useWeatherAI';
import type { ExtendedWeatherData } from '../types/weatherLogicTypes';

const WEATHER = {
    current: { weather_code: 45, temperature_2m: 15 },
    hourly: { time: [] },
    daily: {},
    location: { latitude: 41.93, longitude: 2.25 },
} as unknown as ExtendedWeatherData;

describe('useWeatherAI — el codi de temps efectiu arriba a les dues IA', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        generateAIPrediction.mockReset().mockReturnValue({ text: 'local', tips: [], alerts: [], confidence: 'x', confidenceLevel: 'high' });
        getGeminiAnalysis.mockReset().mockResolvedValue(null);
    });
    afterEach(() => { vi.useRealTimers(); });

    const flush = async () => { await act(async () => { await vi.advanceTimersByTimeAsync(600); }); };

    it('passa effectiveCode a la predicció local (5è paràmetre = 6è argument) i a Gemini', async () => {
        renderHook(() => useWeatherAI(WEATHER, null, 'ca', 'C', null, 3));
        await flush();

        // generateAIPrediction(current, daily, hourly, aqi, lang, effectiveCode, reliability, unit)
        expect(generateAIPrediction).toHaveBeenCalledTimes(1);
        expect(generateAIPrediction.mock.calls[0][5]).toBe(3);
        // getGeminiAnalysis(weatherData, lang, effectiveCode)
        expect(getGeminiAnalysis).toHaveBeenCalledTimes(1);
        expect(getGeminiAnalysis.mock.calls[0][2]).toBe(3);
    });

    it('sense effectiveCode, passa null (comportament anterior: codi brut)', async () => {
        renderHook(() => useWeatherAI(WEATHER, null, 'ca', 'C', null));
        await flush();
        expect(generateAIPrediction.mock.calls[0][5]).toBeNull();
        expect(getGeminiAnalysis.mock.calls[0][2]).toBeNull();
    });

    it('si el codi efectiu canvia (p.ex. la boira es confirma), l\'anàlisi es recalcula', async () => {
        const { rerender } = renderHook(
            ({ code }: { code: number | null }) => useWeatherAI(WEATHER, null, 'ca', 'C', null, code),
            { initialProps: { code: 3 as number | null } }
        );
        await flush();
        rerender({ code: 45 });
        await flush();

        expect(generateAIPrediction).toHaveBeenCalledTimes(2);
        expect(generateAIPrediction.mock.calls[1][5]).toBe(45);
    });

    it('passa el % efectiu de núvols a Gemini (5è paràmetre) perquè descrigui el cel com la capçalera', async () => {
        renderHook(() => useWeatherAI(WEATHER, null, 'ca', 'C', null, 2, 78));
        await flush();
        // getGeminiAnalysis(weatherData, lang, effectiveCode, aqiData, effectiveCloudCover)
        expect(getGeminiAnalysis.mock.calls[0][4]).toBe(78);
    });

    it('només recalcula quan canvia la variant "molt ennuvolat", no a cada canvi del % de núvols', async () => {
        const { rerender } = renderHook(
            ({ clouds }: { clouds: number }) => useWeatherAI(WEATHER, null, 'ca', 'C', null, 2, clouds),
            { initialProps: { clouds: 72 } }
        );
        await flush();
        rerender({ clouds: 78 });   // segueix "molt ennuvolat"
        await flush();
        expect(getGeminiAnalysis).toHaveBeenCalledTimes(1);

        rerender({ clouds: 60 });   // passa a "parcialment ennuvolat"
        await flush();
        expect(getGeminiAnalysis).toHaveBeenCalledTimes(2);
        expect(getGeminiAnalysis.mock.calls[1][4]).toBe(60);
    });
});

// L'anàlisi s'espera 500 ms abans de cridar la IA. Abans, la clau es donava per "processada" en programar l'espera: si
// durant aquells 500 ms arribaven dades noves amb la mateixa clau (p. ex. un refresc), la neteja de l'efecte cancel·lava
// l'espera i el nou efecte ja no en programava cap altra. L'anàlisi no es feia mai i es quedava a la pantalla l'anterior
// (amb la seva insígnia), d'una altra consulta.
describe("useWeatherAI — l'espera de 500 ms no es perd", () => {
    beforeEach(() => {
        vi.useFakeTimers();
        generateAIPrediction.mockReset().mockReturnValue({ text: 'local', tips: [], alerts: [], confidence: 'x', confidenceLevel: 'high' });
        getGeminiAnalysis.mockReset().mockResolvedValue(null);
    });
    afterEach(() => { vi.useRealTimers(); });

    const advance = async (ms: number) => { await act(async () => { await vi.advanceTimersByTimeAsync(ms); }); };

    it("si arriben dades noves amb la mateixa clau durant l'espera, l'anàlisi es fa igualment (amb les dades noves)", async () => {
        const { rerender } = renderHook(
            ({ wd }: { wd: ExtendedWeatherData }) => useWeatherAI(wd, null, 'ca', 'C', null, 3),
            { initialProps: { wd: WEATHER } }
        );
        await advance(200);
        const refreshed = { ...WEATHER, current: { ...WEATHER.current } } as ExtendedWeatherData;
        rerender({ wd: refreshed });
        await advance(600);

        expect(generateAIPrediction).toHaveBeenCalledTimes(1);
        expect(generateAIPrediction.mock.calls[0][0]).toBe(refreshed.current);
        expect(getGeminiAnalysis).toHaveBeenCalledTimes(1);
        expect(getGeminiAnalysis.mock.calls[0][0]).toBe(refreshed);
    });

    it('un cop feta, la mateixa clau no es torna a analitzar', async () => {
        const { rerender } = renderHook(
            ({ wd }: { wd: ExtendedWeatherData }) => useWeatherAI(wd, null, 'ca', 'C', null, 3),
            { initialProps: { wd: WEATHER } }
        );
        await advance(600);
        rerender({ wd: { ...WEATHER } as ExtendedWeatherData });
        await advance(600);
        expect(generateAIPrediction).toHaveBeenCalledTimes(1);
        expect(getGeminiAnalysis).toHaveBeenCalledTimes(1);
    });

    it("la resposta de la IA d'una consulta anterior no s'aplica mentre la nova espera", async () => {
        let resolveOld: (v: unknown) => void = () => {};
        getGeminiAnalysis.mockReset()
            .mockImplementationOnce(() => new Promise(r => { resolveOld = r; }))
            .mockResolvedValue(null);
        const { result, rerender } = renderHook(
            ({ code }: { code: number }) => useWeatherAI(WEATHER, null, 'ca', 'C', null, code),
            { initialProps: { code: 3 } }
        );
        await advance(600);                 // la consulta vella ja espera la IA
        rerender({ code: 45 });             // consulta nova: comença la seva espera de 500 ms
        await act(async () => { resolveOld({ text: 'text vell', tips: [] }); });
        await advance(100);                 // encara dins l'espera de la nova

        expect(result.current.aiAnalysis?.text).not.toBe('text vell');
    });

    it("tornar a la clau ja analitzada durant l'espera d'una altra no la repeteix, i la seva IA sí que s'aplica", async () => {
        let resolveFirst: (v: unknown) => void = () => {};
        getGeminiAnalysis.mockReset()
            .mockImplementationOnce(() => new Promise(r => { resolveFirst = r; }))
            .mockResolvedValue(null);
        const { result, rerender } = renderHook(
            ({ code }: { code: number }) => useWeatherAI(WEATHER, null, 'ca', 'C', null, code),
            { initialProps: { code: 3 } }
        );
        await advance(600);
        rerender({ code: 45 });
        await advance(100);
        rerender({ code: 3 });              // torna a la primera abans que la segona arrenqui
        await act(async () => { resolveFirst({ text: 'text bo', tips: [] }); });
        await advance(600);

        expect(generateAIPrediction).toHaveBeenCalledTimes(1);
        expect(result.current.aiAnalysis?.text).toBe('text bo');
    });

    it("tornar a una clau quan a la pantalla ja hi ha l'anàlisi d'una altra: la IA vella no s'hi barreja, es refà", async () => {
        let resolveFirst: (v: unknown) => void = () => {};
        getGeminiAnalysis.mockReset()
            .mockImplementationOnce(() => new Promise(r => { resolveFirst = r; }))
            .mockResolvedValue(null);
        const { result, rerender } = renderHook(
            ({ code }: { code: number }) => useWeatherAI(WEATHER, null, 'ca', 'C', null, code),
            { initialProps: { code: 3 } }
        );
        await advance(600);
        rerender({ code: 45 });
        await advance(600);                 // la segona ja és a la pantalla
        rerender({ code: 3 });              // es torna a la primera: comença la seva espera
        await act(async () => { resolveFirst({ text: 'text vell', tips: [] }); });
        await advance(100);
        expect(result.current.aiAnalysis?.text).not.toBe('text vell');

        await advance(600);
        expect(generateAIPrediction).toHaveBeenCalledTimes(3);
        expect(generateAIPrediction.mock.calls[2][5]).toBe(3);
    });
});
