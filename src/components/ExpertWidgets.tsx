// src/components/ExpertWidgets.tsx
import React, { useMemo } from 'react';
import { AlertOctagon } from 'lucide-react';
// MODIFICAT: Afegim 'calculateDewPoint' a l'import
import { getMoonPhase, calculateDewPoint, ExtendedWeatherData } from '../utils/weatherLogic'; 
import { WEATHER_THRESHOLDS } from '../constants/weatherConfig';

import { 
  CompassGauge, SnowLevelWidget, CloudLayersWidget, CircularGauge,
  DewPointWidget, CapeWidget, SunArcWidget, MoonWidget, PollenWidget
} from './WeatherWidgets';

interface WidgetCardProps { children: React.ReactNode; cols?: number; }

const WidgetCard = ({ children, cols = 1 }: WidgetCardProps) => (
  <div className={`col-span-1 ${cols === 2 ? 'md:col-span-2' : ''} h-full animate-in fade-in zoom-in-95 duration-700`}>
    {children}
  </div>
);

interface ExpertWidgetsProps {
  weatherData: ExtendedWeatherData; aqiData: Record<string, unknown> | null; lang: string; unit: string; freezingLevel: number | null;
}

export default function ExpertWidgets({ weatherData, aqiData, lang, unit, freezingLevel }: ExpertWidgetsProps) {
  const { current, hourly, daily, utc_offset_seconds, location } = weatherData;
  const moonPhaseVal = useMemo(() => getMoonPhase(new Date()), []);
  
  // ALERTA DE NEU: Només visible si la cota és baixa (< 1500m per defecte o config)
  const showSnowWidget = freezingLevel !== null && freezingLevel < WEATHER_THRESHOLDS.DEFAULTS.MAX_DISPLAY_SNOW_LEVEL;

  if (!current) return null;

  // CÀLCUL DEL PUNT DE ROSADA (CORRECCIÓ)
  // Si l'API no porta el valor, el calculem nosaltres amb Temp i Humitat
  const dewPointValue = (typeof current.dew_point_2m === 'number')
    ? current.dew_point_2m
    : calculateDewPoint(current.temperature_2m || 0, current.relative_humidity_2m || 0);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* FILA 1: DADES DINÀMIQUES (Vent, Núvols, Pressió, Rosada) */}
        <WidgetCard>
            <CompassGauge 
                degrees={current.wind_direction_10m ?? 0} 
                speed={current.wind_speed_10m ?? 0} 
                gusts={current.wind_gusts_10m}
                label="Vent" 
                lang={lang} 
            />
        </WidgetCard>

        <WidgetCard>
            <CloudLayersWidget 
                low={current.cloud_cover_low ?? 0} 
                mid={current.cloud_cover_mid ?? 0} 
                high={current.cloud_cover_high ?? 0} 
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
                value={dewPointValue} // Ara passem el valor calculat
                humidity={current.relative_humidity_2m ?? 0} 
                lang={lang} 
            />
        </WidgetCard>

        {/* FILA 2: ESTAT ATMOSFÈRIC */}
        <WidgetCard>
            {/* Monitor d'Inestabilitat (CAPE) */}
            <CapeWidget cape={hourly?.cape?.[0] ?? 0} lang={lang} />
        </WidgetCard>

        <WidgetCard cols={2}>
            {/* Bio-Sensor (AQI) */}
            <PollenWidget data={aqiData?.current} lang={lang} />
        </WidgetCard>

        <WidgetCard>
            <MoonWidget phase={moonPhaseVal} lat={location?.latitude || 41} lang={lang} />
        </WidgetCard>

        {/* FILA 3: SOLAR + ALERTES */}
        <WidgetCard cols={2}>
            <SunArcWidget sunrise={daily?.sunrise?.[0]} sunset={daily?.sunset?.[0]} lang={lang} utcOffset={utc_offset_seconds} />
        </WidgetCard>

        {/* Cota de Neu (Condicional) */}
        {showSnowWidget && (
            <WidgetCard>
                <SnowLevelWidget freezingLevel={freezingLevel} unit={unit} lang={lang} />
            </WidgetCard>
        )}
    </div>
  );
}