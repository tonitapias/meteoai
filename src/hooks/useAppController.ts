// src/hooks/useAppController.ts
import { useState, useEffect, useCallback } from 'react'; // [CORRECCIÓ] Eliminat useMemo
import { usePreferences } from './usePreferences';
import { useWeather } from './useWeather';
import { useWeatherAI } from './useWeatherAI';
import { useWeatherCalculations } from './useWeatherCalculations';
import { useModalHistory } from './useModalHistory';
import { useGeoLocation } from '../context/GeoLocationContext';
import { isAromeSupported } from '../utils/weatherLogic';
import { GEO_ERRORS, NOTIFICATION_TYPES } from '../constants/errorConstants';
import { TRANSLATIONS } from '../translations';

export function useAppController() {
  // 1. Estat Global
  const [now, setNow] = useState<Date>(new Date());
  const [showDebug, setShowDebug] = useState(false);
  const [notification, setNotification] = useState<{ 
      type: typeof NOTIFICATION_TYPES[keyof typeof NOTIFICATION_TYPES], 
      msg: string 
  } | null>(null);

  // 2. Modals State
  const [selectedDayIndex, setSelectedDayIndex] = useState<number | null>(null);
  const [showRadar, setShowRadar] = useState(false);
  const [showArome, setShowArome] = useState(false);

  // 3. Hooks Principals
  const { lang, setLang, unit, viewMode, setViewMode, addFavorite, removeFavorite, isFavorite } = usePreferences();
  const { weatherData, aqiData, loading, error, fetchWeatherByCoords } = useWeather(lang, unit);
  const { getCoordinates } = useGeoLocation();

  const t = TRANSLATIONS[lang] || TRANSLATIONS['ca'];

  // 4. Temporitzador (Rellotge)
  useEffect(() => { 
      const timer = setInterval(() => setNow(new Date()), 60000); 
      return () => clearInterval(timer); 
  }, []);

  // 5. Historial de Navegació (Back button tanca modals)
  useModalHistory(selectedDayIndex !== null, useCallback(() => setSelectedDayIndex(null), []));
  useModalHistory(showRadar, useCallback(() => setShowRadar(false), []));
  useModalHistory(showArome, useCallback(() => setShowArome(false), []));

  // 6. Càlculs Derivats
  const calculations = useWeatherCalculations(weatherData, unit, now);
  
  // 7. IA
  const { aiAnalysis } = useWeatherAI(weatherData, aqiData, lang, unit, calculations.reliability);

  // 8. Lògica d'Accions (Handlers)
  
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
  }, [getCoordinates, fetchWeatherByCoords, t]);

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
  }, [weatherData, isFavorite, addFavorite, removeFavorite, t]);

  const toggleDebug = useCallback(() => {
      setShowDebug(prev => !prev);
      setNotification({ 
          type: NOTIFICATION_TYPES.INFO, 
          msg: !showDebug ? "Debug Mode: ACTIVAT" : "Debug Mode: DESACTIVAT" 
      });
  }, [showDebug]);

  const supportsArome = weatherData?.location ? isAromeSupported(weatherData.location.latitude, weatherData.location.longitude) : false;

  // 9. Retorn Organitzat
  return {
      state: {
          weatherData,
          aqiData,
          loading,
          error,
          notification,
          aiAnalysis,
          calculations, 
          now
      },
      actions: {
          fetchWeatherByCoords,
          handleGetCurrentLocation,
          handleToggleFavorite,
          toggleDebug,
          dismissNotification: () => setNotification(null),
          setLang,
          setViewMode,
          // Modals setters
          setSelectedDayIndex,
          setShowRadar,
          setShowArome
      },
      flags: {
          showDebug,
          supportsArome,
          isFavorite: (name: string) => isFavorite(name),
          unit,
          lang,
          viewMode
      },
      modals: {
          selectedDayIndex,
          showRadar,
          showArome
      },
      t // Traduccions
  };
}