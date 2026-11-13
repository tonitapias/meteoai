// src/utils/uiFlag.ts
// Interruptor TEMPORAL de la interfície per pestanyes, per comparar-la amb l'actual a l'app real abans de retirar
// Essencial/Completa. `?ui=tabs` l'activa i `?ui=classic` el desactiva; la tria es desa perquè sobrevisqui a un refresc
// i a l'app instal·lada (que s'obre sense paràmetres). Sense cap de les dues, la interfície d'avui.
import { readStorage, writeStorage } from './safeStorage';

export type UiVariant = 'classic' | 'tabs';

const STORAGE_KEY = 'meteoai_ui_variant';
const PARAM = 'ui';

const isUiVariant = (value: unknown): value is UiVariant => value === 'classic' || value === 'tabs';

export const readUiVariant = (search: string): UiVariant => {
  const requested = new URLSearchParams(search).get(PARAM);
  if (isUiVariant(requested)) {
    writeStorage(STORAGE_KEY, requested);
    return requested;
  }
  const stored = readStorage(STORAGE_KEY);
  return isUiVariant(stored) ? stored : 'classic';
};
