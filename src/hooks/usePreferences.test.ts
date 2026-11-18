// src/hooks/usePreferences.test.ts
// Les preferències (idioma, unitats, favorits) es recorden; si el navegador bloqueja l'emmagatzematge, l'app s'obre
// igualment amb els valors per defecte; i les claus de l'antiga vista Essencial/Completa es netegen.
import { describe, it, expect, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePreferences, LEGACY_STORAGE_KEYS } from './usePreferences';

describe('preferències', () => {
    afterEach(() => {
        vi.restoreAllMocks();
        localStorage.clear();
    });

    it("les claus de l'antiga vista (Essencial/Completa, «Vols més detall?», ?ui=tabs) es treuen en obrir l'app", () => {
        LEGACY_STORAGE_KEYS.forEach((key) => localStorage.setItem(key, 'x'));
        localStorage.setItem('meteoai_lang', 'es');
        const { result } = renderHook(() => usePreferences());
        LEGACY_STORAGE_KEYS.forEach((key) => expect(localStorage.getItem(key)).toBeNull());
        expect(result.current.lang).toBe('es');
    });

    it("amb l'emmagatzematge bloquejat no peta: valors per defecte", () => {
        vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new DOMException('denied', 'SecurityError'); });
        vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('denied', 'SecurityError'); });
        vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => { throw new DOMException('denied', 'SecurityError'); });

        const prefs = renderHook(() => usePreferences());
        expect(prefs.result.current.lang).toBe('ca');
        expect(prefs.result.current.unit).toBe('C');
        act(() => prefs.result.current.setLang('fr'));
        expect(prefs.result.current.lang).toBe('fr');
    });
});

describe('favorits', () => {
    afterEach(() => { localStorage.clear(); });

    const ribes = { name: 'Sant Pere', country: 'Espanya', latitude: 41.26, longitude: 1.77 };
    const pescador = { name: 'Sant Pere', country: 'Espanya', latitude: 42.19, longitude: 3.08 };

    it('dos pobles que es diuen igual poden ser favorits alhora, i l\'estrella només surt al que toca', () => {
        const { result } = renderHook(() => usePreferences());
        act(() => result.current.addFavorite(ribes));
        expect(result.current.isFavorite(pescador)).toBe(false);

        act(() => result.current.addFavorite(pescador));
        expect(result.current.favorites).toHaveLength(2);

        act(() => result.current.removeFavorite(ribes));
        expect(result.current.favorites).toEqual([pescador]);
        expect(result.current.isFavorite(ribes)).toBe(false);
        expect(result.current.isFavorite(pescador)).toBe(true);
    });

    it('el mateix lloc no es desa dues vegades encara que el GPS el doni una mica desplaçat', () => {
        const { result } = renderHook(() => usePreferences());
        act(() => result.current.addFavorite(ribes));
        act(() => result.current.addFavorite({ ...ribes, latitude: 41.2605, longitude: 1.7708 }));
        expect(result.current.favorites).toHaveLength(1);
    });
});

// Auditoria d'UX, segona volta (B8): els 3 darrers llocs triats al cercador, a part dels favorits.
describe('recents', () => {
    afterEach(() => { localStorage.clear(); });

    const place = (name: string, latitude: number, longitude = 2) => ({ name, country: 'Espanya', latitude, longitude });

    it('es recorden els 3 últims, el més recent primer, i es desen', () => {
        const { result } = renderHook(() => usePreferences());
        for (const p of [place('Girona', 41.98), place('Vic', 41.93), place('Olot', 42.18), place('Ripoll', 42.2)]) {
            act(() => result.current.addRecent(p));
        }
        expect(result.current.recents.map(r => r.name)).toEqual(['Ripoll', 'Olot', 'Vic']);
        expect(JSON.parse(localStorage.getItem('meteoai_recents') ?? '[]').map((r: { name: string }) => r.name)).toEqual(['Ripoll', 'Olot', 'Vic']);
    });

    it('un lloc que ja hi era puja al primer lloc (el mateix lloc, no el mateix nom)', () => {
        const { result } = renderHook(() => usePreferences());
        act(() => result.current.addRecent(place('Sant Pere', 41.26, 1.77)));
        act(() => result.current.addRecent(place('Vic', 41.93)));
        act(() => result.current.addRecent(place('Sant Pere', 42.19, 3.08)));
        act(() => result.current.addRecent(place('Sant Pere', 41.2605, 1.7708)));
        expect(result.current.recents.map(r => [r.name, r.latitude])).toEqual([['Sant Pere', 41.2605], ['Sant Pere', 42.19], ['Vic', 41.93]]);
    });

    it('en tornar a obrir l\'app hi són, i les entrades dolentes de l\'emmagatzematge es descarten', () => {
        localStorage.setItem('meteoai_recents', JSON.stringify([place('Girona', 41.98), { name: 'Sense coordenades' }, null, place('Vic', 41.93), place('Olot', 42.18), place('Ripoll', 42.2)]));
        const { result } = renderHook(() => usePreferences());
        expect(result.current.recents.map(r => r.name)).toEqual(['Girona', 'Vic', 'Olot']);
    });

    it('un lloc sense nom o sense coordenades no s\'hi afegeix', () => {
        const { result } = renderHook(() => usePreferences());
        act(() => result.current.addRecent({ name: '', latitude: 41, longitude: 2 }));
        act(() => result.current.addRecent({ name: 'X', latitude: NaN, longitude: 2 }));
        expect(result.current.recents).toEqual([]);
    });
});
