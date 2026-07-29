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
// S'Afegeix 'black_marble' als tipus per mantenir el TypeScript estricte
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

// --- FÍSICA VISUAL I MATEMÀTIQUES ---

export const getNASADate = (): string => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 1); 
  return d.toISOString().split('T')[0];
};

export const getBlackMarbleUrl = (): string => {
  // Capa global "Black Marble" de la NASA lliure de núvols (VIIRS).
  // Resolució nativa fins a nivell 8 en Web Mercator (EPSG:3857).
  return 'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/VIIRS_Black_Marble/default//GoogleMapsCompatible_Level8/{z}/{y}/{x}.png';
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
    8, baseOp * 0.3,    // A Z8 s'assoleix la resolució màxima de la NASA
    10, 0               // S'esvaeix suaument abans de pixelar-se
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