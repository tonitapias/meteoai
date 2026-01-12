// src/hooks/usePreferences.ts
import { useContext } from 'react';
import { PreferencesContext, PreferencesContextType } from '../context/PreferencesContext';

export function usePreferences(): PreferencesContextType {
  const context = useContext(PreferencesContext);
  if (!context) {
    throw new Error('usePreferences s\'ha d\'usar dins d\'un PreferencesProvider');
  }
  return context;
}