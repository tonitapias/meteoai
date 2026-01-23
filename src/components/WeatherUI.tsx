// src/components/WeatherUI.tsx
import React, { useState, useEffect } from 'react';
import { Language } from '../translations';

export const TypewriterText = ({ text, className }: { text: string; className?: string }) => {
  const [displayedText, setDisplayedText] = useState('');
  
  useEffect(() => {
    setDisplayedText(''); 
    if (!text) return;
    let i = 0;
    const speed = text.length > 200 ? 5 : 15;
    const timer = setInterval(() => {
      if (i < text.length) {
        setDisplayedText(text.slice(0, i + 1));
        i++;
      } else { clearInterval(timer); }
    }, speed); 
    return () => clearInterval(timer);
  }, [text]);
  
  return (
    <p className={className || "text-slate-200 font-medium leading-relaxed text-sm md:text-base min-h-[3em] whitespace-pre-wrap break-words"}>
        {displayedText}
    </p>
  );
};

export const FlagIcon = ({ lang, className = "w-5 h-5 rounded-sm object-cover" }: { lang: Language, className?: string }) => {
  if (lang === 'ca') { return <svg viewBox="0 0 640 480" className={className}><path fill="#FFED00" d="M0 0h640v480H0z"/><path fill="#D50032" d="M0 48h640v48H0zM0 144h640v48H0zM0 240h640v48H0zM0 336h640v48H0z"/></svg>; }
  if (lang === 'es') { return <svg viewBox="0 0 640 480" className={className}><path fill="#AA151B" d="M0 0h640v480H0z"/><path fill="#F1BF00" d="M0 120h640v240H0z"/></svg>; }
  if (lang === 'fr') { return <svg viewBox="0 0 640 480" className={className}><path fill="#fff" d="M0 0h640v480H0z"/><path fill="#002395" d="M0 0h213.3v480H0z"/><path fill="#ED2939" d="M426.7 0H640v480H426.7z"/></svg>; }
  if (lang === 'en') { return <svg viewBox="0 0 640 480" className={className}><path fill="#012169" d="M0 0h640v480H0z"/><path fill="#FFF" d="M75 0l244 181L562 0h78v62L400 241l240 178v61h-80L320 301 81 480H0v-60l239-178L0 64V0h75z"/><path fill="#C8102E" d="M424 294l216 163v23H506L312 336 118 480H0v-23l214-163L0 129V106h6l206 153L418 106h8l214 160v28H506L424 294z"/><path fill="#FFF" d="M250 0h140v480H250zM0 170h640v140H0z"/><path fill="#C8102E" d="M280 0h80v480h-80zM0 200h640v80H0z"/></svg>; }
  return null;
};