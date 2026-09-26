import { describe, it, expect } from 'vitest';
import { injectTropicalRainGate, isTropicalRainGateHour, isTropicalRainGateZone, TROPICAL_RAIN_GATE_KEY } from './tropicalRainGate';
import type { ExtendedWeatherData } from '../types/weatherLogicTypes';

describe('isTropicalRainGateZone', () => {
    it('al tròpic sense model regional el filtre s\'aplica (Natal, Ubud, Darwin, Hong Kong)', () => {
        expect(isTropicalRainGateZone(-5.79, -35.21)).toBe(true);
        expect(isTropicalRainGateZone(-8.51, 115.26)).toBe(true);
        expect(isTropicalRainGateZone(-12.42, 130.89)).toBe(true);
        expect(isTropicalRainGateZone(22.3, 114.2)).toBe(true);
    });

    it('fora del tròpic no s\'aplica (Vic, Taipei, Ciutat del Cap)', () => {
        expect(isTropicalRainGateZone(41.93, 2.25)).toBe(false);
        expect(isTropicalRainGateZone(25.03, 121.56)).toBe(false);
        expect(isTropicalRainGateZone(-33.92, 18.42)).toBe(false);
    });

    it('al tròpic però dins d\'un model regional (l\'Havana, domini d\'HRRR) no s\'aplica', () => {
        expect(isTropicalRainGateZone(23.13, -82.38)).toBe(false);
    });

    it('sense coordenades vàlides no s\'aplica', () => {
        expect(isTropicalRainGateZone(null, 10)).toBe(false);
        expect(isTropicalRainGateZone(5, undefined)).toBe(false);
        expect(isTropicalRainGateZone(NaN, 10)).toBe(false);
    });
});

describe('injectTropicalRainGate', () => {
    const data = () => ({
        hourly: { time: ['2026-09-27T00:00', '2026-09-27T01:00', '2026-09-27T02:00'], precipitation: [0.1, 0.2, 0] }
    }) as unknown as ExtendedWeatherData;

    it('al tròpic marca totes les hores, sense mutar les dades d\'entrada', () => {
        const input = data();
        const out = injectTropicalRainGate(input, -5.79, -35.21);
        expect((out.hourly as Record<string, unknown>)[TROPICAL_RAIN_GATE_KEY]).toEqual([1, 1, 1]);
        expect((input.hourly as Record<string, unknown>)[TROPICAL_RAIN_GATE_KEY]).toBeUndefined();
        expect((out.hourly as Record<string, unknown>).precipitation).toEqual([0.1, 0.2, 0]);
    });

    it('fora de la zona torna les mateixes dades, sense cap marca', () => {
        const input = data();
        expect(injectTropicalRainGate(input, 41.93, 2.25)).toBe(input);
    });

    it('sense sèrie horària no fa res', () => {
        const input = {} as ExtendedWeatherData;
        expect(injectTropicalRainGate(input, -5.79, -35.21)).toBe(input);
    });
});

describe('isTropicalRainGateHour', () => {
    it('llegeix la marca de l\'hora; sense marca (o sense clau) és fals', () => {
        const hourly = { [TROPICAL_RAIN_GATE_KEY]: [1, null] };
        expect(isTropicalRainGateHour(hourly, 0)).toBe(true);
        expect(isTropicalRainGateHour(hourly, 1)).toBe(false);
        expect(isTropicalRainGateHour({}, 0)).toBe(false);
        expect(isTropicalRainGateHour(null, 0)).toBe(false);
    });
});
