// src/components/solar/useSolarScrub.ts
// Motor imperatiu del control lliscant del gràfic "Alçada del sol". Durant un gest no hi ha cap render de
// React: cada fotograma que canvia de minut fa com a molt 5 escriptures al DOM (marcador, cursor, hora,
// coordenades, canal de la brúixola), sense lectures de layout (un sol getBoundingClientRect per gest) ni
// Intl (l'hora surt d'una taula). React només s'actualitza en confirmar: pointerup, click o tecla.
//
// Tàctil: touch-action pan-y; el gest només esdevé arrossegament si el dit es mou ≥ 8 px més en horitzontal
// que en vertical (la mateixa regla amb què el navegador decideix si fa scroll; si el fa, envia pointercancel).
// Un toc es confirma amb `click`, que el navegador no envia si el toc atura un lliscament (fling) del scroll.
// Un sol punter per gest: un segon dit (o el polze que agafa el mòbil) no el pot segrestar.
import { useCallback, useLayoutEffect, useRef } from 'react';
import type { KeyboardEvent, MouseEvent, PointerEvent, RefObject } from 'react';
import * as SunCalc from 'suncalc';
import type { Language } from '../../translations';
import {
  type LightPhase, type MarkerTone, type SolarDayModel, clockAtMinute, geometricAltitude, lightPhase, markerTone,
} from '../../utils/solar/solarDay';
import { type ChartLayout, minuteFromClientX, stepMinute } from '../../utils/solar/solarChart';
import { readoutCoords } from '../../utils/solar/solarFormat';
import { PHASE_KEY, type SolarStrings } from './solarI18n';
import type { ScrubChannel } from './scrubChannel';

/** Mida del marcador del sol (px): el desplaçament el centra al punt de la corba. */
export const MARKER_HALF = 20;
/** Moviment horitzontal mínim (px) abans de decidir que el gest és arrossegar i no un toc o un scroll. */
const INTENT_PX = 8;

type Mode = 'idle' | 'pending' | 'drag' | 'hover';

interface Gesture {
  mode: Mode;
  id: number;
  x0: number;
  y0: number;
  rect: DOMRect | null;
  latestX: number;
  raf: number;
  lastMinute: number;
  lastPhase: LightPhase | null;
  lastTone: MarkerTone | null;
  suppressClick: boolean;
}

const newGesture = (): Gesture => ({
  mode: 'idle', id: -1, x0: 0, y0: 0, rect: null, latestX: 0, raf: 0,
  lastMinute: -1, lastPhase: null, lastTone: null, suppressClick: false,
});

/** Ref d'un node de text únic dins d'un <span> buit que React no toca mai: s'hi escriu amb nodeValue. */
export function useTextSlot(): readonly [RefObject<Text | null>, (el: HTMLElement | null) => void] {
  const textRef = useRef<Text | null>(null);
  const attach = useCallback((el: HTMLElement | null) => {
    if (!el) { textRef.current = null; return; }
    // StrictMode torna a enganxar la ref: es reaprofita el node si ja hi és.
    let node = el.firstChild;
    if (!(node instanceof Text)) {
      node = document.createTextNode('');
      el.appendChild(node);
    }
    textRef.current = node as Text;
  }, []);
  return [textRef, attach] as const;
}

export interface SolarScrubArgs {
  model: SolarDayModel;
  /** Escales del gràfic; null fins que se'n coneix la mida. */
  L: ChartLayout | null;
  lang: Language;
  t: SolarStrings;
  channel: ScrubChannel | null;
  /** Minut confirmat (fixat, ara o migdia solar): el que es pinta en repòs. */
  committedMinute: number;
  /** Etiqueta en repòs al costat de l'hora ("Ara", "Migdia" o '' si està fixat). */
  tag: string;
  onCommit: (minute: number | null) => void;
  cardRef: RefObject<HTMLElement | null>;
  plotRef: RefObject<HTMLElement | null>;
  markerRef: RefObject<HTMLElement | null>;
  cursorRef: RefObject<HTMLElement | null>;
  timeRef: RefObject<Text | null>;
  tagRef: RefObject<Text | null>;
  coordsRef: RefObject<Text | null>;
  phaseRef: RefObject<Text | null>;
}

export interface ScrubHandlers {
  onPointerDown: (e: PointerEvent<HTMLElement>) => void;
  onPointerMove: (e: PointerEvent<HTMLElement>) => void;
  onPointerUp: (e: PointerEvent<HTMLElement>) => void;
  onPointerCancel: (e: PointerEvent<HTMLElement>) => void;
  onPointerLeave: (e: PointerEvent<HTMLElement>) => void;
  onLostPointerCapture: (e: PointerEvent<HTMLElement>) => void;
  onClick: (e: MouseEvent<HTMLElement>) => void;
  onKeyDown: (e: KeyboardEvent<HTMLElement>) => void;
}

