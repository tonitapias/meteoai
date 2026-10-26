// src/components/Footer.tsx
import { useEffect, useState } from 'react';
import { APP_VERSION } from '../utils/appVersion';
import { Globe, Cpu, ShieldCheck, Lock } from 'lucide-react';
import { cacheService } from '../services/cacheService';
import { TRANSLATIONS, type Language } from '../translations';

interface FooterProps {
  simple?: boolean;
  transparent?: boolean;
  className?: string;
  lang?: Language;
  /** Model regional que fa servir de debò la previsió a pantalla (current.source), o null si és la dels models mundials. */
  regionalModelLabel?: string | null;
}

// Estat real de la connexió del navegador: abans el peu deia "SYSTEM ONLINE" en verd fins i tot sense xarxa.
const useOnlineStatus = (): boolean => {
  const [online, setOnline] = useState(() => typeof navigator === 'undefined' || navigator.onLine !== false);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine !== false);
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);
  return online;
};

export default function Footer({ simple = false, transparent = false, className = "", lang = 'ca', regionalModelLabel = null }: FooterProps) {
  const year = new Date().getFullYear();
  const t = (TRANSLATIONS[lang] || TRANSLATIONS.ca).footer;
  const online = useOnlineStatus();
  const stateLabel = online ? t.online : t.offline;

  // --- BUIDAR LA MEMÒRIA CAU ---
  // Esborra només les previsions i les anàlisis desades (vegeu cacheService.clearCachedData): els favorits i les
  // preferències es mantenen, tal com diu el diàleg.
  const handleCacheReset = async () => {
    if (window.confirm(t.resetConfirm)) {
        try {
            await cacheService.clearCachedData();
        } catch (e) {
            console.error("Error esborrant cache:", e);
        } finally {
            window.location.reload();
        }
    }
  };

  // SPATIAL UI BASE
  const footerBaseStyle = `w-full py-6 px-6 z-30 flex flex-col md:flex-row items-center justify-between gap-4 text-[10px] font-mono text-slate-500 uppercase tracking-widest relative transition-colors duration-500 ${className}`;
  const footerBgStyle = transparent
    ? 'bg-transparent border-none'
    : 'mt-12 border-t border-white/5 bg-[#0B0C15]/80 shadow-[0_-10px_30px_rgba(0,0,0,0.5)]';

  const statusButtonStyle = online
    ? 'bg-emerald-500/5 hover:bg-emerald-500/10 border-emerald-500/10 hover:border-emerald-500/30 shadow-[inset_0_1px_4px_rgba(16,185,129,0.1)] focus:border-emerald-500/50'
    : 'bg-amber-500/5 hover:bg-amber-500/10 border-amber-500/20 hover:border-amber-500/40 shadow-[inset_0_1px_4px_rgba(245,158,11,0.1)] focus:border-amber-500/50';

  return (
    <footer className={`${footerBaseStyle} ${footerBgStyle}`}>

        {/* ESQUERRA: ESTAT DE LA CONNEXIÓ (clic: buidar la memòria cau) */}
        <div className="flex items-center gap-4 md:gap-6">
            <button
                type="button"
                onClick={handleCacheReset}
                className={`flex items-center gap-2 cursor-pointer px-2.5 py-1.5 rounded-lg uppercase transition-all duration-300 border active:scale-95 group outline-none ${statusButtonStyle}`}
                title={t.statusTitle}
                aria-label={t.statusAria.replace('{state}', stateLabel)}
            >
                <span className="relative flex h-2 w-2">
                  {online && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75 duration-1000"></span>}
                  <span className={`relative inline-flex rounded-full h-2 w-2 ${online ? 'bg-emerald-500 shadow-[0_0_8px_#10b981]' : 'bg-amber-400 shadow-[0_0_8px_#f59e0b]'}`}></span>
                </span>
                <span className={`font-bold transition-colors ${online ? 'text-emerald-500/90 group-hover:text-emerald-400 drop-shadow-[0_0_5px_rgba(16,185,129,0.4)]' : 'text-amber-400/90 group-hover:text-amber-300'}`}>
                    {stateLabel}
                </span>
            </button>

            {!simple && (
                <div className="hidden lg:flex items-center gap-2 text-indigo-500/40 select-none" title={t.secureProxyTitle}>
                    <Lock className="w-3 h-3" aria-hidden="true" />
                    <span>{t.secureProxy}</span>
                </div>
            )}
        </div>

        {/* CENTRE: FONTS DE DADES */}
        <div className="flex flex-col md:flex-row items-center gap-2 md:gap-4 text-center md:text-left">
            <div className="flex items-center gap-2 group cursor-help transition-all duration-300 hover:text-indigo-400 select-none" title={t.dataTitle}>
                <Globe className="w-3.5 h-3.5 group-hover:drop-shadow-[0_0_5px_rgba(129,140,248,0.8)] transition-all" aria-hidden="true" />
                <span>{t.data}</span>
            </div>
            {!simple && <span className="hidden md:inline text-white/10" aria-hidden="true">|</span>}
            <div className="flex items-center gap-2 group cursor-help transition-all duration-300 hover:text-emerald-400 select-none" title={regionalModelLabel ? t.regionalModelTitle : t.globalModelTitle}>
                <ShieldCheck className="w-3.5 h-3.5 group-hover:drop-shadow-[0_0_5px_rgba(52,211,153,0.8)] transition-all" aria-hidden="true" />
                <span>{t.model.replace('{name}', regionalModelLabel || t.globalModel)}</span>
            </div>
        </div>

        {/* DRETA: BRANDING & VERSIÓ */}
        <div className="flex items-center gap-2 opacity-60 hover:opacity-100 transition-opacity duration-300 select-none">
            <span>© {year} METEOTONI AI</span>
            {!simple && (
                <>
                    <span className="text-white/10" aria-hidden="true">|</span>
                    <div className="flex items-center gap-1.5" title={t.versionTitle}>
                        <Cpu className="w-3.5 h-3.5 text-slate-600" aria-hidden="true" />
                        <span>v{APP_VERSION}</span>
                    </div>
                </>
            )}
        </div>

    </footer>
  );
}
