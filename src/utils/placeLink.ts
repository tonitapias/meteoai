// src/utils/placeLink.ts
// Enllaç d'un lloc: `?lat=41.98&lon=2.82&nom=Girona&pais=Espanya` obre directament el tauler d'aquell lloc (vegeu
// hooks/usePlaceLink.ts). No hi ha servidor ni router: la URL només la llegeix l'app en arrencar.

/**
 * Noms dels paràmetres de la URL (en català, com la resta de l'app). `origen=gps`: l'enllaç és la posició de qui l'ha
 * enviat (amb el GPS), no un lloc consultat; qui l'obre veu "Posició compartida" i els botons de Google Maps.
 */
export const PLACE_PARAMS = { lat: 'lat', lon: 'lon', name: 'nom', country: 'pais', origin: 'origen' } as const;
const POSITION_ORIGIN_VALUE = 'gps';

const PLACE_PARAM_KEYS: readonly string[] = Object.values(PLACE_PARAMS);

/** L'enllaç diu on és el lloc tan exactament com es pot: 5 decimals (~1 m), també amb la posició del GPS. */
const LINK_COORD_FACTOR = 100000;

const roundCoord = (value: number, factor: number): number => {
    const rounded = Math.round(value * factor) / factor;
    return rounded === 0 ? 0 : rounded; // sense "-0" a la URL
};

export const roundLinkCoord = (value: number): number => roundCoord(value, LINK_COORD_FACTOR);

/** "Comparteix només el temps d'aquí": 2 decimals (~1 km), prou per a la previsió i sense dir on és l'usuari. */
const APPROX_COORD_FACTOR = 100;

/** Un nom més llarg que això no és un poble: és un enllaç fet a mà. */
const MAX_NAME_LENGTH = 80;

/**
 * Noms que no són cap lloc: el sentinel del GPS (GeoLocationContext) i les respostes de reserva de la geocodificació
 * inversa (geocodingService / weatherService). No van a l'enllaç: sense `nom`, qui l'obre fa la seva pròpia
 * geocodificació inversa i en veu el nom real en el seu idioma.
 */
const PLACEHOLDER_NAMES = new Set(['La Meva Ubicació', 'Ubicació actual', 'Ubicació desconeguda']);
const PLACEHOLDER_COUNTRIES = new Set(['Local']);

export interface LinkedPlace {
    lat: number;
    lon: number;
    name?: string;
    country?: string;
    /** L'enllaç porta `origen=gps`: és la posició d'algú altre. */
    sharedPosition?: boolean;
}

/** El lloc a pantalla (weatherData.location). */
export interface PlaceOnScreen {
    name?: string;
    country?: string;
    latitude?: number;
    longitude?: number;
}

// Només xifres: `Number()` també accepta "", " ", "1e2" o "0x10", que no són cap coordenada. Coma o punt decimal
// (algú que l'escriu a mà en català).
const COORD_PATTERN = /^[+-]?\d{1,3}(?:[.,]\d{1,12})?$/;

const parseCoord = (raw: string | null, limit: number): number | null => {
    if (raw === null) return null;
    const text = raw.trim();
    if (!COORD_PATTERN.test(text)) return null;
    const value = Number(text.replace(',', '.'));
    return Number.isFinite(value) && Math.abs(value) <= limit ? value : null;
};

// Caràcters de control i de format (inclosos els que giren la direcció del text, que farien veure un altre nom).
// eslint-disable-next-line no-control-regex
const INVISIBLE_CHARS = /[\u0000-\u001F\u007F-\u009F\u00AD\u200B-\u200F\u202A-\u202E\u2060-\u2069\uFEFF]/g;

/** Text d'un nom de la URL, net; undefined si no en queda res o és un dels marcadors de "sense nom". */
const cleanText = (raw: string | null | undefined, placeholders: Set<string>): string | undefined => {
    if (typeof raw !== 'string') return undefined;
    // Primer els espais (un salt de línia separa paraules), després la resta d'invisibles.
    const text = raw.replace(/\s+/g, ' ').replace(INVISIBLE_CHARS, '').trim();
    if (!text || placeholders.has(text)) return undefined;
    // Per punts de codi (Array.from), per no partir un caràcter fora del pla bàsic.
    const chars = Array.from(text);
    return chars.length > MAX_NAME_LENGTH ? chars.slice(0, MAX_NAME_LENGTH).join('').trim() : text;
};

