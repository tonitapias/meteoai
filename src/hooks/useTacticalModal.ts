import { useState, useEffect, useCallback } from 'react';

export interface TacticalModalControl {
  isOpen: boolean;
  openModal: () => void;
  closeModal: () => void;
  /**
   * Tanca el modal i executa `afterClosed` quan l'historial ja s'ha assentat. Cal fer-lo servir en lloc de
   * `closeModal()` + obrir un altre modal: `history.back()` és asíncron i el seu `popstate` arribaria al
   * modal nou, que (vegeu useModalHistory) el llegiria com un "enrere" de l'usuari i el tancaria a l'instant.
   */
  closeModalThen: (afterClosed: () => void) => void;
}

// Si el popstate del tancament no arriba mai (historial d'una sola entrada), no deixem l'acció penjada.
const HISTORY_SETTLE_TIMEOUT_MS = 400;

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

  const closeModalThen = useCallback((afterClosed: () => void) => {
    const willGoBack = typeof window !== 'undefined' && window.location.hash === hashId;
    closeModal();

    if (!willGoBack) {
      afterClosed();
      return;
    }

    let done = false;
    const run = () => {
      if (done) return;
      done = true;
      window.removeEventListener('popstate', run);
      window.clearTimeout(fallbackTimer);
      // Fora del dispatch del popstate: així cap listener nou que es registri en obrir l'altre modal el rep.
      window.setTimeout(afterClosed, 0);
    };
    window.addEventListener('popstate', run);
    const fallbackTimer = window.setTimeout(run, HISTORY_SETTLE_TIMEOUT_MS);
  }, [closeModal, hashId]);

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

  return { isOpen, openModal, closeModal, closeModalThen };
};