// src/hooks/usePreferences.js
import { useContext } from 'react';
import { PreferencesContext } from '../context/PreferencesContext';

export function usePreferences() {
  const context = useContext(PreferencesContext);
  if (!context) {
    throw new Error('usePreferences s\'ha d\'usar dins d\'un PreferencesProvider');
  }
  return context;
}