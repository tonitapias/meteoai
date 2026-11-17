// src/utils/sentrySessions.test.ts
// Sentry ha d'obrir una sola sessió per càrrega de pàgina (auditoria d'UX, segona volta, M10). Amb el cicle per defecte
// ("route"), cada canvi d'adreça (les pestanyes fan pushState/replaceState amb ?tab=) tancava la sessió i n'obria una
// altra: 2 sobres per canvi de pestanya.
import { describe, it, expect } from 'vitest';

const MAIN = import.meta.glob<string>('/src/main.tsx', { query: '?raw', import: 'default', eager: true })['/src/main.tsx'];

describe('Sessions de Sentry', () => {
  it("main.tsx fa servir el cicle 'page' (una sessió per càrrega, no per canvi d'adreça)", () => {
    expect(MAIN).toMatch(/browserSessionIntegration\(\s*\{\s*lifecycle:\s*['"]page['"]\s*\}\s*\)/);
  });
});
