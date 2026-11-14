// src/utils/autoUpdatePolicy.ts
// Quan es pot posar sola una versió nova de l'app (vegeu components/AutoUpdate.tsx).
//
// La versió nova es descarrega en segon pla i es queda en espera (vite.config.js: registerType 'prompt' i
// skipWaiting/clientsClaim a false): mai no pren el control d'una pantalla que encara executa el codi antic, que és
// el que penjava l'app quan es feia sola (v3.9.6). Aquí només es decideix el MOMENT de fer el canvi, que sempre
// recarrega la pàgina, perquè la recàrrega no molesti:
// - l'app és amagada (s'ha canviat d'app, s'ha bloquejat el mòbil o s'ha canviat de pestanya), o
// - s'acaba d'obrir o de tornar-hi i encara no s'hi ha tocat res;
// - i mai amb un modal, un full o una pantalla oberta a sobre: la recàrrega la tancaria.
import { isTabEntry } from '../components/tabs/tabHistory';

/** Després d'obrir l'app o de tornar-hi, el temps en què encara es pot recarregar si no s'hi ha tocat res. */
export const QUIET_WINDOW_MS = 20_000;

/**
 * Cada quant es mira si hi ha una versió nova mentre l'app és viva. El navegador només ho mira en obrir-la de zero:
 * una app que el mòbil manté en segon pla dies seguits no se n'assabentaria.
 */
export const UPDATE_CHECK_INTERVAL_MS = 60 * 60 * 1000;

export interface UpdateMoment {
  /** La pàgina no es veu (document.visibilityState === 'hidden'). */
  hidden: boolean;
  /** Hi ha un modal, un full o una pantalla a sobre del tauler (isOverlayOpen). */
  overlayOpen: boolean;
  /** S'ha tocat l'app (dit, ratolí, roda o teclat) des que s'ha obert o s'hi ha tornat. */
  interacted: boolean;
  /** Mil·lisegons des que s'ha obert l'app o s'hi ha tornat. */
  msSinceShown: number;
}

export const canApplyUpdateNow = ({ hidden, overlayOpen, interacted, msSinceShown }: UpdateMoment): boolean =>
  !overlayOpen && (hidden || (!interacted && msSinceShown <= QUIET_WINDOW_MS));

/**
 * Hi ha alguna cosa oberta a sobre del tauler. Tots els modals posen una entrada a l'historial perquè l'enrere els
 * tanqui: amb estat propi ({ modalOpen }, { modalId }, { modal }, { planetView }) o, el gràfic de 7 dies, amb
 * #modal-… a la URL. L'única entrada que no és d'un modal és la de les pestanyes. Els que no en posen (el full de
 * compartir) són diàlegs aria-modal.
 */
export const isOverlayOpen = (doc: Document = document, win: Window = window): boolean => {
  if (doc.querySelector('[aria-modal="true"]')) return true;
  if (win.location.hash.startsWith('#modal-')) return true;
  const state: unknown = win.history.state;
  return state !== null && state !== undefined && !isTabEntry(state);
};

export interface UpdateCheckMoment {
  now: number;
  lastCheck: number;
  online: boolean;
  visible: boolean;
}

/** Si toca tornar a mirar si hi ha una versió nova (només amb l'app a la vista, amb xarxa i com a molt cada hora). */
export const shouldCheckForUpdate = ({ now, lastCheck, online, visible }: UpdateCheckMoment): boolean =>
  visible && online && now - lastCheck >= UPDATE_CHECK_INTERVAL_MS;
