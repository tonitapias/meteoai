// src/components/AromeModal.tsx
import { useEffect, useMemo, useRef, useCallback } from 'react';
import { useArome } from '../hooks/useArome';
import { X, Wind, Droplets, Snowflake, Activity, Zap, AlertOctagon, ShieldCheck, Mountain, ArrowUp } from 'lucide-react';
import { getWeatherIcon } from './WeatherIcons';
import { Language } from '../translations';
import { getRealTimeWeatherCode } from '../utils/weatherLogic';
import { StrictCurrentWeather } from '../types/weatherLogicTypes';

interface AromeModalProps {
  lat: number;
  lon: number;
  onClose: () => void;
  lang?: Language;
}

interface HourlyRow {
  time: string;
  hour: number;
  date: string;
  temp: number;
  precip: number;
  code: number;
  wind: number;
  gust: number;
  windDir: number;
  cape: number;
  freezingLevel: number;
  isDay: boolean;
  cloudCover: number;
}

interface AromeHourlyData {
  time: string[];
  temperature_2m: (number | null)[];
  is_day?: (number | null)[];
  precipitation?: (number | null)[];
  cloud_cover_low?: (number | null)[];
  cloud_cover_mid?: (number | null)[];
  cloud_cover_high?: (number | null)[];
  weather_code?: (number | null)[];
  visibility?: (number | null)[];
  relative_humidity_2m?: (number | null)[];
  freezing_level_height?: (number | null)[];
  cape?: (number | null)[];
  wind_speed_10m?: (number | null)[];
  wind_gusts_10m?: (number | null)[];
  wind_direction_10m?: (number | null)[];
  [key: string]: unknown;
}

const getLocalYYYYMMDD = (d: Date) => {
    const tzOffset = d.getTimezoneOffset() * 60000;
    return new Date(d.getTime() - tzOffset).toISOString().split('T')[0];
};

// DOCTRINA RISC ZERO: Diccionari tàctic intern segur
const aromeTranslations: Record<string, Record<string, string>> = {
  ca: {
    highRes: "Alta Resolució",
    grid: "Malla 1.3km",
    elev: "ELEV",
    decoding: "Descodificant Model...",
    signalLost: "Senyal Perduda",
    closeConsole: "Tancar Consola",
    precip: "Precipitació",
    maxGust: "Ratxa Màxima",
    minIso: "Iso 0 Mín.",
    cape: "Inestabilitat",
    noData: "Matriu Sense Dades",
    today: "Avui",
    tomorrow: "Demà",
    storm: "Tempesta",
    iso0: "Iso 0",
    isoShort: "Iso"
  },
  es: {
    highRes: "Alta Resolución",
    grid: "Malla 1.3km",
    elev: "ELEV",
    decoding: "Decodificando Modelo...",
    signalLost: "Señal Perdida",
    closeConsole: "Cerrar Consola",
    precip: "Precipitación",
    maxGust: "Racha Máxima",
    minIso: "Iso 0 Mín.",
    cape: "Inestabilidad",
    noData: "Matriz Sin Datos",
    today: "Hoy",
    tomorrow: "Mañana",
    storm: "Tormenta",
    iso0: "Iso 0",
    isoShort: "Iso"
  },
  en: {
    highRes: "High Resolution",
    grid: "1.3km Grid",
    elev: "ELEV",
    decoding: "Decoding Model...",
    signalLost: "Signal Lost",
    closeConsole: "Close Console",
    precip: "Precipitation",
    maxGust: "Max Gust",
    minIso: "Min Frz Lvl",
    cape: "Instability",
    noData: "No Data Matrix",
    today: "Today",
    tomorrow: "Tomorrow",
    storm: "Storm",
    iso0: "Frz Lvl",
    isoShort: "Frz"
  },
  fr: {
    highRes: "Haute Résolution",
    grid: "Grille 1.3km",
    elev: "ELEV",
    decoding: "Décodage Modèle...",
    signalLost: "Signal Perdu",
    closeConsole: "Fermer Console",
    precip: "Précipitations",
    maxGust: "Rafale Max",
    minIso: "Iso 0 Min",
    cape: "Instabilité",
    noData: "Matrice Sans Données",
    today: "Aujourd'hui",
    tomorrow: "Demain",
    storm: "Orage",
    iso0: "Iso 0",
    isoShort: "Iso"
  }
};

