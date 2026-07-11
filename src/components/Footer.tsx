// src/components/Footer.tsx
import pkg from '../../package.json';
import { Globe, Cpu, ShieldCheck, Lock } from 'lucide-react';
import { clear } from 'idb-keyval'; // NOU: Importem neteja d'IndexedDB

interface FooterProps {
  simple?: boolean;
  transparent?: boolean;
  className?: string;
}

export default function Footer({ simple = false, transparent = false, className = "" }: FooterProps) {
  const year = new Date().getFullYear();
  
  // DOCTRINA RISC ZERO: Blindatge d'arxius externs (package.json pot ser ofuscat en producció)
  const safeVersion = pkg && pkg.version ? pkg.version : '3.6.0';

  // --- FUNCIÓ DE MANTENIMENT TÀCTIC ---
  const handleSystemReset = async () => {
    // Utilitzem un confirm natiu per seguretat
    if (window.confirm("⚠️ DIAGNÒSTIC DEL SISTEMA\n\nVols reiniciar la memòria cau local i recarregar l'aplicació?\nAixò pot resoldre problemes de dades antigues.")) {
        try {
            console.warn("System Reset: Clearing Cache...");
            
            // 1. Neteja de la nova base de dades (IndexedDB)
            await clear();
            
            // 2. Neteja del LocalStorage (Preferències i restes antigues)
            localStorage.clear();
            
            // 3. Recàrrega
            window.location.reload();
        } catch (e) {
            console.error("Error esborrant cache:", e);
            // Fallback: Si falla IndexedDB, almenys neteja LocalStorage i recarrega
            localStorage.clear();
            window.location.reload();
        }
    }
  };

  // SPATIAL UI BASE
  const footerBaseStyle = `w-full py-6 px-6 z-30 flex flex-col md:flex-row items-center justify-between gap-4 text-[10px] font-mono text-slate-500 uppercase tracking-widest relative transition-colors duration-500 ${className}`;
  const footerBgStyle = transparent 
    ? 'bg-transparent border-none' 
    : 'mt-12 border-t border-white/5 bg-[#0B0C15]/80 backdrop-blur-md shadow-[0_-10px_30px_rgba(0,0,0,0.5)]';

  return (
    <footer className={`${footerBaseStyle} ${footerBgStyle}`}>
        
        {/* ESQUERRA: ESTAT DEL SISTEMA I DIAGNÒSTIC */}
        <div className="flex items-center gap-4 md:gap-6">
            <button 
                type="button"
                onClick={handleSystemReset}
                className="flex items-center gap-2 cursor-pointer bg-emerald-500/5 hover:bg-emerald-500/10 px-2.5 py-1.5 rounded-lg transition-all duration-300 border border-emerald-500/10 hover:border-emerald-500/30 shadow-[inset_0_1px_4px_rgba(16,185,129,0.1)] active:scale-95 group outline-none focus:border-emerald-500/50"
                title="Sistema Operatiu - Clic per Diagnòstic"
                aria-label="Estat del sistema: En línia. Fes clic per reiniciar la memòria cau."
            >
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75 duration-1000"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500 shadow-[0_0_8px_#10b981]"></span>
                </span>
                <span className="text-emerald-500/90 font-bold group-hover:text-emerald-400 transition-colors drop-shadow-[0_0_5px_rgba(16,185,129,0.4)]">
                    SYSTEM ONLINE
                </span>
            </button>

            {!simple && (
                <div className="hidden lg:flex items-center gap-2 text-indigo-500/40 select-none" title="Connexió segura SSL">
                    <Lock className="w-3 h-3" aria-hidden="true" />
                    <span>SECURE PROXY</span>
                </div>
            )}
        </div>

        {/* CENTRE: FONTS DE DADES */}
        <div className="flex flex-col md:flex-row items-center gap-2 md:gap-4 text-center md:text-left">
            <div className="flex items-center gap-2 group cursor-help transition-all duration-300 hover:text-indigo-400 select-none" title="Proveïdor de dades principal">
                <Globe className="w-3.5 h-3.5 group-hover:drop-shadow-[0_0_5px_rgba(129,140,248,0.8)] transition-all" aria-hidden="true" />
                <span>DATA: OPEN-METEO</span>
            </div>
            {!simple && <span className="hidden md:inline text-white/10" aria-hidden="true">|</span>}
            <div className="flex items-center gap-2 group cursor-help transition-all duration-300 hover:text-emerald-400 select-none" title="Model d'alta resolució (Europa)">
                <ShieldCheck className="w-3.5 h-3.5 group-hover:drop-shadow-[0_0_5px_rgba(52,211,153,0.8)] transition-all" aria-hidden="true" />
                <span>MODEL: AROME HD</span>
            </div>
        </div>

        {/* DRETA: BRANDING & VERSIÓ */}
        <div className="flex items-center gap-2 opacity-60 hover:opacity-100 transition-opacity duration-300 select-none">
            <span>© {year} METEOTONI AI</span>
            {!simple && (
                <>
                    <span className="text-white/10" aria-hidden="true">|</span>
                    <div className="flex items-center gap-1.5" title="Versió del nucli">
                        <Cpu className="w-3.5 h-3.5 text-slate-600" aria-hidden="true" />
                        <span>v{safeVersion}</span>
                    </div>
                </>
            )}
        </div>

    </footer>
  );
}