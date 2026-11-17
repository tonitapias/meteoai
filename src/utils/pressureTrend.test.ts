import { describe, it, expect } from 'vitest';
import { classifyPressureTrend, PRESSURE_TREND_LABEL } from './pressureTrend';

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
