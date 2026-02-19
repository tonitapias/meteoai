// src/components/AromeModal.tsx
import { useEffect, useMemo, useRef } from 'react';
import { useArome } from '../hooks/useArome';
import { X, Wind, Droplets, Snowflake } from 'lucide-react';
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
  cape: number;
  isDay: boolean;
  cloudCover: number;
}

interface AromeHourlyData {
  time: string[];
  temperature_2m: number[];
  is_day?: number[];
  precipitation?: number[];
  cloud_cover_low?: number[];
  cloud_cover_mid?: number[];
  cloud_cover_high?: number[];
  weather_code?: number[];
  visibility?: number[];
  relative_humidity_2m?: number[];
  freezing_level_height?: number[];
  cape?: number[];
  wind_speed_10m?: number[];
  wind_gusts_10m?: number[];
  [key: string]: unknown;
}

export default function AromeModal({ lat, lon, onClose }: AromeModalProps) {
  const { aromeData, loading, error, fetchArome, clearArome } = useArome();
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (lat && lon) fetchArome(lat, lon);
    return () => clearArome();
  }, [lat, lon, fetchArome, clearArome]);

  const hourlyRows = useMemo<HourlyRow[]>(() => {
    const hourlyRaw = aromeData?.hourly as Record<string, unknown>;
    if (!hourlyRaw || !hourlyRaw.time) return [];
    
    const h = hourlyRaw as unknown as AromeHourlyData;
    const now = new Date();
    const todayDateStr = now.toISOString().split('T')[0];
    const nowHour = now.getHours();
    
    const rows: HourlyRow[] = [];
    const timeLength = h.time.length;

    for (let i = 0; i < timeLength; i++) {
        const t = h.time[i];
        const dateStr = t.slice(0, 10);
        const hour = parseInt(t.slice(11, 13), 10);

        // 1. Ignorar el passat
        if (dateStr < todayDateStr) continue;
        if (dateStr === todayDateStr && hour < nowHour) continue;

        // 2. TALL DE SEGURETAT DE DADES
        if (h.temperature_2m?.[i] === null || h.temperature_2m?.[i] === undefined) {
            break; 
        }

        // --- CÀLCUL MANUAL DE 'isDay' ---
        const isDay = h.is_day?.[i] !== undefined 
            ? h.is_day[i] === 1 
            : (hour >= 7 && hour <= 21);

        const precipActual = h.precipitation?.[i] ?? 0;
        
        // --- PONDERACIÓ DE CAPES (Calibrat amb weatherLogic) ---
        const low = h.cloud_cover_low?.[i] ?? 0;
        const mid = h.cloud_cover_mid?.[i] ?? 0;
        const high = h.cloud_cover_high?.[i] ?? 0;
        
        // Pesos físics actualitzats: més importància als alts per coherència visual
        const effectiveCloudCover = Math.min(100, (low * 1.0) + (mid * 0.6) + (high * 0.3));

        // 3. PREPARACIÓ CONTEXTUAL PER AL MOTOR LÒGIC
        const simulatedCurrent = {
            source: 'AROME HD',
            weather_code: h.weather_code?.[i], 
            temperature_2m: h.temperature_2m[i],
            visibility: h.visibility?.[i] ?? 10000,
            relative_humidity_2m: h.relative_humidity_2m?.[i] ?? 70,
            cloud_cover_low: low,
            cloud_cover_mid: mid,
            cloud_cover_high: high,
            cloud_cover: effectiveCloudCover,
            is_day: isDay ? 1 : 0 
        };

        const freezingLevel = h.freezing_level_height?.[i] ?? 2500;
        const elevation = aromeData?.elevation || 0;
        const cape = h.cape?.[i] ?? 0;

        // 4. CÀLCUL D'ICONA CENTRALITZAT
        // SOLUCIÓ LOOK-AHEAD: Passem només [precipActual] per evitar que l'hora actual 
        // mostri la tempesta de l'hora següent.
        // Tàctica Risc Zero: Emmascarem la signatura de la funció només a l'espai TS.
        const finalCode = (getRealTimeWeatherCode as (...args: unknown[]) => number)(
            simulatedCurrent as unknown as StrictCurrentWeather,
            [precipActual], 
            precipActual > 0 ? 100 : 0, 
            freezingLevel,
            elevation,
            cape
        );

        rows.push({
            time: t,
            hour: hour,
            date: dateStr,
            temp: h.temperature_2m[i],
            precip: precipActual,
            code: finalCode,
            wind: h.wind_speed_10m?.[i] ?? 0,
            gust: h.wind_gusts_10m?.[i] ?? 0,
            cape: cape,
            isDay: isDay, 
            cloudCover: effectiveCloudCover
        });
    }

    return rows;
  }, [aromeData]);

  // Càlculs de resum
  const maxGust = useMemo(() => hourlyRows.length === 0 ? 0 : Math.max(...hourlyRows.map(r => r.gust)), [hourlyRows]);
  const maxCape = useMemo(() => hourlyRows.length === 0 ? 0 : Math.max(...hourlyRows.map(r => r.cape)), [hourlyRows]);
  const totalRain = useMemo(() => hourlyRows.reduce((acc, row) => acc + row.precip, 0), [hourlyRows]);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-300">
      <div className="bg-slate-900 border border-fuchsia-500/30 w-full max-w-2xl max-h-[90vh] overflow-hidden rounded-3xl shadow-2xl relative flex flex-col">
        
        {/* CAPÇALERA */}
        <div className="bg-slate-900/95 backdrop-blur border-b border-white/5 p-5 flex justify-between items-start shrink-0">
            <div>
                <div className="flex items-center gap-3 mb-1">
                    <span className="bg-fuchsia-600 text-white text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider shadow-[0_0_10px_rgba(192,38,211,0.4)]">HD Live</span>
                    <h2 className="text-xl font-bold text-white tracking-tight">AROME <span className="text-fuchsia-400">1.3km</span></h2>
                </div>
                <p className="text-slate-400 text-xs md:text-sm">Previsió d&apos;alta resolució (Precisió Física)</p>
            </div>
            <button onClick={onClose} className="p-2 bg-slate-800 rounded-full text-slate-400 hover:text-white transition-colors active:scale-95">
                <X className="w-5 h-5" />
            </button>
        </div>

        {/* LLISTA AMB SCROLL */}
        <div className="flex-1 overflow-y-auto custom-scrollbar" ref={listRef}>
            {loading && (
                <div className="flex flex-col items-center justify-center h-64 space-y-4">
                    <div className="w-10 h-10 border-4 border-fuchsia-500 border-t-transparent rounded-full animate-spin"></div>
                    <p className="text-fuchsia-300 text-sm animate-pulse">Calculant física atmosfèrica...</p>
                </div>
            )}

            {error && (
                <div className="p-10 text-center">
                    <p className="text-rose-400 font-bold mb-2">Error de dades</p>
                    <p className="text-slate-400 text-sm mb-4">{error}</p>
                    <button onClick={onClose} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-sm transition-colors">Tancar</button>
                </div>
            )}

            {aromeData && !loading && (
                <div className="animate-in slide-in-from-bottom-4 duration-500">
                    
                    {/* RESUM DE DADES */}
                    <div className="grid grid-cols-3 gap-2 p-4 bg-slate-800/30 border-b border-white/5">
                         <div className="text-center">
                            <div className="text-[10px] uppercase text-slate-500 font-bold mb-1">Precip. Total</div>
                            <div className="text-xl font-bold text-blue-200">{totalRain.toFixed(1)}<span className="text-xs font-normal ml-0.5 text-slate-500">mm</span></div>
                         </div>
                         <div className="text-center border-l border-white/5">
                            <div className="text-[10px] uppercase text-slate-500 font-bold mb-1">Ràfega Màx</div>
                            <div className="text-xl font-bold text-slate-200">{Math.round(maxGust)}<span className="text-xs font-normal ml-0.5 text-slate-500">km/h</span></div>
                         </div>
                         <div className="text-center border-l border-white/5">
                            <div className="text-[10px] uppercase text-slate-500 font-bold mb-1">Inestabilitat</div>
                            <div className={`text-xl font-bold ${maxCape > 1500 ? 'text-rose-500' : maxCape > 800 ? 'text-amber-400' : 'text-slate-200'}`}>
                                {Math.round(maxCape)}
                                <span className="text-[9px] font-normal ml-1 text-slate-500">J/kg</span>
                            </div>
                         </div>
                    </div>

                    <div className="divide-y divide-white/5">
                        {hourlyRows.length === 0 ? (
                            <div className="p-10 text-center text-slate-500 text-sm">
                                Final de la Previsió d&apos;alta resolució.
                            </div>
                        ) : (
                            hourlyRows.map((row, index) => {
                                const isNewDay = index === 0 || (index > 0 && hourlyRows[index-1].date !== row.date);
                                
                                // Ús de TRACE (0.1) o un valor visual (0.05) per destacar la fila
                                const isRaining = row.precip >= 0.05; 
                                const isSnow = (row.code >= 71 && row.code <= 77) || row.code === 85 || row.code === 86;
                                
                                return (
                                    <div key={row.time}>
                                        {isNewDay && (
                                            <div className="sticky top-0 z-10 bg-slate-800/95 backdrop-blur py-1.5 px-5 text-[10px] font-bold uppercase text-fuchsia-400 tracking-widest border-y border-white/5 shadow-sm">
                                                {(() => {
                                                    const today = new Date().toISOString().split('T')[0];
                                                    const tomorrowDate = new Date();
                                                    tomorrowDate.setDate(tomorrowDate.getDate() + 1);
                                                    const tomorrowStr = tomorrowDate.toISOString().split('T')[0];
                                                    
                                                    if (row.date === today) return "Avui";
                                                    if (row.date === tomorrowStr) return "Demà";
                                                    
                                                    const dayName = new Intl.DateTimeFormat('ca-ES', { weekday: 'long' }).format(new Date(row.date + 'T12:00:00'));
                                                    return dayName.charAt(0).toUpperCase() + dayName.slice(1);
                                                })()}
                                            </div>
                                        )}
                                        <div className={`flex items-center justify-between p-4 px-3 sm:px-5 ${isRaining ? 'bg-blue-900/10' : 'hover:bg-white/5'} transition-colors group`}>
                                            <div className="flex items-center gap-2 sm:gap-4 w-[28%] sm:w-1/3">
                                                <div className="text-base sm:text-lg font-bold text-white tabular-nums">{row.hour}:00</div>
                                                <div className="filter drop-shadow-md shrink-0">
                                                    {getWeatherIcon(row.code, "w-8 h-8 sm:w-9 sm:h-9", row.isDay, row.precip > 0 ? 90 : 0, row.wind)}
                                                </div>
                                            </div>

                                            <div className="flex-1 flex justify-center items-center gap-2 sm:gap-6 px-1">
                                                <div className="text-xl sm:text-2xl font-bold text-slate-200 tabular-nums">{Math.round(row.temp)}°</div>
                                                <div className="min-w-[45px] sm:w-16 flex justify-start">
                                                    {row.precip > 0 && (
                                                        <div className="flex items-center gap-1 text-blue-300 font-bold text-[10px] sm:text-sm bg-blue-500/10 px-1.5 sm:px-2 py-0.5 rounded-full border border-blue-500/20">
                                                            {isSnow ? <Snowflake className="w-3 h-3 sm:w-3.5 sm:h-3.5" /> : <Droplets className="w-3 h-3 sm:w-3.5 sm:h-3.5" />}
                                                            {row.precip.toFixed(1)}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            <div className="w-[28%] sm:w-1/3 flex items-center justify-end gap-2 text-slate-400 font-medium">
                                                <div className="flex flex-col items-end">
                                                    <span className="flex items-center gap-1 sm:gap-1.5 text-xs sm:text-base">
                                                        <Wind className="w-3 sm:w-3.5 h-3 sm:h-3.5" />
                                                        {Math.round(row.wind)}
                                                    </span>
                                                    {/* Només mostrem ràfega si és significativament superior al vent mitjà (> +10km/h) */}
                                                    {row.gust > row.wind + 10 && (
                                                        <span className="text-[9px] sm:text-[10px] text-slate-500">
                                                            r. {Math.round(row.gust)}
                                                        </span>
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