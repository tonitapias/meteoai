// src/components/TypewriterText.tsx
import { useState, useEffect } from 'react';

interface TypewriterProps {
  text: string;
  className?: string;
}

// L'animació d'escriure dura com a màxim ~1 s, sigui quin sigui el text. Abans anava a 30 ms per lletra: un resum de
// 230 caràcters trigava ~8 s a sortir sencer, cada vegada, també quan la resposta ja era a la memòria cau (auditoria
// d'UX del 16/11/2026, M2). Amb "reduir el moviment" activat al sistema, el text surt de cop.
const TICK_MS = 30;
const MAX_DURATION_MS = 1000;

const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export const TypewriterText = ({ text, className }: TypewriterProps) => {
  const [displayedText, setDisplayedText] = useState('');

  useEffect(() => {
    if (!text) {
      // Buidem el text de forma asíncrona per complir l'estàndard
      const resetTimer = setTimeout(() => setDisplayedText(''), 0);
      return () => clearTimeout(resetTimer);
    }

    if (prefersReducedMotion()) {
      const showTimer = setTimeout(() => setDisplayedText(text), 0);
      return () => clearTimeout(showTimer);
    }

    // Lletres per pas perquè tot el text surti en MAX_DURATION_MS (com a mínim una per pas).
    const step = Math.max(1, Math.ceil(text.length / (MAX_DURATION_MS / TICK_MS)));
    let shown = 0;

    const typeTimer = setInterval(() => {
      shown = Math.min(text.length, shown + step);
      setDisplayedText(text.slice(0, shown));
      if (shown >= text.length) clearInterval(typeTimer);
    }, TICK_MS);

    return () => clearInterval(typeTimer);
  }, [text]);

  return (
    <p className={className || "text-slate-200 font-medium leading-relaxed text-sm md:text-base min-h-[3em] whitespace-pre-wrap break-words"}>
        {displayedText}
    </p>
  );
};
