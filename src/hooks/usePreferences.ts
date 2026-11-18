import { useState, useEffect, useCallback } from 'react';
import { Language, TRANSLATIONS } from '../translations';
import { WeatherUnit } from '../utils/formatters';
import { readStorage, removeStorage, writeStorage } from '../utils/safeStorage';
import { isSamePlace, type PlaceRef } from '../utils/geoDistance';

export interface LocationData {
  name: string;
  latitude: number;
  longitude: number;
  country?: string;
  admin1?: string;
}

// Claus que ja no fa servir ningú i que es treuen del navegador en obrir l'app: la vista Essencial/Completa i la
// targeta «Vols més detall?» (fins a la v3.57, substituïdes per les pestanyes), i l'interruptor de prova ?ui=tabs.
export const LEGACY_STORAGE_KEYS = ['meteoai_view_mode', 'meteoai_view_menu_seen', 'meteoai_detail_hint', 'meteoai_ui_variant'] as const;

// Helpers per carregar de forma segura i neta
const loadString = <T extends string>(key: string, fallback: T): T => {
  return (readStorage(key) as T) || fallback;
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

/** Quants llocs consultats es recorden (a part dels favorits). */
export const RECENTS_MAX = 3;

const isValidPlace = (p: unknown): p is LocationData => {
  const place = p as LocationData | null;
  return !!place && typeof place.name === 'string' && place.name.trim() !== ''
    && Number.isFinite(place.latitude) && Number.isFinite(place.longitude);
};

/** Els darrers llocs triats al cercador, el més recent primer (auditoria d'UX, segona volta, B8). */
const loadRecents = (): LocationData[] => {
  const stored = loadJSON<unknown>('meteoai_recents', []);
  return Array.isArray(stored) ? stored.filter(isValidPlace).slice(0, RECENTS_MAX) : [];
};

export function usePreferences() {
  // 1. ESTATS AMB CÀRREGA OPTIMITZADA (Sense useEffect inicial)
  const [lang, setLang] = useState<Language>(() => loadString('meteoai_lang', 'ca'));
  const [unit, setUnit] = useState<WeatherUnit>(() => loadString('meteoai_unit', 'C'));
  const [favorites, setFavorites] = useState<LocationData[]>(() => loadJSON('meteoai_favorites', []));
  const [recents, setRecents] = useState<LocationData[]>(loadRecents);

  // Neteja d'una sola vegada (després, les claus ja no hi són i no fa res).
  useEffect(() => { LEGACY_STORAGE_KEYS.forEach(removeStorage); }, []);

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
  // El títol de la pestanya en l'idioma actiu (index.html el porta en català i abans no canviava mai).
  useEffect(() => {
    const headline = (TRANSLATIONS[lang] ?? TRANSLATIONS.ca).welcome.headline.replace(/[.]$/, '');
    document.title = `MeteoToni AI | ${headline}`;
  }, [lang]);
  useEffect(() => { writeStorage('meteoai_unit', unit); }, [unit]);
  useEffect(() => { writeStorage('meteoai_favorites', JSON.stringify(favorites)); }, [favorites]);
  useEffect(() => { writeStorage('meteoai_recents', JSON.stringify(recents)); }, [recents]);

  // [FIX PRECISIÓ] Memoitzades amb useCallback (com ja feia la versió antiga de
  // PreferencesContext.tsx): sense això, cada render en creava funcions noves,
  // fent que qualsevol useCallback aigües avall (p.ex. handleToggleFavorite a
  // useAppActions.ts) mai tingués unes dependències estables.
  // Un favorit és un lloc, no un nom (vegeu isSamePlace): abans dos pobles que es diuen igual eren el mateix favorit i
  // l'estrella sortia encesa al que no era.
  const addFavorite = useCallback((location: LocationData) => {
    setFavorites(prev => {
      if (prev.some(f => isSamePlace(f, location))) return prev;
      return [...prev, location];
    });
  }, []);

  const removeFavorite = useCallback((place: PlaceRef) => {
    setFavorites(prev => prev.filter(f => !isSamePlace(f, place)));
  }, []);

  const isFavorite = useCallback((place: PlaceRef) => {
    return favorites.some(f => isSamePlace(f, place));
  }, [favorites]);

  // Un lloc triat al cercador passa a ser el primer dels recents; si ja hi era (el mateix lloc, no el mateix nom), puja.
  const addRecent = useCallback((place: LocationData) => {
    if (!isValidPlace(place)) return;
    setRecents(prev => [place, ...prev.filter(r => !isSamePlace(r, place))].slice(0, RECENTS_MAX));
  }, []);

  return {
    lang, setLang,
    unit, setUnit,
    favorites, addFavorite, removeFavorite, isFavorite,
    recents, addRecent
  };
}