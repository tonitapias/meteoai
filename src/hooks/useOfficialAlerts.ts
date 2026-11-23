// src/hooks/useOfficialAlerts.ts
import { useState, useEffect } from 'react';
import { getAllOfficialAlerts, OfficialAlert } from '../services/alertsApi';
import type { Language } from '../translations';

// La franja d'avisos (Ara) i el detall del dia demanen els mateixos avisos: es comparteix la mateixa consulta durant uns
// minuts en lloc de tornar a cridar les 7 fonts (i la traducció) cada vegada que s'obre un dia.
const CACHE_TTL_MS = 5 * 60_000;
const cache = new Map<string, { at: number; promise: Promise<OfficialAlert[]> }>();

const fetchShared = (lat: number, lon: number, lang: Language): Promise<OfficialAlert[]> => {
    const key = `${lat.toFixed(3)},${lon.toFixed(3)},${lang}`;
    const hit = cache.get(key);
    if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.promise;
    const promise = getAllOfficialAlerts(lat, lon, lang).catch((error: unknown) => {
        cache.delete(key);
        throw error;
    });
    cache.set(key, { at: Date.now(), promise });
    return promise;
};

/** Només per als tests. */
export const clearOfficialAlertsCache = () => cache.clear();

export function useOfficialAlerts(lat: number | undefined, lon: number | undefined, lang: Language) {
    const [alerts, setAlerts] = useState<OfficialAlert[]>([]);

    useEffect(() => {
        if (typeof lat !== 'number' || typeof lon !== 'number') return;

        let cancelled = false;
        const timer = setTimeout(async () => {
            try {
                const result = await fetchShared(lat, lon, lang);
                if (!cancelled) setAlerts(result);
            } catch {
                // getAllOfficialAlerts ja és fail-open per font; un error aquí deixa la llista com era.
            }
        }, 500);

        return () => {
            cancelled = true;
            clearTimeout(timer);
        };
    }, [lat, lon, lang]);

    return { alerts };
}
