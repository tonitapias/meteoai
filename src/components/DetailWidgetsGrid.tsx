// src/components/DetailWidgetsGrid.tsx
// La graella dels ginys de detall (temperatura, vent, UV, visibilitat... i cota de neu), cadascun a la seva targeta, que
// n'obre el modal. El sol i la lluna ja no hi són: la pestanya Cel té els seus plafons (components/sky). Abans vivia dins ExpertWidgets; ara és una peça a part i `ids` tria quins ginys hi surten i en quin
// ordre, perquè es puguin repartir en llocs diferents. Els valors es calculen exactament igual que abans.
import React, { useMemo } from 'react';
import { Gauge } from 'lucide-react';
import { getCurrentDewPoint } from '../utils/weatherMath';
import { ExtendedWeatherData } from '../types/weatherLogicTypes';
import { WEATHER_THRESHOLDS } from '../constants/weatherConfig';

import { Language, TRANSLATIONS } from '../translations';
import { WeatherUnit } from '../utils/formatters';

import { UVIndexWidget } from './widgets/UVIndexWidget';
import { getCurrentUV } from '../utils/uvIndexUtils';
import { resolveCurrentDisplayVisibility } from '../utils/visibilityDisplay';
import type { ChartDataPoint } from './ForecastSection';
import { ALL_DETAIL_WIDGETS, type DetailWidgetId } from './detailWidgetIds';
import { buildTemperatureWindow } from '../utils/temperatureDetail';
import { buildDetailCardLabel, type DetailCardInput } from '../utils/detailCardLabel';
import { pressureDelta3h } from '../utils/pressureTrend';
import {
  CompassGauge,
  SnowLevelWidget,
  CloudLayersWidget,
  CircularGauge,
  DewPointWidget,
  CapeWidget,
  AqiWidget,
  VisibilityWidget,
  TemperatureWidget
} from './widgets';

const DEFAULT_GRID_CLASS = 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 pb-20 grid-flow-dense';

// onIntent: el dit toca o el focus arriba a la targeta, abans del clic; serveix per precarregar el modal.
// fullRow: ocupa tota la fila a qualsevol amplada. És per als ginys panoràmics: la temperatura (la primera) i la cota de
// neu, que només surt de vegades i sempre queda l'última: sense això a PC es quedava sola en 1 de 4 columnes (i en 1 de 2
// a tauleta).
// `col-span-full` (de la primera a l'última columna) val per a qualsevol graella, també la de 3 de les pestanyes.
// label: nom accessible del botó ("Vent 6 km/h SO · Detall", utils/detailCardLabel.ts). Sense nom, el lector de pantalla
// llegia tot el contingut de la targeta barrejat ("VENT 239° SO N S O E VENT FLUIXET 6 KM/H…").
interface WidgetCardProps { children: React.ReactNode; label: string; cols?: number; fullRow?: boolean; onClick?: () => void; onIntent?: () => void; }

const WidgetCard = ({ children, label, cols = 1, fullRow = false, onClick, onIntent }: WidgetCardProps) => (
  <div
    className={`${fullRow ? 'col-span-full' : `col-span-1 ${cols === 2 ? 'md:col-span-2' : ''}`} h-full flex flex-col animate-in fade-in zoom-in-95 duration-700 fill-mode-both rounded-2xl overflow-hidden bg-white/5 border border-white/10 shadow-lg ${onClick ? 'cursor-pointer transition-colors hover:border-white/20 hover:bg-white/[0.07] focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/60' : ''}`}
    onClick={onClick}
    onPointerDown={onIntent}
    onFocus={onIntent}
    role={onClick ? 'button' : undefined}
    aria-label={onClick ? label : undefined}
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
  onShowStormModal: () => void;
  onShowAqiModal: () => void;
  onShowUvModal: () => void;
  onShowPressureModal: () => void;
  onShowComfortModal: () => void;
  onShowVisibilityModal: () => void;
  onShowCloudLayersModal: () => void;
  onShowSnowLevelModal: () => void;
  onShowWindModal: () => void;
  onShowTemperatureModal: () => void;
  // Codi de temps de la capçalera (ja passat per la política de boira): decideix si el giny de
  // Visibilitat pot dir "boira" (vegeu utils/visibilityDisplay.ts).
  effectiveCode?: number | null;
  /** Quins ginys i en quin ordre. Per defecte, tots en l'ordre de sempre. */
  ids?: readonly DetailWidgetId[];
  /** Classe de la graella. Per defecte, la de 4 columnes de sempre. */
  className?: string;
}

