import React, { useMemo } from 'react';
import { AlertOctagon } from 'lucide-react';
import { getMoonPhase, calculateDewPoint } from '../utils/physics';
import { ExtendedWeatherData } from '../types/weatherLogicTypes';
import { WEATHER_THRESHOLDS } from '../constants/weatherConfig';

// NOUS IMPORTS: Portem els tipus estrictes de domini
import { Language } from '../translations';
import { WeatherUnit } from '../utils/formatters';

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

// MODIFICAT: Apliquem els tipus estrictes en lloc de "string"
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

  if (!current) return null;

  const dewPointValue = (typeof current.dew_point_2m === 'number')
    ? current.dew_point_2m
    : calculateDewPoint(
        (current.temperature_2m as number) || 0, 
        (current.relative_humidity_2m as number) || 0
      );

  // MODIFICAT: Creem un àlies segur i tipat per a la ubicació que evita l'error de "{}"
  const safeLocation = location as { latitude?: number; longitude?: number } | undefined;

  return (
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
            {/* MODIFICAT: Utilitzem el safeLocation aquí */}
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
  );
}