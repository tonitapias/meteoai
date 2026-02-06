// src/App.tsx
import React from 'react';
import { useAppController } from './hooks/useAppController';
import { AppProvider } from './context/AppContext'; // Importem el nou Provider

// Vistes
import WelcomeView from './views/WelcomeView';
import DashboardView from './views/DashboardView';

export default function MeteoIA() {
  // 1. INICIALITZACIÓ
  const controller = useAppController();
  const { state } = controller;

  return (
    <AppProvider controller={controller}>
      {/* LOGICA DE ROUTING SIMPLE */}
      {!state.weatherData && !state.error ? (
         <WelcomeView controller={controller} />
      ) : (
         <DashboardView />
      )}
    </AppProvider>
  );
}