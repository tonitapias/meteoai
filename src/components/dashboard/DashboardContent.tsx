// src/components/dashboard/DashboardContent.tsx
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef } from 'react';
import { useAppContext } from '../../context/AppContext';
import { useDetailHint } from '../../hooks/useDetailHint';
import { usePlanetHeadline } from '../../hooks/usePlanetHeadline';
import { getSafeLatitude } from '../../utils/weatherMath';
import { findNowIndex } from '../../utils/hourlyChartSeries';
import { buildDetailTeaser } from '../../utils/detailTeaser';
import { isRegionalModelActive } from '../../constants/regionalModels';
import type { LocationMeta } from '../../types/weatherLogicTypes';
import { CompleteViewHeading, MoreDetailPrompt, type TakeFocusRequest } from './ViewModeSections';

// Components estàtics
import CurrentWeather from '../CurrentWeather';
import LoadingSkeleton from '../LoadingSkeleton';
import ErrorBanner from '../ErrorBanner';
import ErrorBoundary from '../ErrorBoundary';
import OfflineSnapshotBanner from '../OfflineSnapshotBanner';
import { MinutelyPreciseChart } from '../WeatherCharts';

// Lazy loading
const Forecast24h = lazy(() => import('../Forecast24h'));
const AIInsights = lazy(() => import('../AIInsights'));
const OfficialAlertBanner = lazy(() => import('../OfficialAlertBanner'));
const RadarRealityBanner = lazy(() => import('../RadarRealityBanner'));
const RadarNowcastBanner = lazy(() => import('../RadarNowcastBanner'));
const LightningBanner = lazy(() => import('../LightningBanner'));
const ForecastSection = lazy(() => import('../ForecastSection'));
const ExpertWidgets = lazy(() => import('../ExpertWidgets'));
// Només es mostra en Mode Expert — mateix cas que ExpertWidgets de dalt. Viu en un
// fitxer propi (SmartForecastCharts.tsx) en lloc de WeatherCharts.tsx perquè aquest
// últim també l'importa MinutelyPreciseChart de manera estàtica (necessari en Mode
// Bàsic): compartir fitxer feia que Rollup mantingués tot el mòdul al chunk principal.
const SmartForecastCharts = lazy(() => import('../SmartForecastCharts'));
// També només en Mode Expert: l'última secció, «Més enllà del teu cel».
const PlanetExtremesCard = lazy(() => import('../planet/PlanetExtremesCard'));

// SPATIAL UI: Skeleton amb estètica Dark Dashboard (baix contrast, sense colors estridents)
const SectionSkeleton = () => (
    <div className="w-full h-48 bg-[#0B0C15]/50 animate-pulse rounded-[2rem] border border-white/5 my-4 shadow-inner" />
);

