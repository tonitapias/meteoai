// src/utils/geoDistance.ts

/** Distància ortodròmica (km) entre dos punts. */
export const distanceKm = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const rad = Math.PI / 180;
    const dLat = (lat2 - lat1) * rad;
    const dLon = (lon2 - lon1) * rad;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLon / 2) ** 2;
    return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(a)));
};

/** Dos llocs a menys d'això són el mateix: el GPS dona coordenades una mica diferents cada cop; dos pobles, no. */
export const SAME_PLACE_KM = 1;

export interface PlaceRef {
    name?: string;
    latitude?: number;
    longitude?: number;
}

const hasCoords = (p: PlaceRef): p is PlaceRef & { latitude: number; longitude: number } =>
    Number.isFinite(p.latitude) && Number.isFinite(p.longitude);

/**
 * Si dos llocs són el mateix (favorits). Pel nom no n'hi ha prou: hi ha pobles diferents que es diuen igual (n'hi ha
 * molts a Catalunya) i el nom pot canviar amb l'idioma ("Londres" / "London"). Sense coordenades, es compara el nom.
 */
export const isSamePlace = (a: PlaceRef, b: PlaceRef): boolean => {
    if (hasCoords(a) && hasCoords(b)) return distanceKm(a.latitude, a.longitude, b.latitude, b.longitude) <= SAME_PLACE_KM;
    return !!a.name && a.name === b.name;
};
