// src/services/planetExtremesApi.ts
// Dades de la secció «Més enllà del teu cel» de la Vista completa: els rècords d'ara mateix de les
// estacions de tot el món i els fenòmens extrems actius. Les agrega el worker (/planet-extremes) a
// partir dels METAR de la NOAA, de GDACS i de NASA EONET (vegeu src/planetExtremes.ts al repositori
// meteoai-proxy), que ja hi fa el control de qualitat. Aquí només es valida la forma de la resposta.
import { fetchWithTimeout } from '../utils/networkUtils';
import { GEMINI_PROXY_URL } from '../constants/aiConfig';

export interface StationRecord {
    id: string;
    name: string | null;
    country: string | null;
    lat: number;
    lon: number;
    elevM: number | null;
    time: string;
    value: number;
    tempC?: number;
    dewC?: number;
}

export interface MetarRecords {
    updatedAt: string;
    stations: number;
    discarded: number;
    hottest: StationRecord[];
    coldest: StationRecord[];
    wetBulb: StationRecord[];
    gustKmh: StationRecord[];
    lowPressure: StationRecord[];
}

export interface CycloneTrackPoint {
    time: string;
    lat: number;
    lon: number;
    windKt: number;
}

export interface ActiveCyclone {
    id: string;
    name: string;
    source: string | null;
    track: CycloneTrackPoint[];
}

export interface CountryCount {
    country: string;
    count: number;
    // Centre dels esdeveniments del país, per al visor orbital (un worker anterior no el dona).
    lat?: number;
    lon?: number;
}

export interface Volcano {
    name: string;
    country: string | null;
    lat?: number;
    lon?: number;
}

export interface PlanetEvents {
    updatedAt: string;
    fires: {
        count: number;
        byCountry: CountryCount[];
        largest: { country: string | null; hectares: number; lat: number; lon: number } | null;
    };
    floods: { count: number; byCountry: CountryCount[] };
    volcanoes: Volcano[];
}

export interface PlanetExtremes {
    // Cada bloc pot ser null: la font ha caigut sense còpia o el worker encara l'estava refrescant.
    metar: MetarRecords | null;
    events: PlanetEvents | null;
    cyclones: { updatedAt: string; cyclones: ActiveCyclone[] } | null;
}

const PLANET_EXTREMES_URL = `${GEMINI_PROXY_URL}/planet-extremes`;
// El worker respon com a molt en ~4,5 s (si una font va lenta, serveix la còpia que té).
const TIMEOUT_MS = 8000;
// El worker refresca cada 30 min: no cal tornar-ho a demanar cada cop que es torna a la Vista completa.
const CACHE_MS = 15 * 60 * 1000;

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const str = (v: unknown): string | null => (typeof v === 'string' && v !== '' ? v : null);
const list = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);

const toStation = (v: unknown): StationRecord | null => {
    if (!isObject(v) || !str(v.id) || !isNum(v.lat) || !isNum(v.lon) || !isNum(v.value) || !str(v.time)) return null;
    return {
        id: v.id as string,
        name: str(v.name),
        country: str(v.country),
        lat: v.lat,
        lon: v.lon,
        elevM: isNum(v.elevM) ? v.elevM : null,
        time: v.time as string,
        value: v.value,
        ...(isNum(v.tempC) ? { tempC: v.tempC } : {}),
        ...(isNum(v.dewC) ? { dewC: v.dewC } : {}),
    };
};

const stations = (v: unknown): StationRecord[] => list(v).map(toStation).filter((s): s is StationRecord => s !== null);

const position = (v: Record<string, unknown>): { lat: number; lon: number } | Record<string, never> =>
    isNum(v.lat) && isNum(v.lon) && Math.abs(v.lat) <= 90 && Math.abs(v.lon) <= 180 ? { lat: v.lat, lon: v.lon } : {};

const countryCounts = (v: unknown): CountryCount[] =>
    list(v)
        .filter((c): c is Record<string, unknown> => isObject(c) && !!str(c.country) && isNum(c.count))
        .map((c) => ({ country: c.country as string, count: c.count as number, ...position(c) }));

