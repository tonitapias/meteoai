// src/utils/aifsTemperatureBlend.test.ts
import { describe, it, expect } from 'vitest';
import {
    aifsBlendWeight,
    injectAifsTemperatureBlend,
    AIFS_BLEND_FULL_HOURS,
    AIFS_BLEND_MAX_WEIGHT,
    AIFS_BLEND_START_HOURS
} from './aifsTemperatureBlend';
import type { ExtendedWeatherData } from '../types/weatherLogicTypes';

// 8 dies d'hores a partir de "ara" (current.time = primera hora): l'índex és també les hores vista.
const HOURS = Array.from({ length: 8 * 24 }, (_, i) => {
    const d = new Date(Date.UTC(2026, 8, 26, 0) + i * 3_600_000);
    return d.toISOString().slice(0, 16);
});

// Sèrie principal a 20 °C (rosada 12, sensació 21) i AIFS a 16 °C tot el període.
const build = (overrides: { aifs?: Array<number | null>; temp?: Array<number | null>; now?: string | null } = {}) => ({
    current: { temperature_2m: 20, time: overrides.now === undefined ? HOURS[0] : overrides.now },
    hourly: {
        time: [...HOURS],
        temperature_2m: overrides.temp ?? HOURS.map(() => 20),
        dew_point_2m: HOURS.map(() => 12),
        apparent_temperature: HOURS.map(() => 21),
        relative_humidity_2m: HOURS.map(() => 60)
    },
    hourlyComparison: {
        ecmwf: [], gfs: [], icon: [],
        aifs: (overrides.aifs ?? HOURS.map(() => 16)).map(t => ({ temperature_2m: t }))
    },
    daily: { time: ['2026-09-26'], temperature_2m_max: [25], temperature_2m_min: [10] }
}) as unknown as ExtendedWeatherData;

const series = (d: ExtendedWeatherData, key: string) => (d.hourly as unknown as Record<string, Array<number | null>>)[key];

describe('aifsBlendWeight', () => {
    it('0 fins a 72 h, 25 % a 96 h (dia 4), 50 % a partir de 120 h (dies 5-7)', () => {
        expect(aifsBlendWeight(0)).toBe(0);
        expect(aifsBlendWeight(AIFS_BLEND_START_HOURS)).toBe(0);
        expect(aifsBlendWeight(96)).toBeCloseTo(0.25, 10);
        expect(aifsBlendWeight(AIFS_BLEND_FULL_HOURS)).toBeCloseTo(AIFS_BLEND_MAX_WEIGHT, 10);
        expect(aifsBlendWeight(180)).toBe(AIFS_BLEND_MAX_WEIGHT);
    });

    it('creix sense salts: d\'una hora a la següent el pes canvia com a molt 0,5/48', () => {
        for (let h = 0; h < 200; h++) {
            expect(Math.abs(aifsBlendWeight(h + 1) - aifsBlendWeight(h))).toBeLessThanOrEqual(AIFS_BLEND_MAX_WEIGHT / 48 + 1e-12);
        }
    });

    it('hores vista no numèriques: cap barreja', () => {
        expect(aifsBlendWeight(NaN)).toBe(0);
    });
});

describe('injectAifsTemperatureBlend', () => {
    it('dies 1-3 intactes; dia 4 amb un 25 % d\'AIFS i dies 5-7 amb un 50 %', () => {
        const t = series(injectAifsTemperatureBlend(build()), 'temperature_2m');
        expect(t.slice(0, AIFS_BLEND_START_HOURS + 1).every(v => v === 20)).toBe(true);
        expect(t[96]).toBeCloseTo(19, 10);   // 20 + 0,25 × (16 − 20)
        expect(t[120]).toBeCloseTo(18, 10);  // 20 + 0,5 × (16 − 20)
        expect(t[HOURS.length - 1]).toBeCloseTo(18, 10);
    });

    it('la rosada i la sensació es desplacen el mateix que la temperatura; la humitat no es toca', () => {
        const out = injectAifsTemperatureBlend(build());
        const t = series(out, 'temperature_2m');
        const td = series(out, 'dew_point_2m');
        const feels = series(out, 'apparent_temperature');
        [96, 120, 150].forEach(i => {
            expect((t[i] as number) - (td[i] as number)).toBeCloseTo(8, 10);
            expect((feels[i] as number) - (t[i] as number)).toBeCloseTo(1, 10);
        });
        expect(series(out, 'relative_humidity_2m').every(v => v === 60)).toBe(true);
    });

    it('els diaris crus del model no es toquen (la fiabilitat i el rang probable els comparen entre models)', () => {
        const out = injectAifsTemperatureBlend(build());
        expect(out.daily.temperature_2m_max).toEqual([25]);
        expect(out.daily.temperature_2m_min).toEqual([10]);
    });

    it('una hora sense AIFS o sense temperatura queda tal com ve (mai un 0 fals)', () => {
        const aifs = HOURS.map((_, i) => (i === 130 ? null : 16));
        const temp: Array<number | null> = HOURS.map((_, i) => (i === 140 ? null : 20));
        const out = injectAifsTemperatureBlend(build({ aifs, temp }));
        const t = series(out, 'temperature_2m');
        expect(t[130]).toBe(20);
        expect(series(out, 'dew_point_2m')[130]).toBe(12);
        expect(t[140]).toBeNull();
        expect(t[141]).toBeCloseTo(18, 10);
    });

    it('les hores vista es compten des de current.time', () => {
        // "Ara" 24 h més tard: l'hora 96 del vector és a 72 h vista i encara no es barreja.
        const out = injectAifsTemperatureBlend(build({ now: HOURS[24] }));
        const t = series(out, 'temperature_2m');
        expect(t[96]).toBe(20);
        expect(t[120]).toBeCloseTo(19, 10);
    });

    it('sense AIFS, sense hora actual o sense dades a barrejar torna el mateix objecte', () => {
        const noAifs = build(); (noAifs.hourlyComparison as { aifs?: unknown }).aifs = undefined;
        expect(injectAifsTemperatureBlend(noAifs)).toBe(noAifs);
        const noNow = build({ now: null });
        expect(injectAifsTemperatureBlend(noNow)).toBe(noNow);
        const allNullAifs = build({ aifs: HOURS.map(() => null) });
        expect(injectAifsTemperatureBlend(allNullAifs)).toBe(allNullAifs);
    });

    it('no muta les dades d\'entrada', () => {
        const data = build();
        injectAifsTemperatureBlend(data);
        expect(series(data, 'temperature_2m').every(v => v === 20)).toBe(true);
        expect(series(data, 'dew_point_2m').every(v => v === 12)).toBe(true);
    });
});
