import React from 'react';
import { MapPin, Sparkles, Globe, CloudSun, Command } from 'lucide-react';
import { Language } from '../constants/translations';

interface WelcomeScreenProps {
  lang: Language;
  setLang: (lang: Language) => void;
  t: any;
  onLocate: () => void;
}

export default function WelcomeScreen({ lang, setLang, t, onLocate }: WelcomeScreenProps) {
  return (
    <div className="relative w-full flex flex-col items-center justify-center text-center gap-8 md:gap-12 animate-in fade-in zoom-in duration-700">
      
      {/* BACKGROUND FX */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-indigo-500/20 rounded-full blur-[120px] pointer-events-none z-0 mix-blend-screen animate-pulse"></div>
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] bg-blue-400/10 rounded-full blur-[80px] pointer-events-none z-0 mix-blend-screen ml-20 -mt-20"></div>

      {/* MAIN CARD */}
      <div className="relative z-10 bento-card p-10 md:p-16 max-w-2xl w-full flex flex-col items-center border-white/10 shadow-2xl bg-white/5 backdrop-blur-2xl">
        <div className="relative mb-6">
            <div className="absolute inset-0 bg-amber-400 blur-2xl opacity-20 animate-pulse"></div>
            <CloudSun className="w-24 h-24 text-white relative z-10 drop-shadow-[0_0_15px_rgba(255,255,255,0.5)]" strokeWidth={1.5} />
        </div>

        <h1 className="text-5xl md:text-7xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-br from-white via-indigo-100 to-indigo-400 mb-4 drop-shadow-lg">
          Meteo Toni AI
        </h1>
        
        <p className="text-lg md:text-xl text-indigo-200/80 font-medium max-w-lg leading-relaxed mb-8">
          {lang === 'ca' ? "La previsió meteorològica més avançada amb intel·ligència artificial." :
           lang === 'en' ? "The most advanced weather forecast powered by Artificial Intelligence." :
           lang === 'es' ? "La previsión meteorológica más avanzada con inteligencia artificial." :
           "Prévisions météo avancées alimentées par l'Intelligence Artificielle."}
        </p>

        <button 
            onClick={onLocate}
            className="group relative w-full max-w-sm flex items-center justify-center gap-3 px-8 py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-bold transition-all duration-300 shadow-[0_0_40px_-10px_rgba(79,70,229,0.5)] hover:shadow-[0_0_60px_-10px_rgba(79,70,229,0.7)] hover:scale-[1.02] active:scale-95 overflow-hidden"
        >
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700 skew-x-12"></div>
            <MapPin className="w-5 h-5 animate-bounce" />
            <span className="tracking-wide">{t.useCurrentLocation}</span>
        </button>

        <div className="mt-6 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-500 bg-slate-900/50 px-3 py-1.5 rounded-full border border-white/5">
            <Command className="w-3 h-3" />
            <span>{t.searchPlaceholder || "O utilitza el cercador superior"}</span>
        </div>
      </div>

      {/* LANGUAGE SELECTOR */}
      <div className="flex items-center gap-3 p-1.5 bg-slate-900/40 backdrop-blur-md rounded-full border border-white/10 z-10">
        <Globe className="w-4 h-4 text-slate-400 ml-2" />
        <div className="h-4 w-px bg-white/10"></div>
        {(['ca', 'es', 'en', 'fr'] as Language[]).map((l) => (
            <button key={l} onClick={() => setLang(l)} className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all duration-300 uppercase tracking-wider ${lang === l ? 'bg-white text-indigo-950 shadow-lg scale-105' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}>
                {l}
            </button>
        ))}
      </div>
    </div>
  );
}