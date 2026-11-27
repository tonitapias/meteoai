// src/hooks/welcome/useFontReady.ts
// Si una lletra web ja és a punt. Demanar-la amb document.fonts.load també n'avança la baixada, sense esperar que el
// navegador la descobreixi en pintar. Sense l'API (navegadors molt antics, jsdom), mai no és a punt.
import { useEffect, useState } from 'react';

export function useFontReady(font: string, sample: string): boolean {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const fonts = typeof document !== 'undefined' ? document.fonts : undefined;
    if (!fonts || typeof fonts.load !== 'function') return;
    let alive = true;
    fonts.load(font, sample).then(
      (faces) => { if (alive && faces.length > 0) setReady(true); },
      () => { /* sense la lletra: es queda la de reserva */ },
    );
    return () => { alive = false; };
  }, [font, sample]);
  return ready;
}
