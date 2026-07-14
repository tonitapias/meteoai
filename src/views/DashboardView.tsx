// src/views/DashboardView.tsx
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
  const { state, actions, flags } = useAppContext();
  
  // DOCTRINA RISC ZERO: Desestructuració segura i valors per defecte 
  // per evitar caigudes si l'estat inicial triga mil·lisegons en muntar-se.
  const weatherData = state?.weatherData || null;
  const calculations = state?.calculations || {};
  const notification = state?.notification || null;
  const error = state?.error || null;

  return (
    <DashboardLayout
      // PROTECCIÓ: Fallback segur per a valors crítics de la UI
      weatherCode={calculations.effectiveWeatherCode ?? 0}
      
      // Header Net
      header={<Header />}
      
      // Footer (Assegurem que quedi per sobre de possibles fons espacials)
      footer={<Footer className="mt-auto relative z-20" />}
      
      // Toast amb accessos segurs
      toast={
        <Toast 
            message={notification?.msg || null} 
            type={notification?.type} 
            onClose={actions?.dismissNotification} 
        />
      }
      
      // Debug protegit
      debugPanel={
        flags?.showDebug && weatherData && (
            <DebugPanel 
                weatherData={weatherData} 
                supportsArome={flags?.supportsArome ?? false} 
                error={error} 
            />
        )
      }
      
      // Modals Nets (Sense props!)
      modals={<DashboardModals />} 
    >
        {/* SPATIAL UI / MOBILE FIRST: 
            Contenidor fluid amb z-index per surar sobre el fons del Layout.
            Marges adaptatius ajustats per maximitzar aprofitament de pantalla en mòbil (mt-4)
        */}
        <div className="relative z-10 flex flex-col flex-1 w-full mt-4 sm:mt-6 md:mt-10">
            <DashboardContent />
        </div>
    </DashboardLayout>
  );
}