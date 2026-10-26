// src/utils/formatters.test.ts
import { describe, it, expect } from 'vitest';
import { formatDecimal, formatPrecipitation } from './formatters';

describe('formatDecimal — decimals en el format de cada idioma', () => {
    it('coma en català, castellà i francès; punt en anglès', () => {
        expect(formatDecimal(18.3, 'ca')).toBe('18,3');
        expect(formatDecimal(18.3, 'es')).toBe('18,3');
        expect(formatDecimal(18.3, 'fr')).toBe('18,3');
        expect(formatDecimal(18.3, 'en')).toBe('18.3');
    });

    it('un decimal per defecte, arrodonit com toFixed', () => {
        expect(formatDecimal(5.45, 'ca')).toBe('5,5');
        expect(formatDecimal(0, 'ca')).toBe('0,0');
        expect(formatDecimal(-0.14, 'ca')).toBe('-0,1');
    });

    it('trimZero treu el ",0" final', () => {
        expect(formatDecimal(2, 'ca', 1, true)).toBe('2');
        expect(formatDecimal(19.6, 'ca', 1, true)).toBe('19,6');
    });

    it('sense separador de milers (1019 hPa, no "1.019")', () => {
        expect(formatDecimal(10190.5, 'ca')).toBe('10190,5');
    });
});

describe('formatPrecipitation', () => {
    it('per sota d\'1 mm, un decimal en el format de l\'idioma', () => {
        expect(formatPrecipitation(0.4, 0, 'ca')).toBe('0,4 mm');
        expect(formatPrecipitation(0.4, 0, 'en')).toBe('0.4 mm');
        expect(formatPrecipitation(0.4, 0.6, 'fr')).toBe('0,6 cm');
        expect(formatPrecipitation(3.6, 0, 'ca')).toBe('4 mm');
    });
});
