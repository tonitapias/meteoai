// src/utils/addressMove.ts
// La mudança de tonitapias.github.io/meteoai a meteotoniai.com (octubre del 2026). Per al navegador són dos orígens
// diferents: els favorits i les preferències desats a l'adreça antiga no es veuen des de la nova. L'avís de l'adreça
// antiga (AddressMoveNotice) els hi porta dins el fragment de l'enllaç (#migra=…), que no arriba mai a cap servidor, i
// la nova els desa en arrencar (main.tsx), abans que Sentry o les estadístiques llegeixin l'adreça, i el treu de seguida.
// Qualsevol pot fabricar un enllaç així: tot el que entra es valida i els favorits se sumen, mai no en substitueixen.
import { readStorage, writeStorage } from './safeStorage';
import { isSamePlace } from './geoDistance';
import { SECRET_IDS } from './welcome/secretsFound';
import type { LocationData } from '../hooks/usePreferences';

export const NEW_ADDRESS = 'https://meteotoniai.com/';
export const OLD_HOSTNAME = 'tonitapias.github.io';
export const MOVE_FRAGMENT = '#migra=';

// Fins que no s'hagi provat el pont en mòbils reals, l'avís només surt a l'adreça antiga amb ?pont=1.
export const MOVE_NOTICE_LIVE = false;
export const MOVE_TEST_PARAM = 'pont';

const FAVORITES_KEY = 'meteoai_favorites';
const SECRETS_KEY = 'meteoai_secrets_found';
const MAX_FAVORITES = 50;

// Preferències d'un sol valor: clau del navegador, camp de l'enllaç i valors acceptats.
const SETTINGS = [
  { key: 'meteoai_lang', field: 'lang', allowed: ['ca', 'es', 'en', 'fr'] },
  { key: 'meteoai_unit', field: 'unit', allowed: ['C', 'F'] },
  { key: 'meteoai_view_mode', field: 'view', allowed: ['basic', 'expert'] },
  { key: 'meteoai_detail_hint', field: 'hint', allowed: ['compact'] },
  { key: 'meteoai_view_menu_seen', field: 'menu', allowed: ['1'] }
] as const;

type Payload = Record<string, unknown>;

const parseJSON = (raw: string | null): unknown => {
  if (!raw) return undefined;
  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
};

const pick = (value: unknown, allowed: readonly string[]): string | undefined =>
  typeof value === 'string' && allowed.includes(value) ? value : undefined;

const shortText = (value: unknown, max: number): string | undefined =>
  typeof value === 'string' && value.trim() !== '' && value.length <= max ? value : undefined;

const isCoord = (value: unknown, limit: number): value is number =>
  typeof value === 'number' && Number.isFinite(value) && Math.abs(value) <= limit;

/** Només els favorits ben formats (nom i coordenades), sense repetir lloc, com a molt MAX_FAVORITES. */
export function cleanFavorites(raw: unknown): LocationData[] {
  if (!Array.isArray(raw)) return [];
  const places: LocationData[] = [];
  for (const item of raw.slice(0, MAX_FAVORITES)) {
    if (!item || typeof item !== 'object') continue;
    const { name, latitude, longitude, country, admin1 } = item as Payload;
    const cleanName = shortText(name, 120);
    if (!cleanName || !isCoord(latitude, 90) || !isCoord(longitude, 180)) continue;
    const place: LocationData = { name: cleanName, latitude, longitude };
    const cleanCountry = shortText(country, 80);
    const cleanAdmin1 = shortText(admin1, 80);
    if (cleanCountry) place.country = cleanCountry;
    if (cleanAdmin1) place.admin1 = cleanAdmin1;
    if (!places.some(p => isSamePlace(p, place))) places.push(place);
  }
  return places;
}

const cleanSecrets = (raw: unknown): string[] =>
  Array.isArray(raw) ? SECRET_IDS.filter(id => raw.includes(id)) : [];

/** A l'adreça antiga: l'enllaç cap a la nova amb els favorits i les preferències d'aquest navegador. */
export function buildMoveLink(): string {
  const payload: Payload = { v: 1 };
  const favorites = cleanFavorites(parseJSON(readStorage(FAVORITES_KEY)));
  if (favorites.length) payload.fav = favorites;
  for (const { key, field, allowed } of SETTINGS) {
    const value = pick(readStorage(key), allowed);
    if (value) payload[field] = value;
  }
  const secrets = cleanSecrets(parseJSON(readStorage(SECRETS_KEY)));
  if (secrets.length) payload.secrets = secrets;
  return `${NEW_ADDRESS}${MOVE_FRAGMENT}${encodeURIComponent(JSON.stringify(payload))}`;
}

/** Desa el que porta l'enllaç: els favorits i els secrets se sumen als d'aquí; les preferències, les de l'adreça antiga. */
export function applyMovePayload(payload: Payload): void {
  const incoming = cleanFavorites(payload.fav);
  if (incoming.length) {
    const stored = parseJSON(readStorage(FAVORITES_KEY));
    const current: LocationData[] = Array.isArray(stored) ? stored : [];
    const added = incoming.filter(place => !current.some(f => isSamePlace(f, place)));
    writeStorage(FAVORITES_KEY, JSON.stringify([...current, ...added]));
  }
  for (const { key, field, allowed } of SETTINGS) {
    const value = pick(payload[field], allowed);
    if (value) writeStorage(key, value);
  }
  const secrets = cleanSecrets(payload.secrets);
  if (secrets.length) {
    const found = new Set([...cleanSecrets(parseJSON(readStorage(SECRETS_KEY))), ...secrets]);
    writeStorage(SECRETS_KEY, JSON.stringify(SECRET_IDS.filter(id => found.has(id))));
  }
}

let movedHere = false;

/**
 * Arrencada (main.tsx, abans de Sentry): si l'adreça porta #migra=…, el treu de l'adreça i en desa el contingut.
 * Torna si s'ha importat alguna cosa.
 */
export function importMovedData(): boolean {
  if (typeof window === 'undefined' || !window.location.hash.startsWith(MOVE_FRAGMENT)) return false;
  const encoded = window.location.hash.slice(MOVE_FRAGMENT.length);
  // Primer fora de l'adreça, s'hagi pogut llegir o no: ni Sentry ni les estadístiques l'han de veure.
  try {
    window.history.replaceState(window.history.state, '', `${window.location.pathname}${window.location.search}`);
  } catch { /* sense History API: igualment no es torna a llegir */ }
  let payload: unknown;
  try {
    payload = JSON.parse(decodeURIComponent(encoded));
  } catch {
    return false;
  }
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return false;
  applyMovePayload(payload as Payload);
  movedHere = true;
  return true;
}

/** Un sol cop: si aquesta càrrega ha portat dades de l'adreça antiga (per dir-ho a l'usuari). */
export function takeMovedHere(): boolean {
  const value = movedHere;
  movedHere = false;
  return value;
}

/** L'avís de la mudança: només a l'adreça antiga; per a tothom amb MOVE_NOTICE_LIVE, abans només amb ?pont=1. */
export function shouldShowMoveNotice(location: Pick<Location, 'hostname' | 'search'>, live = MOVE_NOTICE_LIVE): boolean {
  if (location.hostname !== OLD_HOSTNAME) return false;
  return live || new URLSearchParams(location.search).has(MOVE_TEST_PARAM);
}
