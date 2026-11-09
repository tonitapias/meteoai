// src/services/lightningService.ts
//
// Llamps a prop de l'usuari, observats pel Lightning Imager de Meteosat-12
// (MTG): la mateixa capa que el radar (mtg_fd:li_afa, àrea de llamps
// acumulada en 5 min), però llegida píxel a píxel al voltant de la ubicació.
// La fan servir l'avís del tauler (LightningBanner) i la IA tàctica
// (geminiService: línia de telemetria i tallafocs).
//
// Mesurat 2026-10-19: franja nova cada 5 min, publicada ~12 min després de
// l'etiqueta (que marca l'inici dels 5 min); WMS anònim amb CORS obert.
// `image/png8` d'un quadre de 100 × 100 px pesa ~0,4–2 KB.
//
// A la resta d'Amèrica (on el radar dibuixa nowCOAST, AMERICAS_LIGHTNING_BOUNDS)
// es llegeix la densitat de llamps de NOAA nowCOAST (xarxes de terra NLDN i
// GLD360): finestres de 15 min etiquetades amb el final, 8 km per cel·la, WMS
// amb CORS obert (la capçalera `warning` no és llegible des del navegador:
// només es demanen finestres que les caps diuen que hi són).
import { eumetsatGetMap } from '../utils/eumetsatWms';
import { fetchWithTimeout } from '../utils/networkUtils';
import {
    AMERICAS_LIGHTNING_BOUNDS,
    AMERICAS_LIGHTNING_STEP_SEC,
    LIGHTNING_BOUNDS,
    LIGHTNING_STEP_SEC,
    LightningLatestSchema,
    SAT_PROXY_HOST
} from '../utils/radarPhysics';

/** Radi mostrejat al voltant de l'usuari. Tot el que s'hi detecti arriba a la IA. */
export const LIGHTNING_SAMPLE_RADIUS_KM = 50;
/**
 * Llamps "a prop": avís al tauler i tallafocs AMBER / CONVECTIVE. 30 km és el radi d'alerta habitual dels sistemes
 * de detecció de llamps (aeroports, esdeveniments a l'aire lliure); el tro se sent fins a uns 15 km.
 */
export const LIGHTNING_NEAR_KM = 30;
/** Llamps "molt a prop": l'avís passa a vermell (on cau el gruix de llamps de núvol a terra d'una tempesta). */
export const LIGHTNING_VERY_NEAR_KM = 10;

/** Franges de 5 min mirades enrere des de la més nova publicada (30 min). */
const LOOKBACK_SLOTS = 6;
/**
 * Mínim de píxels amb llamps dins el radi en una franja. Un llamp ja cobreix desenes de km² (l'àrea del seu flaix);
 * així es descarta un píxel solt a la vora del quadre o un esdeveniment espuri del sensor.
 */
const MIN_PIXELS = 4;
/** 1 km per píxel a la latitud de l'usuari: 100 × 100 px per al quadre de ±50 km. */
const SAMPLE_PX = LIGHTNING_SAMPLE_RADIUS_KM * 2;
/**
 * Llegenda d'EUMETSAT (llamps per píxel en 5 min, escala logarítmica d'1 a 20 o més, de groc pàl·lid a granat): el
 * taronja de 10 (#fd8339) té el verd a 0x83; per sota de 100 ja és vermell, és a dir 10 llamps o més.
 */
const INTENSE_GREEN_MAX = 100;

const LATEST_URL = `${SAT_PROXY_HOST}/lightning/latest`;
const AMERICAS_LATEST_URL = `${SAT_PROXY_HOST}/lightning/americas/latest`;
const NOWCOAST_LIGHTNING_WMS = 'https://nowcoast.noaa.gov/geoserver/lightning_detection/ldn_lightning_strike_density/ows';
/** Finestres de 15 min mirades enrere des de la més nova publicada (30 min). */
const NOWCOAST_LOOKBACK_WINDOWS = 2;
/**
 * Paleta de nowCOAST (GetStyles, 2026-11-09), de menys a més densitat (llamps/km²/min × 10³): 0,1 · 0,25 · 0,5 ·
 * 0,75 · 1 · 2,5 · 5 · 10 · 15 · 25 · 50 · 75 · 100 · 150 · 200 · 250 · 300.
 */
