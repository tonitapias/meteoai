// src/App.tsx
import { useAppController } from './hooks/useAppController';
import { AppProvider } from './context/AppContext'; // Importem el nou Provider

// Vistes
import WelcomeView from './views/WelcomeView';
import DashboardView from './views/DashboardView';
import UpdatePrompt from './components/UpdatePrompt';
import AddressMoveNotice from './components/AddressMoveNotice';

export default function MeteoIA() {
  // 1. INICIALITZACIÓ
  const controller = useAppController();
  const { state } = controller;

  return (
    <AppProvider controller={controller}>
      <AddressMoveNotice />
      {/* LOGICA DE ROUTING SIMPLE */}
      {/* Obrint un enllaç d'un lloc (?lat&lon&nom), directament al tauler mentre carrega (vegeu usePlaceLink). */}
      {!state.weatherData && !state.error && !state.openingLink ? (
         <WelcomeView controller={controller} />
      ) : (
         <DashboardView />
      )}
      {/* Amb el tauler a pantalla hi ha la barra de pestanyes fixa a baix (fins a 1024 px): l'avís hi va per sobre. */}
      <UpdatePrompt aboveTabBar={!!state.weatherData && !state.error} />
    </AppProvider>
  );
}