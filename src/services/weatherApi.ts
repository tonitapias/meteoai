// src/services/weatherApi.ts

export interface WeatherData {
    current: any;
    hourly: any;
    daily: any;
    minutely_15?: any;
    location?: {
        name: string;
        latitude: number;
        longitude: number;
        country?: string; 
    };
    current_units?: any;
    hourly_units?: any;
    daily_units?: any;
    [key: string]: any; 
}

const BASE_URL = "https://api.open-meteo.com/v1/forecast";
const AIR_QUALITY_URL = "https://air-quality-api.open-meteo.com/v1/air-quality";

// 1. Funció Principal (ECMWF + GFS + ICON)
export const getWeatherData = async (lat: number, lon: number, unit: 'C' | 'F' = 'C'): Promise<WeatherData> => {
    const params = new URLSearchParams({
        latitude: lat.toString(),
        longitude: lon.toString(),
        // AFEGIT: cloud_cover_low, cloud_cover_mid, cloud_cover_high al final
        current: "temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,rain,showers,snowfall,weather_code,cloud_cover,pressure_msl,surface_pressure,wind_speed_10m,wind_direction_10m,wind_gusts_10m,cloud_cover_low,cloud_cover_mid,cloud_cover_high",
        hourly: "temperature_2m,relative_humidity_2m,dew_point_2m,apparent_temperature,precipitation_probability,precipitation,rain,showers,snowfall,weather_code,pressure_msl,surface_pressure,cloud_cover,cloud_cover_low,cloud_cover_mid,cloud_cover_high,visibility,wind_speed_10m,wind_direction_10m,wind_gusts_10m,uv_index,is_day,freezing_level_height,cape",
        daily: "weather_code,temperature_2m_max,temperature_2m_min,apparent_temperature_max,apparent_temperature_min,sunrise,sunset,uv_index_max,precipitation_sum,rain_sum,showers_sum,snowfall_sum,precipitation_hours,precipitation_probability_max,wind_speed_10m_max,wind_gusts_10m_max,wind_direction_10m_dominant",
        minutely_15: "precipitation",
        timezone: "auto",
        models: "best_match,gfs_seamless,icon_seamless", 
        temperature_unit: unit === 'F' ? 'fahrenheit' : 'celsius',
        wind_speed_unit: "kmh",
        precipitation_unit: "mm",
        timeformat: "iso8601",
    });

    const response = await fetch(`${BASE_URL}?${params.toString()}`);
    if (!response.ok) throw new Error("Error connectant amb Open-Meteo");
    return response.json();
};

// 2. Funció Qualitat de l'Aire
export const getAirQualityData = async (lat: number, lon: number) => {
    const params = new URLSearchParams({
        latitude: lat.toString(),
        longitude: lon.toString(),
        current: "us_aqi,european_aqi,pm10,pm2_5,nitrogen_dioxide,ozone,sulphur_dioxide",
        timezone: "auto"
    });

    const response = await fetch(`${AIR_QUALITY_URL}?${params.toString()}`);
    if (!response.ok) throw new Error("Error obtenint qualitat de l'aire");
    return response.json();
};

// 3. Funció AROME (Alta Resolució)
export const getAromeData = async (lat: number, lon: number): Promise<WeatherData> => {
    const params = new URLSearchParams({
        latitude: lat.toString(),
        longitude: lon.toString(),
        // AFEGIT: cloud_cover_low, cloud_cover_mid, cloud_cover_high també aquí per coherència
        current: "temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,cloud_cover,pressure_msl,surface_pressure,wind_speed_10m,wind_direction_10m,wind_gusts_10m,cloud_cover_low,cloud_cover_mid,cloud_cover_high",
        hourly: "temperature_2m,relative_humidity_2m,dew_point_2m,apparent_temperature,precipitation,weather_code,pressure_msl,surface_pressure,cloud_cover,cloud_cover_low,cloud_cover_mid,cloud_cover_high,visibility,wind_speed_10m,wind_direction_10m,wind_gusts_10m,cape,freezing_level_height",
        minutely_15: "precipitation", 
        timezone: "auto",
        models: "meteofrance_arome_france_hd", 
        wind_speed_unit: "kmh",
        precipitation_unit: "mm",
        timeformat: "iso8601",
    });

    const response = await fetch(`${BASE_URL}?${params.toString()}`);
    if (!response.ok) throw new Error("Error connectant amb AROME");
    return response.json();
};