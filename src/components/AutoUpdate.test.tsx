// src/components/AutoUpdate.test.tsx
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { ReactElement } from 'react';
import { render, fireEvent } from '@testing-library/react';
import { QUIET_WINDOW_MS, UPDATE_CHECK_INTERVAL_MS } from '../utils/autoUpdatePolicy';

// El Service Worker real no existeix a les proves: el hook de vite-plugin-pwa es fa a mà.
const pwa = vi.hoisted(() => ({
  needRefresh: false,
  updateServiceWorker: vi.fn(async () => {}),
  onRegisteredSW: undefined as undefined | ((swUrl: string, r: ServiceWorkerRegistration | undefined) => void),
}));

vi.mock('virtual:pwa-register/react', () => ({
  useRegisterSW: (options?: { onRegisteredSW?: typeof pwa.onRegisteredSW }) => {
    pwa.onRegisteredSW = options?.onRegisteredSW;
    return {
      needRefresh: [pwa.needRefresh, vi.fn()],
      offlineReady: [false, vi.fn()],
      updateServiceWorker: pwa.updateServiceWorker,
    };
  },
}));

import AutoUpdate from './AutoUpdate';

let visibility: DocumentVisibilityState = 'visible';
let nowMs = 1_000; // performance.now(): ms des que s'ha obert la pàgina

const setVisibility = (next: DocumentVisibilityState) => {
  visibility = next;
  document.dispatchEvent(new Event('visibilitychange'));
};

/** En amagar-se, el canvi no es demana a l'instant (vegeu HIDDEN_APPLY_DELAY_MS a AutoUpdate.tsx). */
const HIDDEN_DELAY_MS = 1_000;

/** Se surt de l'app (s'amaga) i s'hi continua fora prou estona. */
const goAway = () => {
  setVisibility('hidden');
  vi.advanceTimersByTime(HIDDEN_DELAY_MS);
};

/** Arriba una versió nova (el SW nou queda en espera). */
const updateArrives = (rerender: (ui: ReactElement) => void) => {
  pwa.needRefresh = true;
  rerender(<AutoUpdate />);
};

beforeEach(() => {
  pwa.needRefresh = false;
  pwa.updateServiceWorker.mockClear();
  pwa.onRegisteredSW = undefined;
  visibility = 'visible';
  nowMs = 1_000;
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => visibility });
  vi.spyOn(performance, 'now').mockImplementation(() => nowMs);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
  window.history.replaceState(null, '', '/');
});

