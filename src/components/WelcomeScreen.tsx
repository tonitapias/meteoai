// src/components/WelcomeScreen.tsx
import React from 'react';
import { CloudSun, Search, MapPin, Globe } from 'lucide-react';
import { Language } from '../constants/translations';
import { FlagIcon } from './WeatherUI';

interface WelcomeScreenProps {
  lang: Language;
  setLang: (l: Language) => void;
  t: any;
  onLocate: () => void; // <--- NOVA PROPIETAT (Funció del GPS)
}

export default function WelcomeScreen({ lang, setLang, t, onLocate }: WelcomeScreenProps) {
  
  const langs: { id: Language; label: string }[] = [
      { id: 'ca', label: 'Català' },
      { id: 'es', label: 'Español' },
      { id: 'en', label: 'English' },
      { id: 'fr', label: 'Français' },
  ];

  // Funció per enfocar la barra de cerca del Header
  const handleSearchClick = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    // Esperem una mica que pugi l'scroll i enfoquem l'input
    setTimeout(() => {
        const input = document.querySelector('input[type="text"]');
        if (input instanceof HTMLInputElement) {
            input.focus();
        }
    }, 600);
  };

  return (
    <div className="relative w-full flex flex-col items-center justify-center min-h-[60vh]">
        
        {/* FONS AMBIENTAL */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
             <div className="w-[600px] h-[600px] bg-indigo-500/10 rounded-full blur-[120px] animate-pulse"></div>
             <div className="absolute w-[300px] h-[300px] bg-blue-500/10 rounded-full blur-[80px] translate-y-20"></div>
        </div>

        {/* CONTINGUT CENTRAL */}
        <div className="relative z-10 flex flex-col items-center text-center space-y-10 animate-in fade-in zoom-in duration-700">
            
            {/* ICONA FLOTANT */}
            <div className="relative group cursor-default">
                <div className="absolute inset-0 bg-indigo-500/30 blur-2xl rounded-full opacity-20 group-hover:opacity-40 transition-opacity duration-700"></div>
                <CloudSun className="w-32 h-32 md:w-40 md:h-40 text-white drop-shadow-2xl transform group-hover:scale-110 group-hover:-rotate-6 transition-all duration-700 ease-out" strokeWidth={1} />
            </div>

            {/* TYPOGRAPHY HERO */}
            <div className="space-y-2 max-w-2xl">
                <h1 className="text-5xl md:text-7xl font-bold tracking-tighter text-transparent bg-clip-text bg-gradient-to-br from-white via-white to-slate-500">
                    Meteo Toni AI
                </h1>
                <p className="text-lg md:text-xl text-slate-400 font-light leading-relaxed px-4">
                    {t.aiAnalysisDescription}
                </p>
            </div>

            {/* ACCIONS PRINCIPALS (ARA ACTIVES) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full max-w-lg px-4">
                
                {/* BOTÓ GPS (ACTIU) */}
                <button 
                    onClick={onLocate}
                    className="group relative overflow-hidden rounded-2xl bg-indigo-600 hover:bg-indigo-500 active:scale-95 transition-all duration-300 shadow-lg shadow-indigo-900/20 text-left w-full"
                >
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000"></div>
                    <div className="p-5 flex flex-col items-center gap-3">
                        <MapPin className="w-8 h-8 text-white/90" strokeWidth={1.5} />
                        <div className="text-center">
                            <h3 className="text-white font-bold text-lg">{t.useLocation}</h3>
                            <p className="text-indigo-200 text-xs mt-1">{t.autoGPS}</p>
                        </div>
                    </div>
                </button>

                {/* BOTÓ CERCA (ACTIU - FOCALITZA EL HEADER) */}
                <button 
                    onClick={handleSearchClick}
                    className="group rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 active:scale-95 transition-all duration-300 backdrop-blur-sm text-left w-full"
                >
                    <div className="p-5 flex flex-col items-center gap-3">
                        <Search className="w-8 h-8 text-slate-300 group-hover:text-white transition-colors" strokeWidth={1.5} />
                        <div className="text-center">
                            <h3 className="text-slate-200 font-bold text-lg group-hover:text-white transition-colors">{t.searchCity}</h3>
                            <p className="text-slate-500 text-xs mt-1 group-hover:text-slate-400">{t.manualSearch}</p>
                        </div>
                    </div>
                </button>
            </div>

            {/* SELECTOR IDIOMA */}
            <div className="pt-8">
                <div className="flex items-center justify-center gap-2 mb-4 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-600">
                    <Globe className="w-3 h-3" /> {t.selectLanguage}
                </div>
                <div className="flex flex-wrap justify-center gap-2">
                    {langs.map((l) => (
                        <button
                            key={l.id}
                            onClick={() => setLang(l.id)}
                            className={`group relative px-4 py-2 rounded-full border transition-all duration-300 overflow-hidden ${
                                lang === l.id 
                                ? 'bg-white/10 border-white/20 text-white' 
                                : 'bg-transparent border-transparent text-slate-500 hover:text-slate-300 hover:bg-white/5'
                            }`}
                        >
                            <span className="relative z-10 flex items-center gap-2 text-xs font-medium">
                                <FlagIcon lang={l.id} className={`w-3.5 h-3.5 rounded-sm transition-opacity ${lang === l.id ? 'opacity-100' : 'opacity-50 group-hover:opacity-100'}`} />
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