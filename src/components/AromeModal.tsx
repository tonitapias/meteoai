// src/components/AromeModal.tsx
import React, { useEffect, useMemo, useRef } from 'react';
import { useArome } from '../hooks/useArome';
import { X, Wind, Droplets, Snowflake } from 'lucide-react';
import { getWeatherIcon } from './WeatherIcons';
import { Language } from '../constants/translations';
import { getRealTimeWeatherCode } from '../utils/weatherLogic';

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

export default function AromeModal({ lat, lon, onClose }: AromeModalProps) {
  const { aromeData, loading, error, fetchArome, clearArome } = useArome();
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (lat && lon) fetchArome(lat, lon);
    return () => clearArome();
  }, [lat, lon, fetchArome, clearArome]);

  const hourlyRows = useMemo<HourlyRow[]>(() => {
    if (!aromeData?.hourly || !aromeData.hourly.time) return [];
    
    const h = aromeData.hourly;
    const now = new Date();
    const todayDateStr = now.toISOString().split('T')[0];
    const nowHour = now.getHours();
    
    const rows: HourlyRow[] = [];
    const timeLength = h.time.length;

    // BUCLE ESTRICTE PER GESTIÓ DE FINAL DE MODEL
    for (let i = 0; i < timeLength; i++) {
        const t = h.time[i];
        const dateStr = t.slice(0, 10);
        const hour = parseInt(t.slice(11, 13), 10);

        // 1. Ignorar el passat
        if (dateStr < todayDateStr) continue;
        if (dateStr === todayDateStr && hour < nowHour) continue;

        // 2. TALL DE SEGURETAT (Fix Cobertura)
        // Si la temperatura és null, el model AROME s'ha acabat (aprox 42h).
        // Aturem el bucle immediatament.
        if (h.temperature_2m?.[i] === null || h.temperature_2m?.[i] === undefined) {
            break; 
        }

        // 3. PREPARACIÓ DADES FÍSIQUES
        const simulatedCurrent = {
            weather_code: h.weather_code?.[i],
            temperature_2m: h.temperature_2m[i],
            visibility: h.visibility?.[i] ?? 10000,
            relative_humidity_2m: h.relative_humidity_2m?.[i] ?? 70,
            // PAS CRÍTIC: Passem la cobertura de núvols al motor lògic
            cloud_cover: h.cloud_cover?.[i] ?? 0 
        };

        const precip = h.precipitation?.[i] ?? 0;
        const freezingLevel = h.freezing_level_height?.[i] ?? 2500;
        const elevation = aromeData.elevation || 0;

        // 4. CÀLCUL D'ICONA (Motor Centralitzat)
        const finalCode = getRealTimeWeatherCode(
            simulatedCurrent,
            [precip], 
            0,        
            freezingLevel,
            elevation
        );

        rows.push({
            time: t,
            hour: hour,
            date: dateStr,
            temp: h.temperature_2m[i],
            precip: precip,
            code: finalCode,
            wind: h.wind_speed_10m?.[i] ?? 0,
            gust: h.wind_gusts_10m?.[i] ?? 0,
            cape: h.cape?.[i] ?? 0,
            isDay: h.is_day?.[i] === 1,
            cloudCover: h.cloud_cover?.[i] ?? 0
        });
    }

    return rows;
  }, [aromeData]);

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
                <p className="text-slate-400 text-xs md:text-sm">Previsió d'alta resolució (Precisió Física)</p>
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
                    
                    {/* RESUM DE MÈTRIQUES */}
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
                            <div className={`text-xl font-bold ${maxCape > 500 ? 'text-amber-400' : 'text-slate-200'}`}>{Math.round(maxCape)}</div>
                         </div>
                    </div>

                    {/* FILES HORÀRIES */}
                    <div className="divide-y divide-white/5">
                        {hourlyRows.length === 0 ? (
                            <div className="p-10 text-center text-slate-500 text-sm">
                                Final de la previsió d'alta resolució.
                            </div>
                        ) : (
                            hourlyRows.map((row, index) => {
                                const isNewDay = index > 0 && hourlyRows[index-1].date !== row.date;
                                const isRaining = row.precip > 0.1;
                                const isSnow = (row.code >= 71 && row.code <= 77) || row.code === 85 || row.code === 86;
                                
                                return (
                                    <div key={row.time}>
                                        {isNewDay && (
                                            <div className="sticky top-0 z-10 bg-slate-800/95 backdrop-blur py-1.5 px-5 text-[10px] font-bold uppercase text-fuchsia-400 tracking-widest border-y border-white/5 shadow-sm">
                                                Demà
                                            </div>
                                        )}
                                        <div className={`flex items-center justify-between p-4 px-5 ${isRaining ? 'bg-blue-900/10' : 'hover:bg-white/5'} transition-colors group`}>
                                            
                                            {/* HORA I ICONA */}
                                            <div className="flex items-center gap-4 w-1/3">
                                                <div className="text-lg font-bold text-white tabular-nums">{row.hour}:00</div>
                                                <div className="filter drop-shadow-md">
                                                    {getWeatherIcon(row.code, "w-9 h-9", row.isDay)}
                                                </div>
                                            </div>

                                            {/* TEMPERATURA I PLUJA */}
                                            <div className="flex-1 flex justify-center items-center gap-6">
                                                <div className="text-2xl font-bold text-slate-200 tabular-nums">{Math.round(row.temp)}°</div>
                                                <div className="w-16 flex justify-start">
                                                    {isRaining && (
                                                        <div className="flex items-center gap-1.5 text-blue-300 font-bold text-sm bg-blue-500/10 px-2 py-0.5 rounded-full border border-blue-500/20">
                                                            {isSnow ? <Snowflake className="w-3.5 h-3.5" /> : <Droplets className="w-3.5 h-3.5" />}
                                                            {row.precip.toFixed(1)}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            {/* VENT */}
                                            <div className="w-1/3 flex items-center justify-end gap-2 text-slate-400 font-medium">
                                                <div className="flex flex-col items-end">
                                                    <span className="flex items-center gap-1.5">
                                                        <Wind className="w-3.5 h-3.5" />
                                                        {Math.round(row.wind)}
                                                    </span>
                                                    {row.gust > row.wind + 10 && (
                                                        <span className="text-[10px] text-slate-500">
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