export default function DetailWidgetsGrid({ weatherData, aqiData, lang, unit, freezingLevel, chartDataFull, onShowStormModal, onShowAqiModal, onShowUvModal, onShowPressureModal, onShowComfortModal, onShowVisibilityModal, onShowCloudLayersModal, onShowSnowLevelModal, onShowWindModal, onShowTemperatureModal, effectiveCode = null, ids = ALL_DETAIL_WIDGETS, className = DEFAULT_GRID_CLASS }: DetailWidgetsGridProps) {
  const { current, hourly } = weatherData;

  const showSnowWidget = typeof freezingLevel === 'number' && freezingLevel < WEATHER_THRESHOLDS.DEFAULTS.MAX_DISPLAY_SNOW_LEVEL;

  const currentTemp = typeof current?.temperature_2m === 'number' ? current.temperature_2m : undefined;
  const currentWindSpeed = typeof current?.wind_speed_10m === 'number' ? current.wind_speed_10m : undefined;

  const currentWindDir = typeof current?.wind_direction_10m === 'number' ? current.wind_direction_10m : undefined;
  const currentWindGusts = typeof current?.wind_gusts_10m === 'number' ? current.wind_gusts_10m : undefined;
  const { meters: currentVisibility, bound: visibilityBound } = resolveCurrentDisplayVisibility(current, effectiveCode);
  const currentCloudLow = typeof current?.cloud_cover_low === 'number' ? current.cloud_cover_low : undefined;
  const currentCloudMid = typeof current?.cloud_cover_mid === 'number' ? current.cloud_cover_mid : undefined;
  const currentCloudHigh = typeof current?.cloud_cover_high === 'number' ? current.cloud_cover_high : undefined;
  // Títols del vent i la pressió del diccionari de l'idioma (abans "Wind" i "Pressure" en anglès per a es i fr).
  const trLabels = TRANSLATIONS[lang] ?? TRANSLATIONS.ca;
  const currentPressure = typeof current?.pressure_msl === 'number' ? current.pressure_msl : undefined;
  const currentHumidity = typeof current?.relative_humidity_2m === 'number' ? current.relative_humidity_2m : undefined;

  const currentUV = useMemo(() => getCurrentUV(weatherData), [weatherData]);

  const dewPointValue = getCurrentDewPoint(currentTemp, currentHumidity);

  const currentHourIndex = useMemo(() => {
    if (!hourly || !current || !Array.isArray(hourly.time) || typeof current.time !== 'string') return -1;

    const hourPrefix = current.time.substring(0, 13);
    const idx = hourly.time.findIndex(t => typeof t === 'string' && t.startsWith(hourPrefix));
    return idx;
  }, [hourly, current]);

  // DOCTRINA RISC ZERO: ΔP de les últimes 3 h, el mateix càlcul que el modal (utils/pressureTrend.ts); null si falta.
  const pressureTrend = pressureDelta3h(hourly?.pressure_msl, currentHourIndex);

  const safeCapeData = useMemo(() => {
    if (!hourly || !Array.isArray(hourly.cape)) return [];
    return hourly.cape.map(c => typeof c === 'number' ? c : null);
  }, [hourly]);

  // --- Valors per al nom accessible de les targetes que no el reben ja calculat (només si la targeta hi és) ---
  // La temperatura d'ara del giny (i de la capçalera): la primera hora de la seva finestra.
  const temperatureNow = useMemo(
    () => (ids.includes('temperature') ? buildTemperatureWindow(weatherData, 1)[0]?.temp ?? null : null),
    [ids, weatherData]
  );

  if (!current) return null;

  const cardLabel = (input: DetailCardInput) => buildDetailCardLabel(input, lang);

  const renderWidget = (id: DetailWidgetId): React.ReactNode => {
    switch (id) {
      case 'temperature':
        // Panoràmic a tota l'amplada (com la cota de neu): ara, sensació, rang d'avui i les pròximes 24 h.
        return (
          <WidgetCard key={id} fullRow onClick={onShowTemperatureModal} label={cardLabel({ id, celsius: temperatureNow, unit })}>
              <TemperatureWidget weatherData={weatherData} unit={unit} lang={lang} />
          </WidgetCard>
        );
      case 'wind':
        return (
          <WidgetCard key={id} onClick={onShowWindModal} label={cardLabel({ id, kmh: currentWindSpeed, degrees: currentWindDir })}>
              <CompassGauge
                degrees={currentWindDir}
                speed={currentWindSpeed}
                gusts={currentWindGusts}
                label={trLabels.wind}
                lang={lang}
              />
          </WidgetCard>
        );
      case 'uv':
        return (
          <WidgetCard key={id} onClick={onShowUvModal} label={cardLabel({ id, index: currentUV })}>
              <UVIndexWidget uvIndex={currentUV} lang={lang} />
          </WidgetCard>
        );
      case 'visibility':
        return (
          <WidgetCard key={id} onClick={onShowVisibilityModal} label={cardLabel({ id, meters: currentVisibility, bound: visibilityBound })}>
              <VisibilityWidget visibility={currentVisibility} bound={visibilityBound} lang={lang} />
          </WidgetCard>
        );
      case 'cloudLayers':
        return (
          <WidgetCard key={id} onClick={onShowCloudLayersModal} label={cardLabel({ id, low: currentCloudLow, mid: currentCloudMid, high: currentCloudHigh })}>
              <CloudLayersWidget low={currentCloudLow} mid={currentCloudMid} high={currentCloudHigh} lang={lang} />
          </WidgetCard>
        );
      case 'pressure':
        return (
          <WidgetCard key={id} onClick={onShowPressureModal} label={cardLabel({ id, hpa: currentPressure })}>
              <CircularGauge
                  // Gauge, la mateixa icona que el modal de Pressió (abans AlertOctagon, que semblava un avís).
                  icon={<Gauge className="w-5 h-5 text-indigo-400"/>}
                  label={trLabels.pressure}
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
          <WidgetCard key={id} onClick={onShowComfortModal} label={cardLabel({ id, celsius: dewPointValue })}>
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
          <WidgetCard key={id} onClick={onShowStormModal} label={cardLabel({ id, jkg: safeCapeData[currentHourIndex] ?? null })}>
              <CapeWidget capeData={safeCapeData} currentHourIndex={currentHourIndex} lang={lang} />
          </WidgetCard>
        );
      case 'aqi':
        return (
          <WidgetCard key={id} cols={2} onClick={onShowAqiModal} label={cardLabel({ id, current: aqiData?.current })}>
              <AqiWidget data={aqiData?.current as Record<string, unknown> | undefined} lang={lang} />
          </WidgetCard>
        );
      case 'snowLevel':
        if (!showSnowWidget || freezingLevel === null) return null;
        return (
          <WidgetCard key={id} fullRow onClick={onShowSnowLevelModal} label={cardLabel({ id, freezingLevel, unit })}>
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
