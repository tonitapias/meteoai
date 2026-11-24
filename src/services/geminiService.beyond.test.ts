// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('./cacheService', () => ({
    cacheService: {
        get: vi.fn().mockResolvedValue(null),
        set: vi.fn().mockResolvedValue(undefined),
        generateAiKey: vi.fn().mockReturnValue('test-ai-key'),
    },
}));

import { getGeminiAnalysis, dayPartCa, describeBeyondWindow } from './geminiService';
import type { ExtendedWeatherData } from '../types/weatherLogicTypes';

// Auditoria d'UX del 16/11/2026 (M1): a Puigcerdà, a les 20:27, la IA deia "Cap al vespre, el cel es cobrirà" (ja era
// vespre), i a Buenos Aires deia "temps tranquil" amb una tempesta i 24 mm l'endemà, fora de la finestra de 6 hores.

/** 48 hores des del 16/11 a les 20:00, seques i en calma; `at` hi posa valors a hores concretes. */
const buildWeather = (at: Record<string, Record<number, number>> = {}): ExtendedWeatherData => {
    const n = 48;
    const series = (key: string, base: number) => Array.from({ length: n }, (_, i) => at[key]?.[i] ?? base);
    const time = Array.from({ length: n }, (_, i) => {
        const d = new Date(Date.UTC(2026, 10, 16, 20 + i));
        return d.toISOString().slice(0, 16);
    });
    return {
        elevation: 25, latitude: -34.6, longitude: -58.4, utc_offset_seconds: 0, timezone: 'UTC',
        current: { time: time[0], weather_code: 1, temperature_2m: 22, apparent_temperature: 22, relative_humidity_2m: 60, wind_speed_10m: 8, is_day: 0, precipitation: 0 },
        hourly: {
            time, weather_code: series('weather_code', 1), visibility: series('visibility', 20000), temperature_2m: series('temperature_2m', 22),
            apparent_temperature: series('apparent_temperature', 22), relative_humidity_2m: series('relative_humidity_2m', 60),
            precipitation: series('precipitation', 0), precipitation_probability: series('precipitation_probability', 0),
            cloud_cover_low: series('cloud_cover_low', 10), cloud_cover_mid: series('cloud_cover_mid', 0), cloud_cover_high: series('cloud_cover_high', 0),
            wind_speed_10m: series('wind_speed_10m', 8), wind_gusts_10m: series('wind_gusts_10m', 15), is_day: series('is_day', 0),
            cape: series('cape', 0), freezing_level_height: series('freezing_level_height', 4000),
        },
        daily: { time: ['2026-11-16', '2026-11-17', '2026-11-18'] },
        hourlyComparison: {},
    } as unknown as ExtendedWeatherData;
};

const promptFor = async (weather: ExtendedWeatherData) => {
    const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ engine: 'gemini', candidates: [{ content: { parts: [{ text: JSON.stringify({
            risk_level: 'GREEN', hazard_type: 'NONE', tactical_reasoning: 'x', text: 'Resum.', tips: [],
        }) }] } }] }),
    });
    vi.stubGlobal('fetch', fetchMock);
    await getGeminiAnalysis(weather, 'ca', 1, null, 10);
    return (JSON.parse(fetchMock.mock.calls[0][1].body as string) as { prompt: string }).prompt;
};

describe('dayPartCa — el moment del dia de cada hora', () => {
    it('matinada, matí, migdia, tarda, vespre i nit', () => {
        expect([3, 8, 13, 17, 20, 22, 23].map(dayPartCa)).toEqual(['matinada', 'matí', 'migdia', 'tarda', 'vespre', 'vespre', 'nit']);
    });
});

describe('describeBeyondWindow — el que passa més enllà de les 6 hores', () => {
    beforeEach(() => { vi.restoreAllMocks(); });

    it('sense res important, null', () => {
        expect(describeBeyondWindow(buildWeather(), 0, 6)).toBeNull();
    });

    it('una tempesta i pluja forta l\'endemà, amb el dia, la data i la franja horària', () => {
        // Hora 19 = 17/11 a les 15:00 (demà); hora 28 = 18/11 a les 00:00 (dimecres).
        const w = buildWeather({ weather_code: { 19: 95 }, precipitation: { 19: 12, 20: 24 }, cape: { 19: 1500 }, cloud_cover_low: { 19: 100, 20: 100 }, wind_gusts_10m: { 28: 70 } });
        const text = describeBeyondWindow(w, 0, 6)!;
        expect(text).toContain('tempesta demà (dimarts 17/11) cap a les 15:00');
        expect(text).toContain('pluja forta demà (dimarts 17/11) de 15:00 a 16:00 (fins a 24 mm/h)');
        expect(text).toContain('ratxes fortes dimecres 18/11 cap a les 00:00 (fins a 70 km/h)');
    });

    it('cada dia porta el seu pic: no s\'atribueix a demà el màxim de demà passat', () => {
        // Hora 6 = 17/11 a les 02:00 (demà, 55 km/h); hora 19 = 17/11 a les 15:00 (demà, 60); hora 46 = 18/11 a les 18:00
        // (dimecres, 75). Abans: "ratxes fortes demà cap a les 02:00 (fins a 75 km/h)".
        const w = buildWeather({ wind_gusts_10m: { 6: 55, 19: 60, 46: 75 } });
        expect(describeBeyondWindow(w, 0, 6)).toBe('ratxes fortes demà (dimarts 17/11) de 02:00 a 15:00 (fins a 60 km/h) i dimecres 18/11 cap a les 18:00 (fins a 75 km/h)');
    });

    it('les hores de dins la finestra de 6 hores no hi compten', () => {
        expect(describeBeyondWindow(buildWeather({ wind_gusts_10m: { 3: 70 } }), 0, 6)).toBeNull();
    });
});

describe('getGeminiAnalysis — moment del dia i més enllà de 6 h al prompt', () => {
    beforeEach(() => { vi.restoreAllMocks(); });

    it('la línia de l\'hora diu que ja és vespre', async () => {
        const prompt = await promptFor(buildWeather());
        expect(prompt).toMatch(/HORA LOCAL ACTUAL A LA ZONA: 20:00 \(.*ara és vespre/);
        expect(prompt).toContain('no diguis "cap al vespre" si ja ho és');
        expect(prompt).not.toContain('MÉS ENLLÀ DE LES 6 HORES');
    });

    it('amb ratxes fortes l\'endemà, el prompt ho diu i demana una frase al final', async () => {
        const prompt = await promptFor(buildWeather({ wind_gusts_10m: { 20: 65 } }));
        expect(prompt).toContain('MÉS ENLLÀ DE LES 6 HORES (fins a 48 h; no compta per al nivell de risc d\'ara): ratxes fortes demà (dimarts 17/11) cap a les 16:00 (fins a 65 km/h). Esmenta-ho en una frase curta al final del text, amb el dia tal com surt aquí');
        expect(prompt.length).toBeLessThan(4000);
    });

    it('el prompt diu quin dia és avui i marca amb "demà" les hores de després de mitjanit', async () => {
        // 16/11 a les 20:00: la finestra de 6 hores arriba a la 01:00 del 17/11.
        const prompt = await promptFor(buildWeather());
        expect(prompt).toContain("DIA D'AVUI A LA ZONA: dilluns 16/11/2026 (les hores sense dia són d'avui; demà és dimarts 17/11)");
        expect(prompt).toContain('| 23:00 |');
        expect(prompt).toContain('| demà 00:00 |');
        expect(prompt).toContain('| demà 01:00 |');
    });
});
