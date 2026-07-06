// src/components/ExpertWidgets.tsx
import React, { useMemo, useEffect } from 'react';
import { AlertOctagon } from 'lucide-react';
import { getMoonPhase, calculateDewPoint } from '../utils/physics';
import { ExtendedWeatherData } from '../types/weatherLogicTypes';
import { WEATHER_THRESHOLDS } from '../constants/weatherConfig';

import { Language } from '../translations';
import { WeatherUnit } from '../utils/formatters';

import { useWRF } from '../hooks/useWRF';
import { calculateModelConsensus } from '../utils/consensusMath';
import { ConsensusWidget } from './widgets/ConsensusWidget';
import { ConsensusInactiveWidget } from './widgets/ConsensusInactiveWidget';
import { UVIndexWidget } from './widgets/UVIndexWidget';
import { 
  CompassGauge, 
  SnowLevelWidget, 
  CloudLayersWidget, 
  CircularGauge,
  DewPointWidget, 
  CapeWidget, 
  SunArcWidget, 
  MoonWidget, 
  PollenWidget,
  VisibilityWidget 
} from './WeatherWidgets';

interface WidgetCardProps { children: React.ReactNode; cols?: number; }

const WidgetCard = ({ children, cols = 1 }: WidgetCardProps) => (
  <div className={`col-span-1 ${cols === 2 ? 'md:col-span-2' : ''} h-full animate-in fade-in zoom-in-95 duration-700 fill-mode-both rounded-2xl overflow-hidden backdrop-blur-sm bg-white/5 border border-white/10 shadow-lg`}>
    {children}
  </div>
);

interface ExpertWidgetsProps {
  weatherData: ExtendedWeatherData; 
  aqiData: Record<string, unknown> | null; 
  lang: Language; 
  unit: WeatherUnit; 
  freezingLevel: number | null;
}

