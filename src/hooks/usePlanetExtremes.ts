// src/hooks/usePlanetExtremes.ts
// Dades de la secció «Extrems del planeta» per a la targeta i el detall (comparteixen la mateixa petició).
import { useEffect, useState } from 'react';
import { fetchPlanetExtremes, isComplete, type PlanetExtremes } from '../services/planetExtremesApi';

// En fred, el worker pot respondre sense algun bloc (una font ha trigat més de 4,5 s) i l'acaba d'omplir
// en segon pla: un sol reintent al cap d'una estona el recull.
const RETRY_INCOMPLETE_MS = 8000;

export type PlanetExtremesState =
    | { status: 'loading'; data: null }
    | { status: 'ready'; data: PlanetExtremes }
    | { status: 'error'; data: null };

const merge = (previous: PlanetExtremes | null, next: PlanetExtremes): PlanetExtremes => ({
    metar: next.metar ?? previous?.metar ?? null,
    events: next.events ?? previous?.events ?? null,
    cyclones: next.cyclones ?? previous?.cyclones ?? null,
});

export function usePlanetExtremes(): PlanetExtremesState {
    const [state, setState] = useState<PlanetExtremesState>({ status: 'loading', data: null });

    useEffect(() => {
        let cancelled = false;
        let retry: ReturnType<typeof setTimeout> | undefined;
        const load = (isRetry: boolean) => {
            fetchPlanetExtremes()
                .then((data) => {
                    if (cancelled) return;
                    setState((prev) => ({ status: 'ready', data: merge(prev.data, data) }));
                    if (!isRetry && !isComplete(data)) retry = setTimeout(() => load(true), RETRY_INCOMPLETE_MS);
                })
                .catch(() => {
                    if (!cancelled) setState((prev) => (prev.status === 'ready' ? prev : { status: 'error', data: null }));
                });
        };
        load(false);
        return () => {
            cancelled = true;
            clearTimeout(retry);
        };
    }, []);

    return state;
}