describe('AutoUpdate → la versió nova es posa sola, sense avís', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
  });

  // Recarregar o navegar amaguen la pàgina just abans de descarregar-la. Demanar el canvi llavors feia que la versió
  // nova prengués el control a mitja càrrega de la pàgina següent (vist en local el 16-11-2026: codi antic amb el
  // SW nou, o la càrrega aturada 31 s).
  it("en recarregar o navegar (s'amaga i es descarrega de seguida), no ho demana", () => {
    const { rerender, unmount } = render(<AutoUpdate />);
    fireEvent.pointerDown(window);
    updateArrives(rerender);

    setVisibility('hidden');
    expect(pwa.updateServiceWorker).not.toHaveBeenCalled();
    unmount();
    vi.advanceTimersByTime(10 * HIDDEN_DELAY_MS);
    expect(pwa.updateServiceWorker).not.toHaveBeenCalled();
  });

  it("si s'hi torna de seguida amb un modal obert, tampoc (l'espera s'anul·la)", () => {
    const { rerender } = render(<AutoUpdate />);
    fireEvent.pointerDown(window);
    updateArrives(rerender);
    window.history.pushState({ modalOpen: true }, '', '/');

    setVisibility('hidden');
    setVisibility('visible');
    vi.advanceTimersByTime(10 * HIDDEN_DELAY_MS);
    expect(pwa.updateServiceWorker).not.toHaveBeenCalled();
  });

  it("no pinta res (ja no hi ha l'avís per acceptar-la)", () => {
    pwa.needRefresh = true;
    const { container } = render(<AutoUpdate />);
    expect(container).toBeEmptyDOMElement();
  });

  it("arriba en acabar d'obrir l'app, sense haver-hi tocat res: es posa de seguida", () => {
    const { rerender } = render(<AutoUpdate />);
    nowMs = 4_000;
    updateArrives(rerender);
    expect(pwa.updateServiceWorker).toHaveBeenCalledTimes(1);
  });

  it("arriba mentre s'està fent servir: espera que se'n surti i es posa llavors", () => {
    const { rerender } = render(<AutoUpdate />);
    fireEvent.pointerDown(window);
    updateArrives(rerender);
    expect(pwa.updateServiceWorker).not.toHaveBeenCalled();

    goAway();
    expect(pwa.updateServiceWorker).toHaveBeenCalledTimes(1);
  });

  it("arriba passada la finestra de calma, encara que no s'hi hagi tocat: també espera", () => {
    const { rerender } = render(<AutoUpdate />);
    nowMs = QUIET_WINDOW_MS + 5_000;
    updateArrives(rerender);
    expect(pwa.updateServiceWorker).not.toHaveBeenCalled();

    goAway();
    expect(pwa.updateServiceWorker).toHaveBeenCalledTimes(1);
  });

  it("amb un modal obert en sortir, no recarrega; en tornar-hi amb el tauler net i sense tocar res, sí", () => {
    const { rerender } = render(<AutoUpdate />);
    fireEvent.keyDown(window, { key: 'Tab' });
    updateArrives(rerender);
    window.history.pushState({ modalOpen: true }, '', '/');

    goAway();
    expect(pwa.updateServiceWorker).not.toHaveBeenCalled();

    // Torna amb el modal encara obert: tampoc.
    nowMs = 600_000;
    setVisibility('visible');
    expect(pwa.updateServiceWorker).not.toHaveBeenCalled();

    // El tanca i se'n va: ara sí.
    window.history.replaceState(null, '', '/');
    goAway();
    expect(pwa.updateServiceWorker).toHaveBeenCalledTimes(1);
  });

  it('tornar a l\'app reinicia la finestra de calma: si la versió ja esperava, es posa en tornar-hi', () => {
    const { rerender } = render(<AutoUpdate />);
    fireEvent.pointerDown(window);
    window.history.pushState({ modalId: 'radarLive' }, '', '/');
    updateArrives(rerender);
    goAway();
    expect(pwa.updateServiceWorker).not.toHaveBeenCalled();

    // Mentre era fora, el radar s'ha tancat (p. ex. l'enrere del sistema).
    window.history.replaceState(null, '', '/');
    nowMs = 900_000;
    setVisibility('visible');
    expect(pwa.updateServiceWorker).toHaveBeenCalledTimes(1);
  });

  it('només ho demana una vegada', () => {
    const { rerender } = render(<AutoUpdate />);
    fireEvent.pointerDown(window);
    updateArrives(rerender);
    goAway();
    setVisibility('visible');
    goAway();
    expect(pwa.updateServiceWorker).toHaveBeenCalledTimes(1);
  });
});

