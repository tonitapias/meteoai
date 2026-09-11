// src/services/alertsApi.ts
import * as Sentry from "@sentry/react";
import { fetchWithTimeout } from "../utils/networkUtils";
import { SENTRY_TAGS } from "../constants/errorConstants";
import { GEMINI_PROXY_URL } from "../constants/aiConfig";
import type { Language } from "../translations";

// Fonts actives: NWS (EUA, sense clau, JSON directe), AEMET (Espanya, via
// el proxy — cal clau), Météo-França (via el proxy, sense clau: mirall
// públic Opendatasoft + l'API geogràfica oficial del govern francès),
// Meteocat (Catalunya, via el proxy — cal clau de la Generalitat), IPMA
// (Portugal, via el proxy, sense clau: JSON obert amb la seva pròpia
// referència geogràfica), DWD (Alemanya, via el proxy, sense clau: el
// mateix JSON pla que fa servir l'app oficial, referenciat geogràficament
// amb un mirall públic Opendatasoft dels districtes alemanys) i Protezione
// Civile (Itàlia, via el proxy, sense clau: TopoJSON oficial de 156 zones
// d'avís, publicat diàriament al GitHub del Dipartimento).
const NWS_ALERTS_URL = "https://api.weather.gov/alerts/active";
const AEMET_PROXY_URL = `${GEMINI_PROXY_URL}/aemet-alerts`;
const METEOFRANCE_PROXY_URL = `${GEMINI_PROXY_URL}/meteofrance-alerts`;
const METEOCAT_PROXY_URL = `${GEMINI_PROXY_URL}/meteocat-alerts`;
const IPMA_PROXY_URL = `${GEMINI_PROXY_URL}/ipma-alerts`;
const DWD_PROXY_URL = `${GEMINI_PROXY_URL}/dwd-alerts`;
const ITALY_PROXY_URL = `${GEMINI_PROXY_URL}/italy-alerts`;
const TRANSLATE_PROXY_URL = `${GEMINI_PROXY_URL}/translate-alert`;
const TIMEOUT_MS = 6000;
const TRANSLATE_TIMEOUT_MS = 10000;

// Capsa aproximada d'Espanya (península + Balears + Canàries + Ceuta/Melilla):
// evita cridar el proxy (i gastar quota d'AEMET) per a la resta del món.
const isWithinSpainBoundingBox = (lat: number, lon: number): boolean =>
    (lat >= 27 && lat <= 44 && lon >= -19 && lon <= 5);

// Capsa aproximada de la França metropolitana + Còrsega. Els territoris
// d'ultramar (Guadalupe, Reunió...) també tenen vigilància de Météo-França
// però queden fora d'aquesta capsa — pendents si mai calen.
const isWithinFranceBoundingBox = (lat: number, lon: number): boolean =>
    (lat >= 41 && lat <= 51.5 && lon >= -5.5 && lon <= 9.7);

// Capsa aproximada de Catalunya. Dins d'aquesta capsa, Meteocat substitueix
// AEMET (mai els dos alhora): és la font regional més precisa i evita
// mostrar el mateix fenomen duplicat amb dues redaccions diferents — ho hem
// vist en viu (pluja a Barcelona: taronja a AEMET i groc a Meteocat, alhora).
const isWithinCataloniaBoundingBox = (lat: number, lon: number): boolean =>
    (lat >= 40.5 && lat <= 42.9 && lon >= 0.1 && lon <= 3.4);

// Capsa de Portugal continental. Madeira i Açores (molt disperses
// geogràficament) queden pendents — vegeu la mateixa nota al Worker.
const isWithinPortugalBoundingBox = (lat: number, lon: number): boolean =>
    (lat >= 36.8 && lat <= 42.2 && lon >= -9.6 && lon <= -6.1);

// Capsa aproximada d'Alemanya.
const isWithinGermanyBoundingBox = (lat: number, lon: number): boolean =>
    (lat >= 47.2 && lat <= 55.1 && lon >= 5.8 && lon <= 15.1);

