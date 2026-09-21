// src/hooks/useRefreshOnResume.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useRefreshOnResume } from './useRefreshOnResume';
import { CACHE_TTL } from '../constants/cacheConfig';

const TTL = CACHE_TTL.WEATHER;
const MINUTE = 60 * 1000;

function setVisibility(state: 'visible' | 'hidden') {
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => state });
}

// Simula el que fa el navegador en tornar a la pestanya.
function becomeVisible() {
  setVisibility('visible');
  document.dispatchEvent(new Event('visibilitychange'));
}

describe('useRefreshOnResume', () => {
  let loadedAt: number | null;
  let refresh: ReturnType<typeof vi.fn<() => Promise<unknown>>>;

  const mountHook = () =>
    renderHook(
      (props: { refresh: () => Promise<unknown> }) =>
        useRefreshOnResume({ getLastLoadedAt: () => loadedAt, refresh: props.refresh }),
      { initialProps: { refresh } }
    );

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-21T10:00:00Z'));
    setVisibility('visible');
    loadedAt = Date.now();
    // Com el refresc real: en acabar bé, la càrrega correcta passa a ser "ara".
    refresh = vi.fn(async () => { loadedAt = Date.now(); });
  });

  afterEach(() => {
    vi.useRealTimers();
    Reflect.deleteProperty(document, 'visibilityState');
  });

  describe('en tornar a ser visible (visibilitychange)', () => {
    it('no refresca si l\'última càrrega és més recent que el TTL', () => {
      mountHook();
      vi.setSystemTime(loadedAt! + TTL - MINUTE);

      becomeVisible();

      expect(refresh).not.toHaveBeenCalled();
    });

    it('no refresca just al límit del TTL (estrictament més vella)', () => {
      mountHook();
      vi.setSystemTime(loadedAt! + TTL);

      becomeVisible();
      expect(refresh).not.toHaveBeenCalled();

      vi.setSystemTime(loadedAt! + TTL + 1);
      becomeVisible();
      expect(refresh).toHaveBeenCalledTimes(1);
    });

    it('refresca quan han passat més de 15 min', () => {
      mountHook();
      vi.setSystemTime(loadedAt! + TTL + MINUTE);

      becomeVisible();

      expect(refresh).toHaveBeenCalledTimes(1);
    });

    it('no refresca si la pestanya passa a ocultar-se', () => {
      mountHook();
      vi.setSystemTime(loadedAt! + 2 * TTL);

      setVisibility('hidden');
      document.dispatchEvent(new Event('visibilitychange'));

      expect(refresh).not.toHaveBeenCalled();
    });

    it('no refresca sense cap ubicació carregada, per antigues que siguin les dades', async () => {
      loadedAt = null;
      mountHook();

      vi.setSystemTime(Date.now() + 5 * TTL);
      becomeVisible();
      window.dispatchEvent(new Event('online'));
      await vi.advanceTimersByTimeAsync(2 * TTL);

      expect(refresh).not.toHaveBeenCalled();
    });
  });

  describe('altres desvetlladors', () => {
    it('refresca en tornar la connexió (online) si les dades són velles', () => {
      mountHook();
      vi.setSystemTime(loadedAt! + TTL + MINUTE);

      window.dispatchEvent(new Event('online'));

      expect(refresh).toHaveBeenCalledTimes(1);
    });

    it('no refresca en tornar la connexió si les dades són fresques', () => {
      mountHook();
      vi.setSystemTime(loadedAt! + MINUTE);

      window.dispatchEvent(new Event('online'));

      expect(refresh).not.toHaveBeenCalled();
    });

    it('no refresca en tornar la connexió amb la pestanya oculta (ho farà en tornar-hi)', () => {
      mountHook();
      vi.setSystemTime(loadedAt! + TTL + MINUTE);
      setVisibility('hidden');

      window.dispatchEvent(new Event('online'));
      expect(refresh).not.toHaveBeenCalled();

      becomeVisible();
      expect(refresh).toHaveBeenCalledTimes(1);
    });

    it('refresca en restaurar la pàgina de la bfcache (pageshow persisted) però no en una càrrega normal', () => {
      mountHook();
      vi.setSystemTime(loadedAt! + TTL + MINUTE);

      window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: false }));
      expect(refresh).not.toHaveBeenCalled();

      window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }));
      expect(refresh).toHaveBeenCalledTimes(1);
    });
  });

  describe('pestanya oberta en primer pla (sense cap esdeveniment)', () => {
    it('refresca sol quan les dades superen el TTL', async () => {
      mountHook();

      await vi.advanceTimersByTimeAsync(TTL - MINUTE);
      expect(refresh).not.toHaveBeenCalled();

      await vi.advanceTimersByTimeAsync(2 * MINUTE);
      expect(refresh).toHaveBeenCalledTimes(1);
    });

    it('un cop refrescat, torna a esperar un TTL sencer', async () => {
      mountHook();

      await vi.advanceTimersByTimeAsync(TTL + MINUTE);
      expect(refresh).toHaveBeenCalledTimes(1);

      await vi.advanceTimersByTimeAsync(TTL - 2 * MINUTE);
      expect(refresh).toHaveBeenCalledTimes(1);

      await vi.advanceTimersByTimeAsync(3 * MINUTE);
      expect(refresh).toHaveBeenCalledTimes(2);
    });

    it('si el refresc falla, el comprovador reintenta com a molt un cop per TTL (no cada minut)', async () => {
      refresh.mockImplementation(async () => { /* falla: loadedAt no avança */ });
      mountHook();

      await vi.advanceTimersByTimeAsync(TTL + MINUTE);
      expect(refresh).toHaveBeenCalledTimes(1);

      await vi.advanceTimersByTimeAsync(TTL - 2 * MINUTE);
      expect(refresh).toHaveBeenCalledTimes(1);

      await vi.advanceTimersByTimeAsync(3 * MINUTE);
      expect(refresh).toHaveBeenCalledTimes(2);
    });

    it('però un esdeveniment de desvetlla sí que reintenta al moment després d\'un refresc fallit', async () => {
      refresh.mockImplementation(async () => { /* falla */ });
      mountHook();

      await vi.advanceTimersByTimeAsync(TTL + MINUTE);
      expect(refresh).toHaveBeenCalledTimes(1);

      window.dispatchEvent(new Event('online'));
      expect(refresh).toHaveBeenCalledTimes(2);
    });

    it('no refresca mentre la pestanya és oculta', async () => {
      mountHook();
      setVisibility('hidden');

      await vi.advanceTimersByTimeAsync(2 * TTL);

      expect(refresh).not.toHaveBeenCalled();
    });
  });

  describe('robustesa', () => {
    it('no llença un segon refresc mentre n\'hi ha un en curs', async () => {
      let finish!: () => void;
      refresh.mockImplementation(() => new Promise<void>((resolve) => {
        finish = () => { loadedAt = Date.now(); resolve(); };
      }));
      mountHook();
      vi.setSystemTime(loadedAt! + TTL + MINUTE);

      becomeVisible();
      window.dispatchEvent(new Event('online'));
      becomeVisible();
      expect(refresh).toHaveBeenCalledTimes(1);

      finish();
      await vi.advanceTimersByTimeAsync(0);

      // Acabat: les dades ja són fresques, així que tampoc en calen més.
      becomeVisible();
      expect(refresh).toHaveBeenCalledTimes(1);
    });

    it('si el refresc llença, no es queda encallat i en pot fer un altre', async () => {
      refresh.mockRejectedValueOnce(new Error('boom'));
      mountHook();
      vi.setSystemTime(loadedAt! + TTL + MINUTE);

      becomeVisible();
      await vi.advanceTimersByTimeAsync(0);
      expect(refresh).toHaveBeenCalledTimes(1);

      becomeVisible();
      expect(refresh).toHaveBeenCalledTimes(2);
    });

    it('fa servir l\'última funció de refresc sense tornar a subscriure els listeners', () => {
      const { rerender } = mountHook();
      const newer = vi.fn(async () => { loadedAt = Date.now(); });
      rerender({ refresh: newer });
      vi.setSystemTime(loadedAt! + TTL + MINUTE);

      becomeVisible();

      expect(newer).toHaveBeenCalledTimes(1);
      expect(refresh).not.toHaveBeenCalled();
    });

    it('en desmuntar, deixa d\'escoltar esdeveniments i atura el comprovador', async () => {
      const { unmount } = mountHook();
      unmount();
      vi.setSystemTime(loadedAt! + TTL + MINUTE);

      becomeVisible();
      window.dispatchEvent(new Event('online'));
      await vi.advanceTimersByTimeAsync(2 * TTL);

      expect(refresh).not.toHaveBeenCalled();
    });
  });
});
