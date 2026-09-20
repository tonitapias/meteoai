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
import { cacheService } from './cacheService';
import { TRANSLATIONS } from '../translations';
import { getHourlyWeatherCode, type HourlySeries } from '../utils/hourlyWeatherCode';
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
        expect(prompt).toContain('Estat del Cel: Cobert (cel completament tapat)');
    });

    it('sense effectiveCode, l\'estat del cel actual cau al codi brut del model', async () => {
        const { prompt } = await run(buildWeather(94), null);
        expect(prompt).toContain(`Estat del Cel: ${FOG_DESC}`);
    });

    it("l'aiguaneu que deriva l'app (68/69) arriba a la IA com a text, no com a 'Codi WMO'", async () => {
        const weather = buildWeather(90);
        weather.elevation = 0;
        const h = weather.hourly as unknown as Record<string, number[]>;
        h.weather_code = Array.from({ length: 8 }, () => 63);       // el model diu pluja...
        h.temperature_2m = Array.from({ length: 8 }, () => 3);      // ...a 3 °C amb la cota 0 °C a 200 m: aiguaneu
        h.precipitation = Array.from({ length: 8 }, () => 1);
        h.freezing_level_height = Array.from({ length: 8 }, () => 200);
        h.visibility = Array.from({ length: 8 }, () => 5000);
        (weather.current as unknown as Record<string, number>).temperature_2m = 3;
        const { prompt } = await run(weather, 69);
        expect(prompt).toContain('Aiguaneu');
        expect(prompt).not.toContain('Codi WMO');
    });

    it("cap codi que l'app sap etiquetar arriba a la IA com un 'Codi WMO' opac", async () => {
        const codes = Object.keys(TRANSLATIONS.ca.wmo).map(Number);
        expect(codes.length).toBeGreaterThan(20);
        for (const code of codes) {
            const { prompt } = await run(buildWeather(94), code);
            const estat = prompt.match(/Estat del Cel: (.*)/)?.[1] ?? '';
            expect(estat, `codi ${code}`).not.toMatch(/^Codi WMO/);
        }
    });

    describe('tallafocs — aiguaneu (68/69, derivat pel motor)', () => {
        /** 8 hores amb el model dient pluja (`rawCode`) a `temp` °C, la isoterma 0 °C a `freezingLevel` m i `precip` mm/h. */
        const rainy = (rawCode: number, temp: number, freezingLevel: number, precip: number): ExtendedWeatherData => {
            const weather = buildWeather(90);
            weather.elevation = 0;
            const h = weather.hourly as unknown as Record<string, number[]>;
            h.weather_code = Array.from({ length: 8 }, () => rawCode);
            h.temperature_2m = Array.from({ length: 8 }, () => temp);
            h.apparent_temperature = Array.from({ length: 8 }, () => temp);
            h.precipitation = Array.from({ length: 8 }, () => precip);
            h.freezing_level_height = Array.from({ length: 8 }, () => freezingLevel);
            h.visibility = Array.from({ length: 8 }, () => 5000);
            const c = weather.current as unknown as Record<string, number>;
            c.temperature_2m = temp;
            c.weather_code = rawCode;
            return weather;
        };
        const engineCode = (w: ExtendedWeatherData) => getHourlyWeatherCode(w.hourly as unknown as HourlySeries, 0, 0, w.hourlyComparison);

        it("l'aiguaneu moderat (69) puja a AMBER/SNOW_ICE encara que la IA digui GREEN", async () => {
            const weather = rainy(63, 3, 200, 1);   // pluja a 3 °C amb la cota 0 °C a 200 m
            expect(engineCode(weather)).toBe(69);
            const { result } = await run(weather, 69);
            expect(result?.risk_level).toBe('AMBER');
            expect(result?.hazard_type).toBe('SNOW_ICE');
        });

        it("l'aiguaneu feble (68) també puja a AMBER/SNOW_ICE", async () => {
            const weather = rainy(61, 3, 200, 0.3);
            expect(engineCode(weather)).toBe(68);
            const { result } = await run(weather, 68);
            expect(result?.risk_level).toBe('AMBER');
            expect(result?.hazard_type).toBe('SNOW_ICE');
        });

        it('la mateixa pluja amb la isoterma 0 °C molt amunt (pluja de debò, no aiguaneu) continua GREEN', async () => {
            const weather = rainy(63, 3, 1800, 1);
            expect(engineCode(weather)).toBe(63);
            const { result } = await run(weather, 63);
            expect(result?.risk_level).toBe('GREEN');
        });

        it('una pluja càlida no es toca', async () => {
            const weather = rainy(63, 12, 3000, 1);
            const { result } = await run(weather, 63);
            expect(result?.risk_level).toBe('GREEN');
        });
    });

    it('el tallafocs de tempesta segueix anant sobre el codi brut (dades crues guanyen)', async () => {
        const weather = buildWeather(94);
        (weather.hourly as unknown as Record<string, number[]>).weather_code = Array.from({ length: 8 }, () => 95);
        const { result } = await run(weather, 3);
        expect(result?.risk_level).toBe('AMBER');
        expect(result?.hazard_type).toBe('CONVECTIVE');
    });
});