const NOWCOAST_CLASSES = ['ffffcc', 'ffec78', 'ffff00', 'ffd600', 'ffa400', 'ff7800', 'ff4500', 'ff0000', 'bc0025', 'cc0066', 'ff00ff', '800080', '4000c0', '0000ff', '00c7ff', '00a264', '00ff00'];
/**
 * Un sol llamp en una cel·la de 8 × 8 km en 15 min fa 1/(64 · 15) · 10³ ≈ 1,04: les cel·les d'1 o més tenen llamps.
 * Però nowCOAST difumina cada llamp sobre unes quantes cel·les (2026-11-09: el 32 % de 1.414 taques aïllades no
 * arribaven a 1 enlloc): la vora groga d'una taca no és on ha caigut, i mesurar-hi la distància l'avançaria ~8 km.
 */
const NOWCOAST_ONE_STRIKE_CLASS = 4;
/** 25 o més: el mateix quantil (~8 % dels píxels amb llamps) que l'"intens" de MTG sobre el Brasil. */
const NOWCOAST_INTENSE_CLASS = 9;
// El worker la serveix de l'edge (60 s) en ~0,1–0,3 s; si l'ha de llegir d'EUMETSAT, fins a uns pocs segons.
const LATEST_TIMEOUT_MS = 5000;
const SLOT_TIMEOUT_MS = 6000;
const CACHE_TTL_MS = 4 * 60 * 1000;
// Una consulta amb alguna franja sense llegir però amb llamps a les altres: val, però es torna a fer abans.
const PARTIAL_CACHE_TTL_MS = 60 * 1000;
// Fallades seguides (worker o EUMETSAT caiguts): 1, 2, 4... min sense tornar-ho a provar, fins a 10 min, perquè cada
// tauler obert no faci 7 peticions per minut indefinidament.
const FAILURE_BACKOFF_BASE_MS = 60 * 1000;
const FAILURE_BACKOFF_MAX_MS = 10 * 60 * 1000;
const EARTH_RADIUS_M = 6378137;

export interface LightningNearby {
    /** Distància al llamp més proper de la franja més nova amb activitat, en km. */
    nearestKm: number;
    /** Cap on és (0 = nord, 90 = est). */
    bearingDeg: number;
    /** Final d'aquella franja de 5 min (s): els minuts que fa es calculen en mostrar-ho (lightningMinutesAgo). */
    observedAt: number;
    /** Algun píxel dins el radi amb 10 llamps o més en 5 min. */
    intense: boolean;
    /** Franges (de 5 min, o de 15 a Amèrica) amb llamps dins el radi. */
    activeSlots: number;
    /** Qui els ha detectat: absent = el satèl·lit Meteosat-12 (MTG); 'nowcoast' = les xarxes de terra de la NOAA. */
    source?: 'nowcoast';
}

export type LightningSource = 'mtg' | 'nowcoast';

/** Píxels d'una franja: el més proper dins el cercle i si n'hi ha prou per comptar. */
export interface SlotAnalysis {
    nearestKm: number;
    bearingDeg: number;
    intense: boolean;
    pixels: number;
}

/** Dins el camp de visió del Lightning Imager (el mateix rectangle que la capa del radar). */
export const isInsideLightningCoverage = (lat: number, lon: number): boolean => {
    const [west, south, east, north] = LIGHTNING_BOUNDS;
    return lat >= south && lat <= north && lon >= west && lon <= east;
};

