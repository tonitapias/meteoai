// src/components/Footer.tsx
import React from 'react';
// CORRECCIÓ: Eliminada 'Wifi' de la importació
import { Globe, Cpu, ShieldCheck, Lock } from 'lucide-react';

interface FooterProps {
  simple?: boolean;
  transparent?: boolean;
  className?: string;
}

export default function Footer({ simple = false, transparent = false, className = "" }: FooterProps) {
  const year = new Date().getFullYear();

  // --- FUNCIÓ OCULTA PER NETEJAR CACHE (Health Check Manual) ---
  const handleSystemReset = () => {
    // Confirmació de seguretat per evitar resets accidentals
    if (window.confirm("⚠️ DIAGNÒSTIC: Vols reiniciar la memòria cau i recarregar l'aplicació?")) {
        try {
            localStorage.removeItem('meteoai_gemini_cache');
            window.location.reload();
        } catch (e) {
            console.error("Error esborrant cache:", e);
        }
    }
  };

  return (
    <footer className={`
        w-full py-6 px-6 z-30 flex flex-col md:flex-row items-center justify-between gap-4 
        text-[10px] font-mono text-slate-500 uppercase tracking-widest relative
        ${transparent ? 'bg-transparent border-none' : 'mt-12 border-t border-white/5 bg-[#0B0C15]/40 backdrop-blur-md'}
        ${className}
    `}>
        
        {/* ESQUERRA: ESTAT DEL SISTEMA */}
        <div className="flex items-center gap-4 md:gap-6">
            {/* Indicador d'Estat (Botó discret de Reset) */}
            <button 
                type="button"
                onClick={handleSystemReset}
                className="flex items-center gap-2 cursor-pointer hover:bg-white/5 px-2 py-1 rounded transition-colors bg-transparent border-none outline-none focus:ring-1 focus:ring-emerald-500/50 group"
                title="Sistema Operatiu - Clic per Diagnòstic"
                aria-label="Estat del sistema, clic per reiniciar"
            >
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75 duration-1000"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <span className="text-emerald-500/80 font-bold group-hover:text-emerald-400 transition-colors">
                    SYSTEM ONLINE
                </span>
            </button>

            {!simple && (
                <div className="hidden lg:flex items-center gap-2 text-indigo-500/40" title="Connexió segura xifrada">
                    <Lock className="w-3 h-3" />
                    <span>SECURE PROXY</span>
                </div>
            )}
        </div>

        {/* CENTRE: FONTS DE DADES */}
        <div className="flex flex-col md:flex-row items-center gap-2 md:gap-4 text-center md:text-left">
            <div className="flex items-center gap-2 group cursor-help transition-colors hover:text-indigo-300" title="Dades: Open-Meteo API">
                <Globe className="w-3 h-3" />
                <span>DATA: OPEN-METEO</span>
            </div>
            {!simple && <span className="hidden md:inline text-white/10">|</span>}
            <div className="flex items-center gap-2 group cursor-help transition-colors hover:text-emerald-300" title="Model: AROME HD">
                <ShieldCheck className="w-3 h-3" />
                <span>MODEL: AROME HD</span>
            </div>
        </div>

        {/* DRETA: BRANDING & VERSION */}
        <div className="flex items-center gap-2 opacity-60 hover:opacity-100 transition-opacity">
            <span>© {year} METEOTONI AI</span>
            {!simple && (
                <>
                    <span className="text-white/10">|</span>
                    <div className="flex items-center gap-1.5" title="Versió Core">
                        <Cpu className="w-3 h-3 text-slate-600" />
                        <span>v3.2</span>
                    </div>
                </>
            )}
        </div>

    </footer>
  );
}