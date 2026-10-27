// src/hooks/useAppActions.ts
import { useCallback } from 'react';
import { GEO_ERRORS, NOTIFICATION_TYPES } from '../constants/errorConstants';
import { ExtendedWeatherData } from '../types/weatherLogicTypes';
import { WeatherFetchResult } from './useWeather';

// SOLUCIÓ 1 i 3: Imports directes de l'arquitectura de tipus de l'App
import { TranslationType } from '../translations';
import { LocationData } from './usePreferences';
import type { PlaceRef } from '../utils/geoDistance';
import { approximatePlace, buildPlaceLink, formatCoordsText, isPositionOrigin, type PlaceOrigin, type SharedPlace } from '../utils/placeLink';
import { copyToClipboard, shareLink, type ShareResult } from '../utils/shareLink';
import { buildShareMessage } from '../utils/shareMessage';

// SOLUCIÓ 2: Alineem el tipatge estricte del sistema de notificacions de la UI
type NotificationLevel = 'error' | 'success' | 'info';
type NotificationAction = (payload: { type: NotificationLevel; msg: string }) => void;

/** Resultat de "Utilitza la meva ubicació": la benvinguda en mostra el motiu quan falla. */
export type LocateResult =
  | { ok: true }
  | { ok: false; reason: 'denied' | 'unavailable' | 'timeout' | 'unsupported' | 'fetch' };

interface UseAppActionsProps {
  t: TranslationType; 
  getCoordinates: () => Promise<{ lat: number; lon: number; name: string }>; // <-- Afegit el 'name: string'
  fetchWeatherByCoords: (lat: number, lon: number, name: string, country?: string, origin?: PlaceOrigin) => Promise<WeatherFetchResult>;
  setNotification: NotificationAction; // <- Tipus estricte
  weatherData: ExtendedWeatherData | null;
  /** El lloc a pantalla per compartir, amb les coordenades demanades i l'origen (vegeu placeForLink). */
  sharedPlace: SharedPlace | null;
  /** Obre la finestra "Què vols compartir?" (posició del GPS). */
  openShareSheet: () => void;
  isFavorite: (place: PlaceRef) => boolean;
  addFavorite: (location: LocationData) => void; // <- Tipus exacte del Context
  removeFavorite: (place: PlaceRef) => void;
}