/** On el radar dibuixa nowCOAST (oest de 60° O, nord de 25° S); la línia de 60° O és de MTG. */
export const isInsideAmericasLightningCoverage = (lat: number, lon: number): boolean => {
    const [west, south, east, north] = AMERICAS_LIGHTNING_BOUNDS;
    return lat > south && lat <= north && lon >= west && lon < east;
};

/** Font de llamps d'una ubicació, la mateixa que dibuixa el radar; null si no en té cap. */
export const lightningSourceAt = (lat: number, lon: number): LightningSource | null =>
    isInsideAmericasLightningCoverage(lat, lon) ? 'nowcoast' : isInsideLightningCoverage(lat, lon) ? 'mtg' : null;

/**
 * Llegeix els píxels RGBA d'un quadre centrat a l'usuari (`kmPerPx` km per píxel; la fila 0 és el nord). Null si dins
 * el cercle de `radiusKm` hi ha menys de MIN_PIXELS píxels amb llamps.
 */
export const analyseLightningPixels = (
    data: Uint8ClampedArray,
    width: number,
    height: number,
    kmPerPx: number,
    radiusKm: number = LIGHTNING_SAMPLE_RADIUS_KM
): SlotAnalysis | null => {
    let best: { d: number; dx: number; dy: number } | null = null;
    let pixels = 0;
    let intense = false;
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const o = (y * width + x) * 4;
            if (data[o + 3] === 0) continue;
            const dx = (x + 0.5 - width / 2) * kmPerPx;
            const dy = (y + 0.5 - height / 2) * kmPerPx;
            const d = Math.hypot(dx, dy);
            if (d > radiusKm) continue;
            pixels++;
            if (data[o + 1] < INTENSE_GREEN_MAX) intense = true;
            if (!best || d < best.d) best = { d, dx, dy };
        }
    }
    if (!best || pixels < MIN_PIXELS) return null;
    const bearingDeg = (Math.atan2(best.dx, -best.dy) * 180 / Math.PI + 360) % 360;
    return { nearestKm: Math.round(best.d), bearingDeg: Math.round(bearingDeg), intense, pixels };
};

/** Classe de nowCOAST d'un píxel opac (NOWCOAST_CLASSES); un color desconegut compta com a llamp segur. */
const nowcoastClassOf = (r: number, g: number, b: number): number => {
    const hex = ((r << 16) | (g << 8) | b).toString(16).padStart(6, '0');
    const index = NOWCOAST_CLASSES.indexOf(hex);
    return index >= 0 ? index : NOWCOAST_ONE_STRIKE_CLASS;
};

/**
 * Com analyseLightningPixels, per a la densitat de nowCOAST. Cada taca (píxels opacs units) es mesura on hi ha
 * llamps de veritat: a les cel·les d'1 o més si en té; si no (un llamp aïllat, difuminat), al seu pic. Intens: 25 o
 * més dins el cercle.
 */
