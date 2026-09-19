import { describe, it, expect } from 'vitest';
import { getDewPointSpread, hasFogSignal, resolveFog } from './visibilityRules';
import { WEATHER_THRESHOLDS } from '../../constants/weatherConfig';

const { FOG_MAX_SPREAD } = WEATHER_THRESHOLDS.HUMIDITY;

// A T = 10 °C (fórmula de l'app): HR 100 → T−Td 0,00 · 98 → 0,30 · 97 → 0,45 · 96 → 0,61 · 95 → 0,76
const T = 10;
const CLEAR = 0;      // cel serè (0 % de núvols)
const OVERCAST = 100;
const GOOD_VIS = 10000;

describe('getDewPointSpread', () => {
    it('és 0 a saturació i creix amb la sequedat', () => {
        expect(getDewPointSpread(T, 100)).toBeCloseTo(0, 5);
        expect(getDewPointSpread(T, 97)).toBeCloseTo(0.45, 1);
        expect(getDewPointSpread(T, 80)).toBeGreaterThan(3);
    });
});

describe('hasFogSignal', () => {
    it('reconeix el codi 45/48 i la visibilitat < 1 km', () => {
        expect(hasFogSignal(45, GOOD_VIS)).toBe(true);
        expect(hasFogSignal(48, GOOD_VIS)).toBe(true);
        expect(hasFogSignal(0, 999)).toBe(true);
    });

    it('no en dona amb cel normal i visibilitat >= 1 km', () => {
        expect(hasFogSignal(0, 1000)).toBe(false);
        expect(hasFogSignal(3, GOOD_VIS)).toBe(false);
        expect(hasFogSignal(61, 5000)).toBe(false);
    });
});

describe('resolveFog — senyal del model + saturació', () => {
    it('llindar de saturació: T−Td exactament al límit confirma, per sobre no', () => {
        expect(getDewPointSpread(T, 97)).toBeLessThanOrEqual(FOG_MAX_SPREAD);
        expect(getDewPointSpread(T, 96)).toBeGreaterThan(FOG_MAX_SPREAD);
        expect(resolveFog(45, T, 97, CLEAR, GOOD_VIS, 0)).toBe(45);
        expect(resolveFog(45, T, 96, CLEAR, GOOD_VIS, 0)).not.toBe(45);
    });

    it('codi 45 del model + saturació → boira', () => {
        expect(resolveFog(45, T, 100, OVERCAST, GOOD_VIS, 0)).toBe(45);
    });

    it('visibilitat < 1 km + saturació → boira encara que el codi sigui de cel serè', () => {
        expect(resolveFog(0, T, 99, CLEAR, 400, 0)).toBe(45);
        expect(resolveFog(2, T, 99, 50, 900, 0)).toBe(45);
    });

    it('saturació sense cap senyal del model → NO fabrica boira', () => {
        expect(resolveFog(3, T, 100, OVERCAST, GOOD_VIS, 0)).toBe(3);
        expect(resolveFog(0, T, 100, CLEAR, 1000, 0)).not.toBe(45);
    });

    it('codi 45 del model sense saturació → es rebaixa al cel real (segons núvols)', () => {
        expect(resolveFog(45, T, 90, CLEAR, GOOD_VIS, 0)).toBe(0);
        expect(resolveFog(45, T, 90, 60, GOOD_VIS, 0)).toBe(2);
        expect(resolveFog(45, T, 90, OVERCAST, GOOD_VIS, 0)).toBe(3);
    });

    it('un codi 48 sense saturació també es rebaixa', () => {
        expect(resolveFog(48, -3, 80, OVERCAST, GOOD_VIS, 0)).toBe(3);
    });

    it('visibilitat < 1 km sense saturació → no toca el codi (no era boira confirmada)', () => {
        expect(resolveFog(3, T, 90, OVERCAST, 500, 0)).toBe(3);
        expect(resolveFog(2, T, 90, 60, 500, 0)).toBe(2);
    });

    it('calitja càlida i seca (> 20 °C, HR baixa) mai és boira', () => {
        expect(resolveFog(45, 25, 60, CLEAR, 800, 0)).toBe(0);
        expect(resolveFog(0, 25, 60, CLEAR, 800, 0)).toBe(0);
    });

    it('boira gebradora (48) només a <= 0 °C; per sobre es converteix en boira normal', () => {
        expect(resolveFog(48, -3, 100, OVERCAST, GOOD_VIS, 0)).toBe(48);
        expect(resolveFog(48, 0, 100, OVERCAST, GOOD_VIS, 0)).toBe(48);
        expect(resolveFog(48, 3, 100, OVERCAST, GOOD_VIS, 0)).toBe(45);
    });

    it('amb precipitació >= TRACE no hi ha boira (el senyal no compta si plou)', () => {
        const trace = WEATHER_THRESHOLDS.PRECIPITATION.TRACE;
        expect(resolveFog(45, T, 100, OVERCAST, 300, trace)).not.toBe(45);
        expect(resolveFog(45, T, 100, OVERCAST, 300, trace / 2)).toBe(45);
    });

    it('un codi de precipitació o tempesta (> 48) queda intacte', () => {
        expect(resolveFog(61, T, 100, OVERCAST, 200, 0)).toBe(61);
        expect(resolveFog(95, T, 100, OVERCAST, 200, 0)).toBe(95);
    });

    it('mantén l\'ajust d\'humitat alta: cel serè amb HR > 92 % passa a "poc ennuvolat"', () => {
        expect(resolveFog(0, T, 94, CLEAR, GOOD_VIS, 0)).toBe(1);
        expect(resolveFog(0, T, 60, CLEAR, GOOD_VIS, 0)).toBe(0);
    });
});
