import { useViewState } from '../useViewState';

export function useUIController() {
  // useViewState ja gestiona el rellotge, els modals i l'historial del navegador
  const view = useViewState();

  return {
    state: view.state,    // now, showDebug, notification...
    actions: view.actions, // setNotification, toggleDebug...
    modals: view.state.modals // Drecera útil per al Controller principal
  };
}