export const analyseNowcoastPixels = (
    data: Uint8ClampedArray,
    width: number,
    height: number,
    kmPerPx: number,
    radiusKm: number = LIGHTNING_SAMPLE_RADIUS_KM
): SlotAnalysis | null => {
    const n = width * height;
    const cls = new Int8Array(n).fill(-1);
    for (let i = 0; i < n; i++) {
        const o = i * 4;
        if (data[o + 3] !== 0) cls[i] = nowcoastClassOf(data[o], data[o + 1], data[o + 2]);
    }
    // Taques (veïnatge de 4) i la classe més alta de cadascuna.
    const label = new Int32Array(n).fill(-1);
    const peak: number[] = [];
    const stack: number[] = [];
    for (let i = 0; i < n; i++) {
        if (cls[i] < 0 || label[i] >= 0) continue;
        const id = peak.length;
        let max = cls[i];
        label[i] = id;
        stack.push(i);
        while (stack.length) {
            const j = stack.pop()!;
            if (cls[j] > max) max = cls[j];
            const x = j % width;
            const neighbours = [x > 0 ? j - 1 : -1, x < width - 1 ? j + 1 : -1, j - width, j + width];
            for (const k of neighbours) {
                if (k < 0 || k >= n || cls[k] < 0 || label[k] >= 0) continue;
                label[k] = id;
                stack.push(k);
            }
        }
        peak.push(max);
    }

    let best: { d: number; dx: number; dy: number } | null = null;
    let pixels = 0;
    let intense = false;
    for (let i = 0; i < n; i++) {
        if (cls[i] < 0) continue;
        const dx = ((i % width) + 0.5 - width / 2) * kmPerPx;
        const dy = (Math.floor(i / width) + 0.5 - height / 2) * kmPerPx;
        const d = Math.hypot(dx, dy);
        if (d > radiusKm) continue;
        pixels++;
        if (cls[i] >= NOWCOAST_INTENSE_CLASS) intense = true;
        const top = peak[label[i]];
        const strike = top >= NOWCOAST_ONE_STRIKE_CLASS ? cls[i] >= NOWCOAST_ONE_STRIKE_CLASS : cls[i] === top;
        if (strike && (!best || d < best.d)) best = { d, dx, dy };
    }
    if (!best || pixels < MIN_PIXELS) return null;
    const bearingDeg = (Math.atan2(best.dx, -best.dy) * 180 / Math.PI + 360) % 360;
    return { nearestKm: Math.round(best.d), bearingDeg: Math.round(bearingDeg), intense, pixels };
};

/**
 * Combina les franges mirades (de la més nova a la més antiga): distància i hora de la franja més nova amb activitat.
 * `slots[i]`: etiqueta de la franja; `analyses[i]`: la seva lectura (null = sense llamps o sense dades). `source`:
 * MTG etiqueta l'inici dels 5 min (l'observació acaba 5 min després); nowCOAST, el final dels 15.
 */
export const summariseLightning = (slots: number[], analyses: (SlotAnalysis | null)[], source: LightningSource = 'mtg'): LightningNearby | null => {
    let newest: { slot: number; a: SlotAnalysis } | null = null;
    let activeSlots = 0;
    let intense = false;
    analyses.forEach((a, i) => {
        if (!a) return;
        activeSlots++;
        intense = intense || a.intense;
        if (!newest || slots[i] > newest.slot) newest = { slot: slots[i], a };
    });
    if (!newest) return null;
    const { slot, a } = newest as { slot: number; a: SlotAnalysis };
    return {
        nearestKm: a.nearestKm,
        bearingDeg: a.bearingDeg,
        observedAt: source === 'nowcoast' ? slot : slot + LIGHTNING_STEP_SEC,
        intense,
        activeSlots,
        ...(source === 'nowcoast' ? { source } : {})
    };
};

/** Minuts des de l'observació (mai negatius). */
export const lightningMinutesAgo = (l: LightningNearby, nowMs: number): number =>
    Math.max(0, Math.round((nowMs / 1000 - l.observedAt) / 60));

const toIso = (sec: number) => new Date(sec * 1000).toISOString().replace('.000Z', 'Z');

/** Quadre EPSG:3857 de ±radi al voltant del punt (Mercator s'estira 1/cos(lat)). */
const sampleBbox = (lat: number, lon: number): string => {
    const x = EARTH_RADIUS_M * lon * Math.PI / 180;
    const y = EARTH_RADIUS_M * Math.log(Math.tan(Math.PI / 4 + lat * Math.PI / 360));
    const half = (LIGHTNING_SAMPLE_RADIUS_KM * 1000) / Math.cos(lat * Math.PI / 180);
    return [x - half, y - half, x + half, y + half].map((v) => v.toFixed(0)).join(',');
};

