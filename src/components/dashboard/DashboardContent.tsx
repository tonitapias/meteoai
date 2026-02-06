// src/components/dashboard/DashboardContent.tsx
import React, { lazy, Suspense } from 'react';
// ELIMINEM useAppController vell
// NOU IMPORT:
import { useAppContext } from '../../context/AppContext';

// Components estàtics
import CurrentWeather from '../CurrentWeather';
import LoadingSkeleton from '../LoadingSkeleton';
import ErrorBanner from '../ErrorBanner';
import ErrorBoundary from '../ErrorBoundary';
import { MinutelyPreciseChart, SmartForecastCharts } from '../WeatherCharts';

// Lazy loading
const Forecast24h = lazy(() => import('../Forecast24h'));
const AIInsights = lazy(() => import('../AIInsights'));
const ForecastSection = lazy(() => import('../ForecastSection'));
const ExpertWidgets = lazy(() => import('../ExpertWidgets'));

const SectionSkeleton = () => (
    <div className="w-full h-48 bg-white/5 animate-pulse rounded-[2rem] border border-white/5 my-4" />
);

// JA NO NECESSITEM INTERFACE PROPS NI TIPUS

export const DashboardContent = () => {
    // 1. OBTENIM TOT DIRECTAMENT DEL CONTEXT
    const { state, actions, flags, t } = useAppContext();
    const { weatherData, calculations } = state;

    // Gestió d'estats de càrrega i error
    if (state.error) return <ErrorBanner message={state.error} />;
    if (state.loading && !weatherData) return <LoadingSkeleton />;
    if (!weatherData) return null;

    return (
        <div className="animate-in fade-in slide-in-from-bottom-8 duration-700 flex flex-col gap-8">
            
            {/* 1. SECCIÓ PRINCIPAL */}
            <CurrentWeather 
                data={weatherData} 
                effectiveCode={calculations.effectiveWeatherCode} 
                unit={flags.unit} 
                lang={flags.lang} 
                shiftedNow={calculations.shiftedNow}
                isFavorite={flags.isFavorite(weatherData.location?.name || "")} 
                onToggleFavorite={actions.handleToggleFavorite}
                onShowRadar={() => actions.setShowRadar(true)} 
                onShowArome={() => actions.setShowArome(true)}
                aqiData={state.aqiData} 
                showAromeBtn={flags.supportsArome}
            />

            {/* 2. GRÀFIC PRECIPITACIÓ MINUTAL */}
            {calculations.minutelyPreciseData && (
                <div className="bento-card p-5 animate-in zoom-in-95 duration-500 border border-indigo-500/20 bg-indigo-950/10 shadow-[0_0_20px_rgba(30,27,75,0.5)] backdrop-blur-sm relative overflow-hidden">
                        <div className="absolute inset-0 bg-indigo-500/5 animate-pulse pointer-events-none"></div>
                    <MinutelyPreciseChart 
                        data={calculations.minutelyPreciseData} 
                        label={t.preciseRain || "SCAN PRECIPITACIÓ (1H)"} 
                        currentPrecip={calculations.chartData24h?.[0]?.precip || 0} 
                    />
                </div>
            )}

            {/* 3. INTEL·LIGÈNCIA ARTIFICIAL */}
            <Suspense fallback={<SectionSkeleton />}>
                <AIInsights analysis={state.aiAnalysis} lang={flags.lang} />
            </Suspense>

            <ErrorBoundary>
                <div className="flex flex-col gap-8">
                    {/* 4. GINYS EXPERTS */}
                    {flags.viewMode === 'expert' && (
                        <Suspense fallback={<SectionSkeleton />}>
                            <ExpertWidgets 
                                weatherData={weatherData} 
                                aqiData={state.aqiData} 
                                lang={flags.lang} 
                                unit={flags.unit} 
                                freezingLevel={calculations.currentFreezingLevel}
                            />
                        </Suspense>
                    )}
                    
                    {/* 5. PREVISIÓ 24H */}
                    <Suspense fallback={<SectionSkeleton />}>
                        <Forecast24h data={weatherData} lang={flags.lang} unit={flags.unit} />
                    </Suspense>

                    {/* 6. PREVISIÓ SETMANAL */}
                    <Suspense fallback={<SectionSkeleton />}>
                        <ForecastSection 
                            chartData={calculations.chartDataFull} 
                            comparisonData={calculations.comparisonData} 
                            dailyData={weatherData.daily}
                            weeklyExtremes={calculations.weeklyExtremes} 
                            unit={flags.unit} 
                            lang={flags.lang} 
                            onDayClick={actions.setSelectedDayIndex}
                            comparisonEnabled={flags.viewMode === 'expert'} 
                            showCharts={false} 
                        />
                    </Suspense>

                    {/* 7. GRÀFICS AVANÇATS (MODE EXPERT) */}
                    {flags.viewMode === 'expert' && (
                        <div className="bento-card p-6 md:p-8 bg-[#0B0C15] border border-white/5 shadow-2xl">
                            <SmartForecastCharts 
                                data={calculations.chartData24h} 
                                comparisonData={calculations.comparisonData} 
                                unit={flags.unit === 'F' ? '°F' : '°C'} 
                                lang={flags.lang} 
                                showHumidity={true}
                            />
                        </div>
                    )}
                </div>
            </ErrorBoundary>
        </div>
    );
};