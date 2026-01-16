// src/components/ExpertWidgets.tsx
import React from 'react';
import { AlertOctagon } from 'lucide-react';
import { CompassGauge, CircularGauge, DewPointWidget, CapeWidget, SunArcWidget, MoonWidget, PollenWidget, SnowLevelWidget, CloudLayersWidget } from './WeatherWidgets';
import { calculateDewPoint, getMoonPhase, ExtendedWeatherData } from '../utils/weatherLogic';
import { TRANSLATIONS, Language } from '../constants/translations';
import { WEATHER_THRESHOLDS } from '../constants/weatherConfig';
import { AirQualityData } from '../services/weatherApi';
import { WeatherUnit } from '../utils/formatters';

interface ExpertWidgetsProps { 
    weatherData: ExtendedWeatherData; 
    aqiData: AirQualityData | null; 
    lang: Language; 
    unit: WeatherUnit; 
    shiftedNow: Date; 
    freezingLevel: number; 
}

export default function ExpertWidgets({ weatherData, aqiData, lang, unit, freezingLevel }: ExpertWidgetsProps) {
  const t = TRANSLATIONS[lang] || TRANSLATIONS['ca'];
  const { current, daily, hourly, utc_offset_seconds } = weatherData;
  const currentDewPoint = calculateDewPoint(current.temperature_2m, current.relative_humidity_2m);
  const moonPhaseVal = getMoonPhase(new Date()); 

  const WidgetCard = ({ children, cols = 1 }: { children: React.ReactNode, cols?: number }) => (
    <div className={`col-span-1 ${cols === 2 ? 'md:col-span-2' : ''} bg-slate-900/40 border border-white/10 rounded-3xl backdrop-blur-md overflow-hidden relative group hover:bg-white/5 transition-colors shadow-lg`}>
        {children}
    </div>
  );

  const showSnowWidget = freezingLevel !== null && freezingLevel < WEATHER_THRESHOLDS.DEFAULTS.MAX_DISPLAY_SNOW_LEVEL;

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 auto-rows-[160px]">
        {/* 1. Vent */}
        <WidgetCard><CompassGauge degrees={current.wind_direction_10m} speed={current.wind_speed_10m} label={t.wind} lang={lang} /></WidgetCard>
        
        {/* 2. Cota de Neu o Capes */}
        {showSnowWidget ? (
            <WidgetCard><SnowLevelWidget freezingLevel={freezingLevel} unit={unit} lang={lang} /></WidgetCard>
        ) : (
            <WidgetCard><CloudLayersWidget low={current.cloud_cover_low} mid={current.cloud_cover_mid} high={current.cloud_cover_high} lang={lang} /></WidgetCard>
        )}

        {/* 3. Pressió */}
        <WidgetCard><CircularGauge icon={<AlertOctagon className="w-6 h-6"/>} label={t.pressure} value={Math.round(current.pressure_msl)} max={1050} subText="hPa" color="text-pink-400" trend={'steady'} /></WidgetCard>
        
        {/* 4. Punt de Rosada */}
        <WidgetCard><DewPointWidget value={currentDewPoint} humidity={current.relative_humidity_2m} lang={lang} unit={unit} /></WidgetCard>
        
        {/* 5. CAPE */}
        <WidgetCard><CapeWidget cape={hourly?.cape?.[0] || 0} lang={lang} /></WidgetCard>
        
        {/* 6. Extra Slot */}
        {showSnowWidget && (
             <WidgetCard><CloudLayersWidget low={current.cloud_cover_low} mid={current.cloud_cover_mid} high={current.cloud_cover_high} lang={lang} /></WidgetCard>
        )}

        {/* 7, 8, 9. Ginys Dobles */}
        {/* FIX: Connectem 'utcOffset' en lloc de 'shiftedNow' */}
        <WidgetCard cols={2}><SunArcWidget sunrise={daily.sunrise[0]} sunset={daily.sunset[0]} lang={lang} utcOffset={utc_offset_seconds} /></WidgetCard>
        
        <WidgetCard cols={2}><MoonWidget phase={moonPhaseVal} lat={weatherData.location?.latitude || 41} lang={lang}/></WidgetCard>
        <WidgetCard cols={2}><PollenWidget data={aqiData?.current} lang={lang} /></WidgetCard>
    </div>
  );
}