/** Píxels RGBA d'una imatge (PNG de paleta inclòs). Null si no es pot descodificar. */
async function decodeImage(blob: Blob): Promise<{ data: Uint8ClampedArray; width: number; height: number } | null> {
    try {
        const bitmap = await createImageBitmap(blob);
        const canvas = document.createElement('canvas');
        canvas.width = bitmap.width;
        canvas.height = bitmap.height;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) return null;
        ctx.drawImage(bitmap, 0, 0);
        bitmap.close?.();
        const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
        return { data, width: canvas.width, height: canvas.height };
    } catch {
        return null;
    }
}

/**
 * Lectura d'una franja: null = sense llamps (o franja encara no publicada); undefined = no s'ha pogut llegir (error,
 * timeout, o una altra ServiceException de GeoServer, com les transitòries "Unable to obtain connection").
 */
async function analyseSlot(lat: number, lon: number, slot: number, source: LightningSource): Promise<SlotAnalysis | null | undefined> {
    const area = `&styles=&crs=EPSG:3857&bbox=${sampleBbox(lat, lon)}&width=${SAMPLE_PX}&height=${SAMPLE_PX}`;
    const url = source === 'nowcoast'
        ? `${NOWCOAST_LIGHTNING_WMS}?service=WMS&version=1.3.0&request=GetMap&layers=ldn_lightning_strike_density${area}&format=image/png&transparent=true&time=${toIso(slot)}`
        : `${eumetsatGetMap('mtg_fd:li_afa')}${area}&format=image/png8&transparent=true&time=${toIso(slot)}`;
    try {
        const response = await fetchWithTimeout(url, SLOT_TIMEOUT_MS);
        if (!response.ok) return undefined;
        if (!(response.headers.get('Content-Type') ?? '').startsWith('image/')) {
            // Franja d'EUMETSAT encara no publicada: 200 amb XML InvalidDimensionValue.
            return (await response.text()).includes('InvalidDimensionValue') ? null : undefined;
        }
        const image = await decodeImage(await response.blob());
        if (!image) return undefined;
        const analyse = source === 'nowcoast' ? analyseNowcoastPixels : analyseLightningPixels;
        return analyse(image.data, image.width, image.height, (LIGHTNING_SAMPLE_RADIUS_KM * 2) / image.width);
    } catch {
        return undefined;
    }
}

/**
 * Franja més nova del worker. `null`: el Lightning Imager va endarrerit més d'1 h (resposta vàlida); `undefined`: no
 * s'ha pogut consultar, o el worker no ha pogut llegir les caps i dona una hora calculada (ara − 30 min): mirar-hi
 * donaria llamps de fa 30–60 min com si fossin dels "darrers 30 min". Millor no dir res que dir "cap llamp" d'una
 * hora que potser no existeix.
 */
async function loadLatestSlot(source: LightningSource): Promise<number | null | undefined> {
    try {
        const response = await fetchWithTimeout(source === 'nowcoast' ? AMERICAS_LATEST_URL : LATEST_URL, LATEST_TIMEOUT_MS);
        if (!response.ok) return undefined;
        const parsed = LightningLatestSchema.safeParse(await response.json());
        if (!parsed.success) return undefined;
        if (parsed.data === null) return null;
        return parsed.data.source === 'caps' ? parsed.data.latest : undefined;
    } catch {
        return undefined;
    }
}

/** Resultat d'una consulta: `undefined` = no s'ha pogut fer (qui la crida es queda amb el que ja sabia). */
export type LightningCheck = LightningNearby | null | undefined;

const cache = new Map<string, { promise: Promise<LightningCheck>; expiresAt: number }>();
const failures = new Map<string, { count: number; retryAt: number }>();

/**
 * Llamps dins LIGHTNING_SAMPLE_RADIUS_KM durant els últims 30 min (6 franges de MTG o, a Amèrica, 2 finestres de
 * nowCOAST): el resultat, null si no n'hi ha o si la ubicació no té cap font, o undefined si no s'ha pogut consultar.
 * - Una consulta feta es comparteix 4 min per ubicació (dues xifres decimals): el tauler i la IA no dupliquen
 *   peticions. Si alguna franja no s'ha pogut llegir però les altres tenen llamps, només 1 min.
 * - Si alguna franja no s'ha pogut llegir i les altres no tenen llamps, no és "cap llamp" (potser eren a la que ha
 *   fallat): es tracta com una fallada.
 * - Les fallades no es desen i, seguides, esperen 1, 2, 4... min (fins a 10) abans de tornar-ho a provar.
 */
