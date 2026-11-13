// src/components/tabs/useTextFieldFocus.ts
// Si el focus és en un camp de text (el cercador de la capçalera). Al mòbil, mentre s'hi escriu, el teclat puja i una
// barra fixa a baix pujaria amb ell i taparia els resultats de la cerca: la barra de pestanyes s'amaga fins que el
// camp perd el focus (en triar un lloc, o en tancar el teclat i tocar fora).
import { useEffect, useState } from 'react';

const TEXT_INPUT_TYPES = new Set(['text', 'search', 'email', 'url', 'tel', 'password', 'number']);

export const isTextField = (target: EventTarget | null): boolean => {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable || target instanceof HTMLTextAreaElement) return true;
  return target instanceof HTMLInputElement && TEXT_INPUT_TYPES.has(target.type);
};

export function useTextFieldFocus(enabled: boolean): boolean {
  const [focused, setFocused] = useState(() => typeof document !== 'undefined' && isTextField(document.activeElement));

  useEffect(() => {
    if (!enabled) return;
    const onFocusIn = (event: FocusEvent) => setFocused(isTextField(event.target));
    // Si el focus passa a un altre camp de text, la barra segueix amagada.
    const onFocusOut = (event: FocusEvent) => setFocused(isTextField(event.relatedTarget));
    document.addEventListener('focusin', onFocusIn);
    document.addEventListener('focusout', onFocusOut);
    return () => {
      document.removeEventListener('focusin', onFocusIn);
      document.removeEventListener('focusout', onFocusOut);
    };
  }, [enabled]);

  return enabled && focused;
}