// Capsa aproximada d'Itàlia (península + Sicília + Sardenya).
const isWithinItalyBoundingBox = (lat: number, lon: number): boolean =>
    (lat >= 35.4 && lat <= 47.1 && lon >= 6.6 && lon <= 18.6);

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
    // Idioma real del text (font nativa): NWS sempre 'en', AEMET 'es'/'en',
    // Météo-França sempre 'fr', Meteocat sempre 'ca', IPMA sempre 'pt', DWD
    // sempre 'de', Protezione Civile sempre 'it'. Cap font cobreix els 4
    // idiomes de l'app — es tradueix el que calgui a getAllOfficialAlerts.
    textLang: 'es' | 'en' | 'fr' | 'ca' | 'pt' | 'de' | 'it';
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
        sourceUrl: 'https://alerts.weather.gov',
        textLang: 'en'
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

// AEMET, Meteocat, Météo-França, IPMA, DWD i Protezione Civile ja venen
// pre-parsades i filtrades pel proxy (Worker): la resposta té la mateixa
// forma que OfficialAlert, no cal cap mapeig complet aquí — compartit per
// totes les fonts basades en proxy.
const parseProxyAlertResponse = (data: unknown): OfficialAlert[] => {
    if (!Array.isArray(data)) return [];

    return data
        .filter((item): item is Record<string, unknown> =>
            !!item && typeof item === 'object' &&
            typeof (item as Record<string, unknown>).event === 'string' &&
            typeof (item as Record<string, unknown>).headline === 'string'
        )
        .map((item): OfficialAlert => {
            // [FIX] A diferència de parseFeature (NWS), aquí es confiava cegament
            // en `severity` del Worker via cast de tipus, sense comprovar-ne el
            // valor en temps d'execució. Un `severity` fora de SEVERITY_ORDER
            // trenca el comparador d'ordenació (resta amb `undefined`) i fa que
            // `severity === 'Extreme' || 'Severe'` a OfficialAlertBanner avaluï
            // fals — una alerta genuïnament greu perdria l'estil d'urgència en
            // silenci. Degradem a 'Unknown' en lloc d'assumir que el Worker
            // sempre envia un dels 5 valors vàlids.
            const severity = (typeof item.severity === 'string' && item.severity in SEVERITY_ORDER)
                ? item.severity as AlertSeverity
                : 'Unknown';

            return { ...(item as unknown as OfficialAlert), severity };
        });
};

export const getAemetAlerts = async (lat: number, lon: number, lang: Language): Promise<OfficialAlert[]> => {
    if (!isWithinSpainBoundingBox(lat, lon)) return [];

    const url = `${AEMET_PROXY_URL}?lat=${lat.toFixed(4)}&lon=${lon.toFixed(4)}&lang=${lang}`;

    try {
        const response = await fetchWithTimeout(url, TIMEOUT_MS);
        if (!response.ok) throw new Error(`AEMET Proxy Error: ${response.status}`);

        const data: unknown = await response.json();
        return parseProxyAlertResponse(data).sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);

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

// Météo-França sempre respon en francès natiu (el mirall de vigilància no
// dona text lliure traduït): el proxy ja fa el filtratge geogràfic (via
// l'API de departaments del govern francès), no cal 'lang' aquí.
export const getMeteoFranceAlerts = async (lat: number, lon: number): Promise<OfficialAlert[]> => {
    if (!isWithinFranceBoundingBox(lat, lon)) return [];

    const url = `${METEOFRANCE_PROXY_URL}?lat=${lat.toFixed(4)}&lon=${lon.toFixed(4)}`;

    try {
        const response = await fetchWithTimeout(url, TIMEOUT_MS);
        if (!response.ok) throw new Error(`Météo-France Proxy Error: ${response.status}`);

        const data: unknown = await response.json();
        return parseProxyAlertResponse(data).sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);

    } catch (err: unknown) {
        const isTimeout = err instanceof Error && err.name === 'AbortError';
        if (!isTimeout) {
            Sentry.captureException(err instanceof Error ? err : new Error(String(err)), {
                tags: { service: SENTRY_TAGS.SERVICE_ALERTS_API, source: 'meteofrance' },
                extra: { lat, lon }
            });
        }
        return [];
    }
};

