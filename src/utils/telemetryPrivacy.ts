// src/utils/telemetryPrivacy.ts
// Privadesa a Sentry: el que s'hi envia (errors, traces, repeticions i les seves molles de pa) no porta la posició
// exacta de l'usuari. Les coordenades queden arrodonides a ~1 km (prou per saber la zona i reproduir un error del model
// o dels avisos) i l'adreça de l'app hi va sense el lloc (?lat&lon&nom&pais&origen, vegeu utils/placeLink.ts).
// Només toca la còpia que s'envia: ni la URL real, ni l'enllaç per compartir, ni cap petició (que ja s'han fet).
import { PLACE_PARAMS } from './placeLink';

export interface TelemetryPrivacyContext {
    /** window.location.origin: per reconèixer l'adreça de l'app. */
    appOrigin: string;
    /** import.meta.env.BASE_URL ('/'). */
    appBase: string;
}

/** Decimals de les coordenades a Sentry (~1 km). L'enllaç per compartir en porta 5 (vegeu roundLinkCoord). */
export const TELEMETRY_COORD_DECIMALS = 2;
const DEGREE_FACTOR = 10 ** TELEMETRY_COORD_DECIMALS;
// Un `bbox` en metres (EPSG:3857, la mostra de llamps d'EUMETSAT) s'arrodoneix al km.
const METERS_STEP = 1000;

// Paràmetres amb coordenades a les peticions de l'app: Open-Meteo i BigDataCloud (latitude/longitude), els
// intermediaris d'avisos (lat/lon), NWS (point=lat,lon), EUMETSAT i GIBS (bbox), Google Maps (query/destination).
const COORD_KEYS = new Set(['lat', 'lon', 'latitude', 'longitude', 'point', 'bbox']);
const COORD_PAIR_KEYS = new Set(['query', 'destination']);
const APP_PLACE_KEYS = new Set<string>(Object.values(PLACE_PARAMS));
// Nom, país i origen del lloc: només els fa servir l'enllaç de l'app.
const PLACE_NAME_KEYS = new Set<string>([PLACE_PARAMS.name, PLACE_PARAMS.country, PLACE_PARAMS.origin]);

