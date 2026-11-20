// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Sense xarxa ni IndexedDB: cache buida per defecte (cada test en pot simular una).
vi.mock('./cacheService', () => ({
    cacheService: {
        get: vi.fn().mockResolvedValue(null),
        set: vi.fn().mockResolvedValue(undefined),
        generateAiKey: vi.fn().mockReturnValue('test-ai-key'),
    },
}));

import { getGeminiAnalysis, evaluateRulesRisk, type AICacheData, type AiAirQualityInput, type RiskDetail } from './geminiService';
import type { LightningNearby } from './lightningService';
import { cacheService } from './cacheService';
import type { ExtendedWeatherData } from '../types/weatherLogicTypes';

// El bàner "Motiu" (AIInsights) cita la xifra i l'hora que han fet saltar el tallafocs. Han de ser el PIC de la finestra
// de 6 hores (el mateix que el "RESUM CALCULAT" que llegeix la IA) i només s'adjunten si expliquen exactament el nivell
// i el perill finals.

/** 8 hores d'una nit de setembre (sense correcció d'inversió), seca i sense res: cada test hi posa el seu perill. */
const buildWeather = (overrides: Record<string, unknown[]> = {}): ExtendedWeatherData => {
    const n = 8;
    const arr = <T,>(v: T) => Array.from({ length: n }, () => v);
    return {
        elevation: 504,
        latitude: 41.93,
        longitude: 2.25,
        utc_offset_seconds: 7200,
        timezone: 'Europe/Madrid',
        current: {
            time: '2026-09-19T00:00', weather_code: 0, temperature_2m: 15, apparent_temperature: 15,
            relative_humidity_2m: 50, wind_speed_10m: 3, is_day: 0, precipitation: 0,
        },
        hourly: {
            time: Array.from({ length: n }, (_, i) => `2026-09-19T0${i}:00`),
            weather_code: arr(0), visibility: arr(20000), temperature_2m: arr(15), apparent_temperature: arr(15),
            relative_humidity_2m: arr(50), precipitation: arr(0), precipitation_probability: arr(0),
            cloud_cover_low: arr(0), cloud_cover_mid: arr(0), cloud_cover_high: arr(0),
            wind_speed_10m: arr(3), wind_gusts_10m: arr(5), is_day: arr(0), cape: arr(0), freezing_level_height: arr(4000),
            ...overrides,
        },
        daily: { time: ['2026-09-19'] },
        hourlyComparison: {},
    } as unknown as ExtendedWeatherData;
};

/** getGeminiAnalysis amb un worker simulat que respon `risk`/`hazard`. */
const analyse = async (weather: ExtendedWeatherData, risk = 'GREEN', hazard = 'NONE', aqi: AiAirQualityInput | null = null) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
            engine: 'gemini',
            candidates: [{ content: { parts: [{ text: JSON.stringify({
                risk_level: risk, hazard_type: hazard, tactical_reasoning: 'x', text: 'Resum.', tips: [],
            }) }] } }],
        }),
    }));
    return getGeminiAnalysis(weather, 'ca', 0, aqi);
};

// Ràfegues: el pic (62) és a les 02:00; la primera hora per sobre de 50 és la 01:00 (55).
const WINDY = { wind_gusts_10m: [30, 55, 62, 51, 40, 20, 10, 10] };

