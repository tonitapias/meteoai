import { lazy, Suspense, useEffect } from 'react'; // NOU: Importem useEffect
import { useTranslation } from 'react-i18next'; // NOU: Importem el hook d'idioma

// 1. IMPORTEM EL CONTEXT
import { useAppContext } from '../../context/AppContext';
import type { LocationMeta } from '../../types/weatherLogicTypes';

// Lazy loading dels modals (es manté igual)
const DayDetailModal = lazy(() => import('../DayDetailModal'));
const RadarModal = lazy(() => import('../RadarModal'));
const AromeModal = lazy(() => import('../AromeModal'));

// JA NO NECESSITEM INTERFACE PROPS NI TIPUS COMPLEXOS

export const DashboardModals = () => {
    // 2. RECUPEREM DADES DEL CONTEXT
    const { state, actions, flags, modals } = useAppContext();
    const { weatherData } = state;

    // NOU: Instanciem el motor de traduccions
    const { i18n } = useTranslation();

    // NOU: Sincronitzem l'idioma global amb el motor i18next
    // Ho col·loquem ABANS de qualsevol `return` per no trencar les regles de React
    useEffect(() => {
        if (flags.lang && i18n.language !== flags.lang) {
            i18n.changeLanguage(flags.lang);
        }
    }, [flags.lang, i18n]);

    // Protecció: Si no hi ha dades, no podem mostrar modals de detall
    if (!weatherData) return null;

    // Forcem el tipatge de location per corregir la pèrdua d'inferència del compilador
    const loc = weatherData.location as LocationMeta | undefined;

    return (
        <Suspense fallback={null}>
            {modals.selectedDayIndex !== null && (
                <DayDetailModal 
                    weatherData={weatherData} 
                    selectedDayIndex={modals.selectedDayIndex} 
                    onClose={() => actions.setSelectedDayIndex(null)} 
                    unit={flags.unit} 
                    lang={flags.lang} 
                />
            )}
            {modals.showRadar && (
                <RadarModal 
                    lat={loc?.latitude || 0} 
                    lon={loc?.longitude || 0} 
                    onClose={() => actions.setShowRadar(false)} 
                />
            )}
            {modals.showArome && (
                <AromeModal 
                    lat={loc?.latitude || 0} 
                    lon={loc?.longitude || 0} 
                    onClose={() => actions.setShowArome(false)} 
                    lang={flags.lang} 
                />
            )}
        </Suspense>
    );
};