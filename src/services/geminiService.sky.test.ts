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

// Els codis 1, 2 i 3 (i el "molt ennuvolat" de dins del 2) es descrivien tots com "De poc núvol a cobert":
// la IA no podia distingir un cel majoritàriament serè d'un de cobert, i el seu resum no coincidia amb la
// capçalera ("Molt ennuvolat"). Ara la descripció segueix el mateix criteri que la capçalera i les icones.

const SERE = 'Cel ras / Completament serè';
const MAJORITARIAMENT_SERE = 'Majoritàriament serè (pocs núvols)';
const PARCIAL = 'Parcialment ennuvolat (cel variable)';
const MOLT_ENNUVOLAT = 'Molt ennuvolat (cel majoritàriament tapat, amb clarianes)';
const COBERT = 'Cobert (cel completament tapat)';

/** 8 hores serenes; `lowClouds[i]` fixa el % de núvols baixos de l'hora i (mitjans i alts a 0). */
const buildWeather = (lowClouds: number[]): ExtendedWeatherData => {
    const n = 8;
    const arr = <T,>(v: T) => Array.from({ length: n }, () => v);
    const at = (i: number) => lowClouds[i] ?? lowClouds[lowClouds.length - 1];
    return {
        elevation: 504,
        latitude: 41.93,
        longitude: 2.25,
        utc_offset_seconds: 7200,
        timezone: 'Europe/Madrid',
        current: {
            time: '2026-09-19T12:00', weather_code: 2, temperature_2m: 22, apparent_temperature: 22,
            relative_humidity_2m: 50, wind_speed_10m: 3, is_day: 1, precipitation: 0,
        },
        hourly: {
            time: Array.from({ length: n }, (_, i) => `2026-09-19T${String(12 + i).padStart(2, '0')}:00`),
            weather_code: arr(2), visibility: arr(20000), temperature_2m: arr(22), apparent_temperature: arr(22),
            relative_humidity_2m: arr(50), precipitation: arr(0), precipitation_probability: arr(0),
            cloud_cover_low: Array.from({ length: n }, (_, i) => at(i)), cloud_cover_mid: arr(0), cloud_cover_high: arr(0),
            wind_speed_10m: arr(3), wind_gusts_10m: arr(5), is_day: arr(1), cape: arr(0), freezing_level_height: arr(4000),
        },
        daily: { time: ['2026-09-19'] },
        hourlyComparison: {},
    } as unknown as ExtendedWeatherData;
};

const promptFor = async (weather: ExtendedWeatherData, effectiveCode: number | null, cloudCover: number | null) => {
    const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
            engine: 'gemini',
            candidates: [{ content: { parts: [{ text: JSON.stringify({
                risk_level: 'GREEN', hazard_type: 'NONE', tactical_reasoning: 'x', text: 'Resum.', tips: [],
            }) }] } }],
        }),
    });
    vi.stubGlobal('fetch', fetchMock);
    await getGeminiAnalysis(weather, 'ca', effectiveCode, null, cloudCover);
    return (JSON.parse(fetchMock.mock.calls[0][1].body as string) as { prompt: string }).prompt;
};

const currentSky = (prompt: string) => prompt.match(/Estat del Cel: (.*)/)?.[1] ?? '';
const hourSky = (prompt: string, hh: string) => prompt.match(new RegExp(`\\| ${hh} \\| ([^|]*) \\|`))?.[1] ?? '';

describe('getGeminiAnalysis — estat del cel (codis 0/1/2/3)', () => {
    beforeEach(() => { vi.restoreAllMocks(); });

    it('els quatre codis de cel es descriuen diferent', async () => {
        const w = buildWeather([0]);
        expect(currentSky(await promptFor(w, 0, null))).toBe(SERE);
        expect(currentSky(await promptFor(w, 1, null))).toBe(MAJORITARIAMENT_SERE);
        expect(currentSky(await promptFor(w, 2, null))).toBe(PARCIAL);
        expect(currentSky(await promptFor(w, 3, null))).toBe(COBERT);
    });

    it('dins del codi 2, per sobre del 70 % efectiu és "molt ennuvolat" (com la capçalera)', async () => {
        const w = buildWeather([0]);
        expect(currentSky(await promptFor(w, 2, 71))).toBe(MOLT_ENNUVOLAT);
        expect(currentSky(await promptFor(w, 2, 84))).toBe(MOLT_ENNUVOLAT);
    });

    it('el límit del 70 % és estricte i, sense dada de núvols, no es finge cap variant', async () => {
        const w = buildWeather([0]);
        expect(currentSky(await promptFor(w, 2, 70))).toBe(PARCIAL);
        expect(currentSky(await promptFor(w, 2, 50))).toBe(PARCIAL);
        expect(currentSky(await promptFor(w, 2, null))).toBe(PARCIAL);
    });

    it('la variant "molt ennuvolat" només existeix dins del codi 2 (un 3 amb 100 % és simplement cobert)', async () => {
        const w = buildWeather([0]);
        expect(currentSky(await promptFor(w, 3, 100))).toBe(COBERT);
        expect(currentSky(await promptFor(w, 1, 100))).toBe(MAJORITARIAMENT_SERE);
    });

    it('la taula horària descriu cada hora segons el seu propi cel (mateix codi que les icones)', async () => {
        // núvols baixos per hora: 5 (serè), 30 (majoritàriament serè), 60 (parcial), 80 (molt ennuvolat), 95 (cobert)
        const w = buildWeather([5, 30, 60, 80, 95]);
        const prompt = await promptFor(w, 2, 60);
        expect(hourSky(prompt, '12:00')).toBe(SERE);
        expect(hourSky(prompt, '13:00')).toBe(MAJORITARIAMENT_SERE);
        expect(hourSky(prompt, '14:00')).toBe(PARCIAL);
        expect(hourSky(prompt, '15:00')).toBe(MOLT_ENNUVOLAT);
        expect(hourSky(prompt, '16:00')).toBe(COBERT);
    });

    it('cap descripció de cel torna a ser el text genèric "De poc núvol a cobert"', async () => {
        const w = buildWeather([5, 30, 60, 80, 95]);
        for (const code of [0, 1, 2, 3]) {
            expect(await promptFor(w, code, 80)).not.toContain('De poc núvol a cobert');
        }
    });
});
