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

  // --- FUNCIÓ DE MANTENIMENT (ACTUALITZADA) ---
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

  return (
    <footer className={`
        w-full py-6 px-6 z-30 flex flex-col md:flex-row items-center justify-between gap-4 
        text-[10px] font-mono text-slate-500 uppercase tracking-widest relative
        ${transparent ? 'bg-transparent border-none' : 'mt-12 border-t border-white/5 bg-[#0B0C15]/40 backdrop-blur-md'}
        ${className}
    `}>
        
        {/* ESQUERRA: ESTAT DEL SISTEMA */}
        <div className="flex items-center gap-4 md:gap-6">
            <button 
                type="button"
                onClick={handleSystemReset}
                className="flex items-center gap-2 cursor-pointer hover:bg-emerald-500/5 px-2 py-1 rounded-lg transition-colors border border-transparent hover:border-emerald-500/20 group outline-none focus:border-emerald-500/50"
                title="Sistema Operatiu - Clic per Diagnòstic"
                aria-label="Estat del sistema: En línia. Fes clic per reiniciar la memòria cau."
            >
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75 duration-1000"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500 shadow-[0_0_8px_#10b981]"></span>
                </span>
                <span className="text-emerald-500/80 font-bold group-hover:text-emerald-400 transition-colors">
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
            <div className="flex items-center gap-2 group cursor-help transition-colors hover:text-indigo-300 select-none" title="Proveïdor de dades principal">
                <Globe className="w-3 h-3" aria-hidden="true" />
                <span>DATA: OPEN-METEO</span>
            </div>
            {!simple && <span className="hidden md:inline text-white/10" aria-hidden="true">|</span>}
            <div className="flex items-center gap-2 group cursor-help transition-colors hover:text-emerald-300 select-none" title="Model d'alta resolució (Europa)">
                <ShieldCheck className="w-3 h-3" aria-hidden="true" />
                <span>MODEL: AROME HD</span>
            </div>
        </div>

        {/* DRETA: BRANDING & VERSIÓ */}
        <div className="flex items-center gap-2 opacity-60 hover:opacity-100 transition-opacity select-none">
            <span>© {year} METEOTONI AI</span>
            {!simple && (
                <>
                    <span className="text-white/10" aria-hidden="true">|</span>
                    <div className="flex items-center gap-1.5" title="Versió del nucli">
                        <Cpu className="w-3 h-3 text-slate-600" aria-hidden="true" />
                        <span>v{pkg.version}</span>
                    </div>
                </>
            )}
        </div>

    </footer>
  );
}