// Camí ràpid: la gran majoria de textos (noms de fitxer, funcions, missatges) no porten cap d'aquests paràmetres.
const SENSITIVE_PARAM = /[?&#](?:lat|lon|latitude|longitude|point|bbox|query|destination|nom|pais|origen)=/i;
const COORD_PAIR = /^\s*-?\d{1,3}(?:\.\d+)?\s*,\s*-?\d{1,3}(?:\.\d+)?\s*$/;
const NUMBER = /-?\d+(?:\.\d+)?/g;

const roundDegrees = (value: number): number => {
    const rounded = Math.round(value * DEGREE_FACTOR) / DEGREE_FACTOR;
    return rounded === 0 ? 0 : rounded;
};

/** Cada número del valor, arrodonit: graus a 2 decimals; metres (|v| > 360) al km. */
const coarsenNumbers = (value: string): string => value.replace(NUMBER, (text) => {
    const n = Number(text);
    if (!Number.isFinite(n)) return text;
    return String(Math.abs(n) > 360 ? Math.round(n / METERS_STEP) * METERS_STEP : roundDegrees(n));
});

// En el mateix ordre: l'adreça neta s'ha de poder comparar amb l'original.
const scrubParams = (params: URLSearchParams, isAppPage: boolean): URLSearchParams => {
    const clean = new URLSearchParams();
    params.forEach((value, key) => {
        const lower = key.toLowerCase();
        if (PLACE_NAME_KEYS.has(lower) || (isAppPage && APP_PLACE_KEYS.has(lower))) return;
        const isCoord = COORD_KEYS.has(lower) || (COORD_PAIR_KEYS.has(lower) && COORD_PAIR.test(value));
        clean.append(key, isCoord ? coarsenNumbers(value) : value);
    });
    return clean;
};

const ABSOLUTE_URL = /^[a-z][a-z\d+.-]*:\/\//i;

/**
 * Una adreça (absoluta, relativa com les de les navegacions, o només la cerca com `http.query`): l'adreça de l'app,
 * sense el lloc; qualsevol altra, amb les coordenades arrodonides.
 */
export const scrubUrl = (raw: string, ctx: TelemetryPrivacyContext): string => {
    if (!SENSITIVE_PARAM.test(raw)) return raw;
    const queryOnly = raw.startsWith('?');
    let url: URL;
    try {
        url = new URL(raw, ctx.appOrigin);
    } catch {
        return scrubText(raw);
    }
    // Només la cerca (`?latitude=…` d'una traça): no se sap de qui és, així que s'arrodoneix, no s'esborra.
    const isAppPage = !queryOnly && url.origin === ctx.appOrigin && url.pathname.startsWith(ctx.appBase);
    const search = scrubParams(url.searchParams, isAppPage).toString();
    const query = search ? `?${search}` : '';
    if (queryOnly) return query;
    return ABSOLUTE_URL.test(raw) ? `${url.origin}${url.pathname}${query}${url.hash}` : `${url.pathname}${query}${url.hash}`;
};

const KEY_VALUE_IN_TEXT = /([?&#])(lat|lon|latitude|longitude|point|bbox|query|destination|nom|pais|origen)=([^&#\s"'<>]*)/gi;

/** Text lliure (un missatge de consola o d'error amb una adreça a dins): mateixos criteris, sense desmuntar-lo. */
export const scrubText = (text: string): string => {
    if (!SENSITIVE_PARAM.test(text)) return text;
    return text.replace(KEY_VALUE_IN_TEXT, (match, sep: string, key: string, value: string) => {
        const lower = key.toLowerCase();
        if (PLACE_NAME_KEYS.has(lower)) return sep === '?' ? '?' : '';
        if (COORD_PAIR_KEYS.has(lower)) {
            const decoded = safeDecode(value);
            return COORD_PAIR.test(decoded) ? `${sep}${key}=${coarsenNumbers(decoded)}` : match;
        }
        return `${sep}${key}=${coarsenNumbers(safeDecode(value))}`;
    });
};

const safeDecode = (value: string): string => {
    try {
        return decodeURIComponent(value);
    } catch {
        return value;
    }
};

const looksLikeUrl = (text: string): boolean =>
    !/\s/.test(text) && (ABSOLUTE_URL.test(text) || text.startsWith('/') || text.startsWith('?'));

// Claus d'objecte amb una coordenada en número (p. ex. `extra: { lat, lon }` de les crides a Sentry).
const NUMERIC_COORD_KEYS = new Set(['lat', 'lon', 'latitude', 'longitude']);
const MAX_DEPTH = 12;
// Dades internes del SDK que no s'envien (hi ha els àmbits de Sentry, objectes amb getters i referències circulars).
const SKIP_KEYS = new Set(['sdkProcessingMetadata']);

/**
 * Neteja (in situ) un esdeveniment, una molla de pa o un esdeveniment de gravació de Replay i el torna. Recorre
 * objectes plans i llistes; els textos amb coordenades o amb el lloc de l'app passen per scrubUrl/scrubText.
 *
 * No pot fallar mai: si un filtre de Sentry llança una excepció, el SDK l'envia com a error intern SENSE passar pels
 * filtres (la primera versió ho feia en escriure una propietat amb només getter d'un àmbit del SDK). Per això no toca
 * cap instància de classe, no invoca getters, no escriu propietats de només lectura i cada clau va dins un try.
 */
export const scrubTelemetry = <T>(value: T, ctx: TelemetryPrivacyContext): T => {
    try {
        return scrubNode(value, ctx, 0, new WeakSet()) as T;
    } catch {
        return value;
    }
};

const isPlainObject = (value: object): boolean => {
    const proto = Object.getPrototypeOf(value);
    return proto === Object.prototype || proto === null;
};

function scrubNode(node: unknown, ctx: TelemetryPrivacyContext, depth: number, seen: WeakSet<object>): unknown {
    if (typeof node === 'string') return looksLikeUrl(node) ? scrubUrl(node, ctx) : scrubText(node);
    if (!node || typeof node !== 'object' || depth > MAX_DEPTH || seen.has(node)) return node;
    seen.add(node);

    if (Array.isArray(node)) {
        for (let i = 0; i < node.length; i++) setIfChanged(node, i, node[i], scrubNode(node[i], ctx, depth + 1, seen));
        return node;
    }
    // Els esdeveniments i les molles de pa són objectes plans; una instància (un error, un objecte de la consola) no es toca.
    if (!isPlainObject(node)) return node;

    const record = node as Record<string, unknown>;
    for (const key of Object.keys(record)) {
        if (SKIP_KEYS.has(key)) continue;
        try {
            const descriptor = Object.getOwnPropertyDescriptor(record, key);
            if (!descriptor || !('value' in descriptor) || !descriptor.writable) continue;
            const value: unknown = descriptor.value;
            const next = typeof value === 'number' && NUMERIC_COORD_KEYS.has(key.toLowerCase())
                ? roundDegrees(value)
                : scrubNode(value, ctx, depth + 1, seen);
            setIfChanged(record, key, value, next);
        } catch {
            // Una clau que no es pot llegir o escriure es deixa com és: la resta de l'esdeveniment es continua netejant.
        }
    }
    return node;
}

function setIfChanged(target: unknown[] | Record<string, unknown>, key: number | string, before: unknown, after: unknown): void {
    if (before === after) return;
    try {
        (target as Record<string | number, unknown>)[key] = after;
    } catch {
        // Congelat: es deixa com és.
    }
}

/**
 * Les tres peces de Sentry (vegeu main.tsx): una integració per als esdeveniments (errors, traces i repeticions, amb
 * l'adreça de la pàgina que hi afegeix el SDK), el filtre de molles de pa (navegacions, peticions, consola; Replay ja les
 * rep netes) i el de la gravació de Replay (navegacions i peticions que desa pel seu compte).
 */
export const createSentryPrivacy = (ctx: TelemetryPrivacyContext) => ({
    integration: {
        name: 'MeteoaiPrivacy',
        processEvent: <E>(event: E): E => scrubTelemetry(event, ctx)
    },
    beforeBreadcrumb: <B>(breadcrumb: B): B => scrubTelemetry(breadcrumb, ctx),
    beforeAddRecordingEvent: <R>(event: R): R => scrubTelemetry(event, ctx)
});