// Meteocat sempre respon en català natiu (SMP no dona text lliure traduït):
// el proxy ja fa tot el filtratge geogràfic (municipi més proper -> comarca),
// no cal 'lang' aquí.
export const getMeteocatAlerts = async (lat: number, lon: number): Promise<OfficialAlert[]> => {
    if (!isWithinCataloniaBoundingBox(lat, lon)) return [];

    const url = `${METEOCAT_PROXY_URL}?lat=${lat.toFixed(4)}&lon=${lon.toFixed(4)}`;

    try {
        const response = await fetchWithTimeout(url, TIMEOUT_MS);
        if (!response.ok) throw new Error(`Meteocat Proxy Error: ${response.status}`);

        const data: unknown = await response.json();
        return parseProxyAlertResponse(data).sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);

    } catch (err: unknown) {
        const isTimeout = err instanceof Error && err.name === 'AbortError';
        if (!isTimeout) {
            Sentry.captureException(err instanceof Error ? err : new Error(String(err)), {
                tags: { service: SENTRY_TAGS.SERVICE_ALERTS_API, source: 'meteocat' },
                extra: { lat, lon }
            });
        }
        return [];
    }
};

// IPMA sempre respon en portuguès natiu (el JSON d'avisos no dona text
// lliure traduït): el proxy ja fa tot el filtratge geogràfic (localitat més
// propera -> idAreaAviso), no cal 'lang' aquí.
export const getIpmaAlerts = async (lat: number, lon: number): Promise<OfficialAlert[]> => {
    if (!isWithinPortugalBoundingBox(lat, lon)) return [];

    const url = `${IPMA_PROXY_URL}?lat=${lat.toFixed(4)}&lon=${lon.toFixed(4)}`;

    try {
        const response = await fetchWithTimeout(url, TIMEOUT_MS);
        if (!response.ok) throw new Error(`IPMA Proxy Error: ${response.status}`);

        const data: unknown = await response.json();
        return parseProxyAlertResponse(data).sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);

    } catch (err: unknown) {
        const isTimeout = err instanceof Error && err.name === 'AbortError';
        if (!isTimeout) {
            Sentry.captureException(err instanceof Error ? err : new Error(String(err)), {
                tags: { service: SENTRY_TAGS.SERVICE_ALERTS_API, source: 'ipma' },
                extra: { lat, lon }
            });
        }
        return [];
    }
};

// DWD sempre respon en alemany natiu (el JSON de warnapp_landkreise no dona
// text lliure traduït): el proxy ja fa tot el filtratge geogràfic (districte
// més proper -> WARNCELLID), no cal 'lang' aquí.
export const getDwdAlerts = async (lat: number, lon: number): Promise<OfficialAlert[]> => {
    if (!isWithinGermanyBoundingBox(lat, lon)) return [];

    const url = `${DWD_PROXY_URL}?lat=${lat.toFixed(4)}&lon=${lon.toFixed(4)}`;

    try {
        const response = await fetchWithTimeout(url, TIMEOUT_MS);
        if (!response.ok) throw new Error(`DWD Proxy Error: ${response.status}`);

        const data: unknown = await response.json();
        return parseProxyAlertResponse(data).sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);

    } catch (err: unknown) {
        const isTimeout = err instanceof Error && err.name === 'AbortError';
        if (!isTimeout) {
            Sentry.captureException(err instanceof Error ? err : new Error(String(err)), {
                tags: { service: SENTRY_TAGS.SERVICE_ALERTS_API, source: 'dwd' },
                extra: { lat, lon }
            });
        }
        return [];
    }
};

