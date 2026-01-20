// src/hooks/useModalHistory.ts
import { useEffect, useRef } from 'react';

/**
 * Hook per sincronitzar l'estat d'obertura d'un modal amb l'historial del navegador.
 * Permet que el botó "enrere" (mòbil/navegador) tanqui el modal en lloc de canviar de pàgina.
 * * @param isOpen - Indica si el modal està actualment obert.
 * @param onClose - Funció que s'executarà per tancar el modal (resetear l'estat).
 */
export const useModalHistory = (isOpen: boolean, onClose: () => void) => {
  // Utilitzem una ref per saber si el tancament ha sigut provocat pel botó "enrere"
  // i evitar fer un doble history.back() innecessari.
  const causedByBackRef = useRef(false);

  useEffect(() => {
    if (isOpen) {
      // 1. Quan s'obre el modal, afegim una entrada a l'historial.
      // Utilitzem l'URL actual per no canviar la barra de direccions visualment.
      window.history.pushState({ modalOpen: true }, '', window.location.href);

      // 2. Definim el manejador per a l'esdeveniment 'popstate' (botó enrere)
      const handlePopState = (_event: PopStateEvent) => {
        // Marquem que el tancament ve del navegador
        causedByBackRef.current = true;
        onClose();
      };

      // 3. Escoltem l'esdeveniment
      window.addEventListener('popstate', handlePopState);

      // 4. Cleanup: s'executa quan el component es desmunta o isOpen passa a false
      return () => {
        window.removeEventListener('popstate', handlePopState);

        // Si el modal s'ha tancat per la UI (botó X o click fora) i no pel botó "enrere",
        // hem de fer retrocedir l'historial manualment per eliminar l'estat que hem afegit al principi.
        // Si no ho féssim, l'usuari hauria de clicar "enrere" dues vegades per sortir de la pàgina real.
        if (!causedByBackRef.current) {
          window.history.back();
        }

        // Reiniciem la referència per a la pròxima vegada
        causedByBackRef.current = false;
      };
    }
  }, [isOpen, onClose]);
};