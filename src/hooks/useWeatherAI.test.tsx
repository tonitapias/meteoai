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
});
