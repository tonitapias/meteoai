// src/hooks/usePlanetNavigation.ts
// La pila de pantalles del detall d'«Extrems del planeta» (vegeu utils/planetNav.ts), lligada a l'historial: cada
// pantalla que s'hi afegeix és un pas, i el botó «enrere» del mòbil en treu una, igual que la fletxa de la
// capçalera. El pas del detall mateix el posa useModalHistory (a useViewState), que el tanca quan ja no en queda
// cap de nostre.
//
// Cada pantalla de més ocupa el cim de la pila de useModalHistory (pushHistoryLevel): així el detall no es tanca
// sencer amb un «enrere», sigui quin sigui l'ordre en què el navegador crida els listeners.
import { useCallback, useEffect, useRef, useState } from 'react';
import { initialPlanetStack, type PlanetEntry, type PlanetView } from '../utils/planetNav';
import { ignoreNextPopState, isPopStateHandled, markPopStateHandled, pushHistoryLevel, removeHistoryLevel } from './useModalHistory';

// Si el navegador no avisés del retrocés en tancar, es tanca igualment al cap d'aquesta estona.
export const CLOSE_FALLBACK_MS = 400;

export interface PlanetNavigation {
    stack: PlanetView[];
    view: PlanetView;
    /** La pantalla de sota, on porta la fletxa (null a la llista). */
    parent: PlanetView | null;
    push: (view: PlanetView) => void;
    back: () => void;
    /** Canvia la pantalla de dalt sense afegir cap pas: la pestanya de la llista, l'ull del visor. */
    replace: (view: PlanetView) => void;
    /** Tanca el detall sencer (la creu, Escape), traient abans els passos propis de l'historial. */
    closeAll: () => void;
}

type Levels = { current: symbol[] };

const dropAllLevels = (levels: Levels) => {
    levels.current.forEach(removeHistoryLevel);
    levels.current = [];
};

export function usePlanetNavigation(entry: PlanetEntry, onClose: () => void): PlanetNavigation {
    const [stack, setStack] = useState<PlanetView[]>(() => initialPlanetStack(entry));
    // Un nivell de la pila de useModalHistory per cada pas d'historial que el detall ha afegit, a part del seu.
    const levelsRef = useRef<symbol[]>([]);
    const closingRef = useRef(false);
    const startedRef = useRef(false);
    const onCloseRef = useRef(onClose);
    useEffect(() => { onCloseRef.current = onClose; }, [onClose]);

    useEffect(() => {
        // Si s'obre directament una fitxa, la llista que té a sota ja és un pas. Els passos, una sola vegada; els
        // nivells, cada cop que es munta (el mode estricte de desenvolupament desmunta i torna a muntar els efectes,
        // però conserva les refs).
        if (!startedRef.current) {
            startedRef.current = true;
            const extra = initialPlanetStack(entry).length - 1;
            for (let i = 0; i < extra; i++) window.history.pushState({ planetView: true }, '', window.location.href);
            levelsRef.current = Array.from({ length: extra }, () => Symbol('pending'));
        }
        levelsRef.current = levelsRef.current.map(() => pushHistoryLevel());

        const onPopState = (event: PopStateEvent) => {
            if (isPopStateHandled(event)) return;
            if (closingRef.current) {
                closingRef.current = false;
                markPopStateHandled(event);
                dropAllLevels(levelsRef);
                onCloseRef.current();
                return;
            }
            const level = levelsRef.current.pop();
            if (!level) return;
            removeHistoryLevel(level);
            markPopStateHandled(event);
            setStack((s) => (s.length > 1 ? s.slice(0, -1) : s));
        };
        window.addEventListener('popstate', onPopState);
        return () => {
            window.removeEventListener('popstate', onPopState);
            // Un nivell que quedés a la pila impediria tancar els altres modals amb l'«enrere».
            levelsRef.current.forEach(removeHistoryLevel);
        };
        // L'entrada només compta en obrir.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const push = useCallback((view: PlanetView) => {
        window.history.pushState({ planetView: true }, '', window.location.href);
        levelsRef.current.push(pushHistoryLevel());
        setStack((s) => [...s, view]);
    }, []);

    const closeAll = useCallback(() => {
        const extra = levelsRef.current.length;
        if (extra === 0) {
            onCloseRef.current();
            return;
        }
        // Els nivells es queden fins que arriba el retrocés: fins llavors, el detall no l'ha de tancar ningú altre.
        closingRef.current = true;
        window.history.go(-extra);
        window.setTimeout(() => {
            if (!closingRef.current) return;
            closingRef.current = false;
            dropAllLevels(levelsRef);
            onCloseRef.current();
        }, CLOSE_FALLBACK_MS);
    }, []);

    const back = useCallback(() => {
        const level = levelsRef.current.pop();
        if (!level) {
            closeAll();
            return;
        }
        removeHistoryLevel(level);
        ignoreNextPopState();
        window.history.back();
        setStack((s) => (s.length > 1 ? s.slice(0, -1) : s));
    }, [closeAll]);

    const replace = useCallback((view: PlanetView) => {
        setStack((s) => [...s.slice(0, -1), view]);
    }, []);

    return {
        stack,
        view: stack[stack.length - 1],
        parent: stack.length > 1 ? stack[stack.length - 2] : null,
        push,
        back,
        replace,
        closeAll,
    };
}
