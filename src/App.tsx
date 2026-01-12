// src/App.tsx
import React, { useState, useEffect, useCallback, lazy, Suspense } from 'react';
import { WeatherParticles } from './components/WeatherIcons';
import Header from './components/Header';

const DayDetailModal = lazy(() => import('./components/DayDetailModal'));
const RadarModal = lazy(() => import('./components/RadarModal'));
const AromeModal = lazy(() => import('./components/AromeModal'));

import CurrentWeather from './components/CurrentWeather';
import AIInsights from './components/AIInsights';
import ForecastSection from './components/ForecastSection';
import ExpertWidgets from './components/ExpertWidgets';
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

// --- COMPONENT DE PEU DE PÀGINA REUTILITZABLE ---
const Footer = () => (
  <div className="w-full py-8 mt-auto border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-4 text-[10px] text-slate-500 font-medium tracking-wider uppercase">
      {/* Esquerra: Copyright */}
      <div className="flex items-center gap-2">
          <span className="font-bold text-slate-400">© {new Date().getFullYear()} Meteo Toni AI</span>
          <span className="hidden md:inline text-slate-700">|</span>
          <span>Designed by Toni</span>
      </div>

      {/* Dreta: Dades i Versió */}
      <div className="flex items-center gap-4 opacity-70">
          <span className="hover:text-indigo-400 transition-colors cursor-help" title="Motor de predicció">v2.5 Pro</span>
          <span className="w-1 h-1 bg-slate-700 rounded-full"></span>
          <span>Powered by <span className="font-bold text-slate-400">Open-Meteo</span> & <span className="font-bold text-slate-400">Google Gemini</span></span>
      </div>
  </div>
);

export default function MeteoIA() {
  const [now, setNow] = useState<Date>(new Date());
  const { lang, setLang, unit, viewMode, addFavorite, removeFavorite, isFavorite, favorites } = usePreferences();
  const t = TRANSLATIONS[lang] || TRANSLATIONS['ca'];

  const { weatherData, aqiData, loading, error, notification, setNotification, fetchWeatherByCoords, handleGetCurrentLocation } = useWeather(lang, unit);
  const { shiftedNow, minutelyPreciseData, currentRainProbability, currentFreezingLevel, effectiveWeatherCode, currentBg, chartData, comparisonData, weeklyExtremes } = useWeatherCalculations(weatherData, unit, now);
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

  // --- VISTA 1: PANTALLA D'INICI (WELCOME) ---
  if (!weatherData && !loading && !error && favorites.length === 0) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col font-sans transition-colors duration-1000">
         <Header onSearch={fetchWeatherByCoords} onLocate={handleGetCurrentLocation} loading={loading} />
         <div className="flex-1 flex flex-col items-center justify-center p-6 w-full max-w-4xl mx-auto">
            {/* AQUÍ ESTÀ EL CANVI CLAU: connectem onLocate */}
            <WelcomeScreen 
                lang={lang} 
                setLang={setLang} 
                t={t} 
                onLocate={handleGetCurrentLocation} 
            />
         </div>
         {/* Footer a la pantalla d'inici */}
         <div className="px-6 md:px-8 w-full max-w-[1800px] mx-auto">
            <Footer />
         </div>
      </div>
    );
  }

  // --- VISTA 2: APP PRINCIPAL ---
  return (
    <div className={`min-h-screen bg-gradient-to-br ${currentBg} text-slate-50 font-sans transition-all duration-1000 overflow-x-hidden selection:bg-indigo-500/30 flex flex-col`}>
      <WeatherParticles code={effectiveWeatherCode} />
      
      {/* Texture Overlay */}
      <div className="fixed inset-0 opacity-[0.03] pointer-events-none" style={{backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`}}></div>

      <Toast message={notification?.msg || null} type={notification?.type} onClose={() => setNotification(null)} />

      <div className="w-full max-w-[1800px] mx-auto px-4 py-4 md:px-8 md:py-8 flex-1 flex flex-col relative z-10">
        <Header onSearch={fetchWeatherByCoords} onLocate={handleGetCurrentLocation} loading={loading} />

        <div className="mt-8 flex-1">
            {error && <ErrorBanner message={error} />}
            {loading && !weatherData && <LoadingSkeleton />}

            {weatherData && !loading && (
            <div className="animate-in fade-in slide-in-from-bottom-6 duration-700">
                
                {/* LAYOUT PROFESSIONAL */}
                <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 items-start">
                    
                    {/* COLUMNA ESQUERRA (FIX) */}
                    <div className="xl:col-span-4 flex flex-col gap-6 xl:sticky xl:top-8">
                        <CurrentWeather 
                            data={weatherData} effectiveCode={effectiveWeatherCode} unit={unit} lang={lang} shiftedNow={shiftedNow}
                            isFavorite={isFavorite(weatherData.location?.name || "")} onToggleFavorite={handleToggleFavorite}
                            onShowRadar={() => setShowRadar(true)} onShowArome={() => setShowArome(true)}
                            aqiData={aqiData} showAromeBtn={supportsArome}
                        />
                        <ErrorBoundary>
                            <AIInsights 
                                analysis={aiAnalysis} minutelyData={minutelyPreciseData} 
                                currentPrecip={currentRainProbability} lang={lang}
                            />
                        </ErrorBoundary>
                    </div>

                    {/* COLUMNA DRETA (SCROLL) */}
                    <div className="xl:col-span-8 flex flex-col gap-8">
                        {viewMode === 'expert' && (
                            <section>
                                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4 px-1">Condicions Actuals</h3>
                                <ErrorBoundary>
                                    <ExpertWidgets 
                                        weatherData={weatherData} aqiData={aqiData} lang={lang} unit={unit} 
                                        shiftedNow={shiftedNow} freezingLevel={currentFreezingLevel}
                                    />
                                </ErrorBoundary>
                            </section>
                        )}
                        
                        <section>
                            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4 px-1">Previsió i Models</h3>
                            <ErrorBoundary>
                                <ForecastSection 
                                    chartData={chartData} comparisonData={comparisonData} dailyData={weatherData.daily}
                                    weeklyExtremes={weeklyExtremes} unit={unit} lang={lang} onDayClick={setSelectedDayIndex}
                                    comparisonEnabled={viewMode === 'expert'}
                                />
                            </ErrorBoundary>
                        </section>
                    </div>
                </div>
            </div>
            )}
        </div>

        {/* Footer a l'App Principal */}
        <Footer />

        <Suspense fallback={null}>
            {selectedDayIndex !== null && weatherData && <DayDetailModal weatherData={weatherData} selectedDayIndex={selectedDayIndex} onClose={() => setSelectedDayIndex(null)} unit={unit} lang={lang} shiftedNow={shiftedNow} />}
            {showRadar && weatherData && <RadarModal lat={weatherData.location?.latitude || 0} lon={weatherData.location?.longitude || 0} onClose={() => setShowRadar(false)} lang={lang} />}
            {showArome && weatherData && <AromeModal lat={weatherData.location?.latitude || 0} lon={weatherData.location?.longitude || 0} onClose={() => setShowArome(false)} lang={lang} />}
        </Suspense>
      </div>
    </div>
  );
}