export function useAppActions({
  t,
  getCoordinates,
  fetchWeatherByCoords,
  setNotification,
  weatherData,
  sharedPlace,
  openShareSheet,
  isFavorite,
  addFavorite,
  removeFavorite
}: UseAppActionsProps) {

  // Només la fa servir la benvinguda, que explica l'error a sota del botó (per això no hi ha avís flotant
  // quan falla la ubicació): torna el motiu perquè el botó no es quedi mai bloquejat.
  const handleGetCurrentLocation = useCallback(async (): Promise<LocateResult> => {
    let coords: { lat: number; lon: number; name: string };
    try {
      coords = await getCoordinates();
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : '';
      if (message === GEO_ERRORS.NOT_SUPPORTED) return { ok: false, reason: 'unsupported' };
      if (message === GEO_ERRORS.PERMISSION_DENIED) return { ok: false, reason: 'denied' };
      if (message === GEO_ERRORS.TIMEOUT) return { ok: false, reason: 'timeout' };
      return { ok: false, reason: 'unavailable' };
    }

    try {
      // 'gps': és la posició de l'usuari (el missatge de compartir ho diu i hi posa les coordenades).
      const result = await fetchWeatherByCoords(coords.lat, coords.lon, coords.name, undefined, 'gps');
      if (!result.success) return { ok: false, reason: 'fetch' };
      setNotification({
          type: NOTIFICATION_TYPES.SUCCESS as NotificationLevel,
          msg: t.notifLocationSuccess || "Ubicació actualitzada"
      });
      return { ok: true };
    } catch {
      setNotification({ type: NOTIFICATION_TYPES.ERROR as NotificationLevel, msg: t.notifLocationError || "Error d'ubicació" });
      return { ok: false, reason: 'fetch' };
    }
  }, [getCoordinates, fetchWeatherByCoords, t, setNotification]);

  const handleToggleFavorite = useCallback(() => {
    if (!weatherData?.location) return;
    
    // El lloc a pantalla (nom i coordenades): un favorit s'identifica pel lloc, no pel nom (vegeu isSamePlace).
    const place = weatherData.location as unknown as LocationData;

    if (isFavorite(place)) {
      removeFavorite(place);
      setNotification({ 
          type: NOTIFICATION_TYPES.INFO as NotificationLevel, 
          msg: t.favRemoved || "Favorit eliminat" 
      });
    } else {
      // Castem explícitament al tipus LocationData que demana el PreferenciasContext
      addFavorite(weatherData.location as unknown as LocationData);
      setNotification({ 
          type: NOTIFICATION_TYPES.SUCCESS as NotificationLevel, 
          msg: t.favAdded || "Favorit afegit" 
      });
    }
  }, [weatherData, isFavorite, addFavorite, removeFavorite, t, setNotification]);

  // Comparteix un lloc: l'enllaç i un missatge que diu si és una posició o un lloc consultat (vegeu
  // utils/shareMessage.ts). Avís només si s'ha copiat (o no s'ha pogut): el full de compartir del sistema ja diu prou, i
  // tancar-lo no és cap error. Torna el resultat perquè la finestra de la posició sàpiga si s'ha de tancar.
  const shareWith = useCallback(async (place: SharedPlace): Promise<ShareResult | null> => {
    if (typeof window === 'undefined') return null;
    const url = buildPlaceLink(window.location.href, place);
    if (!url) return null;

    const result = await shareLink(buildShareMessage(place, url, t.share));

    if (result === 'copied') {
      const msg = isPositionOrigin(place.origin) ? t.share.positionCopied : t.share.copied;
      setNotification({ type: NOTIFICATION_TYPES.SUCCESS as NotificationLevel, msg });
    } else if (result === 'failed') {
      setNotification({ type: NOTIFICATION_TYPES.ERROR as NotificationLevel, msg: t.share.failed });
    }
    return result;
  }, [t, setNotification]);

  // Botó Compartir. Amb la posició del GPS primer es pregunta què es vol compartir (la posició exacta o només el temps
  // d'aquí): és l'únic cas en què l'enllaç diria on és l'usuari. Un lloc consultat o una posició rebuda, directament.
  const handleSharePlace = useCallback(async () => {
    if (!sharedPlace) return;
    if (sharedPlace.origin === 'gps') {
      openShareSheet();
      return;
    }
    await shareWith(sharedPlace);
  }, [sharedPlace, openShareSheet, shareWith]);

  // Opcions de la finestra "Què vols compartir?" (vegeu SharePositionSheet).
  const shareMyPosition = useCallback(
    async () => (sharedPlace ? shareWith(sharedPlace) : null),
    [sharedPlace, shareWith]
  );
  const shareWeatherOnly = useCallback(
    async () => (sharedPlace ? shareWith(approximatePlace(sharedPlace)) : null),
    [sharedPlace, shareWith]
  );
  const copyCoordinates = useCallback(async (): Promise<boolean> => {
    if (!sharedPlace || typeof window === 'undefined') return false;
    const ok = await copyToClipboard(formatCoordsText(sharedPlace.latitude, sharedPlace.longitude), navigator, document);
    setNotification(ok
      ? { type: NOTIFICATION_TYPES.SUCCESS as NotificationLevel, msg: t.share.coordsCopied }
      : { type: NOTIFICATION_TYPES.ERROR as NotificationLevel, msg: t.share.failed });
    return ok;
  }, [sharedPlace, t, setNotification]);

  return {
    handleGetCurrentLocation,
    handleToggleFavorite,
    handleSharePlace,
    shareMyPosition,
    shareWeatherOnly,
    copyCoordinates
  };
}