// El navegador no activa la versió en espera mentre l'antiga encara atén peticions (en obrir l'app, sempre): la
// primera petició queda ajornada ~30 s. Vist a producció el 15-11-2026 (v3.60.0 → v3.61.0).
describe('AutoUpdate → si la versió nova continua en espera, ho torna a demanar', () => {
  const RETRY_MS = 3_000;
  const waitingRegistration = () => {
    const registration = { installing: null, waiting: {} as object | null, update: vi.fn(() => Promise.resolve()) };
    pwa.onRegisteredSW?.('/sw.js', registration as unknown as ServiceWorkerRegistration);
    return registration;
  };

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
  });

  it("la versió ja esperava en obrir l'app: ho demana, i ho repeteix fins que s'activa", () => {
    const { rerender } = render(<AutoUpdate />);
    const registration = waitingRegistration();
    updateArrives(rerender);
    expect(pwa.updateServiceWorker).toHaveBeenCalledTimes(1);

    nowMs += RETRY_MS;
    vi.advanceTimersByTime(RETRY_MS);
    expect(pwa.updateServiceWorker).toHaveBeenCalledTimes(2);

    // Ja s'ha activat (la recàrrega és en camí): no cal insistir més.
    registration.waiting = null;
    nowMs += RETRY_MS;
    vi.advanceTimersByTime(RETRY_MS);
    expect(pwa.updateServiceWorker).toHaveBeenCalledTimes(2);
  });

  it("si entretant s'ha tocat l'app, no insisteix fins que se'n surt", () => {
    const { rerender } = render(<AutoUpdate />);
    waitingRegistration();
    updateArrives(rerender);
    expect(pwa.updateServiceWorker).toHaveBeenCalledTimes(1);

    fireEvent.pointerDown(window);
    vi.advanceTimersByTime(RETRY_MS);
    expect(pwa.updateServiceWorker).toHaveBeenCalledTimes(1);

    goAway();
    expect(pwa.updateServiceWorker).toHaveBeenCalledTimes(2);
  });

  it('passada la finestra de calma, deixa d\'insistir', () => {
    const { rerender } = render(<AutoUpdate />);
    waitingRegistration();
    updateArrives(rerender);
    nowMs = QUIET_WINDOW_MS + 1_000;
    vi.advanceTimersByTime(10 * RETRY_MS);
    expect(pwa.updateServiceWorker).toHaveBeenCalledTimes(1);
  });
});

describe('AutoUpdate → mira si hi ha versió nova amb l\'app viva', () => {
  const fakeRegistration = () => {
    const registration = { installing: null, waiting: null, update: vi.fn(() => Promise.resolve()) };
    pwa.onRegisteredSW?.('/sw.js', registration as unknown as ServiceWorkerRegistration);
    return registration;
  };

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] });
    vi.setSystemTime(new Date('2026-11-14T10:00:00Z'));
  });

  it("en tornar-hi, si fa més d'una hora que no s'ha mirat", () => {
    render(<AutoUpdate />);
    const registration = fakeRegistration();

    vi.setSystemTime(new Date('2026-11-14T10:30:00Z'));
    goAway();
    setVisibility('visible');
    expect(registration.update).not.toHaveBeenCalled();

    vi.setSystemTime(new Date('2026-11-14T11:05:00Z'));
    goAway();
    setVisibility('visible');
    expect(registration.update).toHaveBeenCalledTimes(1);

    // I no hi torna fins d'aquí a una altra hora.
    goAway();
    setVisibility('visible');
    expect(registration.update).toHaveBeenCalledTimes(1);
  });

  it("amb la pestanya sempre a la vista (escriptori), cada hora", () => {
    render(<AutoUpdate />);
    const registration = fakeRegistration();
    vi.advanceTimersByTime(UPDATE_CHECK_INTERVAL_MS);
    expect(registration.update).toHaveBeenCalledTimes(1);
  });

  it('sense xarxa no ho intenta', () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    render(<AutoUpdate />);
    const registration = fakeRegistration();
    vi.advanceTimersByTime(2 * UPDATE_CHECK_INTERVAL_MS);
    expect(registration.update).not.toHaveBeenCalled();
  });

  it("si ja n'hi ha una d'esperant, no en busca cap altra", () => {
    render(<AutoUpdate />);
    const registration = fakeRegistration();
    (registration as { waiting: unknown }).waiting = {};
    vi.advanceTimersByTime(UPDATE_CHECK_INTERVAL_MS);
    expect(registration.update).not.toHaveBeenCalled();
  });
});
