// src/components/WelcomeScreen.tsx
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  MapPin, Loader2, CloudRain, Wind, 
  ShieldCheck, CloudLightning, ThermometerSun, Zap,
  HelpCircle, Crosshair
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
 * METEOTONI AI - TACTICAL ATMOSPHERIC OPERATING SYSTEM (v7.7 SOLID STATE)
 * Arquitectura: Spatial UI, Modal Desacoblat i18n, Puresa React garantida.
 * Holograma v7.0: Motor DOM 3D Pur, Vectors SVG integrats, Plasma Pillar.
 * UI v7.7 Update: Flickering fix (eliminades animacions pesades text-clip) i
 * purgat total del panell de models per a una UX 100% directa al botó d'acció.
 */
export default function WelcomeScreen({ lang, setLang, t, onLocate, loading }: WelcomeScreenProps) {
  const year = new Date().getFullYear();

  // DOCTRINA RISC ZERO: Tipatge
  const tRecord = (t && typeof t === 'object') ? (t as Record<string, unknown>) : {};
  const tWelcome = (tRecord.welcome && typeof tRecord.welcome === 'object') ? (tRecord.welcome as Record<string, string>) : {};
  const safeVersion = pkg && pkg.version ? pkg.version : '6.2.0-PRO';

  const systemText = {
    loading: tWelcome.loading || (lang === 'es' ? "SINTETIZANDO ATMÓSFERA..." : lang === 'en' ? "SYNTHESIZING ATMOSPHERE..." : lang === 'fr' ? "SYNTHÈSE ATMOSPHÉRIQUE..." : "SINTETITZANT ATMOSFERA..."),
    tagline: tWelcome.tagline || (lang === 'es' ? "TELEMETRÍA TÁCTICA PARA TERRENO TÉCNICO" : lang === 'en' ? "TACTICAL TELEMETRY FOR TECHNICAL TERRAIN" : lang === 'fr' ? "TÉLÉMÉTRIE TACTIQUE POUR TERRAIN TECHNIQUE" : "TELEMETRIA TÀCTICA PER A TERRENY TÈCNIC"),
    start: tWelcome.start || (lang === 'es' ? "DESPLEGAR SENSORES" : lang === 'en' ? "DEPLOY SENSORS" : lang === 'fr' ? "DÉPLOYER CAPTEURS" : "DESPLEGAR SENSORS"),
    manual: tWelcome.manual || (lang === 'es' ? "MANUAL IA" : lang === 'en' ? "AI MANUAL" : lang === 'fr' ? "MANUEL IA" : "MANUAL IA"),
    systemStatus: tWelcome.systemStatus || (lang === 'es' ? "SISTEMA ÓPTIMO" : lang === 'en' ? "SYSTEM OPTIMAL" : lang === 'fr' ? "SYSTÈME OPTIMAL" : "SISTEMA ÒPTIM"),
    secure: tWelcome.secure || (lang === 'es' ? "CONEXIÓN SEGURA" : lang === 'en' ? "SECURE CONNECTION" : lang === 'fr' ? "CONNEXION SÉCURISÉE" : "CONNEXIÓ SEGURA"),
    // Aquests texts es mantenen per ser enviats al DiagnosticsModal, però no es renderitzen a la portada.
    sysActive: tWelcome.sysActive || (lang === 'es' ? "[ PRIORIDAD ]" : lang === 'en' ? "[ PRIORITY ]" : lang === 'fr' ? "[ PRIORITÉ ]" : "[ PRIORITAT ]"),
    sysAuto: tWelcome.sysAuto || (lang === 'es' ? "[ AUTO-SWITCH ]" : lang === 'en' ? "[ AUTO-SWITCH ]" : lang === 'fr' ? "[ AUTO-SWITCH ]" : "[ AUTO-SWITCH ]"),
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

  // ESTATS PURS DINS DE COORDENADES FIXES (400x400)
  const [particles, setParticles] = useState<Particle[]>([]);
  const [precipDrops, setPrecipDrops] = useState<Drop[]>([]);
  const [clouds, setClouds] = useState<Cloud[]>([]);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    // Tècnica de Descompressió de Render (Fix per al Linter react-hooks/set-state-in-effect).
    const timer = setTimeout(() => {
      setIsMounted(true);
      
      setParticles(Array.from({ length: 30 }).map((_, i) => ({
        id: i, left: `${Math.random() * 100}%`, top: `${Math.random() * 100}%`,
        size: `${Math.random() * 2 + 1}px`, duration: `${5 + Math.random() * 15}s`,
        delay: `-${Math.random() * 15}s`, drift: `${(Math.random() - 0.5) * 80}px`
      })));

      setPrecipDrops(Array.from({ length: 40 }).map((_, i) => ({
        id: i,
        left: `${Math.random() * 140 + 10}px`,
        delay: `-${Math.random() * 5}s`,
        z: `${Math.random() * 140 - 70}px`
      })));

      setClouds(Array.from({ length: 8 }).map((_, i) => ({
        id: i,
        y: `${Math.random() * 120 + 20}px`,
        delay: `-${Math.random() * 15}s`,
        z: `${Math.random() * 140 - 70}px`
      })));
    }, 0);

    return () => clearTimeout(timer);
  }, []);

  const orbitingSensors = useMemo(() => [
    { Icon: CloudRain, color: 'text-sky-300', angle: 0, label: 'PRECIP', width: '75%', val: '0.0 mm' },
    { Icon: Wind, color: 'text-indigo-300', angle: 120, label: 'WIND', width: '65%', val: 'KNOTS' },
    { Icon: ThermometerSun, color: 'text-amber-300', angle: 240, label: 'TEMP', width: '85%', val: 'SYNC' }
  ], []);

  return (
    <div className="relative w-full min-h-dvh overflow-x-hidden overflow-y-auto bg-[#020617] select-none font-sans text-slate-200 antialiased flex flex-col">
      
      <style>{`
        @keyframes aurora-shift {
          0% { transform: translateX(-10%) translateY(-10%) scale(1); filter: hue-rotate(0deg); opacity: 0.3; }
          50% { transform: translateX(10%) translateY(10%) scale(1.2); filter: hue-rotate(30deg); opacity: 0.6; }
          100% { transform: translateX(-10%) translateY(-10%) scale(1); filter: hue-rotate(0deg); opacity: 0.3; }
        }
        @keyframes turntable-spin {
          from { transform: rotateY(0deg); }
          to { transform: rotateY(360deg); }
        }
        @keyframes ring-spin-x {
          from { transform: rotateX(60deg) rotateY(0deg) rotateZ(0deg); }
          to { transform: rotateX(60deg) rotateY(360deg) rotateZ(360deg); }
        }
        @keyframes ring-spin-y {
          from { transform: rotateX(120deg) rotateY(0deg) rotateZ(0deg); }
          to { transform: rotateX(120deg) rotateY(-360deg) rotateZ(180deg); }
        }
        @keyframes cube-spin {
          from { transform: rotateY(0deg); }
          to { transform: rotateY(-360deg); }
        }
        @keyframes radar-sweep {
          from { transform: rotateZ(0deg); }
          to { transform: rotateZ(360deg); }
        }
        @keyframes scan-line {
          0% { transform: translateY(-100%); }
          100% { transform: translateY(300%); }
        }
        /* Simplificat per no forçar redibuixats constants a la GPU del mòbil */
        @keyframes plasma-pulse {
          0%, 100% { opacity: 0.5; }
          50% { opacity: 1; }
        }
        @keyframes particle-rise {
          0% { transform: translateY(20px) translateX(0px); opacity: 0; }
          20% { opacity: 1; }
          80% { opacity: 0.8; }
          100% { transform: translateY(-100vh) translateX(var(--drift)); opacity: 0; }
        }
        @keyframes thunder-bolt {
          0%, 90%, 100% { opacity: 0; }
          92% { opacity: 1; }
          93% { opacity: 0.2; }
          94% { opacity: 1; }
        }
        @keyframes precip-drop {
          0% { transform: translateY(0px) translateZ(var(--z)); opacity: 0; }
          10%, 80% { opacity: 0.9; }
          100% { transform: translateY(260px) translateZ(var(--z)); opacity: 0; }
        }
        @keyframes cloud-pan {
          0% { transform: translateX(200px) translateY(var(--y)) translateZ(var(--z)); opacity: 0; }
          15%, 85% { opacity: 0.7; }
          100% { transform: translateX(-80px) translateY(var(--y)) translateZ(var(--z)); opacity: 0; }
        }
        @keyframes float-hologram {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-15px); }
        }

        .perspective-xl { perspective: 2500px; }
        .preserve-3d { transform-style: preserve-3d; }
        .backface-hidden { backface-visibility: hidden; }
        
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
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .glass-panel-interactive:hover {
          background: linear-gradient(135deg, rgba(255, 255, 255, 0.1) 0%, rgba(255, 255, 255, 0.03) 100%);
          border-color: rgba(56, 189, 248, 0.5); transform: translateY(-1px);
        }

        .glitch-overlay::before {
          content: ""; position: absolute; inset: 0; pointer-events: none;
          background: repeating-linear-gradient(transparent 0, transparent 2px, rgba(56, 189, 248, 0.05) 2px, rgba(56, 189, 248, 0.05) 4px);
          mix-blend-mode: overlay; z-index: 50; opacity: 0.3; border-radius: 1.5rem;
        }

        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>

      {/* FONS ATMOSFÈRIC AURORA ATENUADA PER PC I MÒBIL */}
      <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden bg-[radial-gradient(circle_at_center,rgba(15,23,42,0)_0%,rgba(2,6,23,1)_100%)]">
        <div className="absolute -top-[30%] -left-[20%] w-[120%] h-[120%] bg-sky-500/10 lg:bg-sky-500/5 rounded-full blur-[120px] mix-blend-screen animate-[aurora-shift_30s_ease-in-out_infinite]"></div>
        <div className="absolute -bottom-[30%] -right-[20%] w-[120%] h-[120%] bg-indigo-600/10 lg:bg-indigo-600/5 rounded-full blur-[120px] mix-blend-screen animate-[aurora-shift_35s_ease-in-out_infinite_reverse]"></div>

        <div className="absolute inset-0 z-10">
          {isMounted && particles.map((p) => (
            <div key={p.id} className="absolute bg-sky-200 rounded-full"
              style={{ left: p.left, top: p.top, width: p.size, height: p.size, opacity: 0,
                filter: `blur(${parseFloat(p.size) / 2}px)`, animation: `particle-rise ${p.duration} linear infinite`, animationDelay: p.delay, '--drift': p.drift } as React.CSSProperties} />
          ))}
        </div>
      </div>

      {/* DISTRIBUCIÓ PRINCIPAL */}
      <main className="relative z-30 flex-1 w-full max-w-[1400px] mx-auto px-5 sm:px-8 lg:px-16 xl:px-24 py-6 sm:py-12 flex flex-col lg:flex-row items-center justify-center lg:justify-between gap-6 lg:gap-8 xl:gap-12 no-scrollbar">
        
        {/* =========================================================================
            HOLOGRAMA V7.0
            ========================================================================= */}
        <div className="relative w-full max-w-[280px] sm:max-w-[420px] lg:max-w-[480px] xl:max-w-[540px] aspect-square shrink-0 flex items-center justify-center perspective-xl animate-[float-hologram_10s_ease-in-out_infinite]">
            
            <div className={`absolute inset-0 rounded-full blur-[100px] lg:blur-[140px] transition-colors duration-1000 opacity-50 lg:opacity-40 ${loading ? 'bg-amber-600/30' : 'bg-sky-500/20'}`}></div>
            
            <div className="absolute w-[400px] h-[400px] preserve-3d transform scale-[0.65] sm:scale-100 lg:scale-[1.1] xl:scale-[1.2]">
                
                <div className="absolute inset-0 preserve-3d" style={{ transform: 'rotateX(20deg) translateY(-30px)' }}>
                    
                    <div className="absolute inset-0 preserve-3d animate-[turntable-spin_60s_linear_infinite]">
                        
                        {/* TERRENY HÍBRID NADIU */}
                        <div className="absolute w-[360px] h-[360px] left-[20px] top-[180px] preserve-3d" style={{ transform: 'rotateX(90deg)' }}>
                            <div className="absolute inset-[-20%] bg-sky-500/10 blur-[60px] rounded-full"></div>
                            <div className="absolute inset-0 rounded-full bg-slate-950/95 border border-sky-800/80 preserve-3d" style={{ transform: 'translateZ(-20px)' }}></div>
                            
                            {[...Array(8)].map((_, i) => (
                                <div key={i} className="absolute inset-0 rounded-full border border-sky-400/15 preserve-3d" style={{ transform: `translateZ(${-20 + i*2.5}px)` }}></div>
                            ))}

                            <div className="absolute inset-0 rounded-full border-[3px] border-sky-400/50 bg-gradient-to-br from-slate-900/90 via-sky-950/70 to-slate-900/90 shadow-[inset_0_0_50px_rgba(56,189,248,0.5)] preserve-3d overflow-hidden" style={{ transform: 'translateZ(0px)' }}>
                                <svg width="100%" height="100%" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" className="absolute inset-0 opacity-40">
                                    <defs>
                                        <pattern id="grid" width="8" height="8" patternUnits="userSpaceOnUse">
                                            <path d="M 8 0 L 0 0 0 8" fill="none" stroke="rgba(56,189,248,0.5)" strokeWidth="0.5"/>
                                        </pattern>
                                    </defs>
                                    <rect width="100" height="100" fill="url(#grid)" />
                                    <path d="M 50 10 L 50 45 M 50 55 L 50 90 M 10 50 L 45 50 M 55 50 L 90 50" stroke="rgba(56,189,248,0.8)" strokeWidth="0.5" strokeDasharray="2,2"/>
                                    <circle cx="50" cy="50" r="15" fill="none" stroke="rgba(56,189,248,0.4)" strokeWidth="0.5"/>
                                    <circle cx="50" cy="50" r="30" fill="none" stroke="rgba(56,189,248,0.2)" strokeWidth="0.5"/>
                                    <circle cx="50" cy="50" r="45" fill="none" stroke="rgba(56,189,248,0.1)" strokeWidth="0.5"/>
                                </svg>

                                <div className="absolute inset-0 bg-[conic-gradient(from_0deg,transparent_80%,rgba(56,189,248,0.8)_100%)] animate-[radar-sweep_3s_linear_infinite] mix-blend-screen rounded-full origin-center"></div>
                                <div className="absolute inset-[38%] bg-black rounded-full border-[2px] border-sky-400/50 shadow-[0_0_30px_rgba(56,189,248,0.8)]"></div>
                            </div>
                        </div>

                        {/* CILINDRE DE CONTENCIÓ (PLASMA PILLAR) */}
                        <div className="absolute w-[180px] h-[280px] left-[110px] top-[10px] preserve-3d">
                            {[0, 60, 120].map(deg => (
                                <div key={`plasma-${deg}`} className="absolute inset-0 rounded-full border-x-[1px] border-sky-300/20 bg-gradient-to-b from-transparent via-sky-400/5 to-transparent shadow-[0_0_15px_rgba(56,189,248,0.1)] preserve-3d" style={{ transform: `rotateY(${deg}deg)` }}>
                                    <div className="absolute inset-0 bg-gradient-to-t from-sky-500/5 to-transparent blur-[2px] opacity-40 mix-blend-screen"></div>
                                </div>
                            ))}

                            <div className="absolute inset-x-[40%] inset-y-0 bg-gradient-to-t from-sky-400/0 via-sky-300/20 to-sky-400/0 blur-[15px] animate-[plasma-pulse_3s_ease-in-out_infinite] preserve-3d" style={{ transform: 'translateZ(0px)' }}></div>

                            {isMounted && precipDrops.map(drop => (
                                <div key={drop.id} className="absolute w-[1.5px] h-[15px] bg-gradient-to-b from-transparent via-sky-200 to-sky-400 rounded-full opacity-80 animate-[precip-drop_2.5s_linear_infinite] preserve-3d shadow-[0_0_5px_rgba(56,189,248,0.6)]" 
                                    style={{ left: drop.left, animationDelay: drop.delay, '--z': drop.z } as React.CSSProperties}></div>
                            ))}

                            {isMounted && clouds.map((cloud) => (
                                <div key={`cloud-${cloud.id}`} className="absolute w-32 h-16 preserve-3d animate-[cloud-pan_20s_linear_infinite]" 
                                    style={{ animationDelay: cloud.delay, '--y': cloud.y, '--z': cloud.z } as React.CSSProperties}>
                                    <div className="absolute inset-0 bg-white/10 rounded-full blur-[20px] shadow-[0_0_20px_rgba(255,255,255,0.2)] mix-blend-screen"></div>
                                    <div className="absolute inset-[15%] bg-slate-100/20 rounded-full blur-[10px]"></div>
                                </div>
                            ))}
                        </div>

                        {/* DYSON CORE I ANELLS ORBITALS VECTORIALS */}
                        <div className="absolute w-[90px] h-[90px] left-[155px] top-[105px] preserve-3d">
                            <div className={`absolute inset-0 rounded-full blur-[30px] transition-colors duration-1000 ${loading ? 'bg-amber-500/60 shadow-[0_0_60px_rgba(245,158,11,0.7)]' : 'bg-sky-400/70 shadow-[0_0_60px_rgba(56,189,248,0.7)]'}`}></div>
                            <div className="absolute inset-[15%] bg-gradient-to-tr from-white via-sky-100 to-transparent rounded-full blur-[6px] shadow-[0_0_20px_white]"></div>

                            <div className="absolute inset-[-40%] preserve-3d animate-[ring-spin-x_8s_linear_infinite]">
                                <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100">
                                    <circle cx="50" cy="50" r="48" fill="none" stroke="rgba(56,189,248,0.4)" strokeWidth="1" strokeDasharray="20, 10, 5, 10" />
                                </svg>
                            </div>
                            <div className="absolute inset-[-30%] preserve-3d animate-[ring-spin-y_12s_linear_infinite]">
                                <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100">
                                    <circle cx="50" cy="50" r="48" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5" strokeDasharray="30, 40" />
                                </svg>
                            </div>

                            <div className="absolute inset-[25%] preserve-3d">
                                {[0, 72, 144, 216, 288].map(rot => (
                                    <div key={rot} className="absolute inset-0 flex items-center justify-center preserve-3d backface-hidden" style={{ transform: `rotateY(${rot}deg)` }}>
                                        {loading ? (
                                            <Zap className="w-full h-full text-amber-100 animate-[thunder-bolt_2s_linear_infinite]" strokeWidth={2.5} />
                                        ) : (
                                            <CloudLightning className="w-full h-full text-white drop-shadow-[0_0_20px_rgba(255,255,255,1)]" strokeWidth={2.5} />
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* DATA CUBES AMB PANELLS FLOTANTS */}
                        {orbitingSensors.map((sensor, i) => (
                            <div key={`sensor-orbit-${i}`} className="absolute left-[200px] top-[150px] preserve-3d" style={{ transform: `rotateY(${sensor.angle}deg)` }}>
                                <div className="absolute top-1/2 left-1/2 h-[1px] bg-sky-400/50 preserve-3d shadow-[0_0_8px_rgba(56,189,248,0.6)]"
                                     style={{ width: '220px', transform: 'translateX(-110px) translateY(-50px) translateZ(110px) rotateY(-90deg)' }}></div>

                                <div className="absolute preserve-3d" style={{ transform: 'translateX(-45px) translateY(-55px) translateZ(220px)' }}>
                                    <div className="relative w-[90px] h-[110px] preserve-3d animate-[cube-spin_15s_linear_infinite]">
                                        <div className="absolute inset-[25%] bg-sky-400/20 blur-[15px] rounded-full preserve-3d"></div>

                                        {[0, 90, 180, 270].map(rot => (
                                            <div key={`face-${rot}`} className="absolute inset-0 flex flex-col items-center justify-between py-2.5 px-2 rounded-xl bg-slate-900/95 backdrop-blur-xl border-[1.5px] border-sky-400/30 shadow-[0_10px_25px_rgba(0,0,0,0.8),inset_0_0_10px_rgba(56,189,248,0.15)] preserve-3d backface-hidden" style={{ transform: `rotateY(${rot}deg) translateZ(45px)` }}>
                                                <div className="absolute inset-0 overflow-hidden rounded-xl opacity-10 pointer-events-none">
                                                    <div className="w-full h-2 bg-sky-400 blur-[2px] animate-[scan-line_2s_linear_infinite]"></div>
                                                </div>
                                                <div className="p-1.5 rounded-lg bg-black/90 shadow-[inset_0_0_10px_rgba(56,189,248,0.3)] border border-white/5 z-10">
                                                    <sensor.Icon className={`w-4 h-4 ${sensor.color} animate-[plasma-pulse_2s_ease-in-out_infinite]`} strokeWidth={2.5} />
                                                </div>
                                                <div className="flex flex-col items-center z-10">
                                                    <span className="text-[10px] font-mono tracking-widest font-black text-white uppercase drop-shadow-[0_2px_2px_rgba(0,0,0,1)]">{sensor.label}</span>
                                                    <span className="text-[8px] font-mono font-bold text-sky-300/70 mt-0.5">{sensor.val}</span>
                                                </div>
                                                <div className={`w-14 h-1.5 ${loading ? 'bg-amber-950/80' : 'bg-sky-950/80'} rounded-full overflow-hidden border border-white/10 z-10 shadow-inner`}>
                                                    <div className={`h-full rounded-full ${loading ? 'bg-gradient-to-r from-amber-600 to-amber-300' : 'bg-gradient-to-r from-sky-500 to-white'}`} style={{ width: sensor.width }}></div>
                                                </div>
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
            PANELL PRINCIPAL TÀCTIC (Simplificat per evitar pampallugues)
            ========================================================================= */}
        <div className="relative flex flex-col items-center lg:items-start text-center lg:text-left w-full max-w-[420px] lg:max-w-[420px] xl:max-w-[460px] shrink-0 z-30 gap-5 lg:gap-7">
            
            {/* CAPÇALERA TÍTOL NÍTIDA SENSE ANIMACIONS DE FONS */}
            <div className="flex flex-col items-center lg:items-start w-full gap-2 lg:gap-3 relative z-10">
              
              <div className="flex items-center gap-2 opacity-80 mb-[-6px] lg:mb-[-10px] ml-1">
                <div className="w-5 h-[2px] bg-sky-500 shadow-[0_0_8px_rgba(56,189,248,0.8)]"></div>
                <span className="text-[8px] sm:text-[9px] font-mono font-black tracking-[0.3em] text-sky-400 uppercase">
                  SYS.INIT // OMEGA
                </span>
              </div>

              {/* Lletres de color sòlid amb degradat fix per evitar flickering a iOS/Android */}
              <h1 className="relative flex items-center text-[2.75rem] sm:text-6xl lg:text-6xl xl:text-7xl font-black tracking-tighter">
                <span className="text-transparent bg-clip-text bg-gradient-to-br from-white to-sky-200 drop-shadow-[0_2px_10px_rgba(56,189,248,0.4)]">
                  METEOTONI
                </span>
                <div className="relative ml-1.5 flex items-center justify-center">
                   <span className="relative z-10 text-transparent bg-clip-text bg-gradient-to-br from-sky-300 to-indigo-400 drop-shadow-[0_2px_5px_rgba(0,0,0,0.8)]">AI</span>
                   {/* Eliminat el blur extrem. Deixem un indicador sòlid i nítid */}
                   <div className="absolute -right-3 -top-0.5 w-1.5 h-1.5 bg-sky-400 rounded-full shadow-[0_0_8px_rgba(56,189,248,0.8)] hidden lg:block"></div>
                </div>
              </h1>

              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-sky-400/30 bg-sky-950/40 backdrop-blur-md shadow-[0_0_15px_rgba(56,189,248,0.2)]">
                  <Crosshair className="w-3.5 h-3.5 text-sky-400 animate-[plasma-pulse_2s_ease-in-out_infinite]" />
                  <span className="text-[9px] sm:text-[10px] font-bold tracking-[0.25em] text-sky-100 uppercase">{systemText.tagline}</span>
              </div>
            </div>

            {/* CONSOLA BLINDADA (Focalitzada només en l'acció principal) */}
            <div className="w-full glass-panel-tactical rounded-[1.25rem] p-4 sm:p-5 lg:p-6 flex flex-col gap-4 lg:gap-5 relative z-10 glitch-overlay">
              
              {/* BOTÓ D'ACCIÓ PRINCIPAL (El rei absolut de la pantalla) */}
              <button type="button" onClick={onLocate} disabled={loading}
                  className={`group relative w-full py-5 lg:py-6 transition-transform duration-300 overflow-hidden flex items-center justify-center rounded-xl border ${loading ? 'cursor-wait bg-gradient-to-r from-amber-700 to-orange-900 border-amber-500/60 shadow-[0_0_30px_rgba(245,158,11,0.4)]' : 'cursor-pointer bg-gradient-to-r from-sky-600 to-indigo-700 border-sky-400/50 shadow-[0_0_30px_rgba(56,189,248,0.3)] lg:hover:shadow-[0_0_50px_rgba(56,189,248,0.6)] lg:hover:from-sky-500 lg:hover:to-indigo-600 active:scale-[0.98]'}`} >
                  
                  {/* Simplificat l'efecte hover d'escriptori i eliminades animacions backgound-position pesades */}
                  <div className={`absolute left-0 top-0 bottom-0 w-1.5 lg:w-2 ${loading ? 'bg-amber-400' : 'bg-sky-300'} shadow-[0_0_10px_currentColor]`}></div>
                  
                  <div className="relative flex items-center gap-3 z-10">
                      {loading ? (
                          <><Loader2 className="w-5 h-5 lg:w-6 lg:h-6 text-white animate-spin drop-shadow-lg" /><span className="font-sans font-black tracking-widest text-sm sm:text-base lg:text-lg text-white uppercase drop-shadow-lg">{systemText.loading}</span></>
                      ) : (
                          <><MapPin className="w-5 h-5 lg:w-6 lg:h-6 text-white group-hover:-translate-y-0.5 transition-transform duration-300 drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)]" /><span className="font-sans font-black tracking-[0.25em] text-lg sm:text-xl lg:text-2xl text-white uppercase drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)]">{systemText.start}</span></>
                      )}
                  </div>
              </button>

              {/* CONTROLS INFERIORS */}
              <div className="flex items-center justify-between w-full pt-1">
                  <button type="button" onClick={openDiagnosticsModal} className="flex items-center gap-1.5 group cursor-pointer px-3.5 py-2 rounded-lg glass-panel-interactive">
                      <HelpCircle className="w-4 h-4 text-sky-400 group-hover:text-sky-300 lg:group-hover:scale-110 transition-all" />
                      <span className="text-[10px] font-bold text-slate-300 group-hover:text-white uppercase tracking-widest transition-colors">{systemText.manual}</span>
                  </button>
                  <div className="flex gap-1 bg-black/60 p-1 rounded-lg border border-white/10 shadow-inner">
                      {(['ca', 'es', 'en', 'fr'] as Language[]).map((l) => (
                          <button key={l} type="button" disabled={loading} onClick={() => setLang(l)}
                              className={`px-3 py-1.5 font-sans text-[10px] font-black uppercase transition-colors duration-200 rounded-md ${lang === l ? 'bg-sky-500 text-white shadow-[0_0_15px_rgba(56,189,248,0.6)]' : 'text-slate-400 hover:text-white hover:bg-white/10'} ${loading ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`} >
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
        <DiagnosticsModal onClose={closeDiagnosticsModal} lang={lang} t={t} wrfWindFormatted={systemText.sysAuto} aromeWindFormatted={systemText.sysActive} />
      )}

      {/* FOOTER */}
      <footer className="relative w-full border-t border-white/10 px-4 py-3 sm:py-4 flex items-center justify-between z-40 shrink-0 bg-black/30 backdrop-blur-md mt-auto">
          <div className="flex items-center gap-2.5">
              <div className="relative flex items-center justify-center">
                <div className="absolute w-3 h-3 rounded-full bg-emerald-400 animate-[plasma-pulse_1.5s_ease-in-out_infinite]"></div>
                <div className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,1)]"></div>
              </div>
              <span className="text-[9px] sm:text-[10px] font-black text-emerald-400 tracking-widest uppercase">{systemText.systemStatus}</span>
          </div>
          <div className="flex items-center gap-4 sm:gap-6">
              <div className="hidden sm:flex items-center gap-1.5 text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider">
                  <ShieldCheck className="w-3.5 h-3.5 text-sky-400" /> {systemText.secure}
              </div>
              <div className="flex items-center gap-2 text-[9px] sm:text-[10px] font-mono font-black text-slate-500 tracking-widest uppercase">
                  <span className="text-slate-400">© {year} MT-AI</span><span className="text-sky-500/90 drop-shadow-[0_0_5px_rgba(56,189,248,0.5)]">v{safeVersion}</span>
              </div>
          </div>
      </footer>
    </div>
  );
}