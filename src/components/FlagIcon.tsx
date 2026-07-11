import { Language } from '../translations';
import React from 'react';

interface FlagIconProps {
  lang: Language;
  className?: string;
}

// DOCTRINA RISC ZERO: Diccionari de vectors pur. Evita la repetició massiva d'etiquetes SVG.
const FLAG_PATHS: Record<string, React.ReactNode> = {
  ca: (
    <>
      <path fill="#FFED00" d="M0 0h640v480H0z"/>
      <path fill="#D50032" d="M0 48h640v48H0zM0 144h640v48H0zM0 240h640v48H0zM0 336h640v48H0z"/>
    </>
  ),
  es: (
    <>
      <path fill="#AA151B" d="M0 0h640v480H0z"/>
      <path fill="#F1BF00" d="M0 120h640v240H0z"/>
    </>
  ),
  fr: (
    <>
      <path fill="#fff" d="M0 0h640v480H0z"/>
      <path fill="#002395" d="M0 0h213.3v480H0z"/>
      <path fill="#ED2939" d="M426.7 0H640v480H426.7z"/>
    </>
  ),
  en: (
    <>
      <path fill="#012169" d="M0 0h640v480H0z"/>
      <path fill="#FFF" d="M75 0l244 181L562 0h78v62L400 241l240 178v61h-80L320 301 81 480H0v-60l239-178L0 64V0h75z"/>
      <path fill="#C8102E" d="M424 294l216 163v23H506L312 336 118 480H0v-23l214-163L0 129V106h6l206 153L418 106h8l214 160v28H506L424 294z"/>
      <path fill="#FFF" d="M250 0h140v480H250zM0 170h640v140H0z"/>
      <path fill="#C8102E" d="M280 0h80v480h-80zM0 200h640v80H0z"/>
    </>
  )
};

export const FlagIcon = ({ lang, className = "w-5 h-5 rounded-sm object-cover" }: FlagIconProps) => {
  const labels: Record<string, string> = {
    ca: "Català",
    es: "Español",
    fr: "Français",
    en: "English"
  };

  const label = labels[lang] || lang;
  const paths = FLAG_PATHS[lang];

  // SPATIAL UI: Volumetria i acceleració GPU
  const spatialClassName = `${className} drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)] transform-gpu`;

  // FALLBACK RISC ZERO: Si l'idioma no existeix, retornem un contenidor físic en lloc de null per evitar col·lapses de graella.
  if (!paths) {
      return (
         <div 
            className={`${spatialClassName} bg-slate-900 flex items-center justify-center border border-white/10`} 
            role="img" 
            aria-label="Idioma desconegut"
         >
             <span className="text-[8px] text-slate-500 font-black uppercase tracking-widest">{lang}</span>
         </div>
      );
  }

  return (
    <svg 
        role="img"
        aria-label={label}
        viewBox="0 0 640 480"
        className={spatialClassName}
    >
      <title>{label}</title>
      {paths}
    </svg>
  );
};