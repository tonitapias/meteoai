import React, { useState, useEffect, useCallback, lazy, Suspense } from 'react';
import * as Sentry from "@sentry/react"; // NOU: Necessari per reportar errors de GPS des de la UI

import { WeatherParticles } from './components/WeatherIcons';
import Header from './components/Header';
import Footer from './components/Footer';

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
import { TRANSLATIONS } from './translations';
import { isAromeSupported } from './utils/weatherLogic'; 
import { useModalHistory } from './hooks/useModalHistory';

export default function MeteoIA() {
  const [now, setNow] = useState<Date>(new Date());
  
  const { lang, setLang, unit, viewMode, setViewMode, addFavorite, removeFavorite, isFavorite } = usePreferences();
  
  const t = TRANSLATIONS[lang] || TRANSLATIONS['ca'];

  // CANVI: Ja no recuperem notification/handleGetCurrentLocation del hook
  const { weatherData, aqiData, loading, error, fetchWeatherByCoords } = useWeather(lang, unit);
  
  // NOU: L'estat de les notificacions viu ara a la UI, on pertany
  const [notification, setNotification] = useState<{ type: 'success' | 'error' | 'info', msg: string } | null>(null);

  // NOU: Lògica de Geolocalització moguda a l'App (Capa de presentació)
  const handleGetCurrentLocation = useCallback(() => {
  if (!navigator.geolocation) {
    setNotification({ type: 'error', msg: t.geoNotSupported });
    return;
  }
  
  // CANVI 1: Configuració més robusta
  // - timeout: Pugem a 15000ms (15s) per donar temps a mòbils lents o sota sostre.
  // - maximumAge: Permetem posicions de fa 5 minuts (300000ms). 
  //   Per al temps, no cal saber on ets EXACTAMENT ara mateix, una posició recent serveix i és instantània.
  const geoOptions = { 
      enableHighAccuracy: false, 
      timeout: 15000, 
      maximumAge: 300000 
  };

  navigator.geolocation.getCurrentPosition(
    async (pos) => {
      const success = await fetchWeatherByCoords(pos.coords.latitude, pos.coords.longitude, "La Meva Ubicació");
      if (success) {
        setNotification({ type: 'success', msg: t.notifLocationSuccess });
      }
    },
    (err) => {
      console.warn("Error GPS:", err.message);
      
      // CANVI 2: Captura neta a Sentry
      // Emboliquem l'objecte natiu en un Error de JS perquè Sentry mostri el missatge real ("Timeout expired")
      // i no "[object GeolocationPositionError]".
      Sentry.captureException(new Error(`Geolocation Error: ${err.message}`), { 
          tags: { service: 'Geolocation' },
          extra: { code: err.code } // Codi 3 = Timeout
      });
      
      setNotification({ type: 'error', msg: t.notifLocationError });
    },
    geoOptions
  );
}, [fetchWeatherByCoords, t]);

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
  }, [weatherData, isFavorite, addFavorite, removeFavorite, t]);

  const supportsArome = weatherData?.location ? isAromeSupported(weatherData.location.latitude, weatherData.location.longitude) : false;

  // PANTALLA DE BENVINGUDA
  if (!weatherData && !error) { 
    return (
      <div className="min-h-screen bg-[#05060A] flex flex-col font-sans overflow-hidden relative">
         <div className="fixed inset-0 pointer-events-none">
             <div className="absolute top-[-20%] left-[20%] w-[800px] h-[800px] bg-indigo-600/10 rounded-full blur-[120px] mix-blend-screen animate-pulse"></div>
         </div>
         
         {/* FIX: Afegim el Toast aquí també perquè l'usuari vegi errors de GPS si ocorren a la Home */}
         <Toast message={notification?.msg || null} type={notification?.type} onClose={() => setNotification(null)} />

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
            
            {/* <Footer simple transparent className="mt-auto" /> */}
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

        <Footer className="mt-auto" />

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