// src/types/weather.ts

export interface WeatherCurrent {
    time: string;
    interval?: number;
    temperature_2m: number;
    relative_humidity_2m: number;
    apparent_temperature: number;
    is_day: number;
    precipitation: number;
    weather_code: number;
    cloud_cover: number;
    pressure_msl: number;
    surface_pressure: number;
    wind_speed_10m: number;
    wind_direction_10m: number;
    wind_gusts_10m: number;
    cloud_cover_low?: number;
    cloud_cover_mid?: number;
    cloud_cover_high?: number;
    visibility?: number;
}

export interface WeatherHourly {
    time: string[];
    temperature_2m: number[];
    relative_humidity_2m: number[];
    dew_point_2m: number[];
    apparent_temperature: number[];
    precipitation_probability?: number[];
    precipitation: number[];
    rain?: number[];
    showers?: number[];
    snowfall?: number[];
    weather_code: number[];
    pressure_msl: number[];
    surface_pressure: number[];
    cloud_cover: number[];
    cloud_cover_low?: number[];
    cloud_cover_mid?: number[];
    cloud_cover_high?: number[];
    visibility?: number[];
    wind_speed_10m: number[];
    wind_direction_10m: number[];
    wind_gusts_10m: number[];
    uv_index?: number[];
    is_day?: number[];
    freezing_level_height?: number[];
    cape?: number[];
}

export interface WeatherDaily {
    time: string[];
    weather_code: number[];
    temperature_2m_max: number[];
    temperature_2m_min: number[];
    apparent_temperature_max: number[];
    apparent_temperature_min: number[];
    sunrise: string[];
    sunset: string[];
    uv_index_max: number[];
    precipitation_sum: number[];
    rain_sum?: number[];
    showers_sum?: number[];
    snowfall_sum?: number[];
    precipitation_hours?: number[];
    precipitation_probability_max?: number[];
    wind_speed_10m_max: number[];
    wind_gusts_10m_max: number[];
    wind_direction_10m_dominant: number[];
}

export interface AirQualityData {
    latitude: number;
    longitude: number;
    current: {
        time: string;
        us_aqi: number;
        european_aqi: number;
        pm10: number;
        pm2_5: number;
        nitrogen_dioxide: number;
        ozone: number;
        sulphur_dioxide: number;
    };
}

export interface WeatherData {
    latitude: number;
    longitude: number;
    generationtime_ms: number;
    utc_offset_seconds: number;
    timezone: string;
    timezone_abbreviation: string;
    elevation: number;
    current_units?: Record<string, string>;
    hourly_units?: Record<string, string>;
    daily_units?: Record<string, string>;
    current: WeatherCurrent;
    hourly: WeatherHourly;
    daily: WeatherDaily;
    minutely_15?: {
        time: string[];
        precipitation: number[];
    };
    location?: {
        name: string;
        latitude: number;
        longitude: number;
        country?: string; 
    };
    source?: string;
}