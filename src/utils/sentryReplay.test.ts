// src/utils/sentryReplay.test.ts
// La gravació de Sentry no ha de tornar al fragment d'entrada (auditoria d'UX del 16/11/2026, X1): només
// sentryReplay.ts la treu de @sentry/react, i només s'hi arriba amb import(). Una importació estàtica (o un
// `Sentry.replayIntegration` en qualsevol altre fitxer) la tornaria a ficar dins el fragment que es baixa i es compila
// abans de pintar res.
import { describe, it, expect } from 'vitest';

/** Codi TS/TSX en brut (glob de Vite), sense les proves. */
const SOURCES = import.meta.glob<string>(['/src/**/*.{ts,tsx}', '!**/*.test.{ts,tsx}'], {
  query: '?raw', import: 'default', eager: true,
});

describe('Sentry Replay en un fragment a part', () => {
  it('només sentryReplay.ts fa servir replayIntegration', () => {
    // `Sentry.replayIntegration` o `import { replayIntegration } from '@sentry/...'`; main.tsx la rep de l'import().
    const users = Object.entries(SOURCES)
      .filter(([file, code]) => file !== '/src/utils/sentryReplay.ts'
        && (/\.replayIntegration\b/.test(code) || /\breplayIntegration\b[^;]*from\s*['"]@sentry\//.test(code)))
      .map(([file]) => file);
    expect(users).toEqual([]);
  });

  it("a sentryReplay.ts només s'hi arriba amb import()", () => {
    const staticImports = Object.entries(SOURCES)
      .filter(([, code]) => /^\s*(import|export)\b[^;]*from\s*['"][./]*(utils\/)?sentryReplay['"]/m.test(code))
      .map(([file]) => file);
    expect(staticImports).toEqual([]);
    expect(SOURCES['/src/main.tsx']).toMatch(/import\(\s*['"]\.\/utils\/sentryReplay['"]\s*\)/);
  });
});
