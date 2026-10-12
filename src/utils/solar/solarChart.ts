// src/utils/solar/solarChart.ts
// Geometria del gràfic "Alçada del sol" (unitats = px CSS): escales, traç de la corba, estrelles, reixa,
// etiquetes, fons del cel (capes CSS sobre .sm-plot, 0 nodes) i conversió punter/teclat → minut. Pur: es
// calcula quan canvien el dia o la mida, mai durant l'arrossegament.
import { geometricAltitude, refractionDeg, type HourLabel, type SolarDayModel } from './solarDay';
import { SKY_BASE, type SkyModel, hashSeed, mulberry32, skyStopsCss } from './solarSky';
import { degText } from './solarFormat';

/** Alçada mínima de l'eix Y (fi del crepuscle astronòmic). */
export const ALT_MIN = -18;
/** Marges interns del gràfic (px): etiquetes Y a l'esquerra, etiquetes X a sota. */
export const CHART_PAD = { left: 34, right: 14, top: 14, bottom: 20 } as const;

export interface ChartLayout {
  W: number; H: number; altMax: number; spanMin: number;
  left: number; right: number; top: number; bottom: number;
  /** Amplada útil (right − left). */
  pw: number;
  /** y de l'horitzó, y(0). */
  yH: number;
  /** x d'un minut del dia (0..spanMin). */
  x(min: number): number;
  /** y d'una alçada APARENT (l'escala de la corba), retallada a [−18, altMax]. */
  y(alt: number): number;
  /** y d'una alçada GEOMÈTRICA (llindars de fase): y(apparentAltitude(geo)). */
  yGeo(geo: number): number;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const r1 = (v: number) => Math.round(v * 10) / 10;
const f1 = (v: number) => r1(v).toFixed(1);

/**
 * Alçada aparent (la de getPosition) d'una alçada geomètrica: la mateixa refracció que suncalc 2.0.1
 * (Meeus 16.4, amb h < 0 => h = 0). Inversa de geometricAltitude().
 */
export function apparentAltitude(geoDeg: number): number {
  return geoDeg + refractionDeg(geoDeg);
}

/** Escales del gràfic: Y lineal contínua de −18° a altMax, X lineal en minuts del dia local real (DST). */
export function chartLayout(W: number, H: number, altMax: number, spanMin: number): ChartLayout {
  const span = spanMin > 0 ? spanMin : 1440;
  const top = CHART_PAD.top;
  const left = CHART_PAD.left;
  const right = Math.max(left + 1, W - CHART_PAD.right);
  const bottom = Math.max(top + 1, H - CHART_PAD.bottom);
  const am = altMax > 0 ? altMax : 30;
  const pw = right - left;
  const x = (min: number) => left + (min / span) * pw;
  const y = (alt: number) => bottom - ((clamp(alt, ALT_MIN, am) - ALT_MIN) / (am - ALT_MIN)) * (bottom - top);
  return {
    W, H, altMax: am, spanMin: span, left, right, top, bottom, pw,
    yH: y(0), x, y, yGeo: (geo: number) => y(apparentAltitude(geo)),
  };
}

type CurveModel = Pick<SolarDayModel, 'altApp' | 'spanMin'>;

/** Corba de les 97 mostres aparents: una "M" i 96 "L", coordenades amb 1 decimal. Model lite: ''. */
export function curvePath(model: CurveModel, L: ChartLayout): string {
  const n = model.altApp.length;
  if (n < 2) return '';
  let d = '';
  for (let i = 0; i < n; i++) {
    d += `${i === 0 ? 'M' : 'L'}${f1(L.x((i * model.spanMin) / (n - 1)))},${f1(L.y(model.altApp[i]))}`;
  }
  return d;
}

/** Llavor de les estrelles del gràfic: depèn del dia i del lloc (mateix dia => mateixes estrelles). */
export function starSeed(model: Pick<SolarDayModel, 'dateStr' | 'lat' | 'lon'>): number {
  return hashSeed(`${model.dateStr}|${model.lat.toFixed(3)}|${model.lon.toFixed(3)}`);
}

/** Alçada geomètrica per sota de la qual hi ha estrelles al gràfic (nit astronòmica o crepuscle astronòmic). */
export const STAR_MAX_GEO = -12;
const STAR_AREA_PX2 = 1500;
const STAR_MAX = 30;

/**
 * Estrelles del gràfic en un sol <path> de cercles petits (r 0.6–1.1): només a les franges de temps on les
 * dues mostres veïnes tenen alçada geomètrica < −12, amb y ∈ [top + 4, yH − 10]. Una estrella per cada
 * 1500 px² d'aquesta zona, com a molt 30.
 */
export function starsPath(model: CurveModel, L: ChartLayout, seed: number): string {
  const n = model.altApp.length;
  const yTop = L.top + 4, yBot = L.yH - 10;
  if (n < 2 || yBot <= yTop) return '';
  const segs: [number, number][] = [];
  let prevDark = geometricAltitude(model.altApp[0]) < STAR_MAX_GEO;
  for (let i = 0; i < n - 1; i++) {
    const nextDark = geometricAltitude(model.altApp[i + 1]) < STAR_MAX_GEO;
    if (prevDark && nextDark) {
      const a = L.x((i * model.spanMin) / (n - 1)), b = L.x(((i + 1) * model.spanMin) / (n - 1));
      const last = segs[segs.length - 1];
      if (last && last[1] === a) last[1] = b; else segs.push([a, b]);
    }
    prevDark = nextDark;
  }
  const width = segs.reduce((s, [a, b]) => s + (b - a), 0);
  const count = Math.min(STAR_MAX, Math.round((width * (yBot - yTop)) / STAR_AREA_PX2));
  if (count <= 0) return '';
  const rand = mulberry32(seed);
  let d = '';
  for (let k = 0; k < count; k++) {
    let u = rand() * width;
    let x = segs[segs.length - 1][1];
    for (const [a, b] of segs) {
      if (u <= b - a) { x = a + u; break; }
      u -= b - a;
    }
    const y = yTop + rand() * (yBot - yTop);
    const r = r1(0.6 + rand() * 0.5);
    d += `M${f1(x - r)},${f1(y)}a${r},${r} 0 1,0 ${r1(2 * r)},0a${r},${r} 0 1,0 -${r1(2 * r)},0`;
  }
  return d;
}

export type TextAnchor = 'start' | 'middle' | 'end';
export interface ChartLabel { x: number; y: number; text: string; anchor: TextAnchor }

const WIDE_PLOT_PX = 420;
const MAIN_TICKS: ReadonlySet<HourLabel> = new Set<HourLabel>(['00', '06', '12', '18', '24']);

/**
 * Etiquetes de l'eix X a partir de les marques horàries reals del model (correctes els dies de canvi d'hora):
 * 00 06 12 18 24 si el gràfic fa < 420 px d'ample, si no cada 3 h. Primera ancorada a l'inici, última al final.
 */
export function xAxisLabels(model: Pick<SolarDayModel, 'hourTicks'>, L: ChartLayout): ChartLabel[] {
  const ticks = L.pw < WIDE_PLOT_PX ? model.hourTicks.filter(tk => MAIN_TICKS.has(tk.label)) : model.hourTicks;
  return ticks.map((tk, i) => ({
    x: r1(L.x(tk.min)),
    y: r1(L.bottom + 14),
    text: tk.label,
    anchor: i === 0 ? 'start' : i === ticks.length - 1 ? 'end' : 'middle',
  }));
}

const Y_LABEL_ALTS = [60, 30, 0, ALT_MIN] as const;


/** Etiquetes de l'eix Y (60°, 30°, 0°, −18°; només les que no passen d'altMax), alineades a la dreta a left − 6. */
export function yAxisLabels(L: ChartLayout): ChartLabel[] {
  return Y_LABEL_ALTS.filter(a => a <= L.altMax).map(a => ({
    x: r1(L.left - 6), y: r1(L.y(a) + 4), text: degText(a), anchor: 'end' as const,
  }));
}

/**
 * Reixa en dos <path>: verticals a les marques horàries interiors (les mateixes que l'eix X) i horitzontals
 * a 30° i 60° (cadascuna només si és ≤ altMax − 4, perquè no toqui el sostre).
 */
export function gridPaths(model: Pick<SolarDayModel, 'hourTicks'>, L: ChartLayout): { hours: string; alts: string } {
  const labels = xAxisLabels(model, L);
  let hours = '';
  for (let i = 1; i < labels.length - 1; i++) hours += `M${f1(labels[i].x)},${f1(L.top)}V${f1(L.bottom)}`;
  let alts = '';
  for (const a of [30, 60]) if (a <= L.altMax - 4) alts += `M${f1(L.left)},${f1(L.y(a))}H${f1(L.right)}`;
  return { hours, alts };
}

export interface PlotBackground { backgroundImage: string; backgroundSize: string; backgroundPosition: string }

const px = (v: number) => `${r1(v)}px`;

/**
 * Fons del gràfic com a capes CSS de .sm-plot (0 nodes, es pinta un cop per dia i mida), de dalt a baix:
 * enfosquiment de la cúpula, color real del cel a cada hora (x = temps) i, sota l'horitzó, les tres bandes
 * de crepuscle (civil, nàutic, astronòmic) amb les vores als llindars geomètrics −6/−12/−18.
 */
export function plotBackground(
  model: SkyModel, L: ChartLayout
): PlotBackground {
  const stops = skyStopsCss(model) || `${SKY_BASE} 0%,${SKY_BASE} 100%`;
  const skyH = L.yH - L.top, bandH = L.bottom - L.yH;
  const b1 = px(L.yGeo(-6) - L.yH), b2 = px(L.yGeo(-12) - L.yH), b3 = px(L.yGeo(-18) - L.yH);
  const tw = (a: string) => `rgba(129,140,248,${a})`;
  return {
    backgroundImage:
      'linear-gradient(180deg,rgba(5,7,15,.62) 0%,rgba(5,7,15,.25) 55%,rgba(5,7,15,0) 100%),'
      + `linear-gradient(90deg,${stops}),`
      + `linear-gradient(180deg,${tw('.16')} 0,${tw('.16')} ${b1},${tw('.10')} ${b1},${tw('.10')} ${b2},`
      + `${tw('.05')} ${b2},${tw('.05')} ${b3},rgba(129,140,248,0) ${b3})`,
    backgroundSize: `${px(L.pw)} ${px(skyH)},${px(L.pw)} ${px(skyH)},${px(L.pw)} ${px(bandH)}`,
    backgroundPosition: `${px(L.left)} ${px(L.top)},${px(L.left)} ${px(L.top)},${px(L.left)} ${px(L.yH)}`,
  };
}

export interface ClipRect { x: number; y: number; w: number; h: number }
export interface ChartPoint { x: number; y: number }

/** Tot el que dibuixa l'SVG estàtic del gràfic (SolarChartSvg), ja arrodonit a 0.1 px. */
export interface ChartGeom {
  W: number; H: number;
  /** Retalls per acolorir la corba per fase: dia (≥ 6°), daurada [−4, 6), blava [−6, −4); i el de l'halo. */
  clip: { day: ClipRect; gold: ClipRect; blue: ClipRect; halo: ClipRect };
  stars: string;
  grid: { hours: string; alts: string };
  horizon: { x1: number; x2: number; y: number };
  /** Línia vertical del migdia fins a l'horitzó; null si el sol no passa de 2°. */
  noonLine: { x: number; y1: number; y2: number } | null;
  curve: string;
  /** Punts de sortida i posta a l'horitzó; null si cauen fora del dia o el dia és polar. */
  riseDot: ChartPoint | null;
  setDot: ChartPoint | null;
  /** Hores sota els punts; totes dues null si queden a menys de 44 px. */
  riseLabel: ChartLabel | null;
  setLabel: ChartLabel | null;
  noonLabel: ChartLabel;
  yLabels: ChartLabel[];
  xLabels: ChartLabel[];
}

type GeomModel = Pick<SolarDayModel,
  'dateStr' | 'lat' | 'lon' | 'altApp' | 'spanMin' | 'startMs' | 'endMs' | 'hourTicks' | 't'
  | 'polar' | 'riseLabel' | 'setLabel' | 'noonMin' | 'noonAltApp'>;

const EDGE_LABEL_INSET = 16;
const EDGE_LABEL_MIN_GAP = 44;

/** Geometria completa de l'SVG del gràfic per a un dia i una mida. */
export function buildChartGeom(model: GeomModel, L: ChartLayout, seed: number = starSeed(model)): ChartGeom {
  const yDay = L.yGeo(6), yGold = L.yGeo(-4), yBlue = L.yGeo(-6);
  const clipTop = L.top - 4;
  const rect = (y0: number, y1: number): ClipRect => ({ x: 0, y: r1(y0), w: r1(L.W), h: r1(Math.max(0, y1 - y0)) });

  const yH = r1(L.yH);
  const edge = (ms: number | null): ChartPoint | null => {
    if (ms === null || model.polar !== 'none' || ms < model.startMs || ms >= model.endMs) return null;
    return { x: r1(L.x((ms - model.startMs) / 60000)), y: yH };
  };
  const riseDot = edge(model.t.sunrise);
  const setDot = edge(model.t.sunset);
  const edgeLabel = (dot: ChartPoint | null, text: string | undefined): ChartLabel | null =>
    dot && text ? {
      x: r1(clamp(dot.x, L.left + EDGE_LABEL_INSET, L.right - EDGE_LABEL_INSET)),
      y: r1(L.yH + 13), text, anchor: 'middle',
    } : null;
  let riseLabel = edgeLabel(riseDot, model.riseLabel?.text);
  let setLabel = edgeLabel(setDot, model.setLabel?.text);
  if (riseLabel && setLabel && Math.abs(setLabel.x - riseLabel.x) < EDGE_LABEL_MIN_GAP) {
    riseLabel = null;
    setLabel = null;
  }

  const noonX = L.x(model.noonMin), noonY = L.y(model.noonAltApp);
  const above = noonY - 7;
  const noonLabel: ChartLabel = above < 11
    ? { x: r1(noonX + 6), y: r1(noonY + 4), text: degText(model.noonAltApp), anchor: 'start' }
    : { x: r1(clamp(noonX, L.left + 12, L.right - 12)), y: r1(above), text: degText(model.noonAltApp), anchor: 'middle' };

  return {
    W: L.W, H: L.H,
    clip: {
      day: rect(clipTop, yDay),
      gold: rect(yDay, yGold),
      blue: rect(yGold, yBlue),
      halo: rect(clipTop, L.bottom + 4),
    },
    stars: starsPath(model, L, seed),
    grid: gridPaths(model, L),
    horizon: { x1: r1(L.left), x2: r1(L.right), y: yH },
    noonLine: model.noonAltApp >= 2 ? { x: r1(noonX), y1: r1(noonY), y2: yH } : null,
    curve: curvePath(model, L),
    riseDot, setDot, riseLabel, setLabel, noonLabel,
    yLabels: yAxisLabels(L),
    xLabels: xAxisLabels(model, L),
  };
}

// --- Punter i teclat → minut ---

/**
 * Minut del dia sota el punter: x relativa al rectangle del gràfic (una sola lectura per gest), mapada de
 * [left, right] a [0, spanMin], arrodonida al minut i retallada.
 */
export function minuteFromClientX(clientX: number, rect: Pick<DOMRect, 'left'>, L: ChartLayout, spanMin: number): number {
  const f = (clientX - rect.left - L.left) / (L.right - L.left);
  if (!Number.isFinite(f)) return 0;
  return clamp(Math.round(f * spanMin), 0, spanMin);
}

/**
 * Pas de teclat del control lliscant, ajustat a la graella: fletxes ±15 min, Re Pàg/Av Pàg ±60 min, Inici 0,
 * Fi spanMin ("24:00"). Retallat a [0, spanMin]; qualsevol altra tecla => null.
 */
export function stepMinute(m: number, key: string, spanMin: number): number | null {
  let next: number;
  switch (key) {
    case 'ArrowRight': case 'ArrowUp': next = Math.floor(m / 15) * 15 + 15; break;
    case 'ArrowLeft': case 'ArrowDown': next = Math.ceil(m / 15) * 15 - 15; break;
    case 'PageUp': next = Math.floor(m / 60) * 60 + 60; break;
    case 'PageDown': next = Math.ceil(m / 60) * 60 - 60; break;
    case 'Home': next = 0; break;
    case 'End': next = spanMin; break;
    default: return null;
  }
  return clamp(next, 0, spanMin);
}
