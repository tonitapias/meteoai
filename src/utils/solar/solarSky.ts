// src/utils/solar/solarSky.ts
// Color del cel del modal Cicle solar: rampa per alçada GEOMÈTRICA del sol interpolada en OKLab (sense la
// banda "fangosa" que dona barrejar en sRGB), parades del degradat horitzontal del gràfic i les rajoles
// d'estrelles (SVG en data URI) del fons del full. Pur: es pinta un cop per dia i mida, mai per fotograma.
import { geometricAltitude, type SolarDayModel } from './solarDay';

/** Rampa del cel: [alçada geomètrica en graus, color]. Per sota de −18 i per sobre de 30, el color de l'extrem. */
export const SKY_ANCHORS: ReadonlyArray<readonly [number, string]> = [
  [-18, '#05070f'],
  [-12, '#0b1230'],
  [-8, '#16205a'],
  [-5, '#2e2a6b'],
  [-2.5, '#5a3266'],
  [-0.8, '#8a3c4c'],
  [1.5, '#b2522a'],
  [4, '#c17734'],
  [7, '#a98f6a'],    // boirina càlida
  [10, '#6e8aa3'],   // boirina freda
  [16, '#3f6a93'],
  [30, '#2b5585'],
];

/** Color de la targeta on es pinta el gràfic. */
export const SKY_BASE = '#0c0f17';
/** Part del color del cel que entra a la targeta (la resta és SKY_BASE): manté la corba a ≥ 3:1. */
export const SKY_MIX = 0.34;
/** Màxim de parades del degradat del cel. */
export const SKY_MAX_STOPS = 30;

// --- Conversions de color (sRGB ↔ lineal ↔ OKLab) ---

type Vec3 = [number, number, number];

const hexToRgb = (hex: string): Vec3 => {
  const h = hex.charAt(0) === '#' ? hex.slice(1) : hex;
  const full = h.length === 3 ? h.split('').map(c => c + c).join('') : h;
  const n = parseInt(full, 16);
  if (full.length !== 6 || !Number.isFinite(n)) return [0, 0, 0];
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(v => v / 255) as Vec3;
};
const toLinear = (c: number) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
const toGamma = (c: number) => (c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055);
const hex2 = (c: number) => Math.round(Math.min(1, Math.max(0, c)) * 255).toString(16).padStart(2, '0');
const rgbToHex = (rgb: Vec3): string => `#${hex2(rgb[0])}${hex2(rgb[1])}${hex2(rgb[2])}`;

const hexToLinear = (hex: string): Vec3 => hexToRgb(hex).map(toLinear) as Vec3;
const linearToHex = (lin: Vec3): string => rgbToHex(lin.map(c => toGamma(Math.max(0, c))) as Vec3);

/** Lineal sRGB → OKLab (Björn Ottosson). */
const linearToOklab = ([r, g, b]: Vec3): Vec3 => {
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s,
  ];
};
/** OKLab → lineal sRGB. */
const oklabToLinear = ([L, a, b]: Vec3): Vec3 => {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.2914855480 * b) ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s,
  ];
};

/** OKLab d'un color hex (proves i comprovacions de "fang": L i croma C = √(a² + b²)). */
export function hexToOklab(hex: string): { L: number; a: number; b: number; C: number } {
  const [L, a, b] = linearToOklab(hexToLinear(hex));
  return { L, a, b, C: Math.hypot(a, b) };
}

const ANCHOR_LAB: readonly Vec3[] = SKY_ANCHORS.map(([, c]) => linearToOklab(hexToLinear(c)));

/** Color del cel (hex) per a una alçada geomètrica: interpolació OKLab entre àncores; les àncores donen el seu hex exacte. */
export function skyColorAt(geoAlt: number): string {
  const n = SKY_ANCHORS.length;
  if (!(geoAlt > SKY_ANCHORS[0][0])) return SKY_ANCHORS[0][1];          // també NaN
  if (geoAlt >= SKY_ANCHORS[n - 1][0]) return SKY_ANCHORS[n - 1][1];
  let i = 0;
  while (geoAlt >= SKY_ANCHORS[i + 1][0]) i++;
  const [a0, c0] = SKY_ANCHORS[i];
  const t = (geoAlt - a0) / (SKY_ANCHORS[i + 1][0] - a0);
  if (t === 0) return c0;
  const p = ANCHOR_LAB[i], q = ANCHOR_LAB[i + 1];
  return linearToHex(oklabToLinear([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t, p[2] + (q[2] - p[2]) * t]));
}

/** Barreja en sRGB lineal: `k` és la part de `hex` que entra a `base` (0 => base, 1 => hex). */
export function mixLinear(hex: string, base: string, k: number): string {
  const a = hexToLinear(hex), b = hexToLinear(base);
  const w = Math.min(1, Math.max(0, k));
  return linearToHex([b[0] + (a[0] - b[0]) * w, b[1] + (a[1] - b[1]) * w, b[2] + (a[2] - b[2]) * w]);
}

/** Color del cel tal com es pinta darrere de la corba (rampa barrejada amb la targeta). */
export function skyPaintAt(geoAlt: number): string {
  return mixLinear(skyColorAt(geoAlt), SKY_BASE, SKY_MIX);
}

