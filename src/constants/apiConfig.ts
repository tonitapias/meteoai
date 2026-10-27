// src/constants/apiConfig.ts

// Previsió d'Open-Meteo: la principal (services/weatherApi) i la consulta mínima de l'ascensor de la benvinguda.
export const OPEN_METEO_FORECAST_URL: string = import.meta.env.VITE_API_WEATHER_BASE || "https://api.open-meteo.com/v1/forecast";

export const API_TIMEOUT_DEFAULT = 10000;
// Peticions a api.open-meteo.com (la principal i el model regional): UN sol intent llarg. Amb el servidor lent
// (13-10-2026: 13-16 s) els 3 intents tallats als 10 s no arribaven mai a la resposta i l'app es quedava sense dades.
// El regional va al mateix servidor, que per defecte serveix d'una en una les peticions d'una mateixa IP
// (ConcurrencyGroupLimiter d'Open-Meteo): pot fer cua darrere la principal i necessita el mateix marge.
export const API_FORECAST_TIMEOUT = 25000;
// Espera abans de cada reintent quan Open-Meteo torna 5xx o la xarxa cau (un 4xx, com el 429 de quota, no es
// reintenta). Amb 1 s i 2 s, durant una sobrecàrrega (503, Sentry 14-10-2026) els tres intents queien en 3 s.
export const API_RETRY_DELAYS_MS = [3000, 8000] as const;

// --- PARÀMETRES GENERALS DE LA PETICIÓ ---
export const API_FORECAST_DAYS = "8"; // Dies de previsió
// [FIX PRECISIÓ] 'ecmwf_ifs04' és l'identificador antic (0.4°), retirat per Open-Meteo
// en favor de 'ecmwf_ifs025' (0.25°). Amb l'antic, Open-Meteo no retornava mai
// dades ECMWF (per això hourlyComparison.ecmwf sempre quedava buit).
// 'ecmwf_aifs025_single' és el model d'IA de l'ECMWF (AIFS) — verificat en viu que
// és l'ID correcte; 'ecmwf_aifs025' (sense '_single') existeix però retorna sempre
// hores nul·les, el mateix parany silenciós que amb l'antic 'ecmwf_ifs04'.
export const API_MODELS_LIST = "best_match,ecmwf_ifs025,ecmwf_aifs025_single,gfs_seamless,icon_seamless"; // Models base

// --- CONFIGURACIÓ DE VARIABLES METEOROLÒGIQUES ---
// MILLORA DE SEGURETAT: Afegim 'as const' per fer les llistes de lectura exclusiva (Read-Only).
// Això evita mutacions accidentals (bugs) des d'altres parts de l'app.

export const PARAMS_CURRENT = [
    "temperature_2m", "relative_humidity_2m", "apparent_temperature", "is_day", 
    "precipitation", "rain", "showers", "snowfall", "weather_code", "cloud_cover", 
    "pressure_msl", "surface_pressure", "wind_speed_10m", "wind_direction_10m", 
    "wind_gusts_10m", "cloud_cover_low", "cloud_cover_mid", "cloud_cover_high", "visibility"
] as const;

export const PARAMS_HOURLY = [
    "temperature_2m", "relative_humidity_2m", "dew_point_2m", "apparent_temperature", 
    "precipitation_probability", "precipitation", "rain", "showers", "snowfall", "snow_depth", 
    "weather_code", "pressure_msl", "surface_pressure", "cloud_cover", "cloud_cover_low", 
    "cloud_cover_mid", "cloud_cover_high", "visibility", "evapotranspiration", 
    "wind_speed_10m", "wind_direction_10m", "wind_gusts_10m", "uv_index", "uv_index_clear_sky", 
    "is_day", "cape", "freezing_level_height",
    // Vent a 500 hPa: amb el de 10 m del MATEIX model, el cisallament del modal de tempesta (utils/rules/shearRules.ts)
    "wind_speed_500hPa", "wind_direction_500hPa"
] as const;

export const PARAMS_DAILY = [
    "weather_code", "temperature_2m_max", "temperature_2m_min", "apparent_temperature_max", 
    "apparent_temperature_min", "sunrise", "sunset", "daylight_duration", "sunshine_duration", 
    "uv_index_max", "uv_index_clear_sky_max", "precipitation_sum", "rain_sum", "showers_sum", 
    "snowfall_sum", "precipitation_hours", "precipitation_probability_max", "wind_speed_10m_max", 
    "wind_gusts_10m_max", "wind_direction_10m_dominant", "shortwave_radiation_sum", 
    "et0_fao_evapotranspiration"
] as const;

// --- QUALITAT DE L'AIRE ---

export const PARAMS_AQI_CURRENT = [
    "european_aqi", "us_aqi", "pm10", "pm2_5", "nitrogen_dioxide", "ozone", 
    "sulphur_dioxide", "dust", "uv_index", "ammonia", "alder_pollen", "birch_pollen", 
    "grass_pollen", "mugwort_pollen", "olive_pollen", "ragweed_pollen"
] as const;

export const PARAMS_AQI_HOURLY = [
    "european_aqi", "pm10", "pm2_5", "nitrogen_dioxide", "ozone", "sulphur_dioxide"
] as const;

// --- MODELS REGIONALS D'ALTA RESOLUCIÓ (AROME / ICON-D2 / HRRR / HRDPS) ---
// [NETEJA] Abans nomia's AROME_CURRENT/AROME_HOURLY perquè AROME era l'únic
// model regional. La llista de camps és vàlida per als 4 (verificat en viu
// contra Open-Meteo: HRRR i ICON-D2 la suporten al 100%; HRDPS no té
// 'visibility' ni 'freezing_level_height', però el motor de merge ja ignora
// els camps null — vegeu regionalModels.ts).
// ATENCIÓ (verificat en viu): els camps que un model regional no publica queden
// a null i, un cop combinat, s'hi veu el valor del model global. AROME HD no
// porta 'weather_code', 'visibility', 'freezing_level_height' ni 'cloud_cover'
// total; d'altres (MeteoSwiss, ItaliaMeteo, GeoSphere AT, MET Norway, JMA...) no
// porten 'visibility'. Qualsevol pantalla que decideixi una icona ha de fer-ho
// sobre la sèrie combinada (utils/hourlyWeatherCode.ts), no sobre la crua.

export const REGIONAL_HD_CURRENT = [
    "temperature_2m", "relative_humidity_2m", "apparent_temperature", "is_day",
    "precipitation", "weather_code", "cloud_cover", "pressure_msl", "surface_pressure",
    "wind_speed_10m", "wind_direction_10m", "wind_gusts_10m", "cloud_cover_low",
    "cloud_cover_mid", "cloud_cover_high"
] as const;

export const REGIONAL_HD_HOURLY = [
    "temperature_2m", "relative_humidity_2m", "dew_point_2m", "apparent_temperature",
    "precipitation", "weather_code", "pressure_msl", "surface_pressure", "cloud_cover",
    "cloud_cover_low", "cloud_cover_mid", "cloud_cover_high", "visibility",
    "wind_speed_10m", "wind_direction_10m", "wind_gusts_10m", "cape",
    "freezing_level_height", "is_day"
] as const;