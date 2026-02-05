// src/hooks/useAppActions.ts
import { useCallback } from 'react';
import { GEO_ERRORS, NOTIFICATION_TYPES } from '../constants/errorConstants';
// IMPORT DIRECTE: Tipus
import { ExtendedWeatherData } from '../types/weatherLogicTypes';
import { WeatherFetchResult } from './useWeather';

type NotificationAction = (payload: { type: string; msg: string | null }) => void;

interface UseAppActionsProps {
  t: Record<string, string>;
  getCoordinates: () => Promise<{ lat: number; lon: number }>;
  fetchWeatherByCoords: (lat: number, lon: number, name: string) => Promise<WeatherFetchResult>;
  setNotification: NotificationAction;
  weatherData: ExtendedWeatherData | null;
  isFavorite: (name: string) => boolean;
  addFavorite: (location: ExtendedWeatherData['location']) => void;
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
        setNotification({ type: NOTIFICATION_TYPES.SUCCESS, msg: t.notifLocationSuccess });
      }
    } catch (e: unknown) {
      const err = e as Error;
      let errorMsg = t.notifLocationError;

      if (err.message === GEO_ERRORS.NOT_SUPPORTED) {
        errorMsg = t.geoNotSupported;
      } else if (err.message === GEO_ERRORS.PERMISSION_DENIED) {
        errorMsg = t.notifLocationError;
      } else if (err.message === GEO_ERRORS.TIMEOUT) {
        errorMsg = t.notifLocationError;
      }

      setNotification({ type: NOTIFICATION_TYPES.ERROR, msg: errorMsg });
    }
  }, [getCoordinates, fetchWeatherByCoords, t, setNotification]);

  const handleToggleFavorite = useCallback(() => {
    if (!weatherData?.location) return;
    const { name } = weatherData.location;
    if (isFavorite(name)) {
      removeFavorite(name);
      setNotification({ type: NOTIFICATION_TYPES.INFO, msg: t.favRemoved });
    } else {
      addFavorite(weatherData.location);
      setNotification({ type: NOTIFICATION_TYPES.SUCCESS, msg: t.favAdded });
    }
  }, [weatherData, isFavorite, addFavorite, removeFavorite, t, setNotification]);

  return {
    handleGetCurrentLocation,
    handleToggleFavorite
  };
}