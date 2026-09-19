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

import { getGeminiAnalysis, type AiAirQualityInput } from './geminiService';
import type { ExtendedWeatherData } from '../types/weatherLogicTypes';

// La qualitat de l'aire NO ve dins la previsió (es carrega a part): abans la IA rebia sempre
// "Qualitat Aire: N/D" i no podia parlar de contaminació ni de calima.

/** Una nit serena de 8 hores; només varia la humitat (l'avís d'aerosols exigeix aire sec). */
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
            time: '2026-09-19T00:00', weather_code: 0, temperature_2m: 15, apparent_temperature: 15,
            relative_humidity_2m: rh, wind_speed_10m: 3, is_day: 0, precipitation: 0,
        },
        hourly: {
            time: Array.from({ length: n }, (_, i) => `2026-09-19T0${i}:00`),
            weather_code: arr(0), visibility: arr(20000), temperature_2m: arr(15), apparent_temperature: arr(15),
            relative_humidity_2m: arr(rh), precipitation: arr(0), precipitation_probability: arr(0),
            cloud_cover_low: arr(0), cloud_cover_mid: arr(0), cloud_cover_high: arr(0),
            wind_speed_10m: arr(3), wind_gusts_10m: arr(5), is_day: arr(0), cape: arr(0), freezing_level_height: arr(4000),
        },
        daily: { time: ['2026-09-19'] },
        hourlyComparison: {},
    } as unknown as ExtendedWeatherData;
};

/** Executa getGeminiAnalysis amb un worker simulat i retorna el prompt que li arriba. */
const promptFor = async (weather: ExtendedWeatherData, aqiData: AiAirQualityInput | null = null) => {
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
    await getGeminiAnalysis(weather, 'ca', 0, aqiData);
    return (JSON.parse(fetchMock.mock.calls[0][1].body as string) as { prompt: string }).prompt;
};

const hourRow = (prompt: string, hh: string) => prompt.match(new RegExp(`\\| ${hh} \\|[^\\n]*`))?.[0] ?? '';

describe("getGeminiAnalysis — qualitat de l'aire", () => {
    beforeEach(() => { vi.restoreAllMocks(); });

    it("sense dades d'aire, la telemetria queda com sempre (N/D) i no hi ha línia d'aerosols", async () => {
        const prompt = await promptFor(buildWeather(50));
        expect(prompt).toContain('Qualitat Aire: N/D');
        expect(prompt).not.toContain('Aerosols:');
    });

    it("l'AQI actual de l'API d'aire arriba a la IA amb la seva categoria", async () => {
        const prompt = await promptFor(buildWeather(50), { current: { european_aqi: 45 } });
        expect(prompt).toContain('Qualitat Aire: 45 (Moderada / Regular)');
    });

    it("sense EAQI, cau a l'escala US", async () => {
        const prompt = await promptFor(buildWeather(50), { current: { us_aqi: 130 } });
        expect(prompt).toContain('Qualitat Aire: 130 (Desfavorable per a persones sensibles)');
    });

    it("l'AQI horari s'alinea pel TEXT de l'hora, no per índex", async () => {
        // La sèrie d'aire comença a les 02:00 (dues hores més tard que la del temps): per índex, la fila de
        // les 03:00 agafaria el valor de les 05:00 (90).
        const aqi: AiAirQualityInput = {
            current: { european_aqi: 30 },
            hourly: {
                time: ['2026-09-19T02:00', '2026-09-19T03:00', '2026-09-19T04:00', '2026-09-19T05:00'],
                european_aqi: [15, 45, 70, 90],
            },
        };
        const prompt = await promptFor(buildWeather(50), aqi);
        expect(hourRow(prompt, '03:00')).toContain('45 (Moderada / Regular)');
        expect(hourRow(prompt, '04:00')).toContain('70 (Deficient / Mala qualitat)');
    });

    it("una hora sense dada d'aire queda N/D (no s'hi copia la d'una altra hora)", async () => {
        const prompt = await promptFor(buildWeather(50), { hourly: { time: ['2026-09-19T03:00'], european_aqi: [45] } });
        expect(hourRow(prompt, '04:00')).toMatch(/N\/D \|\s*$/);
    });

    it("amb calima (pols alta, aire sec, sense pluja) la telemetria porta la línia d'aerosols amb l'advertiment", async () => {
        const prompt = await promptFor(buildWeather(50), { current: { european_aqi: 88, dust: 438, pm10: 314 } });
        expect(prompt).toContain('Aerosols: POLS EN SUSPENSIÓ (calima) — pols 438 µg/m³');
        expect(prompt).toContain('NO de visibilitat ni de boira');
    });

    it('amb PM10 alt sense pols la línia parla de partícules, no de calima', async () => {
        const prompt = await promptFor(buildWeather(50), { current: { dust: 5, pm10: 213 } });
        expect(prompt).toContain('Aerosols: PARTÍCULES EN SUSPENSIÓ — PM10 213 µg/m³');
        expect(prompt).not.toContain('calima');
    });

    it("sense avís (pols baixa o aire humit) no hi ha línia d'aerosols, encara que hi hagi dades", async () => {
        expect(await promptFor(buildWeather(50), { current: { dust: 20, pm10: 30 } })).not.toContain('Aerosols:');
        expect(await promptFor(buildWeather(94), { current: { dust: 438, pm10: 314 } })).not.toContain('Aerosols:');
    });
});

describe('getGeminiAnalysis — perill AIR_QUALITY del worker', () => {
    beforeEach(() => { vi.restoreAllMocks(); });

    const withLlm = async (hazard: string, risk: string) => {
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
        return getGeminiAnalysis(buildWeather(50), 'ca', 0, { current: { european_aqi: 94, dust: 388 } });
    };

    it("el perill AIR_QUALITY arriba a la interfície (no es descarta com a NONE)", async () => {
        const result = await withLlm('AIR_QUALITY', 'AMBER');
        expect(result?.risk_level).toBe('AMBER');
        expect(result?.hazard_type).toBe('AIR_QUALITY');
    });

    it('un perill inventat continua caient a NONE', async () => {
        const result = await withLlm('DUST_STORM', 'AMBER');
        expect(result?.hazard_type).toBe('NONE');
    });
});
