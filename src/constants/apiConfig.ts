// src/constants/apiConfig.ts

export const API_TIMEOUT_DEFAULT = 10000;
export const API_MAX_RETRIES = 2;

// --- PARÀMETRES GENERALS DE LA PETICIÓ (NOU) ---
export const API_FORECAST_DAYS = "8"; // Dies de previsió
export const API_MODELS_LIST = "best_match,ecmwf_ifs04,gfs_seamless,icon_seamless"; // Models base
export const AROME_MODELS_LIST = "meteofrance_arome_france_hd"; // Model alta resolució

// --- CONFIGURACIÓ DE VARIABLES METEOROLÒGIQUES ---

export const PARAMS_CURRENT = [
    "temperature_2m", "relative_humidity_2m", "apparent_temperature", "is_day", 
    "precipitation", "rain", "showers", "snowfall", "weather_code", "cloud_cover", 
    "pressure_msl", "surface_pressure", "wind_speed_10m", "wind_direction_10m", 
    "wind_gusts_10m", "cloud_cover_low", "cloud_cover_mid", "cloud_cover_high", "visibility"
];

export const PARAMS_HOURLY = [
    "temperature_2m", "relative_humidity_2m", "dew_point_2m", "apparent_temperature", 
    "precipitation_probability", "precipitation", "rain", "showers", "snowfall", "snow_depth", 
    "weather_code", "pressure_msl", "surface_pressure", "cloud_cover", "cloud_cover_low", 
    "cloud_cover_mid", "cloud_cover_high", "visibility", "evapotranspiration", 
    "wind_speed_10m", "wind_direction_10m", "wind_gusts_10m", "uv_index", "uv_index_clear_sky", 
    "is_day", "cape", "freezing_level_height"
];

export const PARAMS_DAILY = [
    "weather_code", "temperature_2m_max", "temperature_2m_min", "apparent_temperature_max", 
    "apparent_temperature_min", "sunrise", "sunset", "daylight_duration", "sunshine_duration", 
    "uv_index_max", "uv_index_clear_sky_max", "precipitation_sum", "rain_sum", "showers_sum", 
    "snowfall_sum", "precipitation_hours", "precipitation_probability_max", "wind_speed_10m_max", 
    "wind_gusts_10m_max", "wind_direction_10m_dominant", "shortwave_radiation_sum", 
    "et0_fao_evapotranspiration"
];

// --- QUALITAT DE L'AIRE ---

export const PARAMS_AQI_CURRENT = [
    "european_aqi", "us_aqi", "pm10", "pm2_5", "nitrogen_dioxide", "ozone", 
    "sulphur_dioxide", "dust", "uv_index", "ammonia", "alder_pollen", "birch_pollen", 
    "grass_pollen", "mugwort_pollen", "olive_pollen", "ragweed_pollen"
];

export const PARAMS_AQI_HOURLY = [
    "european_aqi", "pm10", "pm2_5", "nitrogen_dioxide", "ozone", "sulphur_dioxide"
];

// --- MODEL AROME (METEO FRANCE) ---

export const AROME_CURRENT = [
    "temperature_2m", "relative_humidity_2m", "apparent_temperature", "is_day", 
    "precipitation", "weather_code", "cloud_cover", "pressure_msl", "surface_pressure", 
    "wind_speed_10m", "wind_direction_10m", "wind_gusts_10m", "cloud_cover_low", 
    "cloud_cover_mid", "cloud_cover_high"
];

export const AROME_HOURLY = [
    "temperature_2m", "relative_humidity_2m", "dew_point_2m", "apparent_temperature", 
    "precipitation", "weather_code", "pressure_msl", "surface_pressure", "cloud_cover", 
    "cloud_cover_low", "cloud_cover_mid", "cloud_cover_high", "visibility", 
    "wind_speed_10m", "wind_direction_10m", "wind_gusts_10m", "cape", 
    "freezing_level_height", "is_day"
];