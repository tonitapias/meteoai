import { useEffect, type RefObject } from 'react';

const FOCUSABLE_SELECTOR = [
  'a[href]', 'button:not([disabled])', 'input:not([disabled])', 'select:not([disabled])',
  'textarea:not([disabled])', '[tabindex]:not([tabindex="-1"])'
].join(',');

/**
 * Gestió de focus d'un diàleg modal (aria-modal): en obrir-se el focus hi entra, el Tab hi dóna la volta
 * sense escapar-se cap a la pàgina de darrere i, en tancar-se, el focus torna a l'element que l'havia obert.
 * Sense això, un usuari de teclat o de lector de pantalla obre el modal i continua "dins" la pàgina de sota.
 *
 * `dialogRef` ha d'apuntar a l'arrel del diàleg (ja muntada quan `isOpen` és true).
 */
export const useDialogFocus = (isOpen: boolean, dialogRef: RefObject<HTMLElement | null>): void => {
  useEffect(() => {
    if (!isOpen || typeof document === 'undefined') return;

    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const dialog = dialogRef.current;
    if (!dialog) return;

    const focusable = (): HTMLElement[] =>
      Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));

    // El diàleg mateix rep el focus si no té cap control (i perquè Escape/Tab tinguin on caure).
    if (!dialog.hasAttribute('tabindex')) dialog.setAttribute('tabindex', '-1');
    (focusable()[0] ?? dialog).focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      const items = focusable();
      if (items.length === 0) {
        e.preventDefault();
        dialog.focus();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      const outside = !(active instanceof Node) || !dialog.contains(active);

      if (e.shiftKey && (active === first || active === dialog || outside)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (active === last || outside)) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      // Tornem el focus a qui va obrir el diàleg, si encara és a la pàgina.
      if (opener && opener.isConnected) opener.focus();
    };
  }, [isOpen, dialogRef]);
};
