// src/hooks/welcome/useHoldGesture.ts
import { useState, useRef, useCallback, useEffect } from 'react';
import type { SyntheticEvent, MouseEvent as ReactMouseEvent, KeyboardEvent as ReactKeyboardEvent } from 'react';

interface UseHoldGestureProps {
  loading: boolean;
  onLocate: () => void;
  // Circumferència del traç SVG que representa el progrés (2πr) — cal
  // perquè aquest hook no coneix la geometria del cercle, només l'anima.
  ringCircumference: number;
  holdDurationMs?: number;
}

/**
 * Gest "prem i mantén" del botó d'inici de WelcomeScreen (GPU Hold-to-Arm):
 * anima l'anell de progrés mutant el DOM directament via refs (no re-renders
 * de React a 60fps), dona feedback tàctil als llindars de 25/50/75%, i
 * detecta un clic massa ràpid (<350ms) per mostrar l'avís "mantén-lo premut".
 */
export function useHoldGesture({ loading, onLocate, ringCircumference, holdDurationMs = 1500 }: UseHoldGestureProps) {
  const [isHolding, setIsHolding] = useState(false);
  const [tapWarning, setTapWarning] = useState(false);
  const [isArmed, setIsArmed] = useState(false);

  // Refs per manipular el DOM directament evitant 60 re-renders de React per segon
  const progressRingRef = useRef<SVGCircleElement>(null);
  const progressTextRef = useRef<HTMLSpanElement>(null);
  const animationFrameRef = useRef<number | null>(null);
  const warningTimerRef = useRef<number | null>(null);

  const startTimeRef = useRef<number>(0);
  const lastHapticCheckpointRef = useRef<number>(0); // Últim llindar de 25/50/75% ja vibrat

  const startHold = useCallback((e?: SyntheticEvent | Event) => {
    if (loading || isArmed) return;

    // Evitem menús i text-selection en dispositius mòbils, bloqueig de botó dret al PC
    if (e && 'touches' in e && e.cancelable) e.preventDefault();
    if (e && 'button' in e && (e as ReactMouseEvent).button !== 0) return;

    // Motor tàptic: Confirmació inicial
    if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(15);

    setIsHolding(true);
    setTapWarning(false);
    startTimeRef.current = Date.now();
    lastHapticCheckpointRef.current = 0;

    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    if (warningTimerRef.current) window.clearTimeout(warningTimerRef.current);

    // Bucle d'animació per GPU
    const animate = () => {
      const elapsed = Date.now() - startTimeRef.current;
      const progress = Math.min((elapsed / holdDurationMs) * 100, 100);

      // Mutacions directes al DOM (Estalvi de Bateria extrem)
      if (progressRingRef.current) {
        progressRingRef.current.style.strokeDashoffset = `${ringCircumference * (1 - progress / 100)}`;
      }
      if (progressTextRef.current) {
        progressTextRef.current.innerText = Math.floor(progress).toString();
      }

      // Micro-batecs tàptics als llindars de 25/50/75%: un únic tap per llindar,
      // independent del framerate (abans `progress % 25 < 1.5` podia disparar-se
      // diverses vegades seguides a pantalles d'alta taxa de refresc, o saltar-se
      // el llindar si el framerate era baix).
      const hapticCheckpoint = Math.floor(progress / 25);
      if (hapticCheckpoint > lastHapticCheckpointRef.current && hapticCheckpoint >= 1 && hapticCheckpoint <= 3) {
        lastHapticCheckpointRef.current = hapticCheckpoint;
        if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(10);
      }

      // Èxit total
      if (progress >= 100) {
        setIsHolding(false);
        setIsArmed(true);

        // Patró vibració èxit i salt de pantalla
        if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate([100, 50, 100]);
        setTimeout(() => { onLocate(); }, 600);
      } else {
        // Continuar el bucle a 60fps
        animationFrameRef.current = requestAnimationFrame(animate);
      }
    };

    // Reseteig inicial de l'anell abans de començar el cicle visual
    if (progressRingRef.current) progressRingRef.current.style.strokeDashoffset = `${ringCircumference}`;
    if (progressTextRef.current) progressTextRef.current.innerText = '0';

    animationFrameRef.current = requestAnimationFrame(animate);
  }, [loading, isArmed, onLocate, holdDurationMs, ringCircumference]);

  const cancelHold = useCallback(() => {
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    if (isArmed) return;

    const elapsed = Date.now() - startTimeRef.current;
    setIsHolding(false);

    // Sistema Educatiu "Anti-Tap": si deixen anar ràpid (<350ms) salta l'error
    if (elapsed > 0 && elapsed < 350) {
      setTapWarning(true);
      // Vibració seca d'error
      if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate([40, 40, 40]);

      warningTimerRef.current = window.setTimeout(() => {
        setTapWarning(false);
      }, 1500);
    }
  }, [isArmed]);

  // Gestió d'accessibilitat: Suport de Teclat per a PC (Paritat de plataformes)
  const handleKeyDown = useCallback((e: ReactKeyboardEvent) => {
    if (e.key === ' ' || e.key === 'Enter') {
      if (!e.repeat) startHold(e); // El preventDefault evitarà fer scroll amb l'Espai
      e.preventDefault();
    }
  }, [startHold]);

  const handleKeyUp = useCallback((e: ReactKeyboardEvent) => {
    if (e.key === ' ' || e.key === 'Enter') {
      cancelHold();
    }
  }, [cancelHold]);

  useEffect(() => {
    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      if (warningTimerRef.current) window.clearTimeout(warningTimerRef.current);
    };
  }, []);

  return {
    isHolding, tapWarning, isArmed,
    progressRingRef, progressTextRef,
    startHold, cancelHold, handleKeyDown, handleKeyUp
  };
}