export function getLightningNearby(lat: number, lon: number): Promise<LightningCheck> {
    const source = lightningSourceAt(lat, lon);
    if (!source) return Promise.resolve(null);
    // Sense createImageBitmap (navegadors molt antics) no es poden llegir els píxels: cap petició.
    if (typeof createImageBitmap !== 'function') return Promise.resolve(null);
    const key = `${lat.toFixed(2)},${lon.toFixed(2)}`;
    const now = Date.now();
    const hit = cache.get(key);
    if (hit && hit.expiresAt > now) return hit.promise;
    for (const [k, entry] of cache) if (entry.expiresAt <= now) cache.delete(k);
    const failure = failures.get(key);
    if (failure && failure.retryAt > now) return Promise.resolve(undefined);

    const entry = { promise: Promise.resolve<LightningCheck>(undefined), expiresAt: now + CACHE_TTL_MS };
    const failed = (): undefined => {
        if (cache.get(key) === entry) cache.delete(key);
        const count = (failures.get(key)?.count ?? 0) + 1;
        failures.set(key, { count, retryAt: Date.now() + Math.min(FAILURE_BACKOFF_BASE_MS * 2 ** (count - 1), FAILURE_BACKOFF_MAX_MS) });
        return undefined;
    };
    entry.promise = (async () => {
        const latest = await loadLatestSlot(source);
        if (latest === undefined) return failed();
        failures.delete(key);
        if (latest === null) return null;
        const [count, step] = source === 'nowcoast'
            ? [NOWCOAST_LOOKBACK_WINDOWS, AMERICAS_LIGHTNING_STEP_SEC]
            : [LOOKBACK_SLOTS, LIGHTNING_STEP_SEC];
        const slots = Array.from({ length: count }, (_, i) => latest - i * step);
        const analyses = await Promise.all(slots.map((slot) => analyseSlot(lat, lon, slot, source)));
        const summary = summariseLightning(slots, analyses.map((a) => a ?? null), source);
        if (analyses.some((a) => a === undefined)) {
            if (!summary) return failed();
            entry.expiresAt = Date.now() + PARTIAL_CACHE_TTL_MS;
        }
        return summary;
    })();
    cache.set(key, entry);
    return entry.promise;
}

/** Rumb de 8 punts: 0 = nord, 1 = nord-est... 7 = nord-oest. */
export const compassIndex = (bearingDeg: number): number => Math.round((((bearingDeg % 360) + 360) % 360) / 45) % 8;

const COMPASS_PHRASE_CA = ['al nord', 'al nord-est', "a l'est", 'al sud-est', 'al sud', 'al sud-oest', "a l'oest", 'al nord-oest'];
/** "al sud-oest", per a la telemetria de la IA (que sempre va en català). */
export const compassPhraseCa = (bearingDeg: number): string => COMPASS_PHRASE_CA[compassIndex(bearingDeg)];

/** Només per als tests. */
export const clearLightningCache = () => {
    cache.clear();
    failures.clear();
};

/**
 * Banda de distància per a les claus de la IA (l0 = cap llamp; l1 = 10 km o menys, l2 = fins a 20... l5 = fins a 50):
 * un canvi de banda torna a demanar l'anàlisi, així que el text no queda més de 10 km enrere d'una tempesta que s'acosta.
 */
export const lightningBand = (l: LightningNearby | null): string =>
    !l ? 'l0' : `l${Math.min(5, Math.max(1, Math.ceil(l.nearestKm / 10)))}`;
