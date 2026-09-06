// src/components/ExpertWidgets.tsx
import React, { useMemo, useEffect } from 'react';
import { AlertOctagon } from 'lucide-react';
import { getMoonPhase, calculateDewPoint } from '../utils/weatherMath';
import { selectRegionalModel } from '../constants/regionalModels';
import { ExtendedWeatherData } from '../types/weatherLogicTypes';
import { WEATHER_THRESHOLDS } from '../constants/weatherConfig';

import { Language } from '../translations';
import { WeatherUnit } from '../utils/formatters';

import { useGlobalModel } from '../hooks/useGlobalModel';
import { calculateModelConsensus, extractComparisonSeries } from '../utils/consensusMath';
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
  AqiWidget,
  VisibilityWidget
} from './widgets';

interface WidgetCardProps { children: React.ReactNode; cols?: number; }

const WidgetCard = ({ children, cols = 1 }: WidgetCardProps) => (
  <div className={`col-span-1 ${cols === 2 ? 'md:col-span-2' : ''} h-full flex flex-col animate-in fade-in zoom-in-95 duration-700 fill-mode-both rounded-2xl overflow-hidden backdrop-blur-sm bg-white/5 border border-white/10 shadow-lg`}>
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
  const { current, hourly, daily, utc_offset_seconds, location, timezone } = weatherData;
  const currentTimeStr = typeof current?.time === 'string' ? current.time : undefined;

  const moonPhaseVal = useMemo(() => {
    if (typeof currentTimeStr === 'string') {
      const year = Number(currentTimeStr.substring(0, 4));
      const month = Number(currentTimeStr.substring(5, 7));
      const day = Number(currentTimeStr.substring(8, 10));
      const hour = Number(currentTimeStr.substring(11, 13));
      const minute = Number(currentTimeStr.substring(14, 16));
      return getMoonPhase(new Date(Date.UTC(year, month - 1, day, hour, minute)));
    }
    return getMoonPhase(new Date());
  }, [currentTimeStr]);
  
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
  
  const currentUV = useMemo(() => {
    if (current?.is_day === 0) return 0;
    if (typeof current?.uv_index === 'number') return current.uv_index;
    
    if (Array.isArray(hourly?.uv_index) && Array.isArray(hourly?.time) && typeof current?.time === 'string') {
      const hourPrefix = current.time.substring(0, 13);
      const idx = hourly.time.findIndex(t => typeof t === 'string' && t.startsWith(hourPrefix));
      
      if (idx !== -1 && typeof hourly.uv_index[idx] === 'number') {
        return hourly.uv_index[idx];
      }
    }
    
    const locationHour = typeof current?.time === 'string'
      ? Number(current.time.substring(11, 13))
      : new Date().getHours();
    const isLikelyNight = !Number.isNaN(locationHour) && (locationHour < 6 || locationHour > 21);

    if (!isLikelyNight && current?.is_day !== 0) {
      if (Array.isArray(daily?.uv_index_max) && typeof daily.uv_index_max[0] === 'number') {
        return daily.uv_index_max[0];
      }
    } else if (isLikelyNight) {
      return 0; 
    }
    
    return undefined; 
  }, [current, hourly, daily]);

  const dewPointValue = typeof current?.dew_point_2m === 'number'
    ? current.dew_point_2m
    : (currentTemp !== undefined && currentHumidity !== undefined)
        ? calculateDewPoint(currentTemp, currentHumidity)
        : undefined;

  const { globalData, fetchGlobalModelByCoords, clearGlobalModel } = useGlobalModel();
  
  const safeLat = location && typeof (location as Record<string, unknown>).latitude === 'number' 
    ? (location as Record<string, unknown>).latitude as number 
    : undefined;
  const safeLon = location && typeof (location as Record<string, unknown>).longitude === 'number' 
    ? (location as Record<string, unknown>).longitude as number 
    : undefined;

  // [FIX PRECISIÓ] Només demanem el model global si la població té un model regional
  // d'alta resolució (AROME/ICON-D2/HRRR/HRDPS...): fora d'aquestes zones no hi ha
  // res a comparar (no hi ha "local" diferenciat del global), així que evitem la
  // crida de xarxa sencera quan ja sabem que no pot aportar cap comparació.
  const activeRegionalModel = safeLat !== undefined && safeLon !== undefined ? selectRegionalModel(safeLat, safeLon) : null;
  const hasRegionalModel = !!activeRegionalModel;

  useEffect(() => {
    if (hasRegionalModel && safeLat !== undefined && safeLon !== undefined) {
      fetchGlobalModelByCoords(safeLat, safeLon);
    } else {
      clearGlobalModel();
    }
  }, [hasRegionalModel, safeLat, safeLon, fetchGlobalModelByCoords, clearGlobalModel]);

  const consensusMetrics = useMemo(() => {
    // [FIX PRECISIÓ] Passem la sèrie horària local (AROME) perquè el "Radar a
    // 3 Hores" pugui detectar convecció local pròpia, no només la del model
    // global — vegeu la nota a calculateModelConsensus.
    return calculateModelConsensus(
        currentTemp,
        currentPrecip,
        currentWindSpeed,
        globalData,
        Array.isArray(hourly?.time) ? hourly.time : [],
        Array.isArray(hourly?.precipitation) ? hourly.precipitation : [],
        Array.isArray(hourly?.wind_speed_10m) ? hourly.wind_speed_10m : [],
        typeof utc_offset_seconds === 'number' ? utc_offset_seconds : 0
    );
  }, [currentTemp, currentPrecip, currentWindSpeed, globalData, hourly, utc_offset_seconds]);
  
  const hasKnownOffset = typeof utc_offset_seconds === 'number';
  const targetOffsetSeconds = hasKnownOffset ? utc_offset_seconds : 0;

  // [FIX PRECISIÓ] Abans hi havia aquí un heurístic `isGlobalFallback` que
  // suspenia tot el widget quan el model regional coincidia gairebé exacte
  // amb el "best_match" (p.ex. HRRR/JMA, on Open-Meteo ja tria el mateix
  // model nacional per defecte). Però "coincidir" no vol dir "no hi ha res a
  // mostrar": l'usuari encara pot voler veure el desglossament i les
  // gràfiques ECMWF/GFS/ICON del modal complet. Ara el widget només es
  // suspèn quan realment no hi ha dades comparables (`isConsensusActive`);
  // si coincideix de debò, es mostra igualment amb Δ0 i "Alineat".
  const forceFallback = !consensusMetrics.isConsensusActive;

  const currentHourIndex = useMemo(() => {
    if (!hourly || !current || !Array.isArray(hourly.time) || typeof current.time !== 'string') return -1;
    
    const hourPrefix = current.time.substring(0, 13); 
    const idx = hourly.time.findIndex(t => typeof t === 'string' && t.startsWith(hourPrefix));
    return idx; 
  }, [hourly, current]);

  // DOCTRINA RISC ZERO: Extracció del ΔP (Tendència Baromètrica de les últimes 3h)
  const pressureTrend = useMemo(() => {
    if (!hourly || !Array.isArray(hourly.pressure_msl)) return undefined;
    
    if (currentHourIndex >= 3) {
        const currentP = hourly.pressure_msl[currentHourIndex];
        const pastP = hourly.pressure_msl[currentHourIndex - 3];
        
        if (typeof currentP === 'number' && typeof pastP === 'number') {
            return Number((currentP - pastP).toFixed(1)); 
        }
    }
    return undefined;
  }, [hourly, currentHourIndex]);

  const safeCapeData = useMemo(() => {
    if (!hourly || !Array.isArray(hourly.cape)) return [];
    return hourly.cape.map(c => typeof c === 'number' ? c : null);
  }, [hourly]);

  if (!current) return null;

  const safeHourlyTimes = Array.isArray(hourly?.time) ? (hourly.time as string[]) : [];
  const safeGloTimes = Array.isArray(globalData?.hourly?.time) ? (globalData.hourly.time as string[]) : [];

  const safeHourlyTemp = Array.isArray(hourly?.temperature_2m) ? hourly.temperature_2m : undefined;
  const safeHourlyRain = Array.isArray(hourly?.precipitation) ? hourly.precipitation : undefined;
  const safeHourlyWind = Array.isArray(hourly?.wind_speed_10m) ? hourly.wind_speed_10m : undefined;
  const safeHourlyGusts = Array.isArray(hourly?.wind_gusts_10m) ? hourly.wind_gusts_10m : undefined;
  
  const safeGloTemp = Array.isArray(globalData?.hourly?.temperature_2m) ? globalData.hourly.temperature_2m : undefined;
  const safeGloRain = Array.isArray(globalData?.hourly?.precipitation) ? globalData.hourly.precipitation : undefined;
  
  const rawGloWind = (globalData?.hourly as Record<string, unknown> | undefined)?.wind_speed_10m;
  const safeGloWind = Array.isArray(rawGloWind) ? rawGloWind : undefined;

  const rawGloGusts = (globalData?.hourly as Record<string, unknown> | undefined)?.wind_gusts_10m;
  const safeGloGusts = Array.isArray(rawGloGusts) ? rawGloGusts : undefined;

  // ECMWF/GFS/ICON: ja arriben a la mateixa crida base (API_MODELS_LIST) i
  // normData.ts ja els separa a `hourlyComparison`, alineats índex a índex
  // amb `hourly.time` — cap crida de xarxa addicional per al meteograma.
  const hourlyEcmwf = extractComparisonSeries(weatherData.hourlyComparison?.ecmwf);
  const hourlyGfs = extractComparisonSeries(weatherData.hourlyComparison?.gfs);
  const hourlyIcon = extractComparisonSeries(weatherData.hourlyComparison?.icon);
  const hourlyAifs = extractComparisonSeries(weatherData.hourlyComparison?.aifs);

  const safeSunrise = Array.isArray(daily?.sunrise) && typeof daily.sunrise[0] === 'string' ? daily.sunrise[0] : '';
  const safeSunset = Array.isArray(daily?.sunset) && typeof daily.sunset[0] === 'string' ? daily.sunset[0] : '';

  return (
    <>
      <div className="w-full mb-6">
         {forceFallback ? (
            <ConsensusInactiveWidget lang={lang} reason={activeRegionalModel ? 'redundant' : 'no-coverage'} />
         ) : (
            <ConsensusWidget
               metrics={consensusMetrics}
               localTemp={currentTemp}
               localPrecip={currentPrecip}
               localWind={currentWindSpeed}
               lang={lang}
               utcOffset={targetOffsetSeconds}
               regionalModelLabel={activeRegionalModel?.label ?? 'LOC'}
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
               hourlyEcmwf={hourlyEcmwf}
               hourlyGfs={hourlyGfs}
               hourlyIcon={hourlyIcon}
               hourlyAifs={hourlyAifs}
            />
         )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 pb-20 grid-flow-dense">
          <WidgetCard>
              <CompassGauge
                degrees={currentWindDir}
                speed={currentWindSpeed}
                gusts={currentWindGusts}
                label={lang === 'ca' ? "Vent" : "Wind"}
                lang={lang}
              />
          </WidgetCard>

          <WidgetCard>
              <UVIndexWidget uvIndex={currentUV} lang={lang} />
          </WidgetCard>

          <WidgetCard>
              <VisibilityWidget visibility={currentVisibility} lang={lang} />
          </WidgetCard>

          <WidgetCard>
              <CloudLayersWidget low={currentCloudLow} mid={currentCloudMid} high={currentCloudHigh} lang={lang} />
          </WidgetCard>

          <WidgetCard>
              <CircularGauge
                  icon={<AlertOctagon className="w-5 h-5 text-indigo-400"/>}
                  label={lang === 'ca' ? "Pressió" : "Pressure"}
                  value={currentPressure}
                  max={1050}
                  subText="hPa" 
                  color="text-indigo-400" 
                  trendValue={pressureTrend}
                  lang={lang}
              />
          </WidgetCard>

          <WidgetCard>
              {/* Risc Zero Aplicat: Evitem el "?? 0" en l'humitat i confiem en el tipatge natiu undefined */}
              <DewPointWidget 
                  value={dewPointValue} 
                  humidity={currentHumidity as number | undefined} 
                  lang={lang} 
              />
          </WidgetCard>

          <WidgetCard>
              <CapeWidget capeData={safeCapeData} currentHourIndex={currentHourIndex} lang={lang} />
          </WidgetCard>

          <WidgetCard cols={2}>
              <AqiWidget data={aqiData?.current as Record<string, unknown> | undefined} lang={lang} />
          </WidgetCard>

          <WidgetCard>
              <MoonWidget 
                  phase={moonPhaseVal} 
                  lat={safeLat ?? 41.728} 
                  lon={safeLon ?? 1.824} 
                  timezone={typeof timezone === 'string' ? timezone : undefined}
                  lang={lang} 
              />
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