// src/hooks/useAppController.ts
import { useCallback } from 'react';
import { usePreferences } from './usePreferences';
import { useWeather } from './useWeather';
import { useWeatherAI } from './useWeatherAI';
import { useWeatherCalculations } from './useWeatherCalculations';
import { useGeoLocation } from '../context/GeoLocationContext';
import { isAromeSupported } from '../utils/weatherLogic';
import { GEO_ERRORS, NOTIFICATION_TYPES } from '../constants/errorConstants';
import { TRANSLATIONS } from '../translations';
// NOU IMPORT
import { useViewState } from './useViewState';

export function useAppController() {
  // 1. Deleguem l'estat visual al nou hook
  const view = useViewState();
  const { now, modals } = view.state; // Desestructurem el que necessitem per càlculs

  // 2. Hooks de Dades (Negoci)
  const { lang, setLang, unit, viewMode, setViewMode, addFavorite, removeFavorite, isFavorite } = usePreferences();
  const { weatherData, aqiData, loading, error, fetchWeatherByCoords } = useWeather(lang, unit);
  const { getCoordinates } = useGeoLocation();

  const t = TRANSLATIONS[lang] || TRANSLATIONS['ca'];

  // 3. Càlculs i IA (Pura Lògica)
  const calculations = useWeatherCalculations(weatherData, unit, now);
  const { aiAnalysis } = useWeatherAI(weatherData, aqiData, lang, unit, calculations.reliability);

  // 4. Accions de Negoci (Handlers)
  const handleGetCurrentLocation = useCallback(async () => {
      try {
          const { lat, lon } = await getCoordinates();
          const result = await fetchWeatherByCoords(lat, lon, "La Meva Ubicació");
          
          if (result.success) {
            view.actions.setNotification({ type: NOTIFICATION_TYPES.SUCCESS, msg: t.notifLocationSuccess });
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

          view.actions.setNotification({ type: NOTIFICATION_TYPES.ERROR, msg: errorMsg });
      }
  }, [getCoordinates, fetchWeatherByCoords, t, view.actions]);

  const handleToggleFavorite = useCallback(() => {
    if (!weatherData?.location) return;
    const { name } = weatherData.location;
    if (isFavorite(name)) { 
        removeFavorite(name); 
        view.actions.setNotification({ type: NOTIFICATION_TYPES.INFO, msg: t.favRemoved }); 
    } else { 
        addFavorite(weatherData.location); 
        view.actions.setNotification({ type: NOTIFICATION_TYPES.SUCCESS, msg: t.favAdded }); 
    }
  }, [weatherData, isFavorite, addFavorite, removeFavorite, t, view.actions]);

  const supportsArome = weatherData?.location ? isAromeSupported(weatherData.location.latitude, weatherData.location.longitude) : false;

  // 5. Retorn Unificat (Manté la interfície antiga per no trencar la Vista)
  return {
      state: {
          weatherData,
          aqiData,
          loading,
          error,
          notification: view.state.notification, // Connectem amb viewState
          aiAnalysis,
          calculations, 
          now
      },
      actions: {
          fetchWeatherByCoords,
          handleGetCurrentLocation,
          handleToggleFavorite,
          toggleDebug: view.actions.toggleDebug, // Connectem amb viewState
          dismissNotification: view.actions.dismissNotification, // Connectem amb viewState
          setLang,
          setViewMode,
          // Modals setters (Delegats)
          setSelectedDayIndex: view.actions.setSelectedDayIndex,
          setShowRadar: view.actions.setShowRadar,
          setShowArome: view.actions.setShowArome
      },
      flags: {
          showDebug: view.state.showDebug,
          supportsArome,
          isFavorite: (name: string) => isFavorite(name),
          unit,
          lang,
          viewMode
      },
      modals: {
          selectedDayIndex: modals.selectedDayIndex,
          showRadar: modals.showRadar,
          showArome: modals.showArome
      },
      t
  };
}