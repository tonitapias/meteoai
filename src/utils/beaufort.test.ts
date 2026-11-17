import { describe, it, expect } from 'vitest';
import { getBeaufort } from './beaufort';

// Auditoria d'UX del 16/11/2026 (B3): el giny deia "Moderat" amb 13 km/h; a Beaufort, de 12 a 19 km/h és vent fluix.
describe('getBeaufort', () => {
    it('13 km/h és força 3, "Vent fluix"', () => {
        expect(getBeaufort(13, 'ca')).toEqual({ force: 3, label: 'Vent fluix' });
        expect(getBeaufort(13, 'en').label).toBe('Gentle breeze');
    });
    it('els extrems de l\'escala', () => {
        expect(getBeaufort(0, 'ca').force).toBe(0);
        expect(getBeaufort(130, 'ca')).toEqual({ force: 12, label: 'Huracà' });
    });
});
