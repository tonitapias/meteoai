// src/services/weatherApi.ts

export interface WeatherData {
    current: Record<string, unknown>;
    hourly: Record<string, unknown>;
    daily: Record<string, unknown>;
    minutely_15?: Record<string, unknown>;
    location?: {
        name: string;
        latitude: number;
        longitude: number;
        country?: string; 
    };
    current_units?: Record<string, string>;
    hourly_units?: Record<string, string>;
    daily_units?: Record<string, string>;
    [key: string]: unknown; 
}

const BASE_URL = "https://api.open-meteo.com/v1/forecast";
const AIR_QUALITY_URL = "https://air-quality-api.open-meteo.com/v1/air-quality";
const TIMEOUT_MS = 10000; // 10 segons màxim per esperar el temps

// --- Utilitat interna per evitar bloquejos infinits ---
const fetchWithTimeout = async (url: string): Promise<Response> => {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
        const response = await fetch(url, { signal: controller.signal });
        clearTimeout(id);
        return response;
    } catch (error) {
        clearTimeout(id);
        throw error;
    }
};

// 1. Funció Principal (ECMWF + GFS + ICON)
export const getWeatherData = async (lat: number, lon: number, unit: 'C' | 'F'): Promise<WeatherData> => {
    const tempUnit = unit === 'F' ? 'fahrenheit' : 'celsius';
    const params = new URLSearchParams({
        latitude: lat.toString(),
        longitude: lon.toString(),
        current: "temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,rain,showers,snowfall,weather_code,cloud_cover,pressure_msl,surface_pressure,wind_speed_10m,wind_direction_10m,wind_gusts_10m,cloud_cover_low,cloud_cover_mid,cloud_cover_high,visibility",
        hourly: "temperature_2m,relative_humidity_2m,dew_point_2m,apparent_temperature,precipitation_probability,precipitation,rain,showers,snowfall,snow_depth,weather_code,pressure_msl,surface_pressure,cloud_cover,cloud_cover_low,cloud_cover_mid,cloud_cover_high,visibility,evapotranspiration,wind_speed_10m,wind_direction_10m,wind_gusts_10m,uv_index,uv_index_clear_sky,is_day,cape,freezing_level_height",
        daily: "weather_code,temperature_2m_max,temperature_2m_min,apparent_temperature_max,apparent_temperature_min,sunrise,sunset,daylight_duration,sunshine_duration,uv_index_max,uv_index_clear_sky_max,precipitation_sum,rain_sum,showers_sum,snowfall_sum,precipitation_hours,precipitation_probability_max,wind_speed_10m_max,wind_gusts_10m_max,wind_direction_10m_dominant,shortwave_radiation_sum,et0_fao_evapotranspiration",
        models: "best_match,ecmwf_ifs04,gfs_seamless,icon_seamless",
        timezone: "auto",
        temperature_unit: tempUnit,
        wind_speed_unit: "kmh",
        precipitation_unit: "mm",
        forecast_days: "8" // <--- ARA SÍ: 8 dies totals - 1 (avui) = 7 dies a la llista.
    });

    const response = await fetchWithTimeout(`${BASE_URL}?${params.toString()}`);
    if (!response.ok) throw new Error("Error obtenint dades meteorològiques");
    return response.json();
};

// 2. Funció Qualitat Aire
export const getAirQualityData = async (lat: number, lon: number): Promise<Record<string, unknown>> => {
    const params = new URLSearchParams({
        latitude: lat.toString(),
        longitude: lon.toString(),
        current: "european_aqi,us_aqi,pm10,pm2_5,nitrogen_dioxide,ozone,sulphur_dioxide,dust,uv_index,ammonia,alder_pollen,birch_pollen,grass_pollen,mugwort_pollen,olive_pollen,ragweed_pollen",
        hourly: "european_aqi,pm10,pm2_5,nitrogen_dioxide,ozone,sulphur_dioxide",
        timezone: "auto"
    });

    const response = await fetchWithTimeout(`${AIR_QUALITY_URL}?${params.toString()}`);
    if (!response.ok) throw new Error("Error obtenint qualitat de l'aire");
    return response.json();
};

// 3. Funció AROME (Alta Resolució)
export const getAromeData = async (lat: number, lon: number): Promise<WeatherData> => {
    const params = new URLSearchParams({
        latitude: lat.toString(),
        longitude: lon.toString(),
        current: "temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,cloud_cover,pressure_msl,surface_pressure,wind_speed_10m,wind_direction_10m,wind_gusts_10m,cloud_cover_low,cloud_cover_mid,cloud_cover_high",
        hourly: "temperature_2m,relative_humidity_2m,dew_point_2m,apparent_temperature,precipitation,weather_code,pressure_msl,surface_pressure,cloud_cover,cloud_cover_low,cloud_cover_mid,cloud_cover_high,visibility,wind_speed_10m,wind_direction_10m,wind_gusts_10m,cape,freezing_level_height,is_day",
        minutely_15: "precipitation", 
        timezone: "auto",
        models: "meteofrance_arome_france_hd" 
    });

    const response = await fetchWithTimeout(`${BASE_URL}?${params.toString()}`);
    if (!response.ok) throw new Error("Error obtenint dades AROME");
    return response.json();
};