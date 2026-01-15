// src/App.tsx
import React, { useState, useEffect, useCallback, lazy, Suspense } from 'react';
import { WeatherParticles } from './components/WeatherIcons';
import Header from './components/Header';
import { TrendingUp, Database, ShieldCheck } from 'lucide-react';

const DayDetailModal = lazy(() => import('./components/DayDetailModal'));
const RadarModal = lazy(() => import('./components/RadarModal'));
const AromeModal = lazy(() => import('./components/AromeModal'));

import CurrentWeather from './components/CurrentWeather';
import AIInsights from './components/AIInsights';
import ForecastSection from './components/ForecastSection';
import ExpertWidgets from './components/ExpertWidgets';
import { SmartForecastCharts, MinutelyPreciseChart } from './components/WeatherCharts'; 
import WelcomeScreen from './components/WelcomeScreen';
import LoadingSkeleton from './components/LoadingSkeleton';
import ErrorBanner from './components/ErrorBanner';
import ErrorBoundary from './components/ErrorBoundary';
import Toast from './components/Toast'; 

import { usePreferences } from './hooks/usePreferences';
import { useWeather } from './hooks/useWeather';
import { useWeatherAI } from './hooks/useWeatherAI'; 
import { useWeatherCalculations } from './hooks/useWeatherCalculations';
import { TRANSLATIONS } from './constants/translations';
import { isAromeSupported } from './utils/weatherLogic'; 

