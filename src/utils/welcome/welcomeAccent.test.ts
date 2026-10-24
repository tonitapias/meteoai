// src/utils/welcome/welcomeAccent.test.ts
import { describe, it, expect } from 'vitest';
import { splitHeadline } from './welcomeAccent';
import { TRANSLATIONS, type Language } from '../../translations';

describe('splitHeadline', () => {
  it('parteix per la primera coma i la deixa a la primera línia', () => {
    expect(splitHeadline('El temps on ets, vist de més a prop.')).toEqual(['El temps on ets,', 'vist de més a prop.']);
  });

  it('sense coma (o sense res després) no hi ha segona línia', () => {
    expect(splitHeadline('El temps on ets.')).toEqual(['El temps on ets.', '']);
    expect(splitHeadline('El temps on ets,')).toEqual(['El temps on ets,', '']);
  });

  it('el titular de cada idioma té les dues parts', () => {
    for (const lang of ['ca', 'es', 'en', 'fr'] as Language[]) {
      const [first, second] = splitHeadline(TRANSLATIONS[lang].welcome.headline);
      expect(first.endsWith(','), lang).toBe(true);
      expect(second.length, lang).toBeGreaterThan(0);
    }
  });
});
