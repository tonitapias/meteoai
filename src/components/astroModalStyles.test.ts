import { describe, it, expect } from 'vitest';
import { astroSheetVars, sheetHaloStyle } from './astroModalStyles';

// Codi font dels modals que fan servir aquests estils: cada degradat de full `from-X-950/N` ha
// de tenir el to a la taula, si no les targetes caurien en silenci al farcit neutre de reserva.
const MODAL_SOURCES = Object.entries(
  import.meta.glob('./*Modal.tsx', { query: '?raw', import: 'default', eager: true }) as Record<string, string>
).filter(([, src]) => src.includes('astroModalStyles'));

describe('astroSheetVars', () => {
  it('dona un farcit opac amb el to del full', () => {
    // 0,42 · 0,30 · amber-950 (69, 26, 3) + 1
    expect(astroSheetVars('from-amber-950/30 to-black/90')).toEqual({ '--astro-card-fill': 'rgb(10 4 1)' });
  });

  it('no defineix la variable per a un degradat que no sap llegir', () => {
    expect(astroSheetVars('from-[#0a0a1a] via-[#050510] to-black')).toEqual({});
    expect(astroSheetVars('from-teal-950/20 to-black/90')).toEqual({});
  });

  it('coneix tots els tons dels fulls dels modals que el fan servir', () => {
    const gradients = MODAL_SOURCES.flatMap(([, src]) => src.match(/from-[a-z]+-950\/\d+/g) ?? []);
    expect(MODAL_SOURCES.length).toBeGreaterThanOrEqual(9);
    expect(gradients.length).toBeGreaterThan(30);
    for (const g of gradients) {
      expect(astroSheetVars(g), g).toHaveProperty('--astro-card-fill');
    }
  });
});

describe('sheetHaloStyle', () => {
  it('construeix un degradat sense filtre que acaba transparent', () => {
    const { backgroundImage } = sheetHaloStyle('amber', 'orange');
    expect(backgroundImage).toMatch(/^linear-gradient\(to bottom, rgb\(\d+ \d+ \d+ \/ 0\.036\) 0px, /);
    expect(backgroundImage).toMatch(/transparent 380px\)$/);
    expect(backgroundImage).not.toContain('NaN');
  });

  it('reaprofita el mateix objecte d\'estil entre renders', () => {
    expect(sheetHaloStyle('cyan', 'slate')).toBe(sheetHaloStyle('cyan', 'slate'));
  });
});
