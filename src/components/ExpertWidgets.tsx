// src/components/ExpertWidgets.tsx
import React, { useMemo, useEffect } from 'react';
import { AlertOctagon } from 'lucide-react';
import { getMoonPhase, getCurrentDewPoint } from '../utils/weatherMath';
import { getMoonAgeDays } from '../utils/lunarPhases';
import type { SolarDaily } from '../utils/solar/solarForecast';
import { selectRegionalModel } from '../constants/regionalModels';
import { ExtendedWeatherData } from '../types/weatherLogicTypes';
import { WEATHER_THRESHOLDS } from '../constants/weatherConfig';

import { Language } from '../translations';
import { WeatherUnit } from '../utils/formatters';

import { useGlobalModel } from '../hooks/useGlobalModel';
import { calculateModelConsensus, extractComparisonSeries } from '../utils/consensusMath';
import { ConsensusWidget } from './widgets/ConsensusWidget';
import { ConsensusInactiveWidget } from './widgets/ConsensusInactiveWidget';
import { ConsensusLoadingWidget } from './widgets/ConsensusLoadingWidget';
import { UVIndexWidget } from './widgets/UVIndexWidget';
import { getCurrentUV } from '../utils/uvIndexUtils';
import { resolveCurrentDisplayVisibility } from '../utils/visibilityDisplay';
import { preloadSolarModal } from './solar/preloadSolarModal';
import type { ChartDataPoint } from './ForecastSection';
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

// onIntent: el dit toca o el focus arriba a la targeta, abans del clic; serveix per precarregar el modal.
// fullRow: ocupa tota la fila a qualsevol amplada. És per a la cota de neu, que només surt de vegades i
// sempre queda l'última: sense això a PC es quedava sola en 1 de 4 columnes (i en 1 de 2 a tauleta).
interface WidgetCardProps { children: React.ReactNode; cols?: number; fullRow?: boolean; onClick?: () => void; onIntent?: () => void; }

const WidgetCard = ({ children, cols = 1, fullRow = false, onClick, onIntent }: WidgetCardProps) => (
  <div
    className={`col-span-1 ${fullRow ? 'sm:col-span-2 lg:col-span-4' : cols === 2 ? 'md:col-span-2' : ''} h-full flex flex-col animate-in fade-in zoom-in-95 duration-700 fill-mode-both rounded-2xl overflow-hidden backdrop-blur-sm bg-white/5 border border-white/10 shadow-lg ${onClick ? 'cursor-pointer transition-colors hover:border-white/20 hover:bg-white/[0.07] focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/60' : ''}`}
    onClick={onClick}
    onPointerDown={onIntent}
    onFocus={onIntent}
    role={onClick ? 'button' : undefined}
    tabIndex={onClick ? 0 : undefined}
    onKeyDown={onClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } } : undefined}
  >
    {children}
  </div>
);

interface ExpertWidgetsProps {
  weatherData: ExtendedWeatherData;
  aqiData: Record<string, unknown> | null;
  lang: Language;
  unit: WeatherUnit;
  freezingLevel: number | null;
  // calculations.chartDataFull (comença a l'hora actual): l'evolució de 48 h del giny de cota de neu,
  // la mateixa sèrie que llegeix SnowLevelModal.
  chartDataFull?: ChartDataPoint[];
  onShowSolarModal: () => void;
  onShowMoonModal: () => void;
  onShowStormModal: () => void;
  onShowAqiModal: () => void;
  onShowUvModal: () => void;
  onShowPressureModal: () => void;
  onShowComfortModal: () => void;
  onShowVisibilityModal: () => void;
  onShowCloudLayersModal: () => void;
  onShowSnowLevelModal: () => void;
  onShowWindModal: () => void;
  // Codi de temps de la capçalera (ja passat per la política de boira): decideix si el giny de
  // Visibilitat pot dir "boira" (vegeu utils/visibilityDisplay.ts).
  effectiveCode?: number | null;
  // Rellotge de l'app (ms, useViewState, cada minut): instant real per a la fase i l'edat lunars.
  now?: number;
}

