// src/views/DashboardView.tsx
import React, { lazy, Suspense } from 'react';

// Layouts & Components Static
import { DashboardLayout } from '../layouts/DashboardLayout';
import Header from '../components/Header';
import Footer from '../components/Footer';
import CurrentWeather from '../components/CurrentWeather';
import LoadingSkeleton from '../components/LoadingSkeleton';
import ErrorBanner from '../components/ErrorBanner';
import ErrorBoundary from '../components/ErrorBoundary';
import Toast from '../components/Toast'; 
import DebugPanel from '../components/DebugPanel';
import { MinutelyPreciseChart, SmartForecastCharts } from '../components/WeatherCharts'; 
import { useAppController } from '../hooks/useAppController';

// Lazy Components (Moguts des de App.tsx)
const Forecast24h = lazy(() => import('../components/Forecast24h'));
const AIInsights = lazy(() => import('../components/AIInsights'));
const ForecastSection = lazy(() => import('../components/ForecastSection'));
const ExpertWidgets = lazy(() => import('../components/ExpertWidgets'));
const DayDetailModal = lazy(() => import('../components/DayDetailModal'));
const RadarModal = lazy(() => import('../components/RadarModal'));
const AromeModal = lazy(() => import('../components/AromeModal'));

const SectionSkeleton = () => (
    <div className="w-full h-48 bg-white/5 animate-pulse rounded-[2rem] border border-white/5 my-4" />
);

type AppController = ReturnType<typeof useAppController>;

interface DashboardViewProps {
  controller: AppController;
}

export default function DashboardView({ controller }: DashboardViewProps) {
  const { state, actions, flags, modals, t } = controller;
  const { weatherData, calculations } = state;

  // Protecció de tipus (encara que App.tsx ja ho controla)
  if (!weatherData) return null;

  return (
    <DashboardLayout
      weatherCode={calculations.effectiveWeatherCode}
      header={
        <Header 
            onSearch={actions.fetchWeatherByCoords}
            onLocate={actions.handleGetCurrentLocation} 
            loading={state.loading}
            viewMode={flags.viewMode}
            setViewMode={actions.setViewMode}
            onDebugToggle={actions.toggleDebug}
        />
      }
      footer={<Footer className="mt-auto" />}
      toast={
        <Toast 
            message={state.notification?.msg || null} 
            type={state.notification?.type} 
            onClose={actions.dismissNotification} 
        />
      }
      debugPanel={
        flags.showDebug && (
            <DebugPanel 
                weatherData={weatherData} 
                supportsArome={flags.supportsArome} 
                error={state.error} 
            />
        )
      }
      modals={
        <Suspense fallback={null}>
            {modals.selectedDayIndex !== null && weatherData && (
                <DayDetailModal 
                    weatherData={weatherData} 
                    hourlyData={calculations.chartDataFull} 
                    selectedDayIndex={modals.selectedDayIndex} 
                    onClose={() => actions.setSelectedDayIndex(null)} 
                    unit={flags.unit} 
                    lang={flags.lang} 
                    shiftedNow={calculations.shiftedNow} 
                />
            )}
            {modals.showRadar && weatherData && (
                <RadarModal 
                    lat={weatherData.location?.latitude || 0} 
                    lon={weatherData.location?.longitude || 0} 
                    onClose={() => actions.setShowRadar(false)} 
                    lang={flags.lang} 
                />
            )}
            {modals.showArome && weatherData && (
                <AromeModal 
                    lat={weatherData.location?.latitude || 0} 
                    lon={weatherData.location?.longitude || 0} 
                    onClose={() => actions.setShowArome(false)} 
                    lang={flags.lang} 
                />
            )}
        </Suspense>
      }
    >
        <div className="mt-6 md:mt-10 flex-1">
            {state.error && <ErrorBanner message={state.error} />}
            {state.loading && !weatherData && <LoadingSkeleton />}

            {!state.loading && (
            <div className="animate-in fade-in slide-in-from-bottom-8 duration-700 flex flex-col gap-8">
                
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

                <Suspense fallback={<SectionSkeleton />}>
                    <AIInsights analysis={state.aiAnalysis} lang={flags.lang} />
                </Suspense>

                <ErrorBoundary>
                    <div className="flex flex-col gap-8">
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
                        
                        <Suspense fallback={<SectionSkeleton />}>
                            <Forecast24h data={weatherData} lang={flags.lang} unit={flags.unit} />
                        </Suspense>

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
            )}
        </div>
    </DashboardLayout>
  );
}