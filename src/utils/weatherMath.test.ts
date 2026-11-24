// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { resolveLocalDate } from './weatherMath';

// Dia local de la població per a la IA (quin dia és "avui" i "demà") i per a les claus de les seves anàlisis.
// La suite corre amb TZ=UTC: si es fes servir el fus de la màquina, Nova York (UTC-5) a les 23:15 sortiria l'endemà.
describe('resolveLocalDate — el dia local de la població, no el de la màquina', () => {
    it('hora sense zona (Open-Meteo amb timezone=auto): la data del text, tal qual', () => {
        expect(resolveLocalDate('2026-11-23T23:45', 3600)).toBe('2026-11-23');
        expect(resolveLocalDate('2026-11-23T23:45', -18000)).toBe('2026-11-23');
        expect(resolveLocalDate('2026-11-24T00:00', undefined)).toBe('2026-11-24');
    });

    it('hora amb zona: l\'instant passat a l\'hora de la població', () => {
        // 04:15 UTC del 24/11 = 23:15 del 23/11 a Nova York (UTC-5).
        expect(resolveLocalDate('2026-11-24T04:15Z', -18000)).toBe('2026-11-23');
        // 23:30 UTC del 23/11 = 00:30 del 24/11 a Barcelona (UTC+1).
        expect(resolveLocalDate('2026-11-23T23:30+00:00', 3600)).toBe('2026-11-24');
    });

    it('epoch en segons: l\'instant passat a l\'hora de la població', () => {
        const utc0415 = Date.UTC(2026, 10, 24, 4, 15) / 1000;
        expect(resolveLocalDate(utc0415, -18000)).toBe('2026-11-23');
        expect(resolveLocalDate(utc0415, 3600)).toBe('2026-11-24');
    });

    it('sense una hora vàlida, null', () => {
        expect(resolveLocalDate(undefined, 3600)).toBeNull();
        expect(resolveLocalDate('ara', 3600)).toBeNull();
        expect(resolveLocalDate(Number.NaN, 3600)).toBeNull();
    });
});
