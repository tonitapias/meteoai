import { describe, it, expect } from 'vitest';
import { classifyDailyPrecip, isLikelyWet } from './precipSignal';

describe('isLikelyWet', () => {
    it('a partir del 20 % és un dia de risc; per sota, o sense dada, no', () => {
        expect(isLikelyWet(20)).toBe(true);
        expect(isLikelyWet(19)).toBe(false);
        expect(isLikelyWet(null)).toBe(false);
    });
});

describe('classifyDailyPrecip', () => {
    it('classifica la suma del dia: quatre gotes < 1 mm ≤ feble < 5 mm ≤ moderada < 20 mm ≤ abundant', () => {
        expect(classifyDailyPrecip(0)).toBe('trace');
        expect(classifyDailyPrecip(0.9)).toBe('trace');
        expect(classifyDailyPrecip(1)).toBe('light');
        expect(classifyDailyPrecip(4.9)).toBe('light');
        expect(classifyDailyPrecip(5)).toBe('moderate');
        expect(classifyDailyPrecip(19.9)).toBe('moderate');
        expect(classifyDailyPrecip(20)).toBe('heavy');
    });

    it('sense dada, null: un buit no es dona per "quatre gotes"', () => {
        expect(classifyDailyPrecip(null)).toBeNull();
        expect(classifyDailyPrecip(NaN)).toBeNull();
    });
});
