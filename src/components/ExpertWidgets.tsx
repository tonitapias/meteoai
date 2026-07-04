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
  <div className={`col-span-1 ${cols === 2 ? 'md:col-span-2' : ''} h-full animate-in fade-in zoom-in-95 duration-700 fill-mode-both`}>
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
  
  const showSnowWidget = freezingLevel !== null && freezingLevel < WEATHER_THRESHOLDS.DEFAULTS.MAX_DISPLAY_SNOW_LEVEL;

  // --- MÒDUL DE CONSENS ---
  const { wrfData, fetchWRFByCoords } = useWRF();
  
  const safeLocation = location as { latitude?: number; longitude?: number } | undefined;

  useEffect(() => {
    if (safeLocation?.latitude && safeLocation?.longitude) {
      fetchWRFByCoords(safeLocation.latitude, safeLocation.longitude);
    }
  }, [safeLocation?.latitude, safeLocation?.longitude, fetchWRFByCoords]);

  const consensusMetrics = useMemo(() => {
    return calculateModelConsensus(
        current?.temperature_2m as number | undefined, 
        current?.precipitation as number | undefined,
        current?.wind_speed_10m as number | undefined, 
        wrfData
    );
  }, [current?.temperature_2m, current?.precipitation, current?.wind_speed_10m, wrfData]);
  
  // MUR DE CONTENCIÓ HORÀRIA
  const localOffsetSeconds = new Date().getTimezoneOffset() * -60;
  const targetOffsetSeconds = utc_offset_seconds as number;
  const isSameTimezone = localOffsetSeconds === targetOffsetSeconds;
  
  // DETECTOR DE FALLBACK GLOBAL (Col·lapse de model)
  const isGlobalFallback = useMemo(() => {
    const locTemp = hourly?.temperature_2m as (number | null)[] | undefined || [];
    const gloTemp = wrfData?.hourly?.temperature_2m as (number | null)[] | undefined || [];
    
    if (locTemp.length === 0 || gloTemp.length === 0) return false;
    
    let exactMatches = 0;
    let validPairs = 0;
    
    for(let i = 0; i < Math.min(24, locTemp.length, gloTemp.length); i++) {
        if (locTemp[i] != null && gloTemp[i] != null) {
            validPairs++;
            if (locTemp[i] === gloTemp[i]) exactMatches++;
        }
    }
    
    return validPairs > 10 && (exactMatches / validPairs) > 0.85;
  }, [hourly?.temperature_2m, wrfData?.hourly?.temperature_2m]);


  if (!current) return null;

  const dewPointValue = (typeof current.dew_point_2m === 'number')
    ? current.dew_point_2m
    : calculateDewPoint(
        (current.temperature_2m as number) || 0, 
        (current.relative_humidity_2m as number) || 0
      );

  return (
    <>
      <div className="w-full mb-6">
         {/* SISTEMA DE REDIRECCIÓ TÀCTICA (Active vs Inactive) */}
         {!isSameTimezone ? (
            <ConsensusInactiveWidget reason="timezone" lang={lang} />
         ) : isGlobalFallback ? (
            <ConsensusInactiveWidget reason="fallback" lang={lang} />
         ) : (
            <ConsensusWidget 
               metrics={consensusMetrics} 
               aromeTemp={current.temperature_2m as number | undefined} 
               aromePrecip={current.precipitation as number | undefined}
               aromeWind={current.wind_speed_10m as number | undefined} 
               lang={lang}
               hourlyTimes={(hourly?.time as string[]) || []}
               hourlyLocal={{ 
                 temp: hourly?.temperature_2m as (number | null)[] | undefined, 
                 rain: hourly?.precipitation as (number | null)[] | undefined, 
                 wind: hourly?.wind_speed_10m as (number | null)[] | undefined 
               }}
               hourlyGlobal={{ 
                 temp: wrfData?.hourly?.temperature_2m as (number | null)[] | undefined, 
                 rain: wrfData?.hourly?.precipitation as (number | null)[] | undefined, 
                 wind: (wrfData?.hourly as Record<string, unknown>)?.wind_speed_10m as (number | null)[] | undefined 
               }}
            />
         )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 pb-20">
          <WidgetCard>
              <CompassGauge 
                  degrees={(current.wind_direction_10m as number) ?? 0} 
                  speed={(current.wind_speed_10m as number) ?? 0} 
                  gusts={(current.wind_gusts_10m as number) ?? 0}
                  label={lang === 'ca' ? "Vent" : "Wind"} 
                  lang={lang} 
              />
          </WidgetCard>

          <WidgetCard>
              <VisibilityWidget 
                  visibility={(current.visibility as number) ?? 10000} 
                  lang={lang} 
              />
          </WidgetCard>

          <WidgetCard>
              <CloudLayersWidget 
                  low={(current.cloud_cover_low as number) ?? 0} 
                  mid={(current.cloud_cover_mid as number) ?? 0} 
                  high={(current.cloud_cover_high as number) ?? 0} 
                  lang={lang} 
              />
          </WidgetCard>

          <WidgetCard>
              <CircularGauge 
                  icon={<AlertOctagon className="w-5 h-5 text-indigo-400"/>} 
                  label={lang === 'ca' ? "Pressió" : "Pressure"} 
                  value={Math.round((current.pressure_msl ?? 1013) as number)} 
                  max={1050} 
                  subText="hPa" 
                  color="text-indigo-400" 
              />
          </WidgetCard>

          <WidgetCard>
              <DewPointWidget 
                  value={dewPointValue} 
                  humidity={(current.relative_humidity_2m as number) ?? 0} 
                  lang={lang} 
              />
          </WidgetCard>

          <WidgetCard>
              <CapeWidget cape={(hourly?.cape?.[0] as number) ?? 0} lang={lang} />
          </WidgetCard>

          <WidgetCard cols={2}>
              <PollenWidget data={aqiData?.current as Record<string, unknown>} lang={lang} />
          </WidgetCard>

          <WidgetCard>
              <MoonWidget phase={moonPhaseVal} lat={safeLocation?.latitude || 41} lang={lang} />
          </WidgetCard>

          <WidgetCard cols={2}>
              <SunArcWidget 
                  sunrise={(daily?.sunrise?.[0] as string) || ''} 
                  sunset={(daily?.sunset?.[0] as string) || ''} 
                  lang={lang} 
                  utcOffset={utc_offset_seconds as number} 
              />
          </WidgetCard>

          {showSnowWidget && (
              <WidgetCard>
                  <SnowLevelWidget freezingLevel={freezingLevel} unit={unit} lang={lang} />
              </WidgetCard>
          )}
      </div>
    </>
  );
}