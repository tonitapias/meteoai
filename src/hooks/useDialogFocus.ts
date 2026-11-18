import { useEffect, useRef, type RefObject } from 'react';
import { getPointerOpener } from '../utils/lastPressed';

const FOCUSABLE_SELECTOR = [
  'a[href]', 'button:not([disabled])', 'input:not([disabled])', 'select:not([disabled])',
  'textarea:not([disabled])', '[tabindex]:not([tabindex="-1"])'
].join(',');

/**
 * Elements que es poden enfocar de debò. Abans hi entraven també els amagats: al radar, el primer era la creu
 * `sm:hidden` del mòbil i, a partir de 640 px, `focus()` no hi feia res (el focus es quedava al <body> i el Tab no
 * entrava mai al diàleg); en mòbil l'últim era la creu `hidden sm:flex` i el Tab se n'escapava (auditoria d'UX, segona
 * volta, M7). En un navegador, un element sense cap caixa (display:none, o dins d'un d'amagat) no és visible; on no hi
 * ha disseny (les proves, jsdom: res no té caixa) es mira l'estil calculat fins al diàleg.
 */
const focusableIn = (dialog: HTMLElement): HTMLElement[] => {
  const hasLayout = dialog.getClientRects().length > 0;
  return Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter((el) => {
    if (el.closest('[inert]')) return false;
    if (hasLayout) {
      if (el.getClientRects().length === 0) return false;
      return getComputedStyle(el).visibility !== 'hidden';
    }
    for (let node: HTMLElement | null = el; node && node !== dialog.parentElement; node = node.parentElement) {
      const style = getComputedStyle(node);
      if (node.hidden || style.display === 'none' || style.visibility === 'hidden') return false;
    }
    return true;
  });
};

// --- El fons, inert mentre hi ha un diàleg obert ------------------------------------------------------------------
// Tot el que no és el diàleg (ni un avantpassat seu) rep `inert`: ni el teclat ni el lector de pantalla hi arriben.
// Abans només la barra de pestanyes quedava inert. Comptador per element: dos diàlegs niats (Configuració → Com
// funciona) poden bloquejar el mateix element, i només es desbloqueja quan cap dels dos el necessita. Els elements que
// ja eren inert abans no es toquen.
const inertLocks = new Map<Element, number>();

const lockBackground = (dialog: HTMLElement): Element[] => {
  const locked: Element[] = [];
  for (let node: Element = dialog; node.parentElement && node !== document.body; node = node.parentElement) {
    for (const sibling of Array.from(node.parentElement.children)) {
      if (sibling === node || sibling.tagName === 'SCRIPT' || sibling.tagName === 'STYLE') continue;
      const count = inertLocks.get(sibling) ?? 0;
      if (count === 0 && sibling.hasAttribute('inert')) continue; // ja ho era: no és nostre
      inertLocks.set(sibling, count + 1);
      if (count === 0) sibling.setAttribute('inert', '');
      locked.push(sibling);
    }
  }
  return locked;
};

const unlockBackground = (locked: Element[]): void => {
  for (const el of locked) {
    const count = (inertLocks.get(el) ?? 1) - 1;
    if (count <= 0) {
      inertLocks.delete(el);
      el.removeAttribute('inert');
    } else {
      inertLocks.set(el, count);
    }
  }
};

/**
 * Gestió de focus d'un diàleg modal (aria-modal): en obrir-se el focus hi entra, el Tab hi dóna la volta
 * sense escapar-se cap a la pàgina de darrere, el fons queda inert i, en tancar-se, el focus torna a l'element que
 * l'havia obert. Sense això, un usuari de teclat o de lector de pantalla obre el modal i continua "dins" la pàgina de sota.
 *
 * `dialogRef` ha d'apuntar a l'arrel del diàleg (ja muntada quan `isOpen` és true).
 */
export const useDialogFocus = (isOpen: boolean, dialogRef: RefObject<HTMLElement | null>): void => {
  // L'origen es recorda mentre el diàleg és muntat: Configuració s'aparta mentre «Com funciona» és obert i, en tornar,
  // el focus és a dins (o ha estat el teclat): sense això, en tancar Configuració el focus no tornava a l'engranatge.
  const openerRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (!isOpen || typeof document === 'undefined') return;

    const dialog = dialogRef.current;
    if (!dialog) return;

    // Qui l'ha obert: amb un toc o un clic, el control premut (Safari no l'enfoca i activeElement pot ser un altre); amb
    // el teclat, l'element enfocat.
    const active = document.activeElement instanceof HTMLElement && document.activeElement !== document.body
      && !dialog.contains(document.activeElement)
      ? document.activeElement
      : null;
    const pressed = getPointerOpener();
    const remembered = openerRef.current?.isConnected && !dialog.contains(openerRef.current) ? openerRef.current : null;
    const opener = (pressed && !dialog.contains(pressed) ? pressed : active) ?? remembered;
    openerRef.current = opener;

    const locked = lockBackground(dialog);

    // El diàleg mateix rep el focus si no té cap control (i perquè Escape/Tab tinguin on caure).
    if (!dialog.hasAttribute('tabindex')) dialog.setAttribute('tabindex', '-1');
    (focusableIn(dialog)[0] ?? dialog).focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      const items = focusableIn(dialog);
      if (items.length === 0) {
        e.preventDefault();
        dialog.focus();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const current = document.activeElement;
      const outside = !(current instanceof Node) || !dialog.contains(current);

      if (e.shiftKey && (current === first || current === dialog || outside)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (current === last || outside)) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      // Primer el fons torna a ser accessible; si no, el focus no podria tornar al botó (seria inert).
      unlockBackground(locked);
      if (opener && opener.isConnected && !dialog.contains(opener)) opener.focus();
    };
  }, [isOpen, dialogRef]);
};
