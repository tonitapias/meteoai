import { describe, it, expect } from 'vitest';
import { generateAIPrediction } from './aiContext';
import { TRANSLATIONS } from '../translations';
import type { StrictCurrentWeather, StrictDailyWeather, StrictHourlyWeather } from '../types/weatherLogicTypes';

const tr = TRANSLATIONS.ca as Record<string, unknown>;

// Cas real (Vic, nit del 18 al 19/09/2026): el model global dona codi 45 (boira) però la
// política de boira (visibilityRules.resolveFog) no la confirma i l'orquestrador dona 3.
const current = {
    time: '2026-09-19T01:00',
    weather_code: 45,                // codi BRUT d'ICON
    temperature_2m: 15.2,
    apparent_temperature: 15,
    relative_humidity_2m: 94,
    wind_speed_10m: 3,
    is_day: 0,
    cloud_cover: 10,
    visibility: 840,
} as unknown as StrictCurrentWeather;
const daily = { time: ['2026-09-19'], temperature_2m_min: [12], precipitation_sum: [0], uv_index_max: [0] } as unknown as StrictDailyWeather;
const hourly = { time: ['2026-09-19T01:00'], precipitation: [0], precipitation_probability: [0], cape: [0] } as unknown as StrictHourlyWeather;

describe('generateAIPrediction — codi de temps de la política de boira', () => {
    it('amb effectiveCode (el que veu l\'usuari) NO parla de boira si la política no la confirma', () => {
        const out = generateAIPrediction(current, daily, hourly, 0, 'ca', 3, null, 'C');
        expect(out.text).not.toContain(tr.aiSummaryFog as string);
        expect(out.text).toContain((tr.aiSummaryOvercast as string).trim());
        expect(out.alerts.some(a => a.type === 'VIS')).toBe(false);
    });

    it('si la política confirma la boira (effectiveCode 45), el text la descriu i avisa de la visibilitat', () => {
        // L'avís de visibilitat només salta per sota de 500 m.
        const lowVis = { ...current, visibility: 400 } as StrictCurrentWeather;
        const out = generateAIPrediction(lowVis, daily, hourly, 0, 'ca', 45, null, 'C');
        expect(out.text).toContain(tr.aiSummaryFog as string);
        expect(out.alerts.some(a => a.type === 'VIS')).toBe(true);
    });

    it('sense effectiveCode cau al codi brut del model (comportament anterior)', () => {
        const out = generateAIPrediction(current, daily, hourly, 0, 'ca', null, null, 'C');
        expect(out.text).toContain(tr.aiSummaryFog as string);
    });
});

describe("generateAIPrediction — avís d'aerosols (pols/partícules)", () => {
    const msgs = (dustKind: 'dust' | 'particles' | null, aqi = 0) =>
        generateAIPrediction(current, daily, hourly, aqi, 'ca', 3, null, 'C', dustKind).alerts.map(a => a.msg);

    it('amb calima avisa amb el text de pols, que no promet una visibilitat baixa', () => {
        expect(msgs('dust')).toContain(tr.alertDust);
        expect(tr.alertDust as string).toMatch(/no sempre baixa/);
    });

    it('amb partícules (PM10 sense pols) avisa amb el text de partícules', () => {
        expect(msgs('particles')).toContain(tr.alertParticles);
        expect(msgs('particles')).not.toContain(tr.alertDust);
    });

    it("l'avís d'aerosols substitueix l'avís genèric de qualitat de l'aire (no en surten dos)", () => {
        const withDust = msgs('dust', 90);
        expect(withDust).toContain(tr.alertDust);
        expect(withDust).not.toContain(tr.alertAir);
    });

    it("sense avís d'aerosols, l'avís genèric de qualitat de l'aire continua igual", () => {
        expect(msgs(null, 90)).toContain(tr.alertAir);
        expect(msgs(null, 0)).not.toContain(tr.alertDust);
    });
});

