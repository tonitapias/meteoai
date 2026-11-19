// src/utils/chartTicks.test.ts
// Línies guia de l'eix vertical: 2-4 valors rodons dins del rang real de cada gràfic.
import { describe, it, expect } from 'vitest';
import { POINT_LABEL_TRANSLATE, niceTicks, pointLabelAnchor, tickLabelCollides } from './chartTicks';

const isRound = (step: number) => {
    const exp = Math.floor(Math.log10(step));
    const m = Number((step / 10 ** exp).toPrecision(6));
    return [1, 2, 2.5, 5].includes(m);
};

describe('niceTicks', () => {
    it('pressió (rang real, sense zero): passos de 5 hPa', () => {
        expect(niceTicks(1005, 1026, { integer: true })).toEqual([1010, 1015, 1020, 1025]);
    });

    it('vent i CAPE (de 0 al màxim): no inclou les vores', () => {
        expect(niceTicks(0, 66, { integer: true })).toEqual([20, 40, 60]);
        expect(niceTicks(0, 2500, { integer: true })).toEqual([500, 1000, 1500, 2000]);
    });

    it('rangs petits amb decimals (UV, km): passos de 0,5, 1 o 2,5', () => {
        expect(niceTicks(0, 3)).toEqual([1, 2]);
        expect(niceTicks(0, 1.6)).toEqual([0.5, 1, 1.5]);
        expect(niceTicks(0, 12)).toEqual([2.5, 5, 7.5, 10]);
    });

    it('amb `integer`, mai un pas decimal (un "7,5°" es llegiria "8°")', () => {
        expect(niceTicks(0, 12, { integer: true })).toEqual([5, 10]);
        expect(niceTicks(13, 18, { integer: true })).toEqual([14, 15, 16, 17]);
        for (const tk of niceTicks(-3.2, 4.1, { integer: true })) expect(Number.isInteger(tk)).toBe(true);
    });

    it('temperatures sota zero i rangs negatius', () => {
        expect(niceTicks(-7.4, 6.2, { integer: true })).toEqual([-5, 0, 5]);
        expect(niceTicks(-12, -2, { integer: true })).toEqual([-10, -8, -6, -4]);
    });

    it('sempre de 2 a 4 línies rodones, estrictament dins del rang, en un ventall de rangs', () => {
        const ranges: [number, number][] = [
            [0, 1], [0, 7], [0, 100], [990, 1030], [1011.2, 1016.9], [-5, 26], [0, 12000], [0, 0.3], [3.3, 9.1], [0, 4000],
        ];
        for (const [min, max] of ranges) {
            const ticks = niceTicks(min, max);
            expect(ticks.length, `${min}-${max}`).toBeGreaterThanOrEqual(2);
            expect(ticks.length, `${min}-${max}`).toBeLessThanOrEqual(4);
            expect(ticks.every(tk => tk > min && tk < max), `${min}-${max}`).toBe(true);
            expect(isRound(ticks[1] - ticks[0]), `${min}-${max}`).toBe(true);
        }
    });

    it('sense soroll de coma flotant', () => {
        expect(niceTicks(0, 0.35)).toEqual([0.1, 0.2, 0.3]);
    });

    it('un rang que no és vàlid no dona cap línia', () => {
        expect(niceTicks(5, 5)).toEqual([]);
        expect(niceTicks(10, 2)).toEqual([]);
        expect(niceTicks(Number.NaN, 10)).toEqual([]);
        expect(niceTicks(0, Number.POSITIVE_INFINITY)).toEqual([]);
    });

    it('`maxTicks` limita les línies', () => {
        expect(niceTicks(0, 100, { maxTicks: 2 })).toEqual([50]);
        expect(niceTicks(0, 100, { maxTicks: 3 }).length).toBeLessThanOrEqual(3);
    });
});

describe("tickLabelCollides — l'etiqueta de l'eix (a la dreta) i les etiquetes pròpies", () => {
    it("amaga l'etiqueta d'una línia quan una etiqueta pròpia és a la dreta i a la mateixa alçada", () => {
        const max = { x: 93, y: 10 }; // la màxima, al final de la finestra
        expect(tickLabelCollides(18, [max])).toBe(true);
        expect(tickLabelCollides(40, [max])).toBe(false);   // lluny en alçada
    });

    it('un punt lluny de la vora dreta no amaga res, i sense punts tampoc', () => {
        expect(tickLabelCollides(10, [{ x: 50, y: 10 }])).toBe(false);
        expect(tickLabelCollides(10, [])).toBe(false);
    });
});

describe("pointLabelAnchor — l'etiqueta d'un extrem no surt del gràfic ni es parteix", () => {
    it('centrada al mig; a prop de les vores, comença o acaba al punt (cap a dins)', () => {
        expect(pointLabelAnchor(50)).toBe('center');
        expect(pointLabelAnchor(5)).toBe('start');
        expect(pointLabelAnchor(93)).toBe('end');
        expect(POINT_LABEL_TRANSLATE.end).toBe('-translate-x-full');
        expect(POINT_LABEL_TRANSLATE.center).toBe('-translate-x-1/2');
    });
});