export const DashboardContent = () => {
    // OBTENIM TOT DIRECTAMENT DEL CONTEXT
    const { state, actions, flags, t } = useAppContext();
    const { weatherData, calculations } = state;
    // 'expert' = vista completa (vegeu ViewMode a usePreferences.ts)
    const isExpert = flags.viewMode === 'expert';
    const { setViewMode } = actions;

    // Qui ha entrat a la vista completa ja la coneix: la targeta "Vols més detall?" passa a una línia.
    // També val per a qui ja la tenia desada d'abans (en entrar, ja és 'expert').
    const { compact: detailHintCompact, markCompact } = useDetailHint();
    useEffect(() => {
        if (isExpert && !detailHintCompact) markCompact();
    }, [isExpert, detailHintCompact, markCompact]);

    const focusRequestRef = useRef<'prompt' | 'heading' | null>(null);
    const takeFocus = useCallback<TakeFocusRequest>((target) => {
        if (focusRequestRef.current !== target) return false;
        focusRequestRef.current = null;
        return true;
    }, []);
    const showCompleteView = () => {
        focusRequestRef.current = 'heading';
        setViewMode('expert');
    };
    const backToEssential = () => {
        focusRequestRef.current = 'prompt';
        setViewMode('basic');
    };
    const dismissDetailPrompt = () => {
        focusRequestRef.current = 'prompt';
        markCompact();
    };

    const nowMs = state.now.getTime();
    const currentConditions = weatherData?.current;
    // El fenomen gros del dia (cicló de categoria 4 o 5): només a l'essencial i quan la previsió ja hi és.
    const planetHeadline = usePlanetHeadline(!isExpert && !!currentConditions, flags.lang);
    const detailTeaser = useMemo(() => {
        if (isExpert || !currentConditions) return [];
        return buildDetailTeaser({
            current: currentConditions,
            aqiCurrent: (state.aqiData as Record<string, unknown> | null)?.current,
            effectiveCode: calculations.effectiveWeatherCode,
            nowMs,
            lang: flags.lang,
            templates: t.viewModes,
            planet: planetHeadline,
        });
    }, [isExpert, currentConditions, state.aqiData, calculations.effectiveWeatherCode, nowMs, flags.lang, t.viewModes, planetHeadline]);

    // Gestió d'estats de càrrega i error
    if (state.error) return <ErrorBanner message={state.error} />;
    // openingLink: el primer render d'un enllaç, abans que l'efecte que el carrega hagi posat `loading`.
    if ((state.loading || state.openingLink) && !weatherData) return <LoadingSkeleton />;
    if (!weatherData) return null;

    // Forcem el tipatge de location per corregir la pèrdua d'inferència (Risc Zero)
    const loc = weatherData.location as LocationMeta | undefined;

    return (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-700 flex flex-col gap-6 sm:gap-8 relative z-10 w-full max-w-7xl mx-auto">

            {/* 0. PREVISIÓ DESADA (no se n'ha pogut obtenir cap de nova): abans de cap número */}
            {weatherData.offlineSnapshot && (
                <OfflineSnapshotBanner
                    info={weatherData.offlineSnapshot}
                    place={loc?.name ?? null}
                    text={t.offlineSnapshot}
                    now={state.now.getTime()}
                    onRetry={actions.refreshLoadedLocation}
                />
            )}

            {/* 1. SECCIÓ PRINCIPAL */}
            <CurrentWeather 
                data={weatherData} 
                effectiveCode={calculations.effectiveWeatherCode}
                effectiveCloudCover={calculations.effectiveCloudCover}
                unit={flags.unit} 
                lang={flags.lang} 
                shiftedNow={calculations.shiftedNow}
                isFavorite={!!loc && flags.isFavorite(loc)}
                onToggleFavorite={actions.handleToggleFavorite}
                onShare={actions.handleSharePlace}
                sharedPlace={state.sharedPlace}
                onShowRadar={() => actions.setShowRadar(true)}
                onShowRegionalModel={() => actions.setShowRegionalModel(true)}
                aqiData={state.aqiData}
                activeRegionalModel={flags.activeRegionalModel}
            />

            {/* 2. GRÀFIC PRECIPITACIÓ MINUTAL (porta la seva targeta: sense pluja la pròxima hora no pinta res) */}
            <MinutelyPreciseChart
                data={calculations.minutelyPreciseData}
                label={t.preciseRain || "SCAN PRECIPITACIÓ (1H)"}
                lang={flags.lang}
                currentPrecip={calculations.chartData24h?.[0]?.precip || 0}
            />

            {/* 2a-0. LLAMPS OBSERVATS A PROP (Meteosat-12): el senyal més urgent, abans que la pluja */}
            <Suspense fallback={null}>
                <LightningBanner lightning={state.lightning} lang={flags.lang} now={state.now.getTime()} onShowRadar={() => actions.setShowRadar(true)} />
            </Suspense>

            {/* 2a-i. TEMPORITZACIÓ NOWCAST (quan començarà/acabarà la pluja segons el radar) */}
            <Suspense fallback={null}>
                <RadarNowcastBanner lat={loc?.latitude} lon={loc?.longitude} lang={flags.lang} />
            </Suspense>

            {/* 2a. REALITAT DE RADAR (el model preveu sec però el radar detecta pluja real) */}
            <Suspense fallback={null}>
                <RadarRealityBanner
                    lat={loc?.latitude}
                    lon={loc?.longitude}
                    modelMmPerHourNow={(calculations.minutelyPreciseData?.[0] || 0) * 4}
                    lang={flags.lang}
                />
            </Suspense>

            {/* 2b. ALERTA METEOROLÒGICA OFICIAL (font: servei meteorològic nacional) */}
            <Suspense fallback={null}>
                <OfficialAlertBanner lat={loc?.latitude} lon={loc?.longitude} lang={flags.lang} />
            </Suspense>

            {/* 3. INTEL·LIGÈNCIA ARTIFICIAL */}
            <Suspense fallback={<SectionSkeleton />}>
                <AIInsights analysis={state.aiAnalysis} lang={flags.lang} />
            </Suspense>

            <ErrorBoundary>
                <div className="flex flex-col gap-6 sm:gap-8">
                    {/* 4. VISTA COMPLETA (ginys de detall) o, a la vista essencial, la targeta que la dona a conèixer */}
                    {!isExpert && (
                        <MoreDetailPrompt
                            compact={detailHintCompact}
                            teaser={detailTeaser}
                            strings={t.viewModes}
                            onShow={showCompleteView}
                            onDismiss={dismissDetailPrompt}
                            takeFocus={takeFocus}
                        />
                    )}
                    {isExpert && (
                        <div className="flex flex-col gap-3">
                            <CompleteViewHeading strings={t.viewModes} onBack={backToEssential} takeFocus={takeFocus} />
                            <Suspense fallback={<SectionSkeleton />}>
                                <ExpertWidgets
                                    weatherData={weatherData}
                                    aqiData={state.aqiData}
                                    lang={flags.lang}
                                    unit={flags.unit}
                                    freezingLevel={calculations.currentFreezingLevel ?? null}
                                    chartDataFull={calculations.chartDataFull}
                                    effectiveCode={calculations.effectiveWeatherCode}
                                    now={state.now.getTime()}
                                    onShowSolarModal={() => actions.setShowSolarModal(true)}
                                    onShowMoonModal={() => actions.setShowMoonModal(true)}
                                    onShowStormModal={() => actions.setShowStormModal(true)}
                                    onShowAqiModal={() => actions.setShowAqiModal(true)}
                                    onShowUvModal={() => actions.setShowUvModal(true)}
                                    onShowPressureModal={() => actions.setShowPressureModal(true)}
                                    onShowComfortModal={() => actions.setShowComfortModal(true)}
                                    onShowVisibilityModal={() => actions.setShowVisibilityModal(true)}
                                    onShowCloudLayersModal={() => actions.setShowCloudLayersModal(true)}
                                    onShowSnowLevelModal={() => actions.setShowSnowLevelModal(true)}
                                    onShowWindModal={() => actions.setShowWindModal(true)}
                                />
                            </Suspense>
                        </div>
                    )}
                    
                    {/* 5. PREVISIÓ 24H */}
                    <Suspense fallback={<SectionSkeleton />}>
                        <Forecast24h data={weatherData} lang={flags.lang} unit={flags.unit} />
                    </Suspense>

                    {/* 6. PREVISIÓ SETMANAL */}
                    <Suspense fallback={<SectionSkeleton />}>
                        <ForecastSection
                            chartData={calculations.chartDataFull || []}
                            dailyData={weatherData.daily}
                            dayHourCodes={calculations.dayHourCodes}
                            dailyComparison={weatherData.dailyComparison}
                            regionalModelLabel={isRegionalModelActive(weatherData.current?.source) ? (weatherData.current.source as string) : null}
                            weeklyExtremes={calculations.weeklyExtremes}
                            lang={flags.lang}
                            onDayClick={actions.setSelectedDayIndex}
                            latitude={getSafeLatitude(weatherData.location)}
                        />
                    </Suspense>

                    {/* 7. GRÀFICS AVANÇATS (MODE EXPERT) */}
                    {isExpert && (
                        <div className="bento-card p-4 sm:p-6 md:p-8 bg-[#0B0C15]/90 border border-white/10 shadow-2xl">
                            <Suspense fallback={<SectionSkeleton />}>
                                <SmartForecastCharts
                                    data={calculations.chartSeries?.primary ?? []}
                                    comparisonData={calculations.chartSeries?.comparison ?? null}
                                    unit={flags.unit === 'F' ? '°F' : '°C'}
                                    lang={flags.lang}
                                    regionalModelLabel={isRegionalModelActive(weatherData.current?.source) ? (weatherData.current.source as string) : null}
                                    nowIndex={findNowIndex(calculations.chartSeries?.primary ?? [], weatherData.current?.time)}
                                    updatedAt={weatherData.offlineSnapshot?.issuedAt ?? weatherData.current?.time ?? null}
                                />
                            </Suspense>
                        </div>
                    )}

                    {/* 8. EXTREMS DEL PLANETA (MODE EXPERT): primer el teu cel, al final el planeta */}
                    {isExpert && (
                        <Suspense fallback={<SectionSkeleton />}>
                            <PlanetExtremesCard lang={flags.lang} unit={flags.unit} onOpen={actions.setPlanetModalTab} />
                        </Suspense>
                    )}
                </div>
            </ErrorBoundary>
        </div>
    );
};