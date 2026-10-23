// src/views/WelcomeView.tsx
import WelcomeScreen from '../components/WelcomeScreen';
import Toast from '../components/Toast';
import DebugPanel from '../components/DebugPanel';
import { useAppController } from '../hooks/useAppController';

// Truc Pro: Deduïm el tipus directament del hook!
type AppController = ReturnType<typeof useAppController>;

interface WelcomeViewProps {
  controller: AppController;
}

// La benvinguda porta la seva pròpia capçalera (marca, ajuda i idioma) i el cercador dins la pantalla:
// la capçalera global, amb el selector Bàsic/Expert, no té sentit abans de tenir una previsió.
export default function WelcomeView({ controller }: WelcomeViewProps) {
  const { state, actions, flags, t } = controller;

  return (
    <div className="min-h-screen bg-[#0c0f17] font-sans relative">
       <Toast
          message={state.notification?.msg || null}
          type={state.notification?.type}
          onClose={actions.dismissNotification}
       />

       {flags.showDebug && (
          <DebugPanel
              weatherData={state.weatherData}
              regionalModelLabel={flags.activeRegionalModel?.label ?? null}
              error={state.error}
          />
       )}

       <WelcomeScreen
           lang={flags.lang}
           setLang={actions.setLang}
           t={t}
           onLocate={actions.handleGetCurrentLocation}
           onSelectLocation={actions.fetchWeatherByCoords}
           favorites={state.favorites}
           loading={state.loading}
           onDebugToggle={actions.toggleDebug}
       />
    </div>
  );
}
