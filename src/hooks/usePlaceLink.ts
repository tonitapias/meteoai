// src/hooks/usePlaceLink.ts
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  hasPlaceParams, readPlaceFromSearch, writePlaceToSearch, type LinkedPlace, type PlaceOnScreen, type PlaceOrigin
} from '../utils/placeLink';

interface UsePlaceLinkProps {
  /** El lloc a pantalla (vegeu placeForLink), o null si encara no n'hi ha cap. */
  place: (PlaceOnScreen & { origin?: PlaceOrigin }) | null | undefined;
  fetchWeatherByCoords: (lat: number, lon: number, name: string, country?: string, origin?: PlaceOrigin) => Promise<unknown>;
}

const readInitialPlace = (): LinkedPlace | null =>
  typeof window === 'undefined' ? null : readPlaceFromSearch(window.location.search);

/**
 * Enllaços d'un lloc (vegeu utils/placeLink.ts):
 * - En arrencar, si la URL porta un lloc vàlid, el carrega directament (sense passar per la benvinguda). Si porta
 *   paràmetres de lloc que no valen, se'n treuen i surt la benvinguda com sempre.
 * - Després, la URL segueix el lloc a pantalla (cercador, favorit, GPS) amb `replaceState`: canviar de lloc no crea
 *   entrades noves a l'historial, i l'enrere continua sent dels modals (useModalHistory, useTacticalModal, ConsensusWidget,
 *   RadarModal) i, al final, per sortir de l'app.
 *
 * Torna si l'app s'ha obert des d'un enllaç amb lloc (per mostrar el tauler carregant en lloc de la benvinguda) i
 * `clearPlaceLink`, per tornar a la benvinguda (botó Inici).
 */
export function usePlaceLink({ place, fetchWeatherByCoords }: UsePlaceLinkProps): { openedFromLink: boolean; clearPlaceLink: () => void } {
  // Es llegeix una sola vegada: un cop arrencada, la URL ja és el reflex del lloc a pantalla, no l'ordre de carregar-lo.
  const [linkedPlace] = useState(readInitialPlace);
  const [leftLink, setLeftLink] = useState(false);
  const bootedRef = useRef(false);

  useEffect(() => {
    // StrictMode executa els efectes dues vegades en desenvolupament: una sola càrrega.
    if (bootedRef.current) return;
    bootedRef.current = true;

    if (linkedPlace) {
      // Sense nom, '' fa que weatherService en faci la geocodificació inversa (en l'idioma de qui obre l'enllaç).
      // Amb origen=gps és la posició de qui l'ha enviat: "Posició compartida", no la de qui l'obre.
      const origin: PlaceOrigin = linkedPlace.sharedPosition ? 'sharedPosition' : 'consulted';
      fetchWeatherByCoords(linkedPlace.lat, linkedPlace.lon, linkedPlace.name ?? '', linkedPlace.country, origin);
      return;
    }

    if (hasPlaceParams(window.location.search)) {
      replaceSearch(writePlaceToSearch(window.location.search, null));
    }
  }, [linkedPlace, fetchWeatherByCoords]);

  const lat = place?.latitude;
  const lon = place?.longitude;
  const name = place?.name;
  const country = place?.country;
  // `origen=gps` a la barra d'adreces només per a una posició rebuda (recarregar-la la torna a mostrar com a tal). La
  // pròpia no: en recarregar-la, l'usuari no ha de veure la seva posició com a "Posició compartida" (l'enllaç que
  // envia el botó Compartir sí que el porta; vegeu buildPlaceLink).
  const markPosition = place?.origin === 'sharedPosition';

  useEffect(() => {
    // Mentre no hi ha cap lloc a pantalla (benvinguda, o l'enllaç encara carregant) la URL no es toca: si la primera
    // càrrega falla, recarregar la pàgina torna a provar el mateix lloc.
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;
    const sync = () => replaceSearch(writePlaceToSearch(window.location.search, { latitude: lat, longitude: lon, name, country }, markPosition));
    sync();
    // Cada modal obert afegeix una entrada amb la URL d'aquell moment: si el lloc canvia amb un modal obert (p. ex. el
    // refresc en segon pla), l'entrada de sota encara porta l'anterior. En tornar-hi amb l'enrere, es corregeix.
    window.addEventListener('popstate', sync);
    return () => window.removeEventListener('popstate', sync);
  }, [lat, lon, name, country, markPosition]);

  // Tornar a la benvinguda: la URL perd el lloc (recarregar no l'ha de tornar a obrir) i l'enllaç d'arrencada ja no
  // compta (sense dades, el tauler es quedaria carregant en lloc de mostrar la benvinguda).
  const clearPlaceLink = useCallback(() => {
    setLeftLink(true);
    replaceSearch(writePlaceToSearch(window.location.search, null));
  }, []);

  return { openedFromLink: linkedPlace !== null && !leftLink, clearPlaceLink };
}

/**
 * Canvia la cerca de l'entrada actual de l'historial. Conserva l'estat (els modals hi miren si són a dalt de tot, p. ex.
 * `history.state.modalId` del radar) i el hash (`#modal-…` d'useTacticalModal, que en tanca el modal si desapareix).
 */
function replaceSearch(search: string): void {
  const { pathname, hash, search: current } = window.location;
  if (search === current) return;
  window.history.replaceState(window.history.state, '', `${pathname}${search}${hash}`);
}
