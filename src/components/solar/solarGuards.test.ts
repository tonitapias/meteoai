// src/components/solar/solarGuards.test.ts
// Guardes del pressupost de gamma baixa sobre el codi font del Cicle solar: cap desenfocament, filtre,
// animació en bucle, transició ni dvh, will-change només durant l'arrossegament, i les peces de
// compatibilitat que el CSS ha de portar. Les proves en queden fora: aquest mateix fitxer conté les
// paraules prohibides.
import { describe, it, expect, beforeAll } from 'vitest';

/** Codi TS/TSX en brut (glob de Vite). */
const CODE = import.meta.glob<string>(
  [
    '/src/components/solar/**/*.{ts,tsx}',
    '/src/utils/solar/**/*.{ts,tsx}',
    '/src/components/SolarModal.tsx',
    '!**/*.test.{ts,tsx}',
  ],
  { query: '?raw', import: 'default', eager: true },
);

const CSS_PATH = '/src/components/solar/solarModal.css';
/** Ruta → text: el codi del glob i el full d'estil. */
const SOURCES: Record<string, string> = { ...CODE };
let entries: Array<[string, string]> = [];
let css = '';

// Vitest buida qualsevol .css (també amb ?raw) quan no processa CSS, que és el cas per defecte: el full
// d'estil es llegeix del disc. L'especificador dinàmic evita dependre dels tipus de Node (no instal·lats).
// Les rutes del glob són relatives a l'arrel del projecte, que és el directori de treball de Vitest.
beforeAll(async () => {
  const fs = (await import(/* @vite-ignore */ `node:${'fs'}`)) as { readFileSync(p: string, enc: 'utf8'): string };
  const cwd = (globalThis as unknown as { process: { cwd(): string } }).process.cwd();
  css = fs.readFileSync(`${cwd}${CSS_PATH}`, 'utf8');
  SOURCES[CSS_PATH] = css;
  entries = Object.entries(SOURCES);
});

/** Text prohibit → per què (surt al nom del cas). */
const FORBIDDEN: ReadonlyArray<readonly [string, string]> = [
  ['backdrop', 'backdrop-filter: composició cara a cada fotograma'],
  ['blur(', 'filtre de desenfocament'],
  ['blur-[', 'utilitat Tailwind de desenfocament'],
  ['animate-pulse', 'animació en bucle'],
  ['animate-ping', 'animació en bucle'],
  ['feGaussianBlur', 'filtre SVG'],
  ['<filter', 'filtre SVG'],
  ['dvh', 'unitat dvh (WebViews antics)'],
  ['transition', 'els estats canvien a l\'instant'],
  ['infinite', 'animació en bucle'],
  ['requestIdleCallback', 'no existeix a Safari; es difereix amb setTimeout'],
  ['color-mix', 'no suportat als navegadors objectiu'],
  [':has(', 'no suportat als navegadors objectiu'],
];

describe('guardes del codi font del Cicle solar', () => {
  it('troba els fitxers esperats, sense proves i amb contingut', () => {
    const paths = entries.map(([p]) => p);
    for (const p of [
      CSS_PATH, '/src/components/SolarModal.tsx', '/src/components/solar/useSolarScrub.ts',
      '/src/components/solar/SolarModalSkeleton.tsx', '/src/components/solar/preloadSolarModal.ts',
      '/src/utils/solar/solarDay.ts', '/src/utils/solar/solarSky.ts',
    ]) expect(paths).toContain(p);
    expect(paths.filter(p => p.includes('.test.'))).toEqual([]);
    for (const [p, src] of entries) expect(src.length, p).toBeGreaterThan(200);
  });

  it.each(FORBIDDEN)('cap font conté "%s" (%s)', (needle) => {
    const hits = entries.filter(([, src]) => src.toLowerCase().includes(needle.toLowerCase())).map(([p]) => p);
    expect(hits).toEqual([]);
  });

  it('will-change només dins de la regla [data-drag="1"] del CSS', () => {
    for (const [p, src] of entries) {
      if (p !== CSS_PATH) expect(/will-?change/i.test(src), p).toBe(false);
    }
    const at: number[] = [];
    for (let i = css.indexOf('will-change'); i >= 0; i = css.indexOf('will-change', i + 1)) at.push(i);
    expect(at.length).toBeGreaterThan(0);
    for (const i of at) {
      const open = css.lastIndexOf('{', i);
      const selector = css.slice(css.lastIndexOf('}', open) + 1, open).replace(/\/\*[\s\S]*?\*\//g, '').trim();
      // Cada selector de la llista ha de dependre de l'arrossegament.
      for (const part of selector.split(',')) expect(part, selector).toContain('[data-drag="1"]');
    }
  });

  it('el CSS porta moviment reduït, prefixos -webkit-, zona segura i color-scheme fosc', () => {
    expect(css).toContain('prefers-reduced-motion: reduce');
    expect(css).toContain('-webkit-user-select');
    expect(css).toContain('safe-area-inset-bottom');
    expect(css).toContain('color-scheme:dark');
  });

  it('les úniques animacions són les d\'entrada, d\'un sol cop i amb fill-mode backwards', () => {
    const decls = css.match(/animation:[^;}]+/g) ?? [];
    expect(decls.length).toBeGreaterThan(0);
    for (const d of decls) {
      if (/animation:\s*none/.test(d)) continue;
      expect(d).toMatch(/\bbackwards\b/);
      expect(d).toMatch(/\bsm-(fade|rise|pop)\b/);
    }
    expect(css).not.toMatch(/animation-iteration-count/);
    // Moviment reduït: el vel no s'anima i el full només fa una fosa d'opacitat.
    const reduced = css.slice(css.indexOf('prefers-reduced-motion: reduce'));
    expect(reduced).toMatch(/\.sm-scrim\{animation:none\}/);
    expect(reduced).toMatch(/\.sm-sheet\{animation:sm-fade /);
  });

  it('l\'esquelet i la precàrrega (paquet principal) no importen el codi del tros diferit', () => {
    for (const p of ['/src/components/solar/SolarModalSkeleton.tsx', '/src/components/solar/preloadSolarModal.ts']) {
      const staticImports = (SOURCES[p].match(/^import[^;]+;/gm) ?? []).join('\n');
      expect(staticImports, p).not.toMatch(/solarI18n|suncalc|\.css|utils\/solar|['"]\.\.\/SolarModal['"]/);
    }
  });
});
