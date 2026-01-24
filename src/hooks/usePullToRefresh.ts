// src/hooks/usePullToRefresh.ts
import { useState, useEffect, useCallback, RefObject } from 'react';

interface Options {
  onRefresh: () => Promise<void>;
  threshold?: number; // Píxels per activar el refresh (defecte: 120)
  resistance?: number; // Factor de resistència (defecte: 0.4)
}

export const usePullToRefresh = (
  ref: RefObject<HTMLElement>, 
  { onRefresh, threshold = 120, resistance = 0.4 }: Options
) => {
  const [isPulling, setIsPulling] = useState(false);
  const [pullDist, setPullDist] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleTouchStart = useCallback((e: TouchEvent) => {
    // Només activem si estem a dalt de tot de l'scroll
    if (window.scrollY > 0 && (ref.current && ref.current.scrollTop > 0)) return;
    
    // Guardem la posició inicial
    const touch = e.touches[0];
    const startY = touch.clientY;

    const handleTouchMove = (moveEvent: TouchEvent) => {
      const moveY = moveEvent.touches[0].clientY;
      const dist = moveY - startY;

      // Només si estirem cap avall
      if (dist > 0 && window.scrollY <= 0) {
        // Bloquegem l'scroll natiu (overscroll) per tenir control total
        if (moveEvent.cancelable) moveEvent.preventDefault();
        
        setIsPulling(true);
        // Apliquem resistència logarítmica/factor
        setPullDist(dist * resistance);
      }
    };

    const handleTouchEnd = async () => {
      // Netegem listeners
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);

      // Si hem superat el llindar, refresquem
      if (pullDist > threshold) {
        setIsPulling(false);
        setIsRefreshing(true);
        setPullDist(threshold); // Mantenim l'spinner visible

        // Vibració hòptica (Només Android/Chrome, iOS ho ignora)
        if (typeof navigator !== 'undefined' && navigator.vibrate) {
          navigator.vibrate(50);
        }

        try {
          await onRefresh();
        } finally {
          // Un cop acabat, amaguem
          setTimeout(() => {
            setIsRefreshing(false);
            setPullDist(0);
          }, 500); // Petit delay per suavitat visual
        }
      } else {
        // Si no arriba, torna a lloc (efecte molla)
        setIsPulling(false);
        setPullDist(0);
      }
    };

    document.addEventListener('touchmove', handleTouchMove, { passive: false });
    document.addEventListener('touchend', handleTouchEnd);
  }, [pullDist, onRefresh, resistance, threshold, ref]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    el.addEventListener('touchstart', handleTouchStart, { passive: true });
    return () => {
      el.removeEventListener('touchstart', handleTouchStart);
    };
  }, [handleTouchStart, ref]);

  return { isPulling, isRefreshing, pullDist };
};