// src/components/SmartForecastCharts.tsx
// Els gràfics horaris de la pestanya Previsió (pròximes 24 h): una mètrica cada vegada (Temp · Pluja · Vent · Neu) a
// totes les amplades. A dalt, una sola lectura de l'hora (en repòs, la d'ara) i l'acord entre els models globals; al
// mig, el gràfic, amb la previsió en color i els quatre models globals en gris fi (es veu quina és la previsió i quin
// marge hi ha entre models); a la temperatura, la màxima, la mínima i el desacord màxim marcats sobre la corba, com al
// giny de Detall. A baix, la llegenda i els models, plegats.
//
// Carregat com a chunk propi (lazy) des de TabbedDashboard.tsx. Havia d'anar en un fitxer separat perquè Rollup pugui
// aïllar-lo de debò — quan compartia fitxer amb MinutelyPreciseChart (importat de manera estàtica des del mateix tauler),
// la importació dinàmica no tenia cap efecte.
import { useState, useMemo, useRef, useEffect, memo, type ReactNode } from 'react';
import { Mountain } from 'lucide-react';
import { TRANSLATIONS, Language } from '../translations';
import { CHART_COLORS } from '../constants/chartColors';
import { WEATHER_THRESHOLDS } from '../constants/weatherConfig';
import {
    calculateAxis,
    generateGraphPoints,
    generateSmoothPath,
    generateBandPath,
    indexToX,
    xToIndex,
    valueToY,
    ChartDataPoint,
    GraphPoint,
    BandPoint
} from '../utils/chartUtils';
import {
    buildChartInsights,
    classifySnowLevel,
    modelsIdenticalToPrimary,
    type AgreementLevel,
    type ChartInsights,
    type ComparisonSeries
} from '../utils/chartInsights';
import { dayChangeIndices, formatDayLabel, nightRuns } from '../utils/chartTimeMarks';
import { CHART_MODEL_KEYS, type ChartModelKey, type HourlyChartPoint } from '../utils/hourlyChartSeries';
import { getSafeLocale } from '../utils/formatters';
import { getSmartForecastText, type SmartForecastText } from './smartForecastI18n';
import { DashSample, SmartChartLegend, type LegendModel } from './SmartChartLegend';
import { SmartChartReadout, type ReadoutItem } from './SmartChartReadout';
import { MATRIX_BG } from './widgets/widgetStyles';

type ChartLayer = 'temp' | 'rain' | 'precip' | 'wind' | 'cloud' | 'humidity' | 'snowLevel';
type ChartTab = 'temp' | 'rain' | 'wind' | 'snow';

// Els models de comparació es dibuixen tots en gris fi; cadascun conserva el seu traç per distingir-los.
const MODEL_STYLE: Record<ChartModelKey, { label: string; dash: string }> = {
    ecmwf: { label: 'ECMWF', dash: '6 3' },
    gfs: { label: 'GFS', dash: '3 5' },
    icon: { label: 'ICON', dash: '1 4' },
    aifs: { label: 'AIFS', dash: '8 2 2 2' }
};
const MODEL_LINE = '#7c879a';
const MODEL_DOT = '#94a3b8';
const BAND_FILL = 'rgba(148,163,184,0.12)';
const SURFACE = '#0b0d14';

// Color de cada pestanya (el de la seva línia principal).
const TAB_COLOR: Record<ChartTab, string> = {
    temp: CHART_COLORS.temp.color,
    rain: CHART_COLORS.rain.color,
    wind: CHART_COLORS.wind.color,
    snow: CHART_COLORS.snowLevel.color
};

// Marges del gràfic: a la dreta hi caben les xifres de l'eix Y (com als gràfics de Detall: el punt d'"ara" és a l'esquerra).
const PADDING_LEFT = 6;
const PADDING_RIGHT = 36;
const PADDING_BOTTOM = 26;
// Mitja amplada aproximada d'una píndola («Mínima 12° · 05H»): la que es fa servir per no tapar la corba.
const PILL_HALF_WIDTH = 55;

const PAD_X = 'px-4 sm:px-5 md:px-6';

/** Marques sobre la corba (només temperatura): màxima, mínima i el desacord màxim entre models. */
interface ChartAnnotations {
    high?: { index: number; label: string; value: string; hour: string };
    low?: { index: number; label: string; value: string; hour: string };
    spread?: { index: number; text: string };
}

interface SingleHourlyChartProps {
    data: HourlyChartPoint[];
    comparisonData: ComparisonSeries | null;
    /** Models que es dibuixen (línia, o punts al volum). */
    drawnModels: ChartModelKey[];
    /** Models que formen la banda (poden incloure'n un d'idèntic a la principal, que no es dibuixa). */
    bandModels: ChartModelKey[];
    layer: ChartLayer;
    hoveredIndex: number | null;
    setHoveredIndex: (idx: number | null) => void;
    height: number;
    lang?: Language;
    /** Rètol petit a dalt (la pestanya de pluja en porta dos gràfics: volum i probabilitat). */
    label?: string;
    /** Posició d'"ara" dins la sèrie, si hi és: línia vertical, punt a la línia i "ARA" a l'eix. */
    nowIndex?: number | null;
    annotations?: ChartAnnotations;
}

interface LayerConfig {
    key: string;
    color: string;
    gradientStart: string;
}

const getRawHour = (isoString: string | null | undefined): number => {
    if (!isoString) return 0;
    try {
        if (isoString.includes('T')) {
            const timePart = isoString.split('T')[1];
            if (timePart) return parseInt(timePart.split(':')[0], 10) || 0;
        }
        return new Date(isoString).getHours() || 0;
    } catch {
        return 0;
    }
};

const formatRawTime = (isoString: string | null | undefined): string => {
    if (!isoString) return "--:--";
    try {
        return isoString.split('T')[1]?.substring(0, 5) || "--:--";
    } catch {
        return "--:--";
    }
};

const LAYERS: Record<ChartLayer, LayerConfig> = {
    temp: { key: 'temp', ...CHART_COLORS.temp },
    rain: { key: 'rain', ...CHART_COLORS.rain },
    precip: { key: 'precip', ...CHART_COLORS.precip },
    wind: { key: 'wind', ...CHART_COLORS.wind },
    cloud: { key: 'cloud', ...CHART_COLORS.cloud },
    humidity: { key: 'humidity', ...CHART_COLORS.humidity },
    snowLevel: { key: 'snowLevel', ...CHART_COLORS.snowLevel }
};

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

const SingleHourlyChart = memo(({ data, comparisonData, drawnModels, bandModels, layer, hoveredIndex, setHoveredIndex, height, lang = 'ca', label, nowIndex = null, annotations }: SingleHourlyChartProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [width, setWidth] = useState<number>(1000);

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentRect) {
          setWidth(Math.max(entry.contentRect.width, 100));
        }
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  const text = getSmartForecastText(lang);
  const locale = getSafeLocale(lang);

  const currentConfig = LAYERS[layer] || LAYERS.temp;
  const dataKey = currentConfig.key;
  const isBars = layer === 'precip';
  const isWind = layer === 'wind';
  // A dalt, lloc per al rètol o per a la píndola de la màxima.
  const paddingTop = label ? 30 : annotations?.high ? 26 : 16;

  const dims = useMemo(() => ({
      width,
      height,
      paddingX: PADDING_RIGHT,
      paddingY: PADDING_BOTTOM,
      paddingLeft: PADDING_LEFT,
      paddingRight: PADDING_RIGHT,
      paddingTop,
      paddingBottom: PADDING_BOTTOM
  }), [width, height, paddingTop]);

  const chartPoints = useMemo(() => {
    const emptyModels = { ecmwf: [], gfs: [], icon: [], aifs: [] } as Record<ChartModelKey, GraphPoint[]>;
    const empty = { points: [] as GraphPoint[], modelPoints: emptyModels, gustPoints: [] as GraphPoint[], axis: calculateAxis([], layer) };
    if (!data || data.length === 0) return empty;

    const extractRaw = (d: ChartDataPoint): number | null => {
        let val: unknown = undefined;
        if (d[dataKey] !== undefined) val = d[dataKey];
        else if (dataKey === 'rain') val = d.pop ?? d.precipitation_probability;
        else if (dataKey === 'precip') val = d.precipitation ?? d.qpf;
        else if (dataKey === 'wind') val = d.wind_speed_10m;
        else if (dataKey === 'humidity') val = d.relative_humidity_2m;

        return (val !== undefined && val !== null && !isNaN(Number(val))) ? Number(val) : null;
    };

    // L'escala inclou TOTS els models (també els amagats): així amagar-ne un no fa saltar l'eix.
    let allValues: number[] = data.map(extractRaw).filter((v): v is number => v !== null);
    for (const key of CHART_MODEL_KEYS) {
        const series = comparisonData?.[key];
        if (series) allValues = [...allValues, ...series.map(extractRaw).filter((v): v is number => v !== null)];
    }
    if (isWind) {
        allValues = [...allValues, ...data.map(d => d.gusts).filter((v): v is number => typeof v === 'number' && !Number.isNaN(v))];
    }

    const axis = calculateAxis(allValues, layer);

    const modelPoints = { ...emptyModels };
    for (const key of CHART_MODEL_KEYS) {
        const series = comparisonData?.[key];
        modelPoints[key] = series && series.length > 0 ? generateGraphPoints(series, dims, axis, dataKey) : [];
    }

    const gustPoints = isWind
        ? generateGraphPoints(data.map(d => ({ time: d.time, gust: d.gusts })), dims, axis, 'gust')
        : [];

    return { points: generateGraphPoints(data, dims, axis, dataKey), modelPoints, gustPoints, axis };
  }, [data, comparisonData, layer, dataKey, isWind, dims]);

  const { points, modelPoints, gustPoints, axis } = chartPoints;
  const plotWidth = width - PADDING_LEFT - PADDING_RIGHT;
  const stepX = points.length > 1 ? plotWidth / (points.length - 1) : plotWidth;
  const baselineY = height - PADDING_BOTTOM;

  const paths = useMemo(() => {
      const linePath = generateSmoothPath(points, height);
      // L'àrea es tanca sobre el primer i l'últim punt AMB dada (els forats no compten com a extrems).
      const withValue = points.filter(p => p.value !== null);
      const areaPath = linePath && withValue.length > 0
          ? `${linePath} L ${withValue[withValue.length - 1].x},${baselineY} L ${withValue[0].x},${baselineY} Z`
          : "";

      // Banda de models: de la línia més alta a la més baixa de cada hora. Cal que en tinguin dada almenys dos.
      const band: Array<BandPoint | null> = points.map((p, i) => {
          const ys: number[] = [];
          for (const key of bandModels) {
              const mp = modelPoints[key][i];
              if (mp && mp.value !== null) ys.push(mp.y);
          }
          return ys.length >= 2 ? { x: p.x, top: Math.min(...ys), bottom: Math.max(...ys) } : null;
      });

      const modelPaths = {} as Record<ChartModelKey, string>;
      for (const key of CHART_MODEL_KEYS) modelPaths[key] = generateSmoothPath(modelPoints[key], height);

      return { linePath, areaPath, band, bandPath: generateBandPath(band), modelPaths, gustPath: generateSmoothPath(gustPoints, height) };
  }, [points, modelPoints, gustPoints, bandModels, height, baselineY]);

  const nights = useMemo(() => nightRuns(data ?? []), [data]);
  const dayChanges = useMemo(() => dayChangeIndices(data ?? []), [data]);

  if (!data || data.length === 0) return null;

  const hoverData = hoveredIndex !== null && hoveredIndex < points.length ? points[hoveredIndex] : null;
  const hoverModels = drawnModels
      .map(key => ({ key, point: hoveredIndex !== null && hoveredIndex < modelPoints[key].length ? modelPoints[key][hoveredIndex] : null }))
      .filter((m): m is { key: ChartModelKey; point: GraphPoint } => m.point !== null && m.point.value !== null);
  const hoverGust = isWind && hoveredIndex !== null && hoveredIndex < gustPoints.length && gustPoints[hoveredIndex].value !== null
      ? gustPoints[hoveredIndex]
      : null;

  // Els decimals segueixen l'idioma (0,5 mm al català, 0.5 mm a l'anglès), com les xifres clau.
  const oneDecimal = (v: number): string => v.toLocaleString(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const fmtTick = (v: number): string => (layer === 'temp' ? `${Math.round(v)}°` : Number.isInteger(v) ? v.toLocaleString(locale) : oneDecimal(v));

  const nowPoint = nowIndex !== null && nowIndex >= 0 && nowIndex < points.length ? points[nowIndex] : null;
  const barWidth = Math.max(3, Math.min(16, stepX * 0.6));
  const everyLabel = width < 600 ? 4 : 3;

  // Marques sobre la corba. Les píndoles es queden dins del gràfic (no surten pels costats ni tapen l'eix).
  const pillX = (x: number) => clamp(x, PADDING_LEFT + 48, width - PADDING_RIGHT - 48);
  const highPoint = annotations?.high && points[annotations.high.index]?.value !== null ? points[annotations.high.index] : null;
  const lowPoint = annotations?.low && points[annotations.low.index]?.value !== null ? points[annotations.low.index] : null;
  // La mínima va sota el punt si hi cap i no hi ha el claudàtor del desacord a tocar (la tapava); si no, a sobre.
  const spreadNearLow = !!annotations?.spread && !!annotations.low && Math.abs(annotations.spread.index - annotations.low.index) <= 3;
  const lowBelow = lowPoint !== null && lowPoint.y + 30 <= baselineY && !spreadNearLow;
  // A sobre, per damunt del punt més alt de la corba que queda sota la píndola (la corba no és plana a prop del mínim).
  const lowAboveTop = (() => {
      if (!lowPoint) return 0;
      const cx = pillX(lowPoint.x);
      const ys = points.filter(p => p.value !== null && Math.abs(p.x - cx) <= PILL_HALF_WIDTH).map(p => p.y);
      const curveTop = ys.length > 0 ? Math.min(...ys) : lowPoint.y;
      return Math.max(0, Math.min(lowPoint.y - 40, curveTop - 28));
  })();
  const spreadBand = annotations?.spread ? paths.band[annotations.spread.index] : null;
  // A tocar de l'eix de la dreta, el claudàtor i la xifra van a l'esquerra de l'hora (si no, trepitjarien l'escala).
  const spreadOnLeft = !!spreadBand && spreadBand.x + 9 + 44 > width - PADDING_RIGHT;
  const spreadX = annotations?.spread && spreadBand ? spreadBand.x + (spreadOnLeft ? -9 : 9) : null;

  // Arrossegar el dit per sobre del gràfic recorre les hores (els rectangles només senten el primer contacte).
  const handleTouch = (e: React.TouchEvent<SVGSVGElement>) => {
    const touch = e.touches[0];
    const svg = svgRef.current;
    if (!touch || !svg) return;
    const box = svg.getBoundingClientRect();
    const scale = box.width > 0 ? width / box.width : 1;
    setHoveredIndex(xToIndex((touch.clientX - box.left) * scale, points.length, dims));
  };

  const pillClass = 'absolute z-10 -translate-x-1/2 whitespace-nowrap rounded-md border border-white/[0.12] bg-[#0b0d14] px-2 py-0.5 text-[11px] text-slate-300 pointer-events-none';

  return (
    <div ref={containerRef} className="relative w-full select-none" style={{ height }}>

      {label && (
        <span className="absolute left-0 top-0 font-mono text-[10px] uppercase tracking-[0.12em] text-[#7a879b]">{label}</span>
      )}

      <svg
        ref={svgRef}
        width={width}
        height={height}
        role="img"
        aria-label={label ?? layer}
        className="w-full h-full touch-pan-y block"
        onTouchMove={handleTouch}
      >
        <defs>
          <linearGradient id={`gradient-${layer}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={currentConfig.gradientStart} stopOpacity="0.24" />
            <stop offset="100%" stopColor={currentConfig.gradientStart} stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Ombra de les hores de nit */}
        {nights.map(run => {
          const x0 = Math.max(PADDING_LEFT, indexToX(run.start, points.length, dims) - stepX / 2);
          const x1 = Math.min(width - PADDING_RIGHT, indexToX(run.end, points.length, dims) + stepX / 2);
          return <rect key={`night-${run.start}`} data-testid="night-shade" x={x0} y={paddingTop} width={Math.max(0, x1 - x0)} height={baselineY - paddingTop} fill="rgba(148,163,184,0.06)" />;
        })}

        {/* Quadrícula i escala de l'eix Y (a la dreta) */}
        {axis.ticks.map(tick => {
          const y = valueToY(tick, dims, axis);
          return (
            <g key={`tick-${tick}`} data-testid="y-tick">
              <line x1={PADDING_LEFT} y1={y} x2={width - PADDING_RIGHT} y2={y} stroke={tick === axis.min ? 'rgba(255,255,255,0.14)' : 'rgba(255,255,255,0.06)'} strokeWidth="1" strokeDasharray={tick === axis.min ? undefined : '2 5'} />
              {/* 11 px i #94a3b8: contrast AA sobre el fons fosc. */}
              <text x={width - 2} y={y + 4} textAnchor="end" fill="#94a3b8" fontSize="11" className="font-mono">{fmtTick(tick)}</text>
            </g>
          );
        })}

        {/* Canvi de dia: separador de mitjanit amb el nom del dia */}
        {dayChanges.map(i => {
          const x = indexToX(i, points.length, dims);
          return (
            <g key={`day-${i}`} data-testid="midnight-marker">
              <line x1={x} y1={paddingTop} x2={x} y2={baselineY} stroke="rgba(148,163,184,0.4)" strokeWidth="1" strokeDasharray="3 4" />
              <text x={x + 5} y={paddingTop + 12} fill="#94a3b8" fontSize="11" className="font-mono">{formatDayLabel(data[i].time, locale)}</text>
            </g>
          );
        })}

        {/* Models: la banda entre el més alt i el més baix, i cada model en gris fi (o, al volum, un punt per model) */}
        {!isBars && paths.areaPath && <path d={paths.areaPath} fill={`url(#gradient-${layer})`} />}
        {!isBars && paths.bandPath && <path data-testid="model-band" d={paths.bandPath} fill={BAND_FILL} stroke="none" />}
        {!isBars && drawnModels.map(key => paths.modelPaths[key] && (
          <path key={key} d={paths.modelPaths[key]} fill="none" stroke={MODEL_LINE} strokeWidth="1.2" strokeOpacity="0.65" strokeLinecap="round" strokeDasharray={MODEL_STYLE[key].dash} />
        ))}
        {isBars && points.map((p, i) => p.value !== null && p.value > 0 && (
          <rect key={`bar-${i}`} data-testid="precip-bar" x={p.x - barWidth / 2} y={p.y} width={barWidth} height={Math.max(1, baselineY - p.y)} rx="2" fill={currentConfig.color} fillOpacity="0.85" />
        ))}
        {isBars && drawnModels.map(key =>
          modelPoints[key].map((mp, i) => mp.value !== null && mp.value > 0 && (
            <circle key={`dot-${key}-${i}`} data-testid="precip-dot" cx={points[i].x + (CHART_MODEL_KEYS.indexOf(key) - 1.5) * 3.2} cy={mp.y} r="2.2" fill={MODEL_DOT} stroke={SURFACE} strokeWidth="0.75" />
          ))
        )}
        {isWind && paths.gustPath && <path data-testid="gust-line" d={paths.gustPath} fill="none" stroke={currentConfig.color} strokeWidth="1.6" strokeOpacity="0.7" strokeLinecap="round" strokeDasharray="5 4" />}
        {!isBars && paths.linePath && <path d={paths.linePath} fill="none" stroke={currentConfig.color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />}

        {/* Desacord màxim entre models: un claudàtor sobre la banda */}
        {spreadBand && spreadX !== null && (
          <path data-testid="spread-bracket" d={`M ${spreadX - 3},${spreadBand.top} H ${spreadX + 3} M ${spreadX},${spreadBand.top} V ${spreadBand.bottom} M ${spreadX - 3},${spreadBand.bottom} H ${spreadX + 3}`} fill="none" stroke="#fbbf24" strokeWidth="1.5" strokeLinecap="round" />
        )}
        {highPoint && <circle cx={highPoint.x} cy={highPoint.y} r="3.5" fill={currentConfig.color} />}
        {lowPoint && <circle cx={lowPoint.x} cy={lowPoint.y} r="3.5" fill={currentConfig.color} />}
        {/* Mínima a sobre: prou amunt per no tapar la corba, amb una línia guia fins al punt */}
        {lowPoint && !lowBelow && (
          <line x1={lowPoint.x} y1={lowAboveTop + 22} x2={lowPoint.x} y2={lowPoint.y - 6} stroke="rgba(226,232,240,0.45)" strokeWidth="1" strokeDasharray="2 3" />
        )}

        {/* Marca d'"ara" */}
        {nowPoint && (
          <g data-testid="now-marker">
            <line x1={nowPoint.x} y1={paddingTop} x2={nowPoint.x} y2={baselineY} stroke="rgba(226,232,240,0.35)" strokeWidth="1" strokeDasharray="2 3" />
            {!isBars && nowPoint.value !== null && <circle cx={nowPoint.x} cy={nowPoint.y} r="4.5" fill={SURFACE} stroke={currentConfig.color} strokeWidth="2" />}
          </g>
        )}

        {/* Capturadors d'esdeveniments tàctils */}
        {points.map((p, i) => (
          <rect
            key={`interaction-${i}`}
            x={p.x - (stepX / 2)}
            y={0}
            width={stepX}
            height={height}
            fill="transparent"
            onMouseEnter={() => setHoveredIndex(i)}
            onTouchStart={() => setHoveredIndex(i)}
            className="cursor-crosshair"
          />
        ))}

        {/* Hores a l'eix X; sota la marca d'"ara" hi diu ARA en lloc de l'hora */}
        {points.map((p, i) => {
            const isNow = nowPoint !== null && i === nowIndex;
            if (!isNow && i % everyLabel !== 0) return null;
            if (!isNow && nowPoint !== null && Math.abs(p.x - nowPoint.x) < 34) return null;
            return (
              <text key={`txt-${i}`} x={isNow ? Math.max(p.x, PADDING_LEFT + 12) : p.x} y={height - 8} textAnchor="middle" fill={isNow ? '#e2e8f0' : '#94a3b8'} fontSize="11" fontWeight={isNow ? 600 : 400} className="uppercase font-mono">
                {isNow ? text.legend.now : `${getRawHour(p.time)}h`}
              </text>
            );
        })}

        {/* Cursor: línia vertical i un punt per línia */}
        {hoverData && hoverData.value !== null && (
          <g pointerEvents="none">
            <line x1={hoverData.x} y1={paddingTop - 6} x2={hoverData.x} y2={baselineY} stroke="rgba(226,232,240,0.5)" strokeWidth="1" />
            {hoverModels.map(({ key, point }) => (
              <circle key={key} cx={point.x} cy={point.y} r="3.2" fill={MODEL_DOT} stroke={SURFACE} strokeWidth="1.5" />
            ))}
            {hoverGust && <circle cx={hoverGust.x} cy={hoverGust.y} r="3.2" fill={currentConfig.color} stroke={SURFACE} strokeWidth="1.5" />}
            <circle cx={hoverData.x} cy={hoverData.y} r="5" fill={SURFACE} stroke={currentConfig.color} strokeWidth="2.5" />
            <circle cx={hoverData.x} cy={hoverData.y} r="1.8" fill="#f8fafc" />
          </g>
        )}
      </svg>

      {highPoint && annotations?.high && (
        <span data-testid="pill-high" className={pillClass} style={{ left: pillX(highPoint.x), top: Math.max(0, highPoint.y - 28) }}>
          <span>{annotations.high.label}</span> <span className="font-semibold text-slate-50">{annotations.high.value}</span> · <span>{annotations.high.hour}</span>
        </span>
      )}
      {lowPoint && annotations?.low && (
        <span data-testid="pill-low" className={pillClass} style={{ left: pillX(lowPoint.x), top: lowBelow ? lowPoint.y + 9 : lowAboveTop }}>
          <span>{annotations.low.label}</span> <span className="font-semibold text-slate-50">{annotations.low.value}</span> · <span>{annotations.low.hour}</span>
        </span>
      )}
      {spreadBand && spreadX !== null && annotations?.spread && (
        <span className={`absolute z-10 pointer-events-none rounded bg-[#0b0d14]/80 px-0.5 font-mono text-[11px] font-semibold text-amber-300 ${spreadOnLeft ? '-translate-x-full' : ''}`} style={{ left: spreadOnLeft ? spreadX - 6 : spreadX + 6, top: (spreadBand.top + spreadBand.bottom) / 2 - 8 }}>
          {annotations.spread.text}
        </span>
      )}
    </div>
  );
});

SingleHourlyChart.displayName = 'SingleHourlyChart';

// --- XIFRES CLAU -----------------------------------------------------------------------------------------

interface KeyFigureData {
    label: string;
    value: string;
    sub: string;
}

// Una línia de xifres sota el gràfic (en lloc de les tres targetes d'abans).
const KeyFacts = ({ items }: { items: KeyFigureData[] }) => (
    <dl className="flex flex-wrap gap-x-5 gap-y-1.5 font-mono text-[11px]">
        {items.map(item => (
            <div key={item.label} className="flex items-baseline gap-1.5">
                <dt className="text-slate-400">{item.label}</dt>
                <dd className="font-semibold text-slate-100 tabular-nums">{item.value}</dd>
                {item.sub && <span className="text-slate-400 tabular-nums">{item.sub}</span>}
            </div>
        ))}
    </dl>
);

// Color del text de l'acord entre els models globals. Les classes són literals perquè Tailwind les detecti.
const AGREEMENT_CLASSES: Record<AgreementLevel | 'none', { text: string; dot: string }> = {
    high: { text: 'text-emerald-300', dot: 'bg-emerald-400' },
    medium: { text: 'text-amber-300', dot: 'bg-amber-400' },
    low: { text: 'text-rose-300', dot: 'bg-rose-400' },
    none: { text: 'text-slate-400', dot: 'bg-slate-500' }
};

const Agreement = ({ level, explanation, text }: { level: AgreementLevel | null; explanation: string | null; text: SmartForecastText['agreement'] }) => {
    const key = level ?? 'none';
    return (
        <div className="shrink-0 max-w-[48%] pt-0.5 text-right">
            <div className={`inline-flex items-center gap-1.5 text-[13px] font-semibold ${AGREEMENT_CLASSES[key].text}`} title={text.hint}>
                <span className={`w-1.5 h-1.5 rounded-full ${AGREEMENT_CLASSES[key].dot}`} aria-hidden="true"></span>
                <span>{text[key]}</span>
            </div>
            {explanation && <p className="mt-1 text-xs leading-snug text-slate-400">{explanation}</p>}
        </div>
    );
};

const Note = ({ children }: { children: ReactNode }) => (
    <p className="text-xs text-slate-400">{children}</p>
);

// Cota de neu sense res a dibuixar (a l'estiu és a 4.500 m tota la finestra): una frase en lloc d'una línia plana.
const SnowCompactCard = ({ label, value, message }: { label: string; value: string | null; message: string }) => (
    <div data-testid="snow-compact" className="flex items-center gap-4 py-4">
        <Mountain className="w-5 h-5 shrink-0 text-slate-400" aria-hidden="true" />
        <div className="min-w-0">
            <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-[#7a879b]">{label}</div>
            {value && <div className="text-lg font-semibold tabular-nums text-slate-100 leading-tight">{value}</div>}
            <div className="text-xs text-slate-400 mt-0.5">{message}</div>
        </div>
    </div>
);

interface SmartForecastChartsProps {
    /** Sèrie horària en la unitat de l'usuari (calculations.chartSeries): la temperatura es mostra en graus sense unitat. */
    data: HourlyChartPoint[];
    comparisonData: ComparisonSeries | null;
    lang?: Language;
    /** Etiqueta del model regional actiu (p. ex. "AROME HD"); null si la previsió és del model global. */
    regionalModelLabel?: string | null;
    /** Posició d'"ara" dins `data` (null si l'hora actual no hi és). */
    nowIndex?: number | null;
    /** `current.time` de les dades ("2026-09-21T14:05"): diu de quina hora és la previsió. */
    updatedAt?: string | null;
    /**
     * true (per defecte): targeta pròpia amb capçalera («Pròximes 24 h» i el model), com a la pestanya Previsió.
     * false: sense marc ni capçalera, per anar dins d'una targeta que ja en té (el detall del dia).
     */
    framed?: boolean;
}

const SmartForecastCharts = memo(({ data, comparisonData, lang = 'ca', regionalModelLabel = null, nowIndex = null, updatedAt = null, framed = true }: SmartForecastChartsProps) => {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<ChartTab>('temp');
  const [hiddenByUser, setHiddenByUser] = useState<ChartModelKey[]>([]);
  const [showBand, setShowBand] = useState(true);
  const [modelsOpen, setModelsOpen] = useState(false);

  // DOCTRINA RISC ZERO: Extracció tipada
  const tRecord = (TRANSLATIONS[lang] || TRANSLATIONS['ca']) as Record<string, unknown>;
  const text = getSmartForecastText(lang);

  // Resum i acord entre models: surten de la MATEIXA sèrie que dibuixa el gràfic, així no poden divergir.
  // L'acord és un fet de la previsió: no canvia si l'usuari amaga un model de la vista.
  const insights = useMemo<ChartInsights>(() => buildChartInsights(data ?? [], comparisonData), [data, comparisonData]);
  const identicalModels = useMemo(() => modelsIdenticalToPrimary(data ?? [], comparisonData), [data, comparisonData]);
  const availableModels = useMemo(
      () => (comparisonData ? CHART_MODEL_KEYS.filter(k => comparisonData[k].length > 0) : []),
      [comparisonData]
  );
  const drawnModels = useMemo(
      () => availableModels.filter(k => !identicalModels.includes(k) && !hiddenByUser.includes(k)),
      [availableModels, identicalModels, hiddenByUser]
  );
  const bandModels = useMemo(
      () => (showBand ? availableModels.filter(k => !hiddenByUser.includes(k)) : []),
      [showBand, availableModels, hiddenByUser]
  );
  const snowDisplay = useMemo(
      () => classifySnowLevel(data ?? [], WEATHER_THRESHOLDS.DEFAULTS.MAX_DISPLAY_SNOW_LEVEL),
      [data]
  );

  if (!data || data.length === 0) return null;

  const locale = getSafeLocale(lang);
  const fmt = (v: number, digits = 1): string => v.toLocaleString(locale, { minimumFractionDigits: digits, maximumFractionDigits: digits });
  const hourAt = (index: number | null | undefined): string => {
      const time = index == null ? undefined : data[index]?.time;
      return time ? `${String(getRawHour(time)).padStart(2, '0')}H` : '—';
  };
  const degrees = (v: number): string => `${Math.round(v)}°`;
  const meters = (v: number): string => `${Math.round(v).toLocaleString(locale)} m`;

  const tabs: Array<{ id: ChartTab; label: string; aria: string }> = [
      { id: 'temp', label: text.tabs.temp, aria: typeof tRecord.temp === 'string' ? tRecord.temp : text.tabs.temp },
      { id: 'rain', label: text.tabs.rain, aria: text.tabs.rain },
      { id: 'wind', label: text.tabs.wind, aria: typeof tRecord.wind === 'string' ? tRecord.wind : text.tabs.wind },
      { id: 'snow', label: text.tabs.snow, aria: typeof tRecord.snowLevel === 'string' ? tRecord.snowLevel : text.tabs.snow },
  ];

  const { temp, rain, wind, snowLevel } = insights;

  const startRange = rain.modelFirstRain
      ? (rain.modelFirstRain.first === rain.modelFirstRain.last
          ? hourAt(rain.modelFirstRain.first)
          : `${hourAt(rain.modelFirstRain.first)}–${hourAt(rain.modelFirstRain.last)}`)
      : '';
  // Si tots els models donen el mateix total (p. ex. un dia sec), un sol valor: "0,0–0,0 mm" seria soroll.
  const totalsRange = rain.modelTotals
      ? (fmt(rain.modelTotals.min) === fmt(rain.modelTotals.max)
          ? fmt(rain.modelTotals.min)
          : `${fmt(rain.modelTotals.min)}–${fmt(rain.modelTotals.max)}`)
      : '';
  const rainFigures: KeyFigureData[] = [
      {
          label: text.figures.total24h,
          value: rain.total !== null ? `${fmt(rain.total)} mm` : '—',
          sub: totalsRange ? `${text.sub.models} ${totalsRange} mm` : ''
      },
      {
          label: text.figures.rainStart,
          value: rain.firstRain !== null ? hourAt(rain.firstRain) : '—',
          sub: startRange ? `${text.sub.models} ${startRange}` : ''
      },
  ];

  const windFigures: KeyFigureData[] = [
      { label: text.figures.maxGust, value: wind.maxGust ? `${Math.round(wind.maxGust.value)} km/h` : '—', sub: wind.maxGust ? hourAt(wind.maxGust.index) : '' },
      { label: text.figures.maxWind, value: wind.maxWind ? `${Math.round(wind.maxWind.value)} km/h` : '—', sub: wind.maxWind ? hourAt(wind.maxWind.index) : '' },
  ];

  const snowFigures: KeyFigureData[] = [
      { label: text.figures.snowLow, value: snowLevel.low ? meters(snowLevel.low.value) : '—', sub: snowLevel.low ? hourAt(snowLevel.low.index) : '' },
      { label: text.figures.snowHigh, value: snowLevel.high ? meters(snowLevel.high.value) : '—', sub: snowLevel.high ? hourAt(snowLevel.high.index) : '' },
  ];

  // Una frase sota el xip d'acord: de quina xifra surt.
  const explanation: Record<ChartTab, string | null> = {
      temp: temp.maxDisagreement
          ? text.explain.temp.replace('{value}', `${fmt(temp.maxDisagreement.value)}°`).replace('{hour}', hourAt(temp.maxDisagreement.index))
          : null,
      rain: rain.modelsCompared > 0
          ? text.explain.rain.replace('{n}', String(rain.modelsWithRain)).replace('{m}', String(rain.modelsCompared))
          : null,
      wind: wind.averageSpread !== null ? text.explain.spread.replace('{value}', `${fmt(wind.averageSpread)} km/h`) : null,
      snow: snowLevel.averageSpread !== null ? text.explain.spread.replace('{value}', meters(snowLevel.averageSpread)) : null,
  };

  // Notes sota els gràfics: només quan expliquen una cosa que el lector es preguntaria en mirar-los.
  const identicalNote = identicalModels.length > 0
      ? text.notes.identical.replace('{names}', identicalModels.map(k => MODEL_STYLE[k].label).join(', '))
      : null;
  const aifsNoProbability = !!comparisonData
      && comparisonData.aifs.length > 0
      && comparisonData.aifs.every(p => p.rain === null);

  const snowCap = WEATHER_THRESHOLDS.DEFAULTS.MAX_DISPLAY_SNOW_LEVEL;
  const snowLabel = typeof tRecord.snowLevel === 'string' ? tRecord.snowLevel : text.tabs.snow;

  // Nom del model de la línia principal (el regional només si alguna hora en ve de debò).
  const principalLabel = regionalModelLabel && data.some(p => p.regional) ? regionalModelLabel : text.globalModel;
  const updatedTime = updatedAt?.match(/T(\d{2}:\d{2})/)?.[1] ?? null;
  const sourceText = updatedTime ? text.legend.source.replace('{model}', principalLabel).replace('{time}', updatedTime) : principalLabel;
  const legendModels: LegendModel[] = availableModels.map(key => ({
      key,
      label: MODEL_STYLE[key].label,
      dash: MODEL_STYLE[key].dash,
      state: identicalModels.includes(key) ? 'identical' : hiddenByUser.includes(key) ? 'off' : 'on'
  }));
  const toggleModel = (key: ChartModelKey) =>
      setHiddenByUser(prev => (prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]));

  // Lectura: les dades de l'hora tocada o, en repòs, les d'ARA mateix. Surt de la MATEIXA sèrie que el gràfic i
  // respecta els models que l'usuari ha amagat.
  const stripIndex = hoveredIndex ?? (nowIndex !== null && nowIndex >= 0 && nowIndex < data.length ? nowIndex : null);
  const oneDecimal = (v: number): string => v.toLocaleString(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const formatValue = (tab: ChartTab, p: HourlyChartPoint): string | null => {
      if (tab === 'temp') return p.temp === null ? null : degrees(p.temp);
      if (tab === 'wind') return p.wind === null ? null : `${Math.round(p.wind)} km/h`;
      if (tab === 'snow') return p.snowLevel === null ? null : meters(p.snowLevel);
      // Pluja als models: volum i probabilitat junts ("0,4 mm · 55%"); un model sense probabilitat (AIFS) només en porta el volum.
      const mm = p.precip === null ? null : `${oneDecimal(p.precip)} mm`;
      const pct = p.rain === null ? null : `${Math.round(p.rain)}%`;
      return mm !== null && pct !== null ? `${mm} · ${pct}` : (mm ?? pct);
  };
  const point = stripIndex !== null ? data[stripIndex] : null;
  const primaryValue = point
      ? activeTab === 'rain'
          ? (point.precip === null ? null : `${oneDecimal(point.precip)} mm`)
          : formatValue(activeTab, point)
      : null;
  const primaryNote = point && activeTab === 'rain' && point.rain !== null
      ? { key: 'prob', text: `${Math.round(point.rain)}%` }
      : point && activeTab === 'wind' && point.gusts !== null
          ? { key: 'gust', text: `${text.gust} ${Math.round(point.gusts)} km/h` }
          : null;
  const readoutModels: ReadoutItem[] = stripIndex === null ? [] : drawnModels.flatMap(key => {
      const modelPoint = comparisonData?.[key]?.[stripIndex];
      const value = modelPoint ? formatValue(activeTab, modelPoint) : null;
      return value !== null ? [{ key, label: MODEL_STYLE[key].label, value }] : [];
  });
  const agreementOf: Record<ChartTab, AgreementLevel | null> = {
      temp: temp.agreement, rain: rain.agreement, wind: wind.agreement, snow: snowLevel.agreement
  };
  // Alçada fixa per pestanya (la pluja porta "mm · %" a cada model i ocupa més files): el gràfic no es mou.
  const READOUT_MIN_HEIGHT: Record<ChartTab, number> = { temp: 92, rain: 112, wind: 92, snow: 92 };
  const snowCompact = activeTab === 'snow' && snowDisplay !== 'chart';
  const readoutEl = snowCompact ? null : (
      <SmartChartReadout
          title={stripIndex !== null ? `${formatRawTime(data[stripIndex]?.time)} · ${formatDayLabel(data[stripIndex]?.time ?? '', locale)}` : null}
          isNow={hoveredIndex === null && stripIndex !== null}
          nowLabel={text.legend.now}
          value={primaryValue}
          note={primaryNote}
          source={point ? (point.regional && regionalModelLabel ? regionalModelLabel : text.globalModel) : null}
          models={readoutModels}
          hint={text.strip.hint}
          aside={<Agreement level={agreementOf[activeTab]} explanation={explanation[activeTab]} text={text.agreement} />}
          minHeight={READOUT_MIN_HEIGHT[activeTab]}
      />
  );

  // El claudàtor del desacord només quan la banda és la de tots els models (amb algun d'amagat, no seria el mateix marge).
  const fullBand = showBand && hiddenByUser.length === 0 && availableModels.length >= 2;
  const tempAnnotations: ChartAnnotations = {
      high: temp.high ? { index: temp.high.index, label: text.figures.high, value: degrees(temp.high.value), hour: hourAt(temp.high.index) } : undefined,
      low: temp.low ? { index: temp.low.index, label: text.figures.low, value: degrees(temp.low.value), hour: hourAt(temp.low.index) } : undefined,
      spread: fullBand && temp.maxDisagreement ? { index: temp.maxDisagreement.index, text: `${fmt(temp.maxDisagreement.value)}°` } : undefined,
  };

  const chartEl = (layer: ChartLayer, height: number, extra: Partial<SingleHourlyChartProps> = {}) => (
      <SingleHourlyChart
          data={data}
          comparisonData={comparisonData}
          drawnModels={drawnModels}
          bandModels={bandModels}
          layer={layer}
          hoveredIndex={hoveredIndex}
          setHoveredIndex={setHoveredIndex}
          height={height}
          lang={lang}
          nowIndex={nowIndex}
          {...extra}
      />
  );

  const sections: Record<ChartTab, { figures: KeyFigureData[] | null; notes: ReactNode; charts: ReactNode }> = {
      temp: {
          figures: null,
          notes: identicalNote && <Note>{identicalNote}</Note>,
          charts: chartEl('temp', 260, { annotations: tempAnnotations })
      },
      rain: {
          figures: rainFigures,
          notes: (identicalNote || aifsNoProbability) && (
              <Note>{[identicalNote, aifsNoProbability ? text.notes.aifsNoProbability : null].filter(Boolean).join(' ')}</Note>
          ),
          // Volum (barres) i probabilitat (línies), apilats: comparteixen l'eix de temps i el cursor.
          charts: (
              <div className="flex flex-col gap-3">
                  {chartEl('precip', 190, { label: text.volume })}
                  {chartEl('rain', 200, { label: typeof tRecord.rainProb === 'string' ? tRecord.rainProb : 'PROB.' })}
              </div>
          )
      },
      wind: {
          figures: windFigures,
          notes: <Note>{[text.notes.gusts, identicalNote].filter(Boolean).join(' ')}</Note>,
          charts: chartEl('wind', 240)
      },
      snow: snowDisplay === 'chart'
          ? {
              figures: snowFigures,
              notes: identicalNote && <Note>{identicalNote}</Note>,
              charts: chartEl('snowLevel', 240)
          }
          : {
              figures: null,
              notes: null,
              charts: snowDisplay === 'above-cap'
                  ? <SnowCompactCard label={snowLabel} value={`> ${snowCap.toLocaleString(locale)} m`} message={text.snow.above.replace('{cap}', snowCap.toLocaleString(locale))} />
                  : <SnowCompactCard label={snowLabel} value={null} message={text.snow.noData} />
          }
  };

  const active = sections[activeTab];
  const hasModels = availableModels.length > 0;
  const bandAvailable = availableModels.length >= 2;
  const padX = framed ? PAD_X : '';

  return (
    <section
      className={framed
          ? 'relative flex h-full flex-col overflow-hidden rounded-[2rem] border border-white/[0.07] bg-gradient-to-b from-[#0e1018] to-[#0a0b11]'
          : 'relative flex flex-col'}
      onMouseLeave={() => setHoveredIndex(null)}
    >
      {framed && <div className={MATRIX_BG}></div>}

      {framed && (
          <div className={`relative z-10 flex items-baseline justify-between gap-3 ${padX} pt-4 md:pt-5 pb-3`}>
              <h3 className="font-mono text-[11px] font-medium uppercase tracking-[0.16em] text-slate-400 whitespace-nowrap">{text.window}</h3>
              <span data-testid="chart-source" className="min-w-0 truncate font-mono text-[10.5px] text-slate-400">{sourceText}</span>
          </div>
      )}

      {/* Una mètrica cada vegada. Pestanyes curtes: les quatre caben a 320 px sense desplaçament lateral. */}
      <div className={`relative z-10 ${padX}`}>
          <div className="grid grid-cols-4 gap-0.5 p-[3px] rounded-xl bg-black/35 border border-white/[0.06]">
              {tabs.map((tab) => {
                  const isActive = activeTab === tab.id;
                  return (
                      <button
                          key={tab.id}
                          type="button"
                          onClick={() => { setActiveTab(tab.id); setHoveredIndex(null); }}
                          aria-pressed={isActive}
                          aria-label={tab.aria}
                          className={`relative py-2.5 rounded-[9px] text-[13px] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-400 ${
                              isActive ? 'bg-white/[0.08] font-semibold text-slate-100' : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.03]'
                          }`}
                      >
                          {tab.label}
                          {isActive && <span className="absolute left-1/2 bottom-1 w-[18px] h-0.5 -ml-[9px] rounded-full" style={{ backgroundColor: TAB_COLOR[tab.id] }} aria-hidden="true"></span>}
                      </button>
                  );
              })}
          </div>
      </div>

      <div className={`relative z-10 flex flex-col gap-3 ${padX} pt-4 pb-4`}>
          {readoutEl}
          {active.charts}
          {active.figures && <KeyFacts items={active.figures} />}
          {active.notes}
      </div>

      {/* Llegenda: quina línia és quina; els models, plegats (s'hi poden amagar). */}
      <div className={`relative z-10 mt-auto border-t border-white/[0.06] ${padX} ${framed ? 'py-3' : 'pt-3'}`}>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 font-mono text-[10.5px] text-slate-400">
              <span className="flex items-center gap-1.5">
                  <span className="w-3.5 h-[2.5px] rounded-full" style={{ backgroundColor: TAB_COLOR[activeTab] }} aria-hidden="true"></span>
                  {principalLabel}
              </span>
              {hasModels && (
                  <span className="flex items-center gap-1.5">
                      <DashSample dash="4 3" />
                      {text.legend.globals.replace('{n}', String(availableModels.length))}
                  </span>
              )}
              {bandAvailable && showBand && (
                  <span className="flex items-center gap-1.5">
                      <span className="w-3 h-2 rounded-sm bg-slate-400/25" aria-hidden="true"></span>
                      {text.legend.margin}
                  </span>
              )}
              {hasModels && (
                  <button
                      type="button"
                      data-testid="models-toggle"
                      aria-expanded={modelsOpen}
                      aria-controls="smart-chart-models"
                      onClick={() => setModelsOpen(v => !v)}
                      className="ml-auto inline-flex items-center gap-1.5 min-h-[32px] px-3 rounded-lg border border-white/10 font-sans text-xs text-slate-300 hover:text-slate-100 hover:border-white/20 transition-colors"
                  >
                      {text.legend.models}
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={modelsOpen ? 'rotate-180' : ''}><path d="m6 9 6 6 6-6" /></svg>
                  </button>
              )}
          </div>
          {hasModels && modelsOpen && (
              <SmartChartLegend
                  id="smart-chart-models"
                  models={legendModels}
                  bandAvailable={bandAvailable}
                  showBand={showBand}
                  onToggleModel={toggleModel}
                  onToggleBand={() => setShowBand(v => !v)}
                  text={text.legend}
              />
          )}
      </div>
    </section>
  );
});

SmartForecastCharts.displayName = 'SmartForecastCharts';

export default SmartForecastCharts;