const localeMap: Record<string, string> = { 
  ca: 'ca-ES', 
  es: 'es-ES', 
  en: 'en-US', 
  fr: 'fr-FR' 
};

export default function AromeModal({ lat, lon, onClose, lang = 'ca' }: AromeModalProps) {
  const { aromeData, loading, error, fetchArome, clearArome } = useArome();
  const listRef = useRef<HTMLDivElement>(null);
  
  // Garantim un fallback segur si s'introdueix un idioma no mapejat (Risc Zero)
  const safeLang = aromeTranslations[lang] ? lang : 'ca';
  const t = aromeTranslations[safeLang];
  const dateLocale = localeMap[safeLang] || 'ca-ES';
  
  // DOCTRINA RISC ZERO: Blindem la referència del tancament per evitar el parany del useEffect
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  const handleTacticalClose = useCallback(() => {
    if (window.history.state?.modalId === 'aromeLive') {
      window.history.back();
    } else {
      onCloseRef.current();
    }
  }, []);

  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, []);

  useEffect(() => {
    // Es registra l'entrada al modal de forma immutable
    window.history.pushState({ modalId: 'aromeLive' }, '');
    
    const handlePopState = () => {
      onCloseRef.current();
    };
    
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleTacticalClose();
    };
    
    window.addEventListener('popstate', handlePopState);
    window.addEventListener('keydown', handleKeyDown);

    // Array de dependències BUIT per evitar que un redibuixat del pare expulsi a l'usuari
    return () => {
      window.removeEventListener('popstate', handlePopState);
      window.removeEventListener('keydown', handleKeyDown);
      if (window.history.state?.modalId === 'aromeLive') {
        window.history.back();
      }
    };
  }, [handleTacticalClose]);

  useEffect(() => {
    if (lat && lon) fetchArome(lat, lon);
    return () => clearArome();
  }, [lat, lon, fetchArome, clearArome]);

  const hourlyRows = useMemo<HourlyRow[]>(() => {
    const hourlyRaw = aromeData?.hourly as Record<string, unknown>;
    if (!hourlyRaw || !Array.isArray(hourlyRaw.time) || hourlyRaw.time.length === 0) return [];
    
    const h = hourlyRaw as unknown as AromeHourlyData;
    const now = new Date();
    const todayDateStr = getLocalYYYYMMDD(now);
    const nowHour = now.getHours();
    
    const rows: HourlyRow[] = [];
    const timeLength = h.time.length;
    const elevation = aromeData?.elevation || 0;

    for (let i = 0; i < timeLength; i++) {
        const timeStr = h.time[i];
        if (!timeStr) continue; 

        const dateStr = timeStr.slice(0, 10);
        const hour = parseInt(timeStr.slice(11, 13), 10);

        if (dateStr < todayDateStr) continue;
        if (dateStr === todayDateStr && hour < nowHour) continue;

        const tempActual = h.temperature_2m?.[i];
        if (tempActual === null || tempActual === undefined) break;

        const isDayValue = h.is_day?.[i];
        const isDay = isDayValue !== undefined && isDayValue !== null
            ? isDayValue === 1 
            : (hour >= 7 && hour <= 21);

        const precipActual = h.precipitation?.[i] ?? 0;
        const low = h.cloud_cover_low?.[i] ?? 0;
        const mid = h.cloud_cover_mid?.[i] ?? 0;
        const high = h.cloud_cover_high?.[i] ?? 0;
        const effectiveCloudCover = Math.min(100, Math.max(0, (low * 1.0) + (mid * 0.6) + (high * 0.3)));

        let freezingLevel = h.freezing_level_height?.[i];
        if (freezingLevel === null || freezingLevel === undefined) {
            freezingLevel = Math.max(elevation, elevation + (tempActual / 0.0065));
        }

        const cape = h.cape?.[i] ?? 0;
        const wind = h.wind_speed_10m?.[i] ?? 0;
        const gust = h.wind_gusts_10m?.[i] ?? 0;
        const windDir = h.wind_direction_10m?.[i] ?? 0;

        const simulatedCurrent = {
            source: 'AROME HD',
            weather_code: h.weather_code?.[i] ?? 0, 
            temperature_2m: tempActual,
            visibility: h.visibility?.[i] ?? 10000,
            relative_humidity_2m: h.relative_humidity_2m?.[i] ?? 70,
            cloud_cover_low: low,
            cloud_cover_mid: mid,
            cloud_cover_high: high,
            cloud_cover: effectiveCloudCover,
            is_day: isDay ? 1 : 0 
        };

        const finalCode = (getRealTimeWeatherCode as (...args: unknown[]) => number)(
            simulatedCurrent as unknown as StrictCurrentWeather,
            [precipActual], 
            precipActual > 0 ? 100 : 0, 
            freezingLevel,
            elevation,
            cape
        );

        rows.push({
            time: timeStr,
            hour: hour,
            date: dateStr,
            temp: tempActual,
            precip: precipActual,
            code: finalCode,
            wind: wind,
            gust: Math.max(wind, gust),
            windDir: windDir,
            cape: cape,
            freezingLevel: freezingLevel,
            isDay: isDay, 
            cloudCover: effectiveCloudCover
        });
    }

    return rows;
  }, [aromeData]);

  const maxGust = useMemo(() => hourlyRows.length === 0 ? 0 : Math.max(...hourlyRows.map(r => r.gust)), [hourlyRows]);
  const maxCape = useMemo(() => hourlyRows.length === 0 ? 0 : Math.max(...hourlyRows.map(r => r.cape)), [hourlyRows]);
  const totalRain = useMemo(() => hourlyRows.reduce((acc, row) => acc + (row.precip > 0 ? row.precip : 0), 0), [hourlyRows]);
  const minIso = useMemo(() => hourlyRows.length === 0 ? 0 : Math.min(...hourlyRows.map(r => r.freezingLevel)), [hourlyRows]);

  const getGustColor = (gust: number) => {
    if (gust >= 90) return 'text-rose-400 drop-shadow-[0_0_8px_rgba(244,63,94,0.6)]';
    if (gust >= 50) return 'text-amber-400 drop-shadow-[0_0_6px_rgba(251,191,36,0.4)]';
    return 'text-emerald-400';
  };

  const getCapeColor = (capeValor: number) => {
    if (capeValor >= 1500) return 'text-rose-400 drop-shadow-[0_0_8px_rgba(244,63,94,0.6)]';
    if (capeValor >= 500) return 'text-amber-400 drop-shadow-[0_0_6px_rgba(251,191,36,0.4)]';
    return 'text-fuchsia-400';
  };

  const getRowDangerBg = (gust: number, capeValor: number) => {
    if (gust >= 90 || capeValor >= 1500) return 'bg-rose-950/10';
    if (gust >= 60 || capeValor >= 800) return 'bg-amber-950/10';
    return 'bg-transparent';
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 md:p-6 landscape:p-0 landscape:sm:p-4 bg-[#02040A]/95 backdrop-blur-3xl backdrop-saturate-150 animate-in fade-in duration-200">
      
      <style>
        {`
          .custom-scrollbar-spatial::-webkit-scrollbar { width: 5px; }
          @media (min-width: 768px) { .custom-scrollbar-spatial::-webkit-scrollbar { width: 6px; } }
          .custom-scrollbar-spatial::-webkit-scrollbar-track { background: transparent; }
          .custom-scrollbar-spatial::-webkit-scrollbar-thumb { background: rgba(56, 189, 248, 0.15); border-radius: 8px; }
          .custom-scrollbar-spatial::-webkit-scrollbar-thumb:hover { background: rgba(56, 189, 248, 0.4); }
        `}
      </style>

      {/* TÀCTICA DVH + LANDSCAPE + PROTECCIÓ MIN-H-0 per evitar overflow a iOS/Safari */}
      <div className="w-full h-[96dvh] sm:h-auto sm:max-h-[88dvh] landscape:h-[100dvh] landscape:max-h-[100dvh] landscape:sm:h-auto landscape:rounded-none landscape:sm:rounded-[32px] max-w-sm md:max-w-3xl lg:max-w-5xl flex flex-col min-h-0 bg-[#050810]/95 rounded-t-[24px] sm:rounded-[32px] border-t landscape:border-t-0 sm:border border-white/5 shadow-[0_0_80px_rgba(192,38,211,0.05),inset_0_1px_1px_rgba(255,255,255,0.05)] overflow-hidden transform-gpu translate-z-0 relative animate-in slide-in-from-bottom-8 sm:zoom-in-95 duration-300">
        
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[120%] h-48 bg-gradient-to-b from-fuchsia-900/10 via-cyan-900/5 to-transparent blur-[80px] pointer-events-none"></div>

        <div className="bg-transparent border-b border-white/[0.04] p-4 md:p-6 landscape:py-2 landscape:px-4 landscape:sm:py-4 flex justify-between items-center shrink-0 relative z-20">
            <div className="flex flex-col md:flex-row md:items-center gap-1.5 md:gap-5">
                <div className="flex items-center gap-3">
                    <div className="relative flex items-center justify-center bg-fuchsia-500/10 border border-fuchsia-500/30 text-fuchsia-400 text-[10px] font-black px-2.5 py-1 rounded uppercase tracking-[0.2em] shadow-[0_0_15px_rgba(192,38,211,0.15)]">
                        <span className="absolute -left-1 -top-1 flex h-2.5 w-2.5">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-fuchsia-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-fuchsia-500"></span>
                        </span>
                        AROME
                    </div>
                    <div className="flex flex-col">
                        <h2 className="text-xl md:text-2xl font-black text-white tracking-tighter drop-shadow-sm flex items-center gap-2 leading-none">
                            {t.highRes}
                        </h2>
                        <span className="text-[10px] md:text-xs text-slate-500 font-medium tracking-widest uppercase mt-0.5">
                            {t.grid} <span className="text-cyan-500/50 mx-1">•</span> {t.elev}: {Math.round(aromeData?.elevation || 0)}m
                        </span>
                    </div>
                </div>
            </div>
            
            <button onClick={handleTacticalClose} className="p-2.5 bg-white/[0.03] border border-white/5 rounded-full text-slate-400 hover:bg-white/10 hover:text-white active:scale-90 transition-all duration-200 group relative">
                <X className="w-5 h-5 group-hover:rotate-90 transition-transform duration-300" />
                <span className="absolute -bottom-8 left-1/2 -translate-x-1/2 text-[10px] font-mono text-slate-500 opacity-0 group-hover:opacity-100 hidden md:block transition-opacity">ESC</span>
            </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain custom-scrollbar-spatial relative z-10" ref={listRef}>
            {loading && (
                <div className="flex flex-col items-center justify-center h-[60dvh] space-y-6">
                    <div className="relative w-16 h-16 flex items-center justify-center">
                        <div className="absolute inset-0 border-[3px] border-cyan-900/20 rounded-full"></div>
                        <div className="absolute inset-0 border-[3px] border-cyan-500 border-t-transparent border-l-transparent rounded-full animate-spin"></div>
                        <Activity className="w-6 h-6 text-cyan-400 animate-pulse" />
                    </div>
                    <p className="text-cyan-400/80 text-[10px] md:text-xs font-mono tracking-widest uppercase animate-pulse">{t.decoding}</p>
                </div>
            )}

            {error && (
                <div className="p-10 text-center flex flex-col items-center justify-center h-[60dvh]">
                    <div className="w-20 h-20 rounded-full bg-rose-950/30 border border-rose-900/50 flex items-center justify-center mb-5 relative">
                        <div className="absolute inset-0 rounded-full border border-rose-500/20 animate-ping"></div>
                        <AlertOctagon className="w-10 h-10 text-rose-500 drop-shadow-[0_0_12px_rgba(244,63,94,0.4)]" />
                    </div>
                    <p className="text-white text-xl font-black mb-2 tracking-tight">{t.signalLost}</p>
                    <p className="text-slate-400 text-xs sm:text-sm font-mono mb-8 max-w-md">{error}</p>
                    <button onClick={handleTacticalClose} className="px-8 py-3 bg-white/5 border border-white/10 hover:bg-white/10 text-white rounded-xl text-xs font-bold uppercase tracking-widest transition-all active:scale-95 shadow-sm">{t.closeConsole}</button>
                </div>
            )}

            {aromeData && !loading && (
                <div className="animate-in fade-in duration-500 flex flex-col">
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-4 p-3 md:p-6 landscape:p-2 landscape:px-4 landscape:sm:p-6 bg-[#050810]/80 border-b border-white/[0.02] sticky top-0 z-30 backdrop-blur-2xl">
                         <div className="flex flex-col p-2.5 sm:p-3 md:p-4 rounded-xl sm:rounded-2xl bg-cyan-950/10 border border-cyan-900/20 shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)] relative overflow-hidden group">
                            <div className="flex items-center gap-1.5 md:gap-2 mb-1.5 md:mb-2">
                                <div className="p-1 sm:p-1.5 rounded-lg bg-cyan-900/30 text-cyan-400 group-hover:bg-cyan-500/20 transition-colors">
                                    <Droplets className="w-3 h-3 sm:w-3.5 sm:h-3.5 md:w-4 md:h-4" />
                                </div>
                                <span className="text-[8px] md:text-[10px] uppercase text-slate-400 font-bold tracking-widest">{t.precip}</span>
                            </div>
                            <div className="text-xl sm:text-2xl md:text-3xl font-black text-white tracking-tighter">
                                {totalRain.toFixed(1)}<span className="text-[9px] md:text-xs font-bold ml-1 text-cyan-500/80">mm</span>
                            </div>
                         </div>
                         
                         <div className="flex flex-col p-2.5 sm:p-3 md:p-4 rounded-xl sm:rounded-2xl bg-white/[0.02] border border-white/[0.04] shadow-[inset_0_1px_1px_rgba(255,255,255,0.02)] relative overflow-hidden group">
                            <div className="flex items-center gap-1.5 md:gap-2 mb-1.5 md:mb-2">
                                <div className="p-1 sm:p-1.5 rounded-lg bg-white/5 text-slate-400 group-hover:bg-white/10 transition-colors">
                                    <Wind className="w-3 h-3 sm:w-3.5 sm:h-3.5 md:w-4 md:h-4" />
                                </div>
                                <span className="text-[8px] md:text-[10px] uppercase text-slate-400 font-bold tracking-widest">{t.maxGust}</span>
                            </div>
                            <div className={`text-xl sm:text-2xl md:text-3xl font-black tracking-tighter ${getGustColor(maxGust)}`}>
                                {Math.round(maxGust)}<span className="text-[9px] md:text-xs font-bold ml-1 opacity-50 text-white">km/h</span>
                            </div>
                         </div>

                         <div className="flex flex-col p-2.5 sm:p-3 md:p-4 rounded-xl sm:rounded-2xl bg-white/[0.02] border border-white/[0.04] shadow-[inset_0_1px_1px_rgba(255,255,255,0.02)] relative overflow-hidden group">
                            <div className="flex items-center gap-1.5 md:gap-2 mb-1.5 md:mb-2">
                                <div className="p-1 sm:p-1.5 rounded-lg bg-white/5 text-slate-400 group-hover:bg-white/10 transition-colors">
                                    <Mountain className="w-3 h-3 sm:w-3.5 sm:h-3.5 md:w-4 md:h-4" />
                                </div>
                                <span className="text-[8px] md:text-[10px] uppercase text-slate-400 font-bold tracking-widest">{t.minIso}</span>
                            </div>
                            <div className="text-xl sm:text-2xl md:text-3xl font-black text-slate-200 tracking-tighter">
                                {Math.round(minIso)}<span className="text-[9px] md:text-xs font-bold ml-1 text-slate-500">m</span>
                            </div>
                         </div>
                         
                         <div className="flex flex-col p-2.5 sm:p-3 md:p-4 rounded-xl sm:rounded-2xl bg-white/[0.02] border border-white/[0.04] shadow-[inset_0_1px_1px_rgba(255,255,255,0.02)] relative overflow-hidden group">
                            <div className="flex items-center gap-1.5 md:gap-2 mb-1.5 md:mb-2">
                                <div className="p-1 sm:p-1.5 rounded-lg bg-white/5 text-slate-400 group-hover:bg-white/10 transition-colors">
                                    <Zap className={`w-3 h-3 sm:w-3.5 sm:h-3.5 md:w-4 md:h-4 ${maxCape > 500 ? 'text-amber-400' : ''}`} />
                                </div>
                                <span className="text-[8px] md:text-[10px] uppercase text-slate-400 font-bold tracking-widest">{t.cape}</span>
                            </div>
                            <div className={`text-xl sm:text-2xl md:text-3xl font-black tracking-tighter ${getCapeColor(maxCape)}`}>
                                {Math.round(maxCape)}<span className="text-[9px] md:text-xs font-bold ml-1 opacity-50 text-white">J/kg</span>
                            </div>
                         </div>
                    </div>

                    <div className="flex flex-col pb-6 md:pb-10">
                        {hourlyRows.length === 0 ? (
                            <div className="p-20 text-center flex flex-col items-center">
                                <ShieldCheck className="w-10 h-10 text-slate-700/50 mb-4" />
                                <span className="text-slate-500 text-xs md:text-sm font-mono uppercase tracking-widest">{t.noData}</span>
                            </div>
                        ) : (
                            hourlyRows.map((row, index) => {
                                const isNewDay = index === 0 || (index > 0 && hourlyRows[index-1].date !== row.date);
                                const isRaining = row.precip >= 0.05; 
                                const isSnow = (row.code >= 71 && row.code <= 77) || row.code === 85 || row.code === 86;
                                const stormRisk = row.cape > 1000;
                                
                                const maxWindScale = 120;
                                const windWidth = Math.min(100, (row.wind / maxWindScale) * 100);
                                const gustWidth = Math.min(100 - windWidth, Math.max(0, ((row.gust - row.wind) / maxWindScale) * 100));

                                return (
                                    <div key={row.time}>
                                        {isNewDay && (
                                            <div className="bg-[#050810]/95 py-2 md:py-3 px-4 sm:px-6 text-[10px] md:text-xs font-black uppercase text-cyan-500/80 tracking-[0.2em] border-y border-white/[0.04] flex items-center gap-3 sticky top-[95px] sm:top-[120px] md:top-[150px] z-20 backdrop-blur-xl shadow-[0_4px_20px_rgba(0,0,0,0.5)]">
                                                <div className="w-1.5 h-1.5 rounded-full bg-cyan-500 shadow-[0_0_8px_rgba(6,182,212,0.8)]"></div>
                                                {(() => {
                                                    const today = getLocalYYYYMMDD(new Date());
                                                    const tomorrowDate = new Date();
                                                    tomorrowDate.setDate(tomorrowDate.getDate() + 1);
                                                    const tomorrowStr = getLocalYYYYMMDD(tomorrowDate);
                                                    
                                                    if (row.date === today) return t.today;
                                                    if (row.date === tomorrowStr) return t.tomorrow;
                                                    
                                                    // Es defineix l'idioma correctament segons el `safeLang`
                                                    return new Intl.DateTimeFormat(dateLocale, { weekday: 'long', day: 'numeric', month: 'short' }).format(new Date(row.date + 'T12:00:00'));
                                                })()}
                                            </div>
                                        )}
                                        
                                        <div className={`flex items-center justify-between p-3.5 sm:p-4 px-4 sm:px-6 border-b border-white/[0.02] transition-colors ${getRowDangerBg(row.gust, row.cape)} ${isRaining ? 'bg-cyan-900/[0.03]' : ''} hover:bg-white/[0.03] group`}>
                                            
                                            <div className="flex items-center gap-3 sm:gap-4 w-[25%] md:w-1/4">
                                                <div className="flex flex-col">
                                                    <div className="text-sm sm:text-base md:text-lg font-bold text-slate-300 tabular-nums tracking-tighter">
                                                        {String(row.hour).padStart(2, '0')}<span className="text-[9px] md:text-[10px] text-slate-600 font-bold ml-[1px]">:00</span>
                                                    </div>
                                                    {stormRisk && (
                                                        <div className="flex items-center gap-1 mt-0.5 text-rose-400">
                                                            <Zap className="w-2.5 h-2.5 fill-current" />
                                                            <span className="text-[8px] font-black uppercase tracking-wider hidden sm:inline">{t.storm}</span>
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="filter drop-shadow-xl shrink-0 w-8 h-8 md:w-11 md:h-11 flex items-center justify-center">
                                                    {getWeatherIcon(row.code, "w-full h-full", row.isDay, row.precip > 0 ? 90 : 0, row.wind)}
                                                </div>
                                            </div>

                                            {/* DOCTRINA RISC ZERO: Iso 0 integrat de forma vertical per a mòbil */}
                                            <div className="flex-1 flex flex-col sm:flex-row sm:justify-center items-end sm:items-center gap-1 sm:gap-6 pr-4 sm:pr-0">
                                                <div className="flex items-center gap-4">
                                                    <div className="flex flex-col items-end sm:items-center">
                                                        <div className="text-xl sm:text-2xl md:text-3xl font-black text-white tabular-nums tracking-tighter drop-shadow-sm w-12 sm:w-14 text-right sm:text-center">
                                                            {Math.round(row.temp)}<span className="text-xs md:text-sm text-slate-500 font-bold ml-[1px]">°</span>
                                                        </div>
                                                        
                                                        <div className="flex md:hidden items-center gap-1 mt-[-2px]">
                                                            <span className="text-[7px] text-slate-500 font-mono uppercase tracking-widest">{t.isoShort}</span>
                                                            <span className="text-[9px] font-bold text-slate-300 tabular-nums">{Math.round(row.freezingLevel)}</span>
                                                        </div>
                                                    </div>
                                                    
                                                    <div className="hidden md:flex flex-col items-center justify-center w-14">
                                                        <span className="text-[8px] text-slate-500 font-mono mb-0.5 uppercase">{t.iso0}</span>
                                                        <span className="text-xs font-bold text-slate-300 tabular-nums">{Math.round(row.freezingLevel)}</span>
                                                    </div>
                                                </div>

                                                <div className="w-[45px] sm:w-[65px] flex justify-end sm:justify-start">
                                                    {row.precip > 0 ? (
                                                        <div className="flex items-center gap-1.5 text-cyan-100 font-bold text-[10px] sm:text-xs bg-cyan-950/40 px-2 sm:px-2.5 py-1 rounded-md border border-cyan-500/20 shadow-[inset_0_1px_2px_rgba(6,182,212,0.1)] relative overflow-hidden">
                                                            <div className="absolute bottom-0 left-0 w-full bg-cyan-500/20" style={{ height: `${Math.min(100, (row.precip / 10) * 100)}%` }}></div>
                                                            {isSnow ? <Snowflake className="w-3 h-3 text-cyan-300 relative z-10" /> : <Droplets className="w-3 h-3 text-cyan-400 relative z-10" />}
                                                            <span className="relative z-10">{row.precip.toFixed(1)}</span>
                                                        </div>
                                                    ) : (
                                                        <span className="text-[10px] font-mono text-slate-700/30">-</span>
                                                    )}
                                                </div>
                                            </div>

                                            <div className="w-[30%] sm:w-1/4 flex flex-col items-end justify-center">
                                                <div className="flex items-center justify-end gap-1.5 md:gap-2 text-sm md:text-base font-bold text-slate-200 tabular-nums">
                                                    <ArrowUp 
                                                        className="w-3 h-3 md:w-3.5 md:h-3.5 text-cyan-500/60" 
                                                        style={{ transform: `rotate(${row.windDir + 180}deg)` }} 
                                                    />
                                                    <span className={getGustColor(row.wind)}>{Math.round(row.wind)}</span>
                                                    {row.gust > row.wind + 5 && (
                                                        <span className={`text-[10px] md:text-xs font-black ${getGustColor(row.gust)}`}>
                                                            {Math.round(row.gust)}
                                                        </span>
                                                    )}
                                                </div>
                                                
                                                <div className="w-14 sm:w-24 h-1.5 bg-black/40 rounded-full mt-1.5 flex overflow-hidden shadow-[inset_0_1px_2px_rgba(0,0,0,0.5)]">
                                                    <div className="h-full bg-slate-500/80 rounded-l-full transition-all" style={{ width: `${windWidth}%` }}></div>
                                                    {row.gust > row.wind && (
                                                        <div className={`h-full transition-all ${row.gust >= 90 ? 'bg-rose-500' : row.gust >= 60 ? 'bg-amber-500' : 'bg-emerald-500/80'}`} style={{ width: `${gustWidth}%` }}></div>
                                                    )}
                                                </div>
                                            </div>
                                            
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>
            )}
        </div>
      </div>
    </div>
  );
}