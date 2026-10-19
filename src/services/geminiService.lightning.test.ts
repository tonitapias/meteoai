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

import { getGeminiAnalysis, type AICacheData } from './geminiService';
import { cacheService } from './cacheService';
import type { LightningNearby } from './lightningService';
import type { ExtendedWeatherData } from '../types/weatherLogicTypes';

// Llamps observats a prop (Meteosat-12): una línia de telemetria per a la IA i, a 30 km o menys, el tallafocs
// AMBER / CONVECTIVE amb el motiu "Llamps detectats per satèl·lit a uns N km".

/** 8 hores d'una nit seca i tranquil·la: cada test hi posa els llamps (i, si cal, un codi de tempesta del model). */
const buildWeather = (overrides: Record<string, unknown[]> = {}): ExtendedWeatherData => {
    const n = 8;
    const arr = <T,>(v: T) => Array.from({ length: n }, () => v);
    return {
        elevation: 50,
        latitude: 39.95,
        longitude: 4.1,
        utc_offset_seconds: 7200,
        timezone: 'Europe/Madrid',
        current: {
            time: '2026-09-19T00:00', weather_code: 3, temperature_2m: 22, apparent_temperature: 24,
            relative_humidity_2m: 90, wind_speed_10m: 10, is_day: 0, precipitation: 0,
        },
        hourly: {
            time: Array.from({ length: n }, (_, i) => `2026-09-19T0${i}:00`),
            weather_code: arr(3), visibility: arr(20000), temperature_2m: arr(22), apparent_temperature: arr(24),
            relative_humidity_2m: arr(90), precipitation: arr(0), precipitation_probability: arr(20),
            cloud_cover_low: arr(20), cloud_cover_mid: arr(60), cloud_cover_high: arr(90),
            wind_speed_10m: arr(10), wind_gusts_10m: arr(20), is_day: arr(0), cape: arr(0), freezing_level_height: arr(4000),
            ...overrides,
        },
        daily: { time: ['2026-09-19'] },
        hourlyComparison: {},
    } as unknown as ExtendedWeatherData;
};

// Observat fa 9 min (els minuts es calculen en fer la crida).
const at = (nearestKm: number, bearingDeg = 320): LightningNearby =>
    ({ nearestKm, bearingDeg, observedAt: Math.floor(Date.now() / 1000) - 9 * 60, intense: true, activeSlots: 6 });

/** getGeminiAnalysis amb un worker simulat que respon `risk`/`hazard`; retorna el prompt enviat i el resultat. */
const analyse = async (weather: ExtendedWeatherData, lightning: LightningNearby | null, risk = 'GREEN', hazard = 'NONE') => {
    const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
            engine: 'gemini',
            candidates: [{ content: { parts: [{ text: JSON.stringify({
                risk_level: risk, hazard_type: hazard, tactical_reasoning: 'x', text: 'Resum.', tips: [],
            }) }] } }],
        }),
    });
    vi.stubGlobal('fetch', fetchMock);
    const result = await getGeminiAnalysis(weather, 'ca', 3, null, 90, lightning);
    const body = fetchMock.mock.calls[0]?.[1]?.body;
    const prompt = body ? (JSON.parse(String(body)) as { prompt: string }).prompt : '';
    return { result, prompt };
};