describe('getGeminiAnalysis — detall del motiu (risk_detail)', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
        vi.mocked(cacheService.get).mockResolvedValue(null);
        vi.mocked(cacheService.set).mockClear();
    });

    it('vent: la ràfega màxima de la finestra i la seva hora, amb el llindar AMBER', async () => {
        const result = await analyse(buildWeather(WINDY));
        expect(result?.risk_level).toBe('AMBER');
        expect(result?.hazard_type).toBe('WIND');
        expect(result?.risk_detail).toEqual({ level: 'AMBER', hazard: 'WIND', hour: '02:00', value: 62, threshold: 50, event: null });
    });

    it('si la IA diu el mateix nivell i perill que el tallafocs, també hi ha detall', async () => {
        const result = await analyse(buildWeather(WINDY), 'AMBER', 'WIND');
        expect(result?.risk_detail?.value).toBe(62);
    });

    it('si la IA veu un altre perill al mateix nivell (es queda el seu), no hi ha detall: les ràfegues no expliquen la pluja', async () => {
        const result = await analyse(buildWeather(WINDY), 'AMBER', 'RAIN');
        expect(result?.hazard_type).toBe('RAIN');
        expect(result?.risk_detail).toBeUndefined();
    });

    it('si la IA veu més risc que el tallafocs, no hi ha detall (el llindar AMBER no explica un RED)', async () => {
        const result = await analyse(buildWeather(WINDY), 'RED', 'WIND');
        expect(result?.risk_level).toBe('RED');
        expect(result?.risk_detail).toBeUndefined();
    });

    it('si la IA diu AMBER sense perill i el tallafocs hi posa el seu al mateix nivell, hi ha detall', async () => {
        const result = await analyse(buildWeather(WINDY), 'AMBER', 'NONE');
        expect(result?.hazard_type).toBe('WIND');
        expect(result?.risk_detail?.hazard).toBe('WIND');
    });

    it('sense cap perill (GREEN), no hi ha detall', async () => {
        const result = await analyse(buildWeather());
        expect(result?.risk_level).toBe('GREEN');
        expect(result?.risk_detail).toBeUndefined();
    });

    it('pluja RED: el pic en mm/h amb un decimal i el llindar RED', async () => {
        const result = await analyse(buildWeather({ precipitation: [0, 3, 22.4, 8, 0, 0, 0, 0] }));
        expect(result?.risk_detail).toEqual({ level: 'RED', hazard: 'RAIN', hour: '02:00', value: 22.4, threshold: 20, event: null });
    });

    it('calor: AMBER a la primera hora però RED més tard; cita el pic i el llindar RED', async () => {
        const result = await analyse(buildWeather({ temperature_2m: [36, 38, 41.2, 40.5, 37, 35, 30, 30] }));
        expect(result?.risk_detail).toEqual({ level: 'RED', hazard: 'HEAT', hour: '02:00', value: 41.2, threshold: 40, event: null });
    });

    it('fred: la MÍNIMA de la finestra', async () => {
        const result = await analyse(buildWeather({ temperature_2m: [2, 1, -1.4, -2.6, -1, 0.5, 3, 3] }));
        expect(result?.risk_detail).toEqual({ level: 'AMBER', hazard: 'COLD', hour: '03:00', value: -2.6, threshold: 0, event: null });
    });

    it("el pic es busca només dins la finestra de 6 hores (la ràfega de 90 a les 07:00 no hi compta)", async () => {
        const result = await analyse(buildWeather({ wind_gusts_10m: [30, 55, 52, 51, 40, 20, 10, 90] }));
        expect(result?.risk_detail?.level).toBe('AMBER');
        expect(result?.risk_detail?.value).toBe(55);
        expect(result?.risk_detail?.hour).toBe('01:00');
    });

    it('tempesta amb calamarsa (96): el fenomen i la primera hora, sense xifra', async () => {
        const result = await analyse(buildWeather({ weather_code: [0, 0, 96, 95, 0, 0, 0, 0] }));
        expect(result?.risk_detail).toEqual({ level: 'AMBER', hazard: 'CONVECTIVE', hour: '02:00', value: null, threshold: null, event: 'storm_hail' });
    });

    it('tempesta simple (95) i després calamarsa forta (99, RED): guanya la RED, amb la seva hora', async () => {
        const result = await analyse(buildWeather({ weather_code: [95, 0, 0, 99, 0, 0, 0, 0] }));
        expect(result?.risk_detail).toMatchObject({ level: 'RED', hazard: 'CONVECTIVE', hour: '03:00', event: 'storm_hail' });
    });

    it('neu (73) i pluja gelant (66) es distingeixen', async () => {
        const cold = { temperature_2m: Array.from({ length: 8 }, () => 0.5), apparent_temperature: Array.from({ length: 8 }, () => -2) };
        const snow = await analyse(buildWeather({ ...cold, weather_code: [0, 73, 0, 0, 0, 0, 0, 0] }));
        expect(snow?.risk_detail).toMatchObject({ hazard: 'SNOW_ICE', hour: '01:00', event: 'snow' });
        const freezing = await analyse(buildWeather({ ...cold, weather_code: [0, 0, 66, 0, 0, 0, 0, 0] }));
        expect(freezing?.risk_detail).toMatchObject({ hazard: 'SNOW_ICE', hour: '02:00', event: 'freezing' });
    });

    // Cas real (San Francisco, 20-11-2026): Open-Meteo va servir un 71 (neu) a les 07:00 amb 10 °C, 5,9 mm, la cota de
    // gel a 1630 m i 0 cm de neu. La icona ja el desfeia, però el bàner deia "Neu prevista cap a les 07:00".
    describe('codis de neu o gel bruts impossibles', () => {
        it('neu a 10 °C amb la cota de gel a 1630 m i sense neu: cap avís de neu', async () => {
            const result = await analyse(buildWeather({
                temperature_2m: [9, 9, 9.5, 9.8, 10.1, 9.8, 10, 10], apparent_temperature: Array.from({ length: 8 }, () => 8),
                weather_code: [3, 51, 51, 3, 71, 2, 0, 0], precipitation: [0, 0.2, 0.2, 0, 1.5, 0, 0, 0],
                freezing_level_height: Array.from({ length: 8 }, () => 1630), snowfall: Array.from({ length: 8 }, () => 0),
            }));
            expect(result?.hazard_type).not.toBe('SNOW_ICE');
            expect(result?.risk_detail?.event).not.toBe('snow');
        });

        it('pluja gelant a 10 °C: cap avís de gel', async () => {
            const result = await analyse(buildWeather({
                temperature_2m: Array.from({ length: 8 }, () => 10), weather_code: [0, 0, 66, 0, 0, 0, 0, 0],
            }));
            expect(result?.hazard_type).not.toBe('SNOW_ICE');
        });

        it('a 6 °C però amb neu al model (snowfall > 0): l\'avís es manté', async () => {
            const result = await analyse(buildWeather({
                temperature_2m: Array.from({ length: 8 }, () => 6), weather_code: [0, 71, 0, 0, 0, 0, 0, 0],
                snowfall: [0, 0.3, 0, 0, 0, 0, 0, 0],
            }));
            expect(result?.risk_detail).toMatchObject({ hazard: 'SNOW_ICE', hour: '01:00', event: 'snow' });
        });

        it('a 6 °C amb la cota de gel tocant al terra: l\'avís es manté', async () => {
            const result = await analyse(buildWeather({
                temperature_2m: Array.from({ length: 8 }, () => 6), weather_code: [0, 71, 0, 0, 0, 0, 0, 0],
                freezing_level_height: Array.from({ length: 8 }, () => 650),
            }));
            expect(result?.risk_detail).toMatchObject({ hazard: 'SNOW_ICE', event: 'snow' });
        });
    });

    // Cas real (Norilsk, 13-10-2026): neu i temperatura sota zero alhora. El tallafocs es queda la neu (el codi es mira
    // abans que la temperatura a cada hora), però si la IA tria el fred al mateix nivell, el bàner "Motiu: fred" també té detall.
    describe('dos perills al mateix nivell (neu i fred)', () => {
        const SNOWY_COLD = { weather_code: [0, 73, 73, 0, 0, 0, 0, 0], temperature_2m: [1, 0.2, -0.4, -1.8, -1.1, 0.5, 2, 2] };

        it('la IA tria el fred: detall de la mínima', async () => {
            const result = await analyse(buildWeather(SNOWY_COLD), 'AMBER', 'COLD');
            expect(result?.hazard_type).toBe('COLD');
            expect(result?.risk_detail).toEqual({ level: 'AMBER', hazard: 'COLD', hour: '03:00', value: -1.8, threshold: 0, event: null });
        });

        it('la IA tria la neu (o no en tria cap): detall de la neu', async () => {
            const snow = await analyse(buildWeather(SNOWY_COLD), 'AMBER', 'SNOW_ICE');
            expect(snow?.risk_detail).toMatchObject({ hazard: 'SNOW_ICE', hour: '01:00', event: 'snow' });
            const none = await analyse(buildWeather(SNOWY_COLD), 'GREEN', 'NONE');
            expect(none?.hazard_type).toBe('SNOW_ICE');
            expect(none?.risk_detail).toMatchObject({ hazard: 'SNOW_ICE', event: 'snow' });
        });
    });

    it('calima: avís d\'ara mateix, sense hora', async () => {
        const result = await analyse(buildWeather(), 'GREEN', 'NONE', { current: { european_aqi: 94, dust: 388 } });
        expect(result?.risk_detail).toEqual({ level: 'AMBER', hazard: 'AIR_QUALITY', hour: null, value: null, threshold: null, event: 'dust' });
    });

    it('el detall es desa amb la resposta (quadra amb el text de la mateixa finestra)', async () => {
        await analyse(buildWeather(WINDY));
        const saved = vi.mocked(cacheService.set).mock.calls[0][1] as AICacheData;
        expect(saved.risk_detail?.value).toBe(62);
    });

    describe('resposta servida des de la cache', () => {
        const STORED: RiskDetail = { level: 'AMBER', hazard: 'WIND', hour: '23:00', value: 58, threshold: 50, event: null };

        it('sense canvi de nivell, es manté el detall desat (el del text en cache)', async () => {
            vi.mocked(cacheService.get).mockResolvedValueOnce({
                risk_level: 'AMBER', hazard_type: 'WIND', text: 'Vent.', tips: [], engine: 'gemini', risk_detail: STORED,
            } satisfies AICacheData);
            const result = await analyse(buildWeather(WINDY));
            expect(result?.risk_detail).toEqual(STORED);
        });

        it('si el tallafocs puja el nivell sobre la cache, el detall és el nou (el desat no explica el perill nou)', async () => {
            vi.mocked(cacheService.get).mockResolvedValueOnce({
                risk_level: 'GREEN', hazard_type: 'NONE', text: 'Calma.', tips: [], engine: 'gemini',
            } satisfies AICacheData);
            const result = await analyse(buildWeather(WINDY));
            expect(result?.risk_level).toBe('AMBER');
            expect(result?.risk_detail).toMatchObject({ hazard: 'WIND', hour: '02:00', value: 62 });
        });
    });
});

