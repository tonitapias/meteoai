import { describe, it, expect } from 'vitest';
import { injectBaseRainEvidence, injectHighResModels } from './regionalModelEngine';
import { REGIONAL_MODELS, REGIONAL_TEMP_FLAG_KEY } from '../constants/regionalModels';
import type { ExtendedWeatherData } from '../types/weatherLogicTypes';

const AROME_MODEL = REGIONAL_MODELS.find(m => m.id === 'AROME_HD')!;

const DATES = ['2026-09-26', '2026-09-27'];
const HOURS = DATES.flatMap(d => Array.from({ length: 24 }, (_, h) => `${d}T${String(h).padStart(2, '0')}:00`));
const at = (day: number, hour: number) => day * 24 + hour;

// Sèrie principal com la de Roses el diumenge 27: 0 % de probabilitat (ensemble d'ICON) i plugim del model
// determinista (ECMWF 9 km) de 06 a 14 h.
const ROSES_MM: Record<number, number> = { 6: 0.1, 7: 0.1, 8: 0.1, 9: 0.3, 10: 0.3, 11: 0.3, 12: 0.1, 13: 0.1, 14: 0.1 };

type IconMode = 'different' | 'same' | 'none';

// `icon`: la comparativa d'ICON que l'app baixa a part. 'different' = la sèrie principal és un altre model (Roses:
// Météo-France/ECMWF); 'same' = la sèrie principal ÉS ICON (Girona, Barcelona...); 'none' = sense dada d'ICON.
const baseData = (opts: { prob?: Array<number | null>; mm?: Array<number | null>; dailyProb?: Array<number | null>; icon?: IconMode } = {}) => {
    const precipitation = opts.mm ?? HOURS.map((_, i) => (i >= 24 ? ROSES_MM[i - 24] ?? 0 : 0));
    const icon = opts.icon ?? 'different';
    return {
        current: { temperature_2m: 20, is_day: 1, time: HOURS[0] },
        hourly: {
            time: [...HOURS],
            temperature_2m: HOURS.map(() => 20),
            relative_humidity_2m: HOURS.map(() => 80),
            precipitation,
            precipitation_probability: opts.prob ?? HOURS.map(() => 0),
        },
        hourlyComparison: {
            ecmwf: [], gfs: [], aifs: [],
            icon: icon === 'none' ? [] : HOURS.map((_, i) => icon === 'same'
                ? { temperature_2m: 20, relative_humidity_2m: 80, precipitation: precipitation[i] }
                : { temperature_2m: 19.4, relative_humidity_2m: 74, precipitation: 0 }),
        },
        daily: { time: [...DATES], precipitation_probability_max: opts.dailyProb ?? [0, 1] },
    } as unknown as ExtendedWeatherData;
};

const hourlyProb = (d: ExtendedWeatherData) => (d.hourly as unknown as Record<string, Array<number | null>>).precipitation_probability;