/** Sèries constants de 8 hores sobre el fixture de la boira, amb la temperatura, el vent i la data que calgui. */
const calm = (opts: { date: string; temp: number; wind?: number; day?: number; rh?: number }): ExtendedWeatherData => {
    const weather = buildWeather(opts.rh ?? 85);
    const n = 8;
    const fill = (v: number) => Array.from({ length: n }, () => v);
    const h = weather.hourly as unknown as Record<string, unknown>;
    h.time = Array.from({ length: n }, (_, i) => `${opts.date}T0${i}:00`);
    h.weather_code = fill(0);
    h.temperature_2m = fill(opts.temp);
    h.apparent_temperature = fill(opts.temp);
    h.visibility = fill(20000);
    h.cloud_cover_low = fill(0);
    h.wind_speed_10m = fill(opts.wind ?? 0);
    h.is_day = fill(opts.day ?? 0);
    const c = weather.current as unknown as Record<string, unknown>;
    c.time = `${opts.date}T00:00`;
    c.weather_code = 0;
    c.temperature_2m = opts.temp;
    c.apparent_temperature = opts.temp;
    c.wind_speed_10m = opts.wind ?? 0;
    c.is_day = opts.day ?? 0;
    return weather;
};

describe('getGeminiAnalysis — temperatura mostrada (correcció d\'inversió tèrmica)', () => {
    beforeEach(() => { vi.restoreAllMocks(); });

    // Nit serena i en calma de gener amb +2 °C al model: la capçalera i l'evolució horària en mostren -1,5 °C
    // (correcció d'inversió). La IA rebia els +2 °C crus i deia "cap fenomen advers" en una nit de gelada.
    it('a l\'hivern, en una nit serena i en calma, la IA rep la temperatura corregida que veu l\'usuari', async () => {
        const { prompt } = await run(calm({ date: '2027-01-15', temp: 2 }), 0);
        expect(prompt).toContain('Temperatura Real: -1.5ºC');
        // columna TEMP (3a): la corregida; la SENSACIÓ (4a) es manté crua, com a la pantalla
        expect(prompt).toMatch(/\| 00:00 \|[^|]*\| -1\.5ºC \|/);
        expect(prompt).not.toMatch(/\| 00:00 \|[^|]*\| 2ºC \|/);
    });

    it('la mateixa nit al setembre (fora de la temporada d\'inversió) no es corregeix', async () => {
        const { prompt } = await run(calm({ date: '2026-09-15', temp: 2 }), 0);
        expect(prompt).toContain('Temperatura Real: 2ºC');
    });

    it('amb vent (>6 km/h) la inversió es trenca i tampoc no es corregeix', async () => {
        const { prompt } = await run(calm({ date: '2027-01-15', temp: 2, wind: 10 }), 0);
        expect(prompt).toContain('Temperatura Real: 2ºC');
    });

    it('el tallafocs de gelada usa la temperatura mostrada: +2 °C al model però -1,5 °C a la pantalla → AMBER / COLD', async () => {
        const { result } = await run(calm({ date: '2027-01-15', temp: 2 }), 0);
        expect(result?.risk_level).toBe('AMBER');
        expect(result?.hazard_type).toBe('COLD');
    });

    it('sense inversió, +2 °C continuen sent GREEN', async () => {
        const { result } = await run(calm({ date: '2026-09-15', temp: 2 }), 0);
        expect(result?.risk_level).toBe('GREEN');
    });

    // El prompt del worker diu RED a T <= -10 ºC; el tallafocs tenia -8 (més antic), i a -9 forçava RED contra el prompt.
    it('el fred passa a RED a -10 °C (llindar del prompt del worker), no a -8', async () => {
        const at = async (temp: number) => (await run(calm({ date: '2026-09-15', temp, wind: 10, day: 1 }), 0)).result;
        expect((await at(-9))?.risk_level).toBe('AMBER');
        expect((await at(-10))?.risk_level).toBe('RED');
        expect((await at(-10))?.hazard_type).toBe('COLD');
    });
});

