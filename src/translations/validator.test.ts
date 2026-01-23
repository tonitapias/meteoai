import { describe, it, expect } from 'vitest'; // O 'jest' si no uses vitest
import { ca } from './ca';
import { es } from './es';
import { en } from './en';
import { fr } from './fr';

// Funció recursiva per trobar claus faltants
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const findMissingKeys = (base: any, target: any, prefix = ''): string[] => {
  let missing: string[] = [];

  Object.keys(base).forEach(key => {
    const currentPath = prefix ? `${prefix}.${key}` : key;

    // 1. Comprovar si la clau existeix
    if (target[key] === undefined) {
      missing.push(currentPath);
    } 
    // 2. Si és un objecte, mirar a dins recursivament
    else if (typeof base[key] === 'object' && base[key] !== null && !Array.isArray(base[key])) {
      const nestedMissing = findMissingKeys(base[key], target[key], currentPath);
      missing = [...missing, ...nestedMissing];
    }
  });

  return missing;
};

describe('Validació de Traduccions', () => {
  const languages = [
    { code: 'es', data: es },
    { code: 'en', data: en },
    { code: 'fr', data: fr }
  ];

  languages.forEach(({ code, data }) => {
    it(`L'idioma [${code.toUpperCase()}] ha de tenir totes les claus del Català`, () => {
      const missingKeys = findMissingKeys(ca, data);
      
      if (missingKeys.length > 0) {
        console.error(`\n🚨 FALTA TRADUIR A [${code.toUpperCase()}]:`);
        missingKeys.forEach(k => console.error(`   ❌ ${k}`));
        console.error('\n');
      }

      expect(missingKeys).toHaveLength(0);
    });
  });
});