describe('injectBaseRainEvidence — la probabilitat de la sèrie principal no contradiu la pluja que es mostra', () => {
    it('Roses 27-09: 0 % amb 0,1-0,3 mm passa a la freqüència observada (10 %), no a 0 % ni a "segur"', () => {
        const p = hourlyProb(injectBaseRainEvidence(baseData()));
        for (let h = 6; h <= 14; h++) expect(p[at(1, h)]).toBe(10);
    });

    it("l'evidència s'estén ±1 h i no més enllà", () => {
        const p = hourlyProb(injectBaseRainEvidence(baseData()));
        expect([p[at(1, 5)], p[at(1, 15)]]).toEqual([10, 10]);
        expect([p[at(1, 4)], p[at(1, 16)]]).toEqual([0, 0]);
        expect(p.slice(0, 24).every(v => v === 0)).toBe(true);
    });

    it('el dia hereta el màxim de les hores (llista de 7 dies i gràfic de tendència = taula horària)', () => {
        const out = injectBaseRainEvidence(baseData());
        expect(out.daily.precipitation_probability_max).toEqual([0, 10]);
    });

    it('mai no baixa: una probabilitat que ja és alta queda igual, i per sota de 34 % puja segons la corba', () => {
        const prob = HOURS.map(() => 50);
        prob[at(1, 9)] = 10;
        const p = hourlyProb(injectBaseRainEvidence(baseData({ prob })));
        expect(p[at(1, 8)]).toBe(50);
        expect(p[at(1, 9)]).toBe(20);
    });

    it('sense pluja mesurable a la sèrie mostrada, no hi ha evidència', () => {
        const mm = HOURS.map(() => 0.05);
        const input = baseData({ mm });
        expect(injectBaseRainEvidence(input)).toBe(input);
    });

    it("una hora sense probabilitat no se n'inventa cap (Risc Zero)", () => {
        const prob: Array<number | null> = HOURS.map(() => 0);
        prob[at(1, 9)] = null;
        const p = hourlyProb(injectBaseRainEvidence(baseData({ prob })));
        expect(p[at(1, 9)]).toBeNull();
        expect(p[at(1, 10)]).toBe(10);
    });

    it('on la sèrie principal ÉS ICON no es toca: la seva pluja ja és dins de la probabilitat del seu ensemble', () => {
        const input = baseData({ icon: 'same' });
        expect(injectBaseRainEvidence(input)).toBe(input);
    });

    it("sense comparativa d'ICON no se sap si la sèrie és independent, i no es toca", () => {
        const input = baseData({ icon: 'none' });
        expect(injectBaseRainEvidence(input)).toBe(input);
    });

    it("on ICON ja no arriba (valors null) i la sèrie sí, la sèrie no és ICON (el best_match passa a ECMWF)", () => {
        const input = baseData({ icon: 'same' });
        const icon = input.hourlyComparison!.icon;
        for (let h = 0; h < 24; h++) icon[at(1, h)] = { temperature_2m: null, relative_humidity_2m: null, precipitation: null };
        const p = hourlyProb(injectBaseRainEvidence(input));
        expect(p[at(1, 9)]).toBe(10);
    });

    it("una comparativa d'ICON sense els camps (no baixada) no permet afirmar res", () => {
        const input = baseData({ icon: 'same' });
        const icon = input.hourlyComparison!.icon;
        for (let h = 0; h < 24; h++) icon[at(1, h)] = {};
        expect(injectBaseRainEvidence(input)).toBe(input);
    });

    it("n'hi ha prou que un dels camps difereixi d'ICON (la pluja, aquí) perquè l'hora compti com a independent", () => {
        const input = baseData({ icon: 'same' });
        const icon = input.hourlyComparison!.icon;
        icon[at(1, 9)] = { ...icon[at(1, 9)], precipitation: 0 };
        const p = hourlyProb(injectBaseRainEvidence(input));
        expect(p[at(1, 9)]).toBe(10);
        expect(p[at(1, 8)]).toBe(0);
    });

    it('no muta les dades d\'entrada', () => {
        const input = baseData();
        const before = JSON.stringify(input);
        injectBaseRainEvidence(input);
        expect(JSON.stringify(input)).toBe(before);
    });

    it('no toca les hores del model regional (ja porten la seva pròpia evidència)', () => {
        const input = baseData();
        (input.hourly as unknown as Record<string, unknown>)[REGIONAL_TEMP_FLAG_KEY] = HOURS.map((_, i) => (i === at(1, 9) ? 1 : null));
        const p = hourlyProb(injectBaseRainEvidence(input));
        expect(p[at(1, 9)]).toBe(0);
        expect(p[at(1, 8)]).toBe(10);
    });

    it('amb model regional: les seves hores segueixen la seva pluja, la resta la de la sèrie principal', () => {
        // El regional cobreix el dia 26 (sec) i no arriba al 27: el 27 l'evidència ve de la sèrie principal.
        const mm = HOURS.map((_, i) => (i === at(0, 12) || i >= 24 ? (i === at(0, 12) ? 0.4 : ROSES_MM[i - 24] ?? 0) : 0));
        const regional = {
            current: { temperature_2m: 21 },
            hourly: { time: HOURS.slice(0, 24), temperature_2m: HOURS.slice(0, 24).map(() => 21), precipitation: HOURS.slice(0, 24).map(() => 0) },
        } as unknown as ExtendedWeatherData;
        const out = injectBaseRainEvidence(injectHighResModels(baseData({ mm }), regional, AROME_MODEL));
        const p = hourlyProb(out);
        // Dia 26: el regional diu sec (i és el que es mostra), així que els 0,4 mm del global no hi compten.
        expect(p[at(0, 12)]).toBe(0);
        // Dia 27: sense regional, la pluja mostrada és la global.
        expect(p[at(1, 10)]).toBe(10);
        expect(out.daily.precipitation_probability_max).toEqual([0, 10]);
    });
});
