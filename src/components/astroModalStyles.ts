// src/components/astroModalStyles.ts
// Peces visuals compartides pels modals experts de full (Lluna, UV, Vent, Tempesta…), pensades
// per a mòbils modestos: cap backdrop-filter ni filter: blur(). El halo superior i el farcit de
// les targetes reprodueixen l'aspecte que abans donaven els desenfocaments, però amb colors i
// degradats estàtics que el navegador rasteritza una sola vegada (no a cada frame de scroll).
import type { CSSProperties } from 'react';

type RGB = readonly [number, number, number];

// Tons 950 de Tailwind dels degradats `from-X-950/N to-black/90` dels fulls.
const TONE_950: Record<string, RGB> = {
  slate: [2, 6, 23], indigo: [30, 27, 75], purple: [59, 7, 100], fuchsia: [74, 4, 78],
  rose: [76, 5, 25], red: [69, 10, 10], orange: [67, 20, 7], amber: [69, 26, 3],
  yellow: [66, 32, 6], lime: [26, 46, 5], emerald: [2, 44, 34], cyan: [8, 51, 68], sky: [8, 47, 73],
};

// Tons 500 (inici) i 900 (mig) dels halos superiors `from-X-500/10 via-Y-900/5 to-transparent`.
const TONE_500 = {
  indigo: [99, 102, 241], amber: [245, 158, 11], cyan: [6, 182, 212], rose: [244, 63, 94], sky: [14, 165, 233],
} as const satisfies Record<string, RGB>;
const TONE_900 = {
  violet: [76, 29, 149], orange: [124, 45, 18], slate: [15, 23, 42], emerald: [6, 78, 59],
} as const satisfies Record<string, RGB>;

const rgb = ([r, g, b]: readonly number[], alpha?: number) =>
  alpha === undefined ? `rgb(${r} ${g} ${b})` : `rgb(${r} ${g} ${b} / ${alpha})`;

/**
 * Variable `--astro-card-fill` (la llegeix la classe `.astro-card-fill` d'index.css) per a un
 * full `from-X-950/N to-black/90`. Abans les targetes eren `bg-black/30 backdrop-blur-md`: el
 * 70 % del fons del full ja desenfocat, amb la quadrícula MATRIX_BG (3 %) esborrada, així que
 * el seu color depenia de la posició (més clares a dalt, gairebé negres a baix). Un farcit únic
 * no pot coincidir a tot arreu: prenem el full a un 40 % d'alçada (0,7 · 0,6 · N % del to 950),
 * que equilibra l'error entre l'heroi de dalt i les targetes de baix, més ~1 nivell de la
 * quadrícula difosa. Opac: no es veu la quadrícula a través.
 */
export const astroSheetVars = (bgGradient: string): CSSProperties => {
  const m = /from-([a-z]+)-950\/(\d+)/.exec(bgGradient);
  const tone = m ? TONE_950[m[1]] : undefined;
  if (!m || !tone) return {};
  const k = 0.42 * (Number(m[2]) / 100);
  return { '--astro-card-fill': rgb(tone.map(c => Math.round(k * c + 1))) } as CSSProperties;
};

// Perfil vertical de l'antic halo (caixa h-56 amb `from/via/transparent` i blur-[80px], és a
// dir σ = 80 px) integrat numèricament: [y en px, pes del to 500, pes del to 900], pesos
// premultiplicats. Ja inclou la difusió, així que el degradat no necessita cap filtre.
const HALO_PROFILE: readonly (readonly [number, number, number])[] = [
  [0, 0.024, 0.012], [40, 0.0265, 0.018], [80, 0.023, 0.023], [120, 0.016, 0.024],
  [160, 0.009, 0.021], [200, 0.004, 0.015], [250, 0.001, 0.008], [300, 0.0002, 0.003], [360, 0, 0.0006],
];
const HALO_HEIGHT = 380;

export const SHEET_HALO = 'absolute inset-x-0 top-0 h-[380px] pointer-events-none z-0';

const haloCache = new Map<string, CSSProperties>();

/** Halo superior del full, equivalent a l'antic `from-{from}-500/10 via-{via}-900/5` difuminat. */
export const sheetHaloStyle = (from: keyof typeof TONE_500, via: keyof typeof TONE_900): CSSProperties => {
  const key = `${from}/${via}`;
  const cached = haloCache.get(key);
  if (cached) return cached;
  const a = TONE_500[from], b = TONE_900[via];
  const stops = HALO_PROFILE.map(([y, wa, wb]) => {
    const alpha = wa + wb;
    const color = [0, 1, 2].map(i => Math.round((wa * a[i] + wb * b[i]) / alpha));
    return `${rgb(color, +alpha.toFixed(4))} ${y}px`;
  });
  const style: CSSProperties = { backgroundImage: `linear-gradient(to bottom, ${stops.join(', ')}, transparent ${HALO_HEIGHT}px)` };
  haloCache.set(key, style);
  return style;
};
