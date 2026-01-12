// src/components/WeatherCharts.tsx
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { CloudRain, Wind, Thermometer, Mountain } from 'lucide-react';
import { TRANSLATIONS, Language } from '../constants/translations';

// --- INTERFÍCIES I HELPERS ---
interface ChartDataPoint {
    time: string;
    [key: string]: any;
}

interface SingleHourlyChartProps {
    data: ChartDataPoint[];
    comparisonData: { gfs: ChartDataPoint[], icon: ChartDataPoint[] } | null;
    layer: 'temp' | 'rain' | 'wind' | 'cloud' | 'humidity' | 'snowLevel';
    unit: string;
    hoveredIndex: number | null;
    setHoveredIndex: (idx: number | null) => void;
    height?: number;
    lang?: Language;
}

export const SingleHourlyChart = ({ data, comparisonData, layer, unit, hoveredIndex, setHoveredIndex, height = 160, lang = 'ca' }: SingleHourlyChartProps) => {
  if (!data || data.length === 0) return null;
  
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

  const layersConfig: any = {
    temp: { key: 'temp', color: '#818cf8', gradientStart: '#818cf8', title: t.temp },
    rain: { key: 'rain', color: '#3b82f6', gradientStart: '#3b82f6', title: t.rainProb },
    wind: { key: 'wind', color: '#2dd4bf', gradientStart: '#2dd4bf', title: t.wind },
    cloud: { key: 'cloud', color: '#94a3b8', gradientStart: '#94a3b8', title: t.cloud },
    humidity: { key: 'humidity', color: '#22d3ee', gradientStart: '#22d3ee', title: t.humidity },
    snowLevel: { key: 'snowLevel', color: '#cbd5e1', gradientStart: '#f1f5f9', title: t.snowLevel }
  };

  const currentConfig = layersConfig[layer];
  const dataKey = currentConfig.key;
  
  const paddingX = width < 500 ? 10 : 20;
  const paddingY = 30;

  const { points, gfsPoints, iconPoints } = useMemo(() => {
    const getSafeValue = (d: ChartDataPoint) => {
        const val = d[dataKey];
        if (val === null || val === undefined) return layer === 'snowLevel' ? null : 0;
        return val;
    };

    const mapValues = (dataset: ChartDataPoint[]) => dataset.map(getSafeValue).filter(v => v !== null) as number[];
    
    let allValues = mapValues(data);
    if (comparisonData?.gfs) allValues = [...allValues, ...mapValues(comparisonData.gfs)];
    if (comparisonData?.icon) allValues = [...allValues, ...mapValues(comparisonData.icon)];

    let min = allValues.length ? Math.min(...allValues) : 0;
    let max = allValues.length ? Math.max(...allValues) : 100;

    if (layer === 'temp') { min -= 2; max += 2; } 
    else if (['rain', 'cloud', 'humidity'].includes(layer)) { min = 0; max = 100; } 
    else if (layer === 'wind') { min = 0; max = Math.max(max, 25); } 
    else if (layer === 'snowLevel') { min = Math.max(0, min - 500); max = max + 500; }
    
    const rng = max - min || 1;
    const calcY = (val: number | null) => {
        if (val === null) return height + 10; 
        return height - paddingY - ((val - min) / rng) * (height - 2 * paddingY);
    };

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

  const { areaPath, linePath, gfsPath, iconPath } = useMemo(() => {
      const buildSmoothPath = (pts: any[]) => {
        const validPts = pts.filter(p => p.value !== null && p.y <= height);
        if (validPts.length === 0) return "";
        let d = `M ${validPts[0].x},${validPts[0].y}`;
        for (let i = 0; i < validPts.length - 1; i++) {
          const p0 = validPts[i];
          const p1 = validPts[i + 1];
          const cx = (p0.x + p1.x) / 2;
          d += ` C ${cx},${p0.y} ${cx},${p1.y} ${p1.x},${p1.y}`;
        }
        return d;
      };

      const lPath = buildSmoothPath(points);
      const aPath = lPath ? `${lPath} L ${points[points.length-1]?.x || width - paddingX},${height} L ${points[0]?.x || paddingX},${height} Z` : "";
      
      return {
          linePath: lPath,
          areaPath: aPath,
          gfsPath: comparisonData?.gfs ? buildSmoothPath(gfsPoints) : "",
          iconPath: comparisonData?.icon ? buildSmoothPath(iconPoints) : ""
      };
  }, [points, gfsPoints, iconPoints, height, comparisonData, width, paddingX]);

  const hoverData = hoveredIndex !== null && points[hoveredIndex] ? points[hoveredIndex] : null;
  const gfsValue = (hoveredIndex !== null && gfsPoints[hoveredIndex]) ? gfsPoints[hoveredIndex].value : null;
  const iconValue = (hoveredIndex !== null && iconPoints[hoveredIndex]) ? iconPoints[hoveredIndex].value : null;

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

        {areaPath && <path d={areaPath} fill={`url(#gradient-${layer})`} />}
        {gfsPath && <path d={gfsPath} fill="none" stroke="#4ade80" strokeWidth="1.5" strokeOpacity="0.6" strokeLinecap="round" strokeDasharray="4 4"/>}
        {iconPath && <path d={iconPath} fill="none" stroke="#fbbf24" strokeWidth="1.5" strokeOpacity="0.6" strokeLinecap="round" strokeDasharray="2 2"/>}
        {linePath && <path d={linePath} fill="none" stroke={currentConfig.color} strokeWidth="2.5" strokeLinecap="round" />}
        
        {points.map((p, i) => (
          <rect 
            key={i} 
            x={p.x - (width / points.length / 2)} 
            y={0} 
            width={width / points.length} 
            height={height} 
            fill="transparent" 
            onMouseEnter={() => setHoveredIndex(i)}
            onTouchStart={() => setHoveredIndex(i)}
            className="cursor-pointer"
          />
        ))}

        {points.map((p, i) => {
             const step = width < 600 ? 4 : 3; 
             return (i % step === 0) && (
              <text key={`txt-${i}`} x={p.x} y={height - 5} textAnchor="middle" fill="#64748b" fontSize="11" fontWeight="500">
                  {new Date(p.time).getHours()}h
              </text>
            )
        })}

        {hoverData && hoverData.value !== null && (
          <g>
            <line x1={hoverData.x} y1={0} x2={hoverData.x} y2={height - paddingY} stroke="white" strokeWidth="1" strokeDasharray="3 3" opacity="0.3" />
            <circle cx={hoverData.x} cy={hoverData.y} r="4" fill={currentConfig.color} stroke="white" strokeWidth="2" />
            
            <g transform={`translate(${Math.min(width - 120, Math.max(70, hoverData.x))}, 20)`}>
               <rect x="-70" y="-15" width="140" height="70" rx="8" fill="#0f172a" stroke={currentConfig.color} strokeWidth="1" opacity="0.95" filter="drop-shadow(0 4px 6px rgb(0 0 0 / 0.5))" />
               <text x="0" y="8" textAnchor="middle" fill="white" fontSize="12" fontWeight="bold">
                 {new Date(hoverData.time).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}
               </text>
               <text x="0" y="28" textAnchor="middle" fill={currentConfig.color} fontSize="14" fontWeight="bold">
                   {Math.round(hoverData.value)}{unit}
               </text>
               
               <text x="-60" y="45" textAnchor="start" fill="#4ade80" fontSize="9">
                   GFS: {gfsValue != null ? `${Math.round(gfsValue)}${unit}` : '-'}
               </text>
               <text x="60" y="45" textAnchor="end" fill="#fbbf24" fontSize="9">
                   ICON: {iconValue != null ? `${Math.round(iconValue)}${unit}` : '-'}
               </text>
            </g>
          </g>
        )}
      </svg>
    </div>
  );
};

export const SmartForecastCharts = ({ data, comparisonData, unit, lang = 'ca' }: any) => {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<'temp' | 'rain' | 'wind' | 'snow'>('temp');
  const t = TRANSLATIONS[lang as Language] || TRANSLATIONS['ca'];

  if (!data || data.length === 0) return null;

  const tabs = [
      { id: 'temp', icon: Thermometer, label: t.temp },
      { id: 'rain', icon: CloudRain, label: t.rain },
      { id: 'wind', icon: Wind, label: t.wind },
      { id: 'snow', icon: Mountain, label: t.snowLevel },
  ];

  return (
    <div className="w-full flex flex-col gap-4">
      <div className="flex md:hidden bg-slate-950/50 p-1 rounded-xl border border-white/5 overflow-x-auto no-scrollbar">
          {tabs.map((tab) => (
              <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider whitespace-nowrap transition-all flex-1 justify-center ${
                      activeTab === tab.id 
                      ? 'bg-indigo-600 text-white shadow-lg' 
                      : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                  }`}
              >
                  <tab.icon className="w-3.5 h-3.5" />
                  {tab.label}
              </button>
          ))}
      </div>

      <div className="relative w-full bg-slate-900/30 rounded-2xl border border-white/5 p-2 md:p-6 overflow-hidden" onMouseLeave={() => setHoveredIndex(null)}>
          <div className="md:hidden w-full overflow-x-auto custom-scrollbar pb-2">
             <div className="min-w-[800px] h-64">
                 <SingleHourlyChart 
                    data={data} 
                    comparisonData={comparisonData} 
                    layer={activeTab === 'snow' ? 'snowLevel' : activeTab} 
                    unit={activeTab === 'temp' ? unit : activeTab === 'rain' ? '%' : activeTab === 'wind' ? 'km/h' : 'm'} 
                    hoveredIndex={hoveredIndex} 
                    setHoveredIndex={setHoveredIndex} 
                    height={200} 
                    lang={lang} 
                 />
             </div>
          </div>

          <div className="hidden md:flex flex-col gap-8 w-full">
             <div className="h-96 w-full shadow-inner bg-slate-950/20 rounded-xl border border-white/5 overflow-hidden">
                <SingleHourlyChart data={data} comparisonData={comparisonData} layer="temp" unit={unit} hoveredIndex={hoveredIndex} setHoveredIndex={setHoveredIndex} height={384} lang={lang} />
             </div>
             <div className="h-64 w-full shadow-inner bg-slate-950/20 rounded-xl border border-white/5 overflow-hidden">
                <SingleHourlyChart data={data} comparisonData={comparisonData} layer="rain" unit="%" hoveredIndex={hoveredIndex} setHoveredIndex={setHoveredIndex} height={256} lang={lang} />
             </div>
             <div className="h-64 w-full shadow-inner bg-slate-950/20 rounded-xl border border-white/5 overflow-hidden">
                <SingleHourlyChart data={data} comparisonData={comparisonData} layer="wind" unit="km/h" hoveredIndex={hoveredIndex} setHoveredIndex={setHoveredIndex} height={256} lang={lang} />
             </div>
             <div className="h-64 w-full shadow-inner bg-slate-950/20 rounded-xl border border-white/5 overflow-hidden">
                <SingleHourlyChart data={data} comparisonData={comparisonData} layer="snowLevel" unit="m" hoveredIndex={hoveredIndex} setHoveredIndex={setHoveredIndex} height={256} lang={lang} />
             </div>
          </div>

          <div className="flex justify-center items-center gap-4 mt-6 pt-2 border-t border-white/5 opacity-70">
                <span className="text-[9px] text-slate-400 uppercase font-bold tracking-widest">{t.modelsLegend}:</span>
                <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-indigo-500"></div><span className="text-[10px] text-slate-300">ECMWF</span></div>
                <div className="flex items-center gap-1.5"><div className="w-3 h-0.5 bg-green-400 border-t border-b border-green-400 border-dashed w-3"></div><span className="text-[10px] text-slate-300">GFS</span></div>
                <div className="flex items-center gap-1.5"><div className="w-3 h-0.5 bg-amber-400 border-t border-b border-amber-400 border-dashed w-3"></div><span className="text-[10px] text-slate-300">ICON</span></div>
          </div>
      </div>
    </div>
  );
};

// --- COMPONENT CORREGIT: MINUTELY PRECISE CHART ---
export const MinutelyPreciseChart = ({ data, label, currentPrecip = 0 }: { data: number[], label: string, currentPrecip: number }) => {
    let chartData = data ? [...data] : [];
    if(chartData.length === 0) return null; 
    
    // Normalitzem per tenir mínim 4 barres
    while(chartData.length < 4) chartData.push(0);
    chartData = chartData.slice(0, 4);
    
    // BUG FIX CRÍTIC:
    // Abans aquí hi havia una línia que injectava la probabilitat (%) com si fos volum (mm)
    // if (currentPrecip > 0 && chartData[0] === 0) chartData[0] = currentPrecip; <--- ELIMINADA
    
    if (chartData.every(v => v === 0)) return null;
    
    // Escala gràfica: mínim 0.5mm per que es vegi algo si plou poc
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
                        {/* AFEGIT 'mm' AL VALOR PER EVITAR CONFUSIÓ */}
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