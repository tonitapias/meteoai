// src/hooks/usePreferences.js
import { useState, useEffect, useCallback } from 'react';

export function usePreferences() {
  // Inicialització mandrosa (lazy initialization) per llegir de localStorage només un cop
  const [unit, setUnit] = useState(() => localStorage.getItem('meteoia-unit') || 'C');
  const [lang, setLang] = useState(() => localStorage.getItem('meteoia-lang') || 'ca');
  const [viewMode, setViewMode] = useState(() => localStorage.getItem('meteoia-view') || 'basic');
  const [favorites, setFavorites] = useState(() => {
    const saved = localStorage.getItem('meteoia-favs');
    return saved ? JSON.parse(saved) : [];
  });

  // Efectes per guardar canvis automàticament
  useEffect(() => { localStorage.setItem('meteoia-unit', unit); }, [unit]);
  useEffect(() => { localStorage.setItem('meteoia-lang', lang); }, [lang]);
  useEffect(() => { localStorage.setItem('meteoia-view', viewMode); }, [viewMode]);
  
  // Guardar favorits manualment quan canviïn
  const saveFavorites = useCallback((newFavs) => {
    setFavorites(newFavs);
    localStorage.setItem('meteoia-favs', JSON.stringify(newFavs));
  }, []);

  const addFavorite = useCallback((location) => {
    if (!favorites.some(f => f.name === location.name)) {
      saveFavorites([...favorites, location]);
    }
  }, [favorites, saveFavorites]);

  const removeFavorite = useCallback((name) => {
    const newFavs = favorites.filter(f => f.name !== name);
    saveFavorites(newFavs);
  }, [favorites, saveFavorites]);

  const isFavorite = useCallback((name) => {
    return favorites.some(f => f.name === name);
  }, [favorites]);

  return {
    unit, setUnit,
    lang, setLang,
    viewMode, setViewMode,
    favorites,
    addFavorite,
    removeFavorite,
    isFavorite
  };
}