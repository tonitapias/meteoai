import { useState, useEffect, useCallback } from 'react';
import { Language } from '../translations';
import { WeatherUnit } from '../utils/formatters';
import { readStorage, writeStorage } from '../utils/safeStorage';

export interface LocationData {
  name: string;
  latitude: number;
  longitude: number;
  country?: string;
  admin1?: string;
}

// A la interfície: 'basic' = Vista essencial, 'expert' = Vista completa (noms des de la v3.41.0).
// Els valors interns no canvien perquè són els que hi ha desats al navegador de cada usuari.
export type ViewMode = 'basic' | 'expert';

const isViewMode = (value: string): value is ViewMode => value === 'basic' || value === 'expert';

// Helpers per carregar de forma segura i neta
const loadString = <T extends string>(key: string, fallback: T): T => {
  return (readStorage(key) as T) || fallback;
};

const loadViewMode = (): ViewMode => {
  const stored = readStorage('meteoai_view_mode');
  return stored && isViewMode(stored) ? stored : 'basic';
};

const loadJSON = <T>(key: string, fallback: T): T => {
  try {
    const item = readStorage(key);
    return item ? JSON.parse(item) : fallback;
  } catch (e) {
    console.warn(`Error carregant ${key}`, e);
    return fallback;
  }
};

export function usePreferences() {
  // 1. ESTATS AMB CÀRREGA OPTIMITZADA (Sense useEffect inicial)
  const [lang, setLang] = useState<Language>(() => loadString('meteoai_lang', 'ca'));
  const [unit, setUnit] = useState<WeatherUnit>(() => loadString('meteoai_unit', 'C'));
  const [viewMode, setViewMode] = useState<ViewMode>(loadViewMode);
  const [favorites, setFavorites] = useState<LocationData[]>(() => loadJSON('meteoai_favorites', []));

  // 2. EFECTES NOMÉS PER GUARDAR (Quan l'usuari canvia alguna cosa)
  useEffect(() => { writeStorage('meteoai_lang', lang); }, [lang]);

  // [FIX] index.html porta `lang="ca"` fix. `lang` (no i18n.language — react-i18next
  // només es sincronitza amb aquest valor un cop es munta DashboardModals, així que
  // no és fiable abans d'això) és la font real de l'idioma actiu: TRANSLATIONS[lang]
  // és qui pinta la interfície gairebé arreu. Sense sincronitzar-ho, un usuari en
  // es/en/fr es queda amb l'atribut lang equivocat — afecta la pronunciació dels
  // lectors de pantalla i la traducció automàtica del navegador, que es guien per
  // aquest atribut, no pel que mostra la interfície.
  useEffect(() => { document.documentElement.lang = lang; }, [lang]);
  useEffect(() => { writeStorage('meteoai_unit', unit); }, [unit]);
  useEffect(() => { writeStorage('meteoai_view_mode', viewMode); }, [viewMode]);
  useEffect(() => { writeStorage('meteoai_favorites', JSON.stringify(favorites)); }, [favorites]);

  // [FIX PRECISIÓ] Memoitzades amb useCallback (com ja feia la versió antiga de
  // PreferencesContext.tsx): sense això, cada render en creava funcions noves,
  // fent que qualsevol useCallback aigües avall (p.ex. handleToggleFavorite a
  // useAppActions.ts) mai tingués unes dependències estables.
  const addFavorite = useCallback((location: LocationData) => {
    setFavorites(prev => {
      if (prev.some(f => f.name === location.name)) return prev;
      return [...prev, location];
    });
  }, []);

  const removeFavorite = useCallback((name: string) => {
    setFavorites(prev => prev.filter(f => f.name !== name));
  }, []);

  const isFavorite = useCallback((name: string) => {
    return favorites.some(f => f.name === name);
  }, [favorites]);

  return {
    lang, setLang,
    unit, setUnit,
    viewMode, setViewMode,
    favorites, addFavorite, removeFavorite, isFavorite
  };
}