// --- FOOTER ---
const Footer = ({ mode = 'dashboard' }: { mode?: 'welcome' | 'dashboard' }) => {
  const year = new Date().getFullYear();
  const isWelcome = mode === 'welcome';
  
  return (
    <footer className={`w-full flex flex-col items-center gap-4 py-8 mt-auto z-10 transition-opacity duration-1000 ${isWelcome ? 'text-slate-400 opacity-80 pb-8' : 'text-slate-500 border-t border-white/5 pt-8'}`}>
        
        <div className="flex flex-wrap justify-center items-center gap-x-6 gap-y-2 text-[10px] font-bold tracking-widest uppercase opacity-70">
            <span className="flex items-center gap-1.5 hover:text-indigo-400 transition-colors cursor-default" title="Data Source">
                <Database className="w-3 h-3" /> Open-Meteo API
            </span>
            <span className="hidden md:inline text-slate-700">|</span>
            <span className="flex items-center gap-1.5 hover:text-emerald-400 transition-colors cursor-default" title="High Resolution Model">
                <ShieldCheck className="w-3 h-3" /> AROME / GFS / ICON
            </span>
        </div>

        <div className="flex flex-col md:flex-row items-center gap-2 text-[11px] font-medium">
            <span className="opacity-90">© {year} MeteoToni AI.</span>
            <span className="hidden md:inline opacity-30 mx-2">/</span>
            <span className="opacity-50 flex items-center gap-2">
                All rights reserved. 
                <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${isWelcome ? 'bg-white/10 text-white' : 'bg-slate-800 text-slate-400'}`}>
                    v3.1.0-STABLE
                </span>
            </span>
        </div>
    </footer>
  );
};

export default function MeteoIA() {
  const [now, setNow] = useState<Date>(new Date());
  const { lang, setLang, unit, viewMode, addFavorite, removeFavorite, isFavorite } = usePreferences();
  const t = TRANSLATIONS[lang] || TRANSLATIONS['ca'];

  const { weatherData, aqiData, loading, error, notification, setNotification, fetchWeatherByCoords, handleGetCurrentLocation } = useWeather(lang, unit);
  
  // 1. Càlculs Numèrics i Gràfics
  const { 
      shiftedNow, minutelyPreciseData, currentRainProbability, currentFreezingLevel, effectiveWeatherCode, 
      currentBg, chartData24h, chartDataFull, comparisonData, weeklyExtremes 
  } = useWeatherCalculations(weatherData, unit, now);

  // 2. Intel·ligència Artificial
  const { aiAnalysis } = useWeatherAI(weatherData, aqiData, lang, unit);

  const [selectedDayIndex, setSelectedDayIndex] = useState<number | null>(null);
  const [showRadar, setShowRadar] = useState(false);
  const [showArome, setShowArome] = useState(false);

  useEffect(() => { const timer = setInterval(() => setNow(new Date()), 60000); return () => clearInterval(timer); }, []);

  const handleToggleFavorite = useCallback(() => {
    if (!weatherData?.location) return;
    const { name } = weatherData.location;
    if (isFavorite(name)) { removeFavorite(name); setNotification({ type: 'info', msg: t.favRemoved }); } 
    else { addFavorite(weatherData.location); setNotification({ type: 'success', msg: t.favAdded }); }
  }, [weatherData, isFavorite, addFavorite, removeFavorite, t, setNotification]);

  const supportsArome = weatherData?.location ? isAromeSupported(weatherData.location.latitude, weatherData.location.longitude) : false;

  // --- WELCOME SCREEN ---
  // MODIFICAT: Ara permetem que es mostri encara que estigui loading per veure l'spinner al botó
  if (!weatherData && !error) { 
    return (
      <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900 via-slate-950 to-black flex flex-col font-sans overflow-hidden selection:bg-indigo-500/30">
         <div className="fixed inset-0 opacity-30 pointer-events-none">
            <WeatherParticles code={0} />
         </div>
         <div className="w-full max-w-[1920px] mx-auto p-4 md:p-6 flex-1 flex flex-col z-10 min-h-screen">
            <Header onSearch={fetchWeatherByCoords} onLocate={handleGetCurrentLocation} loading={loading} />
            <div className="flex-1 flex flex-col items-center justify-center w-full mt-8 md:mt-0">
                {/* MODIFICAT: Passem loading com a prop */}
                <WelcomeScreen lang={lang} setLang={setLang} t={t} onLocate={handleGetCurrentLocation} loading={loading} />
            </div>
            <Footer mode="welcome" />
         </div>
      </div>
    );
  }

  // --- DASHBOARD ---
  return (
    <div className={`min-h-screen bg-gradient-to-br ${currentBg} text-slate-50 font-sans transition-all duration-1000 overflow-x-hidden selection:bg-indigo-500/30 flex flex-col`}>
      <WeatherParticles code={effectiveWeatherCode} />
      
      <div className="fixed inset-0 opacity-[0.02] pointer-events-none mix-blend-overlay" style={{backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`}}></div>

      <Toast message={notification?.msg || null} type={notification?.type} onClose={() => setNotification(null)} />

      <div className="w-full max-w-[1920px] mx-auto px-4 py-4 md:px-6 md:py-6 flex-1 flex flex-col relative z-10">
        <Header onSearch={fetchWeatherByCoords} onLocate={handleGetCurrentLocation} loading={loading} />

        <div className="mt-6 md:mt-10 flex-1">
            {error && <ErrorBanner message={error} />}
            {/* Mantinc LoadingSkeleton només si ja estem dins del dashboard i canviem de ciutat */}
            {loading && !weatherData && <LoadingSkeleton />}

            {weatherData && !loading && (
            <div className="animate-in fade-in slide-in-from-bottom-8 duration-700">
                
                <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
                    
                    <div className="xl:col-span-4 flex flex-col gap-6 xl:sticky xl:top-6">
                        <CurrentWeather 
                            data={weatherData} effectiveCode={effectiveWeatherCode} unit={unit} lang={lang} shiftedNow={shiftedNow}
                            isFavorite={isFavorite(weatherData.location?.name || "")} onToggleFavorite={handleToggleFavorite}
                            onShowRadar={() => setShowRadar(true)} onShowArome={() => setShowArome(true)}
                            aqiData={aqiData} showAromeBtn={supportsArome}
                        />

                        {minutelyPreciseData && (
                            <div className="bento-card p-5 animate-in zoom-in-95 duration-500 border-indigo-500/30 bg-indigo-950/20 shadow-lg shadow-indigo-900/20">
                                <div className="flex items-center gap-2 mb-3 text-indigo-200">
                                     <svg className="w-4 h-4 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                                     </svg>
                                     <span className="text-xs font-bold uppercase tracking-widest">{t.preciseRain || "Previsió 1h (DEBUG)"}</span>
                                </div>
                                <MinutelyPreciseChart 
                                    data={minutelyPreciseData} 
                                    label="" 
                                    currentPrecip={chartData24h?.[0]?.precip || 0} 
                                />
                            </div>
                        )}

                        <ErrorBoundary>
                            <div className="bento-card p-6 min-h-[200px] flex flex-col justify-center">
                                <AIInsights 
                                    analysis={aiAnalysis} 
                                    minutelyData={minutelyPreciseData} 
                                    currentPrecip={chartData24h?.[0]?.precip || 0} 
                                    lang={lang}
                                />
                            </div>
                        </ErrorBoundary>
                    </div>

                    <div className="xl:col-span-8 flex flex-col gap-6">
                        {viewMode === 'expert' && (
                            <div className="animate-in fade-in duration-700">
                                <h3 className="label-upper px-1 mb-4">Mètriques Avançades</h3>
                                <ErrorBoundary>
                                    <ExpertWidgets 
                                        weatherData={weatherData} aqiData={aqiData} lang={lang} unit={unit} 
                                        shiftedNow={shiftedNow} freezingLevel={currentFreezingLevel}
                                    />
                                </ErrorBoundary>
                            </div>
                        )}

                        <ErrorBoundary>
                            <ForecastSection 
                                chartData={chartDataFull} 
                                comparisonData={comparisonData} dailyData={weatherData.daily}
                                weeklyExtremes={weeklyExtremes} unit={unit} lang={lang} onDayClick={setSelectedDayIndex}
                                comparisonEnabled={viewMode === 'expert'}
                                showCharts={false} 
                            />
                        </ErrorBoundary>
                    </div>
                </div>

                {viewMode === 'expert' && (
                    <div className="mt-8 animate-in fade-in slide-in-from-bottom-12 duration-1000 w-full">
                         <div className="bento-card p-6 md:p-8">
                            <h3 className="label-upper mb-8 flex items-center gap-2 text-lg">
                                <TrendingUp className="w-5 h-5 text-emerald-400"/> {t.trend24h}
                            </h3>
                            <SmartForecastCharts 
                                data={chartData24h} 
                                comparisonData={comparisonData} 
                                unit={unit === 'F' ? '°F' : '°C'} lang={lang} 
                            />
                        </div>
                    </div>
                )}

            </div>
            )}
        </div>

        <Footer mode="dashboard" />

        <Suspense fallback={null}>
            {selectedDayIndex !== null && weatherData && (
                <DayDetailModal 
                    weatherData={weatherData} 
                    hourlyData={chartDataFull} 
                    selectedDayIndex={selectedDayIndex} 
                    onClose={() => setSelectedDayIndex(null)} 
                    unit={unit} lang={lang} shiftedNow={shiftedNow} 
                />
            )}
            {showRadar && weatherData && <RadarModal lat={weatherData.location?.latitude || 0} lon={weatherData.location?.longitude || 0} onClose={() => setShowRadar(false)} lang={lang} />}
            {showArome && weatherData && <AromeModal lat={weatherData.location?.latitude || 0} lon={weatherData.location?.longitude || 0} onClose={() => setShowArome(false)} lang={lang} />}
        </Suspense>
      </div>
    </div>
  );
}