/** Si la URL porta algun paràmetre de lloc (vàlid o no). */
export const hasPlaceParams = (search: string): boolean => {
    const params = new URLSearchParams(search);
    return PLACE_PARAM_KEYS.some((key) => params.has(key));
};

/**
 * El lloc de la URL, o null si no n'hi ha cap de vàlid: sense lat/lon, amb text que no és un número o fora de rang
 * (lat ±90, lon ±180). El nom i el país són opcionals.
 */
export const readPlaceFromSearch = (search: string): LinkedPlace | null => {
    const params = new URLSearchParams(search);
    const lat = parseCoord(params.get(PLACE_PARAMS.lat), 90);
    const lon = parseCoord(params.get(PLACE_PARAMS.lon), 180);
    if (lat === null || lon === null) return null;

    const place: LinkedPlace = { lat, lon };
    const name = cleanText(params.get(PLACE_PARAMS.name), PLACEHOLDER_NAMES);
    const country = cleanText(params.get(PLACE_PARAMS.country), PLACEHOLDER_COUNTRIES);
    if (name) place.name = name;
    if (country) place.country = country;
    if (params.get(PLACE_PARAMS.origin) === POSITION_ORIGIN_VALUE) place.sharedPosition = true;
    return place;
};

const hasCoords = <T extends PlaceOnScreen>(place: T | null | undefined): place is T & { latitude: number; longitude: number } =>
    !!place && Number.isFinite(place.latitude) && Number.isFinite(place.longitude);

/**
 * La cerca (`?…`) amb el lloc posat, o sense cap paràmetre de lloc si `place` és null. Conserva els altres paràmetres
 * que hi hagi (p. ex. `utm_*`). Torna '' si no en queda cap. `markPosition` hi afegeix `origen=gps`.
 */
export const writePlaceToSearch = (search: string, place: PlaceOnScreen | null, markPosition = false): string => {
    const params = new URLSearchParams(search);
    PLACE_PARAM_KEYS.forEach((key) => params.delete(key));

    if (hasCoords(place)) {
        params.set(PLACE_PARAMS.lat, String(roundLinkCoord(place.latitude)));
        params.set(PLACE_PARAMS.lon, String(roundLinkCoord(place.longitude)));
        const name = cleanText(place.name, PLACEHOLDER_NAMES);
        const country = cleanText(place.country, PLACEHOLDER_COUNTRIES);
        if (name) params.set(PLACE_PARAMS.name, name);
        if (country) params.set(PLACE_PARAMS.country, country);
        if (markPosition) params.set(PLACE_PARAMS.origin, POSITION_ORIGIN_VALUE);
    }

    const text = params.toString();
    return text ? `?${text}` : '';
};

/**
 * Enllaç per compartir el lloc: l'adreça de l'app (origen + camí) amb només els paràmetres del lloc. Sense el hash
 * d'un modal obert (`#modal-…`) ni cap altre paràmetre de la URL actual. Amb una posició (la pròpia o una de rebuda),
 * `origen=gps`.
 */
export const buildPlaceLink = (currentHref: string, place: PlaceOnScreen & { origin?: PlaceOrigin }): string | null => {
    if (!hasCoords(place)) return null;
    const url = new URL(currentHref);
    return `${url.origin}${url.pathname}${writePlaceToSearch('', place, isPositionOrigin(place.origin))}`;
};

/** El nom del lloc per al text de compartir, o undefined si és un marcador de "sense nom". */
export const placeDisplayName = (place: PlaceOnScreen): string | undefined => cleanText(place.name, PLACEHOLDER_NAMES);

