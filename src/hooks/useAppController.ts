// src/hooks/useAppController.ts
import { useCallback, useMemo } from 'react';
import { usePreferences } from './usePreferences';
import { TRANSLATIONS } from '../translations';
import { useAppActions } from './useAppActions';
import { useI18nLanguageSync } from './useI18nLanguageSync';
import { usePlaceLink } from './usePlaceLink';
import type { PlaceRef } from '../utils/geoDistance';
import { placeForLink } from '../utils/placeLink';
import type { LocationMeta } from '../types/weatherLogicTypes';

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

  // i18next (radar, avís d'actualització) en l'idioma triat des de la primera pantalla, no només dins del tauler.
  useI18nLanguageSync(lang);

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

  // El lloc per a l'enllaç i per compartir: coordenades demanades (les del GPS tal qual), nom de pantalla i origen.
  const { weatherData, loadedPlace } = data.state;
  const sharedPlace = useMemo(
    () => placeForLink(
      loadedPlace,
      weatherData?.location as LocationMeta | undefined,
      typeof weatherData?.offlineSnapshot?.distanceKm === 'number'
    ),
    [loadedPlace, weatherData]
  );

  const { setShowShareSheet } = ui.actions;
  const openShareSheet = useCallback(() => setShowShareSheet(true), [setShowShareSheet]);

  // 4. CAPA D'ACCIONS (Bridge)
  // Connectem les peces. Les accions necessiten accés creuat (ex: UI necessita saber errors de Dades)
  const appActions = useAppActions({
    t,
    getCoordinates: data.actions.getCoordinates,
    fetchWeatherByCoords: data.actions.fetchWeatherByCoords,
    setNotification: ui.actions.setNotification,
    weatherData: data.state.weatherData,
    sharedPlace,
    openShareSheet,
    isFavorite,
    addFavorite,
    removeFavorite
  });

  // 4b. ENLLAÇ DEL LLOC (?lat&lon&nom): obre el lloc de la URL i la manté al dia amb el lloc a pantalla.
  // Mentre l'enllaç carrega (encara sense dades ni error) es mostra el tauler amb l'esquelet, no la benvinguda.
  const { openedFromLink, clearPlaceLink } = usePlaceLink({
    place: sharedPlace,
    fetchWeatherByCoords: data.actions.fetchWeatherByCoords
  });
  const openingLink = openedFromLink && !data.state.weatherData && !data.state.error;

  // 4c. BOTÓ INICI del tauler: torna a la benvinguda sense previsió, sense refrescos pendents i amb la URL neta. Els
  // favorits, l'idioma i la vista són preferències i no es toquen.
  const { clearWeather } = data.actions;
  const goHome = useCallback(() => {
    clearWeather();
    clearPlaceLink();
    window.scrollTo(0, 0);
  }, [clearWeather, clearPlaceLink]);

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
          openingLink,
          sharedPlace,
          error: data.state.error,
          aiAnalysis: data.state.aiAnalysis,
          lightning: data.state.lightning,
          calculations: data.state.calculations,
          favorites,
          notification: ui.state.notification,
          now: ui.state.now
      },
      actions: {
          // Accions de Dades
          fetchWeatherByCoords: data.actions.fetchWeatherByCoords,
          refreshLoadedLocation: data.actions.refreshLoadedLocation,
          goHome,
          handleGetCurrentLocation: appActions.handleGetCurrentLocation,

          // Accions de Preferències
          handleToggleFavorite: appActions.handleToggleFavorite,
          handleSharePlace: appActions.handleSharePlace,
          shareMyPosition: appActions.shareMyPosition,
          shareWeatherOnly: appActions.shareWeatherOnly,
          copyCoordinates: appActions.copyCoordinates,
          setShowShareSheet,
          setLang,
          setViewMode,

          // Accions d'UI
          toggleDebug: ui.actions.toggleDebug,
          setNotification: ui.actions.setNotification,
          dismissNotification: ui.actions.dismissNotification,
          setSelectedDayIndex: ui.actions.setSelectedDayIndex,
          setShowRadar: ui.actions.setShowRadar,
          setShowRegionalModel: ui.actions.setShowRegionalModel,
          setShowSolarModal: ui.actions.setShowSolarModal,
          setShowMoonModal: ui.actions.setShowMoonModal,
          setShowStormModal: ui.actions.setShowStormModal,
          setShowAqiModal: ui.actions.setShowAqiModal,
          setShowUvModal: ui.actions.setShowUvModal,
          setShowPressureModal: ui.actions.setShowPressureModal,
          setShowComfortModal: ui.actions.setShowComfortModal,
          setShowVisibilityModal: ui.actions.setShowVisibilityModal,
          setShowCloudLayersModal: ui.actions.setShowCloudLayersModal,
          setShowSnowLevelModal: ui.actions.setShowSnowLevelModal,
          setShowWindModal: ui.actions.setShowWindModal,
          setPlanetModalTab: ui.actions.setPlanetModalTab
      },
      flags: {
          // Fusionem flags
          activeRegionalModel: data.flags.activeRegionalModel,
          showDebug: ui.state.showDebug,
          isFavorite: (place: PlaceRef) => isFavorite(place),
          unit,
          lang,
          viewMode
      },
      modals: ui.modals, // Pas directe
      t
  }), [
      data.state.weatherData, data.state.aqiData, data.state.loading, openingLink, sharedPlace, data.state.error,
      data.state.aiAnalysis, data.state.lightning, data.state.calculations, favorites, ui.state.notification, ui.state.now,
      data.actions.fetchWeatherByCoords, data.actions.refreshLoadedLocation, goHome,
      appActions.handleGetCurrentLocation, appActions.handleToggleFavorite, appActions.handleSharePlace,
      appActions.shareMyPosition, appActions.shareWeatherOnly, appActions.copyCoordinates, setShowShareSheet,
      setLang, setViewMode, ui.actions.toggleDebug, ui.actions.setNotification, ui.actions.dismissNotification,
      ui.actions.setSelectedDayIndex, ui.actions.setShowRadar, ui.actions.setShowRegionalModel,
      ui.actions.setShowSolarModal, ui.actions.setShowMoonModal, ui.actions.setShowStormModal,
      ui.actions.setShowAqiModal, ui.actions.setShowUvModal, ui.actions.setShowPressureModal,
      ui.actions.setShowComfortModal, ui.actions.setShowVisibilityModal, ui.actions.setShowCloudLayersModal,
      ui.actions.setShowSnowLevelModal, ui.actions.setShowWindModal, ui.actions.setPlanetModalTab,
      data.flags.activeRegionalModel, ui.state.showDebug, isFavorite, unit, lang, viewMode,
      ui.modals, t
  ]);
}