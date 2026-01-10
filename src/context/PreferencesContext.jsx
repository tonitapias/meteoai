// src/context/PreferencesContext.jsx
import React, { createContext, useState, useEffect, useCallback } from 'react';

export const PreferencesContext = createContext();

export const PreferencesProvider = ({ children }) => {
  // --- LÒGICA ORIGINAL DE usePreferences.js ---
  
  // 1. Estats amb inicialització "mandrosa" (llegeix localStorage 1 cop)
  const [unit, setUnit] = useState(() => localStorage.getItem('meteoia-unit') || 'C');
  const [lang, setLang] = useState(() => localStorage.getItem('meteoia-lang') || 'ca');
  const [viewMode, setViewMode] = useState(() => localStorage.getItem('meteoia-view') || 'basic');
  const [favorites, setFavorites] = useState(() => {
    const saved = localStorage.getItem('meteoia-favs');
    return saved ? JSON.parse(saved) : [];
  });

  // 2. Efectes per guardar automàticament
  useEffect(() => { localStorage.setItem('meteoia-unit', unit); }, [unit]);
  useEffect(() => { localStorage.setItem('meteoia-lang', lang); }, [lang]);
  useEffect(() => { localStorage.setItem('meteoia-view', viewMode); }, [viewMode]);

  // 3. Funcions auxiliars de favorits
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

  // --- VALOR QUE EXPOSEM A TOTA L'APP ---
  const value = {
    lang, setLang,
    unit, setUnit,
    viewMode, setViewMode,
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