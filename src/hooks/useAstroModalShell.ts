// src/hooks/useAstroModalShell.ts
// Comportament compartit pels modals "planetaris" (Solar, Lunar) i els experts: tancament
// estable amb Escape, bloqueig de scroll de fons, pausa de les animacions del dashboard que
// queda tapat i el rellotge viu de 30s que alimenta les lectures en temps real. L'historial
// "enrere" del navegador NO es gestiona aquí — ja el centralitza useModalHistory a useViewState.ts.
import { useState, useEffect, useRef, useCallback, type RefObject } from 'react';
import { useDialogFocus } from './useDialogFocus';

interface AstroModalShellResult {
  handleClose: () => void;
  now: Date;
}

const targetOf = (a: Animation) => (a.effect as KeyframeEffect | null)?.target ?? null;

/**
 * Pausa les animacions infinites de fora dels diàlegs i retorna la funció que les reprèn. Amb
 * el modal obert (fons opac a pantalla completa) el dashboard no es veu, però les seves
 * animacions (17 en mòbil, 30 en escriptori, +30 partícules si plou) seguien demanant un frame
 * nou a cada refresc. Una a una amb l'API Web Animations costa ~0,3 ms; una regla CSS global
 * d'animation-play-state recalculava l'estil de tot el document: 60-120 ms per obrir o tancar.
 */
export const pauseBackgroundAnimations = (): (() => void) => {
  if (typeof document.getAnimations !== 'function') return () => {};
  const paused = document.getAnimations().filter(a => {
    const target = targetOf(a);
    return a.playState === 'running'
      && a.effect?.getComputedTiming().iterations === Infinity
      && target !== null && !target.closest('[role="dialog"]');
  });
  paused.forEach(a => a.pause());
  // Només les que hem pausat nosaltres i encara són al DOM (un widget pot haver-se desmuntat).
  return () => paused.forEach(a => { if (a.playState === 'paused' && targetOf(a)?.isConnected) a.play(); });
};

const NO_DIALOG: RefObject<HTMLElement | null> = { current: null };

/**
 * `dialogRef`: l'arrel del diàleg. Amb la ref, el focus hi entra, el Tab no en surt, el fons queda inert i en tancar
 * torna al giny que l'ha obert (useDialogFocus). Sense, res d'això: Solar i Lluna ja criden useDialogFocus pel seu
 * compte. Abans cap dels modals de ginys (pressió, UV, aire, CAPE, rosada, visibilitat, núvols, cota de neu, vent,
 * extrems del planeta) movia el focus (auditoria d'UX, segona volta, M7).
 */
export const useAstroModalShell = (onClose: () => void, dialogRef?: RefObject<HTMLElement | null>): AstroModalShellResult => {
  useDialogFocus(dialogRef !== undefined, dialogRef ?? NO_DIALOG);
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);
  const handleClose = useCallback(() => onCloseRef.current(), []);

  useEffect(() => {
    const original = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = original; };
  }, []);

  useEffect(() => pauseBackgroundAnimations(), []);

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