const toMetar = (v: unknown): MetarRecords | null => {
    if (!isObject(v) || !str(v.updatedAt) || !isNum(v.stations)) return null;
    return {
        updatedAt: v.updatedAt as string,
        stations: v.stations,
        discarded: isNum(v.discarded) ? v.discarded : 0,
        hottest: stations(v.hottest),
        coldest: stations(v.coldest),
        wetBulb: stations(v.wetBulb),
        gustKmh: stations(v.gustKmh),
        lowPressure: stations(v.lowPressure),
    };
};

const toEvents = (v: unknown): PlanetEvents | null => {
    if (!isObject(v) || !str(v.updatedAt) || !isObject(v.fires) || !isObject(v.floods)) return null;
    const largest = v.fires.largest;
    return {
        updatedAt: v.updatedAt as string,
        fires: {
            count: isNum(v.fires.count) ? v.fires.count : 0,
            byCountry: countryCounts(v.fires.byCountry),
            largest: isObject(largest) && isNum(largest.hectares) && isNum(largest.lat) && isNum(largest.lon)
                ? { country: str(largest.country), hectares: largest.hectares, lat: largest.lat, lon: largest.lon }
                : null,
        },
        floods: { count: isNum(v.floods.count) ? v.floods.count : 0, byCountry: countryCounts(v.floods.byCountry) },
        volcanoes: list(v.volcanoes)
            .filter((x): x is Record<string, unknown> => isObject(x) && !!str(x.name))
            .map((x) => ({ name: x.name as string, country: str(x.country), ...position(x) })),
    };
};

const toCyclone = (v: unknown): ActiveCyclone | null => {
    if (!isObject(v) || !str(v.id) || !str(v.name)) return null;
    const track = list(v.track)
        .filter((p): p is CycloneTrackPoint => isObject(p) && !!str(p.time) && isNum(p.lat) && isNum(p.lon) && isNum(p.windKt))
        .map((p) => ({ time: p.time, lat: p.lat, lon: p.lon, windKt: p.windKt }));
    if (track.length === 0) return null;
    return { id: v.id as string, name: v.name as string, source: str(v.source), track };
};

export const normalizePlanetExtremes = (raw: unknown): PlanetExtremes => {
    const body = isObject(raw) ? raw : {};
    const cyclones = isObject(body.cyclones) && str(body.cyclones.updatedAt)
        ? {
            updatedAt: body.cyclones.updatedAt as string,
            cyclones: list(body.cyclones.cyclones).map(toCyclone).filter((c): c is ActiveCyclone => c !== null),
        }
        : null;
    return { metar: toMetar(body.metar), events: toEvents(body.events), cyclones };
};

export const isComplete = (data: PlanetExtremes): boolean => !!(data.metar && data.events && data.cyclones);

let cached: { at: number; data: PlanetExtremes } | null = null;
let inFlight: Promise<PlanetExtremes> | null = null;

/**
 * La targeta i el detall en fan servir la mateixa resposta: una sola petició (compartida si arriben
 * alhora) i 15 min de memòria. Una resposta incompleta no es desa, perquè la següent ja la tindrà sencera.
 */
export const fetchPlanetExtremes = (): Promise<PlanetExtremes> => {
    if (cached && Date.now() - cached.at < CACHE_MS) return Promise.resolve(cached.data);
    if (inFlight) return inFlight;
    inFlight = (async () => {
        try {
            const response = await fetchWithTimeout(PLANET_EXTREMES_URL, TIMEOUT_MS);
            if (!response.ok) throw new Error(`Planet extremes proxy error: ${response.status}`);
            const data = normalizePlanetExtremes(await response.json());
            if (isComplete(data)) cached = { at: Date.now(), data };
            return data;
        } finally {
            inFlight = null;
        }
    })();
    return inFlight;
};

/** Només per a les proves. */
export const resetPlanetExtremesCache = (): void => {
    cached = null;
    inFlight = null;
};
