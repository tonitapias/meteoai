// src/utils/uvIndexUtils.test.ts
import { describe, it, expect } from 'vitest';
import { getUVCategory, needsUVProtection, roundUVIndex } from './uvIndexUtils';

// L'OMS comunica l'índex UV com un enter: categories i llindar de protecció van sobre el valor arrodonit.
describe('índex UV segons l\'OMS', () => {
    it('5,5 s\'arrodoneix a 6 i és ALT (abans sortia MODERAT)', () => {
        expect(roundUVIndex(5.5)).toBe(6);
        expect(getUVCategory(5.5).label.ca).toBe('ALT');
    });

    it('les fronteres de cada categoria es decideixen sobre l\'enter', () => {
        const cases: Array<[number, string]> = [
            [2.4, 'BAIX'], [2.5, 'MODERAT'], [5.4, 'MODERAT'], [5.5, 'ALT'],
            [7.4, 'ALT'], [7.5, 'MOLT ALT'], [10.4, 'MOLT ALT'], [10.5, 'EXTREM']
        ];
        cases.forEach(([uv, label]) => expect(getUVCategory(uv).label.ca).toBe(label));
    });

    // Girona, 26-09-2026: 5,45 es mostra "5.5"; la categoria va amb el número que es veu, no amb el cru.
    it('la categoria segueix el número mostrat amb un decimal: 5,45 ("5.5") és ALT i 5,44 ("5.4") MODERAT', () => {
        expect(getUVCategory(5.45).label.ca).toBe('ALT');
        expect(getUVCategory(5.44).label.ca).toBe('MODERAT');
    });

    it('mai no es contradiu amb el número de la pantalla: igual que classificar el text de toFixed(1)', () => {
        for (let i = 0; i <= 1300; i++) {
            const uv = i / 100;
            expect(getUVCategory(uv)).toEqual(getUVCategory(Number(uv.toFixed(1))));
        }
    });

    it('els enters exactes no canvien de categoria', () => {
        expect(getUVCategory(0).label.ca).toBe('BAIX');
        expect(getUVCategory(3).label.ca).toBe('MODERAT');
        expect(getUVCategory(6).label.ca).toBe('ALT');
        expect(getUVCategory(8).label.ca).toBe('MOLT ALT');
        expect(getUVCategory(11).label.ca).toBe('EXTREM');
    });

    it('la protecció cal a partir de l\'índex 3 arrodonit, igual que la categoria MODERAT', () => {
        expect(needsUVProtection(2.4)).toBe(false);
        expect(needsUVProtection(2.5)).toBe(true);
        [2.4, 2.5, 2.9, 3].forEach(uv =>
            expect(needsUVProtection(uv)).toBe(getUVCategory(uv).label.ca !== 'BAIX'));
    });
});
