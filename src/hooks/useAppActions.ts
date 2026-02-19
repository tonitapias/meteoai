// src/hooks/useAppActions.ts
import { useCallback } from 'react';
import { GEO_ERRORS, NOTIFICATION_TYPES } from '../constants/errorConstants';
import { ExtendedWeatherData } from '../types/weatherLogicTypes';
import { WeatherFetchResult } from './useWeather';

// SOLUCIÓ 1 i 3: Imports directes de l'arquitectura de tipus de l'App
import { TranslationType } from '../translations';
import { LocationData } from '../context/PreferencesContext';

// SOLUCIÓ 2: Alineem el tipatge estricte del sistema de notificacions de la UI
type NotificationLevel = 'error' | 'success' | 'info';
type NotificationAction = (payload: { type: NotificationLevel; msg: string }) => void;

interface UseAppActionsProps {
  t: TranslationType; // <- Tipus exacte en lloc de Record<string, string>
  getCoordinates: () => Promise<{ lat: number; lon: number }>;
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

  const handleGetCurrentLocation = useCallback(async () => {
    try {
      const { lat, lon } = await getCoordinates();
      const result = await fetchWeatherByCoords(lat, lon, "La Meva Ubicació");

      if (result.success) {
        setNotification({ 
            type: NOTIFICATION_TYPES.SUCCESS as NotificationLevel, 
            msg: t.notifLocationSuccess || "Ubicació actualitzada" 
        });
      }
    } catch (e: unknown) {
      const err = e as Error;
      let errorMsg = t.notifLocationError || "Error d'ubicació";

      if (err.message === GEO_ERRORS.NOT_SUPPORTED) {
        errorMsg = t.geoNotSupported || "Geolocalització no suportada";
      } else if (err.message === GEO_ERRORS.PERMISSION_DENIED) {
        errorMsg = t.notifLocationError || "Permís denegat";
      } else if (err.message === GEO_ERRORS.TIMEOUT) {
        errorMsg = t.notifLocationError || "Temps d'espera esgotat";
      }

      setNotification({ type: NOTIFICATION_TYPES.ERROR as NotificationLevel, msg: errorMsg });
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