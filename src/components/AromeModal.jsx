// src/components/AromeModal.jsx
import React, { useEffect, useMemo, useRef } from 'react';
import { useArome } from '../hooks/useArome';
import { X, Zap, Wind, CloudRain, Clock, Droplets } from 'lucide-react';
import { getWeatherIcon } from './WeatherIcons';

export default function AromeModal({ lat, lon, onClose, lang = 'ca' }) {
  const { aromeData, loading, error, fetchArome, clearArome } = useArome();
  const listRef = useRef(null);

  useEffect(() => {
    if (lat && lon) fetchArome(lat, lon);
    return () => clearArome();
  }, [lat, lon, fetchArome, clearArome]);

  const hourlyRows = useMemo(() => {
    if (!aromeData) return [];
    
    const now = new Date();
    const localYear = now.getFullYear();
    const localMonth = String(now.getMonth() + 1).padStart(2, '0');
    const localDay = String(now.getDate()).padStart(2, '0');
    const todayDateStr = `${localYear}-${localMonth}-${localDay}`;
    const nowHour = now.getHours();
    
    const rows = [];
    const { time, temperature_2m, precipitation, weather_code, wind_speed_10m, wind_gusts_10m, cape, is_day } = aromeData.hourly;

    time.forEach((t, i) => {
      const dateStr = t.slice(0, 10); 
      const hourStr = t.slice(11, 13);
      const hour = parseInt(hourStr, 10);
      
      if (dateStr < todayDateStr) return;
      if (dateStr === todayDateStr && hour < nowHour) return;
      
      rows.push({
          time: t,
          hour: hour,
          date: dateStr,
          temp: temperature_2m[i],
          precip: precipitation[i],
          code: weather_code[i],
          wind: wind_speed_10m[i],
          gust: wind_gusts_10m[i],
          cape: cape ? cape[i] : 0,
          isDay: is_day[i] === 1
      });
    });
    return rows;
  }, [aromeData]);

  const maxGust = aromeData ? Math.max(...aromeData.hourly.wind_gusts_10m) : 0;
  const maxCape = aromeData ? Math.max(...aromeData.hourly.cape) : 0;
  const totalRain = aromeData ? aromeData.hourly.precipitation.reduce((a, b) => a + b, 0) : 0;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-300">
      <div className="bg-slate-900 border border-fuchsia-500/30 w-full max-w-2xl max-h-[90vh] overflow-hidden rounded-3xl shadow-2xl relative flex flex-col">
        
        <div className="bg-slate-900/95 backdrop-blur border-b border-white/5 p-5 flex justify-between items-start z-20 shrink-0">
            <div>
                <div className="flex items-center gap-3 mb-1">
                    <span className="bg-fuchsia-600 text-white text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider">HD Live</span>
                    <h2 className="text-xl md:text-2xl font-bold text-white tracking-tight">AROME <span className="text-fuchsia-400">1.3km</span></h2>
                </div>
                <p className="text-slate-400 text-xs md:text-sm">
                   Detall hora a hora d'alta precisió.
                </p>
            </div>
            <button 
                onClick={onClose} 
                className="p-2 bg-slate-800 rounded-full hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
            >
                <X className="w-5 h-5" />
            </button>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-0" ref={listRef}>
            
            {loading && (
                <div className="flex flex-col items-center justify-center h-64 space-y-4">
                    <div className="w-10 h-10 border-4 border-fuchsia-500 border-t-transparent rounded-full animate-spin"></div>
                    <p className="text-fuchsia-300 animate-pulse text-sm">Carregant dades HD...</p>
                </div>
            )}

            {error && (
                <div className="p-8 text-center">
                    <p className="text-red-400 font-medium mb-2">{error}</p>
                    <button onClick={() => fetchArome(lat, lon)} className="mt-2 px-4 py-2 bg-slate-800 text-white rounded-lg text-sm">Reintentar</button>
                </div>
            )}

            {aromeData && !loading && (
                <div>
                    <div className="grid grid-cols-3 gap-2 p-4 bg-slate-800/30 border-b border-white/5">
                         <div className="text-center">
                            <div className="text-[10px] uppercase text-slate-500 font-bold mb-1">Pluja Total</div>
                            <div className="text-xl font-bold text-blue-200">{totalRain.toFixed(1)}<span className="text-xs font-normal text-slate-500">mm</span></div>
                         </div>
                         <div className="text-center border-l border-white/5">
                            <div className="text-[10px] uppercase text-slate-500 font-bold mb-1">Ràfega Màx</div>
                            <div className={`text-xl font-bold ${maxGust > 50 ? 'text-teal-300' : 'text-slate-200'}`}>{Math.round(maxGust)}<span className="text-xs font-normal text-slate-500">km/h</span></div>
                         </div>
                         <div className="text-center border-l border-white/5">
                            <div className="text-[10px] uppercase text-slate-500 font-bold mb-1">Energia</div>
                            <div className={`text-xl font-bold ${maxCape > 800 ? 'text-amber-400' : 'text-slate-200'}`}>{Math.round(maxCape)}<span className="text-xs font-normal text-slate-500">J/kg</span></div>
                         </div>
                    </div>

                    <div className="divide-y divide-white/5">
                        {hourlyRows.map((row, index) => {
                            const isNewDay = index > 0 && hourlyRows[index-1].date !== row.date;
                            const isFirstBlock = index === 0;
                            const isRaining = row.precip > 0;
                            const isWindy = row.gust > 40;
                            
                            return (
                                <div key={row.time} className="relative group">
                                    {isFirstBlock && (
                                        <div className="sticky top-0 z-10 bg-slate-900/95 backdrop-blur py-1.5 px-4 text-[10px] font-bold uppercase text-slate-400 tracking-widest border-b border-white/5 shadow-sm">
                                            Avui
                                        </div>
                                    )}

                                    {isNewDay && (
                                        <div className="sticky top-0 z-10 bg-slate-900/95 backdrop-blur py-1.5 px-4 text-[10px] font-bold uppercase text-fuchsia-400 tracking-widest border-y border-fuchsia-500/20 shadow-sm mt-2">
                                            Demà
                                        </div>
                                    )}

                                    <div className={`flex items-center justify-between p-4 transition-colors ${isRaining ? 'bg-blue-900/10' : 'hover:bg-white/5'}`}>
                                        
                                        <div className="flex items-center gap-4 w-1/3">
                                            <div className="text-center min-w-[3rem]">
                                                <div className="text-lg font-bold text-white">
                                                    {row.hour}:00
                                                </div>
                                                {index === 0 && <div className="text-[9px] text-fuchsia-400 font-bold uppercase animate-pulse">Ara</div>}
                                            </div>
                                            <div className="relative">
                                                {getWeatherIcon(row.code, "w-10 h-10", row.isDay)}
                                            </div>
                                        </div>

                                        <div className="flex-1 flex justify-center items-center gap-6">
                                            <div className="text-xl font-bold text-slate-200 w-12 text-right">
                                                {Math.round(row.temp)}°
                                            </div>
                                            <div className="w-16 flex flex-col items-center">
                                                {row.precip > 0 ? (
                                                    <>
                                                        <div className="flex items-center gap-1 text-blue-300 font-bold">
                                                            <Droplets className="w-3 h-3" />
                                                            {row.precip >= 10 ? Math.round(row.precip) : row.precip.toFixed(1)}
                                                        </div>
                                                        <div className="h-1 w-full bg-slate-700 rounded-full mt-1 overflow-hidden">
                                                            <div className="h-full bg-blue-500" style={{width: `${Math.min(row.precip * 10, 100)}%`}}></div>
                                                        </div>
                                                    </>
                                                ) : (
                                                    <span className="text-slate-600 text-xs">-</span>
                                                )}
                                            </div>
                                        </div>

                                        <div className="w-1/4 flex flex-col items-end">
                                            <div className={`flex items-center gap-1.5 font-bold ${isWindy ? 'text-teal-300' : 'text-slate-400'}`}>
                                                <Wind className="w-3.5 h-3.5" />
                                                {Math.round(row.gust)}
                                            </div>
                                            <div className="text-[10px] text-slate-500 uppercase">km/h</div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                        
                        {hourlyRows.length === 0 && (
                             <div className="p-8 text-center text-slate-500">
                                 Dades no disponibles per a aquesta hora.
                             </div>
                        )}
                    </div>
                </div>
            )}
        </div>
      </div>
    </div>
  );
}