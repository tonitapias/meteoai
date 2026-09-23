import { describe, it, expect } from 'vitest';
import { rainProbabilityWithModelEvidence as evidence, MEASURABLE_RAIN_MM } from './rainEvidence';

describe('rainProbabilityWithModelEvidence', () => {
    it('sense pluja mesurable al model regional (o sense dada) no toca la probabilitat global', () => {
        expect(evidence(15, 0)).toBe(15);
        expect(evidence(15, MEASURABLE_RAIN_MM - 0.01)).toBe(15);
        expect(evidence(15, null)).toBe(15);
        expect(evidence(15, NaN)).toBe(15);
    });

    it('el llindar és el de la pluja mesurable (0,1 mm/h), el mateix que defineix la probabilitat global', () => {
        expect(MEASURABLE_RAIN_MM).toBe(0.1);
        expect(evidence(10, 0.1)).toBeGreaterThan(10);
    });

    it('amb pluja regional puja fins a la freqüència de pluja observada, no a un 70 % fix', () => {
        // Punts calibrats: PoP ~0 -> 10 %, 11 % -> 21 %, 34 % -> 34 %.
        expect(evidence(0, 0.2)).toBe(10);
        expect(evidence(10, 0.2)).toBe(20);
        expect(evidence(20, 0.2)).toBe(26);
        expect(evidence(30, 0.2)).toBe(32);
        for (const pop of [0, 5, 10, 20, 30]) {
            expect(evidence(pop, 3)).toBeLessThan(45);
        }
    });

    it('la quantitat prevista no canvia el resultat (una pluja de 0,1 mm i una de 5 mm donen la mateixa evidència)', () => {
        for (const pop of [0, 5, 10, 25]) {
            expect(evidence(pop, 5)).toBe(evidence(pop, 0.1));
        }
    });

    it('mai no baixa una probabilitat: on la global ja és igual o més alta, la deixa tal qual', () => {
        for (const pop of [34, 35, 40, 50, 60, 80, 100]) {
            expect(evidence(pop, 2)).toBe(pop);
        }
        for (let pop = 0; pop <= 100; pop++) {
            expect(evidence(pop, 2)).toBeGreaterThanOrEqual(pop);
        }
    });

    it('és monòtona: una global més alta mai no dona un resultat més baix', () => {
        let previous = -1;
        for (let pop = 0; pop <= 100; pop++) {
            const value = evidence(pop, 1);
            expect(value).toBeGreaterThanOrEqual(previous);
            previous = value;
        }
    });

    it('no hi ha escaló a mig camí (l\'antiga regla saltava de <50 % a 70 %)', () => {
        for (let pop = 0; pop < 100; pop++) {
            expect(Math.abs(evidence(pop + 1, 1) - evidence(pop, 1))).toBeLessThanOrEqual(2);
        }
    });

    it('valors fora de rang o no numèrics no peten', () => {
        expect(evidence(-5, 1)).toBeGreaterThanOrEqual(-5);
        expect(evidence(250, 1)).toBe(250);
        expect(Number.isNaN(evidence(NaN, 1))).toBe(true);
    });
});
