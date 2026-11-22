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

// "No s'esperen precipitacions" surt amb poc núvol: ara amb la cobertura EFECTIVA de la capçalera, no amb la total bruta
// del model (current.cloud_cover, aquí un 10 % que contradiria un 80 % efectiu). Sense % efectiu, no es diu.
describe('generateAIPrediction — cobertura de núvols del resum provisional', () => {
    const says = (effective: number | null) =>
        generateAIPrediction(current, daily, hourly, 0, 'ca', 1, null, 'C', null, false, effective).text
            .includes((tr.aiRainNone as string).trim());

    it('fa servir la cobertura efectiva, no la bruta', () => {
        expect(says(10)).toBe(true);
        expect(says(80)).toBe(false);
    });

    it('sense cobertura efectiva no ho afirma', () => {
        expect(says(null)).toBe(false);
    });
});

// Auditoria d'UX del 16/11/2026 (A3): "Gaudeix del dia" a les 20:18. Sense res a dir, el consell depèn de si és de dia.
describe('generateAIPrediction — consell tranquil de dia o de nit', () => {
    const calm = { ...current, temperature_2m: 18, apparent_temperature: 18, relative_humidity_2m: 60, visibility: 20000 };
    const tipsAt = (isDay: number) =>
        generateAIPrediction({ ...calm, is_day: isDay } as StrictCurrentWeather, daily, hourly, 0, 'ca', 0, null, 'C').tips;

    it('de dia, "Gaudeix del dia"', () => {
        expect(tipsAt(1)).toEqual([tr.tipCalm]);
    });

    it('de nit, "Nit tranquil·la"', () => {
        expect(tipsAt(0)).toEqual([tr.tipCalmNight]);
        expect(tr.tipCalmNight).toBe('Nit tranquil·la');
    });

    it('té traducció en els quatre idiomes', () => {
        for (const lang of ['ca', 'es', 'en', 'fr'] as const) {
            expect((TRANSLATIONS[lang] as Record<string, unknown>).tipCalmNight).toBeTruthy();
        }
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

// La insígnia de l'anàlisi diu QUÈ és incert: "Temperatura ±N°" en ambre (mai vermell), la pluja dubtosa (ambre) o
// incerta (vermell), i els textos generals quan dubten totes dues coses. Sense comparació entre models o sense les
// dades d'ara no n'hi ha cap: abans sortia "Consens Models" per defecte o "Incertesa alta", i quan el text de Gemini
// substituïa el missatge de "sense dades" la insígnia vermella quedava sola al costat d'un text normal.
describe("generateAIPrediction — insígnia d'acord entre models", () => {
    const badge = (reliability: Parameters<typeof generateAIPrediction>[6], cur: StrictCurrentWeather = current) => {
        const out = generateAIPrediction(cur, daily, hourly, 0, 'ca', 3, reliability, 'C');
        return { level: out.confidenceLevel, text: out.confidence, color: out.confidenceColor, hint: out.confidenceHint };
    };

    it('amb acord: "Consens Models" en verd', () => {
        expect(badge({ level: 'high', cause: null, tempMarginC: null })).toEqual({ level: 'high', text: tr.aiConfidence, color: 'green', hint: tr.aiConfidenceHintHigh });
    });

    it('només la temperatura: "Temperatura ±N°" en ambre, també amb el dubte fort (mai vermell)', () => {
        expect(badge({ level: 'medium', cause: 'temp', tempMarginC: 3 })).toMatchObject({ level: 'medium', text: 'Temperatura ±3°', color: 'amber' });
        const strong = badge({ level: 'low', cause: 'temp', tempMarginC: 4 });
        expect(strong).toMatchObject({ level: 'low', text: 'Temperatura ±4°', color: 'amber' });
        expect(strong.hint).toContain('±4°');
    });

    it('en Fahrenheit el marge es converteix (±3 °C = ±5 °F, ±4 °C = ±7 °F)', () => {
        const f = (tempMarginC: number) =>
            generateAIPrediction(current, daily, hourly, 0, 'ca', 3, { level: 'medium', cause: 'temp', tempMarginC }, 'F').confidence;
        expect(f(3)).toBe('Temperatura ±5°');
        expect(f(4)).toBe('Temperatura ±7°');
    });

    it('la pluja: dubtosa en ambre, incerta en vermell', () => {
        expect(badge({ level: 'medium', cause: 'rain', tempMarginC: null })).toMatchObject({ text: tr.aiConfidenceRainMod, color: 'amber', hint: tr.aiConfidenceHintRain });
        expect(badge({ level: 'low', cause: 'rain', tempMarginC: null })).toMatchObject({ text: tr.aiConfidenceRainLow, color: 'red', hint: tr.aiConfidenceHintRain });
    });

    it('temperatura i pluja alhora: els textos generals, ambre o vermell', () => {
        expect(badge({ level: 'medium', cause: 'both', tempMarginC: 3 })).toMatchObject({ text: tr.aiConfidenceMod, color: 'amber', hint: tr.aiConfidenceHintBoth });
        expect(badge({ level: 'low', cause: 'both', tempMarginC: 4 })).toMatchObject({ text: tr.aiConfidenceLow, color: 'red', hint: tr.aiConfidenceHintBoth });
    });

    it('cada llengua té el seu text de temperatura', () => {
        const temp = (lang: 'es' | 'en' | 'fr') =>
            generateAIPrediction(current, daily, hourly, 0, lang, 3, { level: 'medium', cause: 'temp', tempMarginC: 3 }, 'C').confidence;
        expect(temp('es')).toBe('Temperatura ±3°');
        expect(temp('en')).toBe('Temperature ±3°');
        expect(temp('fr')).toBe('Température ±3°');
    });

    it('sense comparació entre models no hi ha insígnia (no un "Consens" per defecte)', () => {
        expect(badge(null)).toEqual({ level: null, text: '', color: null, hint: '' });
    });

    it('sense la temperatura d\'ara no hi ha insígnia (no una "Incertesa alta"), encara que els models coincideixin', () => {
        const noTemp = { ...current, temperature_2m: null } as unknown as StrictCurrentWeather;
        const out = generateAIPrediction(noTemp, daily, hourly, 0, 'ca', 3, { level: 'high', cause: null, tempMarginC: null }, 'C');
        expect(out.text).toBe(tr.aiNoData);
        expect(out.confidenceLevel).toBeNull();
        expect(out.confidenceColor).toBeNull();
        expect(out.confidence).toBe('');
    });
});

// El text de reserva (el que es veu mentre la IA carrega, o si falla) tenia tres frases en català fix: també les
// rebien els usuaris d'es/en/fr. Ara surten de les claus de traducció que ja existien.
describe('generateAIPrediction — frases de reserva traduïdes (no català fix)', () => {
    const CATALAN_FIXED = [/s'intensificarà notablement aviat/, /remetent properament/, /Ratxes de vent fortes/];
    // El "ara" és la 01:00 (índex 1): precipitació d'ara i de la següent hora.
    // Tres hores (00, 01 i 02 h) perquè l'hora actual (01:00) sigui l'índex 1 de la sèrie (abans el test depenia de fer
    // servir l'hora local com a índex; vegeu X4).
    const withRain = (now: number, next: number) => ({ ...hourly, time: ['2026-09-19T00:00', '2026-09-19T01:00', '2026-09-19T02:00'], precipitation: [0, now, next] }) as unknown as StrictHourlyWeather;

    (['ca', 'es', 'en', 'fr'] as const).forEach(lang => {
        const t = TRANSLATIONS[lang] as unknown as Record<string, string>;

        it(`[${lang}] la pluja que s'intensifica i la que remet usen la frase de la llengua`, () => {
            const more = generateAIPrediction(current, daily, withRain(0.5, 3), 0, lang, 3, null, 'C').text;
            expect(more).toContain(t.aiRainMore.trim());
            const stops = generateAIPrediction(current, daily, withRain(1, 0), 0, lang, 3, null, 'C').text;
            expect(stops).toContain(t.aiRainStopping.trim());
            if (lang !== 'ca') CATALAN_FIXED.forEach(re => { expect(more).not.toMatch(re); expect(stops).not.toMatch(re); });
        });

        it(`[${lang}] les ratxes fortes avisen amb el text de la llengua`, () => {
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

describe('generateAIPrediction — llamps observats a prop', () => {
    it('amb llamps a 30 km o menys avisa de tempesta encara que el model no en prevegi (IA caiguda)', () => {
        const calm = generateAIPrediction(current, daily, hourly, 0, 'ca', 3, null, 'C', null, false);
        expect(calm.alerts.some(a => a.msg === tr.alertStorm)).toBe(false);
        const near = generateAIPrediction(current, daily, hourly, 0, 'ca', 3, null, 'C', null, true);
        expect(near.alerts.some(a => a.msg === tr.alertStorm && a.level === 'high')).toBe(true);
    });
});

// Auditoria del 16/11/2026 (X4): les hores es llegien amb l'hora local (0-23) com a índex. Amb una sèrie que comença el
// dia abans, a la 01:00 llegia la pluja de la 01:00 d'ahir.
describe('generateAIPrediction — índex de l\'hora actual', () => {
    it('llegeix la probabilitat de pluja de les hores que venen, encara que la sèrie no comenci a les 00:00 d\'avui', () => {
        const times = Array.from({ length: 30 }, (_, i) => {
            const d = new Date(Date.UTC(2026, 8, 18, i));
            return d.toISOString().slice(0, 16);
        });
        // Ara = 19/09 01:00 → índex 25. Només hi ha probabilitat alta a partir de l'índex 25.
        const probs = times.map((_, i) => (i >= 25 ? 80 : 0));
        const h = { time: times, precipitation: times.map(() => 0), precipitation_probability: probs, cape: times.map(() => 0) } as unknown as StrictHourlyWeather;
        const out = generateAIPrediction({ ...current, time: '2026-09-19T01:00', is_day: 0 } as StrictCurrentWeather, daily, h, 0, 'ca', 3, null, 'C');
        expect(out.tips).toContain(tr.tipUmbrella);
    });
});

// Auditoria d'UX, segona volta (N2): a Girona, amb 20 °C i 17 °C de sensació, deia «Ambient fresc. Jaqueta lleugera
// recomanada». I a la tarda, amb la mínima d'avui (la de la matinada) per sota de 10, deia «Fa força fred» en present.
describe('generateAIPrediction — frase de temperatura del resum provisional', () => {
    const at = (hour: string, temp: number, feels: number, mins: (number | null)[]) => generateAIPrediction(
        { ...current, time: `2026-11-17T${hour}`, temperature_2m: temp, apparent_temperature: feels, relative_humidity_2m: 60 } as StrictCurrentWeather,
        { ...daily, time: ['2026-11-17', '2026-11-18'], temperature_2m_min: mins } as unknown as StrictDailyWeather,
        { ...hourly, time: [`2026-11-17T${hour}`] } as unknown as StrictHourlyWeather,
        0, 'ca', 1, null, 'C', null, false, 10
    ).text;
    const say = (key: string) => (tr[key] as string).trim();

    it('amb 17 °C de sensació, suau i no «fresc»', () => {
        const text = at('12:00', 20, 17, [8, 9]);
        expect(text).toContain(say('aiTempMild'));
        expect(text).not.toContain(say('aiTempCool'));
    });

    it('«Temperatures suaus», no «Temperaturas»', () => {
        expect(say('aiTempMild')).toBe('Temperatures suaus i agradables.');
    });

    it('per sota de 15 °C de sensació, fresc', () => {
        expect(at('11:00', 15, 13, [8, 9])).toContain(say('aiTempCool'));
    });

    it('a la tarda, si la nit que ve baixa de 10 °C, ho diu en futur', () => {
        expect(at('18:00', 14, 13, [12, 7])).toContain(say('aiTempCoolEvening'));
    });

    it('la mínima d\'avui (la de la matinada) no compta: si la nit que ve no baixa de 10, fresc', () => {
        const text = at('18:00', 14, 13, [5, 11]);
        expect(text).toContain(say('aiTempCool'));
        expect(text).not.toContain(say('aiTempCold'));
    });

    it('amb sensació suau no parla de fred encara que la nit sigui freda', () => {
        const text = at('18:00', 20, 17, [5, 4]);
        expect(text).toContain(say('aiTempMild'));
        expect(text).not.toContain(say('aiTempCold'));
        expect(text).not.toContain(say('aiTempCoolEvening'));
    });

    it('sense la mínima de demà, fresc (no s\'inventa la nit)', () => {
        expect(at('18:00', 14, 13, [5])).toContain(say('aiTempCool'));
    });

    it('té traducció en els quatre idiomes', () => {
        for (const lang of ['ca', 'es', 'en', 'fr'] as const) {
            expect((TRANSLATIONS[lang] as Record<string, unknown>).aiTempCoolEvening).toEqual(expect.any(String));
        }
    });
});
