// src/hooks/useViewState.ts
import { useState, useEffect, useCallback } from 'react';
import { useModalHistory } from './useModalHistory';
import { NOTIFICATION_TYPES } from '../constants/errorConstants';

// Definim tipus per a les notificacions per tenir-ho més endreçat
export type NotificationState = {
    type: typeof NOTIFICATION_TYPES[keyof typeof NOTIFICATION_TYPES];
    msg: string;
} | null;

export function useViewState() {
    // --- 1. Estat Global d'UI ---
    const [now, setNow] = useState<Date>(new Date());
    const [showDebug, setShowDebug] = useState(false);
    const [notification, setNotification] = useState<NotificationState>(null);

    // --- 2. Estat de Modals ---
    const [selectedDayIndex, setSelectedDayIndex] = useState<number | null>(null);
    const [showRadar, setShowRadar] = useState(false);
    const [showArome, setShowArome] = useState(false);

    // --- 3. Efectes Visuals (Rellotge) ---
    useEffect(() => { 
        const timer = setInterval(() => setNow(new Date()), 60000); 
        return () => clearInterval(timer); 
    }, []);

    // --- 4. Gestió d'Historial (Back Button) ---
    // Això abans embrutava el controlador principal
    useModalHistory(selectedDayIndex !== null, useCallback(() => setSelectedDayIndex(null), []));
    useModalHistory(showRadar, useCallback(() => setShowRadar(false), []));
    useModalHistory(showArome, useCallback(() => setShowArome(false), []));

    // --- 5. Helpers d'Acció UI ---
    const toggleDebug = useCallback(() => {
        setShowDebug(prev => !prev);
        setNotification({ 
            type: NOTIFICATION_TYPES.INFO, 
            msg: !showDebug ? "Debug Mode: ACTIVAT" : "Debug Mode: DESACTIVAT" 
        });
    }, [showDebug]);

    const dismissNotification = useCallback(() => setNotification(null), []);

    return {
        state: {
            now,
            showDebug,
            notification,
            modals: {
                selectedDayIndex,
                showRadar,
                showArome
            }
        },
        actions: {
            setNow,
            setShowDebug,
            toggleDebug,
            setNotification,
            dismissNotification,
            // Setters de modals
            setSelectedDayIndex,
            setShowRadar,
            setShowArome
        }
    };
}