// src/hooks/viewPreferences.test.ts
// La vista triada i l'"Ara no" de la targeta es recorden; i si el navegador bloqueja l'emmagatzematge,
// l'app s'obre igualment amb els valors per defecte.
import { describe, it, expect, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePreferences } from './usePreferences';
import { useDetailHint } from './useDetailHint';

describe('preferències de vista', () => {
    afterEach(() => {
        vi.restoreAllMocks();
        localStorage.clear();
    });

    it('recorda la vista triada', () => {
        localStorage.setItem('meteoai_view_mode', 'expert');
        const { result } = renderHook(() => usePreferences());
        expect(result.current.viewMode).toBe('expert');

        act(() => result.current.setViewMode('basic'));
        expect(localStorage.getItem('meteoai_view_mode')).toBe('basic');
    });

    it('un valor desat desconegut torna a la vista essencial', () => {
        localStorage.setItem('meteoai_view_mode', 'complete');
        const { result } = renderHook(() => usePreferences());
        expect(result.current.viewMode).toBe('basic');
    });

    it("amb l'emmagatzematge bloquejat no peta: valors per defecte", () => {
        vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new DOMException('denied', 'SecurityError'); });
        vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('denied', 'SecurityError'); });

        const prefs = renderHook(() => usePreferences());
        expect(prefs.result.current.viewMode).toBe('basic');
        expect(prefs.result.current.lang).toBe('ca');
        act(() => prefs.result.current.setViewMode('expert'));
        expect(prefs.result.current.viewMode).toBe('expert');

        const hint = renderHook(() => useDetailHint());
        expect(hint.result.current.compact).toBe(false);
        act(() => hint.result.current.markCompact());
        expect(hint.result.current.compact).toBe(true);
    });

    it('"Ara no" o haver entrat a la vista completa es recorda per sempre', () => {
        const first = renderHook(() => useDetailHint());
        expect(first.result.current.compact).toBe(false);
        act(() => first.result.current.markCompact());

        const later = renderHook(() => useDetailHint());
        expect(later.result.current.compact).toBe(true);
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
