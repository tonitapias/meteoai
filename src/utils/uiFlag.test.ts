import { describe, it, expect, beforeEach } from 'vitest';
import { readUiVariant } from './uiFlag';

describe('uiFlag → interfície per pestanyes (temporal)', () => {
    beforeEach(() => { localStorage.clear(); });

    it('sense res, la interfície d\'avui', () => {
        expect(readUiVariant('')).toBe('classic');
    });

    it('?ui=tabs l\'activa i es recorda sense el paràmetre (refresc, app instal·lada)', () => {
        expect(readUiVariant('?lat=41.4&lon=2.2&ui=tabs')).toBe('tabs');
        expect(readUiVariant('')).toBe('tabs');
    });

    it('?ui=classic hi torna i també es recorda', () => {
        readUiVariant('?ui=tabs');
        expect(readUiVariant('?ui=classic')).toBe('classic');
        expect(readUiVariant('')).toBe('classic');
    });

    it('un valor desconegut no canvia res', () => {
        readUiVariant('?ui=tabs');
        expect(readUiVariant('?ui=altra')).toBe('tabs');
    });
});
