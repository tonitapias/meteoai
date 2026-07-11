// src/components/WelcomeScreen.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { 
  MapPin, Globe, Loader2, CloudRain, Wind, 
  ShieldCheck, Satellite, CloudLightning, ThermometerSun, Activity, Zap,
  HelpCircle, Radio
} from 'lucide-react';
import { Language, TranslationType } from '../translations';
import pkg from '../../package.json';
import DiagnosticsModal, { DiagnosticsModalText } from './DiagnosticsModal';

interface WelcomeScreenProps {
  lang: Language;
  setLang: (lang: Language) => void;
  t: TranslationType;
  onLocate: () => void;
  loading: boolean;
}

/**
 * METEOTONI AI - TACTICAL ATMOSPHERIC OPERATING SYSTEM (v5.0 MODULAR PRO)
 * Arquitectura: Spatial UI, Tipografia Eòlica, Isobares SVG, Component Modal Modularitzat.
 * Doctrina Risc Zero: 0 Errors TS/ESLint, puresa de React garantida, History API per al mòbil.
 */
export default function WelcomeScreen({ lang, setLang, t, onLocate, loading }: WelcomeScreenProps) {
  const year = new Date().getFullYear();

  // DOCTRINA RISC ZERO: Extracció profunda i tipada per a i18n (sense 'any')
  const tRecord = (t && typeof t === 'object') ? (t as Record<string, unknown>) : {};
  const tWelcome = (tRecord.welcome && typeof tRecord.welcome === 'object') ? (tRecord.welcome as Record<string, string>) : {};
  const safeVersion = pkg && pkg.version ? pkg.version : '5.0.0-PRO';

  // DICCIONARI DE SISTEMA MULTILINGÜE (Risc Zero Fallback - Llenguatge Honest i Tàctic)
  const systemText = {
    loading: tWelcome.loading || (lang === 'es' ? "SINTETIZANDO ATMÓSFERA..." : lang === 'en' ? "SYNTHESIZING ATMOSPHERE..." : lang === 'fr' ? "SYNTHÈSE ATMOSPHÉRIQUE..." : "SINTETITZANT ATMOSFERA..."),
    tagline: tWelcome.tagline || (lang === 'es' ? "INTELIGENCIA METEOROLÓGICA EN TIEMPO REAL" : lang === 'en' ? "REAL-TIME METEOROLOGICAL INTELLIGENCE" : lang === 'fr' ? "INTELLIGENCE MÉTÉOROLOGIQUE EN TEMPS RÉEL" : "INTEL·LIGÈNCIA METEOROLÒGICA EN TEMPS REAL"),
    desc: tWelcome.desc || (lang === 'es' ? "Telemetría de alta precisión. Cruzando modelos globales GFS y locales (WRF/AROME) para condiciones extremas." : lang === 'en' ? "High-precision telemetry. Crossing global GFS and local (WRF/AROME) models for extreme conditions." : lang === 'fr' ? "Télémétrie haute précision. Croisement des modèles globaux GFS et locaux (WRF/AROME) pour conditions extrêmes." : "Telemetria d'alta precisió. Creuant models globals GFS i locals d'alta resolució (WRF/AROME) per condicions extremes."),
    start: tWelcome.start || (lang === 'es' ? "DESPLEGAR SENSORES" : lang === 'en' ? "DEPLOY SENSORS" : lang === 'fr' ? "DÉPLOYER CAPTEURS" : "DESPLEGAR SENSORS"),
    manual: tWelcome.manual || (lang === 'es' ? "¿CÓMO FUNCIONA LA IA?" : lang === 'en' ? "HOW AI WORKS?" : lang === 'fr' ? "COMMENT FONCTIONNE L'IA?" : "COM FUNCIONA LA IA?"),
    aiEngine: tWelcome.aiEngine || (lang === 'es' ? "MOTOR IA ACTIVADO" : lang === 'en' ? "AI ENGINE ACTIVE" : lang === 'fr' ? "MOTEUR IA ACTIF" : "MOTOR IA ACTIVAT"),
    modelLink: tWelcome.modelLink || (lang === 'es' ? "ENLACE WRF/AROME" : lang === 'en' ? "WRF/AROME LINK" : lang === 'fr' ? "LIEN WRF/AROME" : "ENLLAÇ WRF/AROME"),
    systemStatus: tWelcome.systemStatus || (lang === 'es' ? "SISTEMA ÓPTIMO" : lang === 'en' ? "SYSTEM OPTIMAL" : lang === 'fr' ? "SYSTÈME OPTIMAL" : "SISTEMA ÒPTIM"),
    analysis: tWelcome.analysis || (lang === 'es' ? "ANÁLISIS: MULTI-MODELO" : lang === 'en' ? "ANALYSIS: MULTI-MODEL" : lang === 'fr' ? "ANALYSE: MULTI-MODÈLE" : "ANÀLISI: MULTI-MODEL"),
    secure: tWelcome.secure || (lang === 'es' ? "CONEXIÓN SEGURA" : lang === 'en' ? "SECURE CONNECTION" : lang === 'fr' ? "CONNEXION SÉCURISÉE" : "CONNEXIÓ SEGURA"),
    
    // Noms de models i estats en Standby
    modelWrf: lang === 'es' ? "MODELO GLOBAL (WRF)" : lang === 'en' ? "GLOBAL MODEL (WRF)" : "MODEL GLOBAL (WRF)",
    modelArome: lang === 'es' ? "ALTA RESOLUCIÓN (AROME)" : lang === 'en' ? "HIGH RES (AROME)" : "ALTA RESOLUCIÓ (AROME)",
    aligned: lang === 'es' ? "SISTEMA LISTO PARA CALIBRAR" : lang === 'en' ? "SYSTEM READY TO CALIBRATE" : "SISTEMA LLEST PER CALIBRAR",
    diagTitle: lang === 'es' ? "¿POR QUÉ CRUZAMOS DOS MODELOS?" : lang === 'en' ? "WHY DO WE CROSS TWO MODELS?" : "PER QUÈ CREUEM DOS MODELS?",
    windGustMax: lang === 'es' ? "Racha máxima" : lang === 'en' ? "Max wind gust" : "Ràfega màxima",
    closeModal: lang === 'es' ? "ENTENDIDO, VOLVER A LA APP" : lang === 'en' ? "GOT IT, BACK TO APP" : "ENTÈS, TORNA A L'APP",
    
    // Ticker d'estat (Sense dades inventades)
    baroTrend: lang === 'es' ? "[ • SENSORES EN STANDBY ] ESPERANDO RUTA" : lang === 'en' ? "[ • SENSORS IN STANDBY ] AWAITING ROUTE" : "[ • SENSORS EN STANDBY ] ESPERANT RUTA",
    standbyValue: "--- km/h",
    standbyReceiver: lang === 'es' ? "STANDBY (Esperando señal GPS)" : lang === 'en' ? "STANDBY (Awaiting GPS signal)" : "STANDBY (Esperant senyal GPS)",
    
    // Textos explicatius pedagògics per al modal modular
    pedagogicIntro: lang === 'es' 
      ? "En la montaña el tiempo puede cambiar en minutos y los relieves locales crean microclimas. Por eso nunca confiamos en una sola fuente meteorológica:"
      : lang === 'en'
      ? "In the mountains, weather can change in minutes and terrain creates microclimates. That is why we never rely on a single weather source:"
      : "A la muntanya el temps pot canviar en minuts i el relleu crea microclimes. Per això mai confiem en una sola font meteorològica:",
    wrfDesc: lang === 'es'
      ? "Nos da la visión general de la atmósfera a gran escala (ideal para ver tendencias a 3-5 días vista)."
      : lang === 'en'
      ? "Provides the large-scale atmospheric overview (ideal for spotting 3-5 day weather trends)."
      : "Ens dóna la visió general de l'atmosfera a gran escala (ideal per veure tendències a 3-5 dies vista).",
    aromeDesc: lang === 'es'
      ? "Capta con extrema precisión los valles y cumbres, detectando tormentas locales y vientos encañonados."
      : lang === 'en'
      ? "Captures valleys and peaks with extreme precision, detecting local storms and terrain-funneled winds."
      : "Capta amb extrema precisió les valls i els cims, detectant tempestes locals i vents encanats al relleu.",
    aiFooter: lang === 'es'
      ? "MeteoToni AI analizará ambos modelos en tiempo real para avisarte de cualquier peligro en cuanto despliegues los sensores."
      : lang === 'en'
      ? "MeteoToni AI will analyze both models in real-time to warn you of any hazards as soon as you deploy sensors."
      : "MeteoToni AI analitzarà ambdós models en temps real per avisar-te de qualsevol perill tan bon punt despleguis els sensors."
  };

  // Constructora de diccionari estricte per al modal
  const modalTexts: DiagnosticsModalText = {
    diagTitle: systemText.diagTitle,
    pedagogicIntro: systemText.pedagogicIntro,
    modelWrf: systemText.modelWrf,
    wrfDesc: systemText.wrfDesc,
    windGustMax: systemText.windGustMax,
    modelArome: systemText.modelArome,
    aromeDesc: systemText.aromeDesc,
    aligned: systemText.aligned,
    standbyReceiver: systemText.standbyReceiver,
    aiFooter: systemText.aiFooter,
    closeModal: systemText.closeModal,
  };

  // =========================================================================
  // DOCTRINA RISC ZERO: MATEMÀTICA SEGURA EN ESTAT DE STANDBY REAL
  // =========================================================================
  const wrfWindSeries: (number | null)[] = [null, null, null, null];
  const aromeWindSeries: (number | null)[] = [null, null, null, null];

  const getSafeMax = useCallback((data: (number | null)[]): number => {
    const validNumbers = data.filter((item): item is number => typeof item === 'number' && !isNaN(item));
    if (validNumbers.length === 0) return 0; // 0 activa el renderitzat segur '--- km/h'
    return Math.max(...validNumbers);
  }, []);

  const wrfMaxWind = getSafeMax(wrfWindSeries);
  const aromeMaxWind = getSafeMax(aromeWindSeries);

  const formatWind = useCallback((val: number): string => {
    return val > 0 ? `${val} km/h` : systemText.standbyValue;
  }, [systemText.standbyValue]);

  // ==========================================
  // DOCTRINA RISC ZERO: NAVEGACIÓ TÀCTICA (History API per a mòbil)
  // ==========================================
  const [showDiagnostics, setShowDiagnostics] = useState(false);

  const closeDiagnosticsModal = useCallback(() => {
    if (typeof window !== 'undefined' && window.history.state?.modal === 'meteo_diagnostics') {
      window.history.back(); // Dispara popstate de manera natural
    } else {
      setShowDiagnostics(false);
    }
  }, []);

  // Escoltador del botó físic "Enrere" dels telèfons mòbils
  useEffect(() => {
    const handlePopState = () => {
      if (showDiagnostics) {
        setShowDiagnostics(false);
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [showDiagnostics]);

  const openDiagnosticsModal = () => {
    if (typeof window !== 'undefined') {
      window.history.pushState({ modal: 'meteo_diagnostics' }, '');
      setShowDiagnostics(true);
    }
  };

  // Generació de partícules atmosfèriques
  const [particles] = useState(() => 
    Array.from({ length: 35 }).map(() => ({
      left: `${Math.random() * 100}%`,
      top: `${Math.random() * 100}%`,
      size: `${Math.random() * 2 + 0.5}px`,
      duration: `${6 + Math.random() * 12}s`,
      delay: `-${Math.random() * 10}s`,
      drift: `${(Math.random() - 0.5) * 60}px`
    }))
  );

  // Estructura per a la tipografia animada (Mobile-safe per paraules)
  const titleWords = [
    { text: "METEO", colorClass: "from-white via-sky-100 to-sky-300" },
    { text: "TONI", colorClass: "from-sky-200 via-indigo-100 to-white" },
    { text: "AI", colorClass: "from-amber-200 via-sky-300 to-white" }
  ];

  // Elements Orbitant Tàctics (Puresa de React: mides predefinides sense Math.random en el render)
  const orbitingSensors = [
    { Icon: CloudRain, color: 'text-sky-300', angle: 0, label: 'PRECIP', width: '75%' },
    { Icon: Wind, color: 'text-indigo-300', angle: 120, label: 'WIND', width: '65%' },
    { Icon: ThermometerSun, color: 'text-amber-300', angle: 240, label: 'TEMP', width: '85%' }
  ];

  return (
    <div className="relative w-full min-h-dvh overflow-y-auto bg-[#020617] select-none font-sans text-slate-200 antialiased flex flex-col">
      
      {/* =========================================
          MOTOR D'EFECTES ESPECIALS & SPATIAL UI
          ========================================= */}
      <style>{`
        @keyframes aurora-shift {
          0% { transform: translateX(-15%) translateY(-15%) scale(1); filter: hue-rotate(0deg); opacity: 0.45; }
          50% { transform: translateX(15%) translateY(15%) scale(1.3); filter: hue-rotate(40deg); opacity: 0.75; }
          100% { transform: translateX(-15%) translateY(-15%) scale(1); filter: hue-rotate(0deg); opacity: 0.45; }
        }
        @keyframes holographic-rotation {
          0% { transform: rotateY(0deg) rotateX(12deg); }
          100% { transform: rotateY(360deg) rotateX(12deg); }
        }
        @keyframes radar-sweep {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        @keyframes scan-line {
          0% { transform: translateY(-100%); opacity: 0; }
          10%, 90% { opacity: 1; }
          100% { transform: translateY(100%); opacity: 0; }
        }
        @keyframes pulse-core {
          0%, 100% { transform: scale(1); opacity: 0.85; filter: blur(1px); }
          50% { transform: scale(1.08); opacity: 1; filter: blur(0px); }
        }
        @keyframes weather-data-swirl {
          0% { transform: rotate(0deg) scale(1); opacity: 0.35; }
          50% { transform: rotate(180deg) scale(1.05); opacity: 0.65; }
          100% { transform: rotate(360deg) scale(1); opacity: 0.35; }
        }
        @keyframes particle-rise {
          0% { transform: translateY(15px) translateX(0px); opacity: 0; }
          20% { opacity: 1; }
          80% { opacity: 0.8; }
          100% { transform: translateY(-100vh) translateX(var(--drift)); opacity: 0; }
        }
        @keyframes thunder-bolt {
          0%, 90%, 100% { opacity: 0; }
          92% { opacity: 1; }
          93% { opacity: 0.3; }
          94% { opacity: 1; }
        }
        @keyframes title-shimmer {
          0% { background-position: 200% center; }
          100% { background-position: -200% center; }
        }
        @keyframes telemetry-scan {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(200%); }
        }

        /* --- EFFECTS PER LA TIPOGRAFIA I ISOBARES --- */
        @keyframes wind-letter-wave {
          0%, 100% { transform: translateY(0px) rotateZ(0deg) scale(1); filter: drop-shadow(0 4px 12px rgba(56,189,248,0.3)); }
          33% { transform: translateY(-4px) rotateZ(-2deg) scale(1.03); filter: drop-shadow(0 8px 20px rgba(56,189,248,0.7)); }
          66% { transform: translateY(2px) rotateZ(1deg) scale(0.98); filter: drop-shadow(0 2px 10px rgba(129,140,248,0.4)); }
        }
        @keyframes isobar-spin-slow {
          0% { transform: rotate(0deg) scale(1); }
          50% { transform: rotate(180deg) scale(1.04); }
          100% { transform: rotate(360deg) scale(1); }
        }
        @keyframes isobar-spin-reverse {
          0% { transform: rotate(360deg) scale(1); }
          50% { transform: rotate(180deg) scale(0.96); }
          100% { transform: rotate(0deg) scale(1); }
        }
        @keyframes streamline-flow {
          to { stroke-dashoffset: -80; }
        }

        .perspective-lg { perspective: 2000px; }
        .preserve-3d { transform-style: preserve-3d; }
        .backface-hidden { backface-visibility: hidden; }

        .hologram-grid {
          background-image: 
            linear-gradient(rgba(56, 189, 248, 0.08) 1px, transparent 1px),
            linear-gradient(90deg, rgba(56, 189, 248, 0.08) 1px, transparent 1px);
          background-size: 24px 24px;
        }
        
        .glass-panel {
          background: linear-gradient(135deg, rgba(255, 255, 255, 0.06) 0%, rgba(255, 255, 255, 0.01) 100%);
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
          border: 1px solid rgba(255, 255, 255, 0.08);
          box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.45);
        }

        .glass-panel-interactive:hover {
          background: linear-gradient(135deg, rgba(255, 255, 255, 0.1) 0%, rgba(255, 255, 255, 0.03) 100%);
          border-color: rgba(56, 189, 248, 0.3);
        }

        .wind-char {
          display: inline-block;
          animation: wind-letter-wave 5s ease-in-out infinite;
          transition: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1), color 0.2s ease;
        }
        .wind-char:hover {
          transform: translateY(-8px) scale(1.15) rotateZ(4deg) !important;
          color: #38bdf8 !important;
          filter: drop-shadow(0 0 15px rgba(56,189,248,1)) !important;
          z-index: 20;
        }

        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>

      {/* 1. LAYER BASE: FONS ATMOSFÈRIC AMB AURORA */}
      <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(15,23,42,0)_0%,rgba(2,6,23,1)_95%)] z-10"></div>
        <div className="absolute -top-1/4 -left-1/4 w-full h-full bg-sky-600/15 rounded-full blur-[140px] mix-blend-screen animate-[aurora-shift_25s_ease-in-out_infinite]"></div>
        <div className="absolute -bottom-1/4 -right-1/4 w-full h-full bg-indigo-700/15 rounded-full blur-[140px] mix-blend-screen animate-[aurora-shift_30s_ease-in-out_infinite_reverse]"></div>

        {/* Partícules meteorològiques */}
        <div className="absolute inset-0 z-10">
          {particles.map((p, i) => (
            <div 
              key={i}
              className="absolute bg-sky-300 rounded-full"
              style={{
                left: p.left,
                top: p.top,
                width: p.size,
                height: p.size,
                opacity: 0,
                filter: `blur(${parseFloat(p.size) / 2}px)`,
                animation: `particle-rise ${p.duration} linear infinite`,
                animationDelay: p.delay,
                '--drift': p.drift
              } as React.CSSProperties}
            />
          ))}
        </div>
      </div>

      {/* 2. HUD CENTRAL - OPTIMITZAT MOBILE-FIRST */}
      <main className="relative z-30 flex-1 w-full max-w-screen-2xl mx-auto px-3 sm:px-4 md:px-8 py-6 md:py-8 lg:py-12 flex flex-col lg:flex-row items-center justify-center gap-6 sm:gap-10 lg:gap-16 no-scrollbar">
        
        {/* === HOLOGRAMA METEOROLÒGIC AVANÇAT AMB RADAR TÀCTIC === */}
        <div className="relative w-56 h-56 sm:w-72 sm:h-72 lg:w-[580px] lg:h-[580px] shrink-0 perspective-lg mt-2 lg:mt-0 flex items-center justify-center">
            
            <div className={`absolute inset-0 rounded-full blur-[70px] sm:blur-[90px] lg:blur-[130px] transition-colors duration-1000 ${loading ? 'bg-amber-600/35' : 'bg-sky-500/25'}`}></div>
            
            <div className="absolute w-[92%] h-[92%] preserve-3d animate-[holographic-rotation_45s_linear_infinite]">
                
                <div className="absolute inset-0 rounded-full hologram-grid border border-sky-400/20 bg-sky-950/15 backdrop-blur-sm transform rotateX(75deg) translateZ(-40px) backface-hidden"></div>

                {/* RADAR SVG IN-LINE */}
                <div className="absolute inset-4 rounded-full overflow-hidden transform rotateX(75deg) translateZ(-38px) pointer-events-none opacity-60">
                  <div className="w-full h-full animate-[radar-sweep_8s_linear_infinite] rounded-full bg-[conic-gradient(from_0deg,transparent_75%,rgba(56,189,248,0.4)_100%)]"></div>
                  <div className="absolute inset-0 border border-sky-400/20 rounded-full m-8"></div>
                  <div className="absolute inset-0 border border-sky-400/10 rounded-full m-16"></div>
                  <div className="absolute top-1/2 left-0 w-full h-[1px] bg-sky-400/20"></div>
                  <div className="absolute top-0 left-1/2 w-[1px] h-full bg-sky-400/20"></div>
                </div>

                {/* Nucli Atmosfèric Pulsant */}
                <div className="absolute inset-[20%] rounded-full preserve-3d animate-[pulse-core_5s_ease-in-out_infinite] backface-hidden" style={{ transform: 'translateZ(45px)' }}>
                   <div className={`absolute inset-0 rounded-full blur-md ${loading ? 'bg-amber-500/50' : 'bg-sky-300/40'}`}></div>
                   <div className="absolute inset-2 rounded-full bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.9)_0%,rgba(56,189,248,0.25)_70%,transparent_100%)]"></div>
                   
                   <div className="absolute inset-0 flex items-center justify-center">
                    {loading ? (
                      <Zap className="w-1/3 h-1/3 text-amber-200 animate-[thunder-bolt_3s_linear_infinite]" strokeWidth={1.5} />
                    ) : (
                      <CloudLightning className="w-1/3 h-1/3 text-white drop-shadow-[0_0_15px_rgba(255,255,255,0.9)]" strokeWidth={1.2} />
                    )}
                   </div>
                </div>

                {/* Anells de Dades Orbitant */}
                <div className="absolute inset-0 preserve-3d backface-hidden" style={{ transform: 'translateZ(15px)' }}>
                  <div className="absolute inset-0 border-[2px] border-sky-400/20 rounded-[45%_55%_60%_40%_/_45%_45%_55%_55%] animate-[weather-data-swirl_25s_linear_infinite]"></div>
                  <div className="absolute inset-2 border border-indigo-400/20 rounded-[60%_40%_35%_65%_/_50%_60%_40%_50%] animate-[weather-data-swirl_20s_linear_infinite_reverse]"></div>
                </div>

                {/* Elements Orbitant Tàctics (100% Purs segons regles de React) */}
                {orbitingSensors.map(({ Icon, color, angle, label, width }, i) => (
                  <div 
                    key={i}
                    className="absolute inset-0 preserve-3d"
                    style={{ transform: `rotateY(${angle}deg) translateZ(135px) scale(0.85)` }}
                  >
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-1 p-2 sm:p-2.5 glass-panel rounded-lg transform rotateY(${-angle}deg) backface-hidden border-sky-400/30">
                      <Icon className={`w-4 h-4 sm:w-5 sm:h-5 lg:w-7 lg:h-7 ${color} animate-pulse`} />
                      <span className="text-[8px] lg:text-[10px] font-mono tracking-wider font-bold text-slate-300">{label}</span>
                      <div className={`w-8 h-0.5 lg:w-10 lg:h-1 ${loading ? 'bg-amber-500/40' : 'bg-sky-400/35'} rounded-full overflow-hidden mt-0.5`}>
                        <div className={`h-full ${loading ? 'bg-amber-400' : 'bg-sky-300'}`} style={{ width }}></div>
                      </div>
                    </div>
                  </div>
                ))}

                {/* Línia d'Escaneig Làser Vertical */}
                <div className="absolute inset-y-0 left-1/2 w-[1.5px] lg:w-[2px] overflow-hidden" style={{ transform: 'translateZ(80px) translateX(-50%)' }}>
                    <div className="w-full h-full bg-gradient-to-b from-transparent via-sky-300/70 to-transparent animate-[scan-line_3.5s_linear_infinite]"></div>
                </div>

            </div>
        </div>

        {/* === PANELL DE COMANDAMENTS AMB TIPOGRAFIA EÒLICA & ISOBARES === */}
        <div className="flex flex-col items-center lg:items-start text-center lg:text-left w-full max-w-sm sm:max-w-md lg:max-w-xl shrink-0 my-auto pb-4 lg:pb-0 z-30 gap-3 sm:gap-4 lg:gap-5">
            
            {/* Status Badges Premium */}
            <div className="flex flex-wrap justify-center lg:justify-start gap-2 sm:gap-2.5">
                <div className="flex items-center gap-2 px-3 py-1 rounded-full glass-panel text-[9px] sm:text-xs font-bold text-emerald-300 tracking-widest uppercase border-emerald-500/30 bg-emerald-950/20">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,1)]"></span>
                    </span>
                    {systemText.aiEngine}
                </div>
                <div className="flex items-center gap-2 px-3 py-1 rounded-full glass-panel text-[9px] sm:text-xs font-bold text-sky-200 tracking-widest uppercase border-sky-500/20">
                    <Satellite className="w-3.5 h-3.5 text-sky-400 animate-spin" style={{ animationDuration: '20s' }} />
                    {systemText.modelLink}
                </div>
            </div>

            {/* TICKER DE STANDBY (Zero Dades Falses) */}
            <div className="flex items-center gap-2 px-3 py-1 rounded-lg bg-sky-950/40 border border-sky-500/30 text-[10px] sm:text-xs font-mono font-bold text-sky-200 shadow-[0_0_15px_rgba(56,189,248,0.15)]">
                <Radio className="w-3.5 h-3.5 text-sky-400 shrink-0 animate-pulse" />
                <span>{systemText.baroTrend}</span>
            </div>
            
            {/* ==============================================================
                ESPECTACLE VISUAL: CAMP D'ISOBARES SVG + TIPOGRAFIA EÒLICA
                ============================================================== */}
            <div className="relative w-full flex flex-col items-center lg:items-start my-1 sm:my-2">
              
              {/* 1. CAMP D'ISOBARES TOPOGRÀFIQUES (SVG IN-LINE DECORATIU) */}
              <div className="absolute -inset-8 sm:-inset-12 pointer-events-none flex items-center justify-center opacity-30 lg:justify-start lg:-left-12 z-0 overflow-hidden">
                <svg className="w-full h-full max-w-[400px] max-h-[220px]" viewBox="0 0 400 200" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <ellipse cx="200" cy="100" rx="180" ry="70" className="animate-[isobar-spin-slow_35s_linear_infinite] origin-center" stroke="#38bdf8" strokeWidth="1" strokeDasharray="6 4" strokeOpacity="0.4" />
                  <ellipse cx="190" cy="98" rx="130" ry="50" className="animate-[isobar-spin-reverse_25s_linear_infinite] origin-center" stroke="#818cf8" strokeWidth="1.5" strokeDasharray="20 10" strokeDashoffset="0" style={{ animation: 'streamline-flow 10s linear infinite, isobar-spin-reverse 25s linear infinite' }} strokeOpacity="0.5" />
                  <ellipse cx="180" cy="95" rx="70" ry="28" className="animate-[isobar-spin-slow_15s_linear_infinite] origin-center" stroke="#38bdf8" strokeWidth="1.5" strokeOpacity="0.6" />
                </svg>
              </div>

              {/* 2. TIPOGRAFIA EÒLICA ANIMADA ("METEO TONI AI") */}
              <h1 className="relative z-10 text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-black tracking-tight lg:tracking-tighter flex flex-wrap justify-center lg:justify-start leading-none drop-shadow-[0_4px_20px_rgba(56,189,248,0.35)]">
                {titleWords.map((wordObj, wordIdx) => (
                  <span 
                    key={wordIdx} 
                    className="inline-flex whitespace-nowrap mr-2.5 sm:mr-3.5 mb-1 cursor-default"
                  >
                    {wordObj.text.split("").map((char, charIdx) => {
                      const totalIdx = wordIdx * 5 + charIdx;
                      return (
                        <span
                          key={charIdx}
                          className={`wind-char text-transparent bg-clip-text bg-gradient-to-b ${wordObj.colorClass} bg-[length:200%_auto] animate-[title-shimmer_6s_linear_infinite]`}
                          style={{ 
                            animationDelay: `${totalIdx * 0.15}s`,
                            paddingRight: charIdx === wordObj.text.length - 1 ? '0px' : '1px'
                          } as React.CSSProperties}
                        >
                          {char}
                        </span>
                      );
                    })}
                  </span>
                ))}
              </h1>

            </div>

            {/* Tagline i Micro-Dashboard Tàctic en STANDBY REAL (Sense inventar dades) */}
            <div className="w-full flex flex-col gap-2 relative z-10">
              <div className="inline-flex items-center justify-center lg:justify-start gap-2 px-3.5 py-1.5 sm:px-4 sm:py-2 rounded-xl glass-panel text-[9px] sm:text-xs font-bold tracking-[0.15em] sm:tracking-[0.2em] text-sky-100 uppercase border border-sky-500/20 shadow-[0_0_10px_rgba(56,189,248,0.1)]">
                  <Activity className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-sky-400 animate-pulse shrink-0" />
                  <span>{systemText.tagline}</span>
              </div>

              {/* BARRA DE TELEMETRIA EN ESPERA DE SENYAL (Efecte Escaneig Làser) */}
              <div className="grid grid-cols-2 gap-2 p-2 rounded-xl glass-panel text-[10px] sm:text-xs font-mono border-white/10 bg-black/40">
                
                {/* Canal WRF Standby */}
                <div className="flex flex-col gap-1 text-left border-r border-white/10 pr-2">
                  <div className="flex justify-between text-slate-400 text-[9px]">
                    <span>{systemText.modelWrf}</span>
                    <span className="text-sky-400 font-bold">{formatWind(wrfMaxWind)}</span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-800/80 rounded-full overflow-hidden relative">
                    <div className="absolute inset-0 w-1/2 bg-gradient-to-r from-transparent via-sky-400/50 to-transparent animate-[telemetry-scan_2s_ease-in-out_infinite]"></div>
                  </div>
                </div>

                {/* Canal AROME Standby */}
                <div className="flex flex-col gap-1 text-left pl-1">
                  <div className="flex justify-between text-slate-400 text-[9px]">
                    <span>{systemText.modelArome}</span>
                    <span className="text-emerald-400 font-bold">{formatWind(aromeMaxWind)}</span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-800/80 rounded-full overflow-hidden relative">
                    <div className="absolute inset-0 w-1/2 bg-gradient-to-r from-transparent via-emerald-400/50 to-transparent animate-[telemetry-scan_2s_ease-in-out_infinite_0.5s]"></div>
                  </div>
                </div>

              </div>
            </div>
            
            {/* Descripció Rica */}
            <p className="text-xs sm:text-sm md:text-base text-slate-300 font-light leading-relaxed max-w-[310px] sm:max-w-md lg:max-w-lg relative z-10">
                {systemText.desc}
            </p>

            {/* ACCIONS PRINCIPALS */}
            <div className="w-full flex flex-col gap-3 sm:gap-4 lg:gap-5 shrink-0 mt-1 relative z-10">
                
                {/* BOTÓ D'INICI */}
                <button 
                    type="button"
                    onClick={onLocate}
                    disabled={loading}
                    className={`group relative w-full py-3.5 sm:py-4 lg:py-5 transition-all duration-500 overflow-hidden flex items-center justify-center rounded-xl sm:rounded-2xl glass-panel border
                    ${loading 
                        ? 'cursor-wait shadow-[0_0_35px_rgba(245,158,11,0.25)] border-amber-500/40 bg-amber-950/20' 
                        : 'hover:bg-sky-950/30 border-sky-400/40 hover:border-sky-300 hover:shadow-[0_15px_40px_rgba(56,189,248,0.35)] active:scale-[0.98] cursor-pointer'}`}
                >
                    {loading && (
                      <div className="absolute inset-0 bg-gradient-to-r from-amber-500/0 via-amber-400/25 to-amber-500/0 w-[200%] animate-[title-shimmer_2s_linear_infinite]"></div>
                    )}
                    
                    <div className="relative flex items-center gap-2.5 sm:gap-3">
                        {loading ? (
                            <>
                                <Loader2 className="w-5 h-5 sm:w-6 sm:h-6 text-amber-300 animate-spin drop-shadow-[0_0_8px_rgba(245,158,11,0.8)]" />
                                <span className="font-sans font-bold tracking-widest text-xs sm:text-base text-amber-200 uppercase drop-shadow-md">{systemText.loading}</span>
                            </>
                        ) : (
                            <>
                                <MapPin className="w-5 h-5 sm:w-6 sm:h-6 text-sky-200 group-hover:-translate-y-1 transition-transform duration-300 drop-shadow-[0_0_10px_rgba(125,211,252,0.9)]" />
                                <span className="font-sans font-black tracking-[0.2em] sm:tracking-[0.25em] text-sm sm:text-lg lg:text-xl text-white uppercase drop-shadow-lg">
                                    {systemText.start}
                                </span>
                            </>
                        )}
                    </div>
                </button>

                {/* Sub-controls: Obertura de Modal Pedagògic i Selector d'Idiomes */}
                <div className="flex flex-row items-center justify-between gap-2 w-full px-1 sm:px-2">
                    
                    <button 
                        type="button"
                        onClick={openDiagnosticsModal}
                        className="flex items-center gap-1.5 group opacity-85 hover:opacity-100 transition-all cursor-pointer px-2.5 py-1.5 rounded-lg glass-panel glass-panel-interactive border-white/10"
                    >
                        <HelpCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-sky-400 group-hover:scale-110 transition-transform" />
                        <span className="text-[9px] sm:text-xs font-semibold text-slate-200 uppercase tracking-widest whitespace-nowrap">
                            {systemText.manual}
                        </span>
                    </button>

                    <div className="flex gap-0.5 sm:gap-1 p-0.5 sm:p-1 rounded-full glass-panel shrink-0 border border-white/10">
                        {(['ca', 'es', 'en', 'fr'] as Language[]).map((l) => (
                            <button
                                key={l}
                                type="button"
                                disabled={loading}
                                onClick={() => setLang(l)}
                                className={`
                                    px-2.5 py-1 sm:px-3.5 sm:py-1.5 font-sans text-[9px] sm:text-xs font-bold uppercase transition-all duration-300 rounded-full
                                    ${lang === l 
                                        ? 'bg-sky-500 text-white shadow-[0_0_15px_rgba(56,189,248,0.6)]' 
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

      {/* =========================================
          3. MODAL PEDAGÒGIC EN STANDBY (MODULAR)
          ========================================= */}
      {showDiagnostics && (
        <DiagnosticsModal
          onClose={closeDiagnosticsModal}
          texts={modalTexts}
          wrfWindFormatted={formatWind(wrfMaxWind)}
          aromeWindFormatted={formatWind(aromeMaxWind)}
        />
      )}

      {/* 4. FOOTER TELEMÈTRIC COMPACTE I ADAPTATIU */}
      <footer className="relative w-full glass-panel border-t border-white/10 px-3 py-3 sm:px-6 sm:py-4 flex items-center justify-between gap-4 z-40 shrink-0 overflow-x-auto no-scrollbar bg-black/60 mt-auto">
          
          <div className="flex items-center gap-3 sm:gap-5 shrink-0">
              <div className="flex items-center gap-2">
                  <div className="relative flex items-center justify-center">
                    <div className="absolute w-2.5 h-2.5 sm:w-3.5 sm:h-3.5 rounded-full bg-emerald-400 animate-ping opacity-60"></div>
                    <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,1)]"></div>
                  </div>
                  <span className="text-[9px] sm:text-xs font-bold text-emerald-200 tracking-widest whitespace-nowrap uppercase">
                      {systemText.systemStatus}
                  </span>
              </div>
              <div className="hidden sm:flex items-center gap-2 text-[9px] sm:text-xs font-medium text-slate-400 border-l border-white/15 pl-3 sm:pl-5">
                  <Activity className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-sky-400" /> {systemText.analysis}
              </div>
          </div>

          <div className="flex items-center gap-3 sm:gap-5 shrink-0">
              <div className="hidden md:flex items-center gap-1.5 sm:gap-2 text-[9px] sm:text-xs font-medium text-slate-400">
                  <Globe className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-500" /> SAT: METEOSAT-11
              </div>
              <div className="hidden xs:flex items-center gap-1.5 sm:gap-2 text-[9px] sm:text-xs font-medium text-slate-400">
                  <ShieldCheck className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-400/80" /> {systemText.secure}
              </div>
              <div className="flex items-center gap-1.5 text-[9px] sm:text-xs font-black text-sky-100 tracking-widest whitespace-nowrap bg-sky-950/60 px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-full border border-sky-500/20 shadow-inner">
                  <span>© {year} MT-AI</span>
                  <span className="text-[8px] sm:text-[10px] opacity-70">v{safeVersion}</span>
              </div>
          </div>
      </footer>
    </div>
  );
}