// src/hooks/welcome/useAntipodesPlace.ts
// On cauen les antípodes: el nom del lloc (el mateix servei de geocodificació inversa que fa servir l'app) i el lloc
// habitat més proper d'una llista de poblacions de tot el món (Natural Earth, de domini públic, public/world-places.tsv,
// ~80 KB comprimits que només es baixen quan algú troba aquest secret). La llista també posa noms damunt la foto.
import { useEffect, useState } from 'react';
import type { Language } from '../../translations';
import { fetchWithTimeout } from '../../utils/networkUtils';
import { nearestPlace, parseWorldPlaces, type WorldPlace } from '../../utils/welcome/earthElevator';

const REVERSE_URL = import.meta.env.VITE_API_GEOCODING || 'https://api.bigdatacloud.net/data/reverse-geocode-client';
const PLACES_URL = `${import.meta.env.BASE_URL}world-places.tsv`;
const TIMEOUT_MS = 8000;

export interface ReversePlace {
  /** Poble o ciutat, si el punt és a terra. */
  locality: string | null;
  country: string | null;
  /** Nom de l'oceà o del mar, si el punt hi és. */
  sea: string | null;
}

const text = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null);
// Paraula sencera (\b no serveix: "oceà" acaba en lletra no ASCII).
const SEA_WORDS = /(^|[^\p{L}])(ocean|sea|oceà|mar|océano|océan|mer)([^\p{L}]|$)/iu;

/** Llegeix la resposta de la geocodificació inversa: a terra, poble i país; al mar, el nom de l'oceà. */
export function parseReversePlace(json: unknown): ReversePlace {
  const data = json as {
    city?: unknown; locality?: unknown; countryName?: unknown;
    localityInfo?: { informative?: { name?: unknown; description?: unknown }[] };
  } | null;
  const country = text(data?.countryName);
  const locality = text(data?.city) ?? text(data?.locality);
  const informative = data?.localityInfo?.informative ?? [];
  const seaEntry = informative.find(i => SEA_WORDS.test(`${text(i.description) ?? ''} ${text(i.name) ?? ''}`));
  // Sense país, el que el servei anomena localitat és l'aigua on cau el punt.
  const sea = text(seaEntry?.name) ?? (!country && locality && SEA_WORDS.test(locality) ? locality : null);
  return { locality: country ? locality : null, country, sea };
}

export interface AntipodesPlace {
  reverse: ReversePlace | null;
  nearest: { place: WorldPlace; km: number } | null;
  /** La llista sencera, per als noms de la foto (buida si no s'ha pogut baixar). */
  places: WorldPlace[];
}

/** null mentre es busca; després, el que s'hagi pogut saber (cada part pot faltar). */
export function useAntipodesPlace(lat: number, lon: number, lang: Language): AntipodesPlace | null {
  const [state, setState] = useState<AntipodesPlace | null>(null);

  useEffect(() => {
    let alive = true;
    const reverse = fetchWithTimeout(`${REVERSE_URL}?latitude=${lat.toFixed(2)}&longitude=${lon.toFixed(2)}&localityLanguage=${lang}`, TIMEOUT_MS)
      .then(response => (response.ok ? response.json() : null))
      .then(json => (json ? parseReversePlace(json) : null))
      .catch(() => null);
    const places = fetchWithTimeout(PLACES_URL, TIMEOUT_MS)
      .then(response => (response.ok ? response.text() : ''))
      .then(parseWorldPlaces)
      .catch(() => [] as WorldPlace[]);
    Promise.all([reverse, places]).then(([rev, list]) => {
      if (alive) setState({ reverse: rev, nearest: nearestPlace(list, lat, lon), places: list });
    });
    return () => { alive = false; };
  }, [lat, lon, lang]);

  return state;
}
