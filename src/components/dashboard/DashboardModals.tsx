import React, { lazy, Suspense } from 'react';
import { useAppController } from '../../hooks/useAppController';

// Lazy loading dels modals
const DayDetailModal = lazy(() => import('../DayDetailModal'));
const RadarModal = lazy(() => import('../RadarModal'));
const AromeModal = lazy(() => import('../AromeModal'));

// Tipus per a les props (extret del controlador)
type AppController = ReturnType<typeof useAppController>;

interface DashboardModalsProps {
    modals: AppController['modals'];
    actions: AppController['actions'];
    flags: AppController['flags'];
    weatherData: AppController['state']['weatherData'];
    hourlyData: AppController['state']['calculations']['chartDataFull'];
    shiftedNow: Date;
}

export const DashboardModals = ({ 
    modals, 
    actions, 
    flags, 
    weatherData, 
    hourlyData, 
    shiftedNow 
}: DashboardModalsProps) => {

    if (!weatherData) return null;

    return (
        <Suspense fallback={null}>
            {modals.selectedDayIndex !== null && (
                <DayDetailModal 
                    weatherData={weatherData} 
                    hourlyData={hourlyData} 
                    selectedDayIndex={modals.selectedDayIndex} 
                    onClose={() => actions.setSelectedDayIndex(null)} 
                    unit={flags.unit} 
                    lang={flags.lang} 
                    shiftedNow={shiftedNow} 
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