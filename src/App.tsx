// src/App.tsx
import React, { useState, useEffect, useCallback, lazy, Suspense } from 'react';

// COMPONENTS "CORE"
import { WeatherParticles } from './components/WeatherIcons';
import Header from './components/Header';
import Footer from './components/Footer';
import CurrentWeather from './components/CurrentWeather';
import WelcomeScreen from './components/WelcomeScreen';
import LoadingSkeleton from './components/LoadingSkeleton';
import ErrorBanner from './components/ErrorBanner';
import ErrorBoundary from './components/ErrorBoundary';
import Toast from './components/Toast'; 
import DebugPanel from './components/DebugPanel';

// COMPONENTS LAZY
const Forecast24h = lazy(() => import('./components/Forecast24h'));
const AIInsights = lazy(() => import('./components/AIInsights'));
const ForecastSection = lazy(() => import('./components/ForecastSection'));
const ExpertWidgets = lazy(() => import('./components/ExpertWidgets'));

// Gràfics
import { MinutelyPreciseChart, SmartForecastCharts } from './components/WeatherCharts'; 

// MODALS
const DayDetailModal = lazy(() => import('./components/DayDetailModal'));
const RadarModal = lazy(() => import('./components/RadarModal'));
const AromeModal = lazy(() => import('./components/AromeModal'));

// HOOKS & UTILS
import { usePreferences } from './hooks/usePreferences';
import { useWeather } from './hooks/useWeather';
import { useWeatherAI } from './hooks/useWeatherAI'; 
import { useWeatherCalculations } from './hooks/useWeatherCalculations';
import { TRANSLATIONS } from './translations';
import { isAromeSupported } from './utils/weatherLogic'; 
import { useModalHistory } from './hooks/useModalHistory';
import { useGeoLocation } from './context/GeoLocationContext';

// --- NOVES IMPORTACIONS DE CONSTANTS (NETEJA) ---
import { GEO_ERRORS, NOTIFICATION_TYPES } from './constants/errorConstants';

// Fallback visual
const SectionSkeleton = () => (
    <div className="w-full h-48 bg-white/5 animate-pulse rounded-[2rem] border border-white/5 my-4" />
);

