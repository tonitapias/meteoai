// src/App.tsx
import React from 'react';
import { useAppController } from './hooks/useAppController';

// Noves Vistes Modulars
import WelcomeView from './views/WelcomeView';
import DashboardView from './views/DashboardView';

export default function MeteoIA() {
  // 1. INICIALITZACIÓ: Tot l'estat en una sola línia
  const controller = useAppController();
  const { state } = controller;

  // 2. DECISIÓ DE VISTA
  // Si no tenim dades i no hi ha error crític, mostrem Benvinguda
  if (!state.weatherData && !state.error) { 
    return <WelcomeView controller={controller} />;
  }

  // 3. DASHBOARD PRINCIPAL (quan hi ha dades o error de càrrega)
  return <DashboardView controller={controller} />;
}