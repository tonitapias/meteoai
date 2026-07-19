import { useState, useEffect, useCallback } from 'react';

export interface TacticalModalControl {
  isOpen: boolean;
  openModal: () => void;
  closeModal: () => void;
}

/**
 * Hook Risc Zero per controlar Modals Tàctics.
 * Utilitza un Hash URL (#modal-nom) per forçar el registre a l'historial
 * de navegadors mòbils agressius (Safari/Chrome).
 * 
 * @param modalId Identificador únic per a l'estat de l'historial (ex: 'trendChart')
 */
export const useTacticalModal = (modalId: string): TacticalModalControl => {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const hashId = `#modal-${modalId}`;

  const openModal = useCallback(() => {
    if (typeof window !== 'undefined') {
      // Forcem l'entrada a l'historial del mòbil amb un Hash real
      window.history.pushState(null, '', hashId);
    }
    setIsOpen(true);
  }, [hashId]);

  const closeModal = useCallback(() => {
    if (typeof window !== 'undefined' && window.location.hash === hashId) {
      // Si hem tancat amb el botó "X" o l'Escape, utilitzem back() per netejar la URL
      window.history.back();
    }
    // Tancament de seguretat forçat
    setIsOpen(false);
  }, [hashId]);

  useEffect(() => {
    const handlePopState = () => {
      // Si l'usuari fa el gest d'enrere al mòbil, el hash desapareixerà de la URL.
      // Si el modal segueix obert però el hash ja no hi és, el tanquem immediatament.
      if (typeof window !== 'undefined' && window.location.hash !== hashId) {
        setIsOpen(false);
      }
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('popstate', handlePopState);
    }

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('popstate', handlePopState);
      }
    };
  }, [isOpen, hashId]);

  return { isOpen, openModal, closeModal };
};