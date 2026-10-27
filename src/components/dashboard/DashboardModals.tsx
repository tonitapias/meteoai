import { lazy, Suspense } from 'react';

// 1. IMPORTEM EL CONTEXT
import { useAppContext } from '../../context/AppContext';
import type { LocationMeta } from '../../types/weatherLogicTypes';
import { getCurrentUV } from '../../utils/uvIndexUtils';
import { getCurrentDewPoint } from '../../utils/weatherMath';
import { loadSolarModal } from '../solar/preloadSolarModal';
import { SolarModalSkeleton } from '../solar/SolarModalSkeleton';
import { formatCoordsText } from '../../utils/placeLink';

// Lazy loading dels modals (es manté igual)
const DayDetailModal = lazy(() => import('../DayDetailModal'));
const RadarModal = lazy(() => import('../RadarModal'));
const RegionalModelModal = lazy(() => import('../RegionalModelModal'));
// Cicle solar: el mateix import() memoritzat que la precàrrega de la targeta (pointerdown/focus).
const SolarModal = lazy(loadSolarModal);
const MoonModal = lazy(() => import('../MoonModal'));
const StormModal = lazy(() => import('../StormModal'));
const AqiModal = lazy(() => import('../AqiModal'));
const UvModal = lazy(() => import('../UvModal'));
const PressureModal = lazy(() => import('../PressureModal'));
const ComfortModal = lazy(() => import('../ComfortModal'));
const VisibilityModal = lazy(() => import('../VisibilityModal'));
const CloudLayersModal = lazy(() => import('../CloudLayersModal'));
const SnowLevelModal = lazy(() => import('../SnowLevelModal'));
const WindModal = lazy(() => import('../WindModal'));
const SharePositionSheet = lazy(() => import('../SharePositionSheet'));

// JA NO NECESSITEM INTERFACE PROPS NI TIPUS COMPLEXOS

export const DashboardModals = () => {
    // 2. RECUPEREM DADES DEL CONTEXT
    const { state, actions, flags, modals, t } = useAppContext();
    const { weatherData, aqiData, calculations, sharedPlace } = state;

    // L'idioma d'i18next (radar) ja el sincronitza useAppController des de l'arrencada (useI18nLanguageSync).

    // Protecció: Si no hi ha dades, no podem mostrar modals de detall
    if (!weatherData) return null;

    // Forcem el tipatge de location per corregir la pèrdua d'inferència del compilador
    const loc = weatherData.location as LocationMeta | undefined;

    return (
        <Suspense fallback={null}>
            {modals.selectedDayIndex !== null && (
                <DayDetailModal 
                    weatherData={weatherData} 
                    selectedDayIndex={modals.selectedDayIndex} 
                    onClose={() => actions.setSelectedDayIndex(null)} 
                    onSelectDay={actions.setSelectedDayIndex}
                    unit={flags.unit} 
                    lang={flags.lang} 
                />
            )}
            {modals.showRadar && (
                <RadarModal 
                    lat={loc?.latitude || 0} 
                    lon={loc?.longitude || 0} 
                    onClose={() => actions.setShowRadar(false)} 
                />
            )}
            {modals.showRegionalModel && flags.activeRegionalModel && (
                <RegionalModelModal
                    lat={loc?.latitude || 0}
                    lon={loc?.longitude || 0}
                    model={flags.activeRegionalModel}
                    onClose={() => actions.setShowRegionalModel(false)}
                    lang={flags.lang}
                    weatherData={weatherData}
                />
            )}
            {modals.showSolarModal && (
                // Només el Solar té esquelet propi: la resta segueix amb fallback={null}.
                <Suspense fallback={<SolarModalSkeleton lang={flags.lang} onClose={() => actions.setShowSolarModal(false)} />}>
                    <SolarModal
                        weatherData={weatherData}
                        onClose={() => actions.setShowSolarModal(false)}
                        lang={flags.lang}
                    />
                </Suspense>
            )}
            {modals.showMoonModal && (
                <MoonModal
                    weatherData={weatherData}
                    onClose={() => actions.setShowMoonModal(false)}
                    lang={flags.lang}
                />
            )}
            {modals.showStormModal && (
                <StormModal
                    weatherData={weatherData}
                    onClose={() => actions.setShowStormModal(false)}
                    lang={flags.lang}
                />
            )}
            {modals.showAqiModal && (
                <AqiModal
                    aqiData={aqiData}
                    onClose={() => actions.setShowAqiModal(false)}
                    lang={flags.lang}
                />
            )}
            {modals.showUvModal && (
                <UvModal
                    weatherData={weatherData}
                    currentUV={getCurrentUV(weatherData)}
                    onClose={() => actions.setShowUvModal(false)}
                    lang={flags.lang}
                />
            )}
            {modals.showPressureModal && (
                <PressureModal
                    weatherData={weatherData}
                    onClose={() => actions.setShowPressureModal(false)}
                    lang={flags.lang}
                />
            )}
            {modals.showComfortModal && (
                <ComfortModal
                    weatherData={weatherData}
                    currentDewPoint={getCurrentDewPoint(weatherData.current?.temperature_2m, weatherData.current?.relative_humidity_2m)}
                    onClose={() => actions.setShowComfortModal(false)}
                    lang={flags.lang}
                />
            )}
            {modals.showVisibilityModal && (
                <VisibilityModal
                    weatherData={weatherData}
                    effectiveCode={calculations.effectiveWeatherCode}
                    onClose={() => actions.setShowVisibilityModal(false)}
                    lang={flags.lang}
                />
            )}
            {modals.showCloudLayersModal && (
                <CloudLayersModal
                    weatherData={weatherData}
                    onClose={() => actions.setShowCloudLayersModal(false)}
                    lang={flags.lang}
                />
            )}
            {modals.showSnowLevelModal && (
                <SnowLevelModal
                    freezingLevel={calculations.currentFreezingLevel ?? null}
                    chartDataFull={calculations.chartDataFull || []}
                    unit={flags.unit}
                    onClose={() => actions.setShowSnowLevelModal(false)}
                    lang={flags.lang}
                />
            )}
            {modals.showWindModal && (
                <WindModal
                    weatherData={weatherData}
                    onClose={() => actions.setShowWindModal(false)}
                    lang={flags.lang}
                />
            )}
            {/* "Què vols compartir?": només amb la posició del GPS (vegeu useAppActions.handleSharePlace) */}
            {modals.showShareSheet && sharedPlace?.origin === 'gps' && (
                <SharePositionSheet
                    coords={formatCoordsText(sharedPlace.latitude, sharedPlace.longitude)}
                    placeName={sharedPlace.name}
                    texts={t.share}
                    closeLabel={t.closeWindow}
                    onSharePosition={actions.shareMyPosition}
                    onShareWeatherOnly={actions.shareWeatherOnly}
                    onCopyCoords={actions.copyCoordinates}
                    onClose={() => actions.setShowShareSheet(false)}
                />
            )}
        </Suspense>
    );
};