// src/utils/moonDisc.ts
// Geometria de la Lluna "com és" de la targeta Fase lunar: la part il·luminada per a una fase, els mars
// (cara visible, nord a dalt, vista des de l'hemisferi nord) i l'anell del cicle. Pur, sense React.

/** Fases sense terminador visible: com MoonPhaseIcon, la mateixa finestra que els noms "Lluna nova/plena". */
const NEW_EDGE = 0.02;
const FULL_LO = 0.48;
const FULL_HI = 0.52;

const f1 = (v: number) => (Math.round(v * 10) / 10).toFixed(1);

/**
 * Camí de la part il·luminada d'un disc de radi `r` centrat a (0, 0), vist des de l'hemisferi nord (creixent a
 * la dreta). Lluna nova: '' (no hi ha res il·luminat); plena: el disc sencer. El terminador és la semiel·lipse
 * d'amplada r·|cos 2πφ|, com MoonPhaseIcon.
 */
export function moonLitPath(phase: number, r: number): string {
  const p = Number.isFinite(phase) ? Math.min(1, Math.max(0, phase)) : 0;
  if (p < NEW_EDGE || p > 1 - NEW_EDGE) return '';
  if (p > FULL_LO && p < FULL_HI) return `M0,${-r}A${r},${r} 0 1 1 0,${r}A${r},${r} 0 1 1 0,${-r}Z`;
  const w = f1(Math.abs(r * Math.cos(p * 2 * Math.PI)));
  return p <= 0.5
    ? `M0,${-r}A${r},${r} 0 0 1 0,${r}A${w},${r} 0 0 ${p < 0.25 ? 0 : 1} 0,${-r}Z`
    : `M0,${-r}A${r},${r} 0 0 0 0,${r}A${w},${r} 0 0 ${p > 0.75 ? 1 : 0} 0,${-r}Z`;
}

/**
 * Mars principals en fraccions del radi: [x, y, rx, ry] (x a la dreta, y avall, nord a dalt). Aproximació
 * visual, no cartografia: Crisi, Fecunditat, Nèctar, Tranquil·litat, Serenitat, Pluges, Oceà de les
 * Tempestes, Núvols i Humors (el del Fred, una franja fina a dalt, a mida de targeta semblava una ratlla).
 */
export const MOON_MARIA: ReadonlyArray<readonly [number, number, number, number]> = [
  [0.62, -0.28, 0.13, 0.10],
  [0.48, 0.12, 0.14, 0.16],
  [0.28, 0.30, 0.09, 0.08],
  [0.25, -0.02, 0.17, 0.14],
  [0.18, -0.38, 0.15, 0.13],
  [-0.28, -0.42, 0.26, 0.22],
  [-0.58, 0.0, 0.28, 0.42],
  [-0.18, 0.40, 0.18, 0.13],
  [-0.45, 0.42, 0.10, 0.09],
];
/** Cràter Tycho (el punt brillant del sud): [x, y, r]. */
export const MOON_TYCHO: readonly [number, number, number] = [-0.12, 0.72, 0.035];

/** Punt d'un cercle a `deg` graus des de dalt, en sentit horari. */
export function ringPoint(cx: number, cy: number, r: number, deg: number): [number, number] {
  const a = ((deg - 90) * Math.PI) / 180;
  return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
}

/** Arc de l'anell del cicle des de dalt (lluna nova) fins a la fase, en sentit horari; '' si no hi ha recorregut. */
export function lunationArc(cx: number, cy: number, r: number, phase: number): string {
  const p = Number.isFinite(phase) ? Math.min(0.999, Math.max(0, phase)) : 0;
  if (p <= 0) return '';
  const [x0, y0] = ringPoint(cx, cy, r, 0);
  const [x1, y1] = ringPoint(cx, cy, r, p * 360);
  return `M${f1(x0)},${f1(y0)}A${r},${r} 0 ${p > 0.5 ? 1 : 0} 1 ${f1(x1)},${f1(y1)}`;
}
