import type { Expression } from 'mapbox-gl';
import { z } from 'zod';

// --- SCHEMAS ---
export const RadarFrameSchema = z.object({
  time: z.number().nullable(),
  path: z.string(),
});

export const RainViewerResponseSchema = z.object({
  host: z.string(),
  radar: z.object({
    past: z.array(RadarFrameSchema).default([]),
    nowcast: z.array(RadarFrameSchema).default([]),
  }).optional(),
  satellite: z.object({
    infrared: z.array(RadarFrameSchema).default([]),
  }).optional(),
});

// --- TYPES ---
export type RadarFrame = z.infer<typeof RadarFrameSchema>;
export type BaseLayerType = 'dark' | 'light' | 'relief' | 'sat_optic' | 'black_marble';

export interface BaseLayerConfig {
  name: string;
  url: string;
  attribution: string;
}

export interface GeoFeatureCollection {
  type: 'FeatureCollection';
  features: {
    type: 'Feature';
    properties: { level: number };
    geometry: {
      type: 'Polygon';
      coordinates: number[][][];
    };
  }[];
}

// --- CONSTANTS NOVES (3D Terrain & Z-Layers) ---
export const MAPBOX_DEM_URL = 'mapbox://mapbox.mapbox-terrain-dem-v1';

export const Z_LAYERS = {
  PIS_1_TOPO: 'z-index-topo',
  PIS_2_SURFACE: 'z-index-nasa-fires',
  PIS_3_LOW_ATMOS: 'z-index-clouds',
  PIS_4_FILTER: 'layer-night',
  PIS_5_HIGH_ATMOS: 'z-index-radar',
  PIS_6_UI: 'layer-labels'
} as const;

// --- FÍSICA VISUAL I MATEMÀTIQUES ---

export const getNASADate = (): string => {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() - 3); 
  return d.toISOString().split('T')[0];
};

export const getNasaFiresDate = (): string => {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() - 1); 
  return d.toISOString().split('T')[0];
};

export const getBlackMarbleUrl = (): string => {
  return 'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/VIIRS_Black_Marble/default//GoogleMapsCompatible_Level8/{z}/{y}/{x}.png';
};

export const getNasaFiresWmsUrl = (): string => {
  const dateStr = getNasaFiresDate();
  return `https://gibs.earthdata.nasa.gov/wms/epsg3857/best/wms.cgi?SERVICE=WMS&REQUEST=GetMap&LAYERS=VIIRS_SNPP_Thermal_Anomalies_375m_Day,VIIRS_SNPP_Thermal_Anomalies_375m_Night&VERSION=1.1.1&FORMAT=image/png&TRANSPARENT=true&WIDTH=512&HEIGHT=512&TIME=${dateStr}&SRS=EPSG:3857&BBOX={bbox-epsg-3857}`;
};

export const getRadOpacityExp = (baseOp: number): Expression => {
  return [
    'interpolate', ['linear'], ['zoom'],
    2, baseOp * 0.95,
    6, baseOp * 0.90,
    10, baseOp * 0.85,
    14, baseOp * 0.65,
    18, baseOp * 0.45 
  ];
};

export const getSatOpacityExp = (baseOp: number): Expression => {
  return [
    'interpolate', ['linear'], ['zoom'],
    2, baseOp * 0.85,
    5, baseOp * 0.65,
    8, baseOp * 0.25, 
    11, baseOp * 0.05,
    13, 0
  ];
};

export const getNightOpacityExp = (isDark: boolean): Expression => {
  const baseOp = isDark ? 0.78 : 0.48;
  return [
    'interpolate', ['linear'], ['zoom'],
    2, baseOp,          
    6, baseOp * 0.65,   
    11, 0               
  ];
};

export const getBlackMarbleOpacityExp = (baseOp: number): Expression => {
  return [
    'interpolate', ['linear'], ['zoom'],
    2, baseOp,          
    5, baseOp * 0.9,
    8, baseOp * 0.3,    
    10, 0               
  ];
};

export const getNasaFiresOpacityExp = (baseOp: number): Expression => {
  return [
    'interpolate', ['linear'], ['zoom'],
    2, baseOp,
    8, baseOp * 0.9,
    14, baseOp * 0.8,    
    18, baseOp * 0.6 
  ];
};

// =========================================================================
// MOTORS ASTRONÒMICS I D'OMBRES (Alt Rendiment V8 Math)
// =========================================================================

