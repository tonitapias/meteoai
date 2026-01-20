import React, { useState, useEffect, useCallback, lazy, Suspense } from 'react';
// AFEGIT: Importem les icones necessàries pel nou Footer
import { Globe, Cpu, Wifi, ShieldCheck } from 'lucide-react';

import { WeatherParticles } from './components/WeatherIcons';
import Header from './components/Header';

const DayDetailModal = lazy(() => import('./components/DayDetailModal'));
const RadarModal = lazy(() => import('./components/RadarModal'));
const AromeModal = lazy(() => import('./components/AromeModal'));

import CurrentWeather from './components/CurrentWeather';
import Forecast24h from './components/Forecast24h';
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
import { useModalHistory } from './hooks/useModalHistory';

// --- NOU FOOTER PROFESSIONAL INTEGRAT ---
const Footer = ({ mode = 'dashboard' }: { mode?: 'welcome' | 'dashboard' }) => {
  const year = new Date().getFullYear();
  const isWelcome = mode === 'welcome';

  return (
    <footer className={`
        w-full flex flex-col md:flex-row items-center justify-between gap-4 py-6 px-6 z-30 
        text-[10px] font-mono uppercase tracking-widest mt-auto
        ${isWelcome ? 'text-slate-500 bg-transparent' : 'text-slate-500 border-t border-white/5 bg-[#0B0C15]/40 backdrop-blur-md'}
    `}>
        {/* ESQUERRA: ESTAT DEL SISTEMA */}
        <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <span className="text-emerald-500/80 font-bold">SYSTEM ONLINE</span>
            </div>
            {!isWelcome && (
                <div className="hidden md:flex items-center gap-2 text-indigo-500/60">
                    <Cpu className="w-3 h-3" />
                    <span>CORE: V.3.1.0</span>
                </div>
            )}
        </div>

        {/* CENTRE: FONTS DE DADES */}
        <div className="flex flex-col md:flex-row items-center gap-2 md:gap-6 text-center">
            <div className="flex items-center gap-2 hover:text-indigo-400 transition-colors cursor-help" title="Weather Data Provider">
                <Globe className="w-3 h-3" />
                <span>DATA: OPEN-METEO</span>
            </div>
            <div className="hidden md:block w-px h-3 bg-white/10"></div>
            <div className="flex items-center gap-2 hover:text-emerald-400 transition-colors cursor-help" title="High Resolution Model">
                <ShieldCheck className="w-3 h-3" />
                <span>MODEL: AROME HD</span>
            </div>
        </div>

        {/* DRETA: BRANDING METEOTONIAI */}
        <div className="flex items-center gap-2 opacity-60 hover:opacity-100 transition-opacity">
            <span>© {year} METEOTONI AI</span>
            <Wifi className="w-3 h-3 text-blue-500" />
        </div>
    </footer>
  );
};

