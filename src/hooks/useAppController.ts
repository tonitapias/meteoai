// src/hooks/useAppController.ts
import { usePreferences } from './usePreferences';
import { useWeather } from './useWeather';
import { useWeatherAI } from './useWeatherAI';
import { useWeatherCalculations } from './useWeatherCalculations';
import { useWeatherTheme } from './useWeatherTheme';
import { useGeoLocation } from '../context/GeoLocationContext';
// IMPORT DIRECTE: Física
import { isAromeSupported } from '../utils/physics';
import { TRANSLATIONS } from '../translations';
import { useViewState } from './useViewState';
import { useAppActions } from './useAppActions';

export function useAppController() {
  const view = useViewState();
  const { now, modals } = view.state; 
  const { lang, setLang, unit, viewMode, setViewMode, addFavorite, removeFavorite, isFavorite } = usePreferences();
  const t = TRANSLATIONS[lang] || TRANSLATIONS['ca'];

  const { weatherData, aqiData, loading, error, fetchWeatherByCoords } = useWeather(lang, unit);
  const { getCoordinates } = useGeoLocation();

  const calculations = useWeatherCalculations(weatherData, unit, now);
  const theme = useWeatherTheme(weatherData, calculations.effectiveWeatherCode);

  const calculationsWithTheme = {
      ...calculations,
      currentBg: theme.currentBg
  };

  const { aiAnalysis } = useWeatherAI(weatherData, aqiData, lang, unit, calculations.reliability);

  const appActions = useAppActions({
    t,
    getCoordinates,
    fetchWeatherByCoords,
    setNotification: view.actions.setNotification,
    weatherData,
    isFavorite,
    addFavorite,
    removeFavorite
  });

  const supportsArome = weatherData?.location ? isAromeSupported(weatherData.location.latitude, weatherData.location.longitude) : false;

  return {
      state: {
          weatherData,
          aqiData,
          loading,
          error,
          notification: view.state.notification,
          aiAnalysis,
          calculations: calculationsWithTheme,
          now
      },
      actions: {
          fetchWeatherByCoords,
          handleGetCurrentLocation: appActions.handleGetCurrentLocation,
          handleToggleFavorite: appActions.handleToggleFavorite,
          toggleDebug: view.actions.toggleDebug,
          dismissNotification: view.actions.dismissNotification,
          setLang,
          setViewMode,
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