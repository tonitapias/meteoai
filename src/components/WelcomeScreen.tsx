// src/components/WelcomeScreen.tsx
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { 
  Loader2, CloudRain, Wind, 
  ShieldCheck, CloudLightning, ThermometerSun,
  HelpCircle, Crosshair, Sun, Fingerprint, AlertTriangle
} from 'lucide-react';
import { Language, TranslationType } from '../translations';
import pkg from '../../package.json';
import DiagnosticsModal from './DiagnosticsModal';

interface WelcomeScreenProps {
  lang: Language;
  setLang: (lang: Language) => void;
  t: TranslationType;
  onLocate: () => void;
  loading: boolean;
}

// Interfícies estrictes per a telemetria atmosfèrica
interface Particle { id: number; left: string; top: string; size: string; duration: string; delay: string; drift: string; }
interface Drop { id: number; left: string; delay: string; z: string; }
interface Cloud { id: number; y: string; delay: string; z: string; }

/**
 * METEOTONI AI - TACTICAL ATMOSPHERIC OPERATING SYSTEM (v8.60 ZERO-RISK UPDATE)
 * Arquitectura: Spatial UI, Modal Desacoblat i18n, Puresa React garantida.
 * Holograma v8.2: Billboard Optics & GPU Acceleration.
 * UI v8.60 Update: GPU-accelerated Hold-to-Arm, onTouchCancel guard, Keyboard Parity, ARIA labels.
 */