/**
 * Pinta un minut: marcador, cursor, hora, coordenades i canal (5 escriptures); la fase i el to del
 * marcador només quan canvien. Sense lectures de layout ni Intl: apte per a cada fotograma.
 * Transformacions 2D: en repòs el marcador i el cursor no són capes pròpies; el CSS només les promou mentre
 * s'arrossega (regla [data-drag="1"]).
 */
function paintMinute(a: SolarScrubArgs, L: ChartLayout, g: Gesture, m: number): void {
  const { model } = a;
  const p = SunCalc.getPosition(new Date(model.startMs + m * 60000), model.lat, model.lon);
  const x = L.x(m), y = L.y(p.altitude);
  const marker = a.markerRef.current;
  if (marker) marker.style.transform = `translate(${(x - MARKER_HALF).toFixed(1)}px,${(y - MARKER_HALF).toFixed(1)}px)`;
  const cursor = a.cursorRef.current;
  if (cursor) cursor.style.transform = `translate(${x.toFixed(1)}px,0)`;
  const time = a.timeRef.current;
  if (time) time.nodeValue = clockAtMinute(model, m);
  const coords = a.coordsRef.current;
  if (coords) coords.nodeValue = readoutCoords(p.azimuth, p.altitude, a.lang, a.t);
  a.channel?.emit(p.azimuth, p.altitude);
  const geo = geometricAltitude(p.altitude);
  const ph = lightPhase(geo), tone = markerTone(geo);
  if (ph !== g.lastPhase) {
    const card = a.cardRef.current;
    if (card) card.dataset.phase = ph;
    const phase = a.phaseRef.current;
    if (phase) phase.nodeValue = a.t[PHASE_KEY[ph]];
    g.lastPhase = ph;
  }
  if (tone !== g.lastTone) {
    if (marker) marker.dataset.tone = tone;
    g.lastTone = tone;
  }
}

/** Estat confirmat (en repòs): força fase i to (poden haver canviat el dia o l'idioma) i posa l'etiqueta. */
function paintCommitted(a: SolarScrubArgs, g: Gesture): void {
  if (!a.L) return;
  g.lastPhase = null;
  g.lastTone = null;
  paintMinute(a, a.L, g, a.committedMinute);
  const tag = a.tagRef.current;
  if (tag) tag.nodeValue = a.tag;
}

const isActive = (g: Gesture) => g.mode === 'drag' || g.mode === 'hover';

