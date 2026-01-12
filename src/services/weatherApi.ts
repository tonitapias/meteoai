// src/services/weatherApi.ts

// Definim interfícies bàsiques per a les respostes de l'API
export interface WeatherData {
  latitude: number;
  longitude: number;
  timezone: string;
  current: {
    temperature_2m: number;
    relative_humidity_2m: number;
    is_day: number;
    weather_code: number;
    wind_speed_10m: number;
    wind_direction_10m: number;
    pressure_msl: number;
    precipitation: number;
    [key: string]: any;
  };
  hourly: {
    time: string[];
    temperature_2m: number[];
    precipitation_probability: number[];
    weather_code: number[];
    [key: string]: any;
  };
  daily: {
    time: string[];
    weather_code: number[];
    temperature_2m_max: number[];
    temperature_2m_min: number[];
    sunrise: string[];
    sunset: string[];
    [key: string]: any;
  };
  [key: string]: any; 
}

export interface AirQualityData {
  latitude: number;
  longitude: number;
  current: {
    european_aqi: number;
    alder_pollen?: number;
    birch_pollen?: number;
    grass_pollen?: number;
    mugwort_pollen?: number;
    olive_pollen?: number;
    ragweed_pollen?: number;
    [key: string]: any;
  };
}

export interface LocationData {
  name: string;
  country: string;
  latitude?: number;
  longitude?: number;
}

// Constants URLs
const METEO_API_URL = "https://api.open-meteo.com/v1";
const AQI_API_URL = "https://air-quality-api.open-meteo.com/v1";
// NOVA API DE GEOCODIFICACIÓ (CORS-FRIENDLY)
const REVERSE_GEO_URL = "https://api.bigdatacloud.net/data/reverse-geocode-client";

/**
 * Obté la previsió meteorològica principal
 */
export const fetchForecast = async (lat: number, lon: number, signal?: AbortSignal): Promise<WeatherData> => {
  const params = new URLSearchParams({
    latitude: lat.toString(),
    longitude: lon.toString(),
    current: "temperature_2m,relative_humidity_2m,is_day,apparent_temperature,weather_code,wind_speed_10m,wind_direction_10m,pressure_msl,cloud_cover,cloud_cover_low,cloud_cover_mid,cloud_cover_high,wind_gusts_10m,precipitation,visibility",
    hourly: "temperature_2m,apparent_temperature,precipitation_probability,precipitation,weather_code,wind_speed_10m,wind_direction_10m,cloud_cover,cloud_cover_low,cloud_cover_mid,cloud_cover_high,relative_humidity_2m,wind_gusts_10m,uv_index,is_day,freezing_level_height,pressure_msl,cape,visibility",
    daily: "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,uv_index_max,wind_speed_10m_max,precipitation_sum,snowfall_sum,sunrise,sunset",
    timezone: "auto",
    models: "ecmwf_ifs025,gfs_seamless,icon_seamless",
    minutely_15: "precipitation,weather_code",
    forecast_days: "8"
  });

  const response = await fetch(`${METEO_API_URL}/forecast?${params}`, { signal });
  if (!response.ok) throw new Error(`Error API Meteo: ${response.statusText}`);
  return response.json();
};

/**
 * Obté la qualitat de l'aire
 */
export const fetchAirQuality = async (lat: number, lon: number, signal?: AbortSignal): Promise<AirQualityData> => {
  const params = new URLSearchParams({
    latitude: lat.toString(),
    longitude: lon.toString(),
    current: "european_aqi,alder_pollen,birch_pollen,grass_pollen,mugwort_pollen,olive_pollen,ragweed_pollen"
  });

  const response = await fetch(`${AQI_API_URL}/air-quality?${params}`, { signal });
  if (!response.ok) throw new Error(`Error API AQI: ${response.statusText}`);
  return response.json();
};

/**
 * Obté dades del model AROME (Alta resolució)
 */
export const fetchAromeForecast = async (lat: number, lon: number, signal?: AbortSignal): Promise<any> => {
  const params = new URLSearchParams({
    latitude: lat.toString(),
    longitude: lon.toString(),
    current: "temperature_2m,relative_humidity_2m,is_day,apparent_temperature,weather_code,wind_speed_10m,wind_direction_10m,pressure_msl,wind_gusts_10m,precipitation,visibility",
    hourly: "temperature_2m,precipitation,weather_code,wind_speed_10m,wind_gusts_10m,is_day,cape,freezing_level_height,cloud_cover,cloud_cover_low,cloud_cover_mid,cloud_cover_high",
    minutely_15: "precipitation,weather_code",
    timezone: "auto"
  });

  const response = await fetch(`${METEO_API_URL}/meteofrance?${params}`, { signal });
  if (!response.ok) throw new Error(`Error API AROME: ${response.statusText}`);
  return response.json();
};

/**
 * Geocodificació inversa CORREGIDA (BigDataCloud)
 * Aquesta API permet peticions des del navegador sense bloquejos CORS.
 */
export const fetchLocationName = async (lat: number, lon: number, lang: string = 'ca'): Promise<LocationData> => {
  try {
    const response = await fetch(
      `${REVERSE_GEO_URL}?latitude=${lat}&longitude=${lon}&localityLanguage=${lang}`
    );
    
    if (!response.ok) throw new Error("Error Geocoding");
    
    const data = await response.json();
    
    // Mapeig de camps segons l'API de BigDataCloud
    const name = data.locality || data.city || data.principalSubdivision || "Ubicació Detectada";
    const country = data.countryName || "";

    return { name, country };
  } catch (error) {
    console.warn("Error resolent nom (Geocoding):", error);
    // Retornem un valor per defecte perquè l'app no es trenqui
    return { name: "Ubicació GPS", country: "" };
  }
};