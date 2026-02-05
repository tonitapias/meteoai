import React from 'react';

// Layout & UI Shell
import { DashboardLayout } from '../layouts/DashboardLayout';
import Header from '../components/Header';
import Footer from '../components/Footer';
import Toast from '../components/Toast'; 
import DebugPanel from '../components/DebugPanel';

// Nous components organitzats
import { DashboardContent } from '../components/dashboard/DashboardContent';
import { DashboardModals } from '../components/dashboard/DashboardModals';

// Hook controlador
import { useAppController } from '../hooks/useAppController';

type AppController = ReturnType<typeof useAppController>;

interface DashboardViewProps {
  controller: AppController;
}

export default function DashboardView({ controller }: DashboardViewProps) {
  const { state, actions, flags, modals } = controller;
  const { weatherData, calculations } = state;

  return (
    <DashboardLayout
      weatherCode={calculations.effectiveWeatherCode}
      // Header: Controls de navegació i cerca
      header={
        <Header 
            onSearch={actions.fetchWeatherByCoords}
            onLocate={actions.handleGetCurrentLocation} 
            loading={state.loading}
            viewMode={flags.viewMode}
            setViewMode={actions.setViewMode}
            onDebugToggle={actions.toggleDebug}
        />
      }
      // Footer: Crèdits
      footer={<Footer className="mt-auto" />}
      // Toast: Notificacions flotants
      toast={
        <Toast 
            message={state.notification?.msg || null} 
            type={state.notification?.type} 
            onClose={actions.dismissNotification} 
        />
      }
      // Debug: Panell tècnic
      debugPanel={
        flags.showDebug && weatherData && (
            <DebugPanel 
                weatherData={weatherData} 
                supportsArome={flags.supportsArome} 
                error={state.error} 
            />
        )
      }
      // Modals: Finestres emergents (Lazy loaded)
      modals={
        <DashboardModals 
            modals={modals}
            actions={actions}
            flags={flags}
            weatherData={weatherData}
            hourlyData={calculations.chartDataFull}
            shiftedNow={calculations.shiftedNow}
        />
      }
    >
        {/* Contingut principal (Widgets) */}
        <div className="mt-6 md:mt-10 flex-1">
            <DashboardContent 
                state={state} 
                actions={actions} 
                flags={flags} 
                t={controller.t} 
            />
        </div>
    </DashboardLayout>
  );
}