export default function MeteoIA() {
  const [now, setNow] = useState<Date>(new Date());
  
  // --- ESTAT DEBUG ---
  const [showDebug, setShowDebug] = useState(false);
  
  const { lang, setLang, unit, viewMode, setViewMode, addFavorite, removeFavorite, isFavorite } = usePreferences();
  
  const t = TRANSLATIONS[lang] || TRANSLATIONS['ca'];

  // Hook del temps
  const { weatherData, aqiData, loading, error, fetchWeatherByCoords } = useWeather(lang, unit);
  
  // Hook de Geolocalització
  const { getCoordinates } = useGeoLocation();

  // MILLORA: Tipatge estricte utilitzant els valors de les constants
  const [notification, setNotification] = useState<{ 
      type: typeof NOTIFICATION_TYPES[keyof typeof NOTIFICATION_TYPES], 
      msg: string 
  } | null>(null);

  // Funció de Geolocalització Segura
  const handleGetCurrentLocation = useCallback(async () => {
      try {
          const { lat, lon } = await getCoordinates();
          const result = await fetchWeatherByCoords(lat, lon, "La Meva Ubicació");
          
          if (result.success) {
            // ÚS DE CONSTANT
            setNotification({ type: NOTIFICATION_TYPES.SUCCESS, msg: t.notifLocationSuccess });
          }
      } catch (e: unknown) {
          const err = e as Error; 
          let errorMsg = t.notifLocationError;

          // ÚS DE CONSTANTS: Adéu als "Magic Strings"
          if (err.message === GEO_ERRORS.NOT_SUPPORTED) {
              errorMsg = t.geoNotSupported;
          } else if (err.message === GEO_ERRORS.PERMISSION_DENIED) {
              errorMsg = t.notifLocationError; 
          } else if (err.message === GEO_ERRORS.TIMEOUT) {
              errorMsg = t.notifLocationError;
          }

          setNotification({ type: NOTIFICATION_TYPES.ERROR, msg: errorMsg });
      }
  }, [getCoordinates, fetchWeatherByCoords, t]);


  // Càlculs derivats
  const { 
      shiftedNow, minutelyPreciseData, currentFreezingLevel, effectiveWeatherCode, 
      chartData24h, chartDataFull, comparisonData, weeklyExtremes, reliability 
  } = useWeatherCalculations(weatherData, unit, now);

  const { aiAnalysis } = useWeatherAI(weatherData, aqiData, lang, unit, reliability);

  const [selectedDayIndex, setSelectedDayIndex] = useState<number | null>(null);
  const [showRadar, setShowRadar] = useState(false);
  const [showArome, setShowArome] = useState(false);

  // Gestió de l'historial del navegador
  useModalHistory(selectedDayIndex !== null, useCallback(() => setSelectedDayIndex(null), []));
  useModalHistory(showRadar, useCallback(() => setShowRadar(false), []));
  useModalHistory(showArome, useCallback(() => setShowArome(false), []));

  useEffect(() => { const timer = setInterval(() => setNow(new Date()), 60000); return () => clearInterval(timer); }, []);

  const handleToggleFavorite = useCallback(() => {
    if (!weatherData?.location) return;
    const { name } = weatherData.location;
    if (isFavorite(name)) { 
        removeFavorite(name); 
        setNotification({ type: NOTIFICATION_TYPES.INFO, msg: t.favRemoved }); 
    } else { 
        addFavorite(weatherData.location); 
        setNotification({ type: NOTIFICATION_TYPES.SUCCESS, msg: t.favAdded }); 
    }
  }, [weatherData, isFavorite, addFavorite, removeFavorite, t]);

  const supportsArome = weatherData?.location ? isAromeSupported(weatherData.location.latitude, weatherData.location.longitude) : false;

  // --- RENDERITZACIÓ: PANTALLA DE BENVINGUDA ---
  if (!weatherData && !error) { 
    return (
      <div className="min-h-screen bg-[#05060A] flex flex-col font-sans overflow-hidden relative">
         <div className="fixed inset-0 pointer-events-none">
             <div className="absolute top-[-20%] left-[20%] w-[800px] h-[800px] bg-indigo-600/10 rounded-full blur-[120px] mix-blend-screen animate-pulse"></div>
         </div>
         
         <Toast message={notification?.msg || null} type={notification?.type} onClose={() => setNotification(null)} />

         {showDebug && (
            <DebugPanel 
                weatherData={weatherData} 
                supportsArome={supportsArome} 
                error={error} 
            />
         )}

         <div className="w-full max-w-[1920px] mx-auto p-4 md:p-6 flex-1 flex flex-col z-10 min-h-screen">
            <Header 
                onSearch={fetchWeatherByCoords} 
                onLocate={handleGetCurrentLocation} 
                loading={loading}
                viewMode={viewMode}
                setViewMode={setViewMode} 
                onDebugToggle={() => {
                    setShowDebug(prev => !prev);
                    setNotification({ 
                        type: NOTIFICATION_TYPES.INFO, 
                        msg: !showDebug ? "Debug Mode: ACTIVAT" : "Debug Mode: DESACTIVAT" 
                    });
                }}
            />
            
            <div className="flex-1 flex flex-col items-center justify-center w-full mt-8 md:mt-0">
                <WelcomeScreen lang={lang} setLang={setLang} t={t} onLocate={handleGetCurrentLocation} loading={loading} />
            </div>
         </div>
      </div>
    );
  }

  // --- RENDERITZACIÓ: DASHBOARD PRINCIPAL ---
  return (
    <div className="min-h-screen bg-[#05060A] text-slate-50 font-sans transition-all duration-1000 overflow-x-hidden selection:bg-indigo-500/30 flex flex-col relative">
      <WeatherParticles code={effectiveWeatherCode} />
      
      {showDebug && (
        <DebugPanel 
            weatherData={weatherData} 
            supportsArome={supportsArome} 
            error={error} 
        />
      )}

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
            onDebugToggle={() => {
                setShowDebug(prev => !prev);
                setNotification({ 
                    type: NOTIFICATION_TYPES.INFO, 
                    msg: !showDebug ? "Debug Mode: ACTIVAT" : "Debug Mode: DESACTIVAT" 
                });
            }}
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

                <Suspense fallback={<SectionSkeleton />}>
                    <AIInsights analysis={aiAnalysis} lang={lang} />
                </Suspense>

                {viewMode === 'expert' ? (
                    <ErrorBoundary>
                        <div className="flex flex-col gap-8">
                            <Suspense fallback={<SectionSkeleton />}>
                                <ExpertWidgets 
                                    weatherData={weatherData} aqiData={aqiData} lang={lang} unit={unit} 
                                    freezingLevel={currentFreezingLevel}
                                />
                            </Suspense>
                            
                            <Suspense fallback={<SectionSkeleton />}>
                                <Forecast24h data={weatherData} lang={lang} unit={unit} />
                            </Suspense>

                            <Suspense fallback={<SectionSkeleton />}>
                                <ForecastSection 
                                    chartData={chartDataFull} comparisonData={comparisonData} dailyData={weatherData.daily}
                                    weeklyExtremes={weeklyExtremes} unit={unit} lang={lang} onDayClick={setSelectedDayIndex}
                                    comparisonEnabled={true} showCharts={false} 
                                />
                            </Suspense>

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
                            <Suspense fallback={<SectionSkeleton />}>
                                <Forecast24h data={weatherData} lang={lang} unit={unit} />
                            </Suspense>
                            
                            <Suspense fallback={<SectionSkeleton />}>
                                <ForecastSection 
                                    chartData={chartDataFull} comparisonData={comparisonData} dailyData={weatherData.daily}
                                    weeklyExtremes={weeklyExtremes} unit={unit} lang={lang} onDayClick={setSelectedDayIndex}
                                    comparisonEnabled={false} showCharts={false} 
                                />
                            </Suspense>
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