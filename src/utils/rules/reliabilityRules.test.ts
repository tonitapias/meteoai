import { describe, it, expect } from 'vitest';
import { calculateReliability } from './reliabilityRules';
import type { StrictDailyWeather } from '../../types/weatherLogicTypes';

const day = (max: number | null, min?: number | null, precip?: number | null) =>
    ({
        temperature_2m_max: [max],
        ...(min !== undefined ? { temperature_2m_min: [min] } : {}),
        ...(precip !== undefined ? { precipitation_sum: [precip] } : {}),
    }) as unknown as StrictDailyWeather;

// best, GFS, ICON i ECMWF. Amb `maxes` i `mins` (un valor per model) o només `maxes`.
const reliability = (maxes: number[], mins?: number[], precips?: number[]) =>
    calculateReliability(
        day(maxes[0], mins?.[0], precips?.[0]),
        day(maxes[1], mins?.[1], precips?.[1]),
        day(maxes[2], mins?.[2], precips?.[2]),
        0,
        day(maxes[3] ?? null, mins?.[3] ?? undefined, precips?.[3] ?? undefined)
    );

const AGREE_MAX = [20, 20.4, 19.8, 20.2];

describe('calculateReliability — la mínima compta', () => {
    it('models d\'acord sobre la màxima i molt en desacord sobre la mínima: NO és fiabilitat alta', () => {
        // Abans: només es mirava la màxima i això sortia "alta".
        const result = reliability(AGREE_MAX, [5, 12, 6, 7]);
        expect(result.level).toBe('low');
        expect(result.type).toBe('temp');
        expect(result.value).toBe(7);
    });

    it('un desacord moderat sobre la mínima dona fiabilitat mitjana', () => {
        const result = reliability(AGREE_MAX, [8, 12, 9, 10]);
        expect(result.level).toBe('medium');
        expect(result.type).toBe('divergent');
    });

    it('models d\'acord a la màxima i a la mínima: alta', () => {
        expect(reliability(AGREE_MAX, [8, 8.5, 7.6, 8.2]).level).toBe('high');
    });

    it('el pitjor dels dos acords mana (màxima dubtosa i mínima bona -> mitjana)', () => {
        expect(reliability([20, 23.2, 20.5, 21], [8, 8.4, 7.9, 8.1]).level).toBe('medium');
    });

    it('els llindars de la màxima són 1,5 i 3 vegades el seu rang típic (2,85 i 5,7 °C)', () => {
        expect(reliability([20, 22.8]).level).toBe('high');      // 2,8
        expect(reliability([20, 22.9]).level).toBe('medium');    // 2,9
        expect(reliability([20, 25.6]).level).toBe('medium');    // 5,6
        expect(reliability([20, 25.8]).level).toBe('low');       // 5,8
    });

    it('els llindars de la mínima són 1,5 i 3 vegades el seu rang típic (3,15 i 6,3 °C)', () => {
        expect(reliability(AGREE_MAX, [8, 11.1]).level).toBe('high');     // 3,1
        expect(reliability(AGREE_MAX, [8, 11.2]).level).toBe('medium');   // 3,2
        expect(reliability(AGREE_MAX, [8, 14.2]).level).toBe('medium');   // 6,2
        expect(reliability(AGREE_MAX, [8, 14.4]).level).toBe('low');      // 6,4
    });

    it('un rang de la mínima igual al de la màxima pesa una mica menys (la mínima té un rang típic més gran)', () => {
        // 3,0 °C: sobre la màxima (típic 1,9) és > 1,5x i és "mitjana"; sobre la mínima (típic 2,1) no ho és.
        expect(reliability([20, 23], [8, 8.4, 7.9, 8.1]).level).toBe('medium');
        expect(reliability(AGREE_MAX, [8, 11]).level).toBe('high');
    });
});

describe('calculateReliability — dades absents (Risc Zero)', () => {
    it('sense mínima en cap model es comporta com abans: només la màxima', () => {
        expect(reliability(AGREE_MAX).level).toBe('high');
        expect(reliability([20, 30]).level).toBe('low');
    });

    it('una mínima que només té UN model no és cap comparació: no fingeix acord ni desacord', () => {
        const result = calculateReliability(day(20, 5), day(20.4), day(19.8), 0);
        expect(result.level).toBe('high');
    });

    it('una mínima absent en alguns models no es converteix en un 0 °C real', () => {
        // GFS sense mínima; best=8 i ICON=9 coincideixen: no hi ha cap desacord de 8 graus inventat.
        const result = calculateReliability(day(20, 8), day(20.4), day(19.8, 9), 0);
        expect(result.level).toBe('high');
    });

    it('sense cap temperatura ni pluja comparables: mitjana general, mai alta', () => {
        const result = calculateReliability(day(null), day(null), day(null), 0);
        expect(result.level).toBe('medium');
        expect(result.type).toBe('general');
    });

    it('falta un model sencer: mitjana general', () => {
        expect(calculateReliability(day(20, 8), null, day(19, 8), 0).level).toBe('medium');
    });

    it('només amb la mínima comparable (sense màxima) també es pot jutjar', () => {
        const result = calculateReliability(day(null, 3), day(null, 12), day(null, 5), 0);
        expect(result.level).toBe('low');
    });
});

describe('calculateReliability — la pluja no canvia', () => {
    it('una diferència de pluja > 3 mm és mitjana i > 10 mm és baixa, amb la temperatura d\'acord', () => {
        expect(reliability(AGREE_MAX, [8, 8.2, 7.9, 8], [0, 4, 0, 0]).level).toBe('medium');
        const low = reliability(AGREE_MAX, [8, 8.2, 7.9, 8], [0, 11, 0, 0]);
        expect(low.level).toBe('low');
        expect(low.type).toBe('precip');
    });

    it('la temperatura baixa mana sobre la pluja mitjana', () => {
        const result = reliability(AGREE_MAX, [5, 12, 6, 7], [0, 4, 0, 0]);
        expect(result.type).toBe('temp');
    });
});
