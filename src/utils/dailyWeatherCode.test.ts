import { describe, it, expect } from 'vitest';
import { resolveDailyCode } from './dailyWeatherCode';

describe('resolveDailyCode', () => {
    it('un codi diari de boira (45/48) es resol pel cel diürn real, no pinta tot el dia de boira', () => {
        // Cas real (Vic, setmana del 20/09/2026): Open-Meteo dona 45 cada dia perquè és el
        // codi de l'hora més severa, però a l'evolució horària la boira és només 06–09 h.
        expect(resolveDailyCode(45, 5)).toBe(0);    // dia serè
        expect(resolveDailyCode(45, 30)).toBe(1);   // poc ennuvolat
        expect(resolveDailyCode(45, 60)).toBe(2);   // molt ennuvolat
        expect(resolveDailyCode(45, 95)).toBe(3);   // cobert
        expect(resolveDailyCode(48, 5)).toBe(0);
    });

    it('els codis de cel (0-3) segueixen ajustant-se als núvols diürns, com abans', () => {
        expect(resolveDailyCode(0, 95)).toBe(3);
        expect(resolveDailyCode(3, 5)).toBe(0);
    });

    it('la pluja, la neu i la tempesta diàries no es toquen', () => {
        expect(resolveDailyCode(63, 10)).toBe(63);
        expect(resolveDailyCode(73, 10)).toBe(73);
        expect(resolveDailyCode(95, 10)).toBe(95);
    });

    it('sense dades horàries no s\'inventa cap cel: el codi queda tal qual', () => {
        expect(resolveDailyCode(45, null)).toBe(45);
        expect(resolveDailyCode(2, null)).toBe(2);
    });
});
