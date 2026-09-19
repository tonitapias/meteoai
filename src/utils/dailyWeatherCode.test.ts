import { describe, it, expect } from 'vitest';
import { resolveDailyCode, worstPrecipCode } from './dailyWeatherCode';

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

    it('sense hores del motor, la pluja, la neu i la tempesta diàries no es toquen', () => {
        expect(resolveDailyCode(63, 10)).toBe(63);
        expect(resolveDailyCode(73, 10)).toBe(73);
        expect(resolveDailyCode(95, 10)).toBe(95);
    });

    it('sense dades horàries no s\'inventa cap cel: el codi queda tal qual', () => {
        expect(resolveDailyCode(45, null)).toBe(45);
        expect(resolveDailyCode(2, null)).toBe(2);
    });
});

// La icona del dia passa pels mateixos filtres que l'evolució horària: el model decideix SI el dia és
// de precipitació i el motor decideix QUINA (o si al final no n'hi ha). Vegeu resolveDailyCode.
describe('resolveDailyCode — amb les hores del motor', () => {
    it('el model diu pluja i el motor la manté: es pinta la més severa de les hores del motor', () => {
        expect(resolveDailyCode(63, 80, [3, 3, 61, 63, 61, 3])).toBe(63);
        expect(resolveDailyCode(65, 80, [61, 61, 63])).toBe(63);   // el motor la rebaixa (mm reals)
    });

    it('el motor canvia el TIPUS: neu del model cru convertida en pluja per bloqueig tèrmic', () => {
        expect(resolveDailyCode(73, 80, [63, 63, 61])).toBe(63);
    });

    it('el motor canvia el TIPUS: pluja del model cru que a les hores és aiguaneu', () => {
        expect(resolveDailyCode(63, 80, [63, 69, 63])).toBe(69);
    });

    it('la pluja engelant que el motor conserva arriba a la setmana', () => {
        expect(resolveDailyCode(66, 90, [3, 66, 66])).toBe(66);
    });

    it("el model diu pluja però el motor l'ha filtrada a totes les hores (0 mm): dia sec, es pinta el cel", () => {
        expect(resolveDailyCode(81, 5, [3, 3, 2, 3])).toBe(0);     // serè
        expect(resolveDailyCode(61, 60, [3, 3, 3])).toBe(2);       // parcial
        expect(resolveDailyCode(73, 95, [3, 3, 3])).toBe(3);       // cobert
    });

    it('AL REVÉS NO: si el model no diu precipitació, una hora de pluja feble del motor no fa el dia plujós', () => {
        expect(resolveDailyCode(3, 90, [3, 61, 3, 3])).toBe(3);
        expect(resolveDailyCode(0, 5, [0, 61, 0])).toBe(0);
        expect(resolveDailyCode(45, 5, [45, 61, 3])).toBe(0);      // la boira del model segueix resolent-se pel cel
    });

    it('la tempesta i les hores de tempesta del motor mananen sobre la pluja', () => {
        expect(resolveDailyCode(95, 70, [61, 95, 63])).toBe(95);
        expect(resolveDailyCode(96, 70, [63, 96])).toBe(96);
    });

    it('sense hores del motor (absents, buides o sense dada) el codi del model queda tal qual', () => {
        expect(resolveDailyCode(63, 80)).toBe(63);
        expect(resolveDailyCode(63, 80, null)).toBe(63);
        expect(resolveDailyCode(63, 80, [])).toBe(63);
        expect(resolveDailyCode(63, 80, [null, null])).toBe(63);
    });

    it('sense núvols diürns (nit polar) però amb hores filtrades: el cel de les hores, mai un codi de pluja', () => {
        expect(resolveDailyCode(63, null, [2, 3, 3])).toBe(3);
        expect(resolveDailyCode(63, null, [0, 1, 2])).toBe(2);
    });
});

describe('worstPrecipCode — ordre de severitat', () => {
    it('tempesta > engelant > neu > aiguaneu > ruixat > pluja > plugim', () => {
        expect(worstPrecipCode([51, 61, 81, 69, 73, 66, 95])).toBe(95);
        expect(worstPrecipCode([51, 61, 81, 69, 73, 66])).toBe(66);
        expect(worstPrecipCode([51, 61, 81, 69, 73])).toBe(73);
        expect(worstPrecipCode([51, 61, 81, 69])).toBe(69);
        expect(worstPrecipCode([51, 61, 81])).toBe(81);
        expect(worstPrecipCode([51, 61])).toBe(61);
        expect(worstPrecipCode([51, 53])).toBe(53);
    });

    it('dins de la mateixa classe mana el codi més intens', () => {
        expect(worstPrecipCode([71, 75, 73])).toBe(75);
        expect(worstPrecipCode([61, 65, 63])).toBe(65);
        expect(worstPrecipCode([96, 95, 99])).toBe(99);
        expect(worstPrecipCode([56, 57])).toBe(57);
    });

    it('la boira, el cel i les dades absents no són precipitació', () => {
        expect(worstPrecipCode([0, 1, 2, 3, 45, 48])).toBeNull();
        expect(worstPrecipCode([null, undefined, NaN])).toBeNull();
        expect(worstPrecipCode([])).toBeNull();
        expect(worstPrecipCode([3, null, 61])).toBe(61);
    });
});
