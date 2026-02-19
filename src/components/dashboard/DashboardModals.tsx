import { lazy, Suspense } from 'react';
// 1. IMPORTEM EL CONTEXT
import { useAppContext } from '../../context/AppContext';

// Lazy loading dels modals (es manté igual)
const DayDetailModal = lazy(() => import('../DayDetailModal'));
const RadarModal = lazy(() => import('../RadarModal'));
const AromeModal = lazy(() => import('../AromeModal'));

// JA NO NECESSITEM INTERFACE PROPS NI TIPUS COMPLEXOS

export const DashboardModals = () => {
    // 2. RECUPEREM DADES DEL CONTEXT
    const { state, actions, flags, modals } = useAppContext();
    const { weatherData, calculations } = state;

    // Protecció: Si no hi ha dades, no podem mostrar modals de detall
    if (!weatherData) return null;

    return (
        <Suspense fallback={null}>
            {modals.selectedDayIndex !== null && (
                <DayDetailModal 
                    weatherData={weatherData} 
                    selectedDayIndex={modals.selectedDayIndex} 
                    onClose={() => actions.setSelectedDayIndex(null)} 
                    unit={flags.unit} 
                    lang={flags.lang} 
                    shiftedNow={calculations.shiftedNow} 
                />
            )}
            {modals.showRadar && (
                <RadarModal 
                    lat={weatherData.location?.latitude || 0} 
                    lon={weatherData.location?.longitude || 0} 
                    onClose={() => actions.setShowRadar(false)} 
                    lang={flags.lang} 
                />
            )}
            {modals.showArome && (
                <AromeModal 
                    lat={weatherData.location?.latitude || 0} 
                    lon={weatherData.location?.longitude || 0} 
                    onClose={() => actions.setShowArome(false)} 
                    lang={flags.lang} 
                />
            )}
        </Suspense>
    );
};