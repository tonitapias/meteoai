// src/utils/planetNav.ts
// Les pantalles del detall d'«Extrems del planeta» i com s'hi arriba. És una pila: la llista (amb les dues
// pestanyes), les fitxes (d'un rècord o d'un cicló) i el visor orbital, que s'obre des de qualsevol. Cada pantalla
// que s'hi afegeix és un pas de l'historial (vegeu usePlanetNavigation): el botó «enrere» del mòbil en treu una.
import type { PlanetTab, RecordKey } from './planetExtremes';
import type { OrbitEye } from './orbitalView';

export type PlanetView =
    | { kind: 'list'; tab: PlanetTab }
    | { kind: 'record'; record: RecordKey }
    | { kind: 'cyclone'; id: string }
    | { kind: 'orbit'; eye: OrbitEye };

/** Amb què s'obre el detall: la llista o directament una fitxa (des de la targeta o des de la Vista essencial). */
export type PlanetEntry = Exclude<PlanetView, { kind: 'orbit' }>;

/** La icona del xip del protagonista a la Vista essencial: el tipus de fenomen. */
export type PlanetHeadlineIcon = 'cyclone' | 'heat' | 'flood' | 'fire' | 'volcano' | 'wind' | 'pressure';

/**
 * La pila amb què s'obre: una fitxa sempre té la llista a sota, perquè «enrere» porti a la resta de rècords o
 * de fenòmens abans de tancar.
 */
export function initialPlanetStack(entry: PlanetEntry): PlanetView[] {
    switch (entry.kind) {
        case 'record': return [{ kind: 'list', tab: 'records' }, entry];
        case 'cyclone': return [{ kind: 'list', tab: 'events' }, entry];
        default: return [entry];
    }
}
