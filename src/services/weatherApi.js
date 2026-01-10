// src/services/weatherApi.js

// Constants per a les URLs base
const METEO_API_URL = "https://api.open-meteo.com/v1";
const AQI_API_URL = "https://air-quality-api.open-meteo.com/v1";
const GEO_API_URL = "https://nominatim.openstreetmap.org";

/**
 * Obté la previsió meteorològica principal (ECMWF, GFS, ICON)
 */
export const fetchForecast = async (lat, lon, signal) => {
  const params = new URLSearchParams({
    latitude: lat,
    longitude: lon,
    current: "temperature_2m,relative_humidity_2m,is_day,apparent_temperature,weather_code,wind_speed_10m,wind_direction_10m,pressure_msl,cloud_cover,cloud_cover_low,cloud_cover_mid,cloud_cover_high,wind_gusts_10m,precipitation,visibility",
    hourly: "temperature_2m,apparent_temperature,precipitation_probability,precipitation,weather_code,wind_speed_10m,wind_direction_10m,cloud_cover,cloud_cover_low,cloud_cover_mid,cloud_cover_high,relative_humidity_2m,wind_gusts_10m,uv_index,is_day,freezing_level_height,pressure_msl,cape,visibility",
    daily: "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,uv_index_max,wind_speed_10m_max,precipitation_sum,snowfall_sum,sunrise,sunset",
    timezone: "auto",
    models: "ecmwf_ifs025,gfs_seamless,icon_seamless",
    minutely_15: "precipitation,weather_code",
    forecast_days: 8
  });

  const response = await fetch(`${METEO_API_URL}/forecast?${params}`, { signal });
  if (!response.ok) throw new Error(`Error API Meteo: ${response.statusText}`);
  return response.json();
};

/**
 * Obté la qualitat de l'aire
 */
export const fetchAirQuality = async (lat, lon, signal) => {
  const params = new URLSearchParams({
    latitude: lat,
    longitude: lon,
    current: "european_aqi,alder_pollen,birch_pollen,grass_pollen,mugwort_pollen,olive_pollen,ragweed_pollen"
  });

  const response = await fetch(`${AQI_API_URL}/air-quality?${params}`, { signal });
  if (!response.ok) throw new Error(`Error API AQI: ${response.statusText}`);
  return response.json();
};

/**
 * Obté dades del model AROME (Alta resolució) si està disponible
 */
export const fetchAromeForecast = async (lat, lon, signal) => {
  const params = new URLSearchParams({
    latitude: lat,
    longitude: lon,
    current: "temperature_2m,relative_humidity_2m,is_day,apparent_temperature,weather_code,wind_speed_10m,wind_direction_10m,pressure_msl,wind_gusts_10m,precipitation,visibility",
    hourly: "temperature_2m,precipitation,weather_code,wind_speed_10m,wind_gusts_10m,is_day,cape,freezing_level_height,cloud_cover,cloud_cover_low,cloud_cover_mid,cloud_cover_high",
    minutely_15: "precipitation,weather_code",
    timezone: "auto"
  });

  // Usem l'endpoint específic de MeteoFrance
  const response = await fetch(`${METEO_API_URL}/meteofrance?${params}`, { signal });
  if (!response.ok) throw new Error(`Error API AROME: ${response.statusText}`);
  return response.json();
};

/**
 * Geocodificació inversa (Coordenades -> Nom del poble)
 */
export const fetchLocationName = async (lat, lon, lang = 'ca') => {
  try {
    const response = await fetch(
      `${GEO_API_URL}/reverse?format=json&lat=${lat}&lon=${lon}&zoom=12&accept-language=${lang}`,
      { headers: { 'User-Agent': 'MeteoToniAi/1.0' } }
    );
    
    if (!response.ok) throw new Error("Error Geocoding");
    
    const data = await response.json();
    const address = data.address || {};

    // Lògica de prioritat de noms (extreta del teu codi original)
    const name = address.city || 
                 address.town || 
                 address.village || 
                 address.municipality || 
                 address.hamlet || 
                 address.suburb || 
                 address.county || 
                 "Ubicació";
                 
    return { name, country: address.country || "" };
  } catch (error) {
    console.warn("Error resolent nom:", error);
    return { name: "Ubicació Detectada", country: "" };
  }
};