// src/components/WeatherCharts.tsx
import { useState, useMemo, useRef, useEffect, memo } from 'react';
import { CloudRain, Wind, Thermometer, Mountain, Umbrella, Droplets } from 'lucide-react';
import { TRANSLATIONS, Language } from '../translations';
import { CHART_COLORS } from '../constants/chartColors';
import { 
    calculateYDomain, 
    generateGraphPoints, 
    generateSmoothPath, 
    ChartDataPoint
} from '../utils/chartUtils';

interface SingleHourlyChartProps {
    data: ChartDataPoint[];
    comparisonData: { gfs: ChartDataPoint[], icon: ChartDataPoint[] } | null;
    layer: 'temp' | 'rain' | 'precip' | 'wind' | 'cloud' | 'humidity' | 'snowLevel';
    unit: string;
    hoveredIndex: number | null;
    setHoveredIndex: (idx: number | null) => void;
    height?: number;
    lang?: Language;
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

export const SingleHourlyChart = memo(({ data, comparisonData, layer, unit, hoveredIndex, setHoveredIndex, height = 160, lang = 'ca' }: SingleHourlyChartProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
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

  const t = TRANSLATIONS[lang] || TRANSLATIONS['ca'];

  const layersConfig = useMemo<Record<string, LayerConfig>>(() => ({
    temp: { key: 'temp', title: t.temp, ...CHART_COLORS.temp },
    rain: { key: 'rain', title: t.rainProb, ...CHART_COLORS.rain },
    precip: { key: 'precip', title: "Volum (mm)", ...CHART_COLORS.precip },
    wind: { key: 'wind', title: t.wind, ...CHART_COLORS.wind },
    cloud: { key: 'cloud', title: t.cloud, ...CHART_COLORS.cloud },
    humidity: { key: 'humidity', title: t.humidity, ...CHART_COLORS.humidity },
    snowLevel: { key: 'snowLevel', title: t.snowLevel, ...CHART_COLORS.snowLevel }
  }), [t]);

  const currentConfig = layersConfig[layer] || layersConfig['temp'];
  const dataKey = currentConfig.key;
  
  const paddingX = width < 500 ? 10 : 20;
  const paddingY = 30;

  const chartPoints = useMemo(() => {
    if (!data || data.length === 0) return { points: [], gfsPoints: [], iconPoints: [] };
    
    const extractRaw = (d: ChartDataPoint): number | null => {
        // SOLUCIÓ RISC ZERO (no-explicit-any): Substiuït 'any' per 'unknown' per un tipatge dinàmic però segur.
        let val: unknown = undefined;
        if (d[dataKey] !== undefined) val = d[dataKey];
        else if (dataKey === 'rain') val = d.pop ?? d.precipitation_probability;
        else if (dataKey === 'precip') val = d.precipitation ?? d.qpf;
        else if (dataKey === 'wind') val = d.wind_speed_10m;
        else if (dataKey === 'humidity') val = d.relative_humidity_2m;
        
        return (val !== undefined && val !== null && !isNaN(Number(val))) ? Number(val) : null;
    };

    let allValues: number[] = data.map(extractRaw).filter((v): v is number => v !== null);
    
    if (comparisonData?.gfs) {
        allValues = [...allValues, ...comparisonData.gfs.map(extractRaw).filter((v): v is number => v !== null)];
    }
    if (comparisonData?.icon) {
        allValues = [...allValues, ...comparisonData.icon.map(extractRaw).filter((v): v is number => v !== null)];
    }

    if (allValues.length === 0) allValues = [0, 10]; 

    const domain = calculateYDomain(allValues, layer);
    const dims = { width, height, paddingX, paddingY };

    return {
        points: generateGraphPoints(data, dims, domain, dataKey),
        gfsPoints: comparisonData?.gfs ? generateGraphPoints(comparisonData.gfs, dims, domain, dataKey) : [],
        iconPoints: comparisonData?.icon ? generateGraphPoints(comparisonData.icon, dims, domain, dataKey) : [],
    };
  }, [data, comparisonData, layer, height, dataKey, width, paddingX, paddingY]);

  const { points, gfsPoints, iconPoints } = chartPoints;
  const safeLength = Math.max(1, points.length); 
  const rectWidth = width / safeLength;

  const paths = useMemo(() => {
      const linePath = generateSmoothPath(points, height);
      const areaPath = linePath && points.length > 0 
          ? `${linePath} L ${points[points.length-1]?.x || width - paddingX},${height} L ${points[0]?.x || paddingX},${height} Z` 
          : "";
      
      return { 
          linePath, 
          areaPath, 
          gfsPath: comparisonData?.gfs ? generateSmoothPath(gfsPoints, height) : "", 
          iconPath: comparisonData?.icon ? generateSmoothPath(iconPoints, height) : "" 
      };
  }, [points, gfsPoints, iconPoints, height, comparisonData, width, paddingX]);

  if (!data || data.length === 0) return null;

  const hoverData = hoveredIndex !== null && hoveredIndex < points.length ? points[hoveredIndex] : null;
  const hoverGfs = hoveredIndex !== null && hoveredIndex < gfsPoints.length ? gfsPoints[hoveredIndex] : null;
  const hoverIcon = hoveredIndex !== null && hoveredIndex < iconPoints.length ? iconPoints[hoveredIndex] : null;
  
  const showComparison = (hoverGfs && hoverGfs.value !== null) || (hoverIcon && hoverIcon.value !== null);
  const fmtVal = (val: number | null | undefined): string => (val == null) ? "-" : (layer === 'precip' ? val.toFixed(1) : Math.round(val).toString());

  return (
    <div ref={containerRef} className="relative w-full h-full group select-none overflow-hidden rounded-xl border border-white/5 bg-slate-900/30 backdrop-blur-md" style={{ transform: 'translateZ(0)' }}>
      
      {/* Etiqueta Tàctica (Capa z-10) */}
      <div className="absolute top-3 left-4 text-[10px] font-bold text-slate-300 uppercase tracking-widest z-10 flex items-center gap-2 bg-slate-950/80 px-3 py-1.5 rounded-md backdrop-blur-md border border-white/10 shadow-lg">
         <span className="w-2 h-2 rounded-full shadow-[0_0_8px_rgba(255,255,255,0.5)]" style={{backgroundColor: currentConfig.color, boxShadow: `0 0 10px ${currentConfig.color}`}}></span>
         {currentConfig.title}
      </div>

      {/* Cartell Emergent HUD (Solució Spatial UI desacoblada nativa en HTML a Capa z-20) */}
      {hoverData && hoverData.value !== null && (
        <div 
          className="absolute z-20 pointer-events-none flex flex-col rounded-md bg-slate-950/95 backdrop-blur-md border text-center shadow-2xl transition-all duration-75 ease-out"
          style={{ 
            left: `${Math.min(width - 85, Math.max(85, hoverData.x))}px`, 
            top: '12px', 
            transform: 'translateX(-50%)',
            borderColor: `${currentConfig.color}80`, 
            width: '150px'
          }}
        >
          <div className="bg-slate-900/90 py-1 rounded-t-md border-b border-white/5 text-[10px] font-bold text-slate-400 tracking-widest uppercase">
            {formatRawTime(hoverData.time)}
          </div>
          
          <div className="p-2 flex flex-col gap-1.5 justify-center items-center">
            <div className="text-[14px] font-black tracking-tight" style={{ color: currentConfig.color }}>
              {showComparison && <span className="text-slate-500 text-[9px] font-bold tracking-wider uppercase">LOCAL: </span>}
              {fmtVal(hoverData.value)}{unit}
            </div>
            
            {showComparison && (
              <div className="flex flex-col gap-0.5 text-[11px] font-bold w-full border-t border-slate-800 pt-1">
                {hoverGfs?.value != null && (
                  <div style={{ color: CHART_COLORS.models.gfs }} className="flex justify-between px-1">
                    <span className="text-slate-500 text-[9px] font-medium tracking-wide">GFS:</span>
                    <span>{fmtVal(hoverGfs.value)}{unit}</span>
                  </div>
                )}
                {hoverIcon?.value != null && (
                  <div style={{ color: CHART_COLORS.models.icon }} className="flex justify-between px-1">
                    <span className="text-slate-500 text-[9px] font-medium tracking-wide">ICON:</span>
                    <span>{fmtVal(hoverIcon.value)}{unit}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Renderitzat de Gràfics de Telemetria */}
      <svg width={width} height={height} className="w-full h-full drop-shadow-md touch-pan-x block">
        <defs>
          <linearGradient id={`gradient-${layer}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={currentConfig.gradientStart} stopOpacity="0.4" />
            <stop offset="100%" stopColor={currentConfig.gradientStart} stopOpacity="0.0" />
          </linearGradient>
          <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
             <feGaussianBlur stdDeviation="2" result="blur" />
             <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>
        
        {/* Retícules de fons */}
        <line x1={paddingX} y1={height - paddingY} x2={width - paddingX} y2={height - paddingY} stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
        <line x1={paddingX} y1={paddingY} x2={width - paddingX} y2={paddingY} stroke="rgba(255,255,255,0.05)" strokeWidth="1" strokeDasharray="2 6" />

        {/* Polílínies dels models de predicció */}
        {paths.areaPath && <path d={paths.areaPath} fill={`url(#gradient-${layer})`} className="transition-all duration-300" />}
        {paths.gfsPath && <path d={paths.gfsPath} fill="none" stroke={CHART_COLORS.models.gfs} strokeWidth="1.5" strokeOpacity="0.5" strokeLinecap="round" strokeDasharray="3 5"/>}
        {paths.iconPath && <path d={paths.iconPath} fill="none" stroke={CHART_COLORS.models.icon} strokeWidth="1.5" strokeOpacity="0.5" strokeLinecap="round" strokeDasharray="1 4"/>}
        {paths.linePath && <path d={paths.linePath} fill="none" stroke={currentConfig.color} strokeWidth="3" strokeLinecap="round" filter="url(#glow)" />}
        
        {/* Capturadors d'esdeveniments tàctils */}
        {points.map((p, i) => (
          <rect 
            key={`interaction-${i}`} 
            x={p.x - (rectWidth / 2)} 
            y={0} 
            width={rectWidth} 
            height={height} 
            fill="transparent" 
            onMouseEnter={() => setHoveredIndex(i)} 
            onTouchStart={() => setHoveredIndex(i)} 
            className="cursor-crosshair" 
          />
        ))}

        {/* Retolació temporal inferiors */}
        {points.map((p, i) => (i % (width < 600 ? 4 : 3) === 0) && (
            <text key={`txt-${i}`} x={p.x} y={height - 8} textAnchor="middle" fill="#64748b" fontSize="10" fontWeight="600" className="opacity-80">
                {getRawHour(p.time)}h
            </text>
        ))}

        {/* Targetes geomètriques de marcatge (SGV Intern) */}
        {hoverData && hoverData.value !== null && (
          <g>
            {/* Línia vertical tàctica de rastreig */}
            <line x1={hoverData.x} y1={0} x2={hoverData.x} y2={height - paddingY} stroke={currentConfig.color} strokeWidth="1" strokeDasharray="4 4" opacity="0.4" />
            
            {/* Targetes de nodes */}
            {hoverGfs?.value != null && <circle cx={hoverGfs.x} cy={hoverGfs.y} r="3" fill={CHART_COLORS.models.gfs} stroke="#0f172a" strokeWidth="1" opacity="0.9" />}
            {hoverIcon?.value != null && <circle cx={hoverIcon.x} cy={hoverIcon.y} r="3" fill={CHART_COLORS.models.icon} stroke="#0f172a" strokeWidth="1" opacity="0.9" />}
            <circle cx={hoverData.x} cy={hoverData.y} r="5" fill="#0f172a" stroke={currentConfig.color} strokeWidth="2.5" filter="url(#glow)" />
          </g>
        )}
      </svg>
    </div>
  );
});

SingleHourlyChart.displayName = 'SingleHourlyChart';

interface SmartForecastChartsProps {
    data: ChartDataPoint[];
    comparisonData: { gfs: ChartDataPoint[], icon: ChartDataPoint[] } | null;
    unit: string;
    lang?: Language;
}

export const SmartForecastCharts = memo(({ data, comparisonData, unit, lang = 'ca' }: SmartForecastChartsProps) => {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<'temp' | 'rain' | 'precip' | 'wind' | 'snow'>('temp');
  const t = TRANSLATIONS[lang] || TRANSLATIONS['ca'];

  if (!data || data.length === 0) return null;

  const tabs = [
      { id: 'temp', icon: Thermometer, label: t.temp },
      { id: 'precip', icon: Droplets, label: "Volum" }, 
      { id: 'rain', icon: Umbrella, label: "Prob." },   
      { id: 'wind', icon: Wind, label: t.wind },
      { id: 'snow', icon: Mountain, label: t.snowLevel },
  ];

  const getUnit = (tab: string): string => {
      switch(tab) {
          case 'rain': return '%';
          case 'precip': return 'mm';
          case 'wind': return 'km/h';
          case 'snow': return 'm';
          default: return unit;
      }
  };

  return (
    <div className="w-full flex flex-col gap-4">
      {/* Selector de mòduls tàctics */}
      <div className="flex md:hidden bg-slate-950/60 p-1.5 rounded-xl border border-slate-800 backdrop-blur-md overflow-x-auto no-scrollbar shadow-inner relative z-10">
          {tabs.map((tab) => (
              <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as 'temp' | 'rain' | 'precip' | 'wind' | 'snow')}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-[10px] sm:text-xs font-bold uppercase tracking-widest whitespace-nowrap transition-all duration-300 flex-1 justify-center ${
                      activeTab === tab.id 
                      ? 'bg-cyan-600/20 text-cyan-400 border border-cyan-500/30 shadow-[0_0_10px_rgba(6,182,212,0.15)] transform scale-[1.02]' 
                      : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/50 border border-transparent'
                  }`}
              >
                  <tab.icon className={`w-3.5 h-3.5 ${activeTab === tab.id ? 'text-cyan-400' : 'text-slate-500'}`} />
                  {tab.label}
              </button>
          ))}
      </div>

      <div className="relative w-full bg-transparent rounded-2xl p-0 md:p-4 overflow-hidden" onMouseLeave={() => setHoveredIndex(null)}>
          {/* Pantalles petites: Desplaçament lateral */}
          <div className="md:hidden w-full overflow-x-auto custom-scrollbar pb-2">
             <div className="min-w-[700px] h-64">
                 <SingleHourlyChart 
                     data={data} 
                     comparisonData={comparisonData} 
                     layer={activeTab === 'snow' ? 'snowLevel' : activeTab} 
                     unit={getUnit(activeTab)} 
                     hoveredIndex={hoveredIndex} 
                     setHoveredIndex={setHoveredIndex} 
                     height={220} 
                     lang={lang} 
                 />
             </div>
          </div>
          
          {/* Pantalles Grans: graella integral de panells combinats */}
          <div className="hidden md:flex flex-col gap-6 w-full">
             <div className="h-96 w-full">
                <SingleHourlyChart data={data} comparisonData={comparisonData} layer="temp" unit={unit} hoveredIndex={hoveredIndex} setHoveredIndex={setHoveredIndex} height={384} lang={lang} />
             </div>
             <div className="grid grid-cols-2 gap-6">
                <div className="h-64 w-full">
                    <SingleHourlyChart data={data} comparisonData={comparisonData} layer="precip" unit="mm" hoveredIndex={hoveredIndex} setHoveredIndex={setHoveredIndex} height={256} lang={lang} />
                </div>
                <div className="h-64 w-full">
                    <SingleHourlyChart data={data} comparisonData={comparisonData} layer="rain" unit="%" hoveredIndex={hoveredIndex} setHoveredIndex={setHoveredIndex} height={256} lang={lang} />
                </div>
             </div>
             <div className="h-64 w-full">
                <SingleHourlyChart data={data} comparisonData={comparisonData} layer="wind" unit="km/h" hoveredIndex={hoveredIndex} setHoveredIndex={setHoveredIndex} height={256} lang={lang} />
             </div>
             <div className="h-64 w-full">
                <SingleHourlyChart data={data} comparisonData={comparisonData} layer="snowLevel" unit="m" hoveredIndex={hoveredIndex} setHoveredIndex={setHoveredIndex} height={256} lang={lang} />
             </div>
          </div>
      </div>
    </div>
  );
});

SmartForecastCharts.displayName = 'SmartForecastCharts';

interface MinutelyPreciseChartProps {
    data: (number | null)[];
    label: string;
    currentPrecip?: number;
}

export const MinutelyPreciseChart = ({ data, label, currentPrecip: _currentPrecip = 0 }: MinutelyPreciseChartProps) => {
    // SOLUCIÓ RISC ZERO (prefer-const): Bloquegem chartData per prevenir mutacions col·laterals
    const chartData = Array.isArray(data) ? [...data] : [];
    let processedData = chartData.map(v => v !== null && v !== undefined ? v : 0);
    
    if(processedData.length === 0) return null; 
    while(processedData.length < 4) processedData.push(0);
    processedData = processedData.slice(0, 4);
    
    if (processedData.every(v => v === 0)) return null;
    
    const max = Math.max(...processedData, 0.5); 
    
    const getIntensityColor = (val: number): string => {
        if (val === 0) return 'bg-slate-800/50';
        if (val < 2.0) return 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]'; 
        if (val < 7.0) return 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.4)]';   
        return 'bg-red-500 shadow-[0_0_12px_rgba(239,68,68,0.6)]';                     
    };

    return (
        <div className="w-full mt-3 bg-slate-900/40 rounded-xl p-3 border border-slate-700/50 backdrop-blur-md animate-in fade-in relative transform-gpu" style={{ transform: 'translateZ(0)' }}>
            <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                    <CloudRain className="w-3.5 h-3.5 text-cyan-400" />
                    <span className="text-[10px] font-bold uppercase tracking-widest text-slate-300">{label}</span>
                </div>
            </div>
            <div className="relative h-16 w-full pb-1">
                <div className="flex items-end gap-2 h-full w-full relative z-10">
                {processedData.map((val, i) => (
                    <div key={`minutely-${i}`} className="flex-1 flex flex-col items-center gap-1 group relative h-full justify-end">
                        {val > 0 && <span className="text-[9px] font-bold mb-0.5 text-slate-200">{val.toFixed(1)}mm</span>}
                        <div className="w-full bg-slate-950/60 rounded-sm relative h-full max-h-[40px] overflow-hidden flex items-end border border-white/5">
                            <div 
                                className={`w-full rounded-sm transition-all duration-500 ease-out ${getIntensityColor(val)}`} 
                                style={{ height: `${(val / max) * 100}%` }}
                            />
                        </div>
                    </div>
                ))}
                </div>
            </div>
        </div>
    );
};