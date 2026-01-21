// src/components/Footer.tsx
import React from 'react';
import { Globe, Cpu, Wifi, ShieldCheck } from 'lucide-react';

interface FooterProps {
  simple?: boolean;
}

export default function Footer({ simple = false }: FooterProps) {
  const year = new Date().getFullYear();

  // --- FUNCIÓ OCULTA PER NETEJAR CACHE ---
  const handleSystemReset = () => {
    // eslint-disable-next-line no-console
    console.log("Intent de reset..."); 
    
    if (window.confirm("🛠️ DEBUG: Vols reiniciar la memòria cau de la IA i recarregar?")) {
        try {
            // eslint-disable-next-line no-console
            console.log("Esborrant cache...");
            localStorage.removeItem('meteoai_gemini_cache');
            window.location.reload();
        } catch (e) {
            console.error("Error esborrant cache:", e);
        }
    }
  };

  return (
    <footer className="w-full mt-12 py-6 px-6 border-t border-white/5 bg-[#0B0C15]/40 backdrop-blur-md flex flex-col md:flex-row items-center justify-between gap-4 text-[10px] font-mono text-slate-500 uppercase tracking-widest z-30 relative">
        
        {/* ESQUERRA: ESTAT DEL SISTEMA (ARA ÉS UN <button> REIAL) */}
        <div className="flex items-center gap-4 md:gap-6">
            <button 
                type="button"
                onClick={handleSystemReset}
                className="flex items-center gap-2 cursor-pointer hover:bg-white/5 px-2 py-1 rounded transition-colors bg-transparent border-none outline-none focus:ring-1 focus:ring-emerald-500/50"
                title="Fes clic per reiniciar la IA (Debug)"
            >
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <span className="text-emerald-500/80 font-bold hover:text-emerald-400 transition-colors">
                    SYSTEM ONLINE
                </span>
            </button>

            {!simple && (
                <div className="hidden md:flex items-center gap-2">
                    <Cpu className="w-3 h-3 text-indigo-500" />
                    <span>CORE: V.3.1.2</span>
                </div>
            )}
        </div>

        {/* CENTRE: FONTS DE DADES */}
        <div className="flex flex-col md:flex-row items-center gap-2 md:gap-4 text-center md:text-left">
            <div className="flex items-center gap-2 group cursor-help transition-colors hover:text-indigo-300">
                <Globe className="w-3 h-3" />
                <span>DATA: OPEN-METEO API</span>
            </div>
            <span className="hidden md:inline text-white/10">|</span>
            <div className="flex items-center gap-2 group cursor-help transition-colors hover:text-emerald-300">
                <ShieldCheck className="w-3 h-3" />
                <span>MODEL: AROME HD (MÉTÉO-FRANCE)</span>
            </div>
        </div>

        {/* DRETA: BRANDING */}
        <div className="flex items-center gap-2 opacity-60 hover:opacity-100 transition-opacity">
            <span>© {year} METEOTONI AI LABS</span>
            <Wifi className="w-3 h-3 text-blue-500" />
        </div>

    </footer>
  );
}