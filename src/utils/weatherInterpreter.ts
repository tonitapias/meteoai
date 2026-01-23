// src/utils/weatherInterpreter.ts
import { TRANSLATIONS, Language } from '../translations';
import { WEATHER_THRESHOLDS } from '../constants/weatherConfig';
import { safeNum, calculateDewPoint } from './weatherMath';
import { 
    StrictCurrentWeather, 
    StrictDailyWeather, 
    StrictHourlyWeather,
    TranslationMap 
} from '../types/weatherModels';

const { PRECIPITATION } = WEATHER_THRESHOLDS;

// --- INTERPRETACIÓ D'ETIQUETES I TEXTOS ---

export const getWeatherLabel = (current: StrictCurrentWeather | undefined, language: Language): string => {
  const tr = (TRANSLATIONS[language] || TRANSLATIONS['ca']) as TranslationMap;
  if (!tr || !current) return "";
  const code = safeNum(current.weather_code, 0);
  return tr.wmo[code] || "---";
};

// --- LÒGICA DE NEGOCI CORE (SMART WEATHER) ---

/**
 * Funció crítica que "recuina" el weather_code.
 * Si l'API diu "Sol" (0) però la humitat és 99% i hi ha núvols baixos, 
 * aquesta funció corregeix i retorna "Boira" (45).
 */
export const getRealTimeWeatherCode = (
    current: StrictCurrentWeather, 
    minutelyPrecipData: number[], 
    _prob: number = 0, 
    freezingLevel: number = 2500, 
    elevation: number = 0,
    cape: number = 0 
): number => {
    if (!current) return 0;
    
    let code = safeNum(current.weather_code, 0);
    const isArome = current.source === 'AROME HD'; 

    const temp = safeNum(current.temperature_2m, 15);
    const visibility = safeNum(current.visibility, 10000);
    const humidity = safeNum(current.relative_humidity_2m, 50);

    const lowClouds = safeNum(current.cloud_cover_low, 0);
    const midClouds = safeNum(current.cloud_cover_mid, 0);
    const highClouds = safeNum(current.cloud_cover_high, 0);
    
    // Càlcul de cobertura efectiva ponderada
    const effectiveCloudCover = Math.min(100, (lowClouds * 1.0) + (midClouds * 0.6) + (highClouds * 0.3));

    // 1. Correcció de Cel Serè vs Ennuvolat
    if (code <= 3) {
        if (effectiveCloudCover > 85) code = 3;      
        else if (effectiveCloudCover > 45) code = 2; 
        else if (effectiveCloudCover > 15) code = 1; 
        else code = 0;                      
    }

    // 2. Correcció per Precipitació Minut a Minut (Radar)
    const precipInstantanea = minutelyPrecipData && minutelyPrecipData.length > 0 
        ? Math.max(...minutelyPrecipData.map(v => safeNum(v, 0))) 
        : safeNum(current.precipitation, 0);

    // Si AROME diu que plou, forcem codi de pluja encara que l'API general digui sol
    if (isArome && precipInstantanea >= PRECIPITATION.TRACE && code < 51) {
        code = 61; 
    }

    // 3. Correcció per Boira (basada en Punt de Rosada)
    const dewPoint = calculateDewPoint(temp, humidity);
    const dewPointSpread = temp - dewPoint;

    if (code < 45 && dewPointSpread < 1.2 && humidity > 96 && effectiveCloudCover > 50) {
        code = 45; 
    } else if (code === 0 && humidity > 92) {
        code = 1; 
    }

    // 4. Correcció per Tempesta (CAPE)
    if (cape > 1200) { 
        const isPrecipitating = precipInstantanea >= PRECIPITATION.TRACE || (code >= 51 && code <= 82);
        
        if (effectiveCloudCover > 60) {
            if (isPrecipitating) {
                 if (code < 95) code = 95;
            } else if (cape > 2000) {
                code = 2; // Molta energia però sense pluja = Nius de tempesta (variable)
            }
        }
    }

    // 5. Correcció per Neu (Cota de neu dinàmica)
    const freezingDist = freezingLevel - elevation;
    const isColdEnoughForSnow = temp <= 1 || (temp <= 4 && freezingDist < 300);

    if (isColdEnoughForSnow) {
        const isRainCode = (code >= 51 && code <= 67) || (code >= 80 && code <= 82) || (code >= 95);
        if (isRainCode || precipInstantanea > 0) {
            if (code === 65 || code === 82 || code === 67 || code >= 95 || precipInstantanea > 1.5) return 75; 
            if (code === 63 || code === 81 || code === 55 || code === 57 || precipInstantanea >= 0.5) return 73; 
            return 71; 
        }
        if ((code >= 71 && code <= 77) || code === 85 || code === 86) return code;
    }
    
    // 6. Correcció final per visibilitat
    if ((code === 45 || code === 48 || visibility < 1000) && precipInstantanea < 0.1) {
        return 45;
    }

    // 7. Ajust d'intensitat de pluja si no hi ha codi específic
    if (precipInstantanea >= PRECIPITATION.TRACE) { 
        if (code >= 95) return code; 
        if (precipInstantanea > 4.0) code = 65; 
        else if (precipInstantanea >= 1.0) code = 63; 
        else code = 61; 
    } 

    return code;
};

