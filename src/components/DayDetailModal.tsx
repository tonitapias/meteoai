import React, { useMemo, useEffect, useCallback } from 'react';
import { X, Calendar, Droplets, Wind, Thermometer, Sun, Moon, Mountain, Clock, ArrowDown, ArrowUp } from 'lucide-react';
import { SmartForecastCharts } from './WeatherCharts'; 
import { TRANSLATIONS, Language } from '../translations';
import { ExtendedWeatherData } from '../types/weatherLogicTypes';
import { WeatherUnit, formatPrecipitation } from '../utils/formatters';
import { useDayDetailData } from '../hooks/useDayDetailData';
import { getWeatherIcon } from './WeatherIcons';

interface StatCardProps {
  icon: React.ElementType;
  label: string;
  value: string | number;
  sub?: string;
  color: string;
  glowClasses: string;
}

const StatCard = ({ icon: Icon, label, value, sub, color, glowClasses }: StatCardProps) => (
  <div className="relative overflow-hidden bg-gradient-to-br from-[#0f111a]/90 to-black/80 border border-white/5 p-4 rounded-2xl flex flex-col items-center justify-center text-center gap-2 shadow-[0_8px_32px_rgba(0,0,0,0.3)] backdrop-blur-md group hover:border-white/10 transition-colors duration-500 transform-gpu z-10">
    <div className="absolute inset-0 z-0 opacity-[0.03] pointer-events-none bg-[linear-gradient(to_right,#ffffff_1px,transparent_1px),linear-gradient(to_bottom,#ffffff_1px,transparent_1px)] bg-[size:12px_12px]"></div>
    
    <div className={`relative z-10 p-2.5 rounded-xl bg-black/50 border border-white/5 mb-1 transition-shadow duration-500 ${value !== '--' ? glowClasses : 'shadow-none opacity-50'}`}>
        <Icon className={`w-5 h-5 ${value !== '--' ? color : 'text-slate-500'}`} strokeWidth={2.5}/>
    </div>
    
    <span className="relative z-10 text-[10px] text-slate-400 uppercase font-black tracking-widest">{label}</span>
    
    <span className={`relative z-10 text-xl font-mono font-black tabular-nums tracking-tight transition-colors duration-500 ${value === '--' ? 'text-slate-600' : 'text-slate-100'}`}>
      {value}<span className="text-xs ml-0.5 font-bold text-slate-500">{value !== '--' ? sub : ''}</span>
    </span>
  </div>
);

// DOCTRINA RISC ZERO: Interfície estricta per evitar usar 'any'
interface TableRowData {
    hour: string;
    temp: number | null;
    code: number;
    precipProb: number;
    precipSum: number;
    snowfall: number;
    windSpeed: number | null;
    isDay: boolean;
}

// HELPER RISC ZERO: Resolució de localització robusta per l'Intl
const getSafeLocale = (lang: Language): string => {
    switch (lang) {
        case 'es': return 'es-ES';
        case 'fr': return 'fr-FR';
        case 'en': return 'en-US';
        case 'ca':
        default: return 'ca-ES';
    }
};

interface DayDetailModalProps {
  weatherData: ExtendedWeatherData | null;
  selectedDayIndex: number | null;
  onClose: () => void;
  unit: WeatherUnit;
  lang: Language;
  shiftedNow?: Date;
}

