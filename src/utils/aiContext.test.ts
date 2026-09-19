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
