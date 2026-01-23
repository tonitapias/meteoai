
// src/context/PreferencesContext.tsx
import React, { createContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { LocationData } from '../services/weatherApi';
import { WeatherUnit } from '../utils/formatters';
import { Language } from '../translations';

// Definim la forma del nostre context
export interface PreferencesContextType {
  lang: Language;
  setLang: React.Dispatch<React.SetStateAction<Language>>;
  unit: WeatherUnit;
  setUnit: React.Dispatch<React.SetStateAction<WeatherUnit>>;
  viewMode: string;
  setViewMode: React.Dispatch<React.SetStateAction<string>>;
  favorites: LocationData[];
  addFavorite: (location: LocationData) => void;
  removeFavorite: (name: string) => void;
  isFavorite: (name: string) => boolean;
}

// eslint-disable-next-line react-refresh/only-export-components
export const PreferencesContext = createContext<PreferencesContextType | undefined>(undefined);

export const PreferencesProvider = ({ children }: { children: ReactNode }) => {
  // Cast segur per llegir de localStorage
  const [unit, setUnit] = useState<WeatherUnit>(() => (localStorage.getItem('meteoia-unit') as WeatherUnit) || 'C');
  const [lang, setLang] = useState<Language>(() => (localStorage.getItem('meteoia-lang') as Language) || 'ca');
  const [viewMode, setViewMode] = useState<string>(() => localStorage.getItem('meteoia-view') || 'basic');
  
  const [favorites, setFavorites] = useState<LocationData[]>(() => {
    const saved = localStorage.getItem('meteoia-favs');
    return saved ? (JSON.parse(saved) as LocationData[]) : [];
  });

  useEffect(() => { localStorage.setItem('meteoia-unit', unit); }, [unit]);
  useEffect(() => { localStorage.setItem('meteoia-lang', lang); }, [lang]);
  useEffect(() => { localStorage.setItem('meteoia-view', viewMode); }, [viewMode]);

  const saveFavorites = useCallback((newFavs: LocationData[]) => {
    setFavorites(newFavs);
    localStorage.setItem('meteoia-favs', JSON.stringify(newFavs));
  }, []);

  const addFavorite = useCallback((location: LocationData) => {
    if (!favorites.some(f => f.name === location.name)) {
      saveFavorites([...favorites, location]);
    }
  }, [favorites, saveFavorites]);

  const removeFavorite = useCallback((name: string) => {
    const newFavs = favorites.filter(f => f.name !== name);
    saveFavorites(newFavs);
  }, [favorites, saveFavorites]);

  const isFavorite = useCallback((name: string) => {
    return favorites.some(f => f.name === name);
  }, [favorites]);

  const value: PreferencesContextType = {
    lang,
    setLang,
    unit,
    setUnit,
    viewMode,
    setViewMode,
    favorites,
    addFavorite,
    removeFavorite,
    isFavorite
  };

  return (
    <PreferencesContext.Provider value={value}>
      {children}
    </PreferencesContext.Provider>
  );
};