export default function ExpertWidgets({ weatherData, aqiData, lang, unit, freezingLevel }: ExpertWidgetsProps) {
  const { current, hourly, daily, utc_offset_seconds, location } = weatherData;
  const moonPhaseVal = useMemo(() => getMoonPhase(new Date()), []);
  
  const showSnowWidget = typeof freezingLevel === 'number' && freezingLevel < WEATHER_THRESHOLDS.DEFAULTS.MAX_DISPLAY_SNOW_LEVEL;

  const currentTemp = typeof current?.temperature_2m === 'number' ? current.temperature_2m : undefined;
  const currentPrecip = typeof current?.precipitation === 'number' ? current.precipitation : undefined;
  const currentWindSpeed = typeof current?.wind_speed_10m === 'number' ? current.wind_speed_10m : undefined;
  
  const currentWindDir = typeof current?.wind_direction_10m === 'number' ? current.wind_direction_10m : undefined;
  const currentWindGusts = typeof current?.wind_gusts_10m === 'number' ? current.wind_gusts_10m : undefined;
  const currentVisibility = typeof current?.visibility === 'number' ? current.visibility : undefined;
  const currentCloudLow = typeof current?.cloud_cover_low === 'number' ? current.cloud_cover_low : undefined;
  const currentCloudMid = typeof current?.cloud_cover_mid === 'number' ? current.cloud_cover_mid : undefined;
  const currentCloudHigh = typeof current?.cloud_cover_high === 'number' ? current.cloud_cover_high : undefined;
  const currentPressure = typeof current?.pressure_msl === 'number' ? current.pressure_msl : undefined;
  const currentHumidity = typeof current?.relative_humidity_2m === 'number' ? current.relative_humidity_2m : undefined;
  
  // DOCTRINA RISC ZERO: Cerca tàctica de l'Índex UV per 3 vies diferents per evitar el giny buit
  const currentUV = useMemo(() => {
    // 1. Intent prioritari: buscar-lo com a variable actual directa
    if (typeof current?.uv_index === 'number') return current.uv_index;
    
    // 2. Fallback: buscar a la matriu horària fent match amb la línia de temps de "current"
    if (Array.isArray(hourly?.uv_index) && Array.isArray(hourly?.time)) {
      const currTimeStr = current?.time;
      if (typeof currTimeStr === 'string') {
        const idx = hourly.time.indexOf(currTimeStr);
        if (idx !== -1 && typeof hourly.uv_index[idx] === 'number') {
          return hourly.uv_index[idx];
        }
      }
    }
    
    // 3. Fallback final extrem: buscar el pic màxim d'avui a la matriu diària (per garantir lectura de perill)
    if (Array.isArray(daily?.uv_index_max) && typeof daily.uv_index_max[0] === 'number') {
      return daily.uv_index_max[0];
    }
    
    return undefined;
  }, [current, hourly, daily]);

  const dewPointValue = typeof current?.dew_point_2m === 'number'
    ? current.dew_point_2m
    : (currentTemp !== undefined && currentHumidity !== undefined)
        ? calculateDewPoint(currentTemp, currentHumidity)
        : undefined;

  const { wrfData, fetchWRFByCoords } = useWRF();
  
  const safeLat = location && typeof (location as Record<string, unknown>).latitude === 'number' 
    ? (location as Record<string, unknown>).latitude as number 
    : undefined;
  const safeLon = location && typeof (location as Record<string, unknown>).longitude === 'number' 
    ? (location as Record<string, unknown>).longitude as number 
    : undefined;

  useEffect(() => {
    if (safeLat !== undefined && safeLon !== undefined) {
      fetchWRFByCoords(safeLat, safeLon);
    }
  }, [safeLat, safeLon, fetchWRFByCoords]);

  const consensusMetrics = useMemo(() => {
    return calculateModelConsensus(
        currentTemp, 
        currentPrecip,
        currentWindSpeed, 
        wrfData
    );
  }, [currentTemp, currentPrecip, currentWindSpeed, wrfData]);
  
  const localOffsetSeconds = new Date().getTimezoneOffset() * -60;
  const targetOffsetSeconds = typeof utc_offset_seconds === 'number' ? utc_offset_seconds : 0;
  const isSameTimezone = localOffsetSeconds === targetOffsetSeconds;
  
  const isGlobalFallback = useMemo(() => {
    const getAbsoluteEpoch = (timeStr: string) => {
        if (!timeStr) return NaN;
        if (timeStr.includes('Z') || timeStr.match(/[+-]\d{2}:?\d{2}$/)) {
            return new Date(timeStr).getTime();
        }
        const utcEpoch = new Date(timeStr + 'Z').getTime();
        return utcEpoch - (targetOffsetSeconds * 1000);
    };

    const locTemp = Array.isArray(hourly?.temperature_2m) ? hourly.temperature_2m : [];
    const gloTemp = Array.isArray(wrfData?.hourly?.temperature_2m) ? wrfData.hourly.temperature_2m : [];
    
    if (locTemp.length === 0 || locTemp.every(v => v === null)) return true;
    if (gloTemp.length === 0 || gloTemp.every(v => v === null)) return true;
    
    const locTimes = Array.isArray(hourly?.time) ? hourly.time : [];
    const gloTimes = Array.isArray(wrfData?.hourly?.time) ? wrfData.hourly.time : [];

    const globalDict = new Map<number, number | null>();
    gloTemp.forEach((val, idx) => {
        const tStr = gloTimes[idx];
        if (typeof tStr === 'string') {
            const epoch = getAbsoluteEpoch(tStr);
            if (!isNaN(epoch)) globalDict.set(epoch, typeof val === 'number' ? val : null);
        }
    });

    let exactMatches = 0;
    let validPairs = 0;
    
    for(let i = 0; i < Math.min(24, locTemp.length); i++) {
        const l = locTemp[i];
        const tStr = locTimes[i];
        if (typeof tStr !== 'string') continue;

        const epochKey = getAbsoluteEpoch(tStr);
        const g = !isNaN(epochKey) ? (globalDict.get(epochKey) ?? null) : null;

        if (typeof l === 'number' && typeof g === 'number') {
            validPairs++;
            if (Math.abs(l - g) < 0.1) exactMatches++;
        }
    }
    
    return validPairs > 10 && (exactMatches / validPairs) > 0.85;
  }, [hourly?.temperature_2m, hourly?.time, wrfData?.hourly?.temperature_2m, wrfData?.hourly?.time, targetOffsetSeconds]);

  const forceFallback = isGlobalFallback || !consensusMetrics.isConsensusActive;

  const hourlyCape = hourly?.cape;
  const safeHourlyCape = useMemo(() => {
    if (!Array.isArray(hourlyCape)) return 0;
    const validCapes = hourlyCape.slice(0, 24).filter((c): c is number => typeof c === 'number');
    if (validCapes.length === 0) return 0;
    return Math.max(...validCapes);
  }, [hourlyCape]);

  if (!current) return null;

  const safeHourlyTimes = Array.isArray(hourly?.time) ? (hourly.time as string[]) : [];
  const safeGloTimes = Array.isArray(wrfData?.hourly?.time) ? (wrfData.hourly.time as string[]) : [];

  const safeHourlyTemp = Array.isArray(hourly?.temperature_2m) ? hourly.temperature_2m : undefined;
  const safeHourlyRain = Array.isArray(hourly?.precipitation) ? hourly.precipitation : undefined;
  const safeHourlyWind = Array.isArray(hourly?.wind_speed_10m) ? hourly.wind_speed_10m : undefined;
  const safeHourlyGusts = Array.isArray(hourly?.wind_gusts_10m) ? hourly.wind_gusts_10m : undefined;
  
  const safeGloTemp = Array.isArray(wrfData?.hourly?.temperature_2m) ? wrfData.hourly.temperature_2m : undefined;
  const safeGloRain = Array.isArray(wrfData?.hourly?.precipitation) ? wrfData.hourly.precipitation : undefined;
  
  const rawGloWind = (wrfData?.hourly as Record<string, unknown> | undefined)?.wind_speed_10m;
  const safeGloWind = Array.isArray(rawGloWind) ? rawGloWind : undefined;

  const rawGloGusts = (wrfData?.hourly as Record<string, unknown> | undefined)?.wind_gusts_10m;
  const safeGloGusts = Array.isArray(rawGloGusts) ? rawGloGusts : undefined;

  const safeSunrise = Array.isArray(daily?.sunrise) && typeof daily.sunrise[0] === 'string' ? daily.sunrise[0] : '';
  const safeSunset = Array.isArray(daily?.sunset) && typeof daily.sunset[0] === 'string' ? daily.sunset[0] : '';

  return (
    <>
      <div className="w-full mb-6">
         {!isSameTimezone ? (
            <ConsensusInactiveWidget reason="timezone" lang={lang} />
         ) : forceFallback ? (
            <ConsensusInactiveWidget reason="fallback" lang={lang} />
         ) : (
            <ConsensusWidget 
               metrics={consensusMetrics} 
               aromeTemp={currentTemp} 
               aromePrecip={currentPrecip}
               aromeWind={currentWindSpeed} 
               lang={lang}
               utcOffset={targetOffsetSeconds} 
               hourlyTimes={safeHourlyTimes}
               hourlyGlobalTimes={safeGloTimes}
               hourlyLocal={{ 
                 temp: safeHourlyTemp as (number | null)[] | undefined, 
                 rain: safeHourlyRain as (number | null)[] | undefined, 
                 wind: safeHourlyWind as (number | null)[] | undefined,
                 gusts: safeHourlyGusts as (number | null)[] | undefined
               }}
               hourlyGlobal={{ 
                 temp: safeGloTemp as (number | null)[] | undefined, 
                 rain: safeGloRain as (number | null)[] | undefined, 
                 wind: safeGloWind as (number | null)[] | undefined,
                 gusts: safeGloGusts as (number | null)[] | undefined
               }}
            />
         )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 pb-20">
          <WidgetCard>
              <CompassGauge 
                degrees={currentWindDir ?? 0} 
                speed={currentWindSpeed ?? 0} 
                gusts={currentWindGusts ?? 0} 
                label={lang === 'ca' ? "Vent" : "Wind"} 
                lang={lang} 
              />
          </WidgetCard>

          <WidgetCard>
              <UVIndexWidget uvIndex={currentUV} lang={lang} />
          </WidgetCard>

          <WidgetCard>
              <VisibilityWidget visibility={currentVisibility ?? 10000} lang={lang} />
          </WidgetCard>

          <WidgetCard>
              <CloudLayersWidget low={currentCloudLow ?? 0} mid={currentCloudMid ?? 0} high={currentCloudHigh ?? 0} lang={lang} />
          </WidgetCard>

          <WidgetCard>
              <CircularGauge icon={<AlertOctagon className="w-5 h-5 text-indigo-400"/>} label={lang === 'ca' ? "Pressió" : "Pressure"} value={Math.round(currentPressure ?? 1013)} max={1050} subText="hPa" color="text-indigo-400" />
          </WidgetCard>

          <WidgetCard>
              <DewPointWidget value={dewPointValue as number | undefined} humidity={currentHumidity ?? 0} lang={lang} />
          </WidgetCard>

          <WidgetCard>
              <CapeWidget cape={safeHourlyCape} lang={lang} />
          </WidgetCard>

          <WidgetCard cols={2}>
              <PollenWidget data={aqiData?.current as Record<string, unknown> | undefined} lang={lang} />
          </WidgetCard>

          <WidgetCard>
              <MoonWidget phase={moonPhaseVal} lat={safeLat || 41} lang={lang} />
          </WidgetCard>

          <WidgetCard cols={2}>
              <SunArcWidget sunrise={safeSunrise} sunset={safeSunset} lang={lang} utcOffset={targetOffsetSeconds} />
          </WidgetCard>

          {showSnowWidget && freezingLevel !== null && (
              <WidgetCard>
                  <SnowLevelWidget freezingLevel={freezingLevel} unit={unit} lang={lang} />
              </WidgetCard>
          )}
      </div>
    </>
  );
}