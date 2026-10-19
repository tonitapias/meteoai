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
  // Llamps del Lightning Imager de MTG (Europa, Àfrica i Atlàntic).
  lightning: boolean;
  // Meteosat HD en color (GeoColour) en lloc d'infraroig.
  meteosatColour: boolean;
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
  // Àncora entre el radar (per sota) i els llamps (per sobre): cada capa de
  // radar nova s'insereix just sota aquesta, i les de llamps just sota les
  // etiquetes, de manera que un fotograma de radar afegit més tard mai tapa
  // els llamps.
  PIS_5B_LIGHTNING: 'z-index-lightning',
  PIS_6_UI: 'layer-labels'
} as const;

// --- SATÈL·LITS HD ---
export type HdAgency = 'goes' | 'meteosat' | 'himawari';

// VITE_SAT_PROXY_HOST: només per provar en local un worker de `wrangler dev`
// (p. ex. a .env.development.local, que no es puja).
export const SAT_PROXY_HOST: string = import.meta.env.VITE_SAT_PROXY_HOST || 'https://meteo-sat-proxy.tonitapias.workers.dev';

// Límits MSG [oest, sud, est, nord]. Mapbox demana tessel·les SENCERES que
// toquin els límits, així que la vora real depèn del zoom: 66.4°N queda just
// per sota del 66.51°N, que és frontera de tessel·la a tots els zooms, així
// que la vora nord és 66.51°N a z2–z8. Més amunt MSG es converteix en franges
// de 14–19 km i de nit EUMETSAT pinta una franja blanca saturada a prop del
// limbe. Oest -40 (Açores senceres); est 60 per la mateixa franja a l'est.
const MSG_BOUNDS: [number, number, number, number] = [-40, -60, 60, 66.4];
// MTG té dades llegibles fins a 77°N entre 40°O i 40°E (71,4°N a 60°E): 72°N
// cobreix el Cap Nord (71,2°N) sense la franja del limbe.
const MTG_BOUNDS: [number, number, number, number] = [-40, -60, 60, 72];

// [oest, sud, est, nord] de cada font HD i zona on la càmera considera que
// l'usuari ja hi és (useCameraFlight). Meteosat = MTG (el més ampli); amb la
// reserva MSG la font fa servir MSG_BOUNDS (HD_VARIANTS).
export const HD_BOUNDS: Record<HdAgency, [number, number, number, number]> = {
  goes: [-160, -60, -20, 60],
  meteosat: MTG_BOUNDS,
  himawari: [80, -60, 180, 60]
};

// Variant de la font HD: MTG (Meteosat-12, imatge cada 10 min), MTG en color
// (GeoColour), MSG (el Meteosat actual, reserva fins al 2027) o GIBS
// (GOES/Himawari via NASA).
export type HdVariant = 'mtg' | 'mtgColour' | 'msg' | 'gibs';

interface HdVariantConfig {
  cadenceSec: number;
  // Ruta del worker; GIBS hi afegeix l'agència (hd/goes, hd/himawari).
  route: string;
  bounds?: [number, number, number, number];
  saturation: number;
  contrast: number;
  brightnessMin: number;
  // Fotografia opaca (GeoColour) en lloc d'IR: opacitat pròpia i per sobre
  // del filtre de nit, perquè la imatge ja porta la nit (núvols IR sobre
  // llums de ciutat) i el filtre l'enfosquiria dues vegades.
  colour?: boolean;
}

// Pintura: MSG i MTG són IR en blanc i negre; MTG té ~20 % menys contrast a la
// part brillant i només apujar el contrast enfosqueix la meitat de la imatge,
// per això va amb una lluminositat mínima (simulat sobre tessel·les reals:
// talla menys núvols que MSG avui amb un 89–96 % del contrast percebut).
// GIBS ve amb una paleta realçada (verd/blau/vermell per a tempestes fortes)
// que la saturació -1 esborraria. GeoColour es mostra tal com ve.
export const HD_VARIANTS: Record<HdVariant, HdVariantConfig> = {
  mtg: { cadenceSec: 600, route: 'hd/mtg/v1', bounds: MTG_BOUNDS, saturation: -1, contrast: 0.47, brightnessMin: 0.16 },
  mtgColour: { cadenceSec: 600, route: 'hd/mtg/geocolour/v1', bounds: MTG_BOUNDS, saturation: 0, contrast: 0, brightnessMin: 0, colour: true },
  msg: { cadenceSec: 900, route: 'hd/meteosat', bounds: MSG_BOUNDS, saturation: -1, contrast: 0.3, brightnessMin: 0 },
  gibs: { cadenceSec: 3600, route: 'hd', saturation: 0, contrast: 0.3, brightnessMin: 0 }
};

const SlotLatestSchema = z.object({
  latest: z.number().int().positive(),
  cadence: z.number().int().positive(),
  source: z.enum(['caps', 'computed']),
});