export default function ExpertWidgets({ weatherData, aqiData, lang, unit, freezingLevel, chartDataFull, onShowSolarModal, onShowMoonModal, onShowStormModal, onShowAqiModal, onShowUvModal, onShowPressureModal, onShowComfortModal, onShowVisibilityModal, onShowCloudLayersModal, onShowSnowLevelModal, onShowWindModal, effectiveCode = null, now }: ExpertWidgetsProps) {
  const { current, hourly, daily, utc_offset_seconds, location, timezone } = weatherData;

  // La fase és d'un instant, no d'una hora local: abans es llegia current.time (hora LOCAL) com si fos
  // UTC i el giny anava desfasat tantes hores com el fus (2 h a Barcelona, 11 h a Sydney) respecte al
  // modal, que fa servir l'hora real. Sense rellotge de l'app (tests), l'hora del sistema.
  const moonNowMs = typeof now === 'number' && Number.isFinite(now) ? now : undefined;
  const { moonPhaseVal, moonAgeDays } = useMemo(() => {
    const at = moonNowMs !== undefined ? new Date(moonNowMs) : new Date();
    return { moonPhaseVal: getMoonPhase(at), moonAgeDays: getMoonAgeDays(at) };
  }, [moonNowMs]);
  
  const showSnowWidget = typeof freezingLevel === 'number' && freezingLevel < WEATHER_THRESHOLDS.DEFAULTS.MAX_DISPLAY_SNOW_LEVEL;

  const currentTemp = typeof current?.temperature_2m === 'number' ? current.temperature_2m : undefined;
  const currentPrecip = typeof current?.precipitation === 'number' ? current.precipitation : undefined;
  const currentWindSpeed = typeof current?.wind_speed_10m === 'number' ? current.wind_speed_10m : undefined;
  
  const currentWindDir = typeof current?.wind_direction_10m === 'number' ? current.wind_direction_10m : undefined;
  const currentWindGusts = typeof current?.wind_gusts_10m === 'number' ? current.wind_gusts_10m : undefined;
  const { meters: currentVisibility, bound: visibilityBound } = resolveCurrentDisplayVisibility(current, effectiveCode);
  const currentCloudLow = typeof current?.cloud_cover_low === 'number' ? current.cloud_cover_low : undefined;
  const currentCloudMid = typeof current?.cloud_cover_mid === 'number' ? current.cloud_cover_mid : undefined;
  const currentCloudHigh = typeof current?.cloud_cover_high === 'number' ? current.cloud_cover_high : undefined;
  const currentPressure = typeof current?.pressure_msl === 'number' ? current.pressure_msl : undefined;
  const currentHumidity = typeof current?.relative_humidity_2m === 'number' ? current.relative_humidity_2m : undefined;
  
  const currentUV = useMemo(() => getCurrentUV(weatherData), [weatherData]);

  const dewPointValue = getCurrentDewPoint(currentTemp, currentHumidity);

  const { globalData, loadingGlobalModel, fetchGlobalModelByCoords, clearGlobalModel } = useGlobalModel();
  
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

  // Amb la previsió desada a la pantalla (sense connexió) no es demana: fallaria. Quan torna la previsió nova es torna a
  // demanar; sense aquesta dependència (la ubicació no canvia) la comparació es quedava "no disponible".
  const isOfflineSnapshot = !!weatherData?.offlineSnapshot;

  useEffect(() => {
    if (isOfflineSnapshot) return;
    if (hasRegionalModel && safeLat !== undefined && safeLon !== undefined) {
      fetchGlobalModelByCoords(safeLat, safeLon);
    } else {
      clearGlobalModel();
    }
  }, [hasRegionalModel, safeLat, safeLon, isOfflineSnapshot, fetchGlobalModelByCoords, clearGlobalModel]);

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
  // [NETEJA] `forceFallback` també és true durant la finestra normal de
  // càrrega (abans que `fetchGlobalModelByCoords` resolgui) — per això, més
  // avall, es comprova `loadingGlobalModel` ABANS que `forceFallback`: mentre
  // encara no hi ha resposta es mostra ConsensusLoadingWidget (neutre), no
  // ConsensusInactiveWidget (que abans deia "redundant" fins i tot quan
  // encara no s'havia rebut cap dada per comparar-hi).
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


  return (
    <>
      <div className="w-full mb-6">
         {hasRegionalModel && loadingGlobalModel ? (
            <ConsensusLoadingWidget lang={lang} />
         ) : forceFallback ? (
            <ConsensusInactiveWidget lang={lang} reason={activeRegionalModel ? 'unavailable' : 'no-coverage'} />
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
          <WidgetCard onClick={onShowWindModal}>
              <CompassGauge
                degrees={currentWindDir}
                speed={currentWindSpeed}
                gusts={currentWindGusts}
                label={lang === 'ca' ? "Vent" : "Wind"}
                lang={lang}
              />
          </WidgetCard>

          <WidgetCard onClick={onShowUvModal}>
              <UVIndexWidget uvIndex={currentUV} lang={lang} />
          </WidgetCard>

          <WidgetCard onClick={onShowVisibilityModal}>
              <VisibilityWidget visibility={currentVisibility} bound={visibilityBound} lang={lang} />
          </WidgetCard>

          <WidgetCard onClick={onShowCloudLayersModal}>
              <CloudLayersWidget low={currentCloudLow} mid={currentCloudMid} high={currentCloudHigh} lang={lang} />
          </WidgetCard>

          <WidgetCard onClick={onShowPressureModal}>
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

          <WidgetCard onClick={onShowComfortModal}>
              {/* Risc Zero Aplicat: Evitem el "?? 0" en l'humitat i confiem en el tipatge natiu undefined */}
              <DewPointWidget
                  value={dewPointValue} 
                  humidity={currentHumidity as number | undefined} 
                  lang={lang} 
              />
          </WidgetCard>

          <WidgetCard onClick={onShowStormModal}>
              <CapeWidget capeData={safeCapeData} currentHourIndex={currentHourIndex} lang={lang} />
          </WidgetCard>

          <WidgetCard cols={2} onClick={onShowAqiModal}>
              <AqiWidget data={aqiData?.current as Record<string, unknown> | undefined} lang={lang} />
          </WidgetCard>

          <WidgetCard onClick={onShowMoonModal}>
              <MoonWidget
                  phase={moonPhaseVal}
                  ageDays={moonAgeDays}
                  date={moonNowMs}
                  lat={safeLat ?? 41.728}
                  lon={safeLon ?? 1.824}
                  timezone={typeof timezone === 'string' ? timezone : undefined}
                  lang={lang}
              />
          </WidgetCard>

          <WidgetCard cols={2} onClick={onShowSolarModal} onIntent={preloadSolarModal}>
              {/* El mateix model del dia que el modal: hores d'Open-Meteo si quadren amb l'astronomia (daily), si no suncalc. */}
              <SunArcWidget
                  lang={lang}
                  lat={safeLat}
                  lon={safeLon}
                  timezone={typeof timezone === 'string' ? timezone : null}
                  utcOffset={targetOffsetSeconds}
                  daily={daily as SolarDaily | undefined}
              />
          </WidgetCard>

          {showSnowWidget && freezingLevel !== null && (
              <WidgetCard fullRow onClick={onShowSnowLevelModal}>
                  <SnowLevelWidget
                      freezingLevel={freezingLevel}
                      chartData={chartDataFull}
                      elevation={typeof weatherData.elevation === 'number' ? weatherData.elevation : null}
                      unit={unit}
                      lang={lang}
                  />
              </WidgetCard>
          )}
      </div>
    </>
  );
}