// L'anàlisi provisional (useWeatherAI) porta el nivell de les regles. Abans no en portava cap i la insígnia posava AMBER
// per defecte: "Avís precaució" sense cap motiu fins que arribava la IA (auditoria d'UX del 16/11/2026, A3).
describe('evaluateRulesRisk — l\'avís provisional surt de les regles', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
        vi.mocked(cacheService.get).mockResolvedValue(null);
    });

    it('sense cap perill a les 6 hores, verd i sense motiu', () => {
        expect(evaluateRulesRisk(buildWeather())).toEqual({ risk_level: 'GREEN', hazard_type: 'NONE' });
    });

    it('amb ràfegues de 62 km/h dins la finestra, AMBER per vent amb el mateix detall que la resposta final', async () => {
        const rules = evaluateRulesRisk(buildWeather(WINDY));
        expect(rules.risk_level).toBe('AMBER');
        expect(rules.hazard_type).toBe('WIND');
        expect(rules.risk_detail).toMatchObject({ hazard: 'WIND', hour: '02:00', value: 62, threshold: 50 });
        // La IA diu GREEN: el tallafocs la puja al mateix nivell, perill i detall que l'avís provisional.
        const final = await analyse(buildWeather(WINDY), 'GREEN', 'NONE');
        expect(final?.risk_level).toBe(rules.risk_level);
        expect(final?.hazard_type).toBe(rules.hazard_type);
        expect(final?.risk_detail).toEqual(rules.risk_detail);
    });

    it('l\'avís provisional mai és més alt que el final: la IA només el pot mantenir o pujar', async () => {
        const rules = evaluateRulesRisk(buildWeather(WINDY));
        const final = await analyse(buildWeather(WINDY), 'RED', 'WIND');
        expect(rules.risk_level).toBe('AMBER');
        expect(final?.risk_level).toBe('RED');
    });

    it('les ràfegues fora de les 6 hores no hi compten (mateixa finestra que la IA)', () => {
        expect(evaluateRulesRisk(buildWeather({ wind_gusts_10m: [10, 10, 10, 10, 10, 10, 70, 70] })).risk_level).toBe('GREEN');
    });

    it('la pols (avís d\'aerosols) i els llamps a prop també hi compten', () => {
        expect(evaluateRulesRisk(buildWeather(), 'dust')).toMatchObject({ risk_level: 'AMBER', hazard_type: 'AIR_QUALITY' });
        const lightning: LightningNearby = { nearestKm: 8, bearingDeg: 90, observedAt: 1_790_000_000, intense: false, activeSlots: 1 };
        expect(evaluateRulesRisk(buildWeather(), null, lightning)).toMatchObject({ risk_level: 'AMBER', hazard_type: 'CONVECTIVE' });
    });
});
