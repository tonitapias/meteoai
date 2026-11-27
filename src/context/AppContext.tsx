// src/context/AppContext.tsx
import React, { createContext, useContext, useMemo, ReactNode } from 'react';
import { useAppController } from '../hooks/useAppController';

// 1. Definim el tipus basant-nos en el que retorna el teu hook principal
// Això ens estalvia haver de mantenir interfícies manualment.
type ControllerType = ReturnType<typeof useAppController>;

// L'estat dels modals (quin és obert) va en un context a part. Si anés amb la resta, obrir o tancar qualsevol modal
// canviaria el valor del context i tornaria a renderitzar tot el tauler (uns 200-350 components; en un mòbil modest,
// centenars de mil·lisegons dins del mateix clic). Ara només el llegeixen DashboardModals i TabbedDashboard.
type AppContextValue = Omit<ControllerType, 'modals'>;
type ModalsValue = ControllerType['modals'];

// 2. Creem el Context (inicialment null)
const AppContext = createContext<AppContextValue | null>(null);
const ModalsContext = createContext<ModalsValue | null>(null);

// 3. El Provider: És l'embolcall que "injectarà" les dades
interface AppProviderProps {
  children: ReactNode;
  controller: ControllerType;
}

export const AppProvider: React.FC<AppProviderProps> = ({ children, controller }) => {
  // useAppController manté state/actions/flags/t com els mateixos objectes quan només canvia un modal: així aquest
  // valor tampoc no canvia i els consumidors de useAppContext no es tornen a renderitzar.
  const { state, actions, flags, t, modals } = controller;
  const value = useMemo(() => ({ state, actions, flags, t }), [state, actions, flags, t]);
  return (
    <AppContext.Provider value={value}>
      <ModalsContext.Provider value={modals}>
        {children}
      </ModalsContext.Provider>
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

// Quin modal és obert (vegeu ModalsContext). Els setters són a useAppContext().actions.
// eslint-disable-next-line react-refresh/only-export-components
export const useModals = () => {
  const modals = useContext(ModalsContext);
  if (!modals) {
    throw new Error('useModals must be used within an AppProvider');
  }
  return modals;
};
