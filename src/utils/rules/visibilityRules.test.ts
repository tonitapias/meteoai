import { describe, it, expect } from 'vitest';
import { getDewPointSpread, hasFogSignal, resolveFog } from './visibilityRules';
import { WEATHER_THRESHOLDS } from '../../constants/weatherConfig';

const { FOG_MAX_SPREAD } = WEATHER_THRESHOLDS.HUMIDITY;
const { FOG_MIN_LOW } = WEATHER_THRESHOLDS.CLOUDS;

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

    it('boira confirmada a <= 0 °C és SEMPRE gebradora (48), encara que el senyal sigui un 45 o només visibilitat', () => {
        expect(resolveFog(45, -3, 100, OVERCAST, GOOD_VIS, 0)).toBe(48);
        expect(resolveFog(0, -4, 100, CLEAR, 400, 0)).toBe(48);
        expect(resolveFog(3, -12, 100, OVERCAST, 300, 0)).toBe(48);
        expect(resolveFog(45, 0, 100, OVERCAST, GOOD_VIS, 0)).toBe(48);
    });

    it('per sobre de 0 °C la boira mai és gebradora, ni que el model digui 48', () => {
        expect(resolveFog(45, 0.5, 100, OVERCAST, GOOD_VIS, 0)).toBe(45);
        expect(resolveFog(0, 2, 100, CLEAR, 400, 0)).toBe(45);
        expect(resolveFog(48, 0.5, 100, OVERCAST, GOOD_VIS, 0)).toBe(45);
    });

    it('sense saturació, el fred no fabrica boira gebradora', () => {
        expect(resolveFog(45, -3, 80, OVERCAST, GOOD_VIS, 0)).toBe(3);
        expect(resolveFog(3, -3, 80, OVERCAST, 400, 0)).toBe(3);
    });

    // PORTA DE NÚVOLS BAIXOS (CLOUDS.FOG_MIN_LOW): la boira és un núvol a nivell de terra; sense
    // capa baixa al model el senyal de boira és majoritàriament fals (verificat amb METAR).
    describe('porta de núvols baixos', () => {
        it('llindar exacte: >= FOG_MIN_LOW confirma, per sota no', () => {
            expect(resolveFog(45, T, 100, OVERCAST, 300, 0, FOG_MIN_LOW)).toBe(45);
            expect(resolveFog(45, T, 100, OVERCAST, 300, 0, FOG_MIN_LOW - 1)).not.toBe(45);
        });

        it('una capa baixa moderada (boira de radiació poc gruixuda) SÍ confirma la boira, però una de fina no', () => {
            // A Girona i Sabadell el 58 % de les hores de boira real tenen < 70 % de núvols baixos al model:
            // amb la porta al 70 % es descartava boira real (50 vs 70: +0,018 de CSI, significatiu).
            expect(resolveFog(45, T, 100, OVERCAST, 300, 0, 55)).toBe(45);
            expect(resolveFog(45, T, 100, OVERCAST, 300, 0, 50)).toBe(45);
            expect(resolveFog(45, T, 100, OVERCAST, 300, 0, 45)).not.toBe(45);
        });

        it('un 45 del model sense capa baixa es rebaixa al cel real', () => {
            expect(resolveFog(45, T, 100, CLEAR, GOOD_VIS, 0, 20)).toBe(1); // cel serè + HR alta
            expect(resolveFog(45, T, 100, 60, GOOD_VIS, 0, 20)).toBe(2);
        });

        it('un senyal només de visibilitat sense capa baixa no fabrica boira ni toca el codi', () => {
            expect(resolveFog(3, T, 100, OVERCAST, 300, 0, 20)).toBe(3);
        });

        it('també val per a la boira gebradora (T <= 0 °C)', () => {
            expect(resolveFog(45, -3, 100, OVERCAST, 300, 0, 100)).toBe(48);
            expect(resolveFog(45, -3, 100, OVERCAST, 300, 0, 40)).not.toBe(48);
            expect(resolveFog(48, -3, 100, OVERCAST, 300, 0, 40)).not.toBe(48);
        });

        it('DOCTRINA RISC ZERO: sense dada de núvols baixos (null) NO es descarta la boira', () => {
            expect(resolveFog(45, T, 100, OVERCAST, 300, 0, null)).toBe(45);
            expect(resolveFog(0, -3, 100, CLEAR, 300, 0, null)).toBe(48);
            // I el mateix si l'argument s'omet (compatibilitat amb les crides antigues)
            expect(resolveFog(45, T, 100, OVERCAST, 300, 0)).toBe(45);
        });

        it('un 0 % real SÍ és una dada (cel serè de veritat): no hi ha boira', () => {
            expect(resolveFog(45, T, 100, CLEAR, 300, 0, 0)).not.toBe(45);
        });
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
