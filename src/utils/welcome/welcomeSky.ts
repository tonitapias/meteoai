// src/utils/welcome/welcomeSky.ts
// El cel de la benvinguda: on és aproximadament el dispositiu (zona horària, o la posició si ja hi ha permís),
// en quina fase de llum és ara (alba, dia, posta, nit), on va el sol i la lluna a l'òrbita de la columna del cel
// i de quins colors és el fons. Pur, sense React ni xarxa: tot surt del rellotge del dispositiu i de taules fixes.
// Els llocs consultats no hi intervenen mai: el cel és sempre el d'on és el dispositiu.
import * as SunCalc from 'suncalc';
import { geometricAltitude, lightPhase, RISE_SET_GEO, sunTimesForLocalDay } from '../solar/solarDay';
import { SKY_BASE, mixLinear, skyColorAt } from '../solar/solarSky';
import { getMoonPhase, getNamedMoonPhase } from '../lunarPhases';
import { getMoonIlluminationPercent } from '../astronomyMath';
import { TIMEZONE_COORDS } from './timezoneCoords';

export type WelcomePhase = 'alba' | 'dia' | 'posta' | 'nit';

export interface SkyPlace {
  lat: number;
  lon: number;
  /** 'gps': posició del dispositiu (només si ja hi havia permís); 'timezone': ciutat de la zona; 'offset': estimació. */
  source: 'gps' | 'timezone' | 'offset';
}

export interface WelcomeSky {
  phase: WelcomePhase;
  place: SkyPlace;
  /** Hemisferi sud: l'òrbita es mira cap al nord (el sol va de dreta a esquerra) i la lluna es gira. */
  south: boolean;
  /** Angle a l'òrbita en graus (0 = dalt, negatiu = costat est); null si és sota l'horitzó. */
  sunAngle: number | null;
  sunAltitude: number;
  /** El sol és a la meitat est del cel (abans del migdia solar). */
  sunEast: boolean;
  /** Sortida, posta i migdia solar del dia local del dispositiu (ms); null si no n'hi ha (dia o nit polar). */
  sunTimes: { rise: number | null; set: number | null; noon: number | null };
  /** `namePhase`: la fase amb què es diu el nom del dia (getNamedMoonPhase); sense, `phase`. */
  moon: { phase: number; illumination: number; angle: number | null; namePhase?: number };
  colors: { top: string; mid: string; bottom: string; glow: string };
}

// Òrbita de la columna (viewBox 640 × 640): el·lipse de centre (320, 550) i radis 232 × 480; l'horitzó és el
// disc, a y = 500, que la talla on cos(angle) = 50 / 480. Prou alta perquè l'astre, quan culmina (just
// darrere de la columna, al sud), quedi per sobre del capdamunt i no amagat darrere.
export const ORBIT = { cx: 320, cy: 550, rx: 232, ry: 480, horizonY: 500 } as const;
const HORIZON_COS = (ORBIT.cy - ORBIT.horizonY) / ORBIT.ry;
/** Graus per sota del sol on es mira la rampa del cel per al color de dalt de la pantalla. */
const ZENITH_OFFSET = 12;

/**
 * Altura on es mira la rampa per al color de dalt: 12° més avall amb el sol sobre l'horitzó (a la posta, blau
 * fosc i no taronja); sota l'horitzó baixa a mitja velocitat fins a -18° quan el sol és a -12°, perquè a l'hora
 * blava el cel encara sigui blau i no negre de nit. Contínua i sempre creixent amb l'altura del sol.
 */
export function zenithAltitude(sunAlt: number): number {
  if (sunAlt >= 0) return sunAlt - ZENITH_OFFSET;
  if (sunAlt >= -12) return -ZENITH_OFFSET + sunAlt / 2;
  return sunAlt - 6;
}

// Altura del sol → altura on es mira la rampa per a la lluïssor de l'horitzó. A l'alba i a la posta amb el sol
// amagat (fins a -6°), l'horitzó del costat del sol encara és rosat o taronja: la rampa hi va molt a poc a poc.
const GLOW_ANCHORS: ReadonlyArray<readonly [number, number]> = [[-90, -90], [-12, -12], [-6, -1.5], [0, 0], [90, 90]];

/** Altura per al color de la lluïssor de l'horitzó (contínua i sempre creixent amb l'altura del sol). */
export function glowAltitude(sunAlt: number): number {
  const a = Math.max(-90, Math.min(90, sunAlt));
  for (let i = 1; i < GLOW_ANCHORS.length; i++) {
    const [x1, y1] = GLOW_ANCHORS[i];
    if (a <= x1) {
      const [x0, y0] = GLOW_ANCHORS[i - 1];
      return y0 + ((a - x0) / (x1 - x0)) * (y1 - y0);
    }
  }
  return a;
}

const msOf = (d: unknown): number | null => (d instanceof Date && Number.isFinite(d.getTime()) ? d.getTime() : null);