// La insígnia de l'anàlisi (Consens / Divergència / Incertesa alta). Sense comparació entre models o sense les dades
// d'ara no n'hi ha cap: abans sortia "Consens Models" per defecte o "Incertesa alta", i quan el text de Gemini
// substituïa el missatge de "sense dades" la insígnia vermella quedava sola al costat d'un text normal.
describe("generateAIPrediction — insígnia d'acord entre models", () => {
    const badge = (reliability: Parameters<typeof generateAIPrediction>[6], cur: StrictCurrentWeather = current) => {
        const out = generateAIPrediction(cur, daily, hourly, 0, 'ca', 3, reliability, 'C');
        return { level: out.confidenceLevel, text: out.confidence };
    };

    it('cada nivell té el seu text', () => {
        expect(badge({ level: 'high', type: 'ok', value: 0 })).toEqual({ level: 'high', text: tr.aiConfidence });
        expect(badge({ level: 'medium', type: 'divergent', value: 0 })).toEqual({ level: 'medium', text: tr.aiConfidenceMod });
        expect(badge({ level: 'low', type: 'temp', value: 7 })).toEqual({ level: 'low', text: tr.aiConfidenceLow });
    });

    it('sense comparació entre models no hi ha insígnia (no un "Consens" per defecte)', () => {
        expect(badge(null)).toEqual({ level: null, text: '' });
    });

    it('sense la temperatura d\'ara no hi ha insígnia (no una "Incertesa alta"), encara que els models coincideixin', () => {
        const noTemp = { ...current, temperature_2m: null } as unknown as StrictCurrentWeather;
        const out = generateAIPrediction(noTemp, daily, hourly, 0, 'ca', 3, { level: 'high', type: 'ok', value: 0 }, 'C');
        expect(out.text).toBe(tr.aiNoData);
        expect(out.confidenceLevel).toBeNull();
        expect(out.confidence).toBe('');
    });
});

// El text de reserva (el que es veu mentre la IA carrega, o si falla) tenia tres frases en català fix: també les
// rebien els usuaris d'es/en/fr. Ara surten de les claus de traducció que ja existien.
describe('generateAIPrediction — frases de reserva traduïdes (no català fix)', () => {
    const CATALAN_FIXED = [/s'intensificarà notablement aviat/, /remetent properament/, /Ràfegues de vent fortes/];
    // El "ara" és la 01:00 (índex 1): precipitació d'ara i de la següent hora.
    const withRain = (now: number, next: number) => ({ ...hourly, precipitation: [0, now, next] }) as unknown as StrictHourlyWeather;

    (['ca', 'es', 'en', 'fr'] as const).forEach(lang => {
        const t = TRANSLATIONS[lang] as unknown as Record<string, string>;

        it(`[${lang}] la pluja que s'intensifica i la que remet usen la frase de la llengua`, () => {
            const more = generateAIPrediction(current, daily, withRain(0.5, 3), 0, lang, 3, null, 'C').text;
            expect(more).toContain(t.aiRainMore.trim());
            const stops = generateAIPrediction(current, daily, withRain(1, 0), 0, lang, 3, null, 'C').text;
            expect(stops).toContain(t.aiRainStopping.trim());
            if (lang !== 'ca') CATALAN_FIXED.forEach(re => { expect(more).not.toMatch(re); expect(stops).not.toMatch(re); });
        });

        it(`[${lang}] les ràfegues fortes avisen amb el text de la llengua`, () => {
            const gusty = { ...current, wind_gusts_10m: 60 } as unknown as StrictCurrentWeather;
            const msgs = generateAIPrediction(gusty, daily, hourly, 0, lang, 3, null, 'C').alerts.map(a => a.msg);
            expect(msgs).toContain(t.alertWindHigh);
        });
    });

    it('si analyzePrecipitation ja ha dit que la pluja remet, la frase no es repeteix', () => {
        const raining = { ...current, minutely15: [0.5, 0] } as unknown as StrictCurrentWeather;
        const text = generateAIPrediction(raining, daily, withRain(1, 0), 0, 'ca', 61, null, 'C').text;
        const sentence = (TRANSLATIONS.ca as unknown as Record<string, string>).aiRainStopping.trim();
        expect(text.split(sentence).length - 1).toBe(1);
    });
});