export default function DayDetailModal({ 
  weatherData, 
  selectedDayIndex, 
  onClose, 
  unit, 
  lang
}: DayDetailModalProps) {
  // DOCTRINA RISC ZERO: Extracció tipada de diccionari amb fallbacks severs per no dependre exclusivament del .ts
  const tRecord = (TRANSLATIONS[lang] || TRANSLATIONS['ca']) as Record<string, unknown>;
  const tDayDetail = (typeof tRecord.dayDetail === 'object' && tRecord.dayDetail !== null) ? (tRecord.dayDetail as Record<string, string>) : {};
  
  // DICCIONARI INTERN TÀCTIC (Per capçaleres dures de la taula)
  const TACTICAL_I18N = useMemo(() => ({
    detailHeader: lang === 'en' ? 'DAY DETAIL' : lang === 'fr' ? 'DÉTAIL DU JOUR' : lang === 'es' ? 'DETALLE DEL DÍA' : 'DETALL DEL DIA',
    hourlyHeader: lang === 'en' ? 'HOURLY FORECAST' : lang === 'fr' ? 'PRÉVISIONS HORAIRES' : lang === 'es' ? 'PREVISIÓN POR HORAS' : 'PREVISIÓ PER HORES',
    colHour: lang === 'en' ? 'HOUR' : lang === 'fr' ? 'HEURE' : 'HORA',
    colSky: lang === 'en' ? 'SKY' : lang === 'fr' ? 'CIEL' : lang === 'es' ? 'CIELO' : 'CEL',
    colTemp: 'TEMP',
    colRain: lang === 'en' ? 'RAIN' : lang === 'fr' ? 'PLUIE' : lang === 'es' ? 'LLUVIA' : 'PLUJA',
    colWind: lang === 'en' ? 'WIND' : lang === 'es' ? 'VIENTO' : 'VENT'
  }), [lang]);

  const { dayData, hourlyData, comparisonData, snowLevelText } = useDayDetailData(weatherData, selectedDayIndex);

  // --- NAVEGACIÓ TÀCTICA (UNIFICADA) ---
  const handleClose = useCallback(() => {
      window.history.back();
  }, []);

  const handleBackdropClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
      if (e.target === e.currentTarget) {
          handleClose();
      }
  }, [handleClose]);

  useEffect(() => {
      window.history.pushState({ modal: 'dayDetail' }, '');
      
      const handlePopState = () => {
          onClose(); 
      };
      
      const handleKeyDown = (e: KeyboardEvent) => {
          if (e.key === 'Escape') {
              handleClose(); 
          }
      };
      
      window.addEventListener('popstate', handlePopState);
      window.addEventListener('keydown', handleKeyDown);
      
      return () => {
          window.removeEventListener('popstate', handlePopState);
          window.removeEventListener('keydown', handleKeyDown);
      };
  }, [onClose, handleClose]);

  const formattedPrecipitation = useMemo(() => {
    if (!dayData || !weatherData || selectedDayIndex === null) return { val: "--", unit: "" };
    
    const dailyRaw = weatherData.daily as unknown as Record<string, unknown>;
    const snowSumArr = dailyRaw.snowfall_sum;
    const snowSum = Array.isArray(snowSumArr) && typeof snowSumArr[selectedDayIndex] === 'number' 
        ? (snowSumArr[selectedDayIndex] as number) 
        : 0;
    
    // Si no hi ha dades de precipitació vàlides, retornem fallback
    if (typeof dayData.precipSum !== 'number' || isNaN(dayData.precipSum)) {
        return { val: "--", unit: "" };
    }

    const rawString = formatPrecipitation(dayData.precipSum, snowSum);
    const [val, u] = rawString.split(' '); 
    return { val, unit: u };
  }, [dayData, weatherData, selectedDayIndex]);

  const tableRows = useMemo<TableRowData[]>(() => {
    if (!weatherData || selectedDayIndex === null || !weatherData.hourly || !Array.isArray(weatherData.hourly.time)) return [];
    
    const dateStr = weatherData.daily.time[selectedDayIndex];
    if (typeof dateStr !== 'string') return [];

    const startIndex = weatherData.hourly.time.findIndex((timeStr) => typeof timeStr === 'string' && timeStr.startsWith(dateStr));
    
    if (startIndex === -1) return [];

    let sunriseHour = 7;
    let sunsetHour = 20;
    
    if (Array.isArray(weatherData.daily.sunrise) && Array.isArray(weatherData.daily.sunset)) {
        const sr = weatherData.daily.sunrise[selectedDayIndex];
        const ss = weatherData.daily.sunset[selectedDayIndex];
        if (typeof sr === 'string') sunriseHour = new Date(sr).getHours();
        if (typeof ss === 'string') sunsetHour = new Date(ss).getHours();
    }

    const rows: TableRowData[] = [];
    const hRaw = weatherData.hourly as unknown as Record<string, unknown>;

    for (let i = 0; i < 24; i++) {
        const idx = startIndex + i;
        if (idx >= weatherData.hourly.time.length) break;

        const time = weatherData.hourly.time[idx];
        if (typeof time !== 'string') continue;

        const t2m = weatherData.hourly.temperature_2m;
        const temp = Array.isArray(t2m) && typeof t2m[idx] === 'number' ? t2m[idx] as number : null;
        
        const weatherCodeArr = hRaw.weather_code ?? hRaw.weathercode;
        const code = Array.isArray(weatherCodeArr) && typeof weatherCodeArr[idx] === 'number' ? weatherCodeArr[idx] as number : 0;
        
        const pProbArr = weatherData.hourly.precipitation_probability;
        const precipProb = Array.isArray(pProbArr) && typeof pProbArr[idx] === 'number' ? pProbArr[idx] as number : 0;
        
        const pSumArr = weatherData.hourly.precipitation;
        const precipSum = Array.isArray(pSumArr) && typeof pSumArr[idx] === 'number' ? pSumArr[idx] as number : 0;
        
        const sFallArr = hRaw.snowfall;
        const snowfall = Array.isArray(sFallArr) && typeof sFallArr[idx] === 'number' ? sFallArr[idx] as number : 0;

        const wSpeedArr = weatherData.hourly.wind_speed_10m;
        const windSpeed = Array.isArray(wSpeedArr) && typeof wSpeedArr[idx] === 'number' ? wSpeedArr[idx] as number : null;
        
        const currentHour = parseInt(time.split('T')[1]?.slice(0, 2) || "0", 10);
        const isDay = currentHour >= sunriseHour && currentHour < sunsetHour;

        rows.push({
            hour: time.split('T')[1]?.slice(0, 5) || "--:--",
            temp,
            code,
            precipProb,
            precipSum,
            snowfall,
            windSpeed,
            isDay
        });
    }

    return rows;
  }, [weatherData, selectedDayIndex]);

  if (!dayData) return null;

  const formatTime = (isoString?: string) => {
      if (!isoString) return "--:--";
      try {
          return new Date(isoString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); 
      } catch { return "--:--"; }
  };

  const formatDate = (isoString: string) => {
      try {
          // Solució Risc Zero: Assegurem que toLocaleDateString rep sempre una clau de localització suportada 
          return new Date(isoString).toLocaleDateString(getSafeLocale(lang), {
              weekday: 'long', day: 'numeric', month: 'long'
          });
      } catch { return isoString; }
  };

  // DOCTRINA RISC ZERO: Formatadors assegurats per no renderitzar falsos zeros
  const safeMaxTemp = typeof dayData.maxTemp === 'number' && !isNaN(dayData.maxTemp) ? Math.round(dayData.maxTemp) : '--';
  const safeMinTemp = typeof dayData.minTemp === 'number' && !isNaN(dayData.minTemp) ? Math.round(dayData.minTemp) : '--';
  const safeWindMax = typeof dayData.windMax === 'number' && !isNaN(dayData.windMax) ? Math.round(dayData.windMax) : '--';
  const safeUvMax = typeof dayData.uvMax === 'number' && !isNaN(dayData.uvMax) ? dayData.uvMax.toFixed(1) : '--';
  
  // Formatador estricte per cota de neu
  const safeSnowLevel = typeof snowLevelText === 'number' && !isNaN(snowLevelText) 
    ? Math.round(snowLevelText) 
    : (snowLevelText === '--' ? '--' : snowLevelText);
  const snowLevelUnit = safeSnowLevel !== '--' && typeof snowLevelText === 'number' ? (unit === 'F' ? 'ft' : 'm') : '';

  const MATRIX_BG = `absolute inset-0 z-0 opacity-[0.03] pointer-events-none bg-[linear-gradient(to_right,#ffffff_1px,transparent_1px),linear-gradient(to_bottom,#ffffff_1px,transparent_1px)] bg-[size:12px_12px]`;

  return (
    <div 
        className="fixed inset-0 z-[100] flex items-center justify-center p-0 sm:p-4 bg-[#020617]/95 backdrop-blur-xl animate-in fade-in duration-200"
        onClick={handleBackdropClick}
    >
      <div className="bg-[#050608] sm:border border-white/10 w-full h-full sm:h-auto sm:max-w-4xl sm:max-h-[95vh] overflow-y-auto custom-scrollbar sm:rounded-[2rem] shadow-2xl relative sm:ring-1 sm:ring-white/5">
          
          <button 
            onClick={handleClose}
            className="fixed sm:absolute top-4 right-4 md:top-5 md:right-5 p-3 sm:p-2 bg-black/50 sm:bg-slate-900 rounded-full text-slate-400 hover:text-cyan-400 border border-white/10 sm:border-slate-700 hover:border-cyan-500/50 backdrop-blur-md transition-all z-50 hover:rotate-90 duration-300 shadow-md active:scale-95"
            aria-label="Tancar"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="p-6 pb-8 bg-gradient-to-b from-[#0f111a] to-[#050608] border-b border-white/5 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-cyan-500 to-transparent opacity-60 shadow-[0_0_15px_rgba(34,211,238,0.5)] z-20"></div>
              <div className={MATRIX_BG}></div>
              <div className="absolute top-10 left-1/2 -translate-x-1/2 w-[300px] h-[100px] bg-cyan-500/10 rounded-[100%] blur-[40px] pointer-events-none"></div>

              <div className="flex flex-col items-center justify-center text-center relative z-10 pt-6 sm:pt-2">
                  <div className="flex items-center gap-2 text-cyan-400 font-black uppercase tracking-[0.3em] text-[10px] mb-3 bg-cyan-950/40 px-3 py-1.5 rounded-md border border-cyan-500/30 backdrop-blur-md shadow-[0_0_10px_rgba(6,182,212,0.15)]">
                      {/* Solució tàctica per la capçalera traduïda */}
                      <Calendar className="w-3.5 h-3.5" /> {tDayDetail.forecast || TACTICAL_I18N.detailHeader}
                  </div>
                  
                  <h2 className="text-3xl md:text-5xl font-black text-white capitalize tracking-tight mb-2 drop-shadow-lg">
                      {formatDate(dayData.date)}
                  </h2>
                  
                  <div className="flex items-center justify-center gap-6 mt-4 bg-black/40 px-6 py-2 rounded-2xl border border-white/5 shadow-inner backdrop-blur-md">
                      <div className="flex items-center gap-2">
                          <ArrowUp className={`w-4 h-4 ${safeMaxTemp !== '--' ? 'text-red-400 drop-shadow-[0_0_5px_rgba(248,113,113,0.8)]' : 'text-slate-600'}`} />
                          <span className={`text-3xl font-mono font-bold tracking-tighter tabular-nums transition-colors duration-500 ${safeMaxTemp !== '--' ? 'text-slate-100' : 'text-slate-600'}`}>
                              {safeMaxTemp}°
                          </span>
                      </div>
                      <div className="w-px h-6 bg-white/10"></div>
                      <div className="flex items-center gap-2">
                          <ArrowDown className={`w-4 h-4 ${safeMinTemp !== '--' ? 'text-cyan-400 drop-shadow-[0_0_5px_rgba(34,211,238,0.8)]' : 'text-slate-600'}`} />
                          <span className={`text-3xl font-mono font-bold tracking-tighter tabular-nums transition-colors duration-500 ${safeMinTemp !== '--' ? 'text-slate-300' : 'text-slate-600'}`}>
                              {safeMinTemp}°
                          </span>
                      </div>
                  </div>
              </div>
          </div>

          <div className="p-4 md:p-8 space-y-6 relative z-10">
            {/* GRID DE MÈTRIQUES */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
                <StatCard 
                    icon={Droplets} 
                    label={tDayDetail.precip || (typeof tRecord.precip === 'string' ? tRecord.precip : TACTICAL_I18N.colRain)} 
                    value={formattedPrecipitation.val} 
                    sub={formattedPrecipitation.unit} 
                    color="text-blue-400" 
                    glowClasses="shadow-[0_0_12px_rgba(96,165,250,0.25)] group-hover:shadow-[0_0_20px_rgba(96,165,250,0.5)]" 
                />
                <StatCard 
                    icon={Wind} 
                    label={typeof tRecord.wind === 'string' ? tRecord.wind : "VENT MÀX"} 
                    value={safeWindMax} 
                    sub={safeWindMax !== '--' ? "km/h" : ""} 
                    color="text-emerald-400" 
                    glowClasses="shadow-[0_0_12px_rgba(52,211,153,0.25)] group-hover:shadow-[0_0_20px_rgba(52,211,153,0.5)]" 
                />
                <StatCard 
                    icon={Sun} 
                    label="INDEX UV" 
                    value={safeUvMax} 
                    sub="" 
                    color="text-amber-400" 
                    glowClasses="shadow-[0_0_12px_rgba(251,191,36,0.25)] group-hover:shadow-[0_0_20px_rgba(251,191,36,0.5)]" 
                />
                <StatCard 
                    icon={Mountain} 
                    label={typeof tRecord.snowLevel === 'string' ? tRecord.snowLevel : "COTA NEU"} 
                    value={safeSnowLevel} 
                    sub={snowLevelUnit} 
                    color="text-indigo-400" 
                    glowClasses="shadow-[0_0_12px_rgba(129,140,248,0.25)] group-hover:shadow-[0_0_20px_rgba(129,140,248,0.5)]" 
                />
            </div>

            {/* CICLE SOLAR */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
                <div className="relative overflow-hidden bg-gradient-to-br from-[#0f111a]/90 to-black/80 border border-white/5 p-5 rounded-2xl flex items-center justify-between group hover:border-amber-500/30 transition-colors backdrop-blur-sm shadow-lg">
                   <div className={MATRIX_BG}></div>
                   <div className="flex items-center gap-4 relative z-10">
                      <div className="p-3 bg-black/50 rounded-xl text-amber-400 border border-amber-500/20 group-hover:shadow-[0_0_15px_rgba(251,191,36,0.3)] transition-all">
                          <Sun className="w-5 h-5"/>
                      </div>
                      <div>
                          <span className="text-[10px] text-slate-500 font-black uppercase tracking-widest">{typeof tRecord.sunrise === 'string' ? tRecord.sunrise : "SORTIDA"}</span>
                          <div className="text-2xl font-mono font-bold text-slate-200 tabular-nums">{formatTime(dayData.sunrise)}</div>
                      </div>
                   </div>
                </div>

                <div className="relative overflow-hidden bg-gradient-to-br from-[#0f111a]/90 to-black/80 border border-white/5 p-5 rounded-2xl flex items-center justify-between group hover:border-indigo-500/30 transition-colors backdrop-blur-sm shadow-lg">
                   <div className={MATRIX_BG}></div>
                   <div className="flex items-center gap-4 relative z-10">
                      <div className="p-3 bg-black/50 rounded-xl text-indigo-400 border border-indigo-500/20 group-hover:shadow-[0_0_15px_rgba(99,102,241,0.3)] transition-all">
                          <Moon className="w-5 h-5"/>
                      </div>
                      <div>
                          <span className="text-[10px] text-slate-500 font-black uppercase tracking-widest">{typeof tRecord.sunset === 'string' ? tRecord.sunset : "POSTA"}</span>
                          <div className="text-2xl font-mono font-bold text-slate-200 tabular-nums">{formatTime(dayData.sunset)}</div>
                      </div>
                   </div>
                </div>
            </div>

            {/* GRÀFIC TÈRMIC */}
            <div className="relative overflow-hidden bg-[#0a0b10] border border-white/5 rounded-3xl p-5 md:p-8 shadow-inner">
               <div className={MATRIX_BG}></div>
               <div className="relative z-10">
                   <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.25em] mb-6 flex items-center gap-2">
                      <Thermometer className="w-4 h-4 text-rose-400" /> 
                      {typeof tRecord.hourlyEvolution === 'string' ? tRecord.hourlyEvolution : "EVOLUCIÓ TÈRMICA"}
                   </h3>
                   <SmartForecastCharts 
                      data={hourlyData} 
                      comparisonData={comparisonData} 
                      unit={unit === 'F' ? '°F' : '°C'} 
                      lang={lang} 
                   />
               </div>
            </div>

            {/* TAULA TELEMÈTRICA PER HORES */}
            {tableRows && tableRows.length > 0 && (
                <div className="bg-[#0a0b10] border border-white/5 rounded-3xl overflow-hidden shadow-[inset_0_2px_10px_rgba(0,0,0,0.5)]">
                    <div className="px-6 md:px-8 py-5 border-b border-white/5 bg-[#0f111a]/90 backdrop-blur-md">
                         <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.25em] flex items-center gap-2">
                            <Clock className="w-4 h-4 text-cyan-400" /> 
                            {TACTICAL_I18N.hourlyHeader}
                        </h3>
                    </div>
                    
                    <div className="divide-y divide-white/5">
                        <div className="grid grid-cols-12 px-4 md:px-6 py-3 text-[9px] font-black uppercase tracking-widest text-slate-500 bg-black/60 shadow-inner">
                            <div className="col-span-2">{TACTICAL_I18N.colHour}</div>
                            <div className="col-span-2 text-center">{TACTICAL_I18N.colSky}</div>
                            <div className="col-span-3 text-center">{TACTICAL_I18N.colTemp}</div>
                            <div className="col-span-3 text-right">{TACTICAL_I18N.colRain}</div>
                            <div className="col-span-2 text-right">{TACTICAL_I18N.colWind}</div>
                        </div>
                        
                        {tableRows.map((row: TableRowData, idx: number) => {
                            const showPrecip = row.precipProb > 0 || row.precipSum > 0;
                            const hasTemp = row.temp !== null;
                            const hasWind = row.windSpeed !== null;
                            
                            return (
                            <div key={`row-${idx}`} className="grid grid-cols-12 px-4 md:px-6 py-4 items-center hover:bg-white/[0.02] transition-colors group">
                                {/* HORA */}
                                <div className="col-span-2 text-xs md:text-sm font-mono font-bold text-slate-400 group-hover:text-cyan-300 transition-colors">
                                    {row.hour}
                                </div>
                                
                                {/* ICONA CEL */}
                                <div className="col-span-2 flex justify-center">
                                    <div className="scale-[0.6] md:scale-75 origin-center filter drop-shadow-md group-hover:scale-90 transition-transform duration-300">
                                        {getWeatherIcon(row.code, "w-10 h-10", row.isDay, row.precipProb, row.windSpeed || 0)}
                                    </div>
                                </div>
                                
                                {/* TEMPERATURA */}
                                <div className="col-span-3 text-center text-sm md:text-base font-mono font-bold tabular-nums">
                                    {hasTemp ? (
                                        <span className="text-white">{Math.round(row.temp!)}°</span>
                                    ) : (
                                        <span className="text-slate-600">--°</span>
                                    )}
                                </div>
                                
                                {/* PLUJA */}
                                <div className="col-span-3 flex flex-col md:flex-row justify-end items-end md:items-center gap-0.5 md:gap-1.5">
                                    {showPrecip ? (
                                        <>
                                            <span className="text-[10px] md:text-[11px] font-black text-blue-400 tabular-nums">
                                                {row.precipProb}%
                                            </span>
                                            {row.precipSum > 0 && (
                                                <span className="text-[9px] text-slate-400 font-mono font-bold bg-blue-900/20 px-1.5 py-0.5 rounded border border-blue-500/20 shadow-inner">
                                                    {formatPrecipitation(row.precipSum, row.snowfall)}
                                                </span>
                                            )}
                                        </>
                                    ) : (
                                        <span className="text-slate-700 font-bold">-</span>
                                    )}
                                </div>
                                
                                {/* VENT */}
                                <div className="col-span-2 flex flex-col items-end text-xs font-mono font-bold tabular-nums transition-colors">
                                    {hasWind ? (
                                        <>
                                            <span className="text-slate-400 group-hover:text-emerald-400">{Math.round(row.windSpeed!)}</span>
                                            <span className="text-[8px] uppercase tracking-widest text-slate-600">km/h</span>
                                        </>
                                    ) : (
                                        <span className="text-slate-600 text-lg leading-none">--</span>
                                    )}
                                </div>
                            </div>
                            );
                        })}
                    </div>
                </div>
            )}
            
            <div className="h-6"></div>
          </div>
      </div>
    </div>
  );
}