describe('getGeminiAnalysis — llamps observats', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
        vi.mocked(cacheService.get).mockResolvedValue(null);
        vi.mocked(cacheService.generateAiKey).mockClear();
    });

    it('a 23 km: línia d\'observació real amb distància i rumb, i ordre de dir-ho a la primera frase', async () => {
        const { prompt } = await analyse(buildWeather(), at(23));
        expect(prompt).toContain('Llamps observats ARA (satèl·lit Meteosat-12, darrers 30 min): el més proper a uns 23 km al nord-oest, fa 9 min, amb activitat elèctrica intensa.');
        expect(prompt).toContain('hi ha una tempesta activa a prop. Digues-ho a la primera frase del text');
    });

    it('a 23 km, encara que la IA digui GREEN: el tallafocs posa AMBER / CONVECTIVE amb el motiu dels llamps', async () => {
        const { result } = await analyse(buildWeather(), at(23));
        expect(result?.risk_level).toBe('AMBER');
        expect(result?.hazard_type).toBe('CONVECTIVE');
        expect(result?.risk_detail).toEqual({ level: 'AMBER', hazard: 'CONVECTIVE', event: 'lightning', hour: null, value: 23, threshold: 30 });
    });

    it('a 42 km: només la línia (tempesta a la zona, encara no a sobre), sense tallafocs', async () => {
        const { result, prompt } = await analyse(buildWeather(), at(42, 90));
        expect(prompt).toContain("el més proper a uns 42 km a l'est");
        expect(prompt).toContain('encara no a sobre. Esmenta-ho al text');
        expect(result?.risk_level).toBe('GREEN');
        expect(result?.risk_detail).toBeUndefined();
    });

    it('sense llamps: cap línia', async () => {
        const { prompt } = await analyse(buildWeather(), null);
        expect(prompt).not.toContain('Llamps observats');
    });

    it('llamps a prop i tempesta prevista pel model més tard: el motiu és la tempesta que ja hi és', async () => {
        const storm = { weather_code: [3, 3, 3, 95, 95, 3, 3, 3] };
        const { result } = await analyse(buildWeather(storm), at(12), 'AMBER', 'CONVECTIVE');
        expect(result?.risk_detail).toMatchObject({ event: 'lightning', value: 12 });
    });

    it('tempesta amb calamarsa (99) prevista: RED guanya als llamps (AMBER)', async () => {
        const hail = { weather_code: [3, 3, 99, 3, 3, 3, 3, 3] };
        const { result } = await analyse(buildWeather(hail), at(12));
        expect(result?.risk_level).toBe('RED');
        expect(result?.risk_detail).toMatchObject({ level: 'RED', event: 'storm_hail', hour: '02:00' });
    });

    it('la clau de cache canvia amb el tram de 10 km dels llamps', async () => {
        await analyse(buildWeather(), null);
        await analyse(buildWeather(), at(23));
        await analyse(buildWeather(), at(8));
        const situations = vi.mocked(cacheService.generateAiKey).mock.calls.map(([situation]) => situation);
        expect(situations[0]).toMatch(/-l0$/);
        expect(situations[1]).toMatch(/-l3$/);
        expect(situations[2]).toMatch(/-l1$/);
    });

    it("resposta en cache amb el motiu dels llamps: la distància és la d'ara, no la desada", async () => {
        const cached: AICacheData = {
            risk_level: 'AMBER', hazard_type: 'CONVECTIVE', text: 'Tempesta a 25 km.', tips: [], engine: 'gemini',
            risk_detail: { level: 'AMBER', hazard: 'CONVECTIVE', event: 'lightning', hour: null, value: 25, threshold: 30 }
        };
        vi.mocked(cacheService.get).mockResolvedValue(cached);
        vi.stubGlobal('fetch', vi.fn());
        const result = await getGeminiAnalysis(buildWeather(), 'ca', 3, null, 90, at(21));
        expect(result?.risk_detail).toMatchObject({ event: 'lightning', value: 21 });
        expect(result?.text).toBe('Tempesta a 25 km.');
    });

    it('resposta en cache GREEN i llamps a prop ara: el tallafocs revalidat la puja a AMBER amb el motiu', async () => {
        const cached: AICacheData = { risk_level: 'GREEN', hazard_type: 'NONE', text: 'Cel tranquil.', tips: [], engine: 'gemini' };
        vi.mocked(cacheService.get).mockResolvedValue(cached);
        vi.stubGlobal('fetch', vi.fn());
        const result = await getGeminiAnalysis(buildWeather(), 'ca', 3, null, 90, at(18));
        expect(result?.risk_level).toBe('AMBER');
        expect(result?.risk_detail).toMatchObject({ event: 'lightning', value: 18 });
    });
});
