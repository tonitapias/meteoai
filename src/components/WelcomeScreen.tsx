// src/components/WelcomeScreen.tsx
import { MapPin, Globe, CloudSun, Command, Loader2, Sparkles, Cpu, Wifi, ShieldCheck } from 'lucide-react';
// CANVI ARQUITECTÒNIC: Importem el tipus mestre de traduccions directament d'on toca.
import { Language, TranslationType } from '../translations';
import pkg from '../../package.json';

interface WelcomeScreenProps {
  lang: Language;
  setLang: (lang: Language) => void;
  t: TranslationType; 
  onLocate: () => void;
  loading: boolean;
}

export default function WelcomeScreen({ lang, setLang, t, onLocate, loading }: WelcomeScreenProps) {
  const year = new Date().getFullYear();

  // DOCTRINA RISC ZERO: Extracció profunda i tipada per protegir el render de JSONs incomplets
  const tRecord = (t && typeof t === 'object') ? (t as Record<string, unknown>) : {};
  const tWelcome = (tRecord.welcome && typeof tRecord.welcome === 'object') ? (tRecord.welcome as Record<string, string>) : {};
  const safeVersion = pkg && pkg.version ? pkg.version : '3.0.0';

  // Helper per a textos tècnics i fallbacks blindats
  const systemText = {
    loading: lang === 'ca' ? "Connectant..." : lang === 'es' ? "Conectando..." : lang === 'fr' ? "Connexion..." : "Connecting...",
    nextGen: lang === 'ca' ? "Previsió Intel·ligent" : lang === 'es' ? "Previsión Inteligente" : lang === 'fr' ? "Prévision Intelligente" : "Next Gen Weather",
    manual: tWelcome.manual || (lang === 'ca' ? "O Cerca Manual" : lang === 'es' ? "O Búsqueda Manual" : "Or Manual Search"),
    tagline: tWelcome.tagline || "",
    desc: tWelcome.desc || (typeof tRecord.subtitle === 'string' ? tRecord.subtitle : "Sistema d'intel·ligència atmosfèrica d'alta precisió."),
    start: tWelcome.start || (lang === 'ca' ? "INICIAR SISTEMA" : "START SYSTEM")
  };

  const displayTagline = systemText.tagline || systemText.nextGen;

  return (
    <div className="relative w-full min-h-screen flex flex-col justify-between overflow-hidden bg-[#020204] select-none">
      
      {/* 1. ATMOSFERA CINEMÀTICA DE FONS */}
      <div className="absolute inset-0 pointer-events-none z-0">
          <div className="absolute top-[-20%] left-[50%] -translate-x-1/2 w-[1000px] h-[600px] bg-indigo-600/20 rounded-[100%] blur-[120px] animate-pulse-slow mix-blend-screen"></div>
          <div className="absolute bottom-[-10%] w-full h-[400px] bg-gradient-to-t from-blue-900/10 to-transparent blur-[80px]"></div>
          <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:60px_60px] [mask-image:radial-gradient(ellipse_at_center,black_40%,transparent_80%)]"></div>
          <div className="absolute inset-0 opacity-[0.15]" style={{backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.7' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`}}></div>
      </div>

      {/* ELEMENT BUIT SUPERIOR (Per centrar verticalment) */}
      <div className="h-10 md:h-20 shrink-0 relative z-10"></div>

      {/* 2. TARGETA DE VIDRE CENTRAL */}
      <div className="relative z-20 w-full max-w-xl p-4 md:p-8 mx-auto animate-in fade-in zoom-in duration-1000 flex flex-col items-center">
        <div className="absolute inset-0 bg-gradient-to-b from-white/10 to-transparent rounded-[2.5rem] -z-10 blur-sm pointer-events-none"></div>
        <div className="absolute inset-0 bg-[#0B0C15]/60 backdrop-blur-2xl rounded-[2.5rem] border border-white/10 shadow-2xl shadow-black/50 -z-10 pointer-events-none"></div>

        <div className="flex flex-col items-center text-center gap-8 py-4 w-full">
            {/* ICONA DE L'APP */}
            <div className="relative">
                <div className="absolute inset-0 bg-indigo-500 blur-2xl opacity-30 animate-pulse pointer-events-none"></div>
                <div className="relative p-5 bg-gradient-to-br from-[#1a1d2d] to-[#0f111a] rounded-3xl border border-white/10 shadow-xl ring-1 ring-white/5 group hover:scale-105 transition-transform duration-500">
                    <CloudSun className="w-20 h-20 text-indigo-400 group-hover:text-white transition-colors duration-500" strokeWidth={1} />
                </div>
            </div>

            {/* TEXTOS PRINCIPALS */}
            <div className="space-y-3">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/5 text-[9px] font-mono font-bold tracking-widest text-indigo-200 uppercase mb-2 shadow-inner">
                    <Sparkles className="w-3 h-3 text-amber-400" />
                    {displayTagline}
                </div>
                <h1 className="text-5xl md:text-7xl font-black tracking-tighter text-white leading-[0.9] drop-shadow-xl">
                    METEO<br/>
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-purple-400 to-cyan-400">TONI AI</span>
                </h1>
                <p className="text-sm md:text-base text-slate-400 font-medium max-w-sm mx-auto leading-relaxed mt-2 px-4">
                    {systemText.desc}
                </p>
            </div>

            {/* BOTONS D'ACCIÓ */}
            <div className="w-full max-w-xs space-y-6">
                <button 
                    type="button"
                    onClick={onLocate}
                    disabled={loading}
                    className={`group relative w-full py-4 rounded-xl overflow-hidden transition-all duration-300 shadow-[0_0_40px_-10px_rgba(79,70,229,0.5)] ${loading ? 'opacity-70 cursor-not-allowed scale-95' : 'hover:scale-[1.02] active:scale-[0.98]'}`}
                >
                    <div className="absolute inset-0 bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-600 bg-[length:200%_auto] animate-[gradient_3s_ease_infinite] z-0"></div>
                    <div className="relative z-10 flex items-center justify-center gap-3 text-white drop-shadow-md">
                        {loading ? (
                            <>
                                <Loader2 className="w-5 h-5 animate-spin" />
                                <span className="font-bold tracking-wider text-xs uppercase">{systemText.loading}</span>
                            </>
                        ) : (
                            <>
                                <MapPin className="w-5 h-5 group-hover:animate-bounce" />
                                <span className="font-black tracking-widest text-xs uppercase">
                                    {systemText.start}
                                </span>
                            </>
                        )}
                    </div>
                </button>

                <div className="flex items-center justify-center gap-3 opacity-50 pointer-events-none">
                    <div className="h-px bg-white/20 flex-1"></div>
                    <div className="flex items-center gap-2 text-[10px] font-mono text-white uppercase tracking-widest">
                        <Command className="w-3 h-3" />
                        <span>{systemText.manual}</span>
                    </div>
                    <div className="h-px bg-white/20 flex-1"></div>
                </div>
            </div>

            {/* SELECTOR D'IDIOMA "MÒDULS D'ENERGIA" */}
            <div className="relative z-30 w-full max-w-[300px] md:max-w-sm mt-4">
                <div className="p-1.5 bg-black/40 backdrop-blur-md rounded-xl border-t border-white/20 border-b border-white/5 shadow-[inset_0_2px_10px_rgba(0,0,0,0.5)] flex justify-between gap-2">
                    {(['ca', 'es', 'en', 'fr'] as Language[]).map((l) => {
                        const isActive = lang === l;
                        return (
                            <button
                                key={l}
                                type="button"
                                disabled={loading}
                                onClick={() => setLang(l)}
                                className={`
                                    relative group flex-1 h-10 rounded-[0.6rem] overflow-hidden transition-all duration-300
                                    ${isActive ? 'flex-[1.5]' : 'hover:bg-white/5'}
                                    ${loading ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}
                                `}
                                aria-pressed={isActive}
                                aria-label={`Canviar idioma a ${l.toUpperCase()}`}
                            >
                                {/* FONS ACTIU: Nucli d'Energia */}
                                <div className={`absolute inset-0 transition-opacity duration-500 z-0 ${isActive ? 'opacity-100' : 'opacity-0'}`}>
                                    <div className="absolute inset-0 bg-gradient-to-tr from-indigo-600 via-cyan-500 to-indigo-400"></div>
                                    <div className="absolute inset-0 bg-cyan-400 blur-md opacity-50 animate-pulse-slow"></div>
                                    <div className="absolute top-0 left-0 right-0 h-1/2 bg-gradient-to-b from-white/40 to-transparent"></div>
                                </div>

                                {/* ESTAT INACTIU: Vora subtil */}
                                <div className={`absolute inset-0 rounded-[0.6rem] border border-white/10 transition-opacity duration-300 z-0 ${isActive ? 'opacity-0' : 'opacity-100 group-hover:border-white/30'}`}></div>

                                {/* TEXT DE L'IDIOMA */}
                                <div className={`relative h-full flex items-center justify-center px-2 font-mono text-[11px] font-black tracking-wider uppercase transition-all duration-300 z-10
                                    ${isActive 
                                        ? 'text-white scale-110 drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]' 
                                        : 'text-slate-400 group-hover:text-slate-200'}
                                `}>
                                    {l}
                                    {isActive && <span className="absolute bottom-1 w-1 h-1 bg-white rounded-full shadow-[0_0_4px_white]"></span>}
                                </div>
                            </button>
                        );
                    })}
                </div>
            </div>
        </div>
      </div>

      {/* 3. PEU DE PÀGINA PROFESSIONAL */}
      <footer className="w-full bg-[#0B0C15]/90 backdrop-blur-md border-t border-white/5 py-4 px-6 flex flex-col md:flex-row items-center justify-between gap-3 text-[9px] font-mono text-slate-500 uppercase tracking-widest z-30 mt-8 md:mt-0 relative shrink-0 shadow-[0_-10px_30px_rgba(0,0,0,0.5)]">
          
          <div className="flex items-center gap-6">
              <div className="flex items-center gap-2 bg-emerald-500/10 px-2 py-1 rounded border border-emerald-500/20">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_5px_#10b981] animate-pulse"></span>
                  <span className="text-emerald-400 font-bold">SYSTEM ONLINE</span>
              </div>
              <div className="hidden md:flex items-center gap-2">
                  <Cpu className="w-3 h-3 text-indigo-500" />
                  <span>CORE: V.{safeVersion}</span>
              </div>
          </div>

          <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 group transition-colors hover:text-indigo-400">
                  <Globe className="w-3 h-3 group-hover:drop-shadow-[0_0_5px_rgba(129,140,248,0.8)] transition-all" />
                  <span>DATA: OPEN-METEO API</span>
              </div>
              <div className="w-px h-3 bg-white/10 hidden md:block"></div>
              <div className="flex items-center gap-2 group transition-colors hover:text-emerald-400">
                  <ShieldCheck className="w-3 h-3 group-hover:drop-shadow-[0_0_5px_rgba(52,211,153,0.8)] transition-all" />
                  <span>MODEL: AROME HD</span>
              </div>
          </div>

          <div className="hidden md:flex items-center gap-2 opacity-50 hover:opacity-100 transition-opacity">
              <span>© {year} METEOTONI AI</span>
              <Wifi className="w-3 h-3 text-blue-500" />
          </div>

      </footer>
    </div>
  );
}