// src/components/ExpertWidgets.tsx
import React, { useMemo } from 'react'; // Afegim useMemo
import { 
  Wind, Droplets, ThermometerSun, Gauge, 
  ArrowDownUp, Eye, Sun, CloudRain, Zap,
  AlertOctagon, Waves, Mountain
} from 'lucide-react';
import { getMoonPhase } from '../utils/weatherLogic'; 
import { WEATHER_THRESHOLDS } from '../constants/weatherConfig';

// --- GINYS DELS COMPONENTS ---
// (Assegura't de tenir aquests components importats o definits al fitxer, com tenies abans)
// Si els tens en altres fitxers, fes els imports. Si estan en aquest fitxer, deixa'ls aquí.
// Per brevetat, assumeixo que els imports de CompassGauge, SnowLevelWidget, etc. ja hi són.

import { 
  CompassGauge, SnowLevelWidget, CloudLayersWidget, CircularGauge,
  DewPointWidget, CapeWidget, SunArcWidget, MoonWidget, PollenWidget 
} from './WeatherWidgets'; // <--- AJUSTA AQUEST IMPORT SEGONS LA TEVA ESTRUCTURA REAL

// --- FIX: COMPONENT EXTRET A FORA ---
const WidgetCard = ({ children, cols = 1 }: { children: React.ReactNode, cols?: number }) => (
  <div className={`col-span-1 ${cols === 2 ? 'md:col-span-2' : ''} bg-slate-900/40 border border-white/10 rounded-3xl backdrop-blur-md overflow-hidden relative group hover:bg-white/5 transition-colors shadow-lg`}>
    {children}
  </div>
);

interface ExpertWidgetsProps {
  weatherData: any;
  aqiData: any;
  lang: string;
  unit: string;
  shiftedNow: Date;
  freezingLevel: number | null;
}

export default function ExpertWidgets({ weatherData, aqiData, lang, unit, shiftedNow, freezingLevel }: ExpertWidgetsProps) {
  const current = weatherData.current;
  const hourly = weatherData.hourly;
  const daily = weatherData.daily;

  // Càlculs segurs
  const utc_offset_seconds = weatherData.utc_offset_seconds || 0;
  const moonPhaseVal = useMemo(() => getMoonPhase(new Date()), []);

  const showSnowWidget = freezingLevel !== null && freezingLevel < WEATHER_THRESHOLDS.DEFAULTS.MAX_DISPLAY_SNOW_LEVEL;
  
  // Càlcul segur del punt de rosada
  const currentDewPoint = current.dew_point_2m ?? current.temperature_2m; 

  const t = {
    wind: lang === 'ca' ? 'Vent' : lang === 'es' ? 'Viento' : 'Wind',
    pressure: lang === 'ca' ? 'Pressió' : lang === 'es' ? 'Presión' : 'Pressure',
  };

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

        {/* 6. Extra Slot (Capes si hem mostrat neu abans) */}
        {showSnowWidget && (
            <WidgetCard><CloudLayersWidget low={current.cloud_cover_low} mid={current.cloud_cover_mid} high={current.cloud_cover_high} lang={lang} /></WidgetCard>
        )}

        {/* 7, 8, 9. Ginys Dobles */}
        <WidgetCard cols={2}><SunArcWidget sunrise={daily.sunrise[0]} sunset={daily.sunset[0]} lang={lang} utcOffset={utc_offset_seconds} /></WidgetCard>
        <WidgetCard cols={2}><MoonWidget phase={moonPhaseVal} lat={weatherData.location?.latitude || 41} lang={lang}/></WidgetCard>
        <WidgetCard cols={2}><PollenWidget data={aqiData?.current} lang={lang} /></WidgetCard>
    </div>
  );
}