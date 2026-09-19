// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Sense xarxa ni IndexedDB: cache sempre buida i sense escriptura.
vi.mock('./cacheService', () => ({
    cacheService: {
        get: vi.fn().mockResolvedValue(null),
        set: vi.fn().mockResolvedValue(undefined),
        generateAiKey: vi.fn().mockReturnValue('test-ai-key'),
    },
}));

import { getGeminiAnalysis } from './geminiService';
import type { ExtendedWeatherData } from '../types/weatherLogicTypes';

const FOG_DESC = 'Boira o boira baixa';

/**
 * Sèries d'una nit amb el senyal de boira del model global (ICON: codi 45 + visibilitat < 1 km),
 * com les que rep l'app a Vic (18→19/09/2026). Només varia la humitat: amb HR 94 % (T−Td ≈ 1 °C)
 * la saturació NO confirma la boira; amb HR 99 % sí.
 */
const buildWeather = (rh: number): ExtendedWeatherData => {
    const n = 8;
    const arr = <T,>(v: T) => Array.from({ length: n }, () => v);
    return {
        elevation: 504,
        latitude: 41.93,
        longitude: 2.25,
        utc_offset_seconds: 7200,
        timezone: 'Europe/Madrid',
        current: {
            time: '2026-09-19T00:00',
            weather_code: 45,                 // codi BRUT d'ICON
            temperature_2m: 15.2,
            apparent_temperature: 15,
            relative_humidity_2m: rh,
            wind_speed_10m: 3,
            is_day: 0,
            precipitation: 0,
        },
        hourly: {
            time: Array.from({ length: n }, (_, i) => `2026-09-19T0${i}:00`),
            weather_code: arr(45),
            visibility: arr(840),
            temperature_2m: arr(15.2),
            apparent_temperature: arr(15),
            relative_humidity_2m: arr(rh),
            precipitation: arr(0),
            precipitation_probability: arr(0),
            // Capa baixa: la boira n'implica una (la política de boira exigeix >= CLOUDS.FOG_MIN_LOW).
            cloud_cover_low: arr(100),
            cloud_cover_mid: arr(0),
            cloud_cover_high: arr(0),
            wind_speed_10m: arr(3),
            wind_gusts_10m: arr(5),
            is_day: arr(0),
            cape: arr(0),
            freezing_level_height: arr(4000),
        },
        daily: { time: ['2026-09-19'] },
        hourlyComparison: {},
    } as unknown as ExtendedWeatherData;
};

/** Executa getGeminiAnalysis amb un worker simulat que respon `llmRisk`; retorna prompt enviat + resultat. */
const run = async (weather: ExtendedWeatherData, effectiveCode: number | null, llmRisk: 'GREEN' | 'AMBER' = 'GREEN') => {
    const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
            engine: 'gemini',
            candidates: [{ content: { parts: [{ text: JSON.stringify({
                risk_level: llmRisk, hazard_type: llmRisk === 'GREEN' ? 'NONE' : 'VISIBILITY',
                tactical_reasoning: 'x', text: 'Resum.', tips: []
            }) }] } }],
        }),
    });
    vi.stubGlobal('fetch', fetchMock);
    const result = await getGeminiAnalysis(weather, 'ca', effectiveCode);
    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string) as { prompt: string };
    return { prompt: body.prompt, result };
};

describe('getGeminiAnalysis — política de boira', () => {
    beforeEach(() => { vi.restoreAllMocks(); });

    it('amb ICON dient boira però la saturació NO ho confirma, el prompt no parla de boira i no hi ha AMBER forçat', async () => {
        const { prompt, result } = await run(buildWeather(94), 3);
        expect(prompt).not.toContain(FOG_DESC);
        expect(result?.risk_level).toBe('GREEN');
        expect(result?.hazard_type).not.toBe('VISIBILITY');
    });

    it('amb saturació confirmada, el prompt descriu la boira i el tallafocs força AMBER/VISIBILITY encara que la IA digui GREEN', async () => {
        const { prompt, result } = await run(buildWeather(99), 45);
        expect(prompt).toContain(FOG_DESC);
        expect(result?.risk_level).toBe('AMBER');
        expect(result?.hazard_type).toBe('VISIBILITY');
    });

    it('l\'"Estat del Cel" actual és el codi que veu l\'usuari (effectiveCode), no el brut del model', async () => {
        const { prompt } = await run(buildWeather(94), 3);
        expect(prompt).toContain('Estat del Cel: De poc núvol a cobert');
    });

    it('sense effectiveCode, l\'estat del cel actual cau al codi brut del model', async () => {
        const { prompt } = await run(buildWeather(94), null);
        expect(prompt).toContain(`Estat del Cel: ${FOG_DESC}`);
    });

    it('el tallafocs de tempesta segueix anant sobre el codi brut (dades crues guanyen)', async () => {
        const weather = buildWeather(94);
        (weather.hourly as unknown as Record<string, number[]>).weather_code = Array.from({ length: 8 }, () => 95);
        const { result } = await run(weather, 3);
        expect(result?.risk_level).toBe('AMBER');
        expect(result?.hazard_type).toBe('CONVECTIVE');
    });
});
