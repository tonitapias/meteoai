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

  // DOCTRINA RISC ZERO: Extracció tipada
  const tRecord = (TRANSLATIONS[lang] || TRANSLATIONS['ca']) as Record<string, unknown>;

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
  
  const paddingX = width < 500 ? 15 : 20;
  const paddingY = 35;

  const chartPoints = useMemo(() => {
    if (!data || data.length === 0) return { points: [], gfsPoints: [], iconPoints: [] };
    
    const extractRaw = (d: ChartDataPoint): number | null => {
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

  // SPATIAL UI BASE
  const MATRIX_BG = `absolute inset-0 z-0 opacity-[0.03] pointer-events-none bg-[linear-gradient(to_right,#ffffff_1px,transparent_1px),linear-gradient(to_bottom,#ffffff_1px,transparent_1px)] bg-[size:12px_12px]`;

  return (
    <div ref={containerRef} className="relative w-full h-full group select-none overflow-hidden rounded-xl border border-white/5 bg-black/60 shadow-[inset_0_2px_10px_rgba(0,0,0,0.5)] backdrop-blur-md" style={{ transform: 'translateZ(0)' }}>
      
      <div className={MATRIX_BG}></div>

      {/* Etiqueta Tàctica (Capa z-10) */}
      <div className="absolute top-3 left-4 text-[10px] font-bold text-slate-300 uppercase tracking-widest z-10 flex items-center gap-2 bg-[#050608]/90 px-3 py-1.5 rounded-md backdrop-blur-md border border-white/10 shadow-[0_4px_10px_rgba(0,0,0,0.5)]">
         <span className="w-2 h-2 rounded-full" style={{backgroundColor: currentConfig.color, boxShadow: `0 0 10px ${currentConfig.color}`}}></span>
         {currentConfig.title}
      </div>

      {/* Cartell Emergent HUD (Spatial UI Mobile-First) */}
      {hoverData && hoverData.value !== null && (
        <div 
          className="absolute z-20 pointer-events-none flex flex-col rounded-xl bg-[#050608]/95 backdrop-blur-xl border border-white/10 shadow-[0_10px_30px_rgba(0,0,0,0.8)] transition-all duration-75 ease-out overflow-hidden"
          style={{ 
            // Càlcul blindat per evitar overflow als laterals en dispositius mòbils
            left: `${Math.min(width - 80, Math.max(80, hoverData.x))}px`, 
            top: '12px', 
            transform: 'translateX(-50%)',
            borderColor: `${currentConfig.color}60`, 
            width: '150px'
          }}
        >
          <div className="bg-white/5 py-1.5 rounded-t-xl border-b border-white/5 text-[10px] font-black text-slate-300 tracking-widest uppercase shadow-inner text-center">
            {formatRawTime(hoverData.time)}
          </div>
          
          <div className="p-2.5 flex flex-col gap-1.5 justify-center items-center">
            <div className="text-xl font-black tracking-tighter tabular-nums drop-shadow-md" style={{ color: currentConfig.color }}>
              {showComparison && <span className="text-slate-500 text-[8px] font-bold tracking-widest uppercase mr-1">LOCAL</span>}
              {fmtVal(hoverData.value)}<span className="text-[10px] ml-0.5 opacity-80">{unit}</span>
            </div>
            
            {showComparison && (
              <div className="flex flex-col gap-1 text-[11px] font-bold w-full border-t border-white/5 pt-1.5 mt-0.5">
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
      <svg width={width} height={height} className="w-full h-full drop-shadow-md touch-pan-x block relative z-0">
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
        
        {/* Retícules de fons tàctiques */}
        <line x1={paddingX} y1={height - paddingY} x2={width - paddingX} y2={height - paddingY} stroke="rgba(255,255,255,0.15)" strokeWidth="1" />
        <line x1={paddingX} y1={paddingY} x2={width - paddingX} y2={paddingY} stroke="rgba(255,255,255,0.05)" strokeWidth="1" strokeDasharray="4 4" />
        <line x1={paddingX} y1={(height - paddingY + paddingY) / 2} x2={width - paddingX} y2={(height - paddingY + paddingY) / 2} stroke="rgba(255,255,255,0.05)" strokeWidth="1" strokeDasharray="2 6" />

        {/* Polílínies dels models de predicció */}
        {paths.areaPath && <path d={paths.areaPath} fill={`url(#gradient-${layer})`} className="transition-all duration-500 ease-out" />}
        {paths.gfsPath && <path d={paths.gfsPath} fill="none" stroke={CHART_COLORS.models.gfs} strokeWidth="1.5" strokeOpacity="0.6" strokeLinecap="round" strokeDasharray="3 5"/>}
        {paths.iconPath && <path d={paths.iconPath} fill="none" stroke={CHART_COLORS.models.icon} strokeWidth="1.5" strokeOpacity="0.6" strokeLinecap="round" strokeDasharray="1 4"/>}
        {paths.linePath && <path d={paths.linePath} fill="none" stroke={currentConfig.color} strokeWidth="3" strokeLinecap="round" filter="url(#glow)" className="transition-all duration-500 ease-out" />}
        
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
            <text key={`txt-${i}`} x={p.x} y={height - 10} textAnchor="middle" fill="#64748b" fontSize="10" fontWeight="700" className="opacity-80 uppercase tracking-widest font-mono">
                {getRawHour(p.time)}h
            </text>
        ))}

        {/* Targetes geomètriques de marcatge (SGV Intern) */}
        {hoverData && hoverData.value !== null && (
          <g>
            {/* Línia vertical tàctica de rastreig */}
            <line x1={hoverData.x} y1={0} x2={hoverData.x} y2={height - paddingY} stroke={currentConfig.color} strokeWidth="1.5" strokeDasharray="4 4" opacity="0.6" />
            
            {/* Targetes de nodes */}
            {hoverGfs?.value != null && <circle cx={hoverGfs.x} cy={hoverGfs.y} r="3.5" fill={CHART_COLORS.models.gfs} stroke="#050608" strokeWidth="1.5" opacity="0.9" />}
            {hoverIcon?.value != null && <circle cx={hoverIcon.x} cy={hoverIcon.y} r="3.5" fill={CHART_COLORS.models.icon} stroke="#050608" strokeWidth="1.5" opacity="0.9" />}
            
            <circle cx={hoverData.x} cy={hoverData.y} r="5" fill="#050608" stroke={currentConfig.color} strokeWidth="2.5" filter="url(#glow)" />
            <circle cx={hoverData.x} cy={hoverData.y} r="2" fill="white" />
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
  
  // DOCTRINA RISC ZERO: Extracció tipada
  const tRecord = (TRANSLATIONS[lang] || TRANSLATIONS['ca']) as Record<string, unknown>;

  if (!data || data.length === 0) return null;

  const tabs = [
      { id: 'temp', icon: Thermometer, label: typeof tRecord.temp === 'string' ? tRecord.temp : "TEMP" },
      { id: 'precip', icon: Droplets, label: "VOLUM" }, 
      { id: 'rain', icon: Umbrella, label: "PROB." },   
      { id: 'wind', icon: Wind, label: typeof tRecord.wind === 'string' ? tRecord.wind : "VENT" },
      { id: 'snow', icon: Mountain, label: typeof tRecord.snowLevel === 'string' ? tRecord.snowLevel : "NEU" },
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
      {/* SPATIAL UI: Segmented Control Tàctic (Coherent amb el Header i Radar) */}
      <div className="flex md:hidden bg-[#050608]/90 p-1.5 rounded-xl border border-white/5 backdrop-blur-md overflow-x-auto no-scrollbar shadow-[inset_0_4px_10px_rgba(0,0,0,0.8)] relative z-10">
          {tabs.map((tab) => (
              <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as 'temp' | 'rain' | 'precip' | 'wind' | 'snow')}
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
                     height={240} 
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
    let processedData = chartData.map(v => v !== null && v !== undefined && !isNaN(v) ? v : 0);
    
    if(processedData.length === 0) return null; 
    while(processedData.length < 4) processedData.push(0);
    processedData = processedData.slice(0, 4);
    
    if (processedData.every(v => v === 0)) return null;
    
    // Assegurem que l'escala tingui un màxim lògic per evitar divisions per zero
    const max = Math.max(...processedData, 0.5); 
    
    const getIntensityColor = (val: number): string => {
        if (val === 0) return 'bg-transparent';
        if (val < 2.0) return 'bg-cyan-500 shadow-[0_0_8px_rgba(6,182,212,0.6)]'; 
        if (val < 7.0) return 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.6)]';   
        return 'bg-rose-500 shadow-[0_0_12px_rgba(244,63,94,0.8)]';                     
    };

    // SPATIAL UI BASE
    const MATRIX_BG = `absolute inset-0 z-0 opacity-[0.03] pointer-events-none bg-[linear-gradient(to_right,#ffffff_1px,transparent_1px),linear-gradient(to_bottom,#ffffff_1px,transparent_1px)] bg-[size:12px_12px]`;

    return (
        <div className="w-full mt-3 bg-[#0a0b10]/90 rounded-2xl p-4 border border-white/5 shadow-[inset_0_2px_10px_rgba(0,0,0,0.5)] backdrop-blur-md animate-in fade-in relative transform-gpu overflow-hidden">
            <div className={MATRIX_BG}></div>
            <div className="flex items-center justify-between mb-3 relative z-10">
                <div className="flex items-center gap-2">
                    <CloudRain className="w-3.5 h-3.5 text-cyan-400 drop-shadow-[0_0_5px_rgba(34,211,238,0.5)]" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-300">{label}</span>
                </div>
            </div>
            <div className="relative h-16 w-full pb-1 z-10">
                <div className="flex items-end gap-2.5 h-full w-full relative z-10">
                {processedData.map((val, i) => (
                    <div key={`minutely-${i}`} className="flex-1 flex flex-col items-center gap-1 group relative h-full justify-end">
                        {val > 0 ? (
                            <span className="text-[9px] font-black mb-0.5 text-white drop-shadow-md">{val.toFixed(1)}<span className="opacity-50 text-[8px] ml-0.5">mm</span></span>
                        ) : (
                            <span className="text-[9px] font-bold mb-0.5 text-slate-600 opacity-50">-</span>
                        )}
                        <div className="w-full bg-[#050608]/80 rounded-sm relative h-full max-h-[40px] overflow-hidden flex items-end border border-white/5 shadow-inner">
                            <div 
                                className={`w-full rounded-[1px] transition-all duration-700 ease-out ${getIntensityColor(val)}`} 
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