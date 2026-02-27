import { useMemo } from 'react';
import { ShieldCheck, Zap } from 'lucide-react';
import { getWeatherIcon } from './WeatherIcons';
import { ExtendedWeatherData } from '../types/weatherLogicTypes';
import { Language } from '../translations';
import { HourlyForecastWidget, ChartDataPoint } from './WeatherWidgets';
import { WeatherUnit, formatPrecipitation } from '../utils/formatters';

export default function Forecast24h({ data, lang }: { data: ExtendedWeatherData, lang: Language, unit?: WeatherUnit }) {
    const { hourly, current, utc_offset_seconds } = data;
    
    const isArome = current.source === 'AROME HD';
    const sourceLabel = isArome ? 'AROME HD' : 'GFS / GLOBAL';

    const hourlyChartData: ChartDataPoint[] = useMemo(() => {
        if (!hourly || !hourly.time || !Array.isArray(hourly.time)) return [];
        
        // CORRECCIÓ ZONA HORÀRIA:
        const now = new Date();
        const utcMs = now.getTime(); 
        
        // MODIFICAT: Càsting segur per l'offset (unknown -> number)
        const offsetSeconds = (utc_offset_seconds as number) || 0;
        const locationMs = utcMs + (offsetSeconds * 1000); 
        const locationDate = new Date(locationMs);

        const year = locationDate.getUTCFullYear();
        const month = String(locationDate.getUTCMonth() + 1).padStart(2, '0');
        const day = String(locationDate.getUTCDate()).padStart(2, '0');
        const hour = String(locationDate.getUTCHours()).padStart(2, '0');
        
        const currentIsoHourPrefix = `${year}-${month}-${day}T${hour}`;
        
        const startIndex = hourly.time.findIndex((t: string) => t.startsWith(currentIsoHourPrefix));
        
        if (startIndex === -1) return [];

        return Array.from({ length: 25 }).map((_, i) => {
            const targetIndex = startIndex + i;
            
            if (targetIndex >= hourly.time.length) {
                return { time: '', temp: 0, icon: null, precip: 0, precipText: '', isNow: false };
            }

            const timeStr = hourly.time[targetIndex];
            const dateObj = new Date(timeStr);
            const hours = String(dateObj.getHours()).padStart(2, '0');
            
            // Llegim dades segures directament
            const temp = hourly.temperature_2m[targetIndex] || 0;
            const pProb = hourly.precipitation_probability?.[targetIndex] || 0;
            const pAmt = hourly.precipitation?.[targetIndex] || 0;
            const windSpeed = hourly.wind_speed_10m?.[targetIndex] || 0;
            
            // CORRECCIÓ: Substituït el 'as any' per un càsting segur
            const snowfallData = hourly.snowfall as number[] | undefined;
            const sAmt = snowfallData?.[targetIndex] || 0;
            
            // MODIFICAT: Càsting segur per propietats dinàmiques "unknown"
            const weatherCodes = hourly.weather_code as number[] | undefined;
            const rawCode = weatherCodes?.[targetIndex] || 0;
            
            // --- INICI MÀGIA VISUAL (MOTOR INTEL·LIGENT) ---
            // Extreure els núvols per capes i totals de l'hora de forma segura
            const cloudTotal = (hourly.cloud_cover as number[] | undefined)?.[targetIndex] || 0;
            const cloudLow = (hourly.cloud_cover_low as number[] | undefined)?.[targetIndex] || 0;
            const cloudMid = (hourly.cloud_cover_mid as number[] | undefined)?.[targetIndex] || 0;
            const cloudHigh = (hourly.cloud_cover_high as number[] | undefined)?.[targetIndex] || 0;

            let code = rawCode;
            
            // Si l'API diu que no plou (codis 0, 1, 2, 3), apliquem el mateix motor intel·ligent que al temps actual
            if (rawCode <= 3) {
                const hasLayers = hourly.cloud_cover_low !== undefined;
                
                // Calculem la "cobertura efectiva" restant pes als núvols alts inofensius
                const effectiveClouds = hasLayers 
                    ? Math.min(100, (cloudLow * 1.0) + (cloudMid * 0.6) + (cloudHigh * 0.3))
                    : cloudTotal;

                if (effectiveClouds > 85) code = 3;      // Només núvols
                else if (effectiveClouds > 45) code = 2; // Sol i núvols evidents
                else if (effectiveClouds > 15) code = 1; // Sol gairebé net
                else code = 0;                           // Sol net
            }
            // --- FI MÀGIA VISUAL ---

            const isDays = hourly.is_day as number[] | undefined;
            const isDay = isDays?.[targetIndex] === 1;

            let precipString = '';
            if (pAmt > 0) {
                precipString = formatPrecipitation(pAmt, sAmt);
            } else if (pProb > 0) {
                precipString = `${pProb}%`;
            }

            return {
                time: i === 0 ? (lang === 'ca' ? 'ARA' : 'NOW') : `${hours}H`,
                temp: temp,
                icon: getWeatherIcon(code, "w-8 h-8", isDay, pProb, windSpeed),
                precip: pProb || (pAmt > 0 ? 100 : 0),
                precipText: precipString,
                isNow: i === 0
            };
        });
      }, [hourly, lang, utc_offset_seconds]);

    return (
        <div className="relative group w-full">
            <div className="absolute -top-3 right-4 z-20 flex items-center gap-1.5 px-2 py-0.5 rounded bg-[#151725] border border-white/10 shadow-lg transform -translate-y-1/2 ring-1 ring-white/5">
                {isArome ? (
                    <>
                        <Zap className="w-3 h-3 text-emerald-400 fill-emerald-400/20 animate-pulse" />
                        <span className="text-[9px] font-mono font-bold text-emerald-400 tracking-widest">AROME HD</span>
                    </>
                ) : (
                    <>
                        <ShieldCheck className="w-3 h-3 text-indigo-400" />
                        <span className="text-[9px] font-mono font-bold text-indigo-400 tracking-widest">{sourceLabel}</span>
                    </>
                )}
            </div>
            
            <HourlyForecastWidget data={hourlyChartData} lang={lang} />
        </div>
    );
}