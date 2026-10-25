// src/utils/safeStorage.ts
// localStorage pot llançar una excepció només de tocar-lo (navegador que bloqueja totes les dades
// del lloc, alguns WebViews, quota plena). Les preferències no poden fer caure l'app per això:
// si no es pot llegir, fem servir el valor per defecte; si no es pot desar, ho ignorem.

export const readStorage = (key: string): string | null => {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
};

export const writeStorage = (key: string, value: string): void => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Sense emmagatzematge la preferència només dura fins que es tanca l'app.
  }
};
