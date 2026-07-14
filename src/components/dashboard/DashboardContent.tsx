// src/components/dashboard/DashboardContent.tsx
import { lazy, Suspense } from 'react';
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

// SPATIAL UI: Skeleton amb estètica Dark Dashboard (baix contrast, sense colors estridents)
const SectionSkeleton = () => (
    <div className="w-full h-48 bg-[#0B0C15]/50 animate-pulse rounded-[2rem] border border-white/5 my-4 shadow-inner" />
);

interface LocationMeta {
    name: string;
    [key: string]: unknown;
}

export const DashboardContent = () => {
    // OBTENIM TOT DIRECTAMENT DEL CONTEXT
    const { state, actions, flags, t } = useAppContext();
    const { weatherData, calculations } = state;

    // Gestió d'estats de càrrega i error
    if (state.error) return <ErrorBanner message={state.error} />;
    if (state.loading && !weatherData) return <LoadingSkeleton />;
    if (!weatherData) return null;

    // Forcem el tipatge de location per corregir la pèrdua d'inferència (Risc Zero)
    const loc = weatherData.location as LocationMeta | undefined;
    const isExpert = flags.viewMode === 'expert';

    return (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-700 flex flex-col gap-6 sm:gap-8 relative z-10 w-full max-w-7xl mx-auto">
            
            {/* 1. SECCIÓ PRINCIPAL */}
            <CurrentWeather 
                data={weatherData} 
                effectiveCode={calculations.effectiveWeatherCode ?? 0} 
                unit={flags.unit} 
                lang={flags.lang} 
                shiftedNow={calculations.shiftedNow}
                isFavorite={flags.isFavorite(loc?.name || "")} 
                onToggleFavorite={actions.handleToggleFavorite}
                onShowRadar={() => actions.setShowRadar(true)} 
                onShowArome={() => actions.setShowArome(true)}
                aqiData={state.aqiData} 
                showAromeBtn={flags.supportsArome}
            />

            {/* 2. GRÀFIC PRECIPITACIÓ MINUTAL */}
            {calculations.minutelyPreciseData && (
                <div className="bento-card p-5 animate-in zoom-in-95 duration-500 border border-indigo-500/30 bg-[#060913]/90 shadow-[0_10px_30px_rgba(30,27,75,0.6)] backdrop-blur-xl relative overflow-hidden preserve-3d">
                    <div className="absolute inset-0 bg-indigo-500/5 animate-pulse pointer-events-none"></div>
                    <div className="relative z-10 [transform:translateZ(10px)]">
                        <MinutelyPreciseChart 
                            data={calculations.minutelyPreciseData} 
                            label={t.preciseRain || "SCAN PRECIPITACIÓ (1H)"} 
                            currentPrecip={calculations.chartData24h?.[0]?.precip || 0} 
                        />
                    </div>
                </div>
            )}

            {/* 3. INTEL·LIGÈNCIA ARTIFICIAL */}
            <Suspense fallback={<SectionSkeleton />}>
                <AIInsights analysis={state.aiAnalysis} lang={flags.lang} />
            </Suspense>

            <ErrorBoundary>
                <div className="flex flex-col gap-6 sm:gap-8">
                    {/* 4. GINYS EXPERTS */}
                    {isExpert && (
                        <Suspense fallback={<SectionSkeleton />}>
                            <ExpertWidgets 
                                weatherData={weatherData} 
                                aqiData={state.aqiData} 
                                lang={flags.lang} 
                                unit={flags.unit} 
                                freezingLevel={calculations.currentFreezingLevel ?? null}
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
                            chartData={calculations.chartDataFull || []} 
                            comparisonData={calculations.comparisonData || null} 
                            dailyData={weatherData.daily}
                            weeklyExtremes={calculations.weeklyExtremes} 
                            unit={flags.unit} 
                            lang={flags.lang} 
                            onDayClick={actions.setSelectedDayIndex}
                            comparisonEnabled={isExpert} 
                            showCharts={false} 
                        />
                    </Suspense>

                    {/* 7. GRÀFICS AVANÇATS (MODE EXPERT) */}
                    {isExpert && (
                        <div className="bento-card p-4 sm:p-6 md:p-8 bg-[#0B0C15]/90 border border-white/10 shadow-2xl backdrop-blur-xl">
                            <SmartForecastCharts 
                                data={calculations.chartData24h || []} 
                                comparisonData={calculations.comparisonData || null} 
                                unit={flags.unit === 'F' ? '°F' : '°C'} 
                                lang={flags.lang} 
                            />
                        </div>
                    )}
                </div>
            </ErrorBoundary>
        </div>
    );
};