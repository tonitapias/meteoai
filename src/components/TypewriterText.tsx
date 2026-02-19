// src/components/TypewriterText.tsx
import { useState, useEffect } from 'react';

interface TypewriterProps {
  text: string;
  className?: string;
}

export const TypewriterText = ({ text, className }: TypewriterProps) => {
  const [displayedText, setDisplayedText] = useState('');
  
  useEffect(() => {
    setDisplayedText(''); 
    if (!text) return;
    
    let i = 0;
    // Si el text és molt llarg, accelerem l'efecte per no avorrir l'usuari
    const speed = text.length > 200 ? 5 : 15;
    
    const timer = setInterval(() => {
      if (i < text.length) {
        setDisplayedText(text.slice(0, i + 1));
        i++;
      } else { 
        clearInterval(timer); 
      }
    }, speed); 
    
    return () => clearInterval(timer);
  }, [text]);
  
  return (
    <p className={className || "text-slate-200 font-medium leading-relaxed text-sm md:text-base min-h-[3em] whitespace-pre-wrap break-words"}>
        {displayedText}
    </p>
  );
};