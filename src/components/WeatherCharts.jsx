// src/components/WeatherCharts.jsx
import React, { useState, useMemo } from 'react';
import { CloudRain } from 'lucide-react';
import { TRANSLATIONS } from '../constants/translations';

// --- GRÀFIC INDIVIDUAL (SVG) ---
export const SingleHourlyChart = ({ data, comparisonData, layer, unit, hoveredIndex, setHoveredIndex, height = 140, lang = 'ca' }) => {
  if (!data || data.length === 0) return null;
  const t = TRANSLATIONS[lang];

  const layersConfig = {
    temp: { key: 'temp', color: '#818cf8', gradientStart: '#818cf8', title: t.temp },
    rain: { key: 'rain', color: '#3b82f6', gradientStart: '#3b82f6', title: t.rainProb },
    wind: { key: 'wind', color: '#2dd4bf', gradientStart: '#2dd4bf', title: t.wind },
    cloud: { key: 'cloud', color: '#94a3b8', gradientStart: '#94a3b8', title: t.cloud },
    humidity: { key: 'humidity', color: '#22d3ee', gradientStart: '#22d3ee', title: t.humidity },
    snowLevel: { key: 'snowLevel', color: '#e2e8f0', gradientStart: '#cbd5e1', title: t.snowLevel }
  };

  const currentConfig = layersConfig[layer];
  const dataKey = currentConfig.key;
  const width = 800;
  const paddingX = 20;
  const paddingY = 30;

  // 1. MEMOITZACIÓ DELS CÀLCULS GEOMÈTRICS (La clau del rendiment)
  // Això evita recalcular min/max i coordenades cada cop que mous el ratolí.
  const { points, gfsPoints, iconPoints, minVal, range } = useMemo(() => {
    const getSafeValue = (d) => {
        const val = d[dataKey];
        if (val === null || val === undefined) {
            if (layer === 'snowLevel') return null; 
            return 0;
        }
        return val;
    };

    const mapValues = (dataset) => dataset.map(getSafeValue).filter(v => v !== null);
    
    let allValues = mapValues(data);
    if (comparisonData?.gfs) allValues = [...allValues, ...mapValues(comparisonData.gfs)];
    if (comparisonData?.icon) allValues = [...allValues, ...mapValues(comparisonData.icon)];

    let min = allValues.length ? Math.min(...allValues) : 0;
    let max = allValues.length ? Math.max(...allValues) : 100;

    if (layer === 'temp') { min -= 2; max += 2; } 
    else if (['rain', 'cloud', 'humidity'].includes(layer)) { min = 0; max = 100; } 
    else if (layer === 'wind') { min = 0; max = Math.max(max, 20); } 
    else if (layer === 'snowLevel') { min = Math.max(0, min - 500); max = max + 500; }
    
    const rng = max - min || 1;
    const calcY = (val) => {
        if (val === null) return height + 10; 
        return height - paddingY - ((val - min) / rng) * (height - 2 * paddingY);
    };

    const createPoints = (dataset) => dataset.map((d, i) => ({
        x: paddingX + (i / (dataset.length - 1)) * (width - 2 * paddingX),
        y: calcY(getSafeValue(d)),
        value: getSafeValue(d),
        time: d.time
    }));

    return {
        points: createPoints(data),
        gfsPoints: comparisonData?.gfs ? createPoints(comparisonData.gfs) : [],
        iconPoints: comparisonData?.icon ? createPoints(comparisonData.icon) : [],
        minVal: min,
        range: rng
    };
  }, [data, comparisonData, layer, height, dataKey]);

  // 2. MEMOITZACIÓ DELS PATHS SVG
  const { areaPath, linePath, gfsPath, iconPath } = useMemo(() => {
      const buildSmoothPath = (pts) => {
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
  }, [points, gfsPoints, iconPoints, height, comparisonData, width]);

  // Dades dinàmiques per al tooltip (això sí que canvia amb el hover)
  const hoverData = hoveredIndex !== null && points[hoveredIndex] ? points[hoveredIndex] : null;
  const gfsValue = (hoveredIndex !== null && gfsPoints[hoveredIndex]) ? gfsPoints[hoveredIndex].value : null;
  const iconValue = (hoveredIndex !== null && iconPoints[hoveredIndex]) ? iconPoints[hoveredIndex].value : null;

  const formatTooltipValue = (val) => {
      if (val === null || val === undefined) return "--";
      if (layer === 'snowLevel') return val > 4000 ? "> 4000" : Math.round(val);
      return Math.round(val);
  };

  return (
    <div className="relative w-full">
      <div className="absolute top-2 left-4 text-xs font-bold text-slate-400 uppercase tracking-wider z-10 flex items-center gap-2">
         <span className={`w-2 h-2 rounded-full`} style={{backgroundColor: currentConfig.color}}></span>
         {currentConfig.title}
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto drop-shadow-lg touch-pan-x" preserveAspectRatio="none">
        <defs>
          <linearGradient id={`gradient-${layer}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={currentConfig.gradientStart} stopOpacity="0.4" />
            <stop offset="100%" stopColor={currentConfig.gradientStart} stopOpacity="0" />
          </linearGradient>
        </defs>
        <line x1={paddingX} y1={height - paddingY} x2={width - paddingX} y2={height - paddingY} stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
        
        {areaPath && <path d={areaPath} fill={`url(#gradient-${layer})`} />}
        {gfsPath && <path d={gfsPath} fill="none" stroke="#4ade80" strokeWidth="1.5" strokeOpacity="0.8" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="4 4"/>}
        {iconPath && <path d={iconPath} fill="none" stroke="#fbbf24" strokeWidth="1.5" strokeOpacity="0.8" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="2 2"/>}
        {linePath && <path d={linePath} fill="none" stroke={currentConfig.color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />}
        
        {/* Zona interactiva invisible */}
        {points.map((p, i) => (
          <rect 
            key={i} 
            x={p.x - (width / points.length / 2)} 
            y={0} 
            width={width / points.length} 
            height={height} 
            fill="transparent" 
            onMouseEnter={() => setHoveredIndex(i)}
            onClick={() => setHoveredIndex(i)}
            onTouchStart={() => setHoveredIndex(i)}
            className="cursor-pointer"
          />
        ))}

        {/* Eix X (Hores) - Pintat només si cal */}
        {points.map((p, i) => (
             (i % (points.length > 12 ? 3 : 1) === 0) && (
              <text key={`txt-${i}`} x={p.x} y={height - 2} textAnchor="middle" fill="#64748b" fontSize="10" fontWeight="bold">
                  {new Date(p.time).getHours()}h
              </text>
            )
        ))}

        {/* Tooltip Dinàmic */}
        {hoverData && hoverData.value !== null && (
          <g>
            <line x1={hoverData.x} y1={0} x2={hoverData.x} y2={height - paddingY} stroke="white" strokeWidth="1" strokeDasharray="3 3" opacity="0.3" />
            <circle cx={hoverData.x} cy={hoverData.y} r="4" fill={currentConfig.color} stroke="white" strokeWidth="2" />
            
            <g transform={`translate(${Math.min(width - 100, Math.max(100, hoverData.x))}, ${Math.min(height - 80, Math.max(50, hoverData.y - 60))})`}>
               <rect x="-65" y="-45" width="130" height="90" rx="6" fill="#0f172a" stroke={currentConfig.color} strokeWidth="1" opacity="0.95" filter="drop-shadow(0 4px 6px rgb(0 0 0 / 0.5))" />
               <text x="0" y="-30" textAnchor="middle" fill="white" fontSize="11" fontWeight="bold" opacity="0.8">
                 {new Date(hoverData.time).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}
               </text>
               <line x1="-55" y1="-22" x2="55" y2="-22" stroke="white" strokeOpacity="0.1" />
               <circle cx="-45" cy="-10" r="3" fill={currentConfig.color} />
               <text x="-35" y="-7" textAnchor="start" fill="white" fontSize="10" fontWeight="bold">ECMWF:</text>
               <text x="50" y="-7" textAnchor="end" fill="white" fontSize="10" fontWeight="bold">
                   {formatTooltipValue(hoverData.value)}{unit}
               </text>
               
               {gfsValue !== null && (
                 <>
                   <circle cx="-45" cy="8" r="3" fill="#4ade80" />
                   <text x="-35" y="11" textAnchor="start" fill="#cbd5e1" fontSize="10">GFS:</text>
                   <text x="50" y="11" textAnchor="end" fill="#4ade80" fontSize="10" fontWeight="bold">
                       {formatTooltipValue(gfsValue)}{unit}
                   </text>
                 </>
               )}
               {iconValue !== null && (
                 <>
                   <circle cx="-45" cy="26" r="3" fill="#fbbf24" />
                   <text x="-35" y="29" textAnchor="start" fill="#cbd5e1" fontSize="10">ICON:</text>
                   <text x="50" y="29" textAnchor="end" fill="#fbbf24" fontSize="10" fontWeight="bold">
                       {formatTooltipValue(iconValue)}{unit}
                   </text>
                 </>
               )}
            </g>
          </g>
        )}
      </svg>
    </div>
  );
};

// --- GRÀFIC PREVISIÓ HORÀRIA (Container) ---
export const HourlyForecastChart = ({ data, comparisonData, unit, lang = 'ca' }) => {
  const [hoveredIndex, setHoveredIndex] = useState(null);
  const t = TRANSLATIONS[lang];

  if (!data || data.length === 0) return null;
  
  return (
    <div className="w-full overflow-x-auto custom-scrollbar relative touch-pan-x" onMouseLeave={() => setHoveredIndex(null)}>
      <div className="min-w-[220%] md:min-w-full space-y-3 pr-4">
        <SingleHourlyChart data={data} comparisonData={comparisonData} layer="temp" unit={unit} hoveredIndex={hoveredIndex} setHoveredIndex={setHoveredIndex} height={150} lang={lang} />
        <SingleHourlyChart data={data} comparisonData={comparisonData} layer="rain" unit="%" hoveredIndex={hoveredIndex} setHoveredIndex={setHoveredIndex} height={130} lang={lang} />
        <SingleHourlyChart data={data} comparisonData={comparisonData} layer="wind" unit="km/h" hoveredIndex={hoveredIndex} setHoveredIndex={setHoveredIndex} height={130} lang={lang} />
        <SingleHourlyChart data={data} comparisonData={comparisonData} layer="snowLevel" unit="m" hoveredIndex={hoveredIndex} setHoveredIndex={setHoveredIndex} height={130} lang={lang} />
      </div>

      <div className="flex justify-center items-center gap-4 mt-4 pt-2 border-t border-white/5">
           <span className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">{t.modelsLegend}:</span>
           <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full bg-indigo-500 border border-indigo-400"></div>
              <span className="text-xs text-slate-300">{t.modelBest}</span>
           </div>
           <div className="flex items-center gap-1.5">
              <div className="w-3 h-0.5 bg-green-400 border-t border-b border-green-400 border-dashed w-4"></div>
              <span className="text-xs text-slate-300">{t.modelGfs}</span>
           </div>
           <div className="flex items-center gap-1.5">
              <div className="w-3 h-0.5 bg-amber-400 border-t border-b border-amber-400 border-dashed w-4"></div>
              <span className="text-xs text-slate-300">{t.modelIcon}</span>
           </div>
      </div>
    </div>
  );
};

// Mantenim l'altre component igual...
export const MinutelyPreciseChart = ({ data, label, currentPrecip = 0 }) => {
    // ... (el mateix codi que tenies, no cal tocar-lo)
    let chartData = data ? [...data] : [];
    if(chartData.length === 0) return null; 
    while(chartData.length < 4) chartData.push(0);
    chartData = chartData.slice(0, 4);
    if (currentPrecip > 0 && chartData[0] === 0) chartData[0] = currentPrecip;
    if (chartData.every(v => v === 0)) return null;
    const max = Math.max(...chartData, 0.5); 
    const getIntensityColor = (val) => {
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
                {max > 2.5 && <span className="text-[9px] text-slate-400 font-medium">Màx: {max.toFixed(1)}mm</span>}
            </div>
            <div className="relative h-16 w-full pb-1">
                <div className="absolute inset-0 flex flex-col justify-between pointer-events-none opacity-20">
                    <div className="w-full h-px bg-white border-dashed border-t border-white/50"></div>
                    <div className="w-full h-px bg-white border-dashed border-t border-white/50"></div>
                    <div className="w-full h-px bg-white border-dashed border-t border-white/50"></div>
                </div>
                <div className="flex items-end gap-2 h-full w-full relative z-10">
                {chartData.map((val, i) => (
                    <div key={i} className="flex-1 flex flex-col items-center gap-1 group relative h-full justify-end">
                        {val > 0 && (
                            <span className={`text-[9px] font-bold mb-0.5 animate-in slide-in-from-bottom-1 ${val > 7.6 ? 'text-white' : 'text-blue-200'}`}>
                                {val >= 10 ? Math.round(val) : val.toFixed(1)}
                            </span>
                        )}
                        <div className="w-full bg-blue-900/30 rounded-sm relative h-full max-h-[40px] overflow-hidden flex items-end">
                            <div 
                            className={`w-full rounded-sm transition-all group-hover:opacity-80 ${getIntensityColor(val)}`}
                            style={{ height: `${(val / max) * 100}%`, minHeight: val > 0 ? '2px' : '0' }}
                            ></div>
                        </div>
                        <span className="text-[9px] text-slate-400 font-medium">{i === 0 ? 'Ara' : `+${i * 15}m`}</span>
                    </div>
                ))}
                </div>
            </div>
            <div className="flex justify-between items-center text-[9px] text-blue-400/70 mt-1 px-1">
            <span>Intensitat (mm)</span>
            <span>Previsió 1h</span>
            </div>
        </div>
    );
};