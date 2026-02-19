// src/components/WeatherCharts.tsx
import { useState, useMemo, useRef, useEffect, memo } from 'react';
import { CloudRain, Wind, Thermometer, Mountain, Umbrella, Droplets } from 'lucide-react';
import { TRANSLATIONS, Language } from '../translations';
import { CHART_COLORS } from '../constants/chartColors';
// IMPORTACIÓ CORREGIDA: Eliminem 'GraphPoint' que no es feia servir explícitament
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

// Interfície per a la configuració de capes
interface LayerConfig {
    key: string;
    color: string;
    gradientStart: string;
    title: string;
}

const getRawHour = (isoString: string): number => {
    if (!isoString) return 0;
    try {
        if (isoString.includes('T')) {
            const timePart = isoString.split('T')[1];
            if (timePart) return parseInt(timePart.split(':')[0], 10) || 0;
        }
        return new Date(isoString).getHours() || 0;
    } catch { return 0; }
};

const formatRawTime = (isoString: string): string => {
     if (!isoString) return "--:--";
     try {
         return isoString.split('T')[1]?.substring(0, 5) || "--:--";
     } catch { return "--:--"; }
};

export const SingleHourlyChart = memo(({ data, comparisonData, layer, unit, hoveredIndex, setHoveredIndex, height = 160, lang = 'ca' }: SingleHourlyChartProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(1000); 

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

  // --- REFACTORITZACIÓ: Ús de les funcions pures ---
  const chartPoints = useMemo(() => {
    if (!data || data.length === 0) return { points: [], gfsPoints: [], iconPoints: [] };
    
    // 1. Calcular Domini Global (tots els datasets)
    let allValues: number[] = [];
    
    const extractRaw = (d: ChartDataPoint) => {
        if (d[dataKey] !== undefined) return Number(d[dataKey]);
        if (dataKey === 'rain') return Number(d.pop ?? d.precipitation_probability);
        if (dataKey === 'precip') return Number(d.precipitation ?? d.qpf);
        if (dataKey === 'wind') return Number(d.wind_speed_10m);
        if (dataKey === 'humidity') return Number(d.relative_humidity_2m);
        return 0;
    };

    allValues = data.map(extractRaw);
    if (comparisonData?.gfs) allValues = [...allValues, ...comparisonData.gfs.map(extractRaw)];
    if (comparisonData?.icon) allValues = [...allValues, ...comparisonData.icon.map(extractRaw)];

    const domain = calculateYDomain(allValues, layer);
    const dims = { width, height, paddingX, paddingY };

    // 2. Generar Punts (Delegat a chartUtils)
    return {
        points: generateGraphPoints(data, dims, domain, dataKey),
        gfsPoints: comparisonData?.gfs ? generateGraphPoints(comparisonData.gfs, dims, domain, dataKey) : [],
        iconPoints: comparisonData?.icon ? generateGraphPoints(comparisonData.icon, dims, domain, dataKey) : [],
    };
  }, [data, comparisonData, layer, height, dataKey, width, paddingX, paddingY]);

  const { points, gfsPoints, iconPoints } = chartPoints;

  // --- REFACTORITZACIÓ: Path Generator ---
  const paths = useMemo(() => {
      const linePath = generateSmoothPath(points, height);
      // Area tancada per sota
      const areaPath = linePath ? `${linePath} L ${points[points.length-1]?.x || width - paddingX},${height} L ${points[0]?.x || paddingX},${height} Z` : "";
      
      return { 
          linePath, 
          areaPath, 
          gfsPath: comparisonData?.gfs ? generateSmoothPath(gfsPoints, height) : "", 
          iconPath: comparisonData?.icon ? generateSmoothPath(iconPoints, height) : "" 
      };
  }, [points, gfsPoints, iconPoints, height, comparisonData, width, paddingX]);

  if (!data || data.length === 0) return null;

  const hoverData = hoveredIndex !== null ? points[hoveredIndex] : null;
  const hoverGfs = hoveredIndex !== null ? gfsPoints[hoveredIndex] : null;
  const hoverIcon = hoveredIndex !== null ? iconPoints[hoveredIndex] : null;
  const showComparison = (hoverGfs && hoverGfs.value !== null) || (hoverIcon && hoverIcon.value !== null);
  const fmtVal = (val: number | null | undefined) => (val == null) ? "-" : (layer === 'precip' ? val.toFixed(1) : Math.round(val));

  return (
    <div ref={containerRef} className="relative w-full h-full group select-none">
      <div className="absolute top-2 left-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest z-10 flex items-center gap-2 bg-slate-900/50 px-2 py-1 rounded-full backdrop-blur-sm border border-white/5">
         <span className={`w-1.5 h-1.5 rounded-full`} style={{backgroundColor: currentConfig.color}}></span>
         {currentConfig.title}
      </div>

      <svg width={width} height={height} className="w-full h-full drop-shadow-sm touch-pan-x block">
        <defs>
          <linearGradient id={`gradient-${layer}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={currentConfig.gradientStart} stopOpacity="0.3" />
            <stop offset="100%" stopColor={currentConfig.gradientStart} stopOpacity="0" />
          </linearGradient>
        </defs>
        
        <line x1={paddingX} y1={height - paddingY} x2={width - paddingX} y2={height - paddingY} stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
        <line x1={paddingX} y1={paddingY} x2={width - paddingX} y2={paddingY} stroke="rgba(255,255,255,0.05)" strokeWidth="1" strokeDasharray="4 4" />

        {paths.areaPath && <path d={paths.areaPath} fill={`url(#gradient-${layer})`} />}
        {paths.gfsPath && <path d={paths.gfsPath} fill="none" stroke={CHART_COLORS.models.gfs} strokeWidth="1.5" strokeOpacity="0.6" strokeLinecap="round" strokeDasharray="4 4"/>}
        {paths.iconPath && <path d={paths.iconPath} fill="none" stroke={CHART_COLORS.models.icon} strokeWidth="1.5" strokeOpacity="0.6" strokeLinecap="round" strokeDasharray="2 2"/>}
        {paths.linePath && <path d={paths.linePath} fill="none" stroke={currentConfig.color} strokeWidth="2.5" strokeLinecap="round" />}
        
        {points.map((p, i) => (
          <rect key={i} x={p.x - (width / points.length / 2)} y={0} width={width / points.length} height={height} fill="transparent" 
            onMouseEnter={() => setHoveredIndex(i)} onTouchStart={() => setHoveredIndex(i)} className="cursor-pointer" />
        ))}

        {points.map((p, i) => (i % (width < 600 ? 4 : 3) === 0) && (
            <text key={`txt-${i}`} x={p.x} y={height - 5} textAnchor="middle" fill="#64748b" fontSize="11" fontWeight="500">{getRawHour(p.time)}h</text>
        ))}

        {hoverData && hoverData.value !== null && (
          <g>
            <line x1={hoverData.x} y1={0} x2={hoverData.x} y2={height - paddingY} stroke="white" strokeWidth="1" strokeDasharray="3 3" opacity="0.3" />
            <circle cx={hoverData.x} cy={hoverData.y} r="4" fill={currentConfig.color} stroke="white" strokeWidth="2" />
            {hoverGfs?.value != null && <circle cx={hoverGfs.x} cy={hoverGfs.y} r="3" fill={CHART_COLORS.models.gfs} stroke="none" opacity="0.8" />}
            {hoverIcon?.value != null && <circle cx={hoverIcon.x} cy={hoverIcon.y} r="3" fill={CHART_COLORS.models.icon} stroke="none" opacity="0.8" />}
            
            <g transform={`translate(${Math.min(width - 120, Math.max(70, hoverData.x))}, 20)`}>
               <rect x="-70" y="-15" width="140" height={showComparison ? 95 : 70} rx="8" fill="#0f172a" stroke={currentConfig.color} strokeWidth="1" opacity="0.95" />
               <text x="0" y="8" textAnchor="middle" fill="white" fontSize="12" fontWeight="bold">{formatRawTime(hoverData.time)}</text>
               <text x="0" y={showComparison ? 28 : 35} textAnchor="middle" fill={currentConfig.color} fontSize={showComparison ? "13" : "18"} fontWeight="bold">
                   {showComparison && <tspan fill="#94a3b8" fontSize="10" fontWeight="normal">ECMWF: </tspan>}
                   {fmtVal(hoverData.value)}{unit}
               </text>
               {showComparison && (
                 <>
                    {hoverGfs?.value != null && <text x="0" y="46" textAnchor="middle" fill={CHART_COLORS.models.gfs} fontSize="12" fontWeight="bold"><tspan fill="#94a3b8" fontSize="10" fontWeight="normal">GFS: </tspan>{fmtVal(hoverGfs.value)}{unit}</text>}
                    {hoverIcon?.value != null && <text x="0" y="64" textAnchor="middle" fill={CHART_COLORS.models.icon} fontSize="12" fontWeight="bold"><tspan fill="#94a3b8" fontSize="10" fontWeight="normal">ICON: </tspan>{fmtVal(hoverIcon.value)}{unit}</text>}
                 </>
               )}
            </g>
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
      { id: 'precip', icon: Droplets, label: "Volum (mm)" }, 
      { id: 'rain', icon: Umbrella, label: "Prob. (%)" },   
      { id: 'wind', icon: Wind, label: t.wind },
      { id: 'snow', icon: Mountain, label: t.snowLevel },
  ];

  const getUnit = (tab: string) => {
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
      <div className="flex md:hidden bg-slate-950/50 p-1 rounded-xl border border-white/5 overflow-x-auto no-scrollbar">
          {tabs.map((tab) => (
              <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as 'temp' | 'rain' | 'precip' | 'wind' | 'snow')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider whitespace-nowrap transition-all flex-1 justify-center ${
                      activeTab === tab.id ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                  }`}
              >
                  <tab.icon className="w-3.5 h-3.5" />{tab.label}
              </button>
          ))}
      </div>

      <div className="relative w-full bg-slate-900/30 rounded-2xl border border-white/5 p-2 md:p-6 overflow-hidden" onMouseLeave={() => setHoveredIndex(null)}>
          <div className="md:hidden w-full overflow-x-auto custom-scrollbar pb-2">
             <div className="min-w-[800px] h-64">
                 <SingleHourlyChart data={data} comparisonData={comparisonData} layer={activeTab === 'snow' ? 'snowLevel' : activeTab} unit={getUnit(activeTab)} hoveredIndex={hoveredIndex} setHoveredIndex={setHoveredIndex} height={200} lang={lang} />
             </div>
          </div>
          <div className="hidden md:flex flex-col gap-8 w-full">
             <div className="h-96 w-full shadow-inner bg-slate-950/20 rounded-xl border border-white/5 overflow-hidden">
                <SingleHourlyChart data={data} comparisonData={comparisonData} layer="temp" unit={unit} hoveredIndex={hoveredIndex} setHoveredIndex={setHoveredIndex} height={384} lang={lang} />
             </div>
             <div className="grid grid-cols-2 gap-6">
                <div className="h-64 w-full shadow-inner bg-slate-950/20 rounded-xl border border-white/5 overflow-hidden">
                    <SingleHourlyChart data={data} comparisonData={comparisonData} layer="precip" unit="mm" hoveredIndex={hoveredIndex} setHoveredIndex={setHoveredIndex} height={256} lang={lang} />
                </div>
                <div className="h-64 w-full shadow-inner bg-slate-950/20 rounded-xl border border-white/5 overflow-hidden">
                    <SingleHourlyChart data={data} comparisonData={comparisonData} layer="rain" unit="%" hoveredIndex={hoveredIndex} setHoveredIndex={setHoveredIndex} height={256} lang={lang} />
                </div>
             </div>
             <div className="h-64 w-full shadow-inner bg-slate-950/20 rounded-xl border border-white/5 overflow-hidden">
                <SingleHourlyChart data={data} comparisonData={comparisonData} layer="wind" unit="km/h" hoveredIndex={hoveredIndex} setHoveredIndex={setHoveredIndex} height={256} lang={lang} />
             </div>
             <div className="h-64 w-full shadow-inner bg-slate-950/20 rounded-xl border border-white/5 overflow-hidden">
                <SingleHourlyChart data={data} comparisonData={comparisonData} layer="snowLevel" unit="m" hoveredIndex={hoveredIndex} setHoveredIndex={setHoveredIndex} height={256} lang={lang} />
             </div>
          </div>
      </div>
    </div>
  );
});

SmartForecastCharts.displayName = 'SmartForecastCharts';

export const MinutelyPreciseChart = ({ data, label, currentPrecip: _currentPrecip = 0 }: { data: number[], label: string, currentPrecip: number }) => {
    let chartData = data ? [...data] : [];
    if(chartData.length === 0) return null; 
    while(chartData.length < 4) chartData.push(0);
    chartData = chartData.slice(0, 4);
    if (chartData.every(v => v === 0)) return null;
    const max = Math.max(...chartData, 0.5); 
    const getIntensityColor = (val: number) => {
        if (val === 0) return 'bg-blue-900/50';
        if (val < 2.5) return 'bg-blue-400'; 
        if (val < 7.6) return 'bg-yellow-400'; 
        if (val < 50) return 'bg-orange-500'; 
        return 'bg-red-600'; 
    };
    return (
        <div className="w-full mt-3 bg-blue-950/20 rounded-xl p-3 border border-blue-500/20 animate-in fade-in relative">
            <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                    <CloudRain className="w-3 h-3 text-blue-400" />
                    <span className="text-[10px] font-bold uppercase tracking-wider text-blue-300">{label}</span>
                </div>
            </div>
            <div className="relative h-16 w-full pb-1">
                <div className="flex items-end gap-2 h-full w-full relative z-10">
                {chartData.map((val, i) => (
                    <div key={i} className="flex-1 flex flex-col items-center gap-1 group relative h-full justify-end">
                        {val > 0 && <span className="text-[9px] font-bold mb-0.5 text-blue-200">{val.toFixed(1)}mm</span>}
                        <div className="w-full bg-blue-900/30 rounded-sm relative h-full max-h-[40px] overflow-hidden flex items-end">
                            <div className={`w-full rounded-sm transition-all ${getIntensityColor(val)}`} style={{ height: `${(val / max) * 100}%` }}></div>
                        </div>
                    </div>
                ))}
                </div>
            </div>
        </div>
    );
};