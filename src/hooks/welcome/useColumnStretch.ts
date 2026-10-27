// src/hooks/welcome/useColumnStretch.ts
// Els gestos secrets de la benvinguda: estirar la columna del cel cap amunt o aixafar-la cap avall. Mentre el dit (o el
// ratolí) es mou, la columna s'allarga o s'escurça com una goma: només canvien les variables CSS --sky-stretch i
// --sky-press del contenidor, sense tornar a pintar la columna amb React a cada moviment. En deixar-la torna al seu
// lloc amb un petit rebot. Tres estirades seguides obren l'ascensor fins al Meteosat; tres aixafades seguides, el que
// baixa fins a les antípodes (utils/welcome/columnStretch.ts).
import { RefObject, useEffect, useLayoutEffect, useRef } from 'react';
import { createStretchCounter, rubberBand, STRETCH_MIN_FRACTION } from '../../utils/welcome/columnStretch';

/** Part de l'alçada del contenidor que fa la columna (de 0 a 12 km, 380 de les 640 unitats del viewBox). */
const COLUMN_SHARE = 380 / 640;
/** La columna s'allarga com a molt un 30 % de la seva alçada, i s'escurça com a molt un 30 %. */
const MAX_STRETCH = 0.3;
const MAX_PRESS = 0.3;
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
  /** Una aixafada prou llarga (per avançar la càrrega de l'ascensor cap avall). */
  onPush?: () => void;
  /** La tercera aixafada seguida. */
  onOpenDown?: () => void;
  enabled: boolean;
}

export function useColumnStretch(ref: RefObject<HTMLElement | null>, { onPull, onOpen, onPush, onOpenDown, enabled }: Options) {
  // Les funcions, sempre les darreres, sense tornar a enganxar els oients.
  const callbacks = useRef({ onPull, onOpen, onPush, onOpenDown });
  useLayoutEffect(() => { callbacks.current = { onPull, onOpen, onPush, onOpenDown }; }, [onPull, onOpen, onPush, onOpenDown]);

  useEffect(() => {
    const el = ref.current;
    if (!el || !enabled) return;
    // Un comptador per a cada sentit: "tres seguides" vol dir tres del mateix sentit.
    const pulls = createStretchCounter();
    const pushes = createStretchCounter();
    let drag: { id: number; y0: number; dy: number } | null = null;
    let stretch = 1;
    let spring = 0;

    const setStretch = (s: number) => {
      stretch = s;
      el.style.setProperty('--sky-stretch', s.toFixed(4));
      // Quant s'ha aixafat (0–1): el disc s'hi esquerda una mica. Calculat aquí i no amb calc()/max() al CSS, que
      // els WebView antics no entenen dins d'una opacitat.
      el.style.setProperty('--sky-press', Math.max(0, (1 - s) / MAX_PRESS).toFixed(3));
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
      if (px <= 0) return;
      if (drag.dy >= 0) setStretch(1 + rubberBand(drag.dy, px * MAX_STRETCH) / px);
      else setStretch(1 - rubberBand(-drag.dy, px * MAX_PRESS) / px);
    };
    const onUp = (e: PointerEvent) => {
      if (!drag || e.pointerId !== drag.id) return;
      const { dy } = drag;
      const min = columnPx() * STRETCH_MIN_FRACTION;
      drag = null;
      springBack();
      const now = performance.now();
      if (dy > 0 && dy >= min) {
        pushes.reset();
        callbacks.current.onPull?.();
        if (pulls.pull(now)) callbacks.current.onOpen();
      } else if (dy < 0 && -dy >= min && callbacks.current.onOpenDown) {
        pulls.reset();
        callbacks.current.onPush?.();
        if (pushes.pull(now)) callbacks.current.onOpenDown();
      }
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
      el.style.removeProperty('--sky-press');
    };
  }, [ref, enabled]);
}
