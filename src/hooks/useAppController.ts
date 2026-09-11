// src/hooks/useAppController.ts
import { useMemo } from 'react';
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
    favorites, addFavorite, removeFavorite, isFavorite 
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

  // 5. RETORN RETRO-COMPATIBLE (memoitzat)
  // Reconstruïm l'objecte gegant original perquè les Vistes no es trenquin.
  // [FIX] Sense useMemo, aquest objecte —i per tant el `value` del Context—
  // es recreava en CADA render (incloent-hi el tick de rellotge de 60s
  // d'useUIController), forçant tots els consumidors de useAppContext a
  // re-renderitzar encara que no els afectés res del que havia canviat. Amb
  // les dependències llistades sota, només es recrea quan un valor real ha
  // canviat (weatherData nou, canvi de llengua, etc.) — 'now'/'calculations'
  // seguint canviant cada 60s per disseny (calen per refrescar la posició
  // solar i similars).
  return useMemo(() => ({
      state: {
          // Fusionem estats de Dades i UI, afegint 'favorites' per centralitzar la font de veritat
          weatherData: data.state.weatherData,
          aqiData: data.state.aqiData,
          loading: data.state.loading,
          error: data.state.error,
          aiAnalysis: data.state.aiAnalysis,
          calculations: data.state.calculations,
          favorites,
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
          setShowRegionalModel: ui.actions.setShowRegionalModel,
          setShowSolarModal: ui.actions.setShowSolarModal,
          setShowMoonModal: ui.actions.setShowMoonModal
      },
      flags: {
          // Fusionem flags
          activeRegionalModel: data.flags.activeRegionalModel,
          showDebug: ui.state.showDebug,
          isFavorite: (name: string) => isFavorite(name),
          unit,
          lang,
          viewMode
      },
      modals: ui.modals, // Pas directe
      t
  }), [
      data.state.weatherData, data.state.aqiData, data.state.loading, data.state.error,
      data.state.aiAnalysis, data.state.calculations, favorites, ui.state.notification, ui.state.now,
      data.actions.fetchWeatherByCoords, appActions.handleGetCurrentLocation, appActions.handleToggleFavorite,
      setLang, setViewMode, ui.actions.toggleDebug, ui.actions.dismissNotification,
      ui.actions.setSelectedDayIndex, ui.actions.setShowRadar, ui.actions.setShowRegionalModel,
      ui.actions.setShowSolarModal, ui.actions.setShowMoonModal,
      data.flags.activeRegionalModel, ui.state.showDebug, isFavorite, unit, lang, viewMode,
      ui.modals, t
  ]);
}