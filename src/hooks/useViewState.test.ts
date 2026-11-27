// L'objecte `modals` és el valor del context dels modals (AppContext.tsx): ha de ser el mateix mentre cap modal no
// s'obre ni es tanca, o tots els qui el llegeixen es tornarien a renderitzar a cada render de l'App (INP).
import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useViewState } from './useViewState';

describe('useViewState → modals', () => {
  it('el mateix objecte si no canvia cap modal; un de nou quan se n\'obre un', () => {
    const { result, rerender } = renderHook(() => useViewState());
    const first = result.current.state.modals;

    rerender();
    act(() => result.current.actions.setNotification({ type: 'info', msg: 'hola' } as never));
    expect(result.current.state.modals).toBe(first);

    act(() => result.current.actions.setShowRadar(true));
    expect(result.current.state.modals).not.toBe(first);
    expect(result.current.state.modals.showRadar).toBe(true);
  });
});
