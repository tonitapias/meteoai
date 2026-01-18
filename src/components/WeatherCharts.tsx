// src/components/WeatherCharts.tsx
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { CloudRain, Wind, Thermometer, Mountain, Umbrella, Droplets } from 'lucide-react';
import { TRANSLATIONS, Language } from '../constants/translations';

interface ChartDataPoint {
    time: string;
    [key: string]: any;
}

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

const getRawHour = (isoString: string): number => {
    if (!isoString || typeof isoString !== 'string') return 0;
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

export const SingleHourlyChart = ({ data, comparisonData, layer, unit, hoveredIndex, setHoveredIndex, height = 160, lang = 'ca' }: SingleHourlyChartProps) => {
  // 1. HOOKS AL PRINCIPI (CRUCIAL PER A REACT)
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

  const layersConfig: any = useMemo(() => ({
    temp: { key: 'temp', color: '#818cf8', gradientStart: '#818cf8', title: t.temp },
    rain: { key: 'rain', color: '#3b82f6', gradientStart: '#3b82f6', title: t.rainProb },
    precip: { key: 'precip', color: '#60a5fa', gradientStart: '#2563eb', title: "Volum (mm)" },
    wind: { key: 'wind', color: '#2dd4bf', gradientStart: '#2dd4bf', title: t.wind },
    cloud: { key: 'cloud', color: '#94a3b8', gradientStart: '#94a3b8', title: t.cloud },
    humidity: { key: 'humidity', color: '#22d3ee', gradientStart: '#22d3ee', title: t.humidity },
    snowLevel: { key: 'snowLevel', color: '#cbd5e1', gradientStart: '#f1f5f9', title: t.snowLevel }
  }), [t]);

  const currentConfig = layersConfig[layer] || layersConfig['temp'];
  const dataKey = currentConfig.key;
  const paddingX = width < 500 ? 10 : 20;
  const paddingY = 30;

  // Càlculs segurs dins useMemo
  const chartPoints = useMemo(() => {
    if (!data || data.length === 0) return { points: [], gfsPoints: [], iconPoints: [] };

    const getSafeValue = (d: ChartDataPoint) => {
        if (!d) return null;
        let val = d[dataKey];
        if (val === undefined || val === null) {
            if (dataKey === 'rain') val = d['pop'] ?? d['precipitation_probability'];
            else if (dataKey === 'precip') val = d['precipitation'] ?? d['qpf'];
            else if (dataKey === 'wind') val = d['wind_speed_10m'];
            else if (dataKey === 'humidity') val = d['relative_humidity_2m'];
        }
        return (val === null || val === undefined) ? null : Number(val);
    };

    const mapValues = (dataset: ChartDataPoint[]) => dataset.map(getSafeValue).filter(v => v !== null) as number[];
    let allValues = mapValues(data);
    if (comparisonData?.gfs) allValues = [...allValues, ...mapValues(comparisonData.gfs)];
    if (comparisonData?.icon) allValues = [...allValues, ...mapValues(comparisonData.icon)];

    let min = allValues.length ? Math.min(...allValues) : 0;
    let max = allValues.length ? Math.max(...allValues) : 100;

    if (layer === 'temp') { min -= 2; max += 2; } 
    else if (['rain', 'cloud', 'humidity'].includes(layer)) { min = 0; max = 100; } 
    else if (layer === 'precip') { min = 0; max = Math.max(max * 1.2, 3); }
    else if (layer === 'wind') { min = 0; max = Math.max(max, 25); } 
    else if (layer === 'snowLevel') { min = Math.max(0, min - 500); max = max + 500; }
    
    const rng = max - min || 1;
    const calcY = (val: number | null) => (val === null) ? height + 10 : height - paddingY - ((val - min) / rng) * (height - 2 * paddingY);

    const createPoints = (dataset: ChartDataPoint[]) => dataset.map((d, i) => ({
        x: paddingX + (i / (dataset.length - 1)) * (width - 2 * paddingX),
        y: calcY(getSafeValue(d)),
        value: getSafeValue(d),
        time: d.time
    }));

    return {
        points: createPoints(data),
        gfsPoints: comparisonData?.gfs ? createPoints(comparisonData.gfs) : [],
        iconPoints: comparisonData?.icon ? createPoints(comparisonData.icon) : [],
    };
  }, [data, comparisonData, layer, height, dataKey, width, paddingX]);

  const { points, gfsPoints, iconPoints } = chartPoints;

  const paths = useMemo(() => {
      const buildSmoothPath = (pts: any[]) => {
        const validPts = pts.filter(p => p.value !== null && p.y <= height + 50);
        if (validPts.length < 2) return "";
        let d = `M ${validPts[0].x},${validPts[0].y}`;
        for (let i = 0; i < validPts.length - 1; i++) {
          const p0 = validPts[i];
          const p1 = validPts[i + 1];
          const cx = (p0.x + p1.x) / 2;
          d += ` C ${cx},${p0.y} ${cx},${p1.y} ${p1.x},${p1.y}`;
        }
        return d;
      };

      const linePath = buildSmoothPath(points);
      const areaPath = linePath ? `${linePath} L ${points[points.length-1]?.x || width - paddingX},${height} L ${points[0]?.x || paddingX},${height} Z` : "";
      
      return { linePath, areaPath, gfsPath: comparisonData?.gfs ? buildSmoothPath(gfsPoints) : "", iconPath: comparisonData?.icon ? buildSmoothPath(iconPoints) : "" };
  }, [points, gfsPoints, iconPoints, height, comparisonData, width, paddingX]);

  // 2. CONDICIONAL DE RETORN (ARA SÍ, AL FINAL)
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
        {paths.gfsPath && <path d={paths.gfsPath} fill="none" stroke="#4ade80" strokeWidth="1.5" strokeOpacity="0.6" strokeLinecap="round" strokeDasharray="4 4"/>}
        {paths.iconPath && <path d={paths.iconPath} fill="none" stroke="#fbbf24" strokeWidth="1.5" strokeOpacity="0.6" strokeLinecap="round" strokeDasharray="2 2"/>}
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
            {hoverGfs?.value != null && <circle cx={hoverGfs.x} cy={hoverGfs.y} r="3" fill="#4ade80" stroke="none" opacity="0.8" />}
            {hoverIcon?.value != null && <circle cx={hoverIcon.x} cy={hoverIcon.y} r="3" fill="#fbbf24" stroke="none" opacity="0.8" />}
            
            <g transform={`translate(${Math.min(width - 120, Math.max(70, hoverData.x))}, 20)`}>
               <rect x="-70" y="-15" width="140" height={showComparison ? 95 : 70} rx="8" fill="#0f172a" stroke={currentConfig.color} strokeWidth="1" opacity="0.95" />
               <text x="0" y="8" textAnchor="middle" fill="white" fontSize="12" fontWeight="bold">{formatRawTime(hoverData.time)}</text>
               <text x="0" y={showComparison ? 28 : 35} textAnchor="middle" fill={currentConfig.color} fontSize={showComparison ? "13" : "18"} fontWeight="bold">
                   {showComparison && <tspan fill="#94a3b8" fontSize="10" fontWeight="normal">ECMWF: </tspan>}
                   {fmtVal(hoverData.value)}{unit}
               </text>
               {showComparison && (
                 <>
                    {hoverGfs?.value != null && <text x="0" y="46" textAnchor="middle" fill="#4ade80" fontSize="12" fontWeight="bold"><tspan fill="#94a3b8" fontSize="10" fontWeight="normal">GFS: </tspan>{fmtVal(hoverGfs.value)}{unit}</text>}
                    {hoverIcon?.value != null && <text x="0" y="64" textAnchor="middle" fill="#fbbf24" fontSize="12" fontWeight="bold"><tspan fill="#94a3b8" fontSize="10" fontWeight="normal">ICON: </tspan>{fmtVal(hoverIcon.value)}{unit}</text>}
                 </>
               )}
            </g>
          </g>
        )}
      </svg>
    </div>
  );
};

export const SmartForecastCharts = ({ data, comparisonData, unit, lang = 'ca' }: any) => {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<'temp' | 'rain' | 'precip' | 'wind' | 'snow'>('temp');
  const t = TRANSLATIONS[lang as Language] || TRANSLATIONS['ca'];

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
                  onClick={() => setActiveTab(tab.id as any)}
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
};

export const MinutelyPreciseChart = ({ data, label, currentPrecip = 0 }: { data: number[], label: string, currentPrecip: number }) => {
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