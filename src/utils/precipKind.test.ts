import { describe, it, expect } from 'vitest';
import { precipKind, snowCmFromWater, SNOW_CM_PER_MM } from './precipKind';
import { SNOW_CM_PER_MM as ENGINE_RATIO } from './engineSnowfall';

describe('precipKind — pluja en mm, neu en cm', () => {
    it('sense res que caigui no és ni pluja ni neu', () => {
        expect(precipKind(0, 0)).toBeNull();
        expect(precipKind(null, null)).toBeNull();
    });

    it('sense neu és pluja', () => {
        expect(precipKind(0.3, 0)).toBe('rain');
        expect(precipKind(12, null)).toBe('rain');
    });

    it('una nevada petita és neu, també per sota de 0,2 cm (Pas de la Casa, "Nevada feble": 0,1 mm d\'aigua)', () => {
        expect(precipKind(0.1, 0.07)).toBe('snow');
        expect(precipKind(0.2, 0.14)).toBe('snow');
    });

    it('mana el que cau més: 20 mm de pluja amb 0,3 cm de neu és un dia de pluja', () => {
        expect(precipKind(20, 0.3)).toBe('rain');
    });

    it('meitat i meitat compta com a neu (és el que es veu i el que molesta)', () => {
        // 1,4 cm = 2 mm d'aigua de neu; 2 mm de pluja més: empat.
        expect(precipKind(4, 1.4)).toBe('snow');
        expect(precipKind(4.2, 1.4)).toBe('rain');
    });

    it('neu sense mm (dades que no quadren) continua sent neu', () => {
        expect(precipKind(0, 0.5)).toBe('snow');
    });

    it('la relació és la mateixa que la del motor de neu (7 cm per 10 mm)', () => {
        expect(SNOW_CM_PER_MM).toBe(0.7);
        expect(ENGINE_RATIO).toBe(SNOW_CM_PER_MM);
        expect(snowCmFromWater(10)).toBeCloseTo(7);
    });
});
