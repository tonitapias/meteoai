// src/hooks/useAppController.ts
import { usePreferences } from './usePreferences';
import { TRANSLATIONS } from '../translations';
import { useAppActions } from './useAppActions';

// Importem els nous controladors especialitzats
import { useDataController } from './controllers/useDataController';
import { useUIController } from './controllers/useUIController';

export function useAppController() {
  // 1. CAPA DE PREFERÈNCIES (Settings)
  // Aquestes són les úniques dades que necessitem abans d'arrencar res més
  const { 
    lang, setLang, unit, viewMode, setViewMode, 
    addFavorite, removeFavorite, isFavorite 
  } = usePreferences();
  
  const t = TRANSLATIONS[lang] || TRANSLATIONS['ca'];

  // 2. CAPA VISUAL (UI)
  // Necessitem instanciar-la aviat perquè conté el rellotge ('now')
  const ui = useUIController();

  // 3. CAPA DE DADES (Logic)
  // Injectem 'now' (UI) i preferències (Settings) a la lògica
  const data = useDataController({ 
    lang, 
    unit, 
    now: ui.state.now 
  });

  // 4. CAPA D'ACCIONS (Bridge)
  // Connectem les peces. Les accions necessiten accés creuat (ex: UI necessita saber errors de Dades)
  const appActions = useAppActions({
    t,
    getCoordinates: data.actions.getCoordinates,
    fetchWeatherByCoords: data.actions.fetchWeatherByCoords,
    setNotification: ui.actions.setNotification,
    weatherData: data.state.weatherData,
    isFavorite,
    addFavorite,
    removeFavorite
  });

  // 5. RETORN RETRO-COMPATIBLE
  // Reconstruïm l'objecte gegant original perquè les Vistes no es trenquin.
  return {
      state: {
          // Fusionem estats de Dades i UI
          weatherData: data.state.weatherData,
          aqiData: data.state.aqiData,
          loading: data.state.loading,
          error: data.state.error,
          aiAnalysis: data.state.aiAnalysis,
          calculations: data.state.calculations,
          
          notification: ui.state.notification,
          now: ui.state.now
      },
      actions: {
          // Accions de Dades
          fetchWeatherByCoords: data.actions.fetchWeatherByCoords,
          handleGetCurrentLocation: appActions.handleGetCurrentLocation,
          
          // Accions de Preferències
          handleToggleFavorite: appActions.handleToggleFavorite,
          setLang,
          setViewMode,
          
          // Accions d'UI
          toggleDebug: ui.actions.toggleDebug,
          dismissNotification: ui.actions.dismissNotification,
          setSelectedDayIndex: ui.actions.setSelectedDayIndex,
          setShowRadar: ui.actions.setShowRadar,
          setShowArome: ui.actions.setShowArome
      },
      flags: {
          // Fusionem flags
          supportsArome: data.flags.supportsArome,
          showDebug: ui.state.showDebug,
          isFavorite: (name: string) => isFavorite(name),
          unit,
          lang,
          viewMode
      },
      modals: ui.modals, // Pas directe
      t
  };
}