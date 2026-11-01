// src/hooks/usePlanetNavigation.test.ts
import { renderHook, act, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach, type MockInstance } from 'vitest';
import { usePlanetNavigation, CLOSE_FALLBACK_MS } from './usePlanetNavigation';
import { useModalHistory } from './useModalHistory';
import type { PlanetEntry } from '../utils/planetNav';

// El detall sencer el porta useModalHistory (a useViewState). A l'app, el detall es carrega a part i el seu listener
// es registra després del de useModalHistory; però no se n'ha de dependre: es prova en tots dos ordres.
const useRootFirst = (entry: PlanetEntry, onClose: () => void, onRootClose: () => void) => {
    useModalHistory(true, onRootClose);
    return usePlanetNavigation(entry, onClose);
};
const useNavFirst = (entry: PlanetEntry, onClose: () => void, onRootClose: () => void) => {
    const nav = usePlanetNavigation(entry, onClose);
    useModalHistory(true, onRootClose);
    return nav;
};

describe.each([
    ['el detall es registra després (com a l\'app)', useRootFirst],
    ['el detall es registra abans', useNavFirst],
])('usePlanetNavigation: %s', (_label, useBoth) => {
    let pushState: MockInstance;
    let back: MockInstance;
    let go: MockInstance;

    const popstate = () => act(() => { window.dispatchEvent(new PopStateEvent('popstate')); });
    const levelPushes = () => pushState.mock.calls.filter(([state]) => (state as { planetView?: boolean } | null)?.planetView).length;

    beforeEach(() => {
        pushState = vi.spyOn(window.history, 'pushState');
        back = vi.spyOn(window.history, 'back').mockImplementation(() => {});
        go = vi.spyOn(window.history, 'go').mockImplementation(() => {});
    });

    afterEach(() => {
        cleanup();
        vi.restoreAllMocks();
        vi.useRealTimers();
    });

    const mount = (entry: PlanetEntry) => {
        const onClose = vi.fn();
        const onRootClose = vi.fn();
        const hook = renderHook(() => useBoth(entry, onClose, onRootClose));
        return { ...hook, onClose, onRootClose };
    };

    it('obert a la llista no afegeix cap pas propi; cada pantalla nova, un', () => {
        const { result } = mount({ kind: 'list', tab: 'records' });
        expect(levelPushes()).toBe(0);
        act(() => result.current.push({ kind: 'record', record: 'wetBulb' }));
        expect(levelPushes()).toBe(1);
        expect(result.current.view).toEqual({ kind: 'record', record: 'wetBulb' });
        expect(result.current.parent).toEqual({ kind: 'list', tab: 'records' });
    });

    it("obert directament a una fitxa, la llista de sota ja és un pas: el primer «enrere» hi porta", () => {
        const { result, onRootClose } = mount({ kind: 'cyclone', id: 'E1' });
        expect(levelPushes()).toBe(1);
        expect(result.current.stack).toEqual([{ kind: 'list', tab: 'events' }, { kind: 'cyclone', id: 'E1' }]);
        popstate();
        expect(result.current.view).toEqual({ kind: 'list', tab: 'events' });
        expect(onRootClose).not.toHaveBeenCalled();
    });

    it('el botó «enrere» del mòbil puja un sol nivell; a la llista, tanca el detall', () => {
        const { result, onClose, onRootClose } = mount({ kind: 'list', tab: 'events' });
        act(() => result.current.push({ kind: 'cyclone', id: 'E1' }));
        act(() => result.current.push({ kind: 'orbit', eye: 'himawari' }));
        popstate();
        expect(result.current.view).toEqual({ kind: 'cyclone', id: 'E1' });
        popstate();
        expect(result.current.view).toEqual({ kind: 'list', tab: 'events' });
        expect(onRootClose).not.toHaveBeenCalled();
        popstate();
        expect(onRootClose).toHaveBeenCalledTimes(1);
        expect(onClose).not.toHaveBeenCalled();
    });

    it('la fletxa fa el mateix: retrocedeix un pas, i el popstate que en ve no en treu cap altre', () => {
        const { result, onRootClose } = mount({ kind: 'list', tab: 'records' });
        act(() => result.current.push({ kind: 'record', record: 'coldest' }));
        act(() => result.current.push({ kind: 'orbit', eye: 'goes' }));
        act(() => result.current.back());
        expect(back).toHaveBeenCalledTimes(1);
        expect(result.current.view).toEqual({ kind: 'record', record: 'coldest' });
        popstate();
        expect(result.current.view).toEqual({ kind: 'record', record: 'coldest' });
        expect(onRootClose).not.toHaveBeenCalled();
        // El següent «enrere» del mòbil ja és un de nou.
        popstate();
        expect(result.current.view).toEqual({ kind: 'list', tab: 'records' });
    });

    it("canviar de pestanya o d'ull no afegeix cap pas", () => {
        const { result } = mount({ kind: 'list', tab: 'records' });
        act(() => result.current.replace({ kind: 'list', tab: 'events' }));
        expect(levelPushes()).toBe(0);
        expect(result.current.stack).toEqual([{ kind: 'list', tab: 'events' }]);
    });

    it('la creu, des de dins, treu de cop els passos propis i després tanca', () => {
        const { result, onClose, onRootClose } = mount({ kind: 'list', tab: 'events' });
        act(() => result.current.push({ kind: 'cyclone', id: 'E1' }));
        act(() => result.current.push({ kind: 'orbit', eye: 'himawari' }));
        act(() => result.current.closeAll());
        expect(go).toHaveBeenCalledWith(-2);
        expect(onClose).not.toHaveBeenCalled();
        popstate();
        expect(onClose).toHaveBeenCalledTimes(1);
        expect(onRootClose).not.toHaveBeenCalled();
    });

    it("si el navegador no avisés del retrocés, tanca igualment al cap d'una estona", () => {
        vi.useFakeTimers();
        const { result, onClose } = mount({ kind: 'record', record: 'gust' });
        act(() => result.current.closeAll());
        expect(go).toHaveBeenCalledWith(-1);
        act(() => { vi.advanceTimersByTime(CLOSE_FALLBACK_MS); });
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('a la llista, la creu tanca de seguida', () => {
        const { result, onClose } = mount({ kind: 'list', tab: 'records' });
        act(() => result.current.closeAll());
        expect(go).not.toHaveBeenCalled();
        expect(onClose).toHaveBeenCalledTimes(1);
    });
});