export default function MeteoIA() {
  const [now, setNow] = useState<Date>(new Date());
  
  const { lang, setLang, unit, viewMode, setViewMode, addFavorite, removeFavorite, isFavorite } = usePreferences();
  
  const t = TRANSLATIONS[lang] || TRANSLATIONS['ca'];

  const { weatherData, aqiData, loading, error, notification, setNotification, fetchWeatherByCoords, handleGetCurrentLocation } = useWeather(lang, unit);
  
  const { 
      shiftedNow, minutelyPreciseData, currentFreezingLevel, effectiveWeatherCode, 
      chartData24h, chartDataFull, comparisonData, weeklyExtremes, reliability 
  } = useWeatherCalculations(weatherData, unit, now);

  const { aiAnalysis } = useWeatherAI(weatherData, aqiData, lang, unit, reliability);

  const [selectedDayIndex, setSelectedDayIndex] = useState<number | null>(null);
  const [showRadar, setShowRadar] = useState(false);
  const [showArome, setShowArome] = useState(false);

  useModalHistory(selectedDayIndex !== null, useCallback(() => setSelectedDayIndex(null), []));
  useModalHistory(showRadar, useCallback(() => setShowRadar(false), []));
  useModalHistory(showArome, useCallback(() => setShowArome(false), []));

  useEffect(() => { const timer = setInterval(() => setNow(new Date()), 60000); return () => clearInterval(timer); }, []);

  const handleToggleFavorite = useCallback(() => {
    if (!weatherData?.location) return;
    const { name } = weatherData.location;
    if (isFavorite(name)) { removeFavorite(name); setNotification({ type: 'info', msg: t.favRemoved }); } 
    else { addFavorite(weatherData.location); setNotification({ type: 'success', msg: t.favAdded }); }
  }, [weatherData, isFavorite, addFavorite, removeFavorite, t, setNotification]);

  const supportsArome = weatherData?.location ? isAromeSupported(weatherData.location.latitude, weatherData.location.longitude) : false;

  // PANTALLA DE BENVINGUDA
  if (!weatherData && !error) { 
    return (
      <div className="min-h-screen bg-[#05060A] flex flex-col font-sans overflow-hidden relative">
         {/* Fons estàtic per evitar salts visuals */}
         <div className="fixed inset-0 pointer-events-none">
             <div className="absolute top-[-20%] left-[20%] w-[800px] h-[800px] bg-indigo-600/10 rounded-full blur-[120px] mix-blend-screen animate-pulse"></div>
         </div>
         
         <div className="w-full max-w-[1920px] mx-auto p-4 md:p-6 flex-1 flex flex-col z-10 min-h-screen">
            <Header 
                onSearch={fetchWeatherByCoords} 
                onLocate={handleGetCurrentLocation} 
                loading={loading}
                viewMode={viewMode}
                setViewMode={setViewMode} 
            />
            
            <div className="flex-1 flex flex-col items-center justify-center w-full mt-8 md:mt-0">
                <WelcomeScreen lang={lang} setLang={setLang} t={t} onLocate={handleGetCurrentLocation} loading={loading} />
            </div>
            
            {/* Si el WelcomeScreen ja té footer intern, pots treure aquesta línia, o deixar-la per reforçar */}
            {/* <Footer mode="welcome" /> */}
         </div>
      </div>
    );
  }

  // DASHBOARD PRINCIPAL
  return (
    <div className="min-h-screen bg-[#05060A] text-slate-50 font-sans transition-all duration-1000 overflow-x-hidden selection:bg-indigo-500/30 flex flex-col relative">
      <WeatherParticles code={effectiveWeatherCode} />
      
      <div className="fixed inset-0 opacity-[0.03] pointer-events-none mix-blend-overlay z-0" style={{backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`}}></div>

      <div className="fixed inset-0 pointer-events-none z-0">
          <div className="absolute top-[-10%] left-[50%] -translate-x-1/2 w-[1000px] h-[600px] bg-indigo-900/10 rounded-[100%] blur-[100px] opacity-60"></div>
          <div className="absolute bottom-[-10%] right-[-10%] w-[800px] h-[600px] bg-blue-900/5 rounded-full blur-[120px] opacity-40"></div>
      </div>

      <Toast message={notification?.msg || null} type={notification?.type} onClose={() => setNotification(null)} />

      <div className="w-full max-w-5xl mx-auto px-4 py-4 md:px-6 md:py-8 flex-1 flex flex-col relative z-10">
        
        <Header 
            onSearch={fetchWeatherByCoords} 
            onLocate={handleGetCurrentLocation} 
            loading={loading}
            viewMode={viewMode}
            setViewMode={setViewMode}
        />

        <div className="mt-6 md:mt-10 flex-1">
            {error && <ErrorBanner message={error} />}
            {loading && !weatherData && <LoadingSkeleton />}

            {weatherData && !loading && (
            <div className="animate-in fade-in slide-in-from-bottom-8 duration-700 flex flex-col gap-8">
                
                <CurrentWeather 
                    data={weatherData} effectiveCode={effectiveWeatherCode} unit={unit} lang={lang} shiftedNow={shiftedNow}
                    isFavorite={isFavorite(weatherData.location?.name || "")} onToggleFavorite={handleToggleFavorite}
                    onShowRadar={() => setShowRadar(true)} onShowArome={() => setShowArome(true)}
                    aqiData={aqiData} showAromeBtn={supportsArome}
                />

                {minutelyPreciseData && (
                    <div className="bento-card p-5 animate-in zoom-in-95 duration-500 border border-indigo-500/20 bg-indigo-950/10 shadow-[0_0_20px_rgba(30,27,75,0.5)] backdrop-blur-sm relative overflow-hidden">
                         <div className="absolute inset-0 bg-indigo-500/5 animate-pulse pointer-events-none"></div>
                        <MinutelyPreciseChart data={minutelyPreciseData} label={t.preciseRain || "SCAN PRECIPITACIÓ (1H)"} currentPrecip={chartData24h?.[0]?.precip || 0} />
                    </div>
                )}

                <AIInsights analysis={aiAnalysis} lang={lang} />

                {viewMode === 'expert' ? (
                    <ErrorBoundary>
                        <div className="flex flex-col gap-8">
                            <ExpertWidgets 
                                weatherData={weatherData} aqiData={aqiData} lang={lang} unit={unit} 
                                freezingLevel={currentFreezingLevel}
                            />
                            
                            <Forecast24h data={weatherData} lang={lang} unit={unit} />

                            <ForecastSection 
                                chartData={chartDataFull} comparisonData={comparisonData} dailyData={weatherData.daily}
                                weeklyExtremes={weeklyExtremes} unit={unit} lang={lang} onDayClick={setSelectedDayIndex}
                                comparisonEnabled={true} showCharts={false} 
                            />

                            <div className="bento-card p-6 md:p-8 bg-[#0B0C15] border border-white/5 shadow-2xl">
                                <SmartForecastCharts 
                                    data={chartData24h} comparisonData={comparisonData} 
                                    unit={unit === 'F' ? '°F' : '°C'} lang={lang} 
                                    showHumidity={true}
                                />
                            </div>
                        </div>
                    </ErrorBoundary>
                ) : (
                    <ErrorBoundary>
                        <div className="flex flex-col gap-8">
                            <Forecast24h data={weatherData} lang={lang} unit={unit} />
                            <ForecastSection 
                                chartData={chartDataFull} comparisonData={comparisonData} dailyData={weatherData.daily}
                                weeklyExtremes={weeklyExtremes} unit={unit} lang={lang} onDayClick={setSelectedDayIndex}
                                comparisonEnabled={false} showCharts={false} 
                            />
                        </div>
                    </ErrorBoundary>
                )}

            </div>
            )}
        </div>

        {/* NOU FOOTER PROFESSIONAL A LA PRINCIPAL */}
        <Footer mode="dashboard" />

        <Suspense fallback={null}>
            {selectedDayIndex !== null && weatherData && (
                <DayDetailModal 
                    weatherData={weatherData} hourlyData={chartDataFull} selectedDayIndex={selectedDayIndex} 
                    onClose={() => setSelectedDayIndex(null)} unit={unit} lang={lang} shiftedNow={shiftedNow} 
                />
            )}
            {showRadar && weatherData && <RadarModal lat={weatherData.location?.latitude || 0} lon={weatherData.location?.longitude || 0} onClose={() => setShowRadar(false)} lang={lang} />}
            {showArome && weatherData && <AromeModal lat={weatherData.location?.latitude || 0} lon={weatherData.location?.longitude || 0} onClose={() => setShowArome(false)} lang={lang} />}
        </Suspense>
      </div>
    </div>
  );
}