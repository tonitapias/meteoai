// src/hooks/welcome/useColumnStretch.ts
// El gest secret de la benvinguda: estirar la columna del cel cap amunt. Mentre el dit (o el ratolí) puja, la columna
// s'allarga com una goma: només canvia la variable CSS --sky-stretch del contenidor, sense tornar a pintar la columna
// amb React a cada moviment. En deixar-la torna al seu lloc amb un petit rebot, i tres estirades seguides obren
// l'ascensor (utils/welcome/columnStretch.ts).
import { RefObject, useEffect, useLayoutEffect, useRef } from 'react';
import { createStretchCounter, rubberBand, STRETCH_MIN_FRACTION } from '../../utils/welcome/columnStretch';

/** Part de l'alçada del contenidor que fa la columna (de 0 a 12 km, 380 de les 640 unitats del viewBox). */
const COLUMN_SHARE = 380 / 640;
/** La columna s'allarga com a molt un 30 % de la seva alçada. */
const MAX_STRETCH = 0.3;
const SPRING_MS = 420;
// Torna amb un rebot: passa una mica de llarg (la columna s'aixafa un moment) i s'atura.
const easeOutBack = (t: number) => 1 + 2.70158 * (t - 1) ** 3 + 1.70158 * (t - 1) ** 2;
const easeOutCubic = (t: number) => 1 - (1 - t) ** 3;
const prefersReducedMotion = () =>
  typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

interface Options {
  /** Una estirada prou llarga (per avançar la càrrega de l'ascensor). */
  onPull?: () => void;
  /** La tercera estirada seguida. */
  onOpen: () => void;
  enabled: boolean;
}

export function useColumnStretch(ref: RefObject<HTMLElement | null>, { onPull, onOpen, enabled }: Options) {
  // Les funcions, sempre les darreres, sense tornar a enganxar els oients.
  const callbacks = useRef({ onPull, onOpen });
  useLayoutEffect(() => { callbacks.current = { onPull, onOpen }; }, [onPull, onOpen]);

  useEffect(() => {
    const el = ref.current;
    if (!el || !enabled) return;
    const counter = createStretchCounter();
    let drag: { id: number; y0: number; dy: number } | null = null;
    let stretch = 1;
    let spring = 0;

    const setStretch = (s: number) => {
      stretch = s;
      el.style.setProperty('--sky-stretch', s.toFixed(4));
    };
    const columnPx = () => el.clientHeight * COLUMN_SHARE;
    const springBack = () => {
      cancelAnimationFrame(spring);
      const from = stretch;
      if (from === 1) return;
      const ease = prefersReducedMotion() ? easeOutCubic : easeOutBack;
      let t0 = -1;
      const step = (now: number) => {
        if (t0 < 0) t0 = now;
        const p = Math.min(1, (now - t0) / SPRING_MS);
        setStretch(1 + (from - 1) * (1 - ease(p)));
        if (p < 1) spring = requestAnimationFrame(step);
      };
      spring = requestAnimationFrame(step);
    };

    const onDown = (e: PointerEvent) => {
      if (!e.isPrimary || (e.pointerType === 'mouse' && e.button !== 0)) return;
      cancelAnimationFrame(spring);
      drag = { id: e.pointerId, y0: e.clientY, dy: 0 };
      // El contenidor rep la resta del gest encara que el dit surti de la columna.
      try { el.setPointerCapture(e.pointerId); } catch { /* navegadors sense captura: el gest segueix igual */ }
      // Amb el ratolí, que arrossegar no seleccioni text.
      if (e.pointerType === 'mouse') e.preventDefault();
    };
    const onMove = (e: PointerEvent) => {
      if (!drag || e.pointerId !== drag.id) return;
      drag.dy = drag.y0 - e.clientY;
      const px = columnPx();
      if (px > 0) setStretch(1 + rubberBand(drag.dy, px * MAX_STRETCH) / px);
    };
    const onUp = (e: PointerEvent) => {
      if (!drag || e.pointerId !== drag.id) return;
      const pulled = drag.dy >= columnPx() * STRETCH_MIN_FRACTION;
      drag = null;
      springBack();
      if (!pulled) return;
      callbacks.current.onPull?.();
      if (counter.pull(performance.now())) callbacks.current.onOpen();
    };
    const onCancel = (e: PointerEvent) => {
      if (!drag || e.pointerId !== drag.id) return;
      drag = null;
      springBack();
    };

    el.addEventListener('pointerdown', onDown);
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerup', onUp);
    el.addEventListener('pointercancel', onCancel);
    return () => {
      el.removeEventListener('pointerdown', onDown);
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerup', onUp);
      el.removeEventListener('pointercancel', onCancel);
      cancelAnimationFrame(spring);
      el.style.removeProperty('--sky-stretch');
    };
  }, [ref, enabled]);
}