export default function WelcomeScreen({ lang, setLang, t, onLocate, loading }: WelcomeScreenProps) {
  const year = new Date().getFullYear();

  // DOCTRINA RISC ZERO: Tipatge estricte
  const tRecord = (t && typeof t === 'object') ? (t as Record<string, unknown>) : {};
  const tWelcome = (tRecord.welcome && typeof tRecord.welcome === 'object') ? (tRecord.welcome as Record<string, string>) : {};
  const safeVersion = pkg && pkg.version ? pkg.version : '6.2.0-PRO';

  // DICCIONARI MULTILINGÜE ESTRICTE
  const systemText = {
    loading: tWelcome.loading || (lang === 'es' ? "SINTETIZANDO ATMÓSFERA..." : lang === 'en' ? "SYNTHESIZING ATMOSPHERE..." : lang === 'fr' ? "SYNTHÈSE ATMOSPHÉRIQUE..." : "SINTETITZANT ATMOSFERA..."),
    tagline: tWelcome.tagline || (lang === 'es' ? "TELEMETRÍA TÁCTICA PARA TERRENO TÉCNICO" : lang === 'en' ? "TACTICAL TELEMETRY FOR TECHNICAL TERRAIN" : lang === 'fr' ? "TÉLÉMÉTRIE TACTIQUE POUR TERRAIN TECHNIQUE" : "TELEMETRIA TÀCTICA PER A TERRENY TÈCNIC"),
    start: tWelcome.start || (lang === 'es' ? "DESPLEGAR SENSORES" : lang === 'en' ? "DEPLOY SENSORS" : lang === 'fr' ? "DÉPLOYER CAPTEURS" : "DESPLEGAR SENSORS"),
    manual: tWelcome.manual || (lang === 'es' ? "MANUAL IA" : lang === 'en' ? "AI MANUAL" : lang === 'fr' ? "MANUEL IA" : "MANUAL IA"),
    systemStatus: tWelcome.systemStatus || (lang === 'es' ? "SISTEMA ÓPTIMO" : lang === 'en' ? "SYSTEM OPTIMAL" : lang === 'fr' ? "SYSTÈME OPTIMAL" : "SISTEMA ÒPTIM"),
    secure: tWelcome.secure || (lang === 'es' ? "CONEXIÓN SEGURA" : lang === 'en' ? "SECURE CONNECTION" : lang === 'fr' ? "CONNEXION SÉCURISÉE" : "CONNEXIÓ SEGURA"),
    modelArome: tWelcome.modelArome || (lang === 'es' ? "AROME HD (COBERTURA TÁCTICA)" : lang === 'en' ? "AROME HD (TACTICAL COVERAGE)" : lang === 'fr' ? "AROME HD (COUVERTURE TACTIQUE)" : "AROME HD (COBERTURA TÀCTICA)"),
    modelFallback: tWelcome.modelFallback || (lang === 'es' ? "MULTI-MODELO GLOBAL" : lang === 'en' ? "GLOBAL MULTI-MODEL" : lang === 'fr' ? "MULTI-MODÈLE GLOBAL" : "MULTI-MODEL GLOBAL"),
    sysActive: tWelcome.sysActive || (lang === 'es' ? "[ PRIORIDAD ]" : lang === 'en' ? "[ PRIORITY ]" : lang === 'fr' ? "[ PRIORITÉ ]" : "[ PRIORITAT ]"),
    sysAuto: tWelcome.sysAuto || (lang === 'es' ? "[ AUTO-SWITCH ]" : lang === 'en' ? "[ AUTO-SWITCH ]" : lang === 'fr' ? "[ AUTO-SWITCH ]" : "[ AUTO-SWITCH ]"),
    
    // Noves cadenes Hold-to-Arm 
    tapWarning: lang === 'es' ? "⚠️ ¡MANTÉN PULSADO!" : lang === 'en' ? "⚠️ HOLD TO ARM!" : lang === 'fr' ? "⚠️ MAINTENEZ APPUYÉ !" : "⚠️ MANTÉN PREMUT!",
    deployed: lang === 'es' ? "[ SENSORES DESPLEGADOS ]" : lang === 'en' ? "[ SENSORS DEPLOYED ]" : lang === 'fr' ? "[ CAPTEURS DÉPLOYÉS ]" : "[ SENSORS DESPLEGATS ]",
    ariaDescription: lang === 'es' ? "Botón de arranque táctico. Requiere mantener pulsado 1.5 segundos." : lang === 'en' ? "Tactical deployment button. Requires holding for 1.5 seconds." : lang === 'fr' ? "Bouton de démarrage tactique. Nécessite de maintenir appuyé 1,5 secondes." : "Botó d'arrencada tàctica. Requereix mantenir premut 1.5 segons.",
  };

  const [showDiagnostics, setShowDiagnostics] = useState(false);

  const closeDiagnosticsModal = useCallback(() => {
    if (typeof window !== 'undefined' && window.history.state?.modal === 'meteo_diagnostics') {
      window.history.back();
    } else {
      setShowDiagnostics(false);
    }
  }, []);

  const openDiagnosticsModal = () => {
    if (typeof window !== 'undefined') {
      window.history.pushState({ modal: 'meteo_diagnostics' }, '');
      setShowDiagnostics(true);
    }
  };

  useEffect(() => {
    const handlePopState = () => { if (showDiagnostics) setShowDiagnostics(false); };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [showDiagnostics]);

  // ESTATS PURS DINS DE COORDENADES FIXES
  const [particles, setParticles] = useState<Particle[]>([]);
  const [precipDrops, setPrecipDrops] = useState<Drop[]>([]);
  const [clouds, setClouds] = useState<Cloud[]>([]);
  const [isMounted, setIsMounted] = useState(false);
  
  // Cicle Atmosfèric Dinàmic
  const [weatherPhase, setWeatherPhase] = useState<'storm' | 'sun'>('storm');
  const isStorm = weatherPhase === 'storm';

  // =========================================================================
  // SISTEMA D'ENGEGADA TÀCTICA (GPU ACCELERATED HOLD-TO-BOOT)
  // =========================================================================
  const [isHolding, setIsHolding] = useState(false);
  const [tapWarning, setTapWarning] = useState(false);
  const [isArmed, setIsArmed] = useState(false);
  
  // Refs per manipular el DOM directament evitant 60 re-renders de React per segon
  const progressBarRef = useRef<HTMLDivElement>(null);
  const progressTextRef = useRef<HTMLSpanElement>(null);
  const animationFrameRef = useRef<number | null>(null);
  const warningTimerRef = useRef<number | null>(null);
  
  const startTimeRef = useRef<number>(0);
  const HOLD_DURATION = 1500; // 1.5 segons de retenció exigida

  const startHold = useCallback((e?: React.SyntheticEvent | Event) => {
    if (loading || isArmed) return;
    
    // Evitem menús i text-selection en dispositius mòbils, bloqueig de botó dret al PC
    if (e && 'touches' in e && e.cancelable) e.preventDefault(); 
    if (e && 'button' in e && (e as React.MouseEvent).button !== 0) return; 
    
    // Motor tàptic: Confirmació inicial
    if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(15);

    setIsHolding(true);
    setTapWarning(false);
    startTimeRef.current = Date.now();

    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    if (warningTimerRef.current) window.clearTimeout(warningTimerRef.current);

    // Bucle d'animació per GPU
    const animate = () => {
      const elapsed = Date.now() - startTimeRef.current;
      const progress = Math.min((elapsed / HOLD_DURATION) * 100, 100);

      // Mutacions directes al DOM (Estalvi de Bateria extrem)
      if (progressBarRef.current) {
        progressBarRef.current.style.width = `${progress}%`;
      }
      if (progressTextRef.current) {
        progressTextRef.current.innerText = Math.floor(progress).toString();
      }

      // Micro-batecs tàptics espaiats per evitar col·lapse de l'API de vibració
      if (progress % 25 < 1.5 && progress > 5 && progress < 95) {
        if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(10);
      }

      // Èxit total
      if (progress >= 100) {
        setIsHolding(false);
        setIsArmed(true); 
        
        // Patró vibració èxit i salt de pantalla
        if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate([100, 50, 100]);
        setTimeout(() => { onLocate(); }, 600);
      } else {
        // Continuar el bucle a 60fps
        animationFrameRef.current = requestAnimationFrame(animate);
      }
    };

    // Reseteig inicial de la barra abans de començar el cicle visual
    if (progressBarRef.current) progressBarRef.current.style.width = '0%';
    if (progressTextRef.current) progressTextRef.current.innerText = '0';
    
    animationFrameRef.current = requestAnimationFrame(animate);
  }, [loading, isArmed, onLocate]);

  const cancelHold = useCallback(() => {
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    if (isArmed) return;

    const elapsed = Date.now() - startTimeRef.current;
    setIsHolding(false);

    // Sistema Educatiu "Anti-Tap": si deixen anar ràpid (<350ms) salta l'error
    if (elapsed > 0 && elapsed < 350) {
      setTapWarning(true);
      // Vibració seca d'error
      if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate([40, 40, 40]);
      
      warningTimerRef.current = window.setTimeout(() => {
        setTapWarning(false);
      }, 1500); 
    }
  }, [isArmed]);

  // Gestió d'accessibilitat: Suport de Teclat per a PC (Paritat de plataformes)
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === ' ' || e.key === 'Enter') {
      if (!e.repeat) startHold(e); // El preventDefault evitarà fer scroll amb l'Espai
      e.preventDefault();
    }
  }, [startHold]);

  const handleKeyUp = useCallback((e: React.KeyboardEvent) => {
    if (e.key === ' ' || e.key === 'Enter') {
      cancelHold();
    }
  }, [cancelHold]);

  useEffect(() => {
    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      if (warningTimerRef.current) window.clearTimeout(warningTimerRef.current);
    };
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsMounted(true);
      const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
      
      setParticles(Array.from({ length: isMobile ? 12 : 30 }).map((_, i) => ({
        id: i, left: `${Math.random() * 100}%`, top: `${Math.random() * 100}%`,
        size: `${Math.random() * 2 + 1}px`, duration: `${5 + Math.random() * 15}s`,
        delay: `-${Math.random() * 15}s`, drift: `${(Math.random() - 0.5) * 80}px`
      })));

      setPrecipDrops(Array.from({ length: isMobile ? 15 : 40 }).map((_, i) => ({
        id: i,
        left: `${Math.random() * 140 + 10}px`,
        delay: `-${Math.random() * 5}s`,
        z: `${Math.random() * 140 - 70}px`
      })));

      setClouds(Array.from({ length: isMobile ? 3 : 8 }).map((_, i) => ({
        id: i,
        y: `${Math.random() * 120 + 20}px`,
        delay: `-${Math.random() * 15}s`,
        z: `${Math.random() * 140 - 70}px`
      })));
    }, 0);

    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setWeatherPhase(prev => prev === 'storm' ? 'sun' : 'storm');
    }, 8000);
    return () => clearInterval(interval);
  }, []);

  const orbitingSensors = useMemo(() => [
    { Icon: CloudRain, color: 'text-sky-300', angle: 0, label: 'PRECIP', width: '75%', val: '0.0 mm' },
    { Icon: Wind, color: 'text-indigo-300', angle: 120, label: 'WIND', width: '65%', val: 'KNOTS' },
    { Icon: ThermometerSun, color: 'text-amber-300', angle: 240, label: 'TEMP', width: '85%', val: 'SYNC' }
  ], []);

  return (
    <div className={`relative w-full min-h-dvh overflow-x-hidden bg-[#020617] select-none font-sans text-slate-200 antialiased flex flex-col ${showDiagnostics ? 'overflow-hidden' : 'overflow-y-auto'}`}>
      
      <style>{`
        @keyframes aurora-shift {
          0% { transform: translateX(-5%) translateY(-5%) scale(1); filter: hue-rotate(0deg); opacity: 0.2; }
          50% { transform: translateX(5%) translateY(5%) scale(1.1); filter: hue-rotate(15deg); opacity: 0.4; }
          100% { transform: translateX(-5%) translateY(-5%) scale(1); filter: hue-rotate(0deg); opacity: 0.2; }
        }
        @keyframes turntable-spin { from { transform: rotateY(0deg); } to { transform: rotateY(360deg); } }
        @keyframes ring-spin-x { from { transform: rotateX(60deg) rotateY(0deg) rotateZ(0deg); } to { transform: rotateX(60deg) rotateY(360deg) rotateZ(360deg); } }
        @keyframes ring-spin-y { from { transform: rotateX(120deg) rotateY(0deg) rotateZ(0deg); } to { transform: rotateX(120deg) rotateY(-360deg) rotateZ(180deg); } }
        @keyframes cube-spin { from { transform: rotateY(0deg); } to { transform: rotateY(-360deg); } }
        @keyframes radar-sweep { from { transform: rotateZ(0deg); } to { transform: rotateZ(360deg); } }
        @keyframes plasma-pulse { 0%, 100% { opacity: 0.5; } 50% { opacity: 1; } }
        @keyframes particle-rise {
          0% { transform: translateY(20px) translateX(0px); opacity: 0; }
          20% { opacity: 1; }
          80% { opacity: 0.8; }
          100% { transform: translateY(-100vh) translateX(var(--drift)); opacity: 0; }
        }
        @keyframes precip-drop {
          0% { transform: translateY(0px) translateZ(var(--z)); opacity: 0; }
          10%, 80% { opacity: 0.8; }
          100% { transform: translateY(260px) translateZ(var(--z)); opacity: 0; }
        }
        @keyframes cloud-pan {
          0% { transform: translateX(200px) translateY(var(--y)) translateZ(var(--z)); opacity: 0; }
          15%, 85% { opacity: 0.5; }
          100% { transform: translateX(-80px) translateY(var(--y)) translateZ(var(--z)); opacity: 0; }
        }
        @keyframes float-hologram { 0%, 100% { transform: translateY(0px); } 50% { transform: translateY(-15px); } }
        
        /* NOVES ANIMACIONS BOTÓ V2 (Amber/Error/Flash) */
        @keyframes scan-shimmer-amber {
          0% { transform: translateX(-150%) skewX(-20deg); }
          100% { transform: translateX(250%) skewX(-20deg); }
        }
        @keyframes button-error-shake {
          0%, 100% { transform: translateX(0); }
          20% { transform: translateX(-8px); }
          40% { transform: translateX(8px); }
          60% { transform: translateX(-6px); }
          80% { transform: translateX(6px); }
        }
        @keyframes ghost-tease-pulse {
          0%, 80%, 100% { width: 0%; opacity: 0; }
          85% { opacity: 0.3; }
          90% { width: 15%; opacity: 0.1; }
        }
        @keyframes tactical-flashbang {
          0% { opacity: 1; transform: scale(1); filter: brightness(3); }
          100% { opacity: 0; transform: scale(1.05); filter: brightness(1); }
        }

        .perspective-xl { perspective: 2000px; }
        .preserve-3d { transform-style: preserve-3d; }
        .backface-hidden { backface-visibility: hidden; -webkit-backface-visibility: hidden; }
        
        .glass-panel-tactical {
          background: linear-gradient(145deg, rgba(15, 23, 42, 0.7) 0%, rgba(2, 6, 23, 0.9) 100%);
          backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px);
          border: 1px solid rgba(255, 255, 255, 0.08);
          box-shadow: 0 15px 40px -10px rgba(0, 0, 0, 0.8), inset 0 1px 0 rgba(255,255,255,0.1);
        }
        .glass-panel-interactive {
          background: linear-gradient(135deg, rgba(255, 255, 255, 0.05) 0%, rgba(255, 255, 255, 0.01) 100%);
          backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);
          border: 1px solid rgba(255, 255, 255, 0.08);
          transition: all 0.2s ease-out;
        }
        .glass-panel-interactive:active { background: rgba(56, 189, 248, 0.1); }
        
        @media (min-width: 1024px) {
          .glass-panel-interactive:hover {
            background: linear-gradient(135deg, rgba(255, 255, 255, 0.1) 0%, rgba(255, 255, 255, 0.03) 100%);
            border-color: rgba(56, 189, 248, 0.5); transform: translateY(-1px);
          }
        }
        .glitch-overlay::before {
          content: ""; position: absolute; inset: 0; pointer-events: none;
          background: repeating-linear-gradient(transparent 0, transparent 2px, rgba(56, 189, 248, 0.05) 2px, rgba(56, 189, 248, 0.05) 4px);
          mix-blend-mode: overlay; z-index: 50; opacity: 0.3; border-radius: 1.5rem;
        }
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        
        /* Zona interactiva tàctica: bloqueja absolutament seleccions, menús iOS/Android i crides touch predeterminades */
        .tactical-btn-zone { touch-action: none; -webkit-touch-callout: none; user-select: none; -webkit-user-select: none; outline: none; }
      `}</style>

      {/* FONS ATMOSFÈRIC */}
      <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden bg-[#020617]">
        <div className="absolute -top-[30%] -left-[20%] w-[120%] h-[120%] bg-sky-500/10 lg:bg-sky-500/5 rounded-full blur-[80px] lg:blur-[120px] mix-blend-screen animate-[aurora-shift_30s_ease-in-out_infinite]"></div>
        <div className="absolute -bottom-[30%] -right-[20%] w-[120%] h-[120%] bg-indigo-600/10 lg:bg-indigo-600/5 rounded-full blur-[80px] lg:blur-[120px] mix-blend-screen animate-[aurora-shift_35s_ease-in-out_infinite_reverse]"></div>

        <div className="absolute inset-0 z-10 preserve-3d">
          {isMounted && particles.map((p) => (
            <div key={p.id} className="absolute bg-sky-200 rounded-full"
              style={{ left: p.left, top: p.top, width: p.size, height: p.size, opacity: 0,
                filter: `blur(${parseFloat(p.size) / 2}px)`, animation: `particle-rise ${p.duration} linear infinite`, animationDelay: p.delay, '--drift': p.drift } as React.CSSProperties} />
          ))}
        </div>
      </div>

      <main className="relative z-30 flex-1 w-full max-w-[1400px] mx-auto px-5 sm:px-8 lg:px-16 xl:px-24 py-6 sm:py-12 flex flex-col lg:flex-row items-center justify-center lg:justify-between gap-6 lg:gap-8 xl:gap-12 no-scrollbar">
        
        {/* =========================================================================
            HOLOGRAMA V8.2 (BILLBOARD OPTICS)
            ========================================================================= */}
        <div className={`relative w-full max-w-[280px] sm:max-w-[420px] lg:max-w-[480px] xl:max-w-[540px] aspect-square shrink-0 items-center justify-center perspective-xl animate-[float-hologram_10s_ease-in-out_infinite] preserve-3d ${showDiagnostics ? 'hidden lg:flex' : 'flex'}`}>
            <div className={`absolute inset-0 rounded-full blur-[80px] lg:blur-[120px] transition-colors duration-[3000ms] opacity-50 ${isStorm ? 'bg-sky-500/40' : 'bg-amber-600/40'}`}></div>
            <div className="absolute w-[400px] h-[400px] preserve-3d transform scale-[0.65] sm:scale-100 lg:scale-[1.1] xl:scale-[1.2]">
                <div className="absolute inset-0 preserve-3d" style={{ transform: 'rotateX(20deg) translateY(-30px)' }}>
                    <div className="absolute inset-0 preserve-3d animate-[turntable-spin_60s_linear_infinite]">
                        
                        {/* TERRENY CARTOGRÀFIC */}
                        <div className="absolute w-[360px] h-[360px] left-[20px] top-[180px] preserve-3d" style={{ transform: 'rotateX(90deg)' }}>
                            <div className="absolute inset-[-20%] blur-[40px] rounded-full transition-colors duration-[3000ms] bg-sky-500/10"></div>
                            <div className="absolute inset-0 rounded-full bg-slate-950/95 border border-sky-800/80 preserve-3d" style={{ transform: 'translateZ(-20px)' }}></div>
                            {[...Array(6)].map((_, i) => (
                                <div key={i} className="absolute inset-0 rounded-full border border-sky-400/15 preserve-3d" style={{ transform: `translateZ(${-20 + i*3}px)` }}></div>
                            ))}
                            <div className={`absolute inset-0 rounded-full border-[2px] lg:border-[3px] bg-gradient-to-br from-slate-900/90 via-sky-950/70 to-slate-900/90 preserve-3d overflow-hidden transition-all duration-[3000ms] ${isStorm ? 'border-sky-400/50 shadow-[inset_0_0_30px_rgba(56,189,248,0.4)]' : 'border-amber-400/50 shadow-[inset_0_0_30px_rgba(251,191,36,0.3)]'}`} style={{ transform: 'translateZ(0px)' }}>
                                <svg width="100%" height="100%" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" className="absolute inset-0 opacity-30">
                                    <defs><pattern id="grid" width="8" height="8" patternUnits="userSpaceOnUse"><path d="M 8 0 L 0 0 0 8" fill="none" stroke="rgba(56,189,248,0.5)" strokeWidth="0.5"/></pattern></defs>
                                    <rect width="100" height="100" fill="url(#grid)" />
                                    <path d="M 50 10 L 50 45 M 50 55 L 50 90 M 10 50 L 45 50 M 55 50 L 90 50" stroke="rgba(56,189,248,0.8)" strokeWidth="0.5" strokeDasharray="2,2"/>
                                    <circle cx="50" cy="50" r="15" fill="none" stroke="rgba(56,189,248,0.4)" strokeWidth="0.5"/>
                                    <circle cx="50" cy="50" r="30" fill="none" stroke="rgba(56,189,248,0.2)" strokeWidth="0.5"/>
                                    <circle cx="50" cy="50" r="45" fill="none" stroke="rgba(56,189,248,0.1)" strokeWidth="0.5"/>
                                </svg>
                                <div className={`absolute inset-0 animate-[radar-sweep_3s_linear_infinite] rounded-full origin-center opacity-80 transition-colors duration-[3000ms] ${isStorm ? 'bg-[conic-gradient(from_0deg,transparent_80%,rgba(56,189,248,0.6)_100%)]' : 'bg-[conic-gradient(from_0deg,transparent_80%,rgba(251,191,36,0.5)_100%)]'}`}></div>
                                <div className={`absolute inset-[38%] bg-black rounded-full border-[2px] transition-all duration-[3000ms] ${isStorm ? 'border-sky-400/50 shadow-[0_0_20px_rgba(56,189,248,0.6)]' : 'border-amber-400/50 shadow-[0_0_20px_rgba(251,191,36,0.5)]'}`}></div>
                            </div>
                        </div>

                        {/* CILINDRE DE CONTENCIÓ I ATMOSFERA */}
                        <div className="absolute w-[180px] h-[280px] left-[110px] top-[10px] preserve-3d">
                            <div className="absolute inset-0 preserve-3d transition-all duration-[3000ms]">
                                {[0, 60, 120].map(deg => (
                                    <div key={`plasma-${deg}`} className={`absolute inset-0 rounded-full border-x-[1px] transition-all duration-[3000ms] preserve-3d ${isStorm ? 'border-sky-300/20 bg-gradient-to-b from-transparent via-sky-400/5 to-transparent shadow-[0_0_15px_rgba(56,189,248,0.1)]' : 'border-amber-300/20 bg-gradient-to-b from-transparent via-amber-400/5 to-transparent shadow-[0_0_15px_rgba(251,191,36,0.1)]'}`} style={{ transform: `rotateY(${deg}deg)` }}></div>
                                ))}
                                <div className={`absolute inset-x-[40%] inset-y-0 blur-[10px] animate-[plasma-pulse_3s_ease-in-out_infinite] preserve-3d transition-colors duration-[3000ms] ${isStorm ? 'bg-gradient-to-t from-sky-400/0 via-sky-300/10 to-sky-400/0' : 'bg-gradient-to-t from-amber-400/0 via-amber-300/10 to-amber-400/0'}`} style={{ transform: 'translateZ(0px)' }}></div>
                            </div>
                            <div className={`absolute inset-0 preserve-3d transition-opacity duration-[2000ms] ${isStorm ? 'opacity-100' : 'opacity-0'}`}>
                                {isMounted && precipDrops.map(drop => (
                                    <div key={drop.id} className="absolute w-[1.5px] h-[15px] bg-gradient-to-b from-transparent via-sky-200 to-sky-400 rounded-full animate-[precip-drop_2.5s_linear_infinite] preserve-3d" style={{ left: drop.left, animationDelay: drop.delay, '--z': drop.z } as React.CSSProperties}></div>
                                ))}
                            </div>
                            {isMounted && clouds.map((cloud) => (
                                <div key={`cloud-${cloud.id}`} className="absolute w-32 h-16 preserve-3d animate-[cloud-pan_20s_linear_infinite]" style={{ animationDelay: cloud.delay, '--y': cloud.y, '--z': cloud.z } as React.CSSProperties}>
                                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.1)_0%,transparent_70%)] rounded-full"></div>
                                    <div className="absolute inset-[25%] bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.2)_0%,transparent_70%)] rounded-full"></div>
                                </div>
                            ))}
                        </div>

                        {/* NUCLI GIROSCÒPIC I ICONES */}
                        <div className="absolute w-[90px] h-[90px] left-[155px] top-[105px] preserve-3d">
                            <div className={`absolute inset-[15%] rounded-full blur-[6px] animate-[plasma-pulse_2s_ease-in-out_infinite] transition-all duration-[3000ms] ${isStorm ? 'bg-gradient-to-tr from-white via-sky-100 to-transparent shadow-[0_0_20px_white]' : 'bg-gradient-to-tr from-white via-amber-200 to-transparent shadow-[0_0_25px_rgba(251,191,36,0.8)]'}`}></div>
                            <div className="absolute inset-[-40%] preserve-3d animate-[ring-spin-x_8s_linear_infinite]"><svg className="absolute inset-0 w-full h-full transition-colors duration-[3000ms]" viewBox="0 0 100 100"><circle cx="50" cy="50" r="48" fill="none" className={isStorm ? 'stroke-sky-400/50' : 'stroke-amber-400/50'} strokeWidth="1" strokeDasharray="20, 10, 5, 10" /></svg></div>
                            <div className="absolute inset-[-30%] preserve-3d animate-[ring-spin-y_12s_linear_infinite]"><svg className="absolute inset-0 w-full h-full transition-colors duration-[3000ms]" viewBox="0 0 100 100"><circle cx="50" cy="50" r="48" fill="none" className={isStorm ? 'stroke-white/60' : 'stroke-orange-200/60'} strokeWidth="1.5" strokeDasharray="30, 40" /></svg></div>
                            <div className="absolute inset-[15%] preserve-3d animate-[cube-spin_60s_linear_infinite]">
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <CloudLightning className={`absolute w-full h-full transition-all duration-[2000ms] ease-in-out ${isStorm ? 'opacity-100 scale-100 text-white drop-shadow-[0_0_15px_rgba(255,255,255,1)]' : 'opacity-0 scale-50 text-sky-200'}`} strokeWidth={2} />
                                    <Sun className={`absolute w-full h-full transition-all duration-[2000ms] ease-in-out ${!isStorm ? 'opacity-100 scale-100 text-amber-100 drop-shadow-[0_0_20px_rgba(251,191,36,0.9)]' : 'opacity-0 scale-150 text-orange-400'}`} strokeWidth={2.5} />
                                </div>
                            </div>
                        </div>

                        {/* CUBS DE DADES */}
                        {orbitingSensors.map((sensor, i) => (
                            <div key={`sensor-orbit-${i}`} className="absolute left-[200px] top-[150px] preserve-3d" style={{ transform: `rotateY(${sensor.angle}deg)` }}>
                                <div className="absolute top-1/2 left-1/2 h-[1px] bg-sky-400/40 preserve-3d shadow-[0_0_8px_rgba(56,189,248,0.6)]" style={{ width: '220px', transform: 'translateX(-110px) translateY(-50px) translateZ(110px) rotateY(-90deg)' }}></div>
                                <div className="absolute preserve-3d" style={{ transform: 'translateX(-45px) translateY(-55px) translateZ(220px)' }}>
                                    <div className="relative w-[90px] h-[110px] preserve-3d animate-[cube-spin_15s_linear_infinite]">
                                        <div className="absolute inset-[25%] bg-sky-400/10 blur-[10px] rounded-full preserve-3d"></div>
                                        {[0, 90, 180, 270].map(rot => (
                                            <div key={`face-${rot}`} className="absolute inset-0 flex flex-col items-center justify-between py-2.5 px-2 rounded-xl bg-slate-900/95 border-[1px] border-sky-400/30 preserve-3d backface-hidden" style={{ transform: `rotateY(${rot}deg) translateZ(45px)` }}>
                                                <div className="p-1.5 rounded-lg bg-black/90 border border-white/5 z-10"><sensor.Icon className={`w-4 h-4 ${sensor.color} animate-[plasma-pulse_2s_ease-in-out_infinite]`} strokeWidth={2.5} /></div>
                                                <div className="flex flex-col items-center z-10"><span className="text-[10px] font-mono tracking-widest font-black text-white uppercase">{sensor.label}</span><span className="text-[8px] font-mono font-bold text-sky-300/70 mt-0.5">{sensor.val}</span></div>
                                                <div className={`w-14 h-1.5 ${loading ? 'bg-amber-950/80' : 'bg-sky-950/80'} rounded-full overflow-hidden border border-white/10 z-10 shadow-inner`}><div className={`h-full rounded-full ${loading ? 'bg-gradient-to-r from-amber-600 to-amber-300' : 'bg-gradient-to-r from-sky-500 to-white'}`} style={{ width: sensor.width }}></div></div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>

        {/* =========================================================================
            PANELL PRINCIPAL TÀCTIC
            ========================================================================= */}
        <div className="relative flex flex-col items-center lg:items-start text-center lg:text-left w-full max-w-[420px] lg:max-w-[420px] xl:max-w-[460px] shrink-0 z-30 gap-5 lg:gap-7">
            
            <div className="flex flex-col items-center lg:items-start w-full gap-2 lg:gap-3 relative z-10">
              <div className="flex items-center gap-2 opacity-80 mb-[-6px] lg:mb-[-10px] ml-1">
                <div className="w-5 h-[2px] bg-sky-500"></div>
                <span className="text-[8px] sm:text-[9px] font-mono font-black tracking-[0.3em] text-sky-400 uppercase">SYS.INIT // OMEGA</span>
              </div>
              <h1 className="relative flex items-center text-[2.75rem] sm:text-6xl lg:text-6xl xl:text-7xl font-black tracking-tighter">
                <span className="text-white drop-shadow-[0_2px_10px_rgba(56,189,248,0.4)]">METEO<span className="text-sky-200">TONI</span></span>
                <div className="relative ml-1.5 flex items-center justify-center">
                   <span className="relative z-10 text-sky-400 drop-shadow-[0_2px_5px_rgba(0,0,0,0.8)]">AI</span>
                   <div className="absolute -right-3 -top-0.5 w-1.5 h-1.5 bg-sky-400 rounded-full shadow-[0_0_8px_rgba(56,189,248,0.8)] hidden lg:block"></div>
                </div>
              </h1>
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-sky-400/30 bg-sky-950/40 shadow-[0_0_15px_rgba(56,189,248,0.2)]">
                  <Crosshair className="w-3.5 h-3.5 text-sky-400 animate-[plasma-pulse_2s_ease-in-out_infinite]" />
                  <span className="text-[9px] sm:text-[10px] font-bold tracking-[0.25em] text-sky-100 uppercase">{systemText.tagline}</span>
              </div>
            </div>

            <div className="w-full glass-panel-tactical rounded-[1.25rem] p-4 sm:p-5 lg:p-6 flex flex-col gap-4 lg:gap-5 relative z-10 glitch-overlay">
              
              {/* =========================================================================
                  BOTÓ HOLD-TO-ARM (Trencament Cromàtic Ambre + GPU API + TouchCancel)
                  ========================================================================= */}
              <div className="relative w-full flex flex-col gap-1.5 perspective-xl">
                
                <button 
                  type="button" 
                  disabled={loading || isArmed}
                  onMouseDown={startHold}
                  onMouseUp={cancelHold}
                  onMouseLeave={cancelHold}
                  onTouchStart={startHold}
                  onTouchEnd={cancelHold}
                  onTouchCancel={cancelHold} // Nova guàrdia: salva de trucades imprevistes
                  onKeyDown={handleKeyDown}  // Paritat de PC (Teclat)
                  onKeyUp={handleKeyUp}      // Paritat de PC (Teclat)
                  onContextMenu={(e) => e.preventDefault()} // Impedeix menús natius al mòbil
                  aria-label={systemText.start}
                  aria-description={systemText.ariaDescription}
                  className={`group relative w-full h-[72px] lg:h-[80px] overflow-hidden flex items-center justify-center rounded-xl border preserve-3d tactical-btn-zone transition-all duration-[50ms] ease-out
                    ${tapWarning ? 'bg-red-950/80 border-red-500 shadow-[inset_0_0_20px_rgba(239,68,68,0.4),0_0_20px_rgba(239,68,68,0.6)] animate-[button-error-shake_0.4s_ease-in-out]' : 
                      loading ? 'cursor-wait border-amber-500/40 bg-amber-950/20 shadow-[inset_0_0_20px_rgba(245,158,11,0.1)]' : 
                      isArmed ? 'bg-emerald-600 border-emerald-400 shadow-[0_0_40px_rgba(52,211,153,0.8)]' :
                      isHolding ? 'cursor-pointer border-emerald-500/60 shadow-[inset_0_0_30px_rgba(52,211,153,0.2),0_10px_20px_-5px_rgba(0,0,0,0.9)] transform scale-[0.98]' : 
                     'cursor-pointer bg-slate-950/90 border-amber-500/50 shadow-[inset_0_0_20px_rgba(245,158,11,0.2),0_15px_30px_-10px_rgba(0,0,0,0.8)] lg:hover:border-amber-400/80'}`} 
                >
                  
                  {/* Flashbang Layer (S'activa a l'èxit) */}
                  {isArmed && <div className="absolute inset-0 bg-white z-[60] animate-[tactical-flashbang_0.6s_ease-out_forwards]"></div>}

                  {/* Micro-patró tàctic de fons (Black Glass base) */}
                  <div className="absolute inset-0 opacity-[0.05] z-0" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)', backgroundSize: '16px 16px' }}></div>
                  
                  {/* Animació Fantasma (Tease) quan està en repòs */}
                  {!isHolding && !loading && !tapWarning && !isArmed && (
                    <div className="absolute left-0 top-0 bottom-0 bg-gradient-to-r from-emerald-500/20 to-transparent animate-[ghost-tease-pulse_5s_ease-in-out_infinite] z-0"></div>
                  )}

                  {/* Barra d'Ompliment Plasma controlada directament per DOM (Ref) */}
                  {(!loading && !tapWarning) && (
                    <div 
                      ref={progressBarRef}
                      className={`absolute left-0 top-0 bottom-0 bg-gradient-to-r from-emerald-600/60 to-emerald-400/80 backdrop-blur-sm border-r-2 border-emerald-300 shadow-[0_0_30px_rgba(52,211,153,0.8)] transition-opacity duration-200 ease-linear z-10 ${isHolding ? 'opacity-100' : 'opacity-0'}`} 
                      style={{ width: '0%' }}
                    ></div>
                  )}

                  {/* Línia d'Escaneig Ambre (Radar Sweep) */}
                  {!isHolding && !loading && !tapWarning && !isArmed && (
                    <div className="absolute inset-0 overflow-hidden rounded-xl opacity-[0.15] lg:opacity-30 z-0">
                      <div className="w-[80%] h-full bg-gradient-to-r from-transparent via-amber-400 to-transparent -translate-x-[150%] animate-[scan-shimmer-amber_4s_ease-in-out_infinite]" />
                    </div>
                  )}
                  
                  {/* Méskia de contenció Cantonades HUD */}
                  <div className={`absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 transition-colors duration-300 rounded-tr-xl z-20 ${tapWarning ? 'border-red-400' : isHolding ? 'border-emerald-400' : 'border-amber-500/80 group-hover:border-amber-400'}`}></div>
                  <div className={`absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 transition-colors duration-300 rounded-bl-xl z-20 ${tapWarning ? 'border-red-400' : isHolding ? 'border-emerald-400' : 'border-amber-500/80 group-hover:border-amber-400'}`}></div>

                  {/* Comptador Digital de Càrrega (DOM Ref) */}
                  <div className={`absolute right-4 sm:right-6 font-mono font-black text-emerald-300 text-base sm:text-lg drop-shadow-[0_0_8px_rgba(52,211,153,0.8)] z-40 transition-opacity duration-200 ${isHolding && !isArmed ? 'opacity-100' : 'opacity-0'}`}>
                    <span ref={progressTextRef}>0</span>%
                  </div>

                  {/* Contingut Central (Símbol + Text) */}
                  <div className="relative flex items-center gap-3 lg:gap-4 z-30 preserve-3d w-full justify-center" style={{ transform: 'translateZ(10px)' }}>
                      {loading ? (
                          <><Loader2 className="w-5 h-5 lg:w-6 lg:h-6 text-amber-200 animate-spin" /><span className="font-sans font-black tracking-widest text-sm sm:text-base lg:text-lg text-amber-100 uppercase">{systemText.loading}</span></>
                      ) : tapWarning ? (
                          <><AlertTriangle className="w-5 h-5 lg:w-6 lg:h-6 text-red-300 drop-shadow-[0_0_10px_rgba(239,68,68,0.8)]" />
                          <span className="font-sans font-black tracking-[0.1em] text-base sm:text-xl lg:text-2xl text-red-100 uppercase drop-shadow-[0_0_10px_rgba(239,68,68,0.8)]">
                              {systemText.tapWarning}
                          </span></>
                      ) : isArmed ? (
                          <><ShieldCheck className="w-6 h-6 text-white drop-shadow-[0_0_15px_white]" /><span className="font-sans font-black tracking-[0.25em] text-xl lg:text-2xl text-white uppercase drop-shadow-[0_0_15px_white]">{systemText.deployed}</span></>
                      ) : (
                          <><Fingerprint className={`w-5 h-5 lg:w-6 lg:h-6 transition-colors duration-300 ${isHolding ? 'text-white drop-shadow-[0_0_10px_white]' : 'text-amber-400 group-hover:text-amber-300'}`} />
                          <span className={`font-sans font-black tracking-[0.2em] sm:tracking-[0.25em] text-lg sm:text-xl lg:text-2xl uppercase transition-colors duration-300 ${isHolding ? 'text-white drop-shadow-[0_0_15px_rgba(255,255,255,0.8)]' : 'text-amber-400 group-hover:text-amber-300 drop-shadow-[0_0_8px_rgba(245,158,11,0.6)]'}`}>
                            {systemText.start}
                          </span></>
                      )}
                  </div>
                </button>
              </div>

              <div className="flex items-center justify-between w-full pt-2 lg:pt-3">
                  <button type="button" onClick={openDiagnosticsModal} className="flex items-center gap-1.5 group cursor-pointer px-3.5 py-2 rounded-lg glass-panel-interactive">
                      <HelpCircle className="w-4 h-4 text-sky-400 lg:group-hover:scale-110 transition-all" />
                      <span className="text-[10px] font-bold text-slate-300 group-hover:text-white uppercase tracking-widest transition-colors">{systemText.manual}</span>
                  </button>
                  <div className="flex gap-1 bg-black/60 p-1 rounded-lg border border-white/10 shadow-inner">
                      {(['ca', 'es', 'en', 'fr'] as Language[]).map((l) => (
                          <button key={l} type="button" disabled={loading} onClick={() => setLang(l)}
                              className={`px-3 py-1.5 font-sans text-[10px] font-black uppercase transition-colors duration-200 rounded-md ${lang === l ? 'bg-sky-500 text-white shadow-[0_0_10px_rgba(56,189,248,0.5)]' : 'text-slate-400 hover:text-white hover:bg-white/10'} ${loading ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`} >
                              {l}
                          </button>
                      ))}
                  </div>
              </div>
            </div>
        </div>
      </main>

      {/* MODAL I18N */}
      {showDiagnostics && (
        <div className="absolute z-[99999]">
          <DiagnosticsModal onClose={closeDiagnosticsModal} lang={lang} t={t} wrfWindFormatted={systemText.sysAuto} aromeWindFormatted={systemText.sysActive} />
        </div>
      )}

      {/* FOOTER */}
      <footer className="relative w-full border-t border-white/10 px-4 py-3 sm:py-4 flex items-center justify-between z-40 shrink-0 bg-black/30 mt-auto">
          <div className="flex items-center gap-2.5">
              <div className="relative flex items-center justify-center">
                <div className="absolute w-3 h-3 rounded-full bg-emerald-400 animate-[plasma-pulse_1.5s_ease-in-out_infinite]"></div>
                <div className="w-2 h-2 rounded-full bg-emerald-400"></div>
              </div>
              <span className="text-[9px] sm:text-[10px] font-black text-emerald-400 tracking-widest uppercase">{systemText.systemStatus}</span>
          </div>
          <div className="flex items-center gap-4 sm:gap-6">
              <div className="hidden sm:flex items-center gap-1.5 text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider">
                  <ShieldCheck className="w-3.5 h-3.5 text-sky-400" /> {systemText.secure}
              </div>
              <div className="flex items-center gap-2 text-[9px] sm:text-[10px] font-mono font-black text-slate-500 tracking-widest uppercase">
                  <span className="text-slate-400">© {year} MT-AI</span><span className="text-sky-500/90">v{safeVersion}</span>
              </div>
          </div>
      </footer>
    </div>
  );
}