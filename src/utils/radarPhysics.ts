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

// --- FONT ÚNICA DE VERITAT: Overlays ---
// Abans hi havia 4 formes estructurals diferents d'aquest mateix objecte
// disperses per useMapLifecycle, useCameraFlight, useRadarAnimation i
// RadarLayerMenu. Ara tots els hooks/components importen aquesta única
// interfície.
export interface Overlays {
  precip: boolean;
  satIR: boolean;
  hdGoes: boolean;
  hdMeteosat: boolean;
  hdHimawari: boolean;
  night: boolean;
  labels: boolean;
  nasaReal: boolean;
  nasaFires: boolean;
  terrain3D: boolean;
}

// CORRECCIÓ (revisió Fase 3): es va intentar definir GeoFeatureCollection
// com a àlies directe de GeoJSON.FeatureCollection (namespace ambient de
// @types/geojson), assumint que seria resoluble transitivament via
// @types/mapbox-gl. La compilació real al projecte ha demostrat que aquest
// namespace NO és resoluble en aquest entorn concret. Es manté, doncs, una
// interfície pròpia i autònoma que no depèn de cap paquet de tipus extern
// — exactament com a l'original, però centralitzada en un únic lloc.
export interface GeoFeatureCollection {
  type: 'FeatureCollection';
  features: Array<{
    type: 'Feature';
    properties: { level: number };
    geometry: {
      type: 'Polygon';
      coordinates: number[][][];
    };
  }>;
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
// MOTOR ASTRONÒMIC ÚNIC (Alt Rendiment V8 Math)
// Abans: aquesta mateixa seqüència de càlcul (dia julià, anomalia mitjana,
// equació del centre, longitud eclíptica, declinació, ascensió recta) estava
// duplicada literalment en 3 llocs (aquí dues vegades i a useAstroEngine.ts
// una tercera). Ara hi ha un únic punt de veritat: computeSolarEphemeris.
// =========================================================================

interface SolarEphemeris {
  sunDec: number;   // Declinació solar, en radians
  sunRA: number;    // Ascensió recta solar, en radians
  gmstDeg: number;  // Temps sideral mitjà de Greenwich, en graus
}

const computeSolarEphemeris = (timestamp: number): SolarEphemeris => {
  const PI = Math.PI;
  const rad = PI / 180;
  const deg = 180 / PI;

  const jd = timestamp / 86400000 + 2440587.5;
  const d = jd - 2451545.0;

  const M = (357.5291 + 0.98560028 * d) * rad;
  const sinM = Math.sin(M);
  const C = (1.9148 * sinM + 0.0200 * Math.sin(2 * M) + 0.0003 * Math.sin(3 * M)) * rad;
  const L = ((280.4665 + 0.98564736 * d + C * deg) % 360) * rad;
  const e = 23.439 * rad;

  const sinL = Math.sin(L);
  const cosL = Math.cos(L);
  const sunDec = Math.asin(Math.sin(e) * sinL);
  const sunRA = Math.atan2(Math.cos(e) * sinL, cosL);

  const gmstDeg = (280.46061837 + 360.98564736629 * d) % 360;

  return { sunDec, sunRA, gmstDeg };
};

/**
 * Calcula l'altitud i l'azimut solar (en graus) per a un instant i una
 * coordenada geogràfica concreta. Substitueix la funció local `getSunAltitude`
 * que abans vivia duplicada dins useAstroEngine.ts.
 */
export const getSunAltAz = (timestamp: number, lat: number, lon: number): { altitude: number; azimuth: number } => {
  const PI = Math.PI;
  const rad = PI / 180;
  const deg = 180 / PI;

  const { sunDec, sunRA, gmstDeg } = computeSolarEphemeris(timestamp);

  let lmstDeg = (gmstDeg + lon) % 360;
  if (lmstDeg < 0) lmstDeg += 360;
  const lmstRad = lmstDeg * rad;

  const hourAngle = lmstRad - sunRA;
  const latRad = lat * rad;

  const sinLat = Math.sin(latRad);
  const cosLat = Math.cos(latRad);
  const sinSunDec = Math.sin(sunDec);
  const cosSunDec = Math.cos(sunDec);

  const sinAlt = sinLat * sinSunDec + cosLat * cosSunDec * Math.cos(hourAngle);
  const alt = Math.asin(sinAlt);

  const cosAlt = Math.cos(alt);
  const cosAz = cosAlt === 0 ? 0 : (sinSunDec - sinLat * sinAlt) / (cosLat * cosAlt);
  const safeCosAz = Math.max(-1, Math.min(1, cosAz));
  let az = Math.acos(safeCosAz);

  if (Math.sin(hourAngle) > 0) {
    az = 2 * PI - az;
  }

  return { altitude: alt * deg, azimuth: az * deg };
};

/** Longitud subsolar (radians), normalitzada a [-PI, PI]. Ús: terminador de nit. */
export const getSubsolarLongitude = (timestamp: number): number => {
  const PI = Math.PI;
  const rad = PI / 180;
  const { sunRA, gmstDeg } = computeSolarEphemeris(timestamp);
  const gmst = gmstDeg * rad;

  let sunLon = sunRA - gmst;
  while (sunLon < -PI) sunLon += 2 * PI;
  while (sunLon > PI) sunLon -= 2 * PI;
  return sunLon;
};

/** Declinació subsolar (radians). Ús: terminador de nit. */
export const getSubsolarDeclination = (timestamp: number): number => {
  return computeSolarEphemeris(timestamp).sunDec;
};

export const getSunLightConfig = (timestamp: number, lat: number, lon: number): { position: [number, number, number], intensity: number } => {
  const { altitude: altDeg, azimuth: azDeg } = getSunAltAz(timestamp, lat, lon);

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
  const rad = Math.PI / 180;
  const deg = 180 / Math.PI;

  const sunDec = getSubsolarDeclination(timestamp);
  const sunLon = getSubsolarLongitude(timestamp);

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