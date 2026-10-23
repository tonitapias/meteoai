// src/hooks/useAppActions.ts
import { useCallback } from 'react';
import { GEO_ERRORS, NOTIFICATION_TYPES } from '../constants/errorConstants';
import { ExtendedWeatherData } from '../types/weatherLogicTypes';
import { WeatherFetchResult } from './useWeather';

// SOLUCIÓ 1 i 3: Imports directes de l'arquitectura de tipus de l'App
import { TranslationType } from '../translations';
import { LocationData } from './usePreferences';

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
  fetchWeatherByCoords: (lat: number, lon: number, name: string) => Promise<WeatherFetchResult>;
  setNotification: NotificationAction; // <- Tipus estricte
  weatherData: ExtendedWeatherData | null;
  isFavorite: (name: string) => boolean;
  addFavorite: (location: LocationData) => void; // <- Tipus exacte del Context
  removeFavorite: (name: string) => void;
}

export function useAppActions({
  t,
  getCoordinates,
  fetchWeatherByCoords,
  setNotification,
  weatherData,
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
      const result = await fetchWeatherByCoords(coords.lat, coords.lon, coords.name);
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
    
    // Tractem location com un Record per evitar el Type Collapsing a {}
    const loc = weatherData.location as Record<string, unknown>;
    const name = loc['name'] as string;
    
    if (isFavorite(name)) {
      removeFavorite(name);
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

  return {
    handleGetCurrentLocation,
    handleToggleFavorite
  };
}