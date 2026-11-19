import { describe, it, expect } from 'vitest';
import { classifyPressureTrend, pressureDelta3h, PRESSURE_TREND_LABEL } from './pressureTrend';

// Auditoria d'UX del 16/11/2026 (B2): el giny deia "Estable / pujant" amb −0,1 hPa en 3 h.
describe('classifyPressureTrend — llindars dels butlletins (README §8)', () => {
    it('cada tram i el seu signe', () => {
        expect(classifyPressureTrend(0)).toBe('stable');
        expect(classifyPressureTrend(0.05)).toBe('stable');
        expect(classifyPressureTrend(-0.1)).toBe('fallingSlow');
        expect(classifyPressureTrend(1.2)).toBe('risingSlow');
        expect(classifyPressureTrend(-2.1)).toBe('falling');
        expect(classifyPressureTrend(4)).toBe('risingRapid');
        expect(classifyPressureTrend(-7)).toBe('fallingVeryRapid');
    });

    it('té etiqueta en els quatre idiomes', () => {
        expect(PRESSURE_TREND_LABEL.ca.fallingSlow).toBe('Baixant lentament');
        for (const labels of Object.values(PRESSURE_TREND_LABEL)) expect(Object.values(labels).every(Boolean)).toBe(true);
    });
});

describe('pressureDelta3h — la variació de 3 h de la targeta i del modal', () => {
    const series = [1010, 1009.5, 1009, 1008.2, null, 1006.04];

    it("la diferència amb la pressió de 3 hores abans, a la dècima", () => {
        expect(pressureDelta3h(series, 3)).toBe(-1.8);
        expect(pressureDelta3h([1000, 0, 0, 1002.64], 3)).toBe(2.6);
    });

    it('DOCTRINA RISC ZERO: null si falta alguna de les dues hores o no hi ha 3 hores enrere (mai "estable")', () => {
        expect(pressureDelta3h(series, 2)).toBeNull();       // no hi ha 3 hores enrere
        expect(pressureDelta3h(series, 4)).toBeNull();       // l'hora d'ara falta
        expect(pressureDelta3h(series, -1)).toBeNull();      // hora actual no trobada
        expect(pressureDelta3h([1010, 1, 1, Number.NaN], 3)).toBeNull();
        expect(pressureDelta3h(undefined, 3)).toBeNull();
    });
});
