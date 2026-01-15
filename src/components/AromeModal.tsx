// src/components/AromeModal.tsx
import React, { useEffect, useMemo, useRef } from 'react';
import { useArome } from '../hooks/useArome';
import { X, Wind, Droplets, Snowflake } from 'lucide-react';
import { getWeatherIcon } from './WeatherIcons';
import { Language } from '../constants/translations';

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
}

export default function AromeModal({ lat, lon, onClose }: AromeModalProps) {
  const { aromeData, loading, error, fetchArome, clearArome } = useArome();
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (lat && lon) fetchArome(lat, lon);
    return () => clearArome();
  }, [lat, lon, fetchArome, clearArome]);

  // 1. GENERACIÓ DE FILES FILTRADES I NETES
  const hourlyRows = useMemo<HourlyRow[]>(() => {
    if (!aromeData?.hourly) return [];
    
    const now = new Date();
    const todayDateStr = now.toISOString().split('T')[0];
    const nowHour = now.getHours();
    
    const rows: HourlyRow[] = [];
    const h = aromeData.hourly;

    (h.time || []).forEach((t: string, i: number) => {
      const dateStr = t.slice(0, 10); 
      const hourStr = t.slice(11, 13);
      const hour = parseInt(hourStr, 10);
      
      // Filtre temporal: No mostrar passat
      if (dateStr < todayDateStr) return;
      if (dateStr === todayDateStr && hour < nowHour) return;
      
      // MILLORA CRÍTICA: FILTRE DE VALIDESA
      // Si el model AROME no té dada de temperatura, assumim que s'ha acabat la predicció.
      // Això evita que surtin files amb valors a 0 al final de la llista.
      if (h.temperature_2m?.[i] === null || h.temperature_2m?.[i] === undefined) {
          return;
      }
      
      rows.push({
          time: t,
          hour: hour,
          date: dateStr,
          temp: h.temperature_2m[i],
          precip: h.precipitation?.[i] ?? 0,
          code: h.weather_code?.[i] ?? 0,
          wind: h.wind_speed_10m?.[i] ?? 0,
          gust: h.wind_gusts_10m?.[i] ?? 0,
          cape: h.cape?.[i] ?? 0,
          isDay: h.is_day?.[i] === 1
      });
    });
    return rows;
  }, [aromeData]);

  // 2. CÀLCULS BASATS EN LES DADES FILTRADES (Més precís)
  const maxGust = useMemo(() => {
      if (hourlyRows.length === 0) return 0;
      return Math.max(...hourlyRows.map(r => r.gust));
  }, [hourlyRows]);

  const maxCape = useMemo(() => {
      if (hourlyRows.length === 0) return 0;
      return Math.max(...hourlyRows.map(r => r.cape));
  }, [hourlyRows]);

  const totalRain = useMemo(() => {
      return hourlyRows.reduce((acc, row) => acc + row.precip, 0);
  }, [hourlyRows]);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
      <div className="bg-slate-900 border border-fuchsia-500/30 w-full max-w-2xl max-h-[90vh] overflow-hidden rounded-3xl shadow-2xl relative flex flex-col">
        
        {/* CAPÇALERA */}
        <div className="bg-slate-900/95 backdrop-blur border-b border-white/5 p-5 flex justify-between items-start shrink-0">
            <div>
                <div className="flex items-center gap-3 mb-1">
                    <span className="bg-fuchsia-600 text-white text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider">HD Live</span>
                    <h2 className="text-xl font-bold text-white tracking-tight">AROME <span className="text-fuchsia-400">1.3km</span></h2>
                </div>
                <p className="text-slate-400 text-xs md:text-sm">Detall d'alta precisió per a les properes 36-48h.</p>
            </div>
            <button onClick={onClose} className="p-2 bg-slate-800 rounded-full text-slate-400 hover:text-white transition-colors">
                <X className="w-5 h-5" />
            </button>
        </div>

        {/* LLISTA AMB SCROLL */}
        <div className="flex-1 overflow-y-auto custom-scrollbar" ref={listRef}>
            {loading && (
                <div className="flex flex-col items-center justify-center h-64 space-y-4">
                    <div className="w-10 h-10 border-4 border-fuchsia-500 border-t-transparent rounded-full animate-spin"></div>
                    <p className="text-fuchsia-300 text-sm">Sincronitzant dades MeteoFrance...</p>
                </div>
            )}

            {error && (
                <div className="p-8 text-center">
                    <p className="text-red-400 font-medium mb-4">{error}</p>
                    <button onClick={onClose} className="px-4 py-2 bg-slate-800 text-white rounded-lg text-sm">Tancar</button>
                </div>
            )}

            {aromeData && !loading && (
                <div>
                    {/* RESUM ESTATÍSTIC (Calculat sobre les dades filtrades) */}
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
                            <div className="text-[10px] uppercase text-slate-500 font-bold mb-1">Instabilitat</div>
                            <div className="text-xl font-bold text-slate-200">{Math.round(maxCape)}<span className="text-xs font-normal ml-0.5 text-slate-500">J/kg</span></div>
                         </div>
                    </div>

                    {/* LLISTAT D'HORES */}
                    <div className="divide-y divide-white/5">
                        {hourlyRows.length === 0 ? (
                            <div className="p-8 text-center text-slate-500 text-sm">
                                Dades no disponibles temporalment o fora de rang.
                            </div>
                        ) : (
                            hourlyRows.map((row, index) => {
                                const isNewDay = index > 0 && hourlyRows[index-1].date !== row.date;
                                const isRaining = row.precip > 0;
                                const isSnow = row.temp < 1.5 && isRaining;
                                
                                return (
                                    <div key={row.time}>
                                        {isNewDay && (
                                            <div className="sticky top-0 z-10 bg-slate-800 py-1 px-4 text-[10px] font-bold uppercase text-fuchsia-400 tracking-widest border-y border-white/5">
                                                Demà
                                            </div>
                                        )}
                                        <div className={`flex items-center justify-between p-4 ${isRaining ? 'bg-blue-900/10' : ''}`}>
                                            <div className="flex items-center gap-4 w-1/3">
                                                <div className="text-lg font-bold text-white">{row.hour}:00</div>
                                                {getWeatherIcon(row.code, "w-8 h-8", row.isDay)}
                                            </div>
                                            <div className="flex-1 flex justify-center items-center gap-4">
                                                <div className="text-xl font-bold text-slate-200">{Math.round(row.temp)}°</div>
                                                <div className="w-16">
                                                    {isRaining && (
                                                        <div className="flex items-center gap-1 text-blue-300 font-bold text-sm">
                                                            {isSnow ? <Snowflake className="w-3 h-3 text-white" /> : <Droplets className="w-3 h-3" />}
                                                            {row.precip.toFixed(1)}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="w-1/4 flex items-center justify-end gap-1.5 text-slate-400 font-medium">
                                                <Wind className="w-3.5 h-3.5" />
                                                {Math.round(row.wind)}
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