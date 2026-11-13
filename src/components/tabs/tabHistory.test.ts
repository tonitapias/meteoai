import { describe, it, expect } from 'vitest';
import { readTabFromSearch, searchWithTab } from './tabHistory';

describe('tabHistory → la pestanya a la URL', () => {
    it('llegeix les pestanyes conegudes; qualsevol altra cosa (o res) és Ara', () => {
        expect(readTabFromSearch('?tab=forecast')).toBe('forecast');
        expect(readTabFromSearch('?lat=41&tab=sky&lon=2')).toBe('sky');
        expect(readTabFromSearch('')).toBe('now');
        expect(readTabFromSearch('?tab=now')).toBe('now');
        expect(readTabFromSearch('?tab=radar')).toBe('now');
        expect(readTabFromSearch('?tab=')).toBe('now');
    });

    it('posa o treu el paràmetre sense tocar la resta', () => {
        expect(searchWithTab('?lat=41&lon=2', 'detail')).toBe('?lat=41&lon=2&tab=detail');
        expect(searchWithTab('?lat=41&tab=detail&lon=2', 'sky')).toBe('?lat=41&tab=sky&lon=2');
        expect(searchWithTab('?lat=41&tab=detail', 'now')).toBe('?lat=41');
        expect(searchWithTab('?tab=detail', 'now')).toBe('');
        expect(searchWithTab('', 'forecast')).toBe('?tab=forecast');
    });
});