const relLuminance = (hex: string): number => {
  const [r, g, b] = hexToLinear(hex);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

/** Contrast WCAG entre dos colors hex (1..21). */
export function contrastRatio(a: string, b: string): number {
  const la = relLuminance(a), lb = relLuminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

// --- Parades del degradat horitzontal del gràfic ---

const ANCHOR_PAINT: readonly string[] = SKY_ANCHORS.map(([, c]) => mixLinear(c, SKY_BASE, SKY_MIX));

/** Camps del model que necessita el degradat del cel. */
export type SkyModel = Pick<SolarDayModel, 'altApp' | 'spanMin' | 'startMs' | 'noonMin' | 'noonGeo' | 't' | 'nadirGeo'>;

const pct = (min: number, spanMin: number) => Math.round((min / spanMin) * 10000) / 100;

/**
 * Parades "color pos%" del cel al llarg del dia (x = minut / spanMin). Una parada a cada creuament d'àncora
 * (minut interpolat entre mostres), als dos extrems, al migdia i a la mitjanit solar si cau dins del dia (sense
 * aquesta, el mínim d'una nit blanca sortiria més clar). Com a molt SKY_MAX_STOPS. Model sense mostres: ''.
 */
export function skyStopsCss(model: SkyModel): string {
  const { altApp, spanMin } = model;
  const n = altApp.length;
  if (n < 2 || !(spanMin > 0)) return '';
  const geo: number[] = new Array<number>(n);
  for (let i = 0; i < n; i++) geo[i] = geometricAltitude(altApp[i]);
  const step = spanMin / (n - 1);

  // fixed = extrems, migdia i mitjanit: no es descarten mai en retallar.
  const stops: { min: number; color: string; fixed: boolean }[] = [
    { min: 0, color: skyPaintAt(geo[0]), fixed: true },
    { min: spanMin, color: skyPaintAt(geo[n - 1]), fixed: true },
    { min: model.noonMin, color: skyPaintAt(model.noonGeo), fixed: true },
  ];
  const nadir = model.t.nadir;
  if (nadir !== null) {
    const nadirMin = (nadir - model.startMs) / 60000;
    if (nadirMin > 0 && nadirMin < spanMin) stops.push({ min: nadirMin, color: skyPaintAt(model.nadirGeo), fixed: true });
  }
  for (let i = 0; i < n - 1; i++) {
    const g0 = geo[i], g1 = geo[i + 1];
    if (g0 === g1) continue;
    for (let k = 0; k < SKY_ANCHORS.length; k++) {
      const a = SKY_ANCHORS[k][0];
      // Pujant: g0 < a ≤ g1; baixant: g0 > a ≥ g1 (un punt exacte a l'àncora no es compta dues vegades).
      if ((g0 < a && a <= g1) || (g0 > a && a >= g1)) {
        stops.push({ min: (i + (a - g0) / (g1 - g0)) * step, color: ANCHOR_PAINT[k], fixed: false });
      }
    }
  }
  stops.sort((p, q) => p.min - q.min);

  // Parades a la mateixa posició (arrodonida): se'n queda una, preferint la fixa.
  const out: typeof stops = [];
  for (const s of stops) {
    const last = out[out.length - 1];
    if (last && pct(last.min, spanMin) === pct(s.min, spanMin)) {
      if (s.fixed && !last.fixed) out[out.length - 1] = s;
    } else out.push(s);
  }
  // Retall de seguretat (rar: tres trams monòtons que travessen totes les àncores): treu la parada no fixa
  // més enganxada a les veïnes.
  while (out.length > SKY_MAX_STOPS) {
    let best = -1, bestGap = Infinity;
    for (let i = 1; i < out.length - 1; i++) {
      if (out[i].fixed) continue;
      const gap = out[i + 1].min - out[i - 1].min;
      if (gap < bestGap) { bestGap = gap; best = i; }
    }
    if (best < 0) break;
    out.splice(best, 1);
  }
  return out.map(s => `${s.color} ${pct(s.min, spanMin)}%`).join(',');
}

// --- Rajoles d'estrelles del fons del full ---

/** Generador pseudoaleatori amb llavor (mulberry32): mateixa llavor, mateixa seqüència. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Llavor de 32 bits d'un text (FNV-1a). */
export function hashSeed(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export interface StarfieldOpts {
  count: number;
  seed: number;
  /** Color CSS sense '#', p. ex. 'rgb(226,232,240)'. */
  color: string;
  rMin: number; rMax: number;
  aMin: number; aMax: number;
  width?: number; height?: number;
}

const r2 = (v: number) => Math.round(v * 100) / 100;

/**
 * Rajola d'estrelles (SVG 360×220 per defecte) com a data URI: un sol <g> de <circle>, posició amb llavor i
 * y = alt·rand^1.6 perquè la densitat s'esvaeixi cap avall. Codificada amb encodeURIComponent (cap '#' cru).
 */
export function buildStarfieldUri(o: StarfieldOpts): string {
  const w = o.width ?? 360, h = o.height ?? 220;
  const rand = mulberry32(o.seed);
  let circles = '';
  for (let i = 0; i < o.count; i++) {
    const r = o.rMin + rand() * (o.rMax - o.rMin);
    const x = r + rand() * (w - 2 * r);
    const y = r + Math.pow(rand(), 1.6) * (h - 2 * r);
    const a = o.aMin + rand() * (o.aMax - o.aMin);
    circles += `<circle cx="${r2(x)}" cy="${r2(y)}" r="${r2(r)}" fill-opacity="${r2(a)}"/>`;
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">`
    + `<g fill="${o.color}">${circles}</g></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

/** Valor CSS `url("…")` de les estrelles del full de nit (26, blanc pàl·lid). */
export const STARS_NIGHT = `url("${buildStarfieldUri({
  count: 26, seed: 0x5014a, color: 'rgb(226,232,240)', rMin: 0.5, rMax: 1.1, aMin: 0.25, aMax: 0.75,
})}")`;

/** Valor CSS `url("…")` de les estrelles del full de dia (10, daurades i tènues). */
export const STARS_DAY = `url("${buildStarfieldUri({
  count: 10, seed: 0xd1a, color: 'rgb(253,230,138)', rMin: 0.5, rMax: 1.1, aMin: 0.12, aMax: 0.3,
})}")`;
