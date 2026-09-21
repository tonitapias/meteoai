import { describe, it, expect } from 'vitest';
import { daylightSeconds } from './daylight';
import { formatHoursMinutes } from './formatters';

describe('daylightSeconds', () => {
    it('durada entre sortida i posta', () => {
        // 07:39 → 19:49 = 12 h 10 min
        expect(daylightSeconds('2026-09-22T07:39', '2026-09-22T19:49')).toBe((12 * 60 + 10) * 60);
    });

    it('falta una de les dues hores: null, no una durada inventada', () => {
        expect(daylightSeconds(undefined, '2026-09-22T19:49')).toBeNull();
        expect(daylightSeconds('2026-09-22T07:39', null)).toBeNull();
        expect(daylightSeconds(undefined, undefined)).toBeNull();
    });

    it('hores no vàlides o sense sentit: null', () => {
        expect(daylightSeconds('07:39', '19:49')).toBeNull();
        expect(daylightSeconds('2026-09-22T25:00', '2026-09-22T19:49')).toBeNull();
        expect(daylightSeconds('2026-09-22T19:49', '2026-09-22T07:39')).toBeNull();
        expect(daylightSeconds('2026-09-22T07:39', '2026-09-22T07:39')).toBeNull();
    });

    it('no depèn del fus horari del navegador (llegeix l\'hora tal com ve)', () => {
        expect(daylightSeconds('2026-01-15T07:55', '2026-01-15T17:30')).toBe((9 * 60 + 35) * 60);
    });
});

describe('formatHoursMinutes', () => {
    it('hores i minuts', () => {
        expect(formatHoursMinutes(12 * 3600 + 10 * 60)).toBe('12h 10m');
        expect(formatHoursMinutes(9 * 3600 + 5 * 60)).toBe('9h 05m');
    });

    it('un 0 real es mostra com a 0h 00m, però una dada absent és "--"', () => {
        expect(formatHoursMinutes(0)).toBe('0h 00m');
        expect(formatHoursMinutes(null)).toBe('--');
        expect(formatHoursMinutes(undefined)).toBe('--');
        expect(formatHoursMinutes(NaN)).toBe('--');
    });
});
