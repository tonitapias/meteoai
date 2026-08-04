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

// --- CONSTANTS NOVES (3D Terrain) ---
export const MAPBOX_DEM_URL = 'mapbox://mapbox.mapbox-terrain-dem-v1';

// --- FÍSICA VISUAL I MATEMÀTIQUES ---

export const getNASADate = (): string => {
  const d = new Date();
  // Doctrina Risc Zero: -2 dies (48h). El procés "Corrected Reflectance (True Color)" 
  // de VIIRS triga fins a 48h a acoblar-se globalment al 100%.
  // Demanar ahir (-1) genera errors 404 massius en els forats encara no processats, ofegant la xarxa.
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() - 2); 
  return d.toISOString().split('T')[0];
};

export const getNasaFiresDate = (): string => {
  const d = new Date();
  // Doctrina Risc Zero: -1 dia (Ahir) per garantir cobertura global.
  // Els incendis (Thermal Anomalies) es processen molt més ràpid que l'òptica.
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() - 1); 
  return d.toISOString().split('T')[0];
};

export const getBlackMarbleUrl = (): string => {
  // Risc Zero Rollback: El "Black Marble" és un mosaic global estàtic. 
  // No admet data diària. Hem de deixar el paràmetre de temps buit (//) 
  // per evitar errors 404 i bloquejos de CORS de la NASA.
  return 'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/VIIRS_Black_Marble/default//GoogleMapsCompatible_Level8/{z}/{y}/{x}.png';
};

// WMS Dinàmica Anti-404 amb "Truc Retina" (WIDTH=512 & HEIGHT=512)
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
    2, baseOp * 0.90,
    5, baseOp * 0.75,
    8, baseOp * 0.35, 
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
    5, baseOp * 0.9,
    8, baseOp * 0.7,    
    11, 0               
  ];
};

export const computeNightFeatures = (timestamp: number): GeoFeatureCollection => {
  const PI = Math.PI;
  const rad = PI / 180;
  const deg = 180 / PI;
  const date = new Date(timestamp);
  const jd = date.getTime() / 86400000 + 2440587.5;
  const d = jd - 2451545.0; 
  const M = (357.5291 + 0.98560028 * d) * rad;
  const C = (1.9148 * Math.sin(M) + 0.0200 * Math.sin(2 * M) + 0.0003 * Math.sin(3 * M)) * rad;
  const L = (280.4665 + 0.98564736 * d + C * deg) % 360 * rad; 
  const e = 23.439 * rad; 
  const sunDec = Math.asin(Math.sin(e) * Math.sin(L));
  const sunRA = Math.atan2(Math.cos(e) * Math.sin(L), Math.cos(L));
  const gmst = (280.46061837 + 360.98564736629 * d) % 360 * rad;
  
  let sunLon = sunRA - gmst;
  while (sunLon < -PI) sunLon += 2 * PI;
  while (sunLon > PI) sunLon -= 2 * PI;
  
  const coords: number[][] = [];
  const safeSunDec = sunDec === 0 ? 0.000001 : sunDec;
  
  if (safeSunDec > 0) {
    coords.push([-180, -90], [180, -90]);
    for (let lonDeg = 180; lonDeg >= -180; lonDeg -= 1) {
      const lon = lonDeg * rad;
      const lat = Math.atan(-Math.cos(lon - sunLon) / Math.tan(safeSunDec));
      coords.push([lonDeg, lat * deg]);
    }
    coords.push([-180, -90]); 
  } else {
    coords.push([180, 90], [-180, 90]);
    for (let lonDeg = -180; lonDeg <= 180; lonDeg += 1) {
      const lon = lonDeg * rad;
      const lat = Math.atan(-Math.cos(lon - sunLon) / Math.tan(safeSunDec));
      coords.push([lonDeg, lat * deg]);
    }
    coords.push([180, 90]); 
  }
  
  return {
    type: 'FeatureCollection',
    features: [{ type: 'Feature', properties: { level: 0 }, geometry: { type: 'Polygon', coordinates: [coords] } }]
  };
};