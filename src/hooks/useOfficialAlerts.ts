// src/hooks/useOfficialAlerts.ts
import { useState, useEffect } from 'react';
import { getAllOfficialAlerts, OfficialAlert } from '../services/alertsApi';

export function useOfficialAlerts(lat: number | undefined, lon: number | undefined) {
    const [alerts, setAlerts] = useState<OfficialAlert[]>([]);

    useEffect(() => {
        if (typeof lat !== 'number' || typeof lon !== 'number') return;

        let cancelled = false;
        const timer = setTimeout(async () => {
            const result = await getAllOfficialAlerts(lat, lon);
            if (!cancelled) setAlerts(result);
        }, 500);

        return () => {
            cancelled = true;
            clearTimeout(timer);
        };
    }, [lat, lon]);

    return { alerts };
}