// Resposta de /hd/meteosat/latest (worker meteo-sat-proxy): quina capa fa
// servir el worker (MTG, o MSG si MTG va endarrerit o l'interruptor ho
// força) i la franja més nova que es pot demanar. `colour`: la de GeoColour,
// null si no està disponible (llavors el mode color mostra l'IR); absent en
// un worker anterior.
export const HdTimelineSchema = SlotLatestSchema.extend({
  layer: z.enum(['mtg', 'msg']),
  colour: SlotLatestSchema.nullable().optional(),
});
export type HdTimeline = z.infer<typeof HdTimelineSchema>;

// Resposta de /lightning/latest: null si el Lightning Imager va endarrerit
// més d'1 h (la capa i l'avís de llamps no es mostren).
export const LightningLatestSchema = SlotLatestSchema.nullable();
export type LightningLatest = z.infer<typeof LightningLatestSchema>;

// Sense /latest: una hora segura (ara − 30 min), com fa el mateix worker.
export const HD_COMPUTED_LAG_SEC = 1800;

const floorTo = (t: number, step: number) => Math.floor(t / step) * step;

// Franja Meteosat d'un fotograma de radar: la de la mateixa desena de minuts
// (quinzena amb MSG), o la més nova publicada si encara no hi és. Totes les
// franges són exactes al worker (memòria cau d'un any) i els fotogrames més
// nous que `latest` comparteixen una sola font. En color, GeoColour si el
// worker en dona franja (o si no s'ha pogut consultar: hora calculada); si la
// marca com a no disponible o fa servir MSG, l'IR.
export function computeMeteosatSlot(
  frameTime: number,
  timeline: HdTimeline | null,
  nowSec: number,
  colour: boolean = false
): { variant: 'mtg' | 'mtgColour' | 'msg'; slot: number } {
  const colourLatest = timeline?.colour;
  const useColour = colour && (timeline === null || (timeline.layer === 'mtg' && !!colourLatest));
  const variant = useColour ? 'mtgColour' : timeline?.layer ?? 'mtg';
  const source = useColour ? colourLatest : timeline;
  const cadence = source?.cadence ?? HD_VARIANTS[variant].cadenceSec;
  const latest = source ? floorTo(source.latest, cadence) : floorTo(nowSec - HD_COMPUTED_LAG_SEC, cadence);
  return { variant, slot: Math.min(floorTo(frameTime, cadence), latest) };
}

// --- LLAMPS (MTG Lightning Imager, àrea de llamps acumulada en 5 min) ---
export const LIGHTNING_STEP_SEC = 300;
export const LIGHTNING_ROUTE = 'lightning/v1';
// Camp de visió del Lightning Imager: Europa, Àfrica, l'Atlàntic i l'est de
// Sud-amèrica, amb el mateix nord que la capa HD.
export const LIGHTNING_BOUNDS: [number, number, number, number] = [-60, -60, 60, 72];

// Franges de llamps d'un fotograma de radar (cada 10 min): les dues de 5 min
// que l'envolten, [T − 5, T + 5), de manera que cada llamp surt en un sol
// fotograma del bucle. Sense passar de la més nova publicada; buit si el
// Lightning Imager no està disponible (`latest` null).
export function computeLightningSlots(frameTime: number, latest: LightningLatest | undefined, nowSec: number): number[] {
  if (latest === null) return [];
  const newest = latest ? floorTo(latest.latest, LIGHTNING_STEP_SEC) : floorTo(nowSec - HD_COMPUTED_LAG_SEC, LIGHTNING_STEP_SEC);
  const base = floorTo(frameTime, LIGHTNING_STEP_SEC);
  return [...new Set([base - LIGHTNING_STEP_SEC, base].map((s) => Math.min(s, newest)))];
}

// Franja GIBS (GOES/Himawari): el frame de satèl·lit de LibreWXR més proper,
// com sempre. Si LibreWXR no en dona (p. ex. només hi ha RainViewer), l'hora
// anterior: el worker hi aplica el seu propi recul.
export function computeGibsSlot(frameTime: number, satFrames: RadarFrame[]): number {
  let closest: number | null = null;
  let minDiff = Infinity;
  satFrames.forEach((f) => {
    if (!f || f.time === null) return;
    const diff = Math.abs(f.time - frameTime);
    if (diff < minDiff) { minDiff = diff; closest = f.time; }
  });
  return closest ?? floorTo(frameTime, 3600) - 3600;
}

// --- FÍSICA VISUAL I MATEMÀTIQUES ---

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

// GeoColour (Meteosat HD en color) és una fotografia opaca: plena fins a z6,
// perquè l'IR (getSatOpacityExp) deixa veure el mapa base a través i, en una
// foto, això la rentaria; a partir d'aquí s'esvaeix cap al mapa base, que té
// més detall que la imatge de 0,5–1 km.
export const getHdColourOpacityExp = (baseOp: number): Expression => {
  return [
    'interpolate', ['linear'], ['zoom'],
    2, baseOp,
    6, baseOp * 0.95,
    8, baseOp * 0.6,
    10, baseOp * 0.2,
    12, 0
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