// --- UTILS DE GEOLOCALITZACIÓ I CONTEXT ---

export const isAromeSupported = (lat: number, lon: number): boolean => {
    if (!lat || !lon) return false;
    // Bounding box aproximat per al model AROME HD (França + voltants)
    const MIN_LAT = 38.0, MAX_LAT = 53.0, MIN_LON = -8.0, MAX_LON = 12.0; 
    return (lat >= MIN_LAT && lat <= MAX_LAT && lon >= MIN_LON && lon <= MAX_LON);
};

export const prepareContextForAI = (current: StrictCurrentWeather, daily: StrictDailyWeather, hourly: StrictHourlyWeather) => {
    if (!current || !daily || !hourly || !hourly.time) return null;

    const currentIsoTime = current.time; 
    let startIndex = hourly.time.findIndex((t: string) => t === currentIsoTime);

    if (startIndex === -1 && currentIsoTime) {
         const currentHourStr = currentIsoTime.slice(0, 13); 
         startIndex = hourly.time.findIndex((t: string) => t.startsWith(currentHourStr));
    }
    
    startIndex = startIndex === -1 ? 0 : startIndex;

    const getNext4h = (key: keyof StrictHourlyWeather) => {
        const data = hourly[key];
        if (!Array.isArray(data)) return [];
        return data.slice(startIndex, startIndex + 4).map((v) => safeNum(v));
    };

    return {
        timestamp: current.time,
        location: { 
            elevation: safeNum(current.elevation || daily.elevation, 0)
        },
        current: {
            temp: safeNum(current.temperature_2m),
            feels_like: safeNum(current.apparent_temperature),
            is_raining: safeNum(current.precipitation) > 0 || safeNum(current.rain) > 0 || safeNum(current.showers) > 0,
            wind_speed: safeNum(current.wind_speed_10m),
            weather_code: safeNum(current.weather_code),
            humidity: safeNum(current.relative_humidity_2m)
        },
        daily_summary: {
            max: safeNum(daily.temperature_2m_max?.[0]),
            min: safeNum(daily.temperature_2m_min?.[0]),
            uv_max: safeNum(daily.uv_index_max?.[0]),
            rain_sum: safeNum(daily.precipitation_sum?.[0]),
            sunrise: daily.sunrise?.[0],
            sunset: daily.sunset?.[0]
        },
        short_term_trend: {
            temps: getNext4h('temperature_2m'),
            rain_prob: getNext4h('precipitation_probability'),
            precip_vol: getNext4h('precipitation'), 
            wind: getNext4h('wind_speed_10m'),
            gusts: getNext4h('wind_gusts_10m'),
            snow_depth: getNext4h('snow_depth') 
        }
    };
};