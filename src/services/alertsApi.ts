// src/services/alertsApi.ts
import * as Sentry from "@sentry/react";
import { fetchWithTimeout } from "../utils/networkUtils";
import { SENTRY_TAGS } from "../constants/errorConstants";
import { GEMINI_PROXY_URL } from "../constants/aiConfig";

// Fonts actives: NWS (EUA, sense clau, JSON directe) i AEMET (Espanya, via
// el proxy existent — cal clau d'AEMET i parsing de CAP-XML/tar.gz, massa
// feina i massa sensible per fer-ho directament des del navegador).
// Météo-França i altres serveis nacionals: pendents.
const NWS_ALERTS_URL = "https://api.weather.gov/alerts/active";
const AEMET_PROXY_URL = `${GEMINI_PROXY_URL}/aemet-alerts`;
const TIMEOUT_MS = 6000;

// Capsa aproximada d'Espanya (península + Balears + Canàries + Ceuta/Melilla):
// evita cridar el proxy (i gastar quota d'AEMET) per a la resta del món.
const isWithinSpainBoundingBox = (lat: number, lon: number): boolean =>
    (lat >= 27 && lat <= 44 && lon >= -19 && lon <= 5);

export type AlertSeverity = 'Extreme' | 'Severe' | 'Moderate' | 'Minor' | 'Unknown';

export interface OfficialAlert {
    id: string;
    event: string;
    severity: AlertSeverity;
    headline: string;
    description: string;
    instruction: string | null;
    senderName: string;
    expires: string | null;
    sourceName: string;
    sourceUrl: string;
}

const SEVERITY_ORDER: Record<AlertSeverity, number> = {
    Extreme: 0, Severe: 1, Moderate: 2, Minor: 3, Unknown: 4
};

const parseFeature = (feature: unknown): OfficialAlert | null => {
    const props = (feature as Record<string, unknown>)?.properties as Record<string, unknown> | undefined;
    if (!props || typeof props.event !== 'string' || typeof props.headline !== 'string') return null;

    const severity = (typeof props.severity === 'string' && props.severity in SEVERITY_ORDER)
        ? props.severity as AlertSeverity
        : 'Unknown';

    return {
        id: typeof props.id === 'string' ? props.id : String(props['@id'] ?? `${props.event}-${props.headline}`),
        event: props.event,
        severity,
        headline: props.headline,
        description: typeof props.description === 'string' ? props.description : '',
        instruction: typeof props.instruction === 'string' ? props.instruction : null,
        senderName: typeof props.senderName === 'string' ? props.senderName : 'National Weather Service',
        expires: typeof props.expires === 'string' ? props.expires : null,
        sourceName: 'National Weather Service (NOAA)',
        sourceUrl: 'https://alerts.weather.gov'
    };
};

// Retorna sempre un array (mai llança): l'absència d'alertes, o de cobertura
// en aquest punt del planeta, no és un error de l'aplicació.
export const getOfficialAlerts = async (lat: number, lon: number): Promise<OfficialAlert[]> => {
    const url = `${NWS_ALERTS_URL}?point=${lat.toFixed(4)},${lon.toFixed(4)}`;

    try {
        const response = await fetchWithTimeout(url, TIMEOUT_MS);

        // Punt fora de la zona de cobertura de NWS (tot el món excepte EUA/territoris):
        // la pròpia API respon 400 "out of bounds". No és un error, és l'esperat.
        if (response.status === 400) return [];
        if (!response.ok) throw new Error(`NWS Alerts API Error: ${response.status}`);

        const data: unknown = await response.json();
        const features = Array.isArray((data as Record<string, unknown>)?.features)
            ? (data as Record<string, unknown>).features as unknown[]
            : [];

        return features
            .map(parseFeature)
            .filter((a): a is OfficialAlert => a !== null)
            .sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);

    } catch (err: unknown) {
        const isTimeout = err instanceof Error && err.name === 'AbortError';
        if (!isTimeout) {
            Sentry.captureException(err instanceof Error ? err : new Error(String(err)), {
                tags: { service: SENTRY_TAGS.SERVICE_ALERTS_API },
                extra: { lat, lon }
            });
        }
        return [];
    }
};

// L'AEMET ja ve pre-parsada i filtrada pel proxy (Worker): la resposta té
// exactament la mateixa forma que OfficialAlert, no cal cap mapeig aquí.
const parseAemetResponse = (data: unknown): OfficialAlert[] => {
    if (!Array.isArray(data)) return [];

    return data.filter((item): item is OfficialAlert =>
        !!item && typeof item === 'object' &&
        typeof (item as OfficialAlert).event === 'string' &&
        typeof (item as OfficialAlert).headline === 'string'
    );
};

export const getAemetAlerts = async (lat: number, lon: number): Promise<OfficialAlert[]> => {
    if (!isWithinSpainBoundingBox(lat, lon)) return [];

    const url = `${AEMET_PROXY_URL}?lat=${lat.toFixed(4)}&lon=${lon.toFixed(4)}`;

    try {
        const response = await fetchWithTimeout(url, TIMEOUT_MS);
        if (!response.ok) throw new Error(`AEMET Proxy Error: ${response.status}`);

        const data: unknown = await response.json();
        return parseAemetResponse(data).sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);

    } catch (err: unknown) {
        const isTimeout = err instanceof Error && err.name === 'AbortError';
        if (!isTimeout) {
            Sentry.captureException(err instanceof Error ? err : new Error(String(err)), {
                tags: { service: SENTRY_TAGS.SERVICE_ALERTS_API, source: 'aemet' },
                extra: { lat, lon }
            });
        }
        return [];
    }
};

// Punt d'entrada únic per a la UI: consulta totes les fonts rellevants per a
// la ubicació (en paral·lel) i les fusiona per severitat. Cada font ja es
// filtra sola per geografia (NWS respon 400 fora dels EUA, AEMET es descarta
// abans de trucar si no som a Espanya), així que sempre és segur cridar-les totes.
export const getAllOfficialAlerts = async (lat: number, lon: number): Promise<OfficialAlert[]> => {
    const [nws, aemet] = await Promise.all([
        getOfficialAlerts(lat, lon),
        getAemetAlerts(lat, lon)
    ]);

    return [...aemet, ...nws].sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);
};
