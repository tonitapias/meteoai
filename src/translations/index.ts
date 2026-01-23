import { ca } from './ca';
import { es } from './es';
import { en } from './en';
import { fr } from './fr';

// Tipus definit a partir del català (idioma base).
// Això ajuda al VS Code a autocompletar en tota l'app.
export type TranslationType = typeof ca;

// Mapa de llenguatges disponibles
export type Language = 'ca' | 'es' | 'en' | 'fr';

// Objecte mestre exportat
export const TRANSLATIONS: Record<Language, TranslationType> = {
  ca,
  es,
  en,
  fr
};