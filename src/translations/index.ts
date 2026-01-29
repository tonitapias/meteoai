// src/translations/index.ts
import { ca } from './ca';
import { es } from './es';
import { en } from './en';
import { fr } from './fr';

// Tipus definit a partir del català (idioma base).
// Això ajuda al VS Code a autocompletar en tota l'app.
export type TranslationType = typeof ca;

// Mapa de llenguatges disponibles
export type Language = 'ca' | 'es' | 'en' | 'fr';

// --- UTILITAT DE SEGURETAT (Deep Merge) ---
// Aquesta funció assegura que si falta una clau en un idioma secundari,
// es faci servir automàticament la del català (base) per evitar errors.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function createSafeTranslation(base: any, target: any): TranslationType {
    // Comencem amb una còpia completa de l'idioma base (Català)
    const safeObj = { ...base };

    // Recorrem les claus de l'idioma objectiu per sobreescriure
    Object.keys(target).forEach(key => {
        const baseValue = base[key];
        const targetValue = target[key];

        // Si és un objecte niat (ex: 'moonPhases'), fem merge recursiu
        // (Excloem els arrays perquè aquests es substitueixen sencers)
        if (
            baseValue && typeof baseValue === 'object' && !Array.isArray(baseValue) &&
            targetValue && typeof targetValue === 'object' && !Array.isArray(targetValue)
        ) {
            safeObj[key] = createSafeTranslation(baseValue, targetValue);
        } else {
            // Si és un valor primitiu (string, number) o un array, el de l'idioma destí mana
            safeObj[key] = targetValue;
        }
    });

    return safeObj as TranslationType;
}

// Creem les versions "blindades" dels idiomes
// Si a 'en.ts' li falta una frase, ara tindrà la de 'ca.ts' automàticament.
const safeEs = createSafeTranslation(ca, es);
const safeEn = createSafeTranslation(ca, en);
const safeFr = createSafeTranslation(ca, fr);

// Objecte mestre exportat amb protecció contra "undefined"
export const TRANSLATIONS: Record<Language, TranslationType> = {
  ca, // El català és la base, no necessita merge
  es: safeEs,
  en: safeEn,
  fr: safeFr
};