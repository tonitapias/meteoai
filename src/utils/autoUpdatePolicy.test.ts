// src/utils/autoUpdatePolicy.test.ts
import { describe, it, expect, afterEach } from 'vitest';
import {
  canApplyUpdateNow,
  isOverlayOpen,
  shouldCheckForUpdate,
  QUIET_WINDOW_MS,
  UPDATE_CHECK_INTERVAL_MS,
} from './autoUpdatePolicy';

const moment = (over: Partial<Parameters<typeof canApplyUpdateNow>[0]> = {}) => ({
  hidden: false,
  overlayOpen: false,
  interacted: false,
  msSinceShown: 1_000,
  ...over,
});

describe('canApplyUpdateNow → quan es pot recarregar sense molestar', () => {
  it("acabada d'obrir i sense tocar-la: sí", () => {
    expect(canApplyUpdateNow(moment())).toBe(true);
    expect(canApplyUpdateNow(moment({ msSinceShown: QUIET_WINDOW_MS }))).toBe(true);
  });

  it("si ja s'hi ha tocat res, o ja fa estona que és oberta, a la vista no", () => {
    expect(canApplyUpdateNow(moment({ interacted: true }))).toBe(false);
    expect(canApplyUpdateNow(moment({ msSinceShown: QUIET_WINDOW_MS + 1 }))).toBe(false);
  });

  it("amagada (s'ha canviat d'app o bloquejat el mòbil): sí, encara que s'hi hagi tocat", () => {
    expect(canApplyUpdateNow(moment({ hidden: true, interacted: true, msSinceShown: 3_600_000 }))).toBe(true);
  });

  it('amb un modal obert, mai: la recàrrega el tancaria', () => {
    expect(canApplyUpdateNow(moment({ overlayOpen: true }))).toBe(false);
    expect(canApplyUpdateNow(moment({ overlayOpen: true, hidden: true }))).toBe(false);
  });
});

describe('isOverlayOpen → hi ha alguna cosa oberta a sobre del tauler', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    window.history.replaceState(null, '', '/');
  });

  it('el tauler sol, també en una pestanya (entrada de les pestanyes): no', () => {
    expect(isOverlayOpen()).toBe(false);
    window.history.replaceState({ meteoaiTabs: true }, '', '/?tab=forecast');
    expect(isOverlayOpen()).toBe(false);
  });

  it("els modals amb entrada d'historial pròpia (useModalHistory, radar, consens, planeta, benvinguda): sí", () => {
    for (const state of [{ modalOpen: true }, { modalId: 'radarLive' }, { modalOpen: 'consensus' }, { planetView: true }, { modal: 'meteo_sky_elevator' }]) {
      window.history.replaceState(state, '', '/');
      expect(isOverlayOpen()).toBe(true);
    }
  });

  it('el gràfic de 7 dies (#modal-… a la URL, sense estat): sí', () => {
    window.history.replaceState(null, '', '/#modal-trendChart');
    expect(isOverlayOpen()).toBe(true);
  });

  it('un diàleg aria-modal sense entrada (el full de compartir): sí', () => {
    document.body.innerHTML = '<div role="dialog" aria-modal="true"></div>';
    expect(isOverlayOpen()).toBe(true);
  });
});

describe('shouldCheckForUpdate → tornar a mirar si hi ha versió nova', () => {
  const base = { now: 10 * UPDATE_CHECK_INTERVAL_MS, lastCheck: 0, online: true, visible: true };

  it("si fa una hora o més de l'última vegada, amb xarxa i a la vista", () => {
    expect(shouldCheckForUpdate(base)).toBe(true);
    expect(shouldCheckForUpdate({ ...base, lastCheck: base.now - UPDATE_CHECK_INTERVAL_MS })).toBe(true);
  });

  it('no abans d\'una hora, ni sense xarxa, ni amb l\'app amagada', () => {
    expect(shouldCheckForUpdate({ ...base, lastCheck: base.now - UPDATE_CHECK_INTERVAL_MS + 1 })).toBe(false);
    expect(shouldCheckForUpdate({ ...base, online: false })).toBe(false);
    expect(shouldCheckForUpdate({ ...base, visible: false })).toBe(false);
  });
});
