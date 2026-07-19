import { memo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { LineChart, X, Droplets } from 'lucide-react'; 
import { getWeatherIcon } from './WeatherIcons';
import { Language } from '../translations';
import { StrictDailyWeather } from '../types/weatherLogicTypes';

export interface ChartDataPoint {
  time: string;
  temp: number | null;
  precip: number | null;
  [key: string]: unknown;
}

export interface TrendChartModalProps {
  isOpen: boolean;
  onClose: () => void;
  dailyData: StrictDailyWeather;
  chartData: ChartDataPoint[];
  lang: Language;
}

// HELPER RISC ZERO
const getSafeArrayNum = (arr: unknown, index: number, fallback: number = 0): number => {
  if (!Array.isArray(arr)) return fallback;
  const val = arr[index];
  return (typeof val === 'number' && !isNaN(val)) ? val : fallback;
};

// HELPER RISC ZERO
const getSafeLocale = (lang: Language): string => {
  switch (lang) {
    case 'es': return 'es-ES';
    case 'fr': return 'fr-FR';
    case 'en': return 'en-US';
    case 'ca':
    default: return 'ca-ES';
  }
};

// MOTOR DE COLOR ABSOLUT (Spatial UI Tàctic)
const getAbsoluteColor = (temp: number): string => {
  if (temp <= -5) return '#3b82f6'; // Blau profund (Glaç)
  if (temp <= 5) return '#06b6d4';  // Cian (Molt fred)
  if (temp <= 12) return '#10b981'; // Maragda (Fresc)
  if (temp <= 20) return '#a3e635'; // Llima (Suau)
  if (temp <= 26) return '#fbbf24'; // Ambre (Càlid)
  if (temp <= 32) return '#f97316'; // Taronja (Molt càlid)
  return '#ef4444';                 // Vermell (Calor extrema)
};

const I18N_MODAL = {
  ca: { title: "Gràfic Temperatures", trend: "Tendència 7 Dies" },
  es: { title: "Gráfico Temperaturas", trend: "Tendencia 7 Días" },
  fr: { title: "Graphe Températures", trend: "Tendance 7 Jours" },
  en: { title: "Temperature Chart", trend: "7-Day Trend" }
};

const MATRIX_BG = `absolute inset-0 z-0 opacity-[0.03] pointer-events-none bg-[linear-gradient(to_right,#ffffff_1px,transparent_1px),linear-gradient(to_bottom,#ffffff_1px,transparent_1px)] bg-[size:12px_12px]`;

const TrendChartModal = memo(function TrendChartModal({ 
  isOpen, onClose, dailyData, chartData, lang 
}: TrendChartModalProps) {
  
  // EFECTE UX PREMIUM: Bloqueig scroll
  useEffect(() => {
    if (isOpen && typeof document !== 'undefined') {
      const originalOverflow = window.getComputedStyle(document.body).overflow;
      document.body.style.overflow = 'hidden';
      
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [isOpen]);

  // EFECTE UX ESCRIPTORI: Tancar amb Escape
  useEffect(() => {
    if (!isOpen || typeof document === 'undefined') return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;
  if (!dailyData || !Array.isArray(dailyData.time) || dailyData.time.length < 8) return null;
  if (typeof document === 'undefined') return null;

  const mDict = I18N_MODAL[lang] || I18N_MODAL['ca'];

  // 1. EXTRACCIÓ TÀCTICA DE DADES I MOTOR VISUAL INTEL·LIGENT
  const trendData = dailyData.time.slice(1, 8).map((rawDate: unknown, index: number) => {
    const i = index + 1;
    const max = getSafeArrayNum(dailyData.temperature_2m_max, i);
    const min = getSafeArrayNum(dailyData.temperature_2m_min, i);
    const rawCode = getSafeArrayNum(dailyData.weather_code, i);
    const wind = getSafeArrayNum(dailyData.wind_speed_10m_max, i);
    const precipProb = getSafeArrayNum(dailyData.precipitation_probability_max, i);
    
    let dayInitial = '';
    let code = rawCode;

    if (typeof rawDate === 'string') {
      const date = new Date(rawDate);
      if (!isNaN(date.getTime())) {
        dayInitial = date.toLocaleDateString(getSafeLocale(lang), { weekday: 'short' })
          .replace(/\./g, '')
          .toUpperCase();
      }

      // Filtre de núvols diürns
      if (rawCode <= 3 && Array.isArray(chartData) && chartData.length > 0) {
        const dateOnly = rawDate.slice(0, 10); 
        const dayHours = chartData.filter(d => 
          typeof d.time === 'string' && d.time.startsWith(dateOnly) && d.isDay === 1
        );
        if (dayHours.length > 0) {
          const totalClouds = dayHours.reduce((acc, curr) => {
            const c = Number(curr.cloud);
            return acc + (isNaN(c) ? 0 : c);
          }, 0);
          const avgClouds = totalClouds / dayHours.length;
          if (avgClouds > 85) code = 3;
          else if (avgClouds > 45) code = 2;
          else if (avgClouds > 15) code = 1;
          else code = 0;
        }
      }
    }
    
    return { max, min, code, wind, precipProb, dayInitial };
  });

  if (trendData.length === 0) return null;

  // 2. MOTOR MATEMÀTIC DE COLUMNES DE RANG (Candlestick)
  const maxTemps = trendData.map(d => d.max);
  const minTemps = trendData.map(d => d.min);
  
  const chartMax = Math.max(...maxTemps);
  const chartMin = Math.min(...minTemps); // Ara busquem la mínima absoluta de veritat per estirar l'eix

  const padding = chartMax === chartMin ? 2 : (chartMax - chartMin) * 0.25; 
  const yMax = chartMax + padding;
  const yMin = chartMin - padding;
  const range = yMax - yMin;

  const N = trendData.length;
  // Centrat per a la graella grid-cols-7
  const getX = (index: number) => ((index + 0.5) / N) * 100;
  // Conversió Y: 0% dalt, 100% baix
  const getY = (val: number) => ((yMax - val) / range) * 100; 

  const pointsStr = trendData.map((d, i) => `${getX(i)},${getY(d.max)}`).join(' ');

  // 3. RENDERITZAT SPATIAL UI PORTAL
  const modalContent = (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-2 sm:p-6 bg-black/80 backdrop-blur-xl transition-opacity overflow-y-auto">
      <div className="absolute inset-0 cursor-pointer" onClick={onClose} aria-label="Tancar modal"></div>
      
      <div className="w-full max-w-5xl bg-gradient-to-br from-[#0f111a] to-black border border-white/10 rounded-[2rem] shadow-[0_20px_50px_rgba(0,0,0,0.7)] relative overflow-hidden transform-gpu flex flex-col my-auto max-h-[95vh] pointer-events-auto">
        <div className={MATRIX_BG}></div>
        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-[80px] pointer-events-none mix-blend-screen z-0"></div>
        
        {/* HEADER MODAL */}
        <div className="flex items-center justify-between p-4 md:p-8 border-b border-white/5 relative z-10">
          <div className="flex items-center gap-3 md:gap-4">
            <div className="p-2 md:p-3 rounded-xl bg-indigo-500/20 border border-indigo-500/30">
              <LineChart className="w-5 h-5 md:w-7 md:h-7 text-indigo-400" />
            </div>
            <div>
              <h2 className="text-sm md:text-xl font-black uppercase tracking-widest text-white leading-none mb-1 md:mb-2">
                {mDict.title}
              </h2>
              <p className="text-[10px] md:text-xs font-bold text-slate-400 uppercase tracking-widest">
                {mDict.trend}
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 md:p-3 rounded-full bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors border border-white/5 cursor-pointer"
          >
            <X className="w-5 h-5 md:w-6 md:h-6" />
          </button>
        </div>

        {/* CONTINGUT GRÀFIC I DADES */}
        <div className="p-4 md:p-8 relative z-10 flex-1 overflow-y-auto overflow-x-hidden">
          <div className="flex flex-col w-full h-full mt-4">
            
            <style>{`
              @keyframes fadeUpAnim { 
                from { opacity: 0; transform: translateY(15px) translateX(-50%); } 
                to { opacity: 1; transform: translateY(0) translateX(-50%); } 
              }
              @keyframes drawLine {
                to { stroke-dashoffset: 0; }
              }
              .anim-draw-line {
                stroke-dasharray: 2000;
                stroke-dashoffset: 2000;
                animation: drawLine 1.5s ease-out forwards;
              }
              .anim-column {
                opacity: 0;
                animation: fadeUpAnim 0.8s cubic-bezier(0.2, 0.8, 0.2, 1) forwards;
              }
            `}</style>

            {/* CONTENIDOR DEL GRÀFIC (Dona espai dalt i baix pels textos) */}
            <div className="relative w-full h-[260px] md:h-[400px] mt-2 mb-4">
              
              {/* FIL DE TENDÈNCIA (Fons) */}
              <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                <polyline 
                  points={pointsStr} 
                  fill="none" 
                  stroke="#475569" 
                  strokeWidth="1.5" 
                  strokeDasharray="2 3"
                  strokeLinejoin="round"
                  vectorEffect="non-scaling-stroke"
                  className="anim-draw-line opacity-50"
                />
              </svg>

              {/* COLUMNES DE RANG (Candlesticks HTML) */}
              {trendData.map((d, i) => {
                const yMaxPos = getY(d.max);
                const yMinPos = getY(d.min);
                const colorMax = getAbsoluteColor(d.max);
                const colorMin = getAbsoluteColor(d.min);

                return (
                  <div 
                    key={`candlestick-${i}`}
                    className="absolute flex flex-col items-center anim-column"
                    style={{ 
                      left: `${getX(i)}%`, 
                      top: `${yMaxPos}%`, 
                      bottom: `${100 - yMinPos}%`,
                      transform: 'translateX(-50%)',
                      animationDelay: `${i * 0.08}s` // Efecte cascada fluid
                    }}
                  >
                    {/* Màxima (Dalt) */}
                    <span className="absolute bottom-full mb-1.5 md:mb-2 text-[11px] md:text-sm font-black text-white drop-shadow-md">
                      {Math.round(d.max)}°
                    </span>
                    
                    {/* Càpsula Tèrmica */}
                    <div 
                      className="w-2.5 md:w-4 h-full rounded-full shadow-[0_0_15px_rgba(0,0,0,0.5)] border border-white/20"
                      style={{ 
                        background: `linear-gradient(to bottom, ${colorMax}, ${colorMin})`,
                        minHeight: '12px' // Assegura que mai col·lapsa a 0px si min == max
                      }}
                    ></div>

                    {/* Mínima (Baix) */}
                    <span className="absolute top-full mt-1.5 md:mt-2 text-[10px] md:text-sm font-bold text-slate-400 drop-shadow-md">
                      {Math.round(d.min)}°
                    </span>
                  </div>
                );
              })}
            </div>

            {/* BARRA INFERIOR (Ultra-neta: Només Dia, Icona, Pluja) */}
            <div className="grid grid-cols-7 w-full mt-4 md:mt-8 border-t border-white/5 pt-4">
              {trendData.map((d, i) => (
                <div key={`col-${i}`} className="flex flex-col items-center justify-end gap-1 md:gap-3 flex-1 group">
                  <span className="text-[9px] md:text-sm font-black text-slate-400 uppercase tracking-widest">
                    {d.dayInitial}
                  </span>
                  
                  <div className="scale-[0.85] md:scale-[1.3] transform-gpu transition-transform duration-300 group-hover:scale-100 md:group-hover:scale-[1.4] my-1 md:my-3">
                    {getWeatherIcon(d.code, "w-8 h-8 md:w-12 md:h-12", true, 0, d.wind)}
                  </div>
                  
                  <div className={`flex items-center gap-0.5 md:gap-1.5 mt-1 px-1.5 py-0.5 md:px-3 md:py-1.5 rounded border ${d.precipProb > 0 ? 'bg-blue-500/10 border-blue-500/20' : 'bg-transparent border-transparent opacity-40'}`}>
                    <Droplets className={`w-2.5 h-2.5 md:w-4 md:h-4 ${d.precipProb > 0 ? 'text-blue-400' : 'text-slate-600'}`} />
                    <span className={`text-[8px] md:text-[11px] font-black tabular-nums ${d.precipProb > 0 ? 'text-blue-300' : 'text-slate-500'}`}>
                      {d.precipProb}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
            
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
});

export default TrendChartModal;