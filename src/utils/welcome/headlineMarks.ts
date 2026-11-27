// src/utils/welcome/headlineMarks.ts
// El temps dins les lletres de la segona línia del titular (Satisfy): el sol, la lluna o una estrella fan de punt de la
// primera "i" (si no n'hi ha, del punt final) i un núvol es posa damunt del primer accent, que en queda com la gota.
// Les mesures són de la lletra retallada (src/assets/fonts/satisfy-titular.woff2), en em, preses dels contorns amb
// fontTools: x des de l'origen de la lletra, y des de la línia de base cap amunt. Si es canvia de lletra, cal tornar-les
// a prendre.

/** Ascendent de Satisfy (hhea = win, sense USE_TYPO_METRICS): on comença, per dalt, la caixa d'una lletra en línia. */
const ASCENT = 0.9346;
/** Centre del punt de la "i". */
const I_DOT = { x: 0.1709, y: 0.5854 };
/** Centre del punt final. */
const PERIOD = { x: 0.0366, y: 0.0273 };
/** Centre i part de dalt de l'accent de cada vocal accentuada. */
const ACCENTS: Readonly<Record<string, { x: number; top: number }>> = {
  à: { x: 0.2163, top: 0.6055 }, á: { x: 0.2354, top: 0.6074 }, â: { x: 0.2246, top: 0.5879 }, ä: { x: 0.3315, top: 0.5459 },
  è: { x: 0.2065, top: 0.6055 }, é: { x: 0.2256, top: 0.6074 }, ê: { x: 0.2148, top: 0.5879 }, ë: { x: 0.3013, top: 0.5459 },
  ì: { x: 0.106, top: 0.6055 }, í: { x: 0.2061, top: 0.6074 }, î: { x: 0.1445, top: 0.5771 }, ï: { x: 0.231, top: 0.5459 },
  ò: { x: 0.2065, top: 0.5957 }, ó: { x: 0.2256, top: 0.5977 }, ô: { x: 0.1846, top: 0.5771 }, ö: { x: 0.2896, top: 0.541 },
  ù: { x: 0.2163, top: 0.5752 }, ú: { x: 0.2461, top: 0.5771 }, û: { x: 0.2344, top: 0.5674 }, ü: { x: 0.3276, top: 0.543 },
  À: { x: 0.4253, top: 0.9346 }, Á: { x: 0.4248, top: 0.9268 }, È: { x: 0.395, top: 0.9248 }, É: { x: 0.415, top: 0.9268 },
  Í: { x: 0.4443, top: 0.9268 }, Ò: { x: 0.395, top: 0.9248 }, Ó: { x: 0.3945, top: 0.9268 }, Ú: { x: 0.4443, top: 0.8965 },
};

/** Mides dels dibuixos, en em de la línia. El sol de la "i" una mica més gran que el del punt final. */
const ASTRE_I = 0.42;
const ASTRE_PERIOD = 0.4;
const CLOUD_W = 0.6;
const CLOUD_H = 0.36;
/** El núvol, una mica a la dreta de l'accent (l'agut s'inclina cap allà) i amb la part de baix just tocant-lo. */
const CLOUD_DX = 0.04;
const CLOUD_RISE = 0.15;
/** El sol del punt final, una mica enlairat i separat de la lletra d'abans. */
const PERIOD_DX = 0.06;
const PERIOD_RISE = 0.05;

/** Caixa del dibuix en em, relativa a la caixa de la lletra (origen a l'esquerra, part de dalt a l'ascendent). */
export interface MarkBox { left: number; top: number; width: number; height: number }

export type HeadlinePiece =
  | { kind: 'text'; text: string }
  /** `char` és la lletra que es dibuixa (la "ı" sense punt, o el punt final, que es deixa transparent per l'espai). */
  | { kind: 'mark'; mark: 'astre' | 'nuvol'; char: string; hideChar: boolean; box: MarkBox };

const round = (n: number) => Math.round(n * 10000) / 10000;
const centered = (cx: number, rise: number, width: number, height: number): MarkBox => ({
  left: round(cx - width / 2),
  top: round(ASCENT - rise - height / 2),
  width,
  height,
});

/**
 * Parteix la segona línia en trossos de text i lletres amb dibuix. L'astre va a la primera "i"; si no n'hi ha, al punt
 * final (francès i anglès). El núvol, al primer accent que hi hagi. Sense cap de les dues coses, un sol tros de text.
 */
export function headlinePieces(text: string): HeadlinePiece[] {
  const chars = [...text];
  const iAt = chars.indexOf('i');
  const periodAt = iAt < 0 && chars[chars.length - 1] === '.' ? chars.length - 1 : -1;
  const accentAt = chars.findIndex(c => c in ACCENTS);

  const pieces: HeadlinePiece[] = [];
  let run = '';
  const flush = () => { if (run) { pieces.push({ kind: 'text', text: run }); run = ''; } };
  chars.forEach((c, k) => {
    if (k === iAt) {
      flush();
      pieces.push({ kind: 'mark', mark: 'astre', char: 'ı', hideChar: false, box: centered(I_DOT.x, I_DOT.y, ASTRE_I, ASTRE_I) });
    } else if (k === periodAt) {
      flush();
      pieces.push({ kind: 'mark', mark: 'astre', char: c, hideChar: true, box: centered(PERIOD.x + PERIOD_DX, PERIOD.y + PERIOD_RISE, ASTRE_PERIOD, ASTRE_PERIOD) });
    } else if (k === accentAt) {
      flush();
      const a = ACCENTS[c];
      pieces.push({ kind: 'mark', mark: 'nuvol', char: c, hideChar: false, box: centered(a.x + CLOUD_DX, a.top + CLOUD_RISE, CLOUD_W, CLOUD_H) });
    } else {
      run += c;
    }
  });
  flush();
  return pieces;
}
