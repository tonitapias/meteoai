// src/components/DetailWidgetsGrid.tsx
// La graella dels ginys de detall (vent, UV, visibilitat... lluna, sol i cota de neu), cadascun a la seva targeta, que
// n'obre el modal. Abans vivia dins ExpertWidgets; ara és una peça a part i `ids` tria quins ginys hi surten i en quin
// ordre, perquè es puguin repartir en llocs diferents. Els valors es calculen exactament igual que abans.
import React, { useMemo } from 'react';
import { AlertOctagon } from 'lucide-react';
import { getMoonPhase, getCurrentDewPoint } from '../utils/weatherMath';
import { getMoonAgeDays } from '../utils/lunarPhases';
import type { SolarDaily } from '../utils/solar/solarForecast';
import { ExtendedWeatherData } from '../types/weatherLogicTypes';
import { WEATHER_THRESHOLDS } from '../constants/weatherConfig';

import { Language } from '../translations';
import { WeatherUnit } from '../utils/formatters';

import { UVIndexWidget } from './widgets/UVIndexWidget';
import { getCurrentUV } from '../utils/uvIndexUtils';
import { resolveCurrentDisplayVisibility } from '../utils/visibilityDisplay';
import { preloadSolarModal } from './solar/preloadSolarModal';
import type { ChartDataPoint } from './ForecastSection';
import { ALL_DETAIL_WIDGETS, type DetailWidgetId } from './detailWidgetIds';
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

const DEFAULT_GRID_CLASS = 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 pb-20 grid-flow-dense';

// onIntent: el dit toca o el focus arriba a la targeta, abans del clic; serveix per precarregar el modal.
// fullRow: ocupa tota la fila a qualsevol amplada. És per a la cota de neu, que només surt de vegades i
// sempre queda l'última: sense això a PC es quedava sola en 1 de 4 columnes (i en 1 de 2 a tauleta).
// `col-span-full` (de la primera a l'última columna) val per a qualsevol graella, també la de 3 de les pestanyes.
interface WidgetCardProps { children: React.ReactNode; cols?: number; fullRow?: boolean; onClick?: () => void; onIntent?: () => void; }

const WidgetCard = ({ children, cols = 1, fullRow = false, onClick, onIntent }: WidgetCardProps) => (
  <div
    className={`${fullRow ? 'col-span-full' : `col-span-1 ${cols === 2 ? 'md:col-span-2' : ''}`} h-full flex flex-col animate-in fade-in zoom-in-95 duration-700 fill-mode-both rounded-2xl overflow-hidden bg-white/5 border border-white/10 shadow-lg ${onClick ? 'cursor-pointer transition-colors hover:border-white/20 hover:bg-white/[0.07] focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/60' : ''}`}
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

export interface DetailWidgetsGridProps {
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
  /** Quins ginys i en quin ordre. Per defecte, tots en l'ordre de la vista completa. */
  ids?: readonly DetailWidgetId[];
  /** Classe de la graella. Per defecte, la de la vista completa. */
  className?: string;
}

export default function DetailWidgetsGrid({ weatherData, aqiData, lang, unit, freezingLevel, chartDataFull, onShowSolarModal, onShowMoonModal, onShowStormModal, onShowAqiModal, onShowUvModal, onShowPressureModal, onShowComfortModal, onShowVisibilityModal, onShowCloudLayersModal, onShowSnowLevelModal, onShowWindModal, effectiveCode = null, now, ids = ALL_DETAIL_WIDGETS, className = DEFAULT_GRID_CLASS }: DetailWidgetsGridProps) {
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

  const safeLat = location && typeof (location as Record<string, unknown>).latitude === 'number'
    ? (location as Record<string, unknown>).latitude as number
    : undefined;
  const safeLon = location && typeof (location as Record<string, unknown>).longitude === 'number'
    ? (location as Record<string, unknown>).longitude as number
    : undefined;

  const hasKnownOffset = typeof utc_offset_seconds === 'number';
  const targetOffsetSeconds = hasKnownOffset ? utc_offset_seconds : 0;

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

  const renderWidget = (id: DetailWidgetId): React.ReactNode => {
    switch (id) {
      case 'wind':
        return (
          <WidgetCard key={id} onClick={onShowWindModal}>
              <CompassGauge
                degrees={currentWindDir}
                speed={currentWindSpeed}
                gusts={currentWindGusts}
                label={lang === 'ca' ? "Vent" : "Wind"}
                lang={lang}
              />
          </WidgetCard>
        );
      case 'uv':
        return (
          <WidgetCard key={id} onClick={onShowUvModal}>
              <UVIndexWidget uvIndex={currentUV} lang={lang} />
          </WidgetCard>
        );
      case 'visibility':
        return (
          <WidgetCard key={id} onClick={onShowVisibilityModal}>
              <VisibilityWidget visibility={currentVisibility} bound={visibilityBound} lang={lang} />
          </WidgetCard>
        );
      case 'cloudLayers':
        return (
          <WidgetCard key={id} onClick={onShowCloudLayersModal}>
              <CloudLayersWidget low={currentCloudLow} mid={currentCloudMid} high={currentCloudHigh} lang={lang} />
          </WidgetCard>
        );
      case 'pressure':
        return (
          <WidgetCard key={id} onClick={onShowPressureModal}>
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
        );
      case 'dewPoint':
        return (
          <WidgetCard key={id} onClick={onShowComfortModal}>
              {/* Risc Zero Aplicat: Evitem el "?? 0" en l'humitat i confiem en el tipatge natiu undefined */}
              <DewPointWidget
                  value={dewPointValue}
                  humidity={currentHumidity as number | undefined}
                  lang={lang}
              />
          </WidgetCard>
        );
      case 'cape':
        return (
          <WidgetCard key={id} onClick={onShowStormModal}>
              <CapeWidget capeData={safeCapeData} currentHourIndex={currentHourIndex} lang={lang} />
          </WidgetCard>
        );
      case 'aqi':
        return (
          <WidgetCard key={id} cols={2} onClick={onShowAqiModal}>
              <AqiWidget data={aqiData?.current as Record<string, unknown> | undefined} lang={lang} />
          </WidgetCard>
        );
      case 'moon':
        return (
          <WidgetCard key={id} onClick={onShowMoonModal}>
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
        );
      case 'sun':
        return (
          <WidgetCard key={id} cols={2} onClick={onShowSolarModal} onIntent={preloadSolarModal}>
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
        );
      case 'snowLevel':
        if (!showSnowWidget || freezingLevel === null) return null;
        return (
          <WidgetCard key={id} fullRow onClick={onShowSnowLevelModal}>
              <SnowLevelWidget
                  freezingLevel={freezingLevel}
                  chartData={chartDataFull}
                  elevation={typeof weatherData.elevation === 'number' ? weatherData.elevation : null}
                  unit={unit}
                  lang={lang}
              />
          </WidgetCard>
        );
      default:
        return null;
    }
  };

  return (
    <div className={className}>
      {ids.map(renderWidget)}
    </div>
  );
}
