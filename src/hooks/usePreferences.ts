import { useState, useEffect } from 'react';
import { Language } from '../constants/translations';
import { WeatherUnit } from '../utils/formatters';

export interface LocationData {
  name: string;
  latitude: number;
  longitude: number;
  country?: string;
  admin1?: string;
}

export type ViewMode = 'basic' | 'expert';

// Helpers per carregar de forma segura i neta
const loadString = <T extends string>(key: string, fallback: T): T => {
  if (typeof window === 'undefined') return fallback;
  return (localStorage.getItem(key) as T) || fallback;
};

const loadJSON = <T>(key: string, fallback: T): T => {
  if (typeof window === 'undefined') return fallback;
  try {
    const item = localStorage.getItem(key);
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
  const [viewMode, setViewMode] = useState<ViewMode>(() => loadString('meteoai_view_mode', 'basic'));
  const [favorites, setFavorites] = useState<LocationData[]>(() => loadJSON('meteoai_favorites', []));

  // 2. EFECTES NOMÉS PER GUARDAR (Quan l'usuari canvia alguna cosa)
  useEffect(() => { localStorage.setItem('meteoai_lang', lang); }, [lang]);
  useEffect(() => { localStorage.setItem('meteoai_unit', unit); }, [unit]);
  useEffect(() => { localStorage.setItem('meteoai_view_mode', viewMode); }, [viewMode]); 
  useEffect(() => { localStorage.setItem('meteoai_favorites', JSON.stringify(favorites)); }, [favorites]);

  const addFavorite = (location: LocationData) => {
    setFavorites(prev => {
      if (prev.some(f => f.name === location.name)) return prev;
      return [...prev, location];
    });
  };

  const removeFavorite = (name: string) => {
    setFavorites(prev => prev.filter(f => f.name !== name));
  };

  const isFavorite = (name: string) => {
    return favorites.some(f => f.name === name);
  };

  return {
    lang, setLang,
    unit, setUnit,
    viewMode, setViewMode,
    favorites, addFavorite, removeFavorite, isFavorite
  };
}