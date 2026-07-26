// src/components/TypewriterText.tsx
import { useState, useEffect } from 'react';

interface TypewriterProps {
  text: string;
  className?: string;
}

export const TypewriterText = ({ text, className }: TypewriterProps) => {
  const [displayedText, setDisplayedText] = useState('');
  
  useEffect(() => {
    if (!text) {
      // Buidem el text de forma asíncrona per complir l'estàndard
      const resetTimer = setTimeout(() => setDisplayedText(''), 0);
      return () => clearTimeout(resetTimer);
    }
    
    let i = 0;
    let currentStr = ''; // Utilitzem una variable local pel text
    
    const typeTimer = setInterval(() => {
      currentStr += text.charAt(i);
      setDisplayedText(currentStr);
      i++;
      if (i >= text.length) clearInterval(typeTimer);
    }, 30); // Mantén aquí la velocitat (ex: 30) que tinguessis al teu fitxer original

    return () => clearInterval(typeTimer);
  }, [text]);
  
  return (
    <p className={className || "text-slate-200 font-medium leading-relaxed text-sm md:text-base min-h-[3em] whitespace-pre-wrap break-words"}>
        {displayedText}
    </p>
  );
};