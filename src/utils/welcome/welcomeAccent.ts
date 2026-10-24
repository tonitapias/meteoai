// src/utils/welcome/welcomeAccent.ts
// L'únic color d'accent de la benvinguda: el del moment del dia, del mateix to que l'òrbita de la columna. El fa
// servir la segona línia del titular i el sol petit de la línia de dalt. Va a part (sense dependències) perquè
// la pantalla el necessita al paquet inicial i la columna és en un tros diferit.
import type { WelcomePhase } from './welcomeSky';

/** Rosa a l'alba, or pàl·lid al migdia, taronja a la posta i lavanda de nit (tots amb contrast AA sobre el fons). */
export const WELCOME_ACCENT: Readonly<Record<WelcomePhase, string>> = {
  alba: '#fbcfe8',
  dia: '#fde68a',
  posta: '#fdba74',
  nit: '#c7d2fe',
};

/**
 * El titular en dues parts per la primera coma ("El temps on ets," / "vist de més a prop."): la segona porta
 * l'accent. Sense coma, tot és la primera part i no hi ha accent.
 */
export function splitHeadline(text: string): [string, string] {
  const i = text.indexOf(',');
  if (i < 0) return [text, ''];
  const rest = text.slice(i + 1).trim();
  return rest ? [text.slice(0, i + 1), rest] : [text, ''];
}