describe('getGeminiAnalysis — resum calculat de la finestra', () => {
    beforeEach(() => { vi.restoreAllMocks(); });

    const summaryOf = (prompt: string) => prompt.match(/RESUM CALCULAT[^\n]*\n([\s\S]*?)\n\s*MATRIU/)?.[1].replace(/^\s+/gm, '') ?? '';

    it('sense pluja: ho diu, i dona la temperatura mínima/màxima i la ràfega màxima amb la seva hora', async () => {
        const weather = calm({ date: '2026-09-15', temp: 20, day: 1 });
        const h = weather.hourly as unknown as Record<string, number[]>;
        h.temperature_2m = [20, 21, 23, 24, 22, 21, 20, 19];
        h.wind_gusts_10m = [10, 12, 30, 18, 12, 10, 9, 9];
        const { prompt } = await run(weather, 0);
        const s = summaryOf(prompt);
        expect(s).toContain('Temperatura: mínima 20ºC (00:00, ara) | màxima 24ºC (03:00)');
        expect(s).toContain('Ràfega màxima: 30km/h (02:00)');
        expect(s).toContain('Pluja: cap hora amb pluja apreciable (totes < 0.2mm/h)');
    });

    // Cas real d'abans: hores de 14, 17, 20 i 23 mm/h → la IA escrivia "acumulacions de 23 mil·límetres" (n'hi havia ~80).
    it('amb pluja: total sumat, pic amb hora, i primera/última hora (continua al final de la finestra)', async () => {
        const weather = calm({ date: '2026-09-15', temp: 17, day: 1 });
        const h = weather.hourly as unknown as Record<string, number[]>;
        h.precipitation = [0, 0, 1.2, 1.2, 4, 1.2, 1.2, 1.2];
        h.precipitation_probability = [10, 30, 80, 90, 95, 80, 70, 60];
        const { prompt } = await run(weather, 0);
        const s = summaryOf(prompt);
        // finestra = 6 hores (00:00-05:00): 1.2 + 1.2 + 4 + 1.2 = 7.6
        expect(s).toContain('Pluja: intensitat màxima 4mm/h (04:00) | acumulat de totes les hores 7.6mm (no és una intensitat) | hores amb pluja: de 02:00 a 05:00 (continua al final de la finestra)');
        expect(s).toContain('Probabilitat màxima de pluja: 95%');
    });

    it('una pluja intermitent ho indica ("amb pauses") i, si acaba dins la finestra, no diu que continuï', async () => {
        const weather = calm({ date: '2026-09-15', temp: 17, day: 1 });
        const h = weather.hourly as unknown as Record<string, number[]>;
        h.precipitation = [1, 0, 1, 0, 0, 0, 0, 0];
        const { prompt } = await run(weather, 0);
        const s = summaryOf(prompt);
        expect(s).toContain('hores amb pluja: de 00:00, ara a 02:00 (amb pauses)');
        expect(s).not.toContain('continua');
    });

    it('sense dades horàries no hi ha resum', async () => {
        const weather = calm({ date: '2026-09-15', temp: 17 });
        (weather.hourly as unknown as Record<string, unknown>).time = [];
        const { prompt } = await run(weather, 0);
        expect(prompt).not.toContain('RESUM CALCULAT');
    });
});

