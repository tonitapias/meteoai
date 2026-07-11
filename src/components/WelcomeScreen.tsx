// src/components/WelcomeScreen.tsx
import React, { useState } from 'react';
import { 
  MapPin, Globe, Loader2, CloudRain, Wind, 
  ShieldCheck, Satellite, CloudLightning, ThermometerSun, Activity, Droplets 
} from 'lucide-react';
import { Language, TranslationType } from '../translations';
import pkg from '../../package.json';

interface WelcomeScreenProps {
  lang: Language;
  setLang: (lang: Language) => void;
  t: TranslationType;
  onLocate: () => void;
  loading: boolean;
}

/**
 * METEOTONI AI - SPECTACULAR ATMOSPHERIC INTERFACE (i18n READY)
 * Arquitectura: HUD immersiu, partícules CSS i Glassmorphism Premium.
 * Risc Zero: i18n Integral amb diccionari autònom de seguretat (ca, es, en, fr).
 */
export default function WelcomeScreen({ lang, setLang, t, onLocate, loading }: WelcomeScreenProps) {
  const year = new Date().getFullYear();

  // DOCTRINA RISC ZERO: Extracció profunda i tipada per a i18n
  const tRecord = (t && typeof t === 'object') ? (t as Record<string, unknown>) : {};
  const tWelcome = (tRecord.welcome && typeof tRecord.welcome === 'object') ? (tRecord.welcome as Record<string, string>) : {};
  const safeVersion = pkg && pkg.version ? pkg.version : '3.0.0';

  // DICCIONARI DE SISTEMA MULTILINGÜE (Risc Zero Fallback)
  // Intenta llegir del fitxer de traducció extern (tWelcome), si no existeix la clau, aplica la traducció interna segons 'lang'.
  const systemText = {
    loading: tWelcome.loading || (lang === 'es' ? "SINTETIZANDO ATMÓSFERA..." : lang === 'en' ? "SYNTHESIZING ATMOSPHERE..." : lang === 'fr' ? "SYNTHÈSE ATMOSPHÉRIQUE..." : "SINTETITZANT ATMOSFERA..."),
    tagline: tWelcome.tagline || (lang === 'es' ? "INTELIGENCIA METEOROLÓGICA EN TIEMPO REAL" : lang === 'en' ? "REAL-TIME METEOROLOGICAL INTELLIGENCE" : lang === 'fr' ? "INTELLIGENCE MÉTÉOROLOGIQUE EN TEMPS RÉEL" : "INTEL·LIGÈNCIA METEOROLÒGICA EN TEMPS REAL"),
    desc: tWelcome.desc || (lang === 'es' ? "Telemetría de alta precisión. Cruzando modelos globales GFS y locales (WRF/AROME) para condiciones extremas." : lang === 'en' ? "High-precision telemetry. Crossing global GFS and local (WRF/AROME) models for extreme conditions." : lang === 'fr' ? "Télémétrie haute précision. Croisement des modèles globaux GFS et locaux (WRF/AROME) pour conditions extrêmes." : "Telemetria d'alta precisió. Creuant models globals GFS i locals d'alta resolució (WRF/AROME) per condicions extremes."),
    start: tWelcome.start || (lang === 'es' ? "DESPLEGAR SENSORES" : lang === 'en' ? "DEPLOY SENSORS" : lang === 'fr' ? "DÉPLOYER CAPTEURS" : "DESPLEGAR SENSORS"),
    manual: tWelcome.manual || (lang === 'es' ? "CALIBRADO MANUAL" : lang === 'en' ? "MANUAL CALIBRATION" : lang === 'fr' ? "CALIBRAGE MANUEL" : "CALIBRAT MANUAL"),
    
    // Noves cadenes de la UI Espectacular afegides al motor i18n
    aiEngine: tWelcome.aiEngine || (lang === 'es' ? "MOTOR IA" : lang === 'en' ? "AI ENGINE" : lang === 'fr' ? "MOTEUR IA" : "MOTOR IA"),
    modelLink: tWelcome.modelLink || (lang === 'es' ? "ENLACE WRF/AROME" : lang === 'en' ? "WRF/AROME LINK" : lang === 'fr' ? "LIEN WRF/AROME" : "ENLLAÇ WRF/AROME"),
    systemStatus: tWelcome.systemStatus || (lang === 'es' ? "SISTEMA ÓPTIMO" : lang === 'en' ? "SYSTEM OPTIMAL" : lang === 'fr' ? "SYSTÈME OPTIMAL" : "SISTEMA ÒPTIM"),
    analysis: tWelcome.analysis || (lang === 'es' ? "ANÁLISIS: MULTI-MODELO" : lang === 'en' ? "ANALYSIS: MULTI-MODEL" : lang === 'fr' ? "ANALYSE: MULTI-MODÈLE" : "ANÀLISI: MULTI-MODEL"),
    secure: tWelcome.secure || (lang === 'es' ? "CONEXIÓN SEGURA" : lang === 'en' ? "SECURE CONNECTION" : lang === 'fr' ? "CONNEXION SÉCURISÉE" : "CONNEXIÓ SEGURA"),
  };

  // Risc Zero (Puresa de React): Generem els valors aleatoris UNA SOLA VEGADA al muntar el component.
  const [particles] = useState(() => 
    Array.from({ length: 20 }).map(() => ({
      left: `${Math.random() * 100}%`,
      duration: `${10 + Math.random() * 15}s`,
      delay: `-${Math.random() * 20}s`,
      drift: `${(Math.random() - 0.5) * 100}px`
    }))
  );

  return (
    <div className="relative w-full h-dvh overflow-hidden bg-[#030712] select-none font-sans text-slate-200 antialiased flex flex-col">
      
      {/* =========================================
          MOTOR D'EFECTES ESPECIALS (CSS GPU)
          ========================================= */}
      <style>{`
        @keyframes float-clouds {
          0%, 100% { transform: translateY(0) scale(1) rotate(0deg); opacity: 0.4; }
          50% { transform: translateY(-30px) scale(1.1) rotate(5deg); opacity: 0.7; }
        }
        @keyframes aurora-shift {
          0% { transform: translateX(-10%) translateY(-10%) scale(1); filter: hue-rotate(0deg); }
          50% { transform: translateX(10%) translateY(10%) scale(1.2); filter: hue-rotate(30deg); }
          100% { transform: translateX(-10%) translateY(-10%) scale(1); filter: hue-rotate(0deg); }
        }
        @keyframes holographic-float {
          0% { transform: rotateX(65deg) rotateZ(0deg); }
          100% { transform: rotateX(65deg) rotateZ(360deg); }
        }
        @keyframes layer-bounce {
          0%, 100% { transform: translateZ(var(--z-offset)) translateY(0px); }
          50% { transform: translateZ(var(--z-offset)) translateY(-8px); }
        }
        @keyframes title-shimmer {
          0% { background-position: 200% center; }
          100% { background-position: -200% center; }
        }
        @keyframes particle-drift {
          0% { transform: translateY(100vh) translateX(0px) scale(0.5); opacity: 0; }
          20% { opacity: 0.8; }
          80% { opacity: 0.5; }
          100% { transform: translateY(-20vh) translateX(var(--drift)) scale(1.5); opacity: 0; }
        }
        .preserve-3d { transform-style: preserve-3d; }
        
        .bg-grid-sky {
          background-image: 
            linear-gradient(rgba(125, 211, 252, 0.05) 1px, transparent 1px),
            linear-gradient(90deg, rgba(125, 211, 252, 0.05) 1px, transparent 1px);
          background-size: 40px 40px;
        }
        
        .glass-panel {
          background: linear-gradient(135deg, rgba(255, 255, 255, 0.08) 0%, rgba(255, 255, 255, 0.01) 100%);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-top: 1px solid rgba(255, 255, 255, 0.3);
          border-left: 1px solid rgba(255, 255, 255, 0.2);
          box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.3), inset 0 0 10px rgba(255,255,255,0.05);
        }

        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>

      {/* 1. LAYER BASE: FONS D'AURORA I PARTÍCULES */}
      <div className="absolute inset-0 pointer-events-none z-0 flex items-center justify-center [perspective:1200px] overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(15,23,42,0)_0%,rgba(3,7,18,1)_80%)] z-10"></div>
        <div className="absolute top-[-10%] left-[-10%] w-[60%] h-[60%] bg-sky-500/20 rounded-full blur-[120px] mix-blend-screen animate-[aurora-shift_20s_ease-in-out_infinite]"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] bg-indigo-600/20 rounded-full blur-[120px] mix-blend-screen animate-[aurora-shift_25s_ease-in-out_infinite_reverse]"></div>
        <div className="absolute top-[40%] left-[30%] w-[40%] h-[40%] bg-blue-400/10 rounded-full blur-[100px] mix-blend-overlay animate-[float-clouds_15s_ease-in-out_infinite]"></div>

        <div className="absolute inset-0 z-10">
            {particles.map((p, i) => (
               <div 
                  key={i}
                  className="absolute w-1 h-1 bg-sky-300 rounded-full shadow-[0_0_8px_rgba(125,211,252,0.8)]"
                  style={{
                      left: p.left,
                      top: '100%',
                      opacity: 0,
                      animation: `particle-drift ${p.duration} linear infinite`,
                      animationDelay: p.delay,
                      '--drift': p.drift
                  } as React.CSSProperties}
               />
            ))}
        </div>

        <div className="absolute bottom-[-30%] w-[200%] h-[150%] bg-grid-sky origin-bottom transform rotateX(75deg) z-20 [mask-image:linear-gradient(to_top,black_5%,transparent_80%)] opacity-60"></div>
      </div>

      {/* 2. HUD CENTRAL */}
      <main className="relative z-30 flex-1 w-full max-w-7xl mx-auto px-4 py-6 md:py-8 flex flex-col lg:flex-row items-center justify-center gap-6 sm:gap-8 lg:gap-16 overflow-y-auto no-scrollbar">
        
        {/* === SUPERCÈL·LULA HOLOGRÀFICA 3D === */}
        <div className="relative w-32 h-32 xs:w-48 xs:h-48 sm:w-64 sm:h-64 md:w-80 md:h-80 lg:w-[400px] lg:h-[400px] shrink-0 preserve-3d [perspective:1200px] mt-4 lg:mt-0">
            <div className={`absolute inset-0 rounded-full blur-[60px] md:blur-[80px] transition-colors duration-1000 ${loading ? 'bg-amber-500/40' : 'bg-sky-400/30'}`}></div>
            
            <div className="absolute inset-0 preserve-3d animate-[holographic-float_30s_linear_infinite]">
                <div className="absolute inset-0 rounded-full border border-sky-400/20 bg-sky-950/20 preserve-3d backdrop-blur-md" style={{ '--z-offset': '0px' } as React.CSSProperties}>
                    <div className="absolute inset-0 rounded-full bg-[conic-gradient(from_0deg,transparent_60%,rgba(125,211,252,0.3)_100%)] animate-[spin_3s_linear_infinite]"></div>
                    <div className="absolute inset-0 rounded-full border border-sky-400/10"></div>
                </div>

                <div className="absolute inset-[8%] preserve-3d animate-[layer-bounce_8s_ease-in-out_infinite]" style={{ '--z-offset': '40px' } as React.CSSProperties}>
                   <div className="absolute inset-0 border-[1.5px] border-indigo-400/40 rounded-[40%_60%_70%_30%_/_40%_50%_60%_50%] animate-[spin_15s_linear_infinite]"></div>
                   <div className="absolute inset-0 border-[1px] border-sky-300/30 rounded-[60%_40%_30%_70%_/_50%_60%_40%_50%] animate-[spin_20s_linear_infinite_reverse]"></div>
                </div>

                <div className="absolute inset-[20%] flex items-center justify-center preserve-3d animate-[layer-bounce_8s_ease-in-out_infinite_1s]" style={{ '--z-offset': '80px' } as React.CSSProperties}>
                    <div className="relative w-full h-full animate-[spin_25s_linear_infinite]">
                        <div className="absolute inset-0 border-4 border-t-sky-300/80 border-r-transparent border-b-sky-600/80 border-l-transparent rounded-full animate-[spin_4s_linear_infinite]"></div>
                        <div className="absolute inset-[10%] border-2 border-t-transparent border-r-indigo-400/60 border-b-transparent border-l-sky-400/60 rounded-full animate-[spin_5s_linear_infinite_reverse]"></div>
                        
                        <div className="absolute -top-4 left-1/2 -translate-x-1/2 p-1.5 sm:p-2 glass-panel rounded-full animate-bounce">
                           <CloudRain className="w-3 h-3 sm:w-6 sm:h-6 text-sky-200" />
                        </div>
                        <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 p-1.5 sm:p-2 glass-panel rounded-full animate-bounce" style={{ animationDelay: '1s' }}>
                           <Wind className="w-3 h-3 sm:w-6 sm:h-6 text-indigo-300" />
                        </div>
                    </div>
                </div>

                <div className="absolute inset-[35%] flex items-center justify-center preserve-3d animate-[layer-bounce_8s_ease-in-out_infinite_2s]" style={{ '--z-offset': '130px' } as React.CSSProperties}>
                   <div className="relative w-full h-full flex items-center justify-center">
                       <div className={`absolute inset-[10%] rounded-full blur-md ${loading ? 'bg-amber-400/60 animate-pulse' : 'bg-sky-200/40'}`}></div>
                       <CloudLightning 
                          className={`absolute w-full h-full transition-all duration-700 z-10 ${loading ? 'text-amber-300 drop-shadow-[0_0_25px_rgba(252,211,77,1)]' : 'text-white drop-shadow-[0_0_15px_rgba(255,255,255,0.9)]'}`} 
                          strokeWidth={1} 
                       />
                   </div>
                </div>
            </div>
        </div>

        {/* === PANELL DE COMANDAMENTS === */}
        <div className="flex flex-col items-center lg:items-start text-center lg:text-left w-full max-w-sm md:max-w-xl shrink-0 my-auto pb-4 lg:pb-0 z-30">
            
            {/* Status Badges Premium - Ara amb traducció */}
            <div className="flex flex-wrap justify-center lg:justify-start gap-2.5 mb-3 sm:mb-6">
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full glass-panel text-[9px] sm:text-[11px] font-bold text-sky-200 tracking-widest uppercase">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-sky-400 shadow-[0_0_8px_rgba(56,189,248,1)]"></span>
                    </span>
                    {systemText.aiEngine}
                </div>
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full glass-panel text-[9px] sm:text-[11px] font-bold text-indigo-200 tracking-widest uppercase">
                    <Satellite className="w-3.5 h-3.5 text-indigo-400" />
                    {systemText.modelLink}
                </div>
            </div>
            
            {/* Títol Shimmer Efect */}
            <h1 className="text-3xl xs:text-4xl sm:text-5xl md:text-6xl lg:text-[5.5rem] font-black tracking-tight lg:tracking-tighter mb-2 pb-1 text-transparent bg-clip-text bg-gradient-to-r from-white via-sky-200 to-white bg-[length:200%_auto] animate-[title-shimmer_4s_linear_infinite] drop-shadow-[0_4px_20px_rgba(125,211,252,0.3)] leading-[1.1]">
                METEO TONI AI
            </h1>

            {/* Tagline tipus Píndola de Dades */}
            <div className="inline-flex items-center justify-center lg:justify-start gap-2 px-3 py-1.5 sm:px-4 sm:py-2 mb-4 sm:mb-6 rounded-xl glass-panel text-[9px] sm:text-xs font-bold tracking-[0.15em] sm:tracking-[0.2em] text-sky-100 uppercase">
                <ThermometerSun className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-sky-400 animate-pulse shrink-0" />
                <span>{systemText.tagline}</span>
            </div>
            
            {/* Descripció Rica */}
            <p className="text-[11px] sm:text-sm md:text-base text-slate-300 font-light leading-relaxed mb-5 sm:mb-10 max-w-[280px] sm:max-w-sm md:max-w-lg hidden xs:block">
                {systemText.desc}
            </p>

            {/* ACCIONS PRINCIPALS */}
            <div className="w-full flex flex-col gap-3 sm:gap-5 shrink-0">
                
                {/* BOTÓ D'INICI (Drop / Liquid Button) */}
                <button 
                    type="button"
                    onClick={onLocate}
                    disabled={loading}
                    className={`group relative w-full py-3.5 sm:py-5 transition-all duration-500 overflow-hidden flex items-center justify-center rounded-2xl sm:rounded-3xl glass-panel
                    ${loading 
                        ? 'cursor-wait shadow-[0_0_30px_rgba(245,158,11,0.2)] border-amber-500/30' 
                        : 'hover:bg-white/10 border-sky-300/40 hover:border-sky-300 hover:shadow-[0_15px_40px_rgba(56,189,248,0.3)] active:scale-[0.98] cursor-pointer'}`}
                >
                    {loading && (
                      <div className="absolute inset-0 bg-gradient-to-r from-amber-500/0 via-amber-400/20 to-amber-500/0 w-[200%] animate-[title-shimmer_2s_linear_infinite]"></div>
                    )}
                    
                    <div className="relative flex items-center gap-2 sm:gap-3">
                        {loading ? (
                            <>
                                <Loader2 className="w-5 h-5 sm:w-6 sm:h-6 text-amber-400 animate-spin drop-shadow-[0_0_8px_rgba(245,158,11,0.8)]" />
                                <span className="font-sans font-bold tracking-widest text-xs sm:text-base text-amber-300 uppercase drop-shadow-md">{systemText.loading}</span>
                            </>
                        ) : (
                            <>
                                <MapPin className="w-5 h-5 sm:w-6 sm:h-6 text-sky-300 group-hover:-translate-y-1 transition-transform duration-300 drop-shadow-[0_0_8px_rgba(125,211,252,0.8)]" />
                                <span className="font-sans font-black tracking-[0.2em] sm:tracking-[0.25em] text-sm sm:text-lg text-white uppercase drop-shadow-lg">
                                    {systemText.start}
                                </span>
                            </>
                        )}
                    </div>
                </button>

                {/* Sub-controls i Selector d'Idiomes */}
                <div className="flex flex-row items-center justify-between gap-2 w-full px-1 sm:px-2">
                    
                    <button className="flex items-center gap-1 sm:gap-1.5 group opacity-70 hover:opacity-100 transition-all cursor-pointer px-1 sm:px-2 py-1 rounded-lg hover:bg-white/5">
                        <Droplets className="w-3 h-3 sm:w-4 sm:h-4 text-sky-400 group-hover:scale-110 transition-transform" />
                        <span className="text-[9px] sm:text-xs font-semibold text-slate-300 uppercase tracking-widest whitespace-nowrap">
                            {systemText.manual}
                        </span>
                    </button>

                    <div className="flex gap-0.5 sm:gap-1 p-0.5 sm:p-1 rounded-full glass-panel shrink-0">
                        {(['ca', 'es', 'en', 'fr'] as Language[]).map((l) => (
                            <button
                                key={l}
                                type="button"
                                disabled={loading}
                                onClick={() => setLang(l)}
                                className={`
                                    px-2.5 py-1 sm:px-4 sm:py-2 font-sans text-[9px] sm:text-xs font-bold uppercase transition-all duration-300 rounded-full
                                    ${lang === l 
                                        ? 'bg-sky-500 text-white shadow-[0_0_15px_rgba(56,189,248,0.5)]' 
                                        : 'text-slate-400 hover:text-white hover:bg-white/10'}
                                    ${loading ? 'cursor-not-allowed' : 'cursor-pointer'}
                                `}
                            >
                                {l}
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        </div>
      </main>

      {/* 3. FOOTER TELEMÈTRIC (Dades creuades 100% i18n) */}
      <footer className="relative w-full glass-panel border-b-0 border-l-0 border-r-0 px-3 py-3 sm:px-8 sm:py-5 flex items-center justify-between gap-4 z-40 shrink-0 overflow-x-auto no-scrollbar rounded-t-2xl sm:rounded-none bg-black/40">
          
          <div className="flex items-center gap-3 sm:gap-5 shrink-0">
              <div className="flex items-center gap-2 sm:gap-2.5">
                  <div className="relative flex items-center justify-center">
                    <div className="absolute w-2 h-2 sm:w-3 sm:h-3 rounded-full bg-sky-400 animate-ping opacity-60"></div>
                    <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-sky-400 shadow-[0_0_10px_rgba(56,189,248,1)]"></div>
                  </div>
                  <span className="text-[9px] sm:text-xs font-bold text-sky-100 tracking-widest whitespace-nowrap">
                      {systemText.systemStatus}
                  </span>
              </div>
              <div className="hidden xs:flex items-center gap-2 text-[9px] sm:text-xs font-medium text-slate-400 border-l border-white/20 pl-3 sm:pl-5">
                  <Activity className="w-3 h-3 sm:w-4 sm:h-4 text-indigo-400" /> {systemText.analysis}
              </div>
          </div>

          <div className="flex items-center gap-3 sm:gap-5 shrink-0">
              <div className="hidden md:flex items-center gap-1.5 sm:gap-2 text-[9px] sm:text-xs font-medium text-slate-400">
                  <Globe className="w-3 h-3 sm:w-4 sm:h-4 text-slate-500" /> SAT: METEOSAT-11
              </div>
              <div className="hidden sm:flex items-center gap-1.5 sm:gap-2 text-[9px] sm:text-xs font-medium text-slate-400">
                  <ShieldCheck className="w-3 h-3 sm:w-4 sm:h-4 text-sky-400/80" /> {systemText.secure}
              </div>
              <div className="flex items-center gap-1.5 text-[9px] sm:text-xs font-black text-sky-200 tracking-widest whitespace-nowrap bg-white/10 px-2 py-0.5 sm:px-3 sm:py-1 rounded-full">
                  <span>© {year} MT-AI</span>
                  <span className="text-[8px] sm:text-[10px] opacity-60">v{safeVersion}</span>
              </div>
          </div>
      </footer>
    </div>
  );
}