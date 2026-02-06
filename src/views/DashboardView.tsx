import React from 'react';

// Layout & UI Shell
import { DashboardLayout } from '../layouts/DashboardLayout';
import Header from '../components/Header';
import Footer from '../components/Footer';
import Toast from '../components/Toast'; 
import DebugPanel from '../components/DebugPanel';

// Components organitzats
import { DashboardContent } from '../components/dashboard/DashboardContent';
import { DashboardModals } from '../components/dashboard/DashboardModals';

// Hook del context
import { useAppContext } from '../context/AppContext';

export default function DashboardView() {
  // 1. RECUPEREM EL CONTROLADOR DEL CONTEXT
  // 🟢 FIX: Eliminem 'modals' d'aquí perquè ja no el necessitem
  const { state, actions, flags } = useAppContext();
  const { weatherData, calculations } = state;

  return (
    <DashboardLayout
      weatherCode={calculations.effectiveWeatherCode}
      
      // Header Net
      header={<Header />}
      
      // Footer
      footer={<Footer className="mt-auto" />}
      
      // Toast
      toast={
        <Toast 
            message={state.notification?.msg || null} 
            type={state.notification?.type} 
            onClose={actions.dismissNotification} 
        />
      }
      
      // Debug
      debugPanel={
        flags.showDebug && weatherData && (
            <DebugPanel 
                weatherData={weatherData} 
                supportsArome={flags.supportsArome} 
                error={state.error} 
            />
        )
      }
      
      // Modals Nets (Sense props!)
      modals={<DashboardModals />} 
    >
        {/* Contingut Net */}
        <div className="mt-6 md:mt-10 flex-1">
            <DashboardContent />
        </div>
    </DashboardLayout>
  );
}