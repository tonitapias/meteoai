import React from 'react';
import { AlertOctagon } from 'lucide-react';
import { 
    CompassGauge, CircularGauge, DewPointWidget, CapeWidget, 
    SunArcWidget, MoonWidget, PollenWidget, SnowLevelWidget 
} from './WeatherWidgets';
import { calculateDewPoint, getMoonPhase } from '../utils/weatherLogic';
import { TRANSLATIONS } from '../constants/translations';

export default function ExpertWidgets({ weatherData, aqiData, lang, unit, shiftedNow }) {
  const t = TRANSLATIONS[lang] || TRANSLATIONS['ca'];
  const { current, daily, hourly } = weatherData;

  // Càlculs locals per als widgets
  const currentDewPoint = calculateDewPoint(current.temperature_2m, current.relative_humidity_2m);
  const moonPhaseVal = getMoonPhase(new Date()); // Usar data real
  
  // Freezing Level
  const getFreezingLevel = () => {
      // (Lògica simplificada per visualitzar, ja que el càlcul robust ja es fa al hook principal, 
      // però aquí podem agafar directament de l'hourly si cal o passar-ho per props. 
      // Per simplicitat, agafem el valor del moment actual aprox)
      if(!hourly?.freezing_level_height) return null;
      return hourly.freezing_level_height[0] || null; // Molt simplificat
  };
  const freezingLevel = getFreezingLevel();

  // Barometric trend (simplificat per visualització)
  const pressureTrend = 'steady'; // Podries passar el càlcul real per props si el vols mantenir

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-2 gap-3 md:gap-4 auto-rows-fr mb-6">
        <div className="col-span-1">
            <CompassGauge 
                degrees={current.wind_direction_10m} 
                speed={current.wind_speed_10m} 
                label={t.wind}
                lang={lang}
            />
        </div>
        
        {freezingLevel !== null && freezingLevel < 4000 && (
            <div className="col-span-1">
                <SnowLevelWidget freezingLevel={freezingLevel} unit={unit} lang={lang} />
            </div>
        )}

        <CircularGauge 
            icon={<AlertOctagon className="w-6 h-6" strokeWidth={2.5}/>} 
            label={t.pressure} 
            value={Math.round(current.pressure_msl)} 
            max={1050} 
            subText="hPa"
            color="text-pink-400"
            trend={pressureTrend}
        />
        
        <DewPointWidget value={currentDewPoint} humidity={current.relative_humidity_2m} lang={lang} unit={unit} />
        
        <div className="col-span-1">
            <CapeWidget cape={hourly?.cape?.[0] || 0} lang={lang} />
        </div>
        
        <div className="col-span-2 md:col-span-2">
            <SunArcWidget sunrise={daily.sunrise[0]} sunset={daily.sunset[0]} lang={lang} shiftedNow={shiftedNow}/>
        </div>
        
        <div className="col-span-2 md:col-span-2">
            <MoonWidget phase={moonPhaseVal} lat={weatherData.location.latitude} lang={lang}/>
        </div>
        
        <div className="col-span-2 md:col-span-2">
            <PollenWidget data={aqiData?.current} lang={lang} />
        </div>
    </div>
  );
}