import { describe, it, expect } from 'vitest';
import { neighbourDays, swipeDirection, FIRST_DETAIL_DAY, LAST_DETAIL_DAY } from './dayNavigation';

describe('neighbourDays', () => {
    it('al mig de la setmana hi ha dia anterior i següent', () => {
        expect(neighbourDays(3, 9)).toEqual({ prev: 2, next: 4 });
    });

    it('des de demà es pot tornar a avui', () => {
        expect(neighbourDays(1, 9)).toEqual({ prev: 0, next: 2 });
    });

    it("avui és el primer dia: no té anterior", () => {
        expect(neighbourDays(FIRST_DETAIL_DAY, 9)).toEqual({ prev: null, next: 1 });
    });

    it("l'últim dia no té següent, encara que la previsió porti més dies", () => {
        expect(neighbourDays(LAST_DETAIL_DAY, 9)).toEqual({ prev: 6, next: null });
    });

    it('no es pot anar a un dia que la previsió no porta', () => {
        // 4 dies (índexs 0..3): el 3 és l'últim.
        expect(neighbourDays(3, 4)).toEqual({ prev: 2, next: null });
        expect(neighbourDays(2, 4)).toEqual({ prev: 1, next: 3 });
    });

    it('amb un sol dia (només avui) no hi ha veïns', () => {
        expect(neighbourDays(0, 1)).toEqual({ prev: null, next: null });
    });

    it('sense dies no hi ha veïns', () => {
        expect(neighbourDays(0, 0)).toEqual({ prev: null, next: null });
    });
});

describe('swipeDirection', () => {
    it('un gest llarg cap a l\'esquerra va al dia següent, cap a la dreta a l\'anterior', () => {
        expect(swipeDirection(-120, 5)).toBe(1);
        expect(swipeDirection(120, -5)).toBe(-1);
    });

    it('un gest curt no compta', () => {
        expect(swipeDirection(-40, 0)).toBe(0);
        expect(swipeDirection(69, 0)).toBe(0);
    });

    it('un gest més vertical que horitzontal és un scroll, no un canvi de dia', () => {
        expect(swipeDirection(-100, 90)).toBe(0);
        expect(swipeDirection(100, -200)).toBe(0);
    });

    it('un toc (sense moviment) no fa res', () => {
        expect(swipeDirection(0, 0)).toBe(0);
    });
});
