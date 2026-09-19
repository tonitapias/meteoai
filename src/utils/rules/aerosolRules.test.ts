import { describe, it, expect } from 'vitest';
import { resolveDustAdvisory } from './aerosolRules';
import { WEATHER_THRESHOLDS } from '../../constants/weatherConfig';

const { DUST_MIN, PM10_MIN, MAX_HUMIDITY } = WEATHER_THRESHOLDS.AEROSOL;
const DRY = 40;

describe('resolveDustAdvisory', () => {
    it('pols >= DUST_MIN amb aire sec i sense pluja → avís de calima', () => {
        expect(resolveDustAdvisory({ dust: DUST_MIN, pm10: 30 }, DRY, 0).kind).toBe('dust');
        expect(resolveDustAdvisory({ dust: 438, pm10: 314 }, DRY, 0).kind).toBe('dust');
    });

    it('llindar exacte de la pols (estricte per sota)', () => {
        expect(resolveDustAdvisory({ dust: DUST_MIN - 0.1, pm10: 20 }, DRY, 0).kind).toBeNull();
    });

    it('PM10 alt sense pols identificada → avís de partícules, no de calima', () => {
        expect(resolveDustAdvisory({ dust: 5, pm10: PM10_MIN }, DRY, 0).kind).toBe('particles');
        expect(resolveDustAdvisory({ pm10: 200 }, DRY, 0).kind).toBe('particles');
        expect(resolveDustAdvisory({ dust: 5, pm10: PM10_MIN - 0.1 }, DRY, 0).kind).toBeNull();
    });

    it('si hi ha pols i PM10 alts alhora, mana la pols (calima)', () => {
        expect(resolveDustAdvisory({ dust: 300, pm10: 400 }, DRY, 0).kind).toBe('dust');
    });

    it('només amb aire sec: HR >= MAX_HUMIDITY no avisa (és boirina, no aerosol sec)', () => {
        expect(resolveDustAdvisory({ dust: 400, pm10: 400 }, MAX_HUMIDITY - 1, 0).kind).toBe('dust');
        expect(resolveDustAdvisory({ dust: 400, pm10: 400 }, MAX_HUMIDITY, 0).kind).toBeNull();
        expect(resolveDustAdvisory({ dust: 400, pm10: 400 }, 95, 0).kind).toBeNull();
    });

    it('amb pluja (>= TRACE) no avisa: la pluja renta l\'aire', () => {
        const trace = WEATHER_THRESHOLDS.PRECIPITATION.TRACE;
        expect(resolveDustAdvisory({ dust: 400 }, DRY, trace).kind).toBeNull();
        expect(resolveDustAdvisory({ dust: 400 }, DRY, trace / 2).kind).toBe('dust');
    });

    it('DOCTRINA RISC ZERO: sense dades no s\'avisa mai', () => {
        expect(resolveDustAdvisory(null, DRY, 0).kind).toBeNull();
        expect(resolveDustAdvisory(undefined, DRY, 0).kind).toBeNull();
        expect(resolveDustAdvisory({}, DRY, 0).kind).toBeNull();
        expect(resolveDustAdvisory({ dust: null, pm10: null }, DRY, 0).kind).toBeNull();
        expect(resolveDustAdvisory({ dust: 'x', pm10: NaN }, DRY, 0).kind).toBeNull();
    });

    it('sense HR (no es pot validar l\'aire sec) no s\'avisa; sense pluja de dada compta com a "no plou"', () => {
        expect(resolveDustAdvisory({ dust: 400 }, null, 0).kind).toBeNull();
        expect(resolveDustAdvisory({ dust: 400 }, undefined, 0).kind).toBeNull();
        expect(resolveDustAdvisory({ dust: 400 }, DRY, null).kind).toBe('dust');
    });

    it('un 0 real de pols és una dada (aire net), no una dada absent', () => {
        expect(resolveDustAdvisory({ dust: 0, pm10: 12 }, DRY, 0)).toEqual({ kind: null, dust: 0, pm10: 12 });
    });

    it('retorna les xifres per poder mostrar la que ha disparat l\'avís', () => {
        expect(resolveDustAdvisory({ dust: 250, pm10: 310 }, DRY, 0)).toEqual({ kind: 'dust', dust: 250, pm10: 310 });
    });
});