describe('getGeminiAnalysis — cache de la IA', () => {
    beforeEach(() => { vi.restoreAllMocks(); vi.mocked(cacheService.generateAiKey).mockClear(); vi.mocked(cacheService.set).mockClear(); });

    const keyFor = async (effectiveCode: number, aqi: AiAirQualityInput | null = null) => {
        vi.mocked(cacheService.generateAiKey).mockClear();
        const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ engine: 'gemini', candidates: [{ content: { parts: [{ text: JSON.stringify({ risk_level: 'GREEN', hazard_type: 'NONE', text: 'x', tips: [] }) }] } }] }) });
        vi.stubGlobal('fetch', fetchMock);
        // HR 50 %: la calima només salta amb aire sec.
        await getGeminiAnalysis(calm({ date: '2026-09-15', temp: 17, day: 1, rh: 50 }), 'ca', effectiveCode, aqi);
        return vi.mocked(cacheService.generateAiKey).mock.calls[0][0];
    };

    // Sense això, a les 10:00 amb sol la IA quedava a la cache i a les 10:40 (ja plovent) seguia dient "cel serè".
    it('la clau de cache canvia quan canvia la situació (cel, calima, banda de qualitat de l\'aire)', async () => {
        const clear = await keyFor(0);
        const rain = await keyFor(61);
        const dust = await keyFor(0, { current: { european_aqi: 30, dust: 300 } });
        const badAir = await keyFor(0, { current: { european_aqi: 90 } });
        expect(new Set([clear, rain, dust, badAir]).size).toBe(4);
    });

    it('la mateixa situació dona la mateixa clau (no es crida la IA de més)', async () => {
        expect(await keyFor(0)).toBe(await keyFor(0));
        // una variació d'AQI dins la mateixa banda ("Bona": 0-20) no canvia la clau
        expect(await keyFor(0, { current: { european_aqi: 5 } })).toBe(await keyFor(0, { current: { european_aqi: 15 } }));
    });

    const withEngine = async (engine: string) => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ engine, candidates: [{ content: { parts: [{ text: JSON.stringify({ risk_level: 'AMBER', hazard_type: 'NONE', text: 'Connexió perduda.', tips: [] }) }] } }] }) }));
        return getGeminiAnalysis(calm({ date: '2026-09-15', temp: 17, day: 1 }), 'ca', 0);
    };

    // L'escut d'emergència (Gemini i Groq caiguts) es mostrava però es cachejava 60 min: un error de segons quedava
    // enganxat tota l'hora, amb semàfor AMBER, encara que el servei ja s'hagués recuperat.
    it("la resposta de l'escut d'emergència es mostra però NO es guarda a la cache", async () => {
        const result = await withEngine('emergency');
        expect(result?.engine).toBe('emergency');
        expect(cacheService.set).not.toHaveBeenCalled();
    });

    it('una resposta real de Gemini o Groq sí que es guarda', async () => {
        expect((await withEngine('gemini'))?.engine).toBe('gemini');
        expect((await withEngine('groq'))?.engine).toBe('groq');
        expect(cacheService.set).toHaveBeenCalledTimes(2);
    });
});
