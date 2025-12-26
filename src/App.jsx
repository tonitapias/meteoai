import React, { useState, useEffect, useCallback } from 'react';
import { WeatherParticles } from './components/WeatherIcons';
import Header from './components/Header';
import DayDetailModal from './components/DayDetailModal';
import RadarModal from './components/RadarModal';

// Components
import CurrentWeather from './components/CurrentWeather';
import AIInsights from './components/AIInsights';
import ForecastSection from './components/ForecastSection';
import ExpertWidgets from './components/ExpertWidgets';
import WelcomeScreen from './components/WelcomeScreen';
import LoadingSkeleton from './components/LoadingSkeleton';
import ErrorBanner from './components/ErrorBanner';

// Hooks
import { usePreferences } from './hooks/usePreferences';
import { useWeather } from './hooks/useWeather';
import { useWeatherCalculations } from './hooks/useWeatherCalculations';
import { useAIAnalysis } from './hooks/useAIAnalysis';
import { TRANSLATIONS } from './constants/translations';

export default function MeteoIA() {
  // 1. Estat Global i Preferències
  const [now, setNow] = useState(new Date());
  
  const { 
    lang, setLang, unit, setUnit, viewMode, setViewMode, 
    favorites, addFavorite, removeFavorite, isFavorite 
  } = usePreferences();

  const { 
    weatherData, aqiData, loading, error, 
    fetchWeatherByCoords, handleGetCurrentLocation 
  } = useWeather(lang);

  // Rellotge
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000); 
    return () => clearInterval(timer);
  }, []);

  // 2. Càlculs
  const {
    shiftedNow,
    minutelyPreciseData,
    effectiveWeatherCode,
    currentBg,
    chartData,
    comparisonData,
    weeklyExtremes,
  } = useWeatherCalculations(weatherData, unit, now);

  // 3. IA
  const aiAnalysis = useAIAnalysis(weatherData, aqiData, effectiveWeatherCode, lang);

  // 4. Events UI
  const [selectedDayIndex, setSelectedDayIndex] = useState(null);
  const [showRadar, setShowRadar] = useState(false);

  const handleSearch = useCallback((lat, lon, name, country) => {
    fetchWeatherByCoords(lat, lon, name, country);
  }, [fetchWeatherByCoords]);

  const handleToggleFavorite = useCallback(() => {
    if (!weatherData) return;
    const { name } = weatherData.location;
    if (isFavorite(name)) removeFavorite(name);
    else addFavorite(weatherData.location);
  }, [weatherData, isFavorite, addFavorite, removeFavorite]);

  const t = TRANSLATIONS[lang] || TRANSLATIONS['ca'];

  return (
    <div className={`min-h-screen bg-gradient-to-br ${currentBg} text-slate-100 font-sans p-4 md:p-6 transition-all duration-1000 selection:bg-indigo-500 selection:text-white`}>
      
      {weatherData && <WeatherParticles code={effectiveWeatherCode} />}

      <div className="max-w-5xl mx-auto space-y-6 pb-20 md:pb-0 relative z-10 flex flex-col min-h-[calc(100vh-3rem)]">
        
        <Header 
           onSearch={handleSearch}
           onLocate={handleGetCurrentLocation}
           loading={loading}
           favorites={favorites}
           onRemoveFavorite={(e, name) => { e.stopPropagation(); removeFavorite(name); }}
           lang={lang} setLang={setLang}
           unit={unit} setUnit={setUnit}
           viewMode={viewMode} setViewMode={setViewMode}
        />

        <div className="flex-1">
            {loading && !weatherData && <LoadingSkeleton />}
            {error && !loading && <ErrorBanner message={error} />}

            {!weatherData && !loading && !error && (
               <WelcomeScreen lang={lang} setLang={setLang} t={t} />
            )}

            {weatherData && (
            <div className="animate-in slide-in-from-bottom-8 duration-700 space-y-6">
                
                {/* 1. SECCIÓ SUPERIOR (Targeta Temps + IA) */}
                <div className="bg-slate-900/40 border border-white/10 rounded-[2rem] md:rounded-[2.5rem] p-6 md:p-8 relative overflow-hidden backdrop-blur-md shadow-2xl group">
                    <div className="absolute top-0 right-0 -mt-10 -mr-10 w-64 h-64 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none group-hover:bg-indigo-500/30 transition-colors duration-1000 animate-pulse"></div>
                    
                    <div className="flex flex-col lg:flex-row gap-8 items-start justify-between relative z-10">
                        <div className="flex-1 w-full lg:w-auto">
                            <CurrentWeather 
                                data={weatherData}
                                effectiveCode={effectiveWeatherCode}
                                unit={unit}
                                lang={lang}
                                shiftedNow={shiftedNow}
                                isFavorite={isFavorite(weatherData.location.name)}
                                onToggleFavorite={handleToggleFavorite}
                                onShowRadar={() => setShowRadar(true)}
                            />
                        </div>
                        <div className="w-full lg:w-96 shrink-0 lg:max-w-md h-full">
                            <AIInsights 
                                analysis={aiAnalysis} 
                                minutelyData={minutelyPreciseData} 
                                currentPrecip={weatherData.current.precipitation}
                                lang={lang}
                            />
                        </div>
                    </div>
                </div>

                {/* 2. LAYOUT CONDICIONAL (EXPERT vs BÀSIC) */}
                {viewMode === 'expert' ? (
                    // MODE EXPERT: Graella de 3 columnes (1 Widgets : 2 Gràfics)
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        
                        {/* Columna Esquerra: Widgets compactes */}
                        <div className="lg:col-span-1 h-fit">
                            <ExpertWidgets 
                                weatherData={weatherData} 
                                aqiData={aqiData}
                                lang={lang} 
                                unit={unit}
                                shiftedNow={shiftedNow}
                            />
                        </div>

                        {/* Columna Dreta: Previsions i Gràfics */}
                        <div className="lg:col-span-2 space-y-6">
                            <ForecastSection 
                                chartData={chartData}
                                comparisonData={comparisonData}
                                dailyData={weatherData.daily}
                                weeklyExtremes={weeklyExtremes}
                                unit={unit}
                                lang={lang}
                                onDayClick={setSelectedDayIndex}
                                comparisonEnabled={true}
                            />
                        </div>
                    </div>
                ) : (
                    // MODE BÀSIC: Només Previsions en amplada completa
                    <div className="space-y-6">
                        <ForecastSection 
                            chartData={chartData}
                            comparisonData={comparisonData}
                            dailyData={weatherData.daily}
                            weeklyExtremes={weeklyExtremes}
                            unit={unit}
                            lang={lang}
                            onDayClick={setSelectedDayIndex}
                            comparisonEnabled={false}
                        />
                    </div>
                )}
            </div>
            )}
        </div>

        <div className="w-full py-8 mt-8 text-center border-t border-white/5">
            <p className="text-xs text-slate-500 font-medium tracking-wider uppercase opacity-70">
            © {new Date().getFullYear()} Meteo Toni AI
            </p>
        </div>

        <DayDetailModal 
          weatherData={weatherData}
          selectedDayIndex={selectedDayIndex}
          onClose={() => setSelectedDayIndex(null)}
          unit={unit}
          lang={lang}
          shiftedNow={shiftedNow}
        />

        {showRadar && weatherData && (
            <RadarModal 
                lat={weatherData.location.latitude} 
                lon={weatherData.location.longitude} 
                onClose={() => setShowRadar(false)} 
                lang={lang} 
            />
        )}
      </div>
    </div>
  );
}