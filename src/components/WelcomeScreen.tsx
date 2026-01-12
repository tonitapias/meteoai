// src/components/WelcomeScreen.tsx
import React from 'react';
import { CloudSun, Search, MapPin, Globe, Sparkles, Navigation } from 'lucide-react';
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
      { id: 'ca', label: 'CA' },
      { id: 'es', label: 'ES' },
      { id: 'en', label: 'EN' },
      { id: 'fr', label: 'FR' },
  ];

  const handleSearchClick = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setTimeout(() => {
        const input = document.querySelector('input[type="text"]');
        if (input instanceof HTMLInputElement) input.focus();
    }, 600);
  };

  return (
    // CANVI: padding reduït en mòbil (py-6) i alçada mínima flexible
    <div className="relative w-full flex flex-col items-center justify-center py-6 md:py-10 min-h-[50vh] md:min-h-[65vh] overflow-hidden">
        
        {/* 1. ATMOSPHERE BACKGROUND (Responsive) */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
             {/* CANVI: Mida del cercle reduïda en mòbil (w-64) per no desbordar */}
             <div className="w-64 h-64 md:w-[500px] md:h-[500px] bg-gradient-to-tr from-indigo-600/20 to-purple-500/20 rounded-full blur-[60px] md:blur-[100px] animate-pulse opacity-60"></div>
        </div>

        {/* 2. CONTINGUT PRINCIPAL */}
        <div className="relative z-10 w-full max-w-lg px-4 flex flex-col gap-6 md:gap-8 animate-in fade-in slide-in-from-bottom-8 duration-700">
            
            {/* HEADER: Identitat de Marca */}
            <div className="text-center space-y-3 md:space-y-4">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 backdrop-blur-md shadow-sm mb-1">
                    <Sparkles className="w-3 h-3 text-amber-300" />
                    <span className="text-[10px] font-bold tracking-widest text-slate-300 uppercase">v2.5 Pro AI</span>
                </div>
                
                {/* CANVI: Text més petit en mòbil (4xl) per evitar salts de línia lletjos */}
                <h1 className="text-4xl sm:text-5xl md:text-7xl font-bold tracking-tighter text-transparent bg-clip-text bg-gradient-to-b from-white to-slate-400 drop-shadow-sm leading-tight">
                    Meteo Toni
                </h1>
                
                <p className="text-sm md:text-base text-slate-400 font-medium leading-relaxed max-w-xs mx-auto">
                    {t.aiAnalysisDescription}
                </p>
            </div>

            {/* ACTION GRID (Disseny Bento) */}
            <div className="grid grid-cols-1 gap-3 md:gap-4 w-full">
                
                {/* TARGETA 1: GPS (Hero Action) */}
                <button 
                    onClick={onLocate}
                    className="group relative w-full h-20 md:h-24 overflow-hidden rounded-2xl md:rounded-3xl bg-gradient-to-r from-indigo-600 to-blue-600 shadow-xl shadow-indigo-900/30 transition-all duration-300 hover:shadow-indigo-600/40 hover:scale-[1.02] active:scale-95 touch-manipulation"
                >
                    {/* Efectes de fons */}
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                        <Navigation className="w-16 h-16 md:w-24 md:h-24 transform rotate-12 -translate-y-4 translate-x-4" />
                    </div>
                    
                    <div className="relative h-full flex items-center justify-between px-5 md:px-6">
                        <div className="flex flex-col items-start text-left">
                            <span className="text-[9px] md:text-[10px] font-bold text-indigo-200 uppercase tracking-wider mb-0.5">Recomanat</span>
                            <span className="text-lg md:text-2xl font-bold text-white">{t.useLocation}</span>
                            <span className="text-[10px] md:text-xs text-indigo-100/80 mt-0.5 flex items-center gap-1">
                                <MapPin className="w-3 h-3" /> {t.autoGPS}
                            </span>
                        </div>
                        <div className="w-8 h-8 md:w-10 md:h-10 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm group-hover:bg-white/30 transition-colors">
                            <Navigation className="w-4 h-4 md:w-5 md:h-5 text-white transform group-hover:rotate-45 transition-transform duration-300" fill="currentColor" />
                        </div>
                    </div>
                </button>

                {/* TARGETA 2: CERCA (Glass Action) */}
                <button 
                    onClick={handleSearchClick}
                    className="group relative w-full h-16 md:h-20 overflow-hidden rounded-2xl md:rounded-3xl bg-slate-800/40 border border-white/5 hover:bg-slate-800/60 transition-all duration-300 backdrop-blur-md active:scale-95 touch-manipulation"
                >
                    <div className="relative h-full flex items-center justify-between px-5 md:px-6">
                        <div className="flex items-center gap-3 md:gap-4">
                            <div className="w-8 h-8 md:w-10 md:h-10 rounded-xl md:rounded-2xl bg-gradient-to-br from-slate-700 to-slate-800 flex items-center justify-center shadow-inner border border-white/5">
                                <Search className="w-4 h-4 md:w-5 md:h-5 text-slate-300 group-hover:text-white transition-colors" />
                            </div>
                            <div className="flex flex-col items-start text-left">
                                <span className="text-base md:text-lg font-bold text-slate-200 group-hover:text-white transition-colors">{t.searchCity}</span>
                                <span className="text-[10px] md:text-xs text-slate-500 group-hover:text-slate-400">{t.manualSearch}</span>
                            </div>
                        </div>
                    </div>
                </button>
            </div>

            {/* FOOTER: Idiomes (Minimalista i segur per a dits) */}
            <div className="flex flex-col items-center gap-2 md:gap-3 pt-2 md:pt-4 pb-4">
                <span className="text-[9px] md:text-[10px] font-bold uppercase tracking-widest text-slate-600 flex items-center gap-2">
                    <Globe className="w-3 h-3" /> {t.selectLanguage}
                </span>
                <div className="flex items-center gap-1.5 md:gap-2 p-1 md:p-1.5 rounded-full bg-slate-900/40 border border-white/5 backdrop-blur-xl">
                    {langs.map((l) => (
                        <button
                            key={l.id}
                            onClick={() => setLang(l.id)}
                            className={`relative px-3 py-1.5 md:px-4 rounded-full text-[10px] md:text-xs font-bold transition-all duration-300 touch-manipulation ${
                                lang === l.id 
                                ? 'bg-slate-700 text-white shadow-lg' 
                                : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'
                            }`}
                        >
                            {l.label}
                        </button>
                    ))}
                </div>
            </div>

        </div>
    </div>
  );
}