// src/context/AppContext.tsx
import React, { createContext, useContext, ReactNode } from 'react';
import { useAppController } from '../hooks/useAppController';

// 1. Definim el tipus basant-nos en el que retorna el teu hook principal
// Això ens estalvia haver de mantenir interfícies manualment.
type ControllerType = ReturnType<typeof useAppController>;

// 2. Creem el Context (inicialment null)
const AppContext = createContext<ControllerType | null>(null);

// 3. El Provider: És l'embolcall que "injectarà" les dades
interface AppProviderProps {
  children: ReactNode;
  controller: ControllerType;
}

export const AppProvider: React.FC<AppProviderProps> = ({ children, controller }) => {
  return (
    <AppContext.Provider value={controller}>
      {children}
    </AppContext.Provider>
  );
};

// 4. El Hook Consumidor: La forma fàcil d'accedir a les dades
// eslint-disable-next-line react-refresh/only-export-components
export const useAppContext = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useAppContext must be used within an AppProvider');
  }
  return context;
};