/**
 * Com s'ha triat el lloc a pantalla: 'gps' = la posició de l'usuari ("Utilitza la meva ubicació" o el botó de localitzar
 * de la capçalera); 'sharedPosition' = la posició d'algú altre, rebuda amb un enllaç `origen=gps`; 'consulted' = un
 * lloc consultat (cercador, favorit, enllaç d'un lloc), encara que sigui a tocar d'on és l'usuari.
 */
export type PlaceOrigin = 'gps' | 'sharedPosition' | 'consulted';

/** Si el lloc és una posició (la pròpia o una de rebuda): el missatge porta les coordenades i l'enllaç porta origen=gps. */
export const isPositionOrigin = (origin: PlaceOrigin | undefined): boolean => origin === 'gps' || origin === 'sharedPosition';

/** El lloc tal com s'ha demanat (vegeu useWeather.loadedPlace). */
export interface LoadedPlace {
    lat: number;
    lon: number;
    name?: string;
    country?: string;
    origin: PlaceOrigin;
}

/** El lloc de l'enllaç i del missatge de compartir. */
export interface SharedPlace extends PlaceOnScreen {
    latitude: number;
    longitude: number;
    origin: PlaceOrigin;
}

/**
 * El lloc per a la URL i per compartir. Les coordenades són sempre les demanades (`loaded`, p. ex. les del GPS), no les
 * de les dades a pantalla: la cau es desa per coordenades a 4 decimals (el paquet pot ser d'uns metres més enllà) i una
 * previsió desada pot ser d'un altre punt fins a 20 km (OFFLINE_SNAPSHOT.MAX_DISTANCE_KM). El nom sí que és el de
 * pantalla (el de la geocodificació inversa amb el GPS), tret que sigui el d'aquest altre punt.
 */
export const placeForLink = (
    loaded: LoadedPlace | null,
    shown: PlaceOnScreen | null | undefined,
    shownIsElsewhere: boolean
): SharedPlace | null => {
    if (!loaded) {
        // Sense lloc demanat no hi ha res a pantalla; per si de cas, el de les dades, com a lloc consultat.
        return hasCoords(shown) ? { ...shown, origin: 'consulted' } : null;
    }
    const nameSource = shown && !shownIsElsewhere ? shown : null;
    return {
        latitude: loaded.lat,
        longitude: loaded.lon,
        name: cleanText(nameSource?.name, PLACEHOLDER_NAMES) ?? cleanText(loaded.name, PLACEHOLDER_NAMES),
        country: cleanText(nameSource?.country, PLACEHOLDER_COUNTRIES) ?? cleanText(loaded.country, PLACEHOLDER_COUNTRIES),
        origin: loaded.origin
    };
};

/**
 * La posició del GPS convertida en "el temps d'aquí": coordenades a ~1 km i lloc consultat (sense origen=gps), perquè
 * qui rep l'enllaç vegi el temps del poble però no on és exactament qui l'envia.
 */
export const approximatePlace = (place: SharedPlace): SharedPlace => ({
    ...place,
    latitude: roundCoord(place.latitude, APPROX_COORD_FACTOR),
    longitude: roundCoord(place.longitude, APPROX_COORD_FACTOR),
    origin: 'consulted'
});

// Text i mapes: sempre 5 decimals i punt decimal, sigui quin sigui l'idioma (és el format dels mapes, i amb coma
// decimal no es distingiria la latitud de la longitud).
const coordText = (value: number): string => roundLinkCoord(value).toFixed(5);

/** "41.98315, 2.82493" */
export const formatCoordsText = (lat: number, lon: number): string => `${coordText(lat)}, ${coordText(lon)}`;

/** Enllaç de Google Maps (Maps URLs, sense clau) que marca el punt. */
export const googleMapsLink = (lat: number, lon: number): string =>
    `https://www.google.com/maps/search/?api=1&query=${coordText(lat)},${coordText(lon)}`;

/** Enllaç de Google Maps amb la ruta fins al punt (des d'on és qui l'obre). */
export const googleMapsDirectionsLink = (lat: number, lon: number): string =>
    `https://www.google.com/maps/dir/?api=1&destination=${coordText(lat)},${coordText(lon)}`;
