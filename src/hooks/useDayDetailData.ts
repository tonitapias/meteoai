// src/hooks/useDayDetailData.ts
import { useMemo } from 'react';
import { ExtendedWeatherData, StrictCurrentWeather } from '../types/weatherLogicTypes'; 
import { WEATHER_THRESHOLDS } from '../constants/weatherConfig';
import { getInversionCorrectedTemp } from '../utils/rules/temperatureCorrections';

const getSafeMonthFromIso = (isoString: string | undefined): number => {
    if (!isoString || isoString.length < 7) return new Date().getMonth();
    const monthNum = parseInt(isoString.slice(5, 7), 10);
    return (!isNaN(monthNum) && monthNum >= 1 && monthNum <= 12) ? monthNum - 1 : new Date().getMonth();
};

export const useDayDetailData = (
  weatherData: ExtendedWeatherData | null, 
  selectedDayIndex: number | null
) => {
  
  const dayData = useMemo(() => {
    if (!weatherData || selectedDayIndex === null) return null;
    const i = selectedDayIndex;
    const daily = weatherData.daily;
    if (!daily || !daily.time || !daily.time[i]) return null;

    return {
      date: daily.time[i],
      maxTemp: daily.temperature_2m_max[i],
      minTemp: daily.temperature_2m_min[i],
      precipSum: daily.precipitation_sum?.[i],
      windMax: daily.wind_speed_10m_max?.[i],
      sunrise: daily.sunrise?.[i],
      sunset: daily.sunset?.[i],
      uvMax: daily.uv_index_max?.[i]
    };
  }, [weatherData, selectedDayIndex]);

  const dayIndices = useMemo(() => {
    if (!weatherData || !dayData?.date) return [];
    const targetDate = dayData.date.includes('T') ? dayData.date.split('T')[0] : dayData.date;

    return weatherData.hourly.time
      .map((t: string, idx: number) => ({ 
        datePart: t.includes('T') ? t.split('T')[0] : t, 
        idx 
      }))
      .filter((item: { datePart: string, idx: number }) => item.datePart === targetDate)
      .map((item: { datePart: string, idx: number }) => item.idx);
  }, [weatherData, dayData]);

  const hourlyData = useMemo(() => {
    if (!weatherData || dayIndices.length === 0) return [];

    // DOCTRINA RISC ZERO (TS7053 i TS2339): Cast segur a diccionaris estructurats 
    // per validar propietats no previstes a la interfície sense usar 'any'
    const hRaw = weatherData.hourly as Record<string, number[] | undefined>;
    const compRaw = weatherData.hourlyComparison as Record<string, Record<string, unknown>[] | undefined> | undefined;

    return dayIndices.map((idx: number) => {
        let fl = weatherData.hourly.freezing_level_height?.[idx];
        if (fl == null) {
             const ecmwfVal = compRaw?.ecmwf?.[idx]?.freezing_level_height;
             const gfsVal = compRaw?.gfs?.[idx]?.freezing_level_height;
             const iconVal = compRaw?.icon?.[idx]?.freezing_level_height;
             fl = (typeof ecmwfVal === 'number' ? ecmwfVal 
                 : typeof gfsVal === 'number' ? gfsVal 
                 : typeof iconVal === 'number' ? iconVal 
                 : null);
        }
        
        const snowLevel = (fl != null) ? Math.max(0, fl - WEATHER_THRESHOLDS.SNOW.FREEZING_BUFFER) : null;

        // [NETEJA] Abans hi havia un bloc que llegia compRaw?.arome per a precip/rainProb/
        // cloudCover. normData.ts mai crea hourlyComparison.arome (només ecmwf/gfs/icon),
        // així que sempre queia al fallback — retirat, comportament idèntic.
        const precip = weatherData.hourly.precipitation?.[idx];
        const rainProb = weatherData.hourly.precipitation_probability?.[idx];
        const baseCloudCover = hRaw.cloud_cover?.[idx];
        const cloudCover = typeof baseCloudCover === 'number' ? baseCloudCover : 0;

        const time = weatherData.hourly.time[idx];
        const rawTemp = weatherData.hourly.temperature_2m[idx];

        const temp = (typeof rawTemp === 'number')
            ? getInversionCorrectedTemp(
                {
                    temperature_2m: rawTemp,
                    cloud_cover_low: hRaw.cloud_cover_low?.[idx] ?? 0,
                    cloud_cover_mid: hRaw.cloud_cover_mid?.[idx] ?? 0,
                    cloud_cover_high: hRaw.cloud_cover_high?.[idx] ?? 0,
                    wind_speed_10m: weatherData.hourly.wind_speed_10m[idx],
                    is_day: hRaw.is_day?.[idx] ?? 1
                } as unknown as StrictCurrentWeather,
                getSafeMonthFromIso(time)
              )
            : rawTemp;

        return {
            time,
            temp,
            rain: rainProb,
            snowLevel,
            precip: precip,
            wind: weatherData.hourly.wind_speed_10m[idx],
            humidity: weatherData.hourly.relative_humidity_2m[idx],
            cloud: cloudCover
        };
    });
  }, [weatherData, dayIndices]);

  const comparisonData = useMemo(() => {
      if (!weatherData?.hourlyComparison || dayIndices.length === 0) return null;

      // DOCTRINA RISC ZERO: Homologuem el tipatge a l'origen
      const compRaw = weatherData.hourlyComparison as Record<string, Record<string, unknown>[] | undefined>;

      const extract = (modelArr: Record<string, unknown>[]) => {
          if (!modelArr?.length) return [];
          return dayIndices.map((idx: number) => {
              const d = modelArr[idx];
              if (!d) return null;
              return {
                  time: weatherData.hourly.time[idx],
                  temp: d.temperature_2m,
                  rain: d.precipitation_probability,
                  wind: d.wind_speed_10m,
                  humidity: d.relative_humidity_2m,
                  precip: d.precipitation,
                  cloud: d.cloud_cover
              };
          }).filter((item): item is NonNullable<typeof item> => item !== null);
      };

      return {
          ecmwf: extract(compRaw.ecmwf || []),
          gfs: extract(compRaw.gfs || []),
          icon: extract(compRaw.icon || [])
      };
  }, [weatherData, dayIndices]);

  const snowLevelText = useMemo(() => {
     const levels = hourlyData
        .map(d => d.snowLevel)
        .filter((l: number | null): l is number => l != null);
        
     if (levels.length === 0) return "---";
     
     const min = Math.round(Math.min(...levels));
     const max = Math.round(Math.max(...levels));
     
     const cap = WEATHER_THRESHOLDS.DEFAULTS.MAX_DISPLAY_SNOW_LEVEL;
     if (min > cap) return `> ${cap}m`;
     if (Math.abs(max - min) < 50) return `${min}m`;
     return `${min} - ${max}m`;
  }, [hourlyData]);

  // [NETEJA] Exposem dayIndices perquè DayDetailModal.tsx el pugui reutilitzar a
  // tableRows en lloc de recalcular "les 24 hores del dia" amb una lògica pròpia
  // que assumia un bloc contigu de 24 posicions.
  return { dayData, hourlyData, comparisonData, snowLevelText, dayIndices };
};