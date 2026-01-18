// src/hooks/useModalHistory.test.ts
import { renderHook } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach, type MockInstance } from 'vitest';
import { useModalHistory } from './useModalHistory';

describe('useModalHistory Hook', () => {
  // Definim les variables per als spies però no els inicialitzem encara
  let pushStateSpy: MockInstance;
  let backSpy: MockInstance;
  const onCloseMock = vi.fn();

  beforeEach(() => {
    // 1. IMPORTANT: Inicialitzem els spies abans de CADA test.
    // Això és necessari perquè el restoreAllMocks() del afterEach els destrueix.
    pushStateSpy = vi.spyOn(window.history, 'pushState');
    backSpy = vi.spyOn(window.history, 'back');

    // 2. Netejem l'historial de crides del mock de tancament
    onCloseMock.mockClear();
  });

  afterEach(() => {
    // 3. Restaurem la implementació original per no afectar altres tests
    vi.restoreAllMocks();
  });

  it('hauria d\'afegir una entrada a l\'historial quan el modal s\'obre (isOpen: true)', () => {
    renderHook(() => useModalHistory(true, onCloseMock));

    // Verifiquem que s'ha fet pushState
    expect(pushStateSpy).toHaveBeenCalledWith({ modalOpen: true }, '', window.location.href);
    // No s'hauria d'haver cridat back()
    expect(backSpy).not.toHaveBeenCalled();
  });

  it('no hauria de fer res si el modal està tancat (isOpen: false)', () => {
    renderHook(() => useModalHistory(false, onCloseMock));

    expect(pushStateSpy).not.toHaveBeenCalled();
    expect(backSpy).not.toHaveBeenCalled();
  });

  it('hauria de cridar onClose quan l\'usuari prem el botó "enrere" (esdeveniment popstate)', () => {
    renderHook(() => useModalHistory(true, onCloseMock));

    // Simulem l'esdeveniment de navegador "Back"
    const popStateEvent = new PopStateEvent('popstate');
    window.dispatchEvent(popStateEvent);

    // Verifiquem que la funció de tancament s'ha executat
    expect(onCloseMock).toHaveBeenCalledTimes(1);
  });

  it('hauria de netejar l\'historial (history.back) si es tanca el modal manualment des de la UI', () => {
    // 1. Iniciem amb el modal obert
    // Guardem referència a rerender per poder canviar les props després
    const { rerender } = renderHook(
      ({ isOpen }) => useModalHistory(isOpen, onCloseMock),
      { initialProps: { isOpen: true } }
    );

    // Ara l'spy està actiu i hauria de detectar la crida
    expect(pushStateSpy).toHaveBeenCalled(); 

    // 2. Tanquem el modal canviant la prop (simulant click a la "X")
    rerender({ isOpen: false });

    // 3. Com que NO ha sigut per popstate, el hook ha de fer back() manualment
    // per eliminar l'estat que hem afegit al principi.
    expect(backSpy).toHaveBeenCalledTimes(1);
  });

  it('NO hauria de fer history.back() extra si el tancament ja ha sigut provocat pel botó "enrere"', () => {
    // 1. Iniciem obert
    const { rerender } = renderHook(
      ({ isOpen }) => useModalHistory(isOpen, onCloseMock),
      { initialProps: { isOpen: true } }
    );

    // 2. Simulem el botó enrere
    const popStateEvent = new PopStateEvent('popstate');
    window.dispatchEvent(popStateEvent);

    expect(onCloseMock).toHaveBeenCalled();

    // 3. El component pare actualitza l'estat a false com a resposta al onClose
    rerender({ isOpen: false });

    // 4. Verifiquem: Com que el tancament l'ha iniciat el navegador,
    // el hook NO ha de cridar back() una altra vegada.
    expect(backSpy).not.toHaveBeenCalled();
  });
});