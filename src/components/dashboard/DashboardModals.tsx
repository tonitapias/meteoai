import { lazy, Suspense, useEffect } from 'react'; // NOU: Importem useEffect
import { useTranslation } from 'react-i18next'; // NOU: Importem el hook d'idioma

// 1. IMPORTEM EL CONTEXT
import { useAppContext } from '../../context/AppContext';
import type { LocationMeta } from '../../types/weatherLogicTypes';
import { getCurrentUV } from '../../utils/uvIndexUtils';
import { getCurrentDewPoint } from '../../utils/weatherMath';

// Lazy loading dels modals (es manté igual)
const DayDetailModal = lazy(() => import('../DayDetailModal'));
const RadarModal = lazy(() => import('../RadarModal'));
const RegionalModelModal = lazy(() => import('../RegionalModelModal'));
const SolarModal = lazy(() => import('../SolarModal'));
const MoonModal = lazy(() => import('../MoonModal'));
const StormModal = lazy(() => import('../StormModal'));
const AqiModal = lazy(() => import('../AqiModal'));
const UvModal = lazy(() => import('../UvModal'));
const PressureModal = lazy(() => import('../PressureModal'));
const ComfortModal = lazy(() => import('../ComfortModal'));
const VisibilityModal = lazy(() => import('../VisibilityModal'));
const CloudLayersModal = lazy(() => import('../CloudLayersModal'));
const SnowLevelModal = lazy(() => import('../SnowLevelModal'));

// JA NO NECESSITEM INTERFACE PROPS NI TIPUS COMPLEXOS

export const DashboardModals = () => {
    // 2. RECUPEREM DADES DEL CONTEXT
    const { state, actions, flags, modals } = useAppContext();
    const { weatherData, aqiData, calculations } = state;

    // NOU: Instanciem el motor de traduccions
    const { i18n } = useTranslation();

    // NOU: Sincronitzem l'idioma global amb el motor i18next
    // Ho col·loquem ABANS de qualsevol `return` per no trencar les regles de React
    useEffect(() => {
        if (flags.lang && i18n.language !== flags.lang) {
            i18n.changeLanguage(flags.lang);
        }
    }, [flags.lang, i18n]);

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
                />
            )}
            {modals.showSolarModal && (
                <SolarModal
                    weatherData={weatherData}
                    onClose={() => actions.setShowSolarModal(false)}
                    lang={flags.lang}
                />
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
        </Suspense>
    );
};