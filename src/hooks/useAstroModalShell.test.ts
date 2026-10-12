import { renderHook } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { useAstroModalShell } from './useAstroModalShell';

// jsdom no implementa l'API Web Animations: simulem el que retornaria document.getAnimations().
const fakeAnimation = (target: Element, iterations: number, playState: AnimationPlayState = 'running') => {
  const a = {
    playState,
    effect: { target, getComputedTiming: () => ({ iterations }) },
    pause: vi.fn(() => { a.playState = 'paused'; }),
    play: vi.fn(() => { a.playState = 'running'; }),
  };
  return a;
};

describe('useAstroModalShell — pausa del fons', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    // @ts-expect-error neteja del simulacre (jsdom no en té)
    delete document.getAnimations;
  });

  const setup = () => {
    const dashboard = document.body.appendChild(document.createElement('div'));
    const dialog = document.body.appendChild(document.createElement('div'));
    dialog.setAttribute('role', 'dialog');
    const insideDialog = dialog.appendChild(document.createElement('span'));
    const anims = {
      dashboardLoop: fakeAnimation(dashboard, Infinity),
      dashboardOnce: fakeAnimation(dashboard, 1),
      dashboardAlreadyPaused: fakeAnimation(dashboard, Infinity, 'paused'),
      dialogLoop: fakeAnimation(insideDialog, Infinity),
    };
    document.getAnimations = () => Object.values(anims) as unknown as Animation[];
    return { anims, dashboard };
  };

  it("pausa només les animacions infinites de fora del diàleg i les reprèn en tancar", () => {
    const { anims } = setup();
    const { unmount } = renderHook(() => useAstroModalShell(() => {}));

    expect(anims.dashboardLoop.pause).toHaveBeenCalledTimes(1);
    expect(anims.dashboardOnce.pause).not.toHaveBeenCalled();
    expect(anims.dashboardAlreadyPaused.pause).not.toHaveBeenCalled();
    expect(anims.dialogLoop.pause).not.toHaveBeenCalled();

    unmount();
    expect(anims.dashboardLoop.play).toHaveBeenCalledTimes(1);
    // La que ja estava pausada abans d'obrir el modal no és cosa nostra.
    expect(anims.dashboardAlreadyPaused.play).not.toHaveBeenCalled();
  });

  it('no reprèn una animació d\'un element que ja no és al DOM', () => {
    const { anims, dashboard } = setup();
    const { unmount } = renderHook(() => useAstroModalShell(() => {}));
    dashboard.remove();
    unmount();
    expect(anims.dashboardLoop.play).not.toHaveBeenCalled();
  });

  it('no falla en navegadors sense document.getAnimations', () => {
    expect(() => renderHook(() => useAstroModalShell(() => {})).unmount()).not.toThrow();
  });
});
