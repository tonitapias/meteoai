// src/hooks/useModalHistory.ts
import { useEffect, useRef } from 'react';

/**
 * Hook per sincronitzar l'estat d'obertura d'un modal amb l'historial del navegador.
 * Permet que el botó "enrere" (mòbil/navegador) tanqui el modal en lloc de canviar de pàgina.
 * Doctrina Risc Zero: Protegit contra re-renders infinits i condicions de carrera.
 * 
 * @param isOpen - Indica si el modal està actualment obert.
 * @param onClose - Funció que s'executarà per tancar el modal (resetear l'estat).
 */
export const useModalHistory = (isOpen: boolean, onClose: () => void): void => {
  // Aïllament tàctic: guardem la referència de la funció per evitar que
  // els canvis del component pare disparin el useEffect principal.
  const onCloseRef = useRef(onClose);
  
  // Ref per saber si el tancament ha sigut provocat pel maquinari (botó "enrere")
  const causedByBackRef = useRef(false);

  // Mantenim la funció de tancament sempre actualitzada sense provocar cicles de render
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (isOpen) {
      // 1. Quan s'obre el modal, injectem una entrada a l'historial.
      // Utilitzem l'URL actual per no canviar la barra de direccions visualment.
      window.history.pushState({ modalOpen: true }, '', window.location.href);
      causedByBackRef.current = false;

      // 2. Definim l'escut per a l'esdeveniment 'popstate' (botó enrere físic)
      const handlePopState = (_event: PopStateEvent) => {
        // Marquem que el tancament ve del navegador
        causedByBackRef.current = true;
        onCloseRef.current(); // Executem la funció d'apagat segura
      };

      // 3. Escoltem l'esdeveniment a nivell de finestra
      window.addEventListener('popstate', handlePopState);

      // 4. Cleanup rigorós: s'executa quan el component es desmunta o isOpen passa a false
      return () => {
        window.removeEventListener('popstate', handlePopState);

        // Si el modal s'ha tancat per la UI (botó X o click fora) i no pel botó "enrere",
        // fem retrocedir l'historial manualment per eliminar l'estat fantasma.
        if (!causedByBackRef.current) {
          window.history.back();
        }
      };
    }
  }, [isOpen]); // <-- Risc Zero: onClose eliminat de les dependències per evitar el bucle infinit
};