export function useSolarScrub(a: SolarScrubArgs): ScrubHandlers {
  const gestureRef = useRef<Gesture>(newGesture());
  const {
    model, L, lang, t, channel, committedMinute, tag, onCommit,
    cardRef, plotRef, markerRef, cursorRef, timeRef, tagRef, coordsRef, phaseRef,
  } = a;

  // Estat confirmat abans de pintar. Mai durant un gest: el rellotge de 30 s no ha de moure el marcador
  // que l'usuari arrossega.
  useLayoutEffect(() => {
    const g = gestureRef.current;
    if (isActive(g)) return;
    paintCommitted({
      model, L, lang, t, channel, committedMinute, tag, onCommit,
      cardRef, plotRef, markerRef, cursorRef, timeRef, tagRef, coordsRef, phaseRef,
    }, g);
  }, [model, L, lang, t, channel, committedMinute, tag, onCommit,
    cardRef, plotRef, markerRef, cursorRef, timeRef, tagRef, coordsRef, phaseRef]);

  // Desmuntatge a mig gest: cap fotograma pendent.
  useLayoutEffect(() => () => {
    const g = gestureRef.current;
    if (g.raf) cancelAnimationFrame(g.raf);
    g.raf = 0;
  }, []);

  const frame = () => {
    const g = gestureRef.current;
    g.raf = 0;
    if (!isActive(g) || !g.rect || !L) return;
    const m = minuteFromClientX(g.latestX, g.rect, L, model.spanMin);
    if (m === g.lastMinute) return;
    g.lastMinute = m;
    paintMinute(a, L, g, m);
  };
  const schedule = (g: Gesture) => {
    if (!g.raf) g.raf = requestAnimationFrame(frame);
  };
  const setDrag = (on: boolean) => {
    const card = cardRef.current;
    if (card) card.dataset.drag = on ? '1' : '0';
  };
  const begin = (g: Gesture, e: PointerEvent<HTMLElement>) => {
    g.mode = 'drag';
    g.id = e.pointerId;
    try { plotRef.current?.setPointerCapture(e.pointerId); } catch { /* el punter ja no hi és */ }
    setDrag(true);
    const tagNode = tagRef.current;
    if (tagNode) tagNode.nodeValue = '';
    g.suppressClick = true;
    g.latestX = e.clientX;
    schedule(g);
  };
  const end = (g: Gesture) => {
    if (g.raf) cancelAnimationFrame(g.raf);
    g.raf = 0;
    g.mode = 'idle';
    g.lastMinute = -1;
    setDrag(false);
  };
  const revert = (g: Gesture) => {
    end(g);
    paintCommitted(a, g);
  };
  const plotRect = () => plotRef.current?.getBoundingClientRect() ?? null;

  // Durant un gest tàctil o d'arrossegament només compta el punter que el va començar.
  const isOther = (g: Gesture, e: PointerEvent<HTMLElement>) =>
    (g.mode === 'pending' || g.mode === 'drag') && e.pointerId !== g.id;

  return {
    onPointerDown: e => {
      const g = gestureRef.current;
      if (!e.isPrimary || g.mode === 'pending' || g.mode === 'drag') return;   // segon dit: s'ignora
      g.suppressClick = false;
      if (!L) return;
      // Pantalla tàctil amb ratolí: un toc mentre hi ha vista prèvia del ratolí la desfà primer.
      if (g.mode === 'hover') revert(g);
      if (e.pointerType === 'mouse') {
        if (e.button !== 0) return;
        g.rect = plotRect();
        begin(g, e);
        return;
      }
      // Tàctil o llapis: encara no se sap si és un toc, un arrossegament o un scroll; res de visual.
      g.mode = 'pending';
      g.id = e.pointerId;
      g.x0 = e.clientX;
      g.y0 = e.clientY;
    },
    onPointerMove: e => {
      const g = gestureRef.current;
      if (isOther(g, e)) return;
      if (g.mode === 'idle') {
        // Ratolí per sobre sense prémer: vista prèvia (es desfà en sortir).
        if (e.pointerType !== 'mouse' || e.buttons !== 0 || !L) return;
        g.rect = plotRect();
        g.mode = 'hover';
        setDrag(true);
      } else if (g.mode === 'pending') {
        // Mateixa regla que el navegador (|dx| > |dy|): si el gest és més vertical, el navegador fa scroll i
        // envia pointercancel; si no, el gràfic l'agafa. Així no queda cap angle on no passi res.
        const dx = Math.abs(e.clientX - g.x0), dy = Math.abs(e.clientY - g.y0);
        if (dx >= INTENT_PX && dx > dy) {
          g.rect = plotRect();
          begin(g, e);
        }
        return;
      }
      g.latestX = e.clientX;
      schedule(g);
    },
    onPointerUp: e => {
      const g = gestureRef.current;
      if (isOther(g, e)) return;
      if (g.mode === 'pending') { g.mode = 'idle'; return; }   // un toc es confirma amb click
      if (g.mode !== 'drag' || !L) return;
      const m = minuteFromClientX(e.clientX, g.rect ?? plotRect() ?? { left: 0 }, L, model.spanMin);
      g.lastPhase = null;
      g.lastTone = null;
      paintMinute(a, L, g, m);
      end(g);
      onCommit(m);   // l'única actualització de React del gest
    },
    onPointerCancel: e => {
      const g = gestureRef.current;
      if (isOther(g, e)) return;
      if (g.mode === 'pending') g.mode = 'idle';
      else if (isActive(g)) revert(g);
    },
    onPointerLeave: e => {
      const g = gestureRef.current;
      if (isOther(g, e)) return;
      if (g.mode === 'hover') revert(g);
      else if (g.mode === 'pending') g.mode = 'idle';
      // drag: el punter està capturat i el gest continua fora del gràfic
    },
    onLostPointerCapture: e => {
      // Només la captura del gràfic mateix. En tàctil el navegador captura implícitament el punter a l'element
      // tocat (l'<svg>); quan begin() el passa al gràfic, l'<svg> rep un lostpointercapture que arriba aquí per
      // bombolla i que no vol dir que el gest s'hagi acabat.
      if (e.target !== e.currentTarget) return;
      const g = gestureRef.current;
      if (g.mode === 'drag' && e.pointerId === g.id) revert(g);
    },
    onClick: e => {
      const g = gestureRef.current;
      if (g.suppressClick) { g.suppressClick = false; return; }
      const rect = plotRect();
      if (!L || !rect) return;
      onCommit(minuteFromClientX(e.clientX, rect, L, model.spanMin));
    },
    onKeyDown: e => {
      const next = stepMinute(committedMinute, e.key, model.spanMin);
      if (next === null) return;
      e.preventDefault();
      // Amb el ratolí quiet a sobre del gràfic hi ha vista prèvia: es desfà perquè el pas de teclat es pinti
      // (si el pas no canvia el minut confirmat, React no tornaria a pintar i quedaria la vista prèvia).
      const g = gestureRef.current;
      if (g.mode === 'hover') revert(g);
      onCommit(next);
    },
  };
}
