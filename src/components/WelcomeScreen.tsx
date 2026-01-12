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
    // CANVI PRINCIPAL: w-full i overflow-hidden per evitar desbordaments.
    // Eliminem alçades mínimes forçades que causen scroll en mòbils petits.
    <div className="relative w-full max-w-5xl mx-auto flex flex-col items-center justify-center py-4 md:py-12 overflow-hidden rounded-3xl">
        
        {/* 1. FONS AMBIENTAL (Més subtil i contingut) */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
             <div className="w-40 h-40 md:w-[500px] md:h-[500px] bg-indigo-500/10 rounded-full blur-[50px] md:blur-[100px] animate-pulse"></div>
             <div className="absolute w-24 h-24 md:w-[300px] md:h-[300px] bg-blue-500/10 rounded-full blur-[30px] md:blur-[80px] translate-y-8 md:translate-y-20"></div>
        </div>

        {/* 2. CONTINGUT CENTRAL */}
        <div className="relative z-10 flex flex-col items-center text-center w-full px-4 animate-in fade-in zoom-in duration-700">
            
            {/* ICONA (Més petita en mòbil per guanyar espai vertical) */}
            <div className="relative group cursor-default mb-4 md:mb-8">
                <div className="absolute inset-0 bg-indigo-500/20 blur-xl rounded-full opacity-0 group-hover:opacity-40 transition-opacity duration-700"></div>
                <CloudSun className="w-20 h-20 sm:w-24 sm:h-24 md:w-40 md:h-40 text-white drop-shadow-xl transform group-hover:scale-110 group-hover:-rotate-6 transition-all duration-700 ease-out" strokeWidth={1} />
            </div>

            {/* TEXTOS (Ajustats per no ocupar tota la pantalla) */}
            <div className="space-y-2 md:space-y-4 max-w-2xl mb-6 md:mb-10">
                <h1 className="text-3xl sm:text-5xl md:text-7xl font-bold tracking-tighter text-transparent bg-clip-text bg-gradient-to-br from-white via-white to-slate-400 leading-tight">
                    Meteo Toni AI
                </h1>
                <p className="text-xs sm:text-base md:text-xl text-slate-400 font-light leading-relaxed max-w-xs sm:max-w-none mx-auto">
                    {t.aiAnalysisDescription}
                </p>
            </div>

            {/* BOTONS D'ACCIÓ (Grid compacte) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-md mb-6 md:mb-10">
                
                {/* BOTÓ GPS */}
                <button 
                    onClick={onLocate}
                    className="group relative overflow-hidden rounded-xl bg-indigo-600 hover:bg-indigo-500 active:scale-[0.98] transition-all duration-300 shadow-lg shadow-indigo-900/20 text-left w-full touch-manipulation"
                >
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000"></div>
                    <div className="p-3 md:p-5 flex items-center gap-3 md:gap-4 justify-center sm:justify-start">
                        <MapPin className="w-5 h-5 md:w-8 md:h-8 text-white/90 shrink-0" strokeWidth={1.5} />
                        <div className="text-left">
                            <h3 className="text-white font-bold text-sm md:text-lg">{t.useLocation}</h3>
                            <p className="text-indigo-200 text-[10px] md:text-xs leading-none mt-0.5 opacity-80">{t.autoGPS}</p>
                        </div>
                    </div>
                </button>

                {/* BOTÓ CERCA */}
                <button 
                    onClick={handleSearchClick}
                    className="group rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 active:scale-[0.98] transition-all duration-300 backdrop-blur-sm text-left w-full touch-manipulation"
                >
                    <div className="p-3 md:p-5 flex items-center gap-3 md:gap-4 justify-center sm:justify-start">
                        <Search className="w-5 h-5 md:w-8 md:h-8 text-slate-300 group-hover:text-white transition-colors shrink-0" strokeWidth={1.5} />
                        <div className="text-left">
                            <h3 className="text-slate-200 font-bold text-sm md:text-lg group-hover:text-white transition-colors">{t.searchCity}</h3>
                            <p className="text-slate-500 text-[10px] md:text-xs leading-none mt-0.5 group-hover:text-slate-400">{t.manualSearch}</p>
                        </div>
                    </div>
                </button>
            </div>

            {/* SELECTOR IDIOMA (Minimalista i petit) */}
            <div>
                <div className="flex items-center justify-center gap-1.5 mb-2 text-[9px] font-bold uppercase tracking-[0.2em] text-slate-600">
                    <Globe className="w-2.5 h-2.5" /> {t.selectLanguage}
                </div>
                <div className="flex flex-wrap justify-center gap-1.5 md:gap-2">
                    {langs.map((l) => (
                        <button
                            key={l.id}
                            onClick={() => setLang(l.id)}
                            className={`group relative px-2.5 py-1 md:px-4 md:py-2 rounded-full border transition-all duration-300 overflow-hidden touch-manipulation ${
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