import { useMemo } from 'react';
import { ShieldCheck, Zap } from 'lucide-react';
import { getWeatherIcon } from './WeatherIcons';
import { ExtendedWeatherData } from '../types/weatherLogicTypes';
import { StrictCurrentWeather } from '../types/weatherLogicTypes';
import { Language } from '../translations';
import { HourlyForecastWidget, ChartDataPoint } from './widgets';
import { WeatherUnit, formatPrecipitation } from '../utils/formatters';
import { getHourlyWeatherCode, getHourlyEffectiveCloudCover, resolveIsDay, type HourlySeries } from '../utils/hourlyWeatherCode';
import { getInversionCorrectedTemp } from '../utils/rules/temperatureCorrections';
import { getSafeLatitude, getSafeArrayNum as getSafeNum, extractValidArrayNum } from '../utils/weatherMath';
import { isRegionalModelActive } from '../constants/regionalModels';

export default function Forecast24h({ data, lang }: { data: ExtendedWeatherData, lang: Language, unit?: WeatherUnit }) {
    const { hourly, current, utc_offset_seconds, hourlyComparison } = data;
    
    // EXTRACCIÓ TÀCTICA DE SEGURETAT (Solució TS2345 / TS18046)
    const safeElevation = typeof data.elevation === 'number' && !isNaN(data.elevation) ? data.elevation : 0;
    const safeLatitude = getSafeLatitude(data.location);

    // DOCTRINA RISC ZERO: Validacions estrictes de dades
    const isRegionalModel = isRegionalModelActive(current?.source);
    const sourceLabel = isRegionalModel ? (current?.source as string) : 'MODEL GLOBAL';

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

        const hourlySeries = hourly as unknown as HourlySeries;
        const rows: ChartDataPoint[] = [];
        const MAX_HOURS = 25;
        
        // Helper d'idioma per la targeta "Ara"
        const NOW_LABEL = lang === 'en' ? 'NOW' : lang === 'es' ? 'AHORA' : lang === 'fr' ? 'ACTU' : 'ARA';

        // DOCTRINA RISC ZERO: Bucle segur. Si l'API lliura menys hores de les esperades, aturem la iteració.
        for (let i = 0; i < MAX_HOURS; i++) {
            const targetIndex = startIndex + i;
            
            if (targetIndex >= hourly.time.length) break;

            const timeStr = String(hourly.time[targetIndex]);
            const dateObj = new Date(timeStr);
            const hours = String(dateObj.getHours()).padStart(2, '0');
            
            // EXTRACCIÓ BLINDADA: Evitem trencaments si l'API de Meteo omet capes
            // DOCTRINA RISC ZERO: la temperatura mostrada a cada targeta no pot
            // ser un 0°C fals — si falta, null (HourlyForecastWidget ja en sap
            // mostrar "--°").
            const rawTemp = extractValidArrayNum(hourly.temperature_2m, targetIndex);
            const pProb = getSafeNum(hourly.precipitation_probability, targetIndex);
            const pAmt = getSafeNum(hourly.precipitation, targetIndex);
            const windSpeed = getSafeNum(hourly.wind_speed_10m, targetIndex);
            const sAmt = getSafeNum(hourly.snowfall, targetIndex);
            
            // Capes de núvols: només per a la correcció d'inversió de la temperatura
            // mostrada (el codi de la icona el calcula getHourlyWeatherCode).
            const cloudLow = getSafeNum(hourly.cloud_cover_low, targetIndex, 0);
            const cloudMid = getSafeNum(hourly.cloud_cover_mid, targetIndex, 0);
            const cloudHigh = getSafeNum(hourly.cloud_cover_high, targetIndex, 0);

            // Identificador Dia/Nit 
            const isDay = resolveIsDay(hourlySeries, targetIndex, () => true);
            const isDayNum = isDay ? 1 : 0;

            // [FIX PRECISIÓ] Apliquem la mateixa correcció d'inversió tèrmica que ja
            // s'usa a la capçalera (useCurrentWeatherLogic) i a DayDetailModal, perquè
            // el "ARA" d'aquesta tira no mostri una xifra diferent de la de dalt, i
            // perquè applyThermalLock (weatherLogic.ts) decideixi neu/gel/pluja amb la
            // temperatura de superfície real i no amb la del model en brut.
            // Passem el mes de CADA hora (no el d'avui), tal com exigeix la firma
            // actualitzada de getInversionCorrectedTemp per a hores futures.
            const temp = rawTemp !== null
                ? getInversionCorrectedTemp(
                    {
                        temperature_2m: rawTemp,
                        is_day: isDayNum,
                        wind_speed_10m: windSpeed,
                        cloud_cover_low: cloudLow,
                        cloud_cover_mid: cloudMid,
                        cloud_cover_high: cloudHigh,
                    } as unknown as StrictCurrentWeather,
                    dateObj.getMonth(),
                    safeLatitude
                )
                : null;

            // Codi de la icona: font única (utils/hourlyWeatherCode.ts), la mateixa que fan
            // servir DayDetailModal i el modal del model regional — així la mateixa hora
            // no pot mostrar icones diferents segons la pantalla.
            const finalCode = getHourlyWeatherCode(hourlySeries, targetIndex, safeElevation, hourlyComparison);

            let precipString = '';
            if (pAmt > 0) {
                precipString = formatPrecipitation(pAmt, sAmt);
            } else if (pProb > 0) {
                precipString = `${pProb}%`;
            }

            rows.push({
                time: i === 0 ? NOW_LABEL : `${hours}H`,
                temp: temp,
                icon: getWeatherIcon(finalCode, "w-8 h-8", isDay, pProb, windSpeed, temp, pAmt, getHourlyEffectiveCloudCover(hourlySeries, targetIndex)),
                precip: pProb || (pAmt > 0 ? 100 : 0),
                precipText: precipString,
                isNow: i === 0
            });
        }
        
        return rows;
    }, [hourly, lang, utc_offset_seconds, safeElevation, hourlyComparison, safeLatitude]);

    if (hourlyChartData.length === 0) return null;

    return (
        <div className="relative w-full z-20 group transform-gpu select-none" style={{ transform: 'translateZ(0)' }}>
            
            {/* ETiqueta Tàctica de Model (Spatial UI) */}
            <div className={`
                absolute -top-3.5 right-4 md:right-6 z-30 flex items-center gap-1.5 px-3 py-1 rounded-md backdrop-blur-md 
                shadow-[0_4px_12px_rgba(0,0,0,0.5),inset_0_1px_1px_rgba(255,255,255,0.1)] transition-colors duration-500
                ${isRegionalModel
                    ? 'bg-emerald-950/90 border border-emerald-500/30'
                    : 'bg-indigo-950/90 border border-indigo-500/30'}
            `}>
                {isRegionalModel ? (
                    <>
                        <Zap className="w-3.5 h-3.5 text-emerald-400 fill-emerald-400/20 animate-pulse drop-shadow-[0_0_5px_rgba(16,185,129,0.8)]" />
                        <span className="text-[10px] font-mono font-black text-emerald-400 tracking-widest drop-shadow-md">{sourceLabel}</span>
                    </>
                ) : (
                    <>
                        <ShieldCheck className="w-3.5 h-3.5 text-indigo-400 drop-shadow-[0_0_5px_rgba(99,102,241,0.8)]" />
                        <span className="text-[10px] font-mono font-black text-indigo-400 tracking-widest drop-shadow-md">{sourceLabel}</span>
                    </>
                )}
            </div>
            
            <HourlyForecastWidget data={hourlyChartData} lang={lang} />
            
        </div>
    );
}