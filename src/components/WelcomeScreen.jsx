import React from 'react';
import { CloudSun } from 'lucide-react';
import { FlagIcon } from './WeatherUI';

export default function WelcomeScreen({ lang, setLang, t }) {
  return (
    <div className="text-center py-20 md:py-32 animate-in fade-in slide-in-from-bottom-4 px-4">
        <div className="inline-flex p-6 rounded-full bg-indigo-500/10 mb-6 shadow-[0_0_30px_rgba(99,102,241,0.2)]">
            <CloudSun className="w-16 h-16 text-indigo-400 animate-pulse" strokeWidth={1.5} />
        </div>
        <h2 className="text-3xl font-bold text-white mb-3">Meteo Toni AI</h2>
        <p className="text-slate-400 max-w-md mx-auto">{t.subtitle}</p>
        <div className="flex flex-wrap gap-3 justify-center mt-8 px-2">
            {['ca', 'es', 'en', 'fr'].map(l => (
                <button key={l} onClick={() => setLang(l)} className={`px-3 py-2 md:px-4 md:py-2 text-sm md:text-base rounded-full border flex items-center gap-2 transition-all ${lang === l ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg scale-105' : 'border-slate-700 text-slate-400 hover:text-white hover:bg-slate-800'}`}>
                    <FlagIcon lang={l} className="w-4 h-3 md:w-5 md:h-4 rounded shadow-sm" /> {l === 'ca' ? 'Català' : l === 'es' ? 'Español' : l === 'fr' ? 'Français' : 'English'}
                </button>
            ))}
        </div>
    </div>
  );
}