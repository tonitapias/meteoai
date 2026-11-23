import { describe, it, expect } from 'vitest';
import { nowcastPrecipKind } from './nowcastKind';
import type { SkyHour, SkyKind } from './daySky';

const dayOf = (kinds: Record<number, SkyKind>): SkyHour[] =>
    Array.from({ length: 24 }, (_, hour) => ({ hour, kind: kinds[hour] ?? 'cloudy', isDay: hour >= 8 && hour < 18 }));

// L'hora del lloc: els camps locals de la Date són els del lloc (com calculations.shiftedNow).
const at = (y: number, m: number, d: number, h: number, min = 0) => new Date(y, m - 1, d, h, min);

describe('nowcastPrecipKind — què caurà quan el radar diu que comença', () => {
    it("Pica d'Estats: neu ara i les hores següents → neu", () => {
        const sky = { '2026-11-23': dayOf({ 1: 'snow', 2: 'snow', 3: 'snow' }) };
        expect(nowcastPrecipKind(sky, at(2026, 11, 23, 1, 55), -8)).toBe('snow');
    });

    it('pluja a les hores que venen → pluja', () => {
        const sky = { '2026-11-23': dayOf({ 15: 'rain', 16: 'rain' }) };
        expect(nowcastPrecipKind(sky, at(2026, 11, 23, 14, 30), 12)).toBe('rain');
    });

    it('una tempesta compta com a pluja', () => {
        const sky = { '2026-11-23': dayOf({ 15: 'storm' }) };
        expect(nowcastPrecipKind(sky, at(2026, 11, 23, 15), 22)).toBe('rain');
    });

    it('pluja que passa a neu → totes dues', () => {
        const sky = { '2026-11-23': dayOf({ 20: 'rain', 21: 'snow' }) };
        expect(nowcastPrecipKind(sky, at(2026, 11, 23, 20), 1)).toBe('mixed');
    });

    it('mira també les primeres hores de demà (passada la mitjanit)', () => {
        const sky = { '2026-11-23': dayOf({}), '2026-11-24': dayOf({ 0: 'snow' }) };
        expect(nowcastPrecipKind(sky, at(2026, 11, 23, 23, 20), -1)).toBe('snow');
    });

    it('sense precipitació a la previsió, mana la temperatura d\'ara', () => {
        const sky = { '2026-11-23': dayOf({}) };
        expect(nowcastPrecipKind(sky, at(2026, 11, 23, 10), -3)).toBe('snow');
        expect(nowcastPrecipKind(sky, at(2026, 11, 23, 10), 1.5)).toBe('mixed');
        expect(nowcastPrecipKind(sky, at(2026, 11, 23, 10), 9)).toBe('rain');
    });

    it('sense dades, pluja (el que deia sempre)', () => {
        expect(nowcastPrecipKind(null, null, null)).toBe('rain');
    });
});
