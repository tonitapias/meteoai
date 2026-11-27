import { describe, it, expect } from 'vitest';
import { headlinePieces, type HeadlinePiece } from './headlineMarks';
import { splitHeadline } from './welcomeAccent';
import { TRANSLATIONS, type Language } from '../../translations';

const marks = (pieces: HeadlinePiece[]) => pieces.filter((p): p is Extract<HeadlinePiece, { kind: 'mark' }> => p.kind === 'mark');
/** El text que es veu, amb la "ı" tornada a "i" (els lectors de pantalla llegeixen el text de debò, a part). */
const visible = (pieces: HeadlinePiece[]) => pieces.map(p => (p.kind === 'text' ? p.text : p.char === 'ı' ? 'i' : p.char)).join('');

describe('headlinePieces', () => {
  it('català: el sol a la "i" de "vist" i el núvol a l\'accent de "més"', () => {
    const p = headlinePieces('vist de més a prop.');
    expect(p.map(x => (x.kind === 'text' ? x.text : `[${x.mark}:${x.char}]`))).toEqual(['v', '[astre:ı]', 'st de m', '[nuvol:é]', 's a prop.']);
  });

  it('castellà: el sol a la "i" de "visto" i el núvol a la "á" de "más"', () => {
    const m = marks(headlinePieces('visto más de cerca.'));
    expect(m.map(x => `${x.mark}:${x.char}`)).toEqual(['astre:ı', 'nuvol:á']);
  });

  it('francès: sense "i", el sol fa de punt final (que queda transparent) i el núvol va a "près"', () => {
    const m = marks(headlinePieces('vue de plus près.'));
    expect(m.map(x => `${x.mark}:${x.char}:${x.hideChar}`)).toEqual(['nuvol:è:false', 'astre:.:true']);
  });

  it('anglès: només el sol al punt final, sense núvol', () => {
    const m = marks(headlinePieces('up close.'));
    expect(m.map(x => `${x.mark}:${x.char}`)).toEqual(['astre:.']);
  });

  it('sense "i", ni punt final, ni accent: un sol tros de text', () => {
    expect(headlinePieces('up close')).toEqual([{ kind: 'text', text: 'up close' }]);
    expect(headlinePieces('')).toEqual([]);
  });

  it('el sol queda damunt de la "i" i el núvol damunt de l\'accent (caixes en em, dins la lletra)', () => {
    const [sol, nuvol] = marks(headlinePieces('vist de més a prop.'));
    // Centre del sol sobre el punt de la "i": 0,17 em a la dreta de l'origen i 0,35 em per sota de l'ascendent.
    expect(sol.box.left + sol.box.width / 2).toBeCloseTo(0.1709, 3);
    expect(sol.box.top + sol.box.height / 2).toBeCloseTo(0.9346 - 0.5854, 3);
    // La part de baix del núvol, a tocar de la part de dalt de l'accent (0,6074 em sobre la línia de base).
    expect(0.9346 - (nuvol.box.top + nuvol.box.height)).toBeCloseTo(0.6074 + 0.15 - 0.18, 3);
  });

  it.each(Object.keys(TRANSLATIONS) as Language[])('en %s, el text que es veu és el del titular', (lang) => {
    const [, second] = splitHeadline(TRANSLATIONS[lang].welcome.headline);
    expect(visible(headlinePieces(second))).toBe(second);
    // Tots els titulars tenen on posar l'astre (una "i" o el punt final).
    expect(marks(headlinePieces(second)).some(m => m.mark === 'astre')).toBe(true);
  });
});
