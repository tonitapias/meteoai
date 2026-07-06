// src/components/Forecast24h.tsx
import { useMemo } from 'react';
import { ShieldCheck, Zap } from 'lucide-react';
import { getWeatherIcon } from './WeatherIcons';
import { ExtendedWeatherData } from '../types/weatherLogicTypes';
import { Language } from '../translations';
import { HourlyForecastWidget, ChartDataPoint } from './WeatherWidgets';
import { WeatherUnit, formatPrecipitation } from '../utils/formatters';

// HELPER DE DOCTRINA RISC ZERO: Extracció matemàticament segura d'arrays dinàmics
const getSafeNum = (arr: unknown, index: number, fallback: number = 0): number => {
    if (!Array.isArray(arr)) return fallback;
    if (index < 0 || index >= arr.length) return fallback;
    const val = arr[index];
    return (typeof val === 'number' && !isNaN(val)) ? val : fallback;
};

export default function Forecast24h({ data, lang }: { data: ExtendedWeatherData, lang: Language, unit?: WeatherUnit }) {
    const { hourly, current, utc_offset_seconds } = data;
    
    const isArome = current.source === 'AROME HD';
    const sourceLabel = isArome ? 'AROME HD' : 'GFS / GLOBAL';

    const hourlyChartData: ChartDataPoint[] = useMemo(() => {
        if (!hourly || !hourly.time || !Array.isArray(hourly.time) || hourly.time.length === 0) return [];
        
        // Càlcul de desfasament horari (Timezone) amb validació
        const safeOffsetSeconds = typeof utc_offset_seconds === 'number' && !isNaN(utc_offset_seconds) ? utc_offset_seconds : 0;
        
        const now = new Date();
        const locationMs = now.getTime() + (safeOffsetSeconds * 1000); 
        const locationDate = new Date(locationMs);

        // Construïm prefix d'hora actual: YYYY-MM-DDTHH
        const year = locationDate.getUTCFullYear();
        const month = String(locationDate.getUTCMonth() + 1).padStart(2, '0');
        const day = String(locationDate.getUTCDate()).padStart(2, '0');
        const hour = String(locationDate.getUTCHours()).padStart(2, '0');
        
        const currentIsoHourPrefix = `${year}-${month}-${day}T${hour}`;
        
        // Cerquem el primer índex que coincideix amb la nostra hora localitzada
        const startIndex = hourly.time.findIndex((t: unknown) => typeof t === 'string' && t.startsWith(currentIsoHourPrefix));
        
        if (startIndex === -1) return [];

        return Array.from({ length: 25 }).map((_, i) => {
            const targetIndex = startIndex + i;
            
            // Retorn segur fora de límits
            if (targetIndex >= hourly.time.length) {
                return { time: '', temp: 0, icon: null, precip: 0, precipText: '', isNow: false };
            }

            const timeStr = String(hourly.time[targetIndex]);
            const dateObj = new Date(timeStr);
            const hours = String(dateObj.getHours()).padStart(2, '0');
            
            // EXTRACCIÓ BLINDADA: Evitem trencaments si l'API de Meteo omet capes
            const temp = getSafeNum(hourly.temperature_2m, targetIndex);
            const pProb = getSafeNum(hourly.precipitation_probability, targetIndex);
            const pAmt = getSafeNum(hourly.precipitation, targetIndex);
            const windSpeed = getSafeNum(hourly.wind_speed_10m, targetIndex);
            const sAmt = getSafeNum(hourly.snowfall, targetIndex);
            const rawCode = getSafeNum(hourly.weather_code, targetIndex);
            
            // Motor Intel·ligent de Núvols (Màgia Visual)
            const cloudTotal = getSafeNum(hourly.cloud_cover, targetIndex);
            const cloudLow = getSafeNum(hourly.cloud_cover_low, targetIndex);
            const cloudMid = getSafeNum(hourly.cloud_cover_mid, targetIndex);
            const cloudHigh = getSafeNum(hourly.cloud_cover_high, targetIndex);

            let code = rawCode;
            
            // Si el codi base indica 'no precipitació', revaluem segons telemetria de capes
            if (rawCode <= 3) {
                // Comprovem si l'API suporta dades multinivell per aquesta coordenada
                const hasLayers = Array.isArray(hourly.cloud_cover_low) && hourly.cloud_cover_low.length > 0;
                
                const effectiveClouds = hasLayers 
                    ? Math.min(100, (cloudLow * 1.0) + (cloudMid * 0.6) + (cloudHigh * 0.3))
                    : cloudTotal;

                if (effectiveClouds > 85) code = 3;      
                else if (effectiveClouds > 45) code = 2; 
                else if (effectiveClouds > 15) code = 1; 
                else code = 0;                           
            }

            // Identificador Dia/Nit 
            const isDay = getSafeNum(hourly.is_day, targetIndex, 1) === 1;

            let precipString = '';
            if (pAmt > 0) {
                precipString = formatPrecipitation(pAmt, sAmt);
            } else if (pProb > 0) {
                precipString = `${pProb}%`;
            }

            return {
                time: i === 0 ? (lang === 'ca' ? 'ARA' : 'NOW') : `${hours}H`,
                temp: temp,
                // Assignem iconografia tàctica tenint en compte velocitat de vent i perill
                icon: getWeatherIcon(code, "w-8 h-8", isDay, pProb, windSpeed),
                precip: pProb || (pAmt > 0 ? 100 : 0),
                precipText: precipString,
                isNow: i === 0
            };
        });
      }, [hourly, lang, utc_offset_seconds]);

    // Protecció d'estat buit per no renderitzar contenidors inútils
    if (hourlyChartData.length === 0) return null;

    return (
        <div className="relative group w-full transform-gpu" style={{ transform: 'translateZ(0)' }}>
            
            {/* ETiqueta Tàctica de Model (Spatial UI) */}
            <div className={`
                absolute -top-3 right-4 z-20 flex items-center gap-1.5 px-3 py-1 rounded-md backdrop-blur-md 
                border shadow-lg transform ring-1 ring-white/5 transition-all duration-300
                ${isArome 
                    ? 'bg-emerald-950/80 border-emerald-500/30 shadow-[0_0_12px_rgba(16,185,129,0.25)]' 
                    : 'bg-indigo-950/80 border-indigo-500/30 shadow-[0_0_12px_rgba(99,102,241,0.25)]'}
            `}>
                {isArome ? (
                    <>
                        <Zap className="w-3.5 h-3.5 text-emerald-400 fill-emerald-400/20 animate-pulse drop-shadow-[0_0_5px_rgba(16,185,129,0.8)]" />
                        <span className="text-[10px] font-mono font-bold text-emerald-400 tracking-widest drop-shadow-[0_0_2px_rgba(0,0,0,1)]">AROME HD</span>
                    </>
                ) : (
                    <>
                        <ShieldCheck className="w-3.5 h-3.5 text-indigo-400 drop-shadow-[0_0_5px_rgba(99,102,241,0.8)]" />
                        <span className="text-[10px] font-mono font-bold text-indigo-400 tracking-widest drop-shadow-[0_0_2px_rgba(0,0,0,1)]">{sourceLabel}</span>
                    </>
                )}
            </div>
            
            {/* Contenidor de gràfics protegit */}
            <div className="relative w-full bg-slate-900/40 rounded-xl border border-slate-700/50 backdrop-blur-sm p-1 pt-4 shadow-inner">
                <HourlyForecastWidget data={hourlyChartData} lang={lang} />
            </div>
        </div>
    );
}