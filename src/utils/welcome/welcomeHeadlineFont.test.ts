// Les lletres del titular (Fraunces i Satisfy, src/assets/fonts) només porten els caràcters de titular-chars.txt.
// Si un titular nou en fa servir un altre, aquella lletra sortiria amb la de reserva: cal tornar a retallar-les (i, per a
// Satisfy, tornar a prendre les mesures de headlineMarks.ts).
import { describe, it, expect } from 'vitest';
import chars from '../../assets/fonts/titular-chars.txt?raw';
import { TRANSLATIONS } from '../../translations';
import type { Language } from '../../translations';

describe('lletres del titular de benvinguda', () => {
  const available = new Set([...chars.replace(/\r?\n/g, '')]);

  it.each(Object.keys(TRANSLATIONS) as Language[])('tenen tots els caràcters del titular en %s', (lang) => {
    const missing = [...TRANSLATIONS[lang].welcome.headline].filter((c) => !available.has(c));
    expect(missing).toEqual([]);
  });
});
