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
  cloudCover: number;
}

// Funció auxiliar per calcular el dia/nit segons l'època de l'any
// Això evita que surti sol a les 21h a l'hivern o lluna a les 21h a l'estiu
const estimateIsDay = (hour: number): boolean => {
    const month = new Date().getMonth(); // 0 = Gener, 11 = Desembre
    
    // Hivern (Nov-Feb): Dia curt (08:00 - 18:00)
    if (month <= 1 || month >= 10) return hour >= 8 && hour < 18;
    
    // Estiu (Maig-Ago): Dia llarg (06:00 - 22:00)
    if (month >= 4 && month <= 7) return hour >= 6 && hour < 22;
    
    // Primavera/Tardor: Estàndard (07:00 - 20:00)
    return hour >= 7 && hour < 20;
};

export default function AromeModal({ lat, lon, onClose }: AromeModalProps) {
  const { aromeData, loading, error, fetchArome, clearArome } = useArome();
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (lat && lon) fetchArome(lat, lon);
    return () => clearArome();
  }, [lat, lon, fetchArome, clearArome]);

  const hourlyRows = useMemo<HourlyRow[]>(() => {
    if (!aromeData?.hourly) return [];
    
    const h = aromeData.hourly;
    const now = new Date();
    const todayDateStr = now.toISOString().split('T')[0];
    const nowHour = now.getHours();
    
    const rows = (h.time || []).map((t: string, i: number) => {
      const dateStr = t.slice(0, 10); 
      const hourStr = t.slice(11, 13);
      const hour = parseInt(hourStr, 10);
      
      // FILTRE 1: Ignorar passat
      if (dateStr < todayDateStr) return null;
      if (dateStr === todayDateStr && hour < nowHour) return null;
      
      // FILTRE 2: Validació de dades
      if (h.temperature_2m?.[i] === null || h.temperature_2m?.[i] === undefined) {
          return null;
      }

      // 1. CÀLCUL DIA/NIT
      // Prioritzem la dada de l'API. Si falta, usem l'estimació estacional.
      const isDayVal = (h.is_day && h.is_day[i] !== undefined)
          ? h.is_day[i] === 1 
          : estimateIsDay(hour);

      // --- SINTETITZADOR METEOROLÒGIC (SOLUCIÓ AL PROBLEMA D'ICONES) ---
      const precip = h.precipitation?.[i] ?? 0;
      const clouds = h.cloud_cover?.[i] ?? 0;   // 0 a 100%
      const visibility = h.visibility?.[i] ?? 10000;
      const temp = h.temperature_2m[i];
      const cape = h.cape?.[i] ?? 0;
      
      let finalCode = 0; // Per defecte: Cel Serè

      // NIVELL 1: Tempesta (CAPE alt + Pluja)
      if (cape > 500 && precip > 0.5) {
          finalCode = 95; 
      }
      // NIVELL 2: Precipitació (Pluja o Neu)
      else if (precip > 0.1) {
          if (temp < 1.0) {
              finalCode = 71; // Neu
          } else {
              if (precip > 2.0) finalCode = 63;      // Pluja forta
              else if (precip > 0.5) finalCode = 61; // Pluja moderada
              else finalCode = 51;                   // Plugim
          }
      }
      // NIVELL 3: Boira (Baixa visibilitat sense pluja)
      else if (visibility < 2000) {
          finalCode = 45; 
      }
      // NIVELL 4: NÚVOLS (La correcció clau)
      // Si AROME diu "0" però clouds > 15%, forcem la icona de núvol.
      else {
          if (clouds > 85) finalCode = 3;       // Cobert (Gris total)
          else if (clouds > 50) finalCode = 2;  // Molt ennuvolat (Broken)
          else if (clouds > 15) finalCode = 1;  // Parcialment ennuvolat (Scattered)
          else finalCode = 0;                   // Serè (Sol/Lluna)
      }

      return {
          time: t,
          hour: hour,
          date: dateStr,
          temp: temp,
          precip: precip,
          code: finalCode, // Icona calculada manualment
          wind: h.wind_speed_10m?.[i] ?? 0,
          gust: h.wind_gusts_10m?.[i] ?? 0,
          cape: cape,
          isDay: isDayVal,
          cloudCover: clouds
      };
    }).filter((row): row is HourlyRow => row !== null);

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
                <p className="text-slate-400 text-xs md:text-sm">Previsió d'alta precisió (Icones Sintetitzades)</p>
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
                    <p className="text-fuchsia-300 text-sm animate-pulse">Processant física atmosfèrica...</p>
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
                                Dades no disponibles temporalment.
                            </div>
                        ) : (
                            hourlyRows.map((row, index) => {
                                const isNewDay = index > 0 && hourlyRows[index-1].date !== row.date;
                                const isRaining = row.precip > 0.1;
                                const isSnow = row.temp < 1.0 && isRaining;
                                
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