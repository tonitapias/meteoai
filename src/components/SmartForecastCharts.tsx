// src/components/SmartForecastCharts.tsx
// Extret de WeatherCharts.tsx: usat només en Mode Expert, carregat com a chunk propi
// (lazy) des de DashboardContent.tsx. Havia d'anar en un fitxer separat perquè Rollup
// pugui aïllar-lo de debò — quan compartia fitxer amb MinutelyPreciseChart (importat de
// manera estàtica des del mateix DashboardContent.tsx), la importació dinàmica no tenia
// cap efecte: Rollup manté tot el mòdul al chunk principal si hi ha qualsevol camí
// d'importació estàtica cap a ell, encara que sigui cap a un altre export del fitxer.
import { useState, useMemo, useRef, useEffect, memo, type ReactNode } from 'react';
import { Wind, Thermometer, Mountain, Umbrella } from 'lucide-react';
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
import { SmartChartLegend, type LegendModel } from './SmartChartLegend';
import { MATRIX_BG } from './widgets/widgetStyles';

type ChartLayer = 'temp' | 'rain' | 'precip' | 'wind' | 'cloud' | 'humidity' | 'snowLevel';
type ChartTab = 'temp' | 'rain' | 'wind' | 'snow';

// Estil de cada model de comparació (vegeu utils/hourlyChartSeries.ts: cada sèrie va alineada hora a
// hora amb la principal). ECMWF, GFS i ICON conserven els traços de sempre; AIFS és el quart model.
const MODEL_STYLE: Record<ChartModelKey, { label: string; color: string; dash: string }> = {
    ecmwf: { label: 'ECMWF', color: CHART_COLORS.models.ecmwf, dash: '6 3' },
    gfs: { label: 'GFS', color: CHART_COLORS.models.gfs, dash: '3 5' },
    icon: { label: 'ICON', color: CHART_COLORS.models.icon, dash: '1 4' },
    aifs: { label: 'AIFS', color: CHART_COLORS.models.aifs, dash: '8 2 2 2' }
};

// Marges del gràfic: a l'esquerra hi caben les xifres de l'eix Y; a dalt, el rètol i el cartell.
const PADDING_TOP = 46;
const PADDING_BOTTOM = 32;

interface SingleHourlyChartProps {
    data: HourlyChartPoint[];
    comparisonData: ComparisonSeries | null;
    /** Models que es dibuixen (línia, o punts al volum) i surten al cartell. */
    drawnModels: ChartModelKey[];
    /** Models que formen la banda (poden incloure'n un d'idèntic a la principal, que no es dibuixa). */
    bandModels: ChartModelKey[];
    layer: ChartLayer;
    unit: string;
    hoveredIndex: number | null;
    setHoveredIndex: (idx: number | null) => void;
    height?: number;
    lang?: Language;
    /** Substitueix el títol del rètol (p. ex. el volum de pluja, que no té clau global de traducció). */
    title?: string;
    /** Nom del model regional que dibuixa la línia principal (les hores que en vénen). */
    regionalModelLabel?: string | null;
    /** Posició d'"ara" dins la sèrie, si hi és: línia vertical, punt a la línia i "ARA" a l'eix. */
    nowIndex?: number | null;
}

interface LayerConfig {
    key: string;
    color: string;
    gradientStart: string;
    title: string;
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

const SingleHourlyChart = memo(({ data, comparisonData, drawnModels, bandModels, layer, unit, hoveredIndex, setHoveredIndex, height = 160, lang = 'ca', title, regionalModelLabel, nowIndex = null }: SingleHourlyChartProps) => {
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

  // DOCTRINA RISC ZERO: Extracció tipada
  const tRecord = (TRANSLATIONS[lang] || TRANSLATIONS['ca']) as Record<string, unknown>;
  const text = getSmartForecastText(lang);
  const locale = getSafeLocale(lang);

  const layersConfig = useMemo<Record<string, LayerConfig>>(() => ({
    temp: { key: 'temp', title: typeof tRecord.temp === 'string' ? tRecord.temp : "TEMP", ...CHART_COLORS.temp },
    rain: { key: 'rain', title: typeof tRecord.rainProb === 'string' ? tRecord.rainProb : "PROB. PLUJA", ...CHART_COLORS.rain },
    precip: { key: 'precip', title: "VOLUM (MM)", ...CHART_COLORS.precip },
    wind: { key: 'wind', title: typeof tRecord.wind === 'string' ? tRecord.wind : "VENT", ...CHART_COLORS.wind },
    cloud: { key: 'cloud', title: typeof tRecord.cloud === 'string' ? tRecord.cloud : "NÚVOLS", ...CHART_COLORS.cloud },
    humidity: { key: 'humidity', title: typeof tRecord.humidity === 'string' ? tRecord.humidity : "HUMITAT", ...CHART_COLORS.humidity },
    snowLevel: { key: 'snowLevel', title: typeof tRecord.snowLevel === 'string' ? tRecord.snowLevel : "COTA NEU", ...CHART_COLORS.snowLevel }
  }), [tRecord]);

  const currentConfig = layersConfig[layer] || layersConfig['temp'];
  const dataKey = currentConfig.key;
  const isBars = layer === 'precip';
  const isWind = layer === 'wind';

  const paddingLeft = width < 500 ? 34 : 44;
  const paddingRight = width < 500 ? 12 : 20;

  const dims = useMemo(() => ({
      width,
      height,
      paddingX: paddingRight,
      paddingY: PADDING_BOTTOM,
      paddingLeft,
      paddingRight,
      paddingTop: PADDING_TOP,
      paddingBottom: PADDING_BOTTOM
  }), [width, height, paddingLeft, paddingRight]);

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
  const plotWidth = width - paddingLeft - paddingRight;
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

      return { linePath, areaPath, bandPath: generateBandPath(band), modelPaths, gustPath: generateSmoothPath(gustPoints, height) };
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

  const showComparison = hoverModels.length > 0;
  // El nom de la línia principal és el del model regional si aquella hora en ve, o "model global".
  const primaryLabel = hoveredIndex !== null && data[hoveredIndex]?.regional && regionalModelLabel
      ? regionalModelLabel
      : text.globalModel;
  // Els decimals segueixen l'idioma (0,5 mm al català, 0.5 mm a l'anglès), com les xifres clau.
  const oneDecimal = (v: number): string => v.toLocaleString(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const fmtVal = (val: number | null | undefined): string => (val == null) ? "-" : (layer === 'precip' ? oneDecimal(val) : Math.round(val).toString());
  const fmtTick = (v: number): string => (layer === 'temp' ? `${Math.round(v)}°` : Number.isInteger(v) ? String(v) : oneDecimal(v));

  const nowPoint = nowIndex !== null && nowIndex >= 0 && nowIndex < points.length ? points[nowIndex] : null;
  const barWidth = Math.max(3, Math.min(16, stepX * 0.6));
  const everyLabel = width < 600 ? 4 : 3;

  // Arrossegar el dit per sobre del gràfic recorre les hores (els rectangles només senten el primer contacte).
  const handleTouch = (e: React.TouchEvent<SVGSVGElement>) => {
    const touch = e.touches[0];
    const svg = svgRef.current;
    if (!touch || !svg) return;
    const box = svg.getBoundingClientRect();
    const scale = box.width > 0 ? width / box.width : 1;
    setHoveredIndex(xToIndex((touch.clientX - box.left) * scale, points.length, dims));
  };

  return (
    <div ref={containerRef} className="relative w-full h-full group select-none overflow-hidden rounded-xl border border-white/5 bg-black/60 shadow-[inset_0_2px_10px_rgba(0,0,0,0.5)] backdrop-blur-md" style={{ transform: 'translateZ(0)' }}>

      <div className={MATRIX_BG}></div>

      {/* Etiqueta Tàctica (Capa z-10): comença just després de l'eix Y perquè no tapi les xifres */}
      <div className="absolute top-3 text-[10px] font-bold text-slate-300 uppercase tracking-widest z-10 flex items-center gap-2 bg-[#050608]/90 px-3 py-1.5 rounded-md backdrop-blur-md border border-white/10 shadow-[0_4px_10px_rgba(0,0,0,0.5)]" style={{ left: paddingLeft + 8 }}>
         <span className="w-2 h-2 rounded-full" style={{backgroundColor: currentConfig.color, boxShadow: `0 0 10px ${currentConfig.color}`}}></span>
         {title ?? currentConfig.title}
      </div>

      {/* Cartell Emergent HUD (Spatial UI Mobile-First) */}
      {hoverData && hoverData.value !== null && (
        <div
          className="absolute z-20 pointer-events-none flex flex-col rounded-xl bg-[#050608]/95 backdrop-blur-xl border border-white/10 shadow-[0_10px_30px_rgba(0,0,0,0.8)] transition-all duration-75 ease-out overflow-hidden"
          style={{
            left: `${Math.min(width - 80, Math.max(80, hoverData.x))}px`,
            top: '12px',
            transform: 'translateX(-50%)',
            borderColor: `${currentConfig.color}60`,
            width: '160px'
          }}
        >
          <div className="bg-white/5 py-1.5 rounded-t-xl border-b border-white/5 text-[10px] font-black text-slate-300 tracking-widest uppercase shadow-inner text-center">
            {formatRawTime(hoverData.time)}
          </div>

          <div className="p-2.5 flex flex-col gap-1.5 justify-center items-center">
            <div className="text-xl font-black tracking-tighter tabular-nums drop-shadow-md" style={{ color: currentConfig.color }}>
              {showComparison && <span className="text-slate-500 text-[8px] font-bold tracking-widest uppercase mr-1">{primaryLabel}</span>}
              {fmtVal(hoverData.value)}<span className="text-[10px] ml-0.5 opacity-80">{unit}</span>
            </div>

            {(showComparison || hoverGust) && (
              <div className="flex flex-col gap-1 text-[11px] font-bold w-full border-t border-white/5 pt-1.5 mt-0.5">
                {hoverGust && (
                  <div style={{ color: currentConfig.color }} className="flex justify-between px-1">
                    <span className="text-slate-500 text-[9px] font-medium tracking-wide">{text.gust}:</span>
                    <span>{fmtVal(hoverGust.value)}{unit}</span>
                  </div>
                )}
                {hoverModels.map(({ key, point }) => (
                  <div key={key} style={{ color: MODEL_STYLE[key].color }} className="flex justify-between px-1">
                    <span className="text-slate-500 text-[9px] font-medium tracking-wide">{MODEL_STYLE[key].label}:</span>
                    <span>{fmtVal(point.value)}{unit}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Renderitzat de Gràfics de Telemetria */}
      <svg
        ref={svgRef}
        width={width}
        height={height}
        role="img"
        aria-label={title ?? currentConfig.title}
        className="w-full h-full drop-shadow-md touch-pan-y block relative z-0"
        onTouchMove={handleTouch}
      >
        <defs>
          <linearGradient id={`gradient-${layer}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={currentConfig.gradientStart} stopOpacity="0.5" />
            <stop offset="100%" stopColor={currentConfig.gradientStart} stopOpacity="0.0" />
          </linearGradient>
          <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
             <feGaussianBlur stdDeviation="3" result="blur" />
             <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* Ombra de les hores de nit */}
        {nights.map(run => {
          const x0 = Math.max(paddingLeft, indexToX(run.start, points.length, dims) - stepX / 2);
          const x1 = Math.min(width - paddingRight, indexToX(run.end, points.length, dims) + stepX / 2);
          return <rect key={`night-${run.start}`} data-testid="night-shade" x={x0} y={PADDING_TOP} width={Math.max(0, x1 - x0)} height={baselineY - PADDING_TOP} fill="rgba(148,163,184,0.07)" />;
        })}

        {/* Quadrícula i escala de l'eix Y */}
        {axis.ticks.map(tick => {
          const y = valueToY(tick, dims, axis);
          return (
            <g key={`tick-${tick}`} data-testid="y-tick">
              <line x1={paddingLeft} y1={y} x2={width - paddingRight} y2={y} stroke={tick === axis.min ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.06)'} strokeWidth="1" strokeDasharray={tick === axis.min ? undefined : '2 5'} />
              <text x={paddingLeft - 6} y={y + 3.5} textAnchor="end" fill="#64748b" fontSize="10" fontWeight="700" className="font-mono">{fmtTick(tick)}</text>
            </g>
          );
        })}

        {/* Canvi de dia: separador de mitjanit amb el nom del dia */}
        {dayChanges.map(i => {
          const x = indexToX(i, points.length, dims);
          return (
            <g key={`day-${i}`} data-testid="midnight-marker">
              <line x1={x} y1={PADDING_TOP} x2={x} y2={baselineY} stroke="rgba(148,163,184,0.45)" strokeWidth="1" strokeDasharray="3 4" />
              <text x={x + 5} y={PADDING_TOP + 12} fill="#94a3b8" fontSize="10" fontWeight="700" className="font-mono">{formatDayLabel(data[i].time, locale)}</text>
            </g>
          );
        })}

        {/* Polílínies dels models de predicció (o, al volum, barres de la principal i un punt per model) */}
        {!isBars && paths.areaPath && <path d={paths.areaPath} fill={`url(#gradient-${layer})`} className="transition-all duration-500 ease-out" />}
        {!isBars && paths.bandPath && <path data-testid="model-band" d={paths.bandPath} fill={currentConfig.color} fillOpacity="0.14" stroke="none" />}
        {!isBars && drawnModels.map(key => paths.modelPaths[key] && (
          <path key={key} d={paths.modelPaths[key]} fill="none" stroke={MODEL_STYLE[key].color} strokeWidth="1.5" strokeOpacity="0.6" strokeLinecap="round" strokeDasharray={MODEL_STYLE[key].dash} />
        ))}
        {isBars && points.map((p, i) => p.value !== null && p.value > 0 && (
          <rect key={`bar-${i}`} data-testid="precip-bar" x={p.x - barWidth / 2} y={p.y} width={barWidth} height={Math.max(1, baselineY - p.y)} rx="2" fill={currentConfig.color} fillOpacity="0.85" />
        ))}
        {isBars && drawnModels.map(key =>
          modelPoints[key].map((mp, i) => mp.value !== null && mp.value > 0 && (
            <circle key={`dot-${key}-${i}`} data-testid="precip-dot" cx={points[i].x + (CHART_MODEL_KEYS.indexOf(key) - 1.5) * 3.2} cy={mp.y} r="2.4" fill={MODEL_STYLE[key].color} stroke="#050608" strokeWidth="0.75" />
          ))
        )}
        {isWind && paths.gustPath && <path data-testid="gust-line" d={paths.gustPath} fill="none" stroke={currentConfig.color} strokeWidth="1.75" strokeOpacity="0.75" strokeLinecap="round" strokeDasharray="5 4" />}
        {!isBars && paths.linePath && <path d={paths.linePath} fill="none" stroke={currentConfig.color} strokeWidth="3" strokeLinecap="round" filter="url(#glow)" className="transition-all duration-500 ease-out" />}

        {/* Marca d'"ara" */}
        {nowPoint && (
          <g data-testid="now-marker">
            <line x1={nowPoint.x} y1={PADDING_TOP} x2={nowPoint.x} y2={baselineY} stroke="rgba(226,232,240,0.4)" strokeWidth="1" strokeDasharray="2 3" />
            {!isBars && nowPoint.value !== null && <circle cx={nowPoint.x} cy={nowPoint.y} r="4.5" fill="#050608" stroke={currentConfig.color} strokeWidth="2" />}
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

        {/* Retolació temporal inferiors; sota la marca d'"ara" hi diu ARA en lloc de l'hora */}
        {points.map((p, i) => {
            const isNow = nowPoint !== null && i === nowIndex;
            if (!isNow && i % everyLabel !== 0) return null;
            if (!isNow && nowPoint !== null && Math.abs(p.x - nowPoint.x) < 34) return null;
            return (
              <text key={`txt-${i}`} x={p.x} y={height - 10} textAnchor="middle" fill={isNow ? '#e2e8f0' : '#64748b'} fontSize="10" fontWeight="700" className={`${isNow ? '' : 'opacity-80 '}uppercase tracking-widest font-mono`}>
                {isNow ? text.legend.now : `${getRawHour(p.time)}h`}
              </text>
            );
        })}

        {/* Targetes geomètriques de marcatge (SGV Intern) */}
        {hoverData && hoverData.value !== null && (
          <g>
            {/* Línia vertical tàctica de rastreig */}
            <line x1={hoverData.x} y1={PADDING_TOP - 10} x2={hoverData.x} y2={baselineY} stroke={currentConfig.color} strokeWidth="1.5" strokeDasharray="4 4" opacity="0.6" />

            {/* Targetes de nodes */}
            {hoverModels.map(({ key, point }) => (
              <circle key={key} cx={point.x} cy={point.y} r="3.5" fill={MODEL_STYLE[key].color} stroke="#050608" strokeWidth="1.5" opacity="0.9" />
            ))}
            {hoverGust && <circle cx={hoverGust.x} cy={hoverGust.y} r="3.5" fill={currentConfig.color} stroke="#050608" strokeWidth="1.5" opacity="0.9" />}

            <circle cx={hoverData.x} cy={hoverData.y} r="5" fill="#050608" stroke={currentConfig.color} strokeWidth="2.5" filter="url(#glow)" />
            <circle cx={hoverData.x} cy={hoverData.y} r="2" fill="white" />
          </g>
        )}
      </svg>
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

const KeyFigures = ({ items }: { items: KeyFigureData[] }) => (
    <div className="grid grid-cols-3 gap-2 mb-3">
        {items.map(item => (
            <div key={item.label} className="rounded-xl bg-white/[0.03] border border-white/5 px-3 py-2 min-w-0">
                <div className="text-[9px] font-black uppercase tracking-widest text-slate-500 leading-tight">{item.label}</div>
                <div className="text-lg font-black tabular-nums text-slate-100 leading-tight mt-0.5">{item.value}</div>
                <div className="text-[10px] font-bold text-slate-500 truncate min-h-[14px]">{item.sub}</div>
            </div>
        ))}
    </div>
);

// Xip d'acord entre els models globals. Les classes són literals perquè Tailwind les detecti.
const AGREEMENT_CHIP_CLASSES: Record<AgreementLevel | 'none', string> = {
    high: 'text-emerald-300 border-emerald-500/30',
    medium: 'text-amber-300 border-amber-500/30',
    low: 'text-rose-300 border-rose-500/30',
    none: 'text-slate-400 border-white/10'
};

const AgreementBadge = ({ level, text }: { level: AgreementLevel | null; text: SmartForecastText['agreement'] }) => {
    const key = level ?? 'none';
    return (
        <div
            className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full border bg-[#050608]/90 text-[10px] font-black uppercase tracking-widest ${AGREEMENT_CHIP_CLASSES[key]}`}
            title={text.hint}
        >
            <span className="w-1.5 h-1.5 rounded-full bg-current" aria-hidden="true"></span>
            <span>{text[key]}</span>
        </div>
    );
};

// Capçalera fixa de cada bloc: el xip d'acord queda FORA del gràfic, i sempre a la vista.
const AgreementRow = ({ level, text }: { level: AgreementLevel | null; text: SmartForecastText['agreement'] }) => (
    <div className="flex justify-end mb-2">
        <AgreementBadge level={level} text={text} />
    </div>
);

const Note = ({ children }: { children: ReactNode }) => (
    <p className="text-[11px] font-medium text-slate-500 mt-2 px-1">{children}</p>
);

// Cota de neu sense res a dibuixar (a l'estiu és a 4.500 m tota la finestra): una frase en lloc d'una línia plana.
const SnowCompactCard = ({ label, value, message }: { label: string; value: string | null; message: string }) => (
    <div data-testid="snow-compact" className="flex items-center gap-4 rounded-xl border border-white/5 bg-black/60 px-4 py-4 shadow-[inset_0_2px_10px_rgba(0,0,0,0.5)]">
        <div className="p-2.5 rounded-xl bg-white/5 border border-white/10 text-slate-300 shrink-0">
            <Mountain className="w-5 h-5" aria-hidden="true" />
        </div>
        <div className="min-w-0">
            <div className="text-[10px] font-black uppercase tracking-widest text-slate-500">{label}</div>
            {value && <div className="text-lg font-black tabular-nums text-slate-100 leading-tight">{value}</div>}
            <div className="text-[11px] font-medium text-slate-400 mt-0.5">{message}</div>
        </div>
    </div>
);

interface SmartForecastChartsProps {
    data: HourlyChartPoint[];
    comparisonData: ComparisonSeries | null;
    unit: string;
    lang?: Language;
    /** Etiqueta del model regional actiu (p. ex. "AROME HD"); null si la previsió és del model global. */
    regionalModelLabel?: string | null;
    /** Posició d'"ara" dins `data` (null si l'hora actual no hi és). */
    nowIndex?: number | null;
    /** `current.time` de les dades ("2026-09-21T14:05"): diu de quina hora és la previsió. */
    updatedAt?: string | null;
}

const SmartForecastCharts = memo(({ data, comparisonData, unit, lang = 'ca', regionalModelLabel = null, nowIndex = null, updatedAt = null }: SmartForecastChartsProps) => {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<ChartTab>('temp');
  const [hiddenByUser, setHiddenByUser] = useState<ChartModelKey[]>([]);
  const [showBand, setShowBand] = useState(true);

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
  const at = (index: number | null | undefined): string => (index == null ? '' : `${text.sub.at} ${hourAt(index)}`);

  const tabs: Array<{ id: ChartTab; icon: typeof Thermometer; label: string }> = [
      { id: 'temp', icon: Thermometer, label: typeof tRecord.temp === 'string' ? tRecord.temp : "TEMP" },
      { id: 'rain', icon: Umbrella, label: text.rain },
      { id: 'wind', icon: Wind, label: typeof tRecord.wind === 'string' ? tRecord.wind : "VENT" },
      { id: 'snow', icon: Mountain, label: typeof tRecord.snowLevel === 'string' ? tRecord.snowLevel : "NEU" },
  ];

  const { temp, rain, wind, snowLevel } = insights;

  const tempFigures: KeyFigureData[] = [
      { label: text.figures.high, value: temp.high ? degrees(temp.high.value) : '—', sub: temp.high ? hourAt(temp.high.index) : '' },
      { label: text.figures.low, value: temp.low ? degrees(temp.low.value) : '—', sub: temp.low ? hourAt(temp.low.index) : '' },
      { label: text.figures.maxDisagreement, value: temp.maxDisagreement ? `${fmt(temp.maxDisagreement.value)}°` : '—', sub: at(temp.maxDisagreement?.index) },
  ];

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
      {
          label: text.figures.modelsWithRain,
          value: rain.modelsCompared > 0 ? `${rain.modelsWithRain} ${text.sub.of} ${rain.modelsCompared}` : '—',
          sub: rain.modelsCompared > 0 ? text.sub.rainThreshold : ''
      },
  ];

  const windFigures: KeyFigureData[] = [
      { label: text.figures.maxGust, value: wind.maxGust ? `${Math.round(wind.maxGust.value)} km/h` : '—', sub: wind.maxGust ? hourAt(wind.maxGust.index) : '' },
      { label: text.figures.maxWind, value: wind.maxWind ? `${Math.round(wind.maxWind.value)} km/h` : '—', sub: wind.maxWind ? hourAt(wind.maxWind.index) : '' },
      { label: text.figures.avgDisagreement, value: wind.averageSpread !== null ? `${fmt(wind.averageSpread)} km/h` : '—', sub: wind.averageSpread !== null ? text.sub.betweenModels : '' },
  ];

  const snowFigures: KeyFigureData[] = [
      { label: text.figures.snowLow, value: snowLevel.low ? meters(snowLevel.low.value) : '—', sub: snowLevel.low ? hourAt(snowLevel.low.index) : '' },
      { label: text.figures.snowHigh, value: snowLevel.high ? meters(snowLevel.high.value) : '—', sub: snowLevel.high ? hourAt(snowLevel.high.index) : '' },
      { label: text.figures.avgDisagreement, value: snowLevel.averageSpread !== null ? meters(snowLevel.averageSpread) : '—', sub: snowLevel.averageSpread !== null ? text.sub.betweenModels : '' },
  ];

  // Notes sota els gràfics: només quan expliquen una cosa que el lector es preguntaria en mirar-los.
  const identicalNote = identicalModels.length > 0
      ? text.notes.identical.replace('{names}', identicalModels.map(k => MODEL_STYLE[k].label).join(', '))
      : null;
  const aifsNoProbability = !!comparisonData
      && comparisonData.aifs.length > 0
      && comparisonData.aifs.every(p => p.rain === null);

  const snowCap = WEATHER_THRESHOLDS.DEFAULTS.MAX_DISPLAY_SNOW_LEVEL;
  const snowLabel = typeof tRecord.snowLevel === 'string' ? tRecord.snowLevel : "NEU";

  // Nom del model de la línia principal a la llegenda (el regional només si alguna hora en ve de debò).
  const principalLabel = regionalModelLabel && data.some(p => p.regional) ? regionalModelLabel : text.globalModel;
  const updatedTime = updatedAt?.match(/T(\d{2}:\d{2})/)?.[1] ?? null;
  const legendModels: LegendModel[] = availableModels.map(key => ({
      key,
      label: MODEL_STYLE[key].label,
      color: MODEL_STYLE[key].color,
      state: identicalModels.includes(key) ? 'identical' : hiddenByUser.includes(key) ? 'off' : 'on'
  }));
  const toggleModel = (key: ChartModelKey) =>
      setHiddenByUser(prev => (prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]));

  const chartEl = (layer: ChartLayer, chartUnit: string, height: number, extra: Partial<SingleHourlyChartProps> = {}) => (
      <SingleHourlyChart
          data={data}
          comparisonData={comparisonData}
          drawnModels={drawnModels}
          bandModels={bandModels}
          layer={layer}
          unit={chartUnit}
          hoveredIndex={hoveredIndex}
          setHoveredIndex={setHoveredIndex}
          height={height}
          lang={lang}
          regionalModelLabel={regionalModelLabel}
          nowIndex={nowIndex}
          {...extra}
      />
  );

  // Cada pestanya (mòbil) i cada bloc (escriptori) és el mateix contingut: xifres clau, gràfic(s) i notes.
  // Sense clau `agreement` = el bloc no porta xip d'acord (la cota de neu compacta no té res a comparar).
  const sections: Record<ChartTab, { agreement?: AgreementLevel | null; figures: KeyFigureData[] | null; notes: ReactNode; charts: (mobile: boolean) => ReactNode }> = {
      temp: {
          agreement: temp.agreement,
          figures: tempFigures,
          notes: identicalNote && <Note>{identicalNote}</Note>,
          charts: mobile => (
              <div style={{ height: mobile ? 260 : 384 }} className="w-full">
                  {chartEl('temp', unit, mobile ? 260 : 384)}
              </div>
          )
      },
      rain: {
          agreement: rain.agreement,
          figures: rainFigures,
          notes: (identicalNote || aifsNoProbability) && (
              <Note>{[identicalNote, aifsNoProbability ? text.notes.aifsNoProbability : null].filter(Boolean).join(' ')}</Note>
          ),
          // Volum (barres) i probabilitat (línies), apilats en un sol panell: comparteixen l'eix de temps i el cursor.
          charts: mobile => (
              <div className="flex flex-col gap-3 w-full">
                  <div style={{ height: mobile ? 210 : 240 }} className="w-full">
                      {chartEl('precip', 'mm', mobile ? 210 : 240, { title: text.volume })}
                  </div>
                  {/* Prou alt perquè hi càpiga el cartell amb la principal i els 4 models (~190 px). */}
                  <div style={{ height: 220 }} className="w-full">
                      {chartEl('rain', '%', 220)}
                  </div>
              </div>
          )
      },
      wind: {
          agreement: wind.agreement,
          figures: windFigures,
          notes: <Note>{[text.notes.gusts, identicalNote].filter(Boolean).join(' ')}</Note>,
          charts: mobile => (
              <div style={{ height: mobile ? 260 : 256 }} className="w-full">
                  {chartEl('wind', 'km/h', mobile ? 260 : 256)}
              </div>
          )
      },
      snow: snowDisplay === 'chart'
          ? {
              agreement: snowLevel.agreement,
              figures: snowFigures,
              notes: identicalNote && <Note>{identicalNote}</Note>,
              charts: mobile => (
                  <div style={{ height: mobile ? 260 : 256 }} className="w-full">
                      {chartEl('snowLevel', 'm', mobile ? 260 : 256)}
                  </div>
              )
          }
          : {
              figures: null,
              notes: null,
              charts: () => snowDisplay === 'above-cap'
                  ? <SnowCompactCard label={snowLabel} value={`> ${snowCap.toLocaleString(locale)} m`} message={text.snow.above.replace('{cap}', snowCap.toLocaleString(locale))} />
                  : <SnowCompactCard label={snowLabel} value={null} message={text.snow.noData} />
          }
  };

  const activeSection = sections[activeTab];

  return (
    <div className="w-full flex flex-col gap-4">
      {/* SPATIAL UI: Segmented Control Tàctic (Coherent amb el Header i Radar) */}
      <div className="flex md:hidden bg-[#050608]/90 p-1.5 rounded-xl border border-white/5 backdrop-blur-md overflow-x-auto no-scrollbar shadow-[inset_0_4px_10px_rgba(0,0,0,0.8)] relative z-10">
          {tabs.map((tab) => (
              <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-1.5 px-3 py-2.5 rounded-lg text-[10px] sm:text-xs font-black uppercase tracking-widest whitespace-nowrap transition-all duration-300 flex-1 justify-center ${
                      activeTab === tab.id
                      ? 'bg-cyan-950/40 text-cyan-400 border border-cyan-900/50 shadow-[0_4px_12px_rgba(0,0,0,0.5)] transform scale-[1.02]'
                      : 'text-slate-500 hover:text-slate-300 hover:bg-white/5 border border-transparent'
                  }`}
                  aria-pressed={activeTab === tab.id}
              >
                  <tab.icon className={`w-3.5 h-3.5 transition-all duration-300 ${activeTab === tab.id ? 'text-cyan-400 drop-shadow-[0_0_5px_rgba(34,211,238,0.6)]' : 'text-slate-500'}`} />
                  {tab.label}
              </button>
          ))}
      </div>

      <SmartChartLegend
          principalLabel={principalLabel}
          models={legendModels}
          bandAvailable={availableModels.length >= 2}
          showBand={showBand}
          onToggleModel={toggleModel}
          onToggleBand={() => setShowBand(v => !v)}
          updatedText={updatedTime ? text.legend.updated.replace('{time}', updatedTime) : null}
          text={text.legend}
      />

      <div className="relative w-full bg-transparent rounded-2xl p-0 md:p-4 overflow-hidden" onMouseLeave={() => setHoveredIndex(null)}>
          {/* Pantalles petites: una mètrica per pestanya, gràfics a tota l'amplada (sense desplaçament lateral) */}
          <div className="md:hidden w-full">
             {'agreement' in activeSection && <AgreementRow level={activeSection.agreement ?? null} text={text.agreement} />}
             {activeSection.figures && <KeyFigures items={activeSection.figures} />}
             {activeSection.charts(true)}
             {activeSection.notes}
          </div>

          {/* Pantalles Grans: un bloc per mètrica (temperatura, pluja, vent, cota de neu) */}
          <div className="hidden md:flex flex-col gap-8 w-full">
             {(Object.keys(sections) as ChartTab[]).map(tab => (
                 <div key={tab} className="w-full">
                     {'agreement' in sections[tab] && <AgreementRow level={sections[tab].agreement ?? null} text={text.agreement} />}
                     {sections[tab].figures && <KeyFigures items={sections[tab].figures as KeyFigureData[]} />}
                     {sections[tab].charts(false)}
                     {sections[tab].notes}
                 </div>
             ))}
          </div>
      </div>
    </div>
  );
});

SmartForecastCharts.displayName = 'SmartForecastCharts';

export default SmartForecastCharts;