export const getSunLightConfig = (timestamp: number, lat: number, lon: number): { position: [number, number, number], intensity: number } => {
  const PI = Math.PI;
  const rad = PI / 180;
  const deg = 180 / PI;

  const date = new Date(timestamp);
  const jd = date.getTime() / 86400000 + 2440587.5;
  const d = jd - 2451545.0;

  // Càlcul de coordenades orbitals solars
  const M = (357.5291 + 0.98560028 * d) * rad;
  const sinM = Math.sin(M);
  const C = (1.9148 * sinM + 0.0200 * Math.sin(2 * M) + 0.0003 * Math.sin(3 * M)) * rad;
  const L = (280.4665 + 0.98564736 * d + C * deg) % 360 * rad;
  const e = 23.439 * rad;

  const sinL = Math.sin(L);
  const cosL = Math.cos(L);
  const sunDec = Math.asin(Math.sin(e) * sinL);
  const sunRA = Math.atan2(Math.cos(e) * sinL, cosL);

  const gmstDeg = (280.46061837 + 360.98564736629 * d) % 360;
  let lmstDeg = (gmstDeg + lon) % 360;
  if (lmstDeg < 0) lmstDeg += 360; 
  const lmstRad = lmstDeg * rad;

  const hourAngle = lmstRad - sunRA;
  const latRad = lat * rad;
  
  const sinLat = Math.sin(latRad);
  const cosLat = Math.cos(latRad);
  const sinSunDec = Math.sin(sunDec);
  const cosSunDec = Math.cos(sunDec);

  // Elevació i Azimut
  const sinAlt = sinLat * sinSunDec + cosLat * cosSunDec * Math.cos(hourAngle);
  const alt = Math.asin(sinAlt);

  const cosAlt = Math.cos(alt);
  // Evitem la divisió per zero si el sol està al zenit absolut (molt estrany, però Risc Zero)
  const cosAz = cosAlt === 0 ? 0 : (sinSunDec - sinLat * sinAlt) / (cosLat * cosAlt);
  const safeCosAz = Math.max(-1, Math.min(1, cosAz)); 
  let az = Math.acos(safeCosAz);
  
  if (Math.sin(hourAngle) > 0) {
    az = 2 * PI - az;
  }

  const altDeg = alt * deg;
  const azDeg = az * deg;

  // Traducció al Motor 3D de Mapbox
  const polar = Math.max(0, Math.min(90, 90 - altDeg));
  
  // Intensitat de la llum solar segons elevació
  let intensity = 0.15; // Llum nocturna base
  if (altDeg > 0) {
    intensity = 0.15 + (0.7 * Math.min(1, altDeg / 25)); 
  }

  return {
    position: [1.5, azDeg, polar],
    intensity: intensity
  };
};

export const computeNightFeatures = (timestamp: number): GeoFeatureCollection => {
  const PI = Math.PI;
  const rad = PI / 180;
  const deg = 180 / PI;
  const date = new Date(timestamp);
  const jd = date.getTime() / 86400000 + 2440587.5;
  const d = jd - 2451545.0; 
  
  const M = (357.5291 + 0.98560028 * d) * rad;
  const sinM = Math.sin(M);
  const C = (1.9148 * sinM + 0.0200 * Math.sin(2 * M) + 0.0003 * Math.sin(3 * M)) * rad;
  const L = (280.4665 + 0.98564736 * d + C * deg) % 360 * rad; 
  const e = 23.439 * rad; 
  
  const sinL = Math.sin(L);
  const sunDec = Math.asin(Math.sin(e) * sinL);
  const sunRA = Math.atan2(Math.cos(e) * sinL, Math.cos(L));
  const gmst = (280.46061837 + 360.98564736629 * d) % 360 * rad;
  
  let sunLon = sunRA - gmst;
  while (sunLon < -PI) sunLon += 2 * PI;
  while (sunLon > PI) sunLon -= 2 * PI;
  
  const coords: number[][] = [];
  const safeSunDec = sunDec === 0 ? 0.000001 : sunDec;
  const tanSafeSunDec = Math.tan(safeSunDec);
  
  if (safeSunDec > 0) {
    coords.push([-180, -90], [180, -90]);
    for (let lonDeg = 180; lonDeg >= -180; lonDeg -= 1) {
      const lon = lonDeg * rad;
      const lat = Math.atan(-Math.cos(lon - sunLon) / tanSafeSunDec);
      coords.push([lonDeg, lat * deg]);
    }
    coords.push([-180, -90]); 
  } else {
    coords.push([180, 90], [-180, 90]);
    for (let lonDeg = -180; lonDeg <= 180; lonDeg += 1) {
      const lon = lonDeg * rad;
      const lat = Math.atan(-Math.cos(lon - sunLon) / tanSafeSunDec);
      coords.push([lonDeg, lat * deg]);
    }
    coords.push([180, 90]); 
  }
  
  return {
    type: 'FeatureCollection',
    features: [{ type: 'Feature', properties: { level: 0 }, geometry: { type: 'Polygon', coordinates: [coords] } }]
  };
};