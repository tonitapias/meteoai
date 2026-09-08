// src/hooks/useOfficialAlerts.ts
import { useState, useEffect } from 'react';
import { getAllOfficialAlerts, OfficialAlert } from '../services/alertsApi';
import type { Language } from '../translations';

export function useOfficialAlerts(lat: number | undefined, lon: number | undefined, lang: Language) {
    const [alerts, setAlerts] = useState<OfficialAlert[]>([]);

    useEffect(() => {
        if (typeof lat !== 'number' || typeof lon !== 'number') return;

        let cancelled = false;
        const timer = setTimeout(async () => {
            const result = await getAllOfficialAlerts(lat, lon, lang);
            if (!cancelled) setAlerts(result);
        }, 500);

        return () => {
            cancelled = true;
            clearTimeout(timer);
        };
    }, [lat, lon, lang]);

    return { alerts };
}