// Protezione Civile sempre respon en italià natiu (el butlletí no dona text
// lliure traduït): el proxy ja fa tot el filtratge geogràfic (punt dins del
// polígon TopoJSON de la zona d'avís), no cal 'lang' aquí.
export const getItalyAlerts = async (lat: number, lon: number): Promise<OfficialAlert[]> => {
    if (!isWithinItalyBoundingBox(lat, lon)) return [];

    const url = `${ITALY_PROXY_URL}?lat=${lat.toFixed(4)}&lon=${lon.toFixed(4)}`;

    try {
        const response = await fetchWithTimeout(url, TIMEOUT_MS);
        if (!response.ok) throw new Error(`Italy Proxy Error: ${response.status}`);

        const data: unknown = await response.json();
        return parseProxyAlertResponse(data).sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);

    } catch (err: unknown) {
        const isTimeout = err instanceof Error && err.name === 'AbortError';
        if (!isTimeout) {
            Sentry.captureException(err instanceof Error ? err : new Error(String(err)), {
                tags: { service: SENTRY_TAGS.SERVICE_ALERTS_API, source: 'italy' },
                extra: { lat, lon }
            });
        }
        return [];
    }
};

// Tradueix els 4 camps de text d'una alerta amb el mateix motor IA (Gemini/Groq)
// que l'anàlisi tàctica, via el proxy (mai clau exposada al client). Cachejat
// per alerta+idioma al worker, així que el cost real només el paga el primer
// usuari que demana aquesta combinació. Fail-open: si falla, retorna l'alerta
// original sense traduir (mai trenca el banner per un error de traducció).
const translateAlert = async (alert: OfficialAlert, targetLang: Language): Promise<OfficialAlert> => {
    try {
        const response = await fetchWithTimeout(TRANSLATE_PROXY_URL, TRANSLATE_TIMEOUT_MS, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                id: alert.id,
                targetLang,
                event: alert.event,
                headline: alert.headline,
                description: alert.description,
                instruction: alert.instruction
            })
        });
        if (!response.ok) throw new Error(`Translate Proxy Error: ${response.status}`);

        const translated: unknown = await response.json();
        if (!translated || typeof translated !== 'object') return alert;

        const t = translated as Record<string, unknown>;
        return {
            ...alert,
            event: typeof t.event === 'string' ? t.event : alert.event,
            headline: typeof t.headline === 'string' ? t.headline : alert.headline,
            description: typeof t.description === 'string' ? t.description : alert.description,
            instruction: typeof t.instruction === 'string' ? t.instruction : (t.instruction === null ? null : alert.instruction)
        };
    } catch {
        return alert;
    }
};

// Punt d'entrada únic per a la UI: consulta totes les fonts rellevants per a
// la ubicació (en paral·lel), les fusiona per severitat, i tradueix les que
// no tinguin text natiu en l'idioma demanat. Cada font ja es filtra sola per
// geografia (NWS respon 400 fora dels EUA, la resta es descarten abans de
// trucar si la ubicació cau fora de la seva capsa), així que en general és
// segur cridar-les totes — EXCEPTE AEMET dins de Catalunya, on Meteocat el
// substitueix expressament per evitar el mateix avís duplicat amb dues fonts.
export const getAllOfficialAlerts = async (lat: number, lon: number, lang: Language): Promise<OfficialAlert[]> => {
    const inCatalonia = isWithinCataloniaBoundingBox(lat, lon);

    const [nws, aemet, meteocat, meteofrance, ipma, dwd, italy] = await Promise.all([
        getOfficialAlerts(lat, lon),
        inCatalonia ? Promise.resolve([]) : getAemetAlerts(lat, lon, lang),
        inCatalonia ? getMeteocatAlerts(lat, lon) : Promise.resolve([]),
        getMeteoFranceAlerts(lat, lon),
        getIpmaAlerts(lat, lon),
        getDwdAlerts(lat, lon),
        getItalyAlerts(lat, lon)
    ]);

    const merged = [...meteocat, ...aemet, ...meteofrance, ...ipma, ...dwd, ...italy, ...nws].sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);

    return Promise.all(merged.map((alert) =>
        alert.textLang === lang ? alert : translateAlert(alert, lang)
    ));
};