// Latitud típica per continent quan la zona no és a la taula.
const AREA_LAT: Readonly<Record<string, number>> = {
  Europe: 48, Africa: 5, America: 30, Asia: 30, Australia: -30, Pacific: -10,
  Atlantic: 30, Indian: -10, Antarctica: -75, Arctic: 78,
};

/**
 * On és aproximadament el dispositiu segons la seva zona horària: la ciutat de referència de la zona o, si no hi
 * és (UTC, Etc/GMT+3...), la longitud del desfasament estàndard (`stdOffsetMin`, minuts per davant d'UTC, sense
 * horari d'estiu) i la latitud típica del continent.
 */
export function placeFromTimeZone(timeZone: string | undefined, stdOffsetMin: number): SkyPlace {
  const hit = timeZone ? TIMEZONE_COORDS[timeZone] : undefined;
  if (hit) return { lat: hit[0], lon: hit[1], source: 'timezone' };
  const area = timeZone ? timeZone.split('/')[0] : '';
  const lon = Math.max(-180, Math.min(180, stdOffsetMin / 4));
  return { lat: AREA_LAT[area] ?? 30, lon, source: 'offset' };
}

/** Fase de la benvinguda: les mateixes franges de llum que el modal Solar, amb alba o posta segons el costat. */
export function welcomePhase(geoAltitude: number, morning: boolean): WelcomePhase {
  const light = lightPhase(geoAltitude);
  if (light === 'day') return 'dia';
  if (light === 'golden' || light === 'blue') return morning ? 'alba' : 'posta';
  return 'nit';
}

/**
 * Angle d'un astre a l'òrbita: toca l'horitzó quan surt i es pon i és dalt de tot a la culminació (`peak`), sigui
 * l'època de l'any que sigui. null per sota de l'horitzó.
 */
export function orbitAngle(altitude: number, peak: number, east: boolean): number | null {
  if (!(altitude > RISE_SET_GEO)) return null;
  const f = Math.min(1, (altitude - RISE_SET_GEO) / Math.max(1, peak - RISE_SET_GEO));
  const angle = (Math.acos(HORIZON_COS + (1 - HORIZON_COS) * f) * 180) / Math.PI;
  return east ? -angle : angle;
}

/** Punt de l'òrbita per a un angle (graus), en coordenades del viewBox. */
export function orbitPoint(angleDeg: number): [number, number] {
  const a = (angleDeg * Math.PI) / 180;
  return [ORBIT.cx + ORBIT.rx * Math.sin(a), ORBIT.cy - ORBIT.ry * Math.cos(a)];
}

/** Declinació solar aproximada (graus): n'hi ha prou per saber fins on puja el sol a migdia. */
function solarDeclination(date: Date): number {
  const start = Date.UTC(date.getUTCFullYear(), 0, 0);
  const day = (date.getTime() - start) / 86400000;
  return 23.44 * Math.sin(((2 * Math.PI) / 365) * (day - 81));
}

export function computeWelcomeSky(now: Date, place: SkyPlace): WelcomeSky {
  const sun = SunCalc.getPosition(now, place.lat, place.lon);
  const sunAltitude = geometricAltitude(sun.altitude);
  // Abans del migdia solar el sol és a la meitat est del cel (azimut < 180°), als dos hemisferis.
  const sunEast = sun.azimuth < 180;
  const peak = 90 - Math.abs(place.lat - solarDeclination(now));
  const phase = welcomePhase(sunAltitude, sunEast);

  const moonPhase = getMoonPhase(now);
  const moonPos = SunCalc.getMoonPosition(now, place.lat, place.lon);
  const illumination = Number.isFinite(moonPhase) ? getMoonIlluminationPercent(moonPhase) : 0;
  // De dia no es dibuixa: la columna només ensenya la lluna quan el sol no hi és, i si no és lluna nova.
  const moonAngle = phase !== 'dia' && illumination > 2
    ? orbitAngle(moonPos.altitude, Math.max(20, 90 - Math.abs(place.lat)), moonPos.azimuth < 180)
    : null;

  // El fons fa servir el color del zenit (zenithAltitude: a la posta, blau fosc i no taronja), i el de
  // l'horitzó queda per a la lluïssor darrere la columna, com al cel de debò.
  const horizon = skyColorAt(glowAltitude(sunAltitude));
  const zenith = skyColorAt(zenithAltitude(sunAltitude));
  const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const dayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).getTime();
  const times = sunTimesForLocalDay(dayStart, dayEnd, place.lat, place.lon);
  return {
    phase,
    place,
    south: place.lat < 0,
    sunAngle: orbitAngle(sunAltitude, peak, sunEast),
    sunAltitude,
    sunEast,
    sunTimes: { rise: msOf(times?.sunrise), set: msOf(times?.sunset), noon: msOf(times?.solarNoon) },
    moon: { phase: Number.isFinite(moonPhase) ? moonPhase : 0, illumination, angle: moonAngle, namePhase: getNamedMoonPhase(now) },
    colors: {
      top: mixLinear(zenith, '#03050b', 0.7),
      mid: mixLinear(zenith, SKY_BASE, 0.35),
      bottom: SKY_BASE,
      glow: horizon,
    },
  };
}
