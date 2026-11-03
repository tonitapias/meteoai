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

import { getGeminiAnalysis, resolveRainCertainty, type AiAirQualityInput } from './geminiService';
import { cacheService } from './cacheService';
import { TRANSLATIONS } from '../translations';
import { getHourlyWeatherCode, type HourlySeries } from '../utils/hourlyWeatherCode';
import type { ExtendedWeatherData, ShortRangeAgreement } from '../types/weatherLogicTypes';

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

    // Nit serena i en calma de gener amb +1,25 °C al model: la capçalera i l'evolució horària en mostren -0,5 °C
    // (correcció d'inversió de 1,75 °C). La IA rebia els graus crus i deia "cap fenomen advers" en una nit de gelada.
    it('a l\'hivern, en una nit serena i en calma, la IA rep la temperatura corregida que veu l\'usuari', async () => {
        const { prompt } = await run(calm({ date: '2027-01-15', temp: 1.25 }), 0);
        expect(prompt).toContain('Temperatura Real: -0.5°C');
        // columna TEMP (3a) i SENSACIÓ (4a): totes dues corregides, com a la capçalera (sensació = temperatura al fixture)
        expect(prompt).toMatch(/\| 00:00 \|[^|]*\| -0\.5°C \| -0\.5°C \|/);
        expect(prompt).not.toMatch(/\| 00:00 \|[^|]*\| 1\.3°C \|/);
        expect(prompt).not.toMatch(/\| 00:00 \|[^|]*\| -0\.5°C \| 1\.25°C \|/);
        // i la línia de confort d'"ara" cita la sensació corregida
        expect(prompt).toContain('Sensació: -0.5°C');
    });

    // Amb "ºC" (l'indicador ordinal, U+00BA) al prompt, la IA el copiava al text: "fa 10 ºC" en lloc de "10 °C".
    it('el prompt escriu els graus amb el signe de grau (°), mai amb l\'indicador ordinal (º)', async () => {
        const { prompt } = await run(calm({ date: '2027-01-15', temp: 1.25 }), 0);
        expect(prompt).toContain('°C');
        expect(prompt).not.toContain('º');
    });

    // Girona, 26-10-2026: amb "17.5°C" la IA escrivia "17 °C" sota la capçalera, que en deia 18.
    it('amb decimals, la línia d\'ara diu també la xifra de la capçalera', async () => {
        const { prompt } = await run(calm({ date: '2026-09-15', temp: 17.5, wind: 10, day: 1 }), 0);
        expect(prompt).toContain('Temperatura Real: 17.5°C (a la pantalla: 18°C)');
        const { prompt: frost } = await run(calm({ date: '2027-01-15', temp: 1.25 }), 0);
        expect(frost).toContain('Temperatura Real: -0.5°C (a la pantalla: 0°C)');
    });

    it('la mateixa nit al setembre (fora de la temporada d\'inversió) no es corregeix', async () => {
        const { prompt } = await run(calm({ date: '2026-09-15', temp: 2 }), 0);
        expect(prompt).toContain('Temperatura Real: 2°C');
    });

    it('amb vent (>6 km/h) la inversió es trenca i tampoc no es corregeix', async () => {
        const { prompt } = await run(calm({ date: '2027-01-15', temp: 2, wind: 10 }), 0);
        expect(prompt).toContain('Temperatura Real: 2°C');
    });

    it('el tallafocs de gelada usa la temperatura mostrada: +1,25 °C al model però -0,5 °C a la pantalla → AMBER / COLD', async () => {
        const { result } = await run(calm({ date: '2027-01-15', temp: 1.25 }), 0);
        expect(result?.risk_level).toBe('AMBER');
        expect(result?.hazard_type).toBe('COLD');
    });

    it('sense inversió, +2 °C continuen sent GREEN', async () => {
        const { result } = await run(calm({ date: '2026-09-15', temp: 2 }), 0);
        expect(result?.risk_level).toBe('GREEN');
    });

    // El prompt del worker diu RED a T <= -10 °C; el tallafocs tenia -8 (més antic), i a -9 forçava RED contra el prompt.
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
        expect(s).toContain('Temperatura: mínima 20°C (00:00, ara) | màxima 24°C (03:00)');
        expect(s).toContain('Ràfega màxima: 30km/h (02:00)');
        expect(s).toContain('Pluja: cap hora amb pluja apreciable (totes < 0.2mm/h)');
    });

    // Girona, 26-10-2026: "baixarà fins a 14.9°C a les 00:00" sota una tira que deia 15°.
    it('la mínima i la màxima van en graus enters, com a la tira de 24 h', async () => {
        const weather = calm({ date: '2026-09-15', temp: 20, day: 1 });
        const h = weather.hourly as unknown as Record<string, number[]>;
        h.temperature_2m = [18.2, 17.4, 16.1, 14.9, 15.3, 15.6, 16, 17];
        const { prompt } = await run(weather, 0);
        expect(summaryOf(prompt)).toContain('Temperatura: mínima 15°C (03:00) | màxima 18°C (00:00, ara)');
    });

    // Cas real d'abans: hores de 14, 17, 20 i 23 mm/h → la IA escrivia "acumulacions de 23 mil·límetres" (n'hi havia ~80).
    it("amb pluja: total sumat, pic en paraula i xifra amb hora, i primera/última hora (encara plou a l'última)", async () => {
        const weather = calm({ date: '2026-09-15', temp: 17, day: 1 });
        const h = weather.hourly as unknown as Record<string, number[]>;
        h.precipitation = [0, 0, 1.2, 1.2, 4, 1.2, 1.2, 1.2];
        h.precipitation_probability = [10, 30, 80, 90, 95, 80, 70, 60];
        const { prompt } = await run(weather, 0);
        const s = summaryOf(prompt);
        // finestra = 6 hores (00:00-05:00): 1.2 + 1.2 + 4 + 1.2 = 7.6, arrodonit (la IA copiava "4.8 mm" al text)
        expect(s).toContain("Pluja: intensitat màxima moderada (4mm/h, 04:00; al text, només la paraula) | acumulat de totes les hores uns 8mm (no és una intensitat) | hores amb pluja: de 02:00 a 05:00 (encara plou a l'última hora prevista, 05:00)");
        expect(s).toContain('Probabilitat màxima de pluja: 95%');
        expect(s).toContain('Certesa de la pluja: MOLT PROBABLE');
        // La IA copiava "finestra" al text ("continua al final de la finestra"), i "xifres exactes" contradeia la certesa.
        expect(prompt).not.toContain('finestra');
        expect(prompt).not.toContain('FINESTRA');
        expect(prompt).not.toContain('exactes');
    });

    it('una pluja intermitent ho indica ("amb pauses") i, si acaba dins la finestra, no diu que continuï', async () => {
        const weather = calm({ date: '2026-09-15', temp: 17, day: 1 });
        const h = weather.hourly as unknown as Record<string, number[]>;
        h.precipitation = [1, 0, 1, 0, 0, 0, 0, 0];
        const { prompt } = await run(weather, 0);
        const s = summaryOf(prompt);
        expect(s).toContain('acumulat de totes les hores uns 2mm');
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

describe('resolveRainCertainty — escala de certesa de la pluja', () => {
    it('amb el model principal plovent, la probabilitat tria la paraula (80 / 60 / 40)', () => {
        expect(resolveRainCertainty(80, true, null)).toBe('MOLT PROBABLE');
        expect(resolveRainCertainty(79, true, null)).toBe('PROBABLE');
        expect(resolveRainCertainty(60, true, null)).toBe('PROBABLE');
        expect(resolveRainCertainty(59, true, null)).toBe('POSSIBLE');
        expect(resolveRainCertainty(40, true, null)).toBe('POSSIBLE');
        expect(resolveRainCertainty(39, true, null)).toBe('POC PROBABLE');
        // La pluja d'un sol model amb una probabilitat baixa (rainEvidence.ts: plou ~10 % de les vegades) no desapareix.
        expect(resolveRainCertainty(10, true, null)).toBe('POC PROBABLE');
    });

    it("sense pluja al model, només s'esmenta a partir del 20 %", () => {
        expect(resolveRainCertainty(19, false, null)).toBeNull();
        expect(resolveRainCertainty(20, false, null)).toBe('POC PROBABLE');
        expect(resolveRainCertainty(65, false, null)).toBe('PROBABLE');
    });

    // El text no pot donar la pluja per més segura que la insígnia del costat.
    it('"Pluja dubtosa" (ambre) la deixa com a molt PROBABLE i "Pluja incerta" (vermella) com a molt POSSIBLE', () => {
        expect(resolveRainCertainty(95, true, { level: 'medium', cause: 'rain', tempMarginC: null })).toBe('PROBABLE');
        expect(resolveRainCertainty(95, true, { level: 'low', cause: 'rain', tempMarginC: null })).toBe('POSSIBLE');
        expect(resolveRainCertainty(95, true, { level: 'low', cause: 'both', tempMarginC: 4 })).toBe('POSSIBLE');
        // Per sota del tope no es toca.
        expect(resolveRainCertainty(30, true, { level: 'low', cause: 'rain', tempMarginC: null })).toBe('POC PROBABLE');
    });

    it('amb la pluja dubtosa i el model principal sec, almenys POC PROBABLE (els globals en veuen)', () => {
        expect(resolveRainCertainty(5, false, { level: 'low', cause: 'rain', tempMarginC: null })).toBe('POC PROBABLE');
    });

    it("un dubte només de temperatura, o el consens, no toquen la pluja", () => {
        expect(resolveRainCertainty(95, true, { level: 'low', cause: 'temp', tempMarginC: 5 })).toBe('MOLT PROBABLE');
        expect(resolveRainCertainty(95, true, { level: 'high', cause: null, tempMarginC: null })).toBe('MOLT PROBABLE');
        expect(resolveRainCertainty(5, false, { level: 'high', cause: null, tempMarginC: null })).toBeNull();
    });
});

describe('getGeminiAnalysis — certesa i fiabilitat al resum', () => {
    beforeEach(() => { vi.restoreAllMocks(); });

    const summaryWith = async (weather: ExtendedWeatherData, reliability: ShortRangeAgreement | null) => {
        const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ engine: 'gemini', candidates: [{ content: { parts: [{ text: JSON.stringify({ risk_level: 'GREEN', hazard_type: 'NONE', text: 'x', tips: [] }) }] } }] }) });
        vi.stubGlobal('fetch', fetchMock);
        await getGeminiAnalysis(weather, 'ca', 3, null, null, null, reliability);
        const prompt = (JSON.parse(fetchMock.mock.calls[0][1].body as string) as { prompt: string }).prompt;
        return prompt.match(/RESUM CALCULAT[^\n]*\n([\s\S]*?)\n\s*MATRIU/)?.[1].replace(/^\s+/gm, '') ?? '';
    };

    /** El cas que es va veure a l'app: cobert, 11 °C, pluja de 2.4 mm/h de 20:00 a 22:00 amb una probabilitat del 45 %. */
    const eveningRain = (): ExtendedWeatherData => {
        const weather = calm({ date: '2026-11-03', temp: 11, wind: 10 });
        const h = weather.hourly as unknown as Record<string, unknown>;
        h.time = ['16', '17', '18', '19', '20', '21', '22', '23'].map(hh => `2026-11-03T${hh}:00`);
        h.precipitation = [0, 0, 0, 0, 2.4, 1.6, 0.8, 0];
        h.precipitation_probability = [5, 5, 10, 25, 45, 40, 30, 15];
        (weather.current as unknown as Record<string, unknown>).time = '2026-11-03T17:00';
        return weather;
    };

    it('la pluja del cas real arriba com a POSSIBLE i "moderada", no només com a 2.4 mm/h', async () => {
        const s = await summaryWith(eveningRain(), null);
        expect(s).toContain('Pluja: intensitat màxima moderada (2.4mm/h, 20:00; al text, només la paraula)');
        expect(s).toContain('Certesa de la pluja: POSSIBLE');
    });

    // Amb "cap hora amb pluja" sol, Flash-Lite deia "sense precipitacions" encara que la certesa fos POSSIBLE.
    it('amb el model principal sec però pluja possible, la línia de pluja ho diu amb la probabilitat i la seva hora', async () => {
        const weather = eveningRain();
        (weather.hourly as unknown as Record<string, unknown>).precipitation = Array.from({ length: 8 }, () => 0);
        (weather.hourly as unknown as Record<string, unknown>).precipitation_probability = [10, 20, 30, 45, 50, 40, 30, 20];
        const s = await summaryWith(weather, null);
        expect(s).toContain('Pluja: cap hora amb pluja apreciable (totes < 0.2mm/h), però la probabilitat arriba al 50% (20:00)');
        expect(s).toContain('Certesa de la pluja: POSSIBLE');
        // Només la insígnia en veu ("Pluja incerta" amb el model sec i una probabilitat baixa).
        (weather.hourly as unknown as Record<string, unknown>).precipitation_probability = Array.from({ length: 8 }, () => 5);
        expect(await summaryWith(weather, { level: 'low', cause: 'rain', tempMarginC: null })).toContain('totes < 0.2mm/h), però altres models en preveuen');
        // Sense certesa, la línia queda com sempre.
        expect(await summaryWith(weather, null)).toMatch(/totes < 0\.2mm\/h\)\n/);
    });

    it('amb la insígnia "Pluja incerta", la mateixa pluja al 95 % arriba com a POSSIBLE', async () => {
        const weather = eveningRain();
        (weather.hourly as unknown as Record<string, unknown>).precipitation_probability = [5, 5, 10, 60, 95, 90, 80, 15];
        expect(await summaryWith(weather, null)).toContain('Certesa de la pluja: MOLT PROBABLE');
        expect(await summaryWith(weather, { level: 'low', cause: 'rain', tempMarginC: null })).toContain('Certesa de la pluja: POSSIBLE');
    });

    it("sense pluja ni probabilitat, la certesa diu CAP", async () => {
        const s = await summaryWith(calm({ date: '2026-09-15', temp: 20, day: 1 }), null);
        expect(s).toContain("Certesa de la pluja: CAP (no s'espera pluja)");
    });

    it('la intensitat va en paraula amb l\'escala d\'AEMET (feble <= 2, moderada <= 15, forta <= 30...)', async () => {
        const at = async (mm: number) => {
            const weather = calm({ date: '2026-09-15', temp: 17, day: 1 });
            (weather.hourly as unknown as Record<string, number[]>).precipitation = [0, mm, 0, 0, 0, 0, 0, 0];
            return summaryWith(weather, null);
        };
        expect(await at(2)).toContain('intensitat màxima feble (2mm/h');
        expect(await at(0.5)).toContain("acumulat de totes les hores menys d'1mm");
        expect(await at(2.1)).toContain('intensitat màxima moderada (2.1mm/h');
        expect(await at(20)).toContain('intensitat màxima forta (20mm/h');
        expect(await at(45)).toContain('intensitat màxima molt forta (45mm/h');
        expect(await at(70)).toContain('intensitat màxima torrencial (70mm/h');
    });

    it('la fiabilitat de la temperatura és la de la insígnia: alta amb consens o amb un dubte només de pluja, incerta amb el marge', async () => {
        const weather = () => calm({ date: '2026-09-15', temp: 20, day: 1 });
        expect(await summaryWith(weather(), { level: 'high', cause: null, tempMarginC: null })).toContain('Fiabilitat de la temperatura: alta (els models hi coincideixen)');
        expect(await summaryWith(weather(), { level: 'medium', cause: 'rain', tempMarginC: null })).toContain('Fiabilitat de la temperatura: alta');
        expect(await summaryWith(weather(), { level: 'medium', cause: 'temp', tempMarginC: 4 })).toContain('Fiabilitat de la temperatura: incerta (els models no hi coincideixen, marge ±4°C)');
        expect(await summaryWith(weather(), { level: 'low', cause: 'both', tempMarginC: 5 })).toContain('marge ±5°C');
    });

    // Groq, 03-11-2026: "El cel està cobert de neu i la temperatura és -1°C. Plourà de 09:00 fins a 14:00..."
    it('si el que cau és neu, el resum ho diu perquè no escrigui "plourà"', async () => {
        const weather = calm({ date: '2027-01-15', temp: -2, wind: 10, day: 1 });
        const h = weather.hourly as unknown as Record<string, number[]>;
        h.weather_code = Array.from({ length: 8 }, () => 73);
        h.precipitation = Array.from({ length: 8 }, () => 1.2);
        h.freezing_level_height = Array.from({ length: 8 }, () => 0);
        const s = await summaryWith(weather, null);
        expect(s).toContain('Tipus de precipitació: NEU (digues "nevarà" o "nevada", mai "plourà")');
        // Pluja de debò: cap línia de tipus.
        expect(await summaryWith(eveningRain(), null)).not.toContain('Tipus de precipitació');
    });

    it('sense acord calculat (no hi ha prou models) no hi ha línia de fiabilitat: no se n\'inventa cap', async () => {
        expect(await summaryWith(calm({ date: '2026-09-15', temp: 20, day: 1 }), null)).not.toContain('Fiabilitat');
    });
});

describe('getGeminiAnalysis — llengua del text', () => {
    beforeEach(() => { vi.restoreAllMocks(); });

    const answer = async (lang: string, text: string, tips: string[]) => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ engine: 'groq', candidates: [{ content: { parts: [{ text: JSON.stringify({ risk_level: 'AMBER', hazard_type: 'HEAT', text, tips: tips.map(t => ({ category: 'THERMAL', text: t })) }) }] } }] }) }));
        return getGeminiAnalysis(calm({ date: '2026-09-15', temp: 17, day: 1 }), lang, 0);
    };

    // Frases reals de Groq (03-11-2026).
    it('en català, el text i els consells surten amb els errors mecànics corregits', async () => {
        const r = await answer('ca', 'El cel està cobert i la temperatura és de 11 °C. A partir de les 20:00 pot ploure moderada fins a 22:00.', ['Calor alta: no surtis a 17:00']);
        expect(r?.text).toBe("El cel està cobert i la temperatura és d'11 °C. A partir de les 20:00 pot ploure de manera moderada fins a les 22:00.");
        expect(r?.tips[0].text).toBe('Calor alta: no surtis a les 17:00');
    });

    it('en els altres idiomes el text arriba tal qual', async () => {
        const r = await answer('es', 'El cielo está cubierto y la temperatura es de 11 °C a 17:00.', []);
        expect(r?.text).toBe('El cielo está cubierto y la temperatura es de 11 °C a 17:00.');
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

    // La insígnia passa de "Consens" a "Pluja incerta" (el hook torna a cridar): el text en cache deia "plourà".
    it("la clau de cache canvia amb l'acord entre models i amb la certesa de la pluja", async () => {
        const keyWith = async (reliability: ShortRangeAgreement | null, prob = 0) => {
            vi.mocked(cacheService.generateAiKey).mockClear();
            vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ engine: 'gemini', candidates: [{ content: { parts: [{ text: JSON.stringify({ risk_level: 'GREEN', hazard_type: 'NONE', text: 'x', tips: [] }) }] } }] }) }));
            const weather = calm({ date: '2026-09-15', temp: 17, day: 1 });
            (weather.hourly as unknown as Record<string, number[]>).precipitation_probability = Array.from({ length: 8 }, () => prob);
            await getGeminiAnalysis(weather, 'ca', 0, null, null, null, reliability);
            return vi.mocked(cacheService.generateAiKey).mock.calls[0][0];
        };
        const keys = [
            await keyWith(null),
            await keyWith({ level: 'high', cause: null, tempMarginC: null }),
            await keyWith({ level: 'low', cause: 'rain', tempMarginC: null }),
            await keyWith({ level: 'medium', cause: 'temp', tempMarginC: 3 }),
            await keyWith({ level: 'medium', cause: 'temp', tempMarginC: 4 }),
            await keyWith(null, 50),
            await keyWith(null, 90)
        ];
        expect(new Set(keys).size).toBe(keys.length);
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
