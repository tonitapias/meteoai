// src/hooks/useAstroModalShell.ts
// Comportament compartit pels modals "planetaris" (Solar, Lunar): tancament estable amb
// Escape, bloqueig de scroll de fons i el rellotge viu de 30s que alimenta les lectures en
// temps real. L'historial "enrere" del navegador NO es gestiona aquí — ja el centralitza
// useModalHistory a useViewState.ts.
import { useState, useEffect, useRef, useCallback } from 'react';

interface AstroModalShellResult {
  handleClose: () => void;
  now: Date;
}

export const useAstroModalShell = (onClose: () => void): AstroModalShellResult => {
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);
  const handleClose = useCallback(() => onCloseRef.current(), []);

  useEffect(() => {
    const original = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = original; };
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') handleClose(); };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleClose]);

  const [now, setNow] = useState<Date>(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(timer);
  }, []);

  return { handleClose, now };
};
