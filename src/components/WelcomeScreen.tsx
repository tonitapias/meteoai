// src/components/WelcomeScreen.tsx
import React from 'react';
import { CloudSun, Search, MapPin, Globe } from 'lucide-react';
import { Language } from '../constants/translations';
import { FlagIcon } from './WeatherUI';

interface WelcomeScreenProps {
  lang: Language;
  setLang: (l: Language) => void;
  t: any;
  onLocate: () => void;
}

export default function WelcomeScreen({ lang, setLang, t, onLocate }: WelcomeScreenProps) {
  
  const langs: { id: Language; label: string }[] = [
      { id: 'ca', label: 'Català' },
      { id: 'es', label: 'Español' },
      { id: 'en', label: 'English' },
      { id: 'fr', label: 'Français' },
  ];

  const handleSearchClick = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setTimeout(() => {
        const input = document.querySelector('input[type="text"]');
        if (input instanceof HTMLInputElement) {
            input.focus();
        }
    }, 600);
  };

  return (
    // CONTENIDOR PRINCIPAL: Ara s'adapta a l'alçada disponible i té padding segur
    <div className="relative w-full flex flex-col items-center justify-center py-6 md:py-12 min-h-[50vh] md:min-h-[60vh]">
        
        {/* 1. FONS AMBIENTAL (RESPONSIVE) */}
        {/* Canviem mides fixes per classes reactives (w-48 mòbil -> w-[600px] PC) */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-hidden">
             <div className="w-48 h-48 md:w-[600px] md:h-[600px] bg-indigo-500/10 rounded-full blur-[60px] md:blur-[120px] animate-pulse"></div>
             <div className="absolute w-32 h-32 md:w-[300px] md:h-[300px] bg-blue-500/10 rounded-full blur-[40px] md:blur-[80px] translate-y-10 md:translate-y-20"></div>
        </div>

        {/* 2. CONTINGUT CENTRAL */}
        <div className="relative z-10 flex flex-col items-center text-center space-y-6 md:space-y-10 animate-in fade-in zoom-in duration-700 w-full max-w-4xl px-4">
            
            {/* ICONA FLOTANT (Mida reduïda en mòbil) */}
            <div className="relative group cursor-default mt-4 md:mt-0">
                <div className="absolute inset-0 bg-indigo-500/30 blur-2xl rounded-full opacity-20 group-hover:opacity-40 transition-opacity duration-700"></div>
                {/* w-24 (mòbil) vs w-40 (PC) */}
                <CloudSun className="w-24 h-24 md:w-40 md:h-40 text-white drop-shadow-2xl transform group-hover:scale-110 group-hover:-rotate-6 transition-all duration-700 ease-out" strokeWidth={1} />
            </div>

            {/* TYPOGRAPHY HERO (Textos escalables) */}
            <div className="space-y-2 md:space-y-4 max-w-2xl">
                {/* text-4xl (mòbil) vs text-7xl (PC) */}
                <h1 className="text-4xl sm:text-5xl md:text-7xl font-bold tracking-tighter text-transparent bg-clip-text bg-gradient-to-br from-white via-white to-slate-500 leading-tight pb-1">
                    Meteo Toni AI
                </h1>
                <p className="text-sm sm:text-base md:text-xl text-slate-400 font-light leading-relaxed px-2 md:px-4">
                    {t.aiAnalysisDescription}
                </p>
            </div>

            {/* ACCIONS PRINCIPALS (GRID RESPONSIVE) */}
            {/* En mòbil ocupa el 100% de l'ample, en PC màxim lg */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4 w-full max-w-md px-2 md:px-0">
                
                {/* BOTÓ GPS */}
                <button 
                    onClick={onLocate}
                    className="group relative overflow-hidden rounded-xl md:rounded-2xl bg-indigo-600 hover:bg-indigo-500 active:scale-95 transition-all duration-300 shadow-lg shadow-indigo-900/20 text-left w-full touch-manipulation"
                >
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000"></div>
                    <div className="p-4 md:p-5 flex items-center gap-3 md:gap-4 justify-center sm:justify-start">
                        <MapPin className="w-6 h-6 md:w-8 md:h-8 text-white/90 shrink-0" strokeWidth={1.5} />
                        <div className="text-left">
                            <h3 className="text-white font-bold text-base md:text-lg leading-tight">{t.useLocation}</h3>
                            <p className="text-indigo-200 text-[10px] md:text-xs mt-0.5">{t.autoGPS}</p>
                        </div>
                    </div>
                </button>

                {/* BOTÓ CERCA */}
                <button 
                    onClick={handleSearchClick}
                    className="group rounded-xl md:rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 active:scale-95 transition-all duration-300 backdrop-blur-sm text-left w-full touch-manipulation"
                >
                    <div className="p-4 md:p-5 flex items-center gap-3 md:gap-4 justify-center sm:justify-start">
                        <Search className="w-6 h-6 md:w-8 md:h-8 text-slate-300 group-hover:text-white transition-colors shrink-0" strokeWidth={1.5} />
                        <div className="text-left">
                            <h3 className="text-slate-200 font-bold text-base md:text-lg group-hover:text-white transition-colors leading-tight">{t.searchCity}</h3>
                            <p className="text-slate-500 text-[10px] md:text-xs mt-0.5 group-hover:text-slate-400">{t.manualSearch}</p>
                        </div>
                    </div>
                </button>
            </div>

            {/* SELECTOR IDIOMA */}
            <div className="pt-4 md:pt-8 pb-4">
                <div className="flex items-center justify-center gap-2 mb-3 md:mb-4 text-[9px] md:text-[10px] font-bold uppercase tracking-[0.2em] text-slate-600">
                    <Globe className="w-3 h-3" /> {t.selectLanguage}
                </div>
                <div className="flex flex-wrap justify-center gap-2">
                    {langs.map((l) => (
                        <button
                            key={l.id}
                            onClick={() => setLang(l.id)}
                            className={`group relative px-3 py-1.5 md:px-4 md:py-2 rounded-full border transition-all duration-300 overflow-hidden touch-manipulation ${
                                lang === l.id 
                                ? 'bg-white/10 border-white/20 text-white' 
                                : 'bg-transparent border-transparent text-slate-500 hover:text-slate-300 hover:bg-white/5'
                            }`}
                        >
                            <span className="relative z-10 flex items-center gap-1.5 md:gap-2 text-[10px] md:text-xs font-medium">
                                <FlagIcon lang={l.id} className={`w-3 h-3 md:w-3.5 md:h-3.5 rounded-sm transition-opacity ${lang === l.id ? 'opacity-100' : 'opacity-50 group-hover:opacity-100'}`} />
                                {l.label}
                            </span>
                        </button>
                    ))}
                </div>
            </div>

        </div>
    </div>
  );
}