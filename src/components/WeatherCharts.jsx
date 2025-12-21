// src/components/WeatherCharts.jsx
import React, { useState } from 'react';
import { CloudRain } from 'lucide-react';
import { TRANSLATIONS } from '../constants/translations';

// --- GRÀFIC INDIVIDUAL (SVG) ---
export const SingleHourlyChart = ({ data, comparisonData, layer, unit, hoveredIndex, setHoveredIndex, height = 140, lang = 'ca', shiftedNow }) => {
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

  // Helper per obtenir valor segur (evitant 0 si és null en cota de neu)
  const getSafeValue = (d) => {
      const val = d[dataKey];
      if (val === null || val === undefined) {
          // Si és cota de neu i no tenim dades, millor no pintar 0 (neu a la platja).
          // Retornem null per filtrar-ho després o un valor mig.
          // Per simplicitat visual, si és null, usem 0 per temp/pluja, però per neu és perillós.
          if (layer === 'snowLevel') return null; 
          return 0;
      }
      return val;
  };

  // Recopilem tots els valors per calcular l'escala Y (ignorant nulls)
  const mapValues = (dataset) => dataset.map(getSafeValue).filter(v => v !== null);
  
  let allValues = mapValues(data);
  if (comparisonData && comparisonData.gfs) allValues = [...allValues, ...mapValues(comparisonData.gfs)];
  if (comparisonData && comparisonData.icon) allValues = [...allValues, ...mapValues(comparisonData.icon)];

  // Valors per defecte si tot és null
  let minVal = allValues.length ? Math.min(...allValues) : 0;
  let maxVal = allValues.length ? Math.max(...allValues) : 100;

  // Ajustem l'escala segons el tipus de dada per a més "realisme" visual
  if (layer === 'temp') {
     minVal -= 2;
     maxVal += 2;
  } else if (layer === 'rain' || layer === 'cloud' || layer === 'humidity') {
    minVal = 0;
    maxVal = 100;
  } else if (layer === 'wind') {
    minVal = 0; 
    maxVal = Math.max(maxVal, 20);
  } else if (layer === 'snowLevel') {
    // Marge de 500m per veure bé la variació
    minVal = Math.max(0, minVal - 500);
    maxVal = maxVal + 500;
  }
  
  const range = maxVal - minVal || 1;
  const calcY = (val) => {
      // Si el valor és null (per cota de neu), el treiem fora del gràfic o interpol·lem
      if (val === null) return height + 10; 
      return height - paddingY - ((val - minVal) / range) * (height - 2 * paddingY);
  };

  const points = data.map((d, i) => ({
    x: paddingX + (i / (data.length - 1)) * (width - 2 * paddingX),
    y: calcY(getSafeValue(d)),
    value: getSafeValue(d),
    time: d.time
  }));

  const buildSmoothPath = (pts, keyY = 'y') => {
    // Filtrem punts no vàlids (nulls) per no trencar la línia SVG
    const validPts = pts.filter(p => p.value !== null && p[keyY] <= height);
    if (validPts.length === 0) return "";

    let d = `M ${validPts[0].x},${validPts[0][keyY]}`;
    for (let i = 0; i < validPts.length - 1; i++) {
      const p0 = validPts[i];
      const p1 = validPts[i + 1];
      const cx = (p0.x + p1.x) / 2;
      d += ` C ${cx},${p0[keyY]} ${cx},${p1[keyY]} ${p1.x},${p1[keyY]}`;
    }
    return d;
  };

  const linePath = buildSmoothPath(points, 'y');
  // L'àrea tanca a baix
  const areaPath = linePath ? `${linePath} L ${points[points.length-1]?.x || width - paddingX},${height} L ${points[0]?.x || paddingX},${height} Z` : "";

  let gfsPath = "";
  let iconPath = "";
  
  // Generem línies comparatives només si no és SnowLevel (per no embrutar) o si es vol
  if (comparisonData) {
      if (comparisonData.gfs && comparisonData.gfs.length > 0) {
          const gfsPoints = comparisonData.gfs.map((d, i) => ({
              x: paddingX + (i / (comparisonData.gfs.length - 1)) * (width - 2 * paddingX),
              y: calcY(getSafeValue(d)),
              value: getSafeValue(d)
          }));
          gfsPath = buildSmoothPath(gfsPoints, 'y');
      }
      if (comparisonData.icon && comparisonData.icon.length > 0) {
          const iconPoints = comparisonData.icon.map((d, i) => ({
              x: paddingX + (i / (comparisonData.icon.length - 1)) * (width - 2 * paddingX),
              y: calcY(getSafeValue(d)),
              value: getSafeValue(d)
          }));
          iconPath = buildSmoothPath(iconPoints, 'y');
      }
  }

  const hoverData = hoveredIndex !== null && points[hoveredIndex] ? points[hoveredIndex] : null;
  const gfsDataPoint = (hoveredIndex !== null && comparisonData?.gfs) ? comparisonData.gfs[hoveredIndex] : null;
  const iconDataPoint = (hoveredIndex !== null && comparisonData?.icon) ? comparisonData.icon[hoveredIndex] : null;

  const gfsValue = gfsDataPoint ? getSafeValue(gfsDataPoint) : null;
  const iconValue = iconDataPoint ? getSafeValue(iconDataPoint) : null;

  // Formatador especial per al Tooltip (Realisme Cota de Neu)
  const formatTooltipValue = (val) => {
      if (val === null || val === undefined) return "--";
      if (layer === 'snowLevel') {
          if (val > 4000) return "> 4000";
          return Math.round(val);
      }
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
        
        {points.map((p, i) => (
          <g 
            key={i} 
            onMouseEnter={() => setHoveredIndex(i)}
            onClick={() => setHoveredIndex(i)}
            onTouchStart={() => setHoveredIndex(i)}
            className="cursor-pointer"
          >
            <rect x={p.x - (width / points.length / 2)} y={0} width={width / points.length} height={height} fill="transparent" />
            {(i % (points.length > 12 ? 3 : 1) === 0) && (
              <text x={p.x} y={height - 2} textAnchor="middle" fill="#64748b" fontSize="10" fontWeight="bold">{new Date(p.time).getHours()}h</text>
            )}
          </g>
        ))}

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
export const HourlyForecastChart = ({ data, comparisonData, unit, lang = 'ca', shiftedNow }) => {
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

// --- GRÀFIC PRECIPITACIÓ MINUT A MINUT ---
export const MinutelyPreciseChart = ({ data, label, currentPrecip = 0 }) => {
  let chartData = data ? [...data] : [];
  if(chartData.length === 0) return null; 
  
  while(chartData.length < 4) chartData.push(0);
  chartData = chartData.slice(0, 4);

  if (currentPrecip > 0 && chartData[0] === 0) {
      chartData[0] = currentPrecip;
  }

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
                     <span className="text-[9px] text-slate-400 font-medium">
                        {i === 0 ? 'Ara' : `+${i * 15}m`}
                     </span>
                  </div>
               ))}
             </div>
        </div>
        <div className="flex justify-between items-center text-[9px] text-blue-400/70 mt-1 px-1">
           <span>Intensitat (mm)</span>
           <span>Previsió 1h</span>
        </div>
    </div>
  )
};