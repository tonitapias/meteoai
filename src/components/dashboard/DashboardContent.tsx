// src/components/dashboard/DashboardContent.tsx
// El contingut del tauler: l'esquelet mentre carrega, l'avís si hi ha hagut un error i, amb la previsió, el tauler per
// pestanyes (Ara · Previsió · Detall · Cel, vegeu TabbedDashboard). Fins a la v3.57 hi havia les vistes Essencial i
// Completa.
import { useAppContext } from '../../context/AppContext';
import LoadingSkeleton from '../LoadingSkeleton';
import ErrorBanner from '../ErrorBanner';
import { TabbedDashboard } from './TabbedDashboard';

export const DashboardContent = () => {
    const { state } = useAppContext();

    if (state.error) return <ErrorBanner message={state.error} />;
    // openingLink: el primer render d'un enllaç, abans que l'efecte que el carrega hagi posat `loading`.
    if ((state.loading || state.openingLink) && !state.weatherData) return <LoadingSkeleton />;
    if (!state.weatherData) return null;

    return <TabbedDashboard />;
};
