// src/views/WelcomeView.tsx
import Header from '../components/Header';
import WelcomeScreen from '../components/WelcomeScreen';
import Toast from '../components/Toast';
import DebugPanel from '../components/DebugPanel';
import { useAppController } from '../hooks/useAppController';

// Truc Pro: Deduïm el tipus directament del hook!
type AppController = ReturnType<typeof useAppController>;

interface WelcomeViewProps {
  controller: AppController;
}

export default function WelcomeView({ controller }: WelcomeViewProps) {
  const { state, actions, flags, t } = controller;

  return (
    <div className="min-h-screen bg-[#05060A] flex flex-col font-sans overflow-hidden relative">
       <div className="fixed inset-0 pointer-events-none">
           <div className="absolute top-[-20%] left-[20%] w-[800px] h-[800px] bg-indigo-600/10 rounded-full blur-[120px] mix-blend-screen animate-pulse"></div>
       </div>
       
       <Toast 
          message={state.notification?.msg || null} 
          type={state.notification?.type} 
          onClose={actions.dismissNotification} 
       />

       {flags.showDebug && (
          <DebugPanel 
              weatherData={state.weatherData} 
              supportsArome={flags.supportsArome} 
              error={state.error} 
          />
       )}

       <div className="w-full max-w-[1920px] mx-auto p-4 md:p-6 flex-1 flex flex-col z-10 min-h-screen">
          <Header />
          
          <div className="flex-1 flex flex-col items-center justify-center w-full mt-8 md:mt-0">
              <WelcomeScreen 
                  lang={flags.lang} 
                  setLang={actions.setLang} 
                  t={t} 
                  onLocate={actions.handleGetCurrentLocation} 
                  loading={state.loading} 
              />
          </div>
       </div>
    </div>
  );
}