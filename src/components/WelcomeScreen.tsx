// src/components/WelcomeScreen.tsx
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  MapPin, Loader2, CloudRain, Wind, 
  ShieldCheck, CloudLightning, ThermometerSun, Activity, Zap,
  HelpCircle
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

/**
 * METEOTONI AI - TACTICAL ATMOSPHERIC OPERATING SYSTEM (v6.2 PRO)
 * Arquitectura: Spatial UI, Modal Desacoblat i18n, Puresa React garantida.
 * Holograma v2.0: Volum Atmosfèric Tàctic amb Terreny 3D i Flux de Dades.
 * Lògica Dual: Prioritat AROME HD + Fallback Global (WRF/GFS).
 * Fix: React Strict Mode complert (Math.random extret del JSX).
 */
export default function WelcomeScreen({ lang, setLang, t, onLocate, loading }: WelcomeScreenProps) {
  const year = new Date().getFullYear();

  // DOCTRINA RISC ZERO: Extracció profunda i tipada per a i18n
  const tRecord = (t && typeof t === 'object') ? (t as Record<string, unknown>) : {};
  const tWelcome = (tRecord.welcome && typeof tRecord.welcome === 'object') ? (tRecord.welcome as Record<string, string>) : {};
  const safeVersion = pkg && pkg.version ? pkg.version : '6.2.0-PRO';

  // DICCIONARI PRINCIPAL (Dual Engine Topology)
  const systemText = {
    loading: tWelcome.loading || (lang === 'es' ? "SINTETIZANDO ATMÓSFERA..." : lang === 'en' ? "SYNTHESIZING ATMOSPHERE..." : lang === 'fr' ? "SYNTHÈSE ATMOSPHÉRIQUE..." : "SINTETITZANT ATMOSFERA..."),
    tagline: tWelcome.tagline || (lang === 'es' ? "TELEMETRÍA TÁCTICA PARA TERRENO TÉCNICO" : lang === 'en' ? "TACTICAL TELEMETRY FOR TECHNICAL TERRAIN" : lang === 'fr' ? "TÉLÉMÉTRIE TACTIQUE POUR TERRAIN TECHNIQUE" : "TELEMETRIA TÀCTICA PER A TERRENY TÈCNIC"),
    start: tWelcome.start || (lang === 'es' ? "DESPLEGAR SENSORES" : lang === 'en' ? "DEPLOY SENSORS" : lang === 'fr' ? "DÉPLOYER CAPTEURS" : "DESPLEGAR SENSORS"),
    manual: tWelcome.manual || (lang === 'es' ? "MANUAL IA" : lang === 'en' ? "AI MANUAL" : lang === 'fr' ? "MANUEL IA" : "MANUAL IA"),
    systemStatus: tWelcome.systemStatus || (lang === 'es' ? "SISTEMA ÓPTIMO" : lang === 'en' ? "SYSTEM OPTIMAL" : lang === 'fr' ? "SYSTÈME OPTIMAL" : "SISTEMA ÒPTIM"),
    secure: tWelcome.secure || (lang === 'es' ? "CONEXIÓN SEGURA" : lang === 'en' ? "SECURE CONNECTION" : lang === 'fr' ? "CONNEXION SÉCURISÉE" : "CONNEXIÓ SEGURA"),
    modelArome: tWelcome.modelArome || (lang === 'es' ? "AROME HD (COBERTURA TÁCTICA)" : lang === 'en' ? "AROME HD (TACTICAL COVERAGE)" : lang === 'fr' ? "AROME HD (COUVERTURE TACTIQUE)" : "AROME HD (COBERTURA TÀCTICA)"),
    modelFallback: tWelcome.modelFallback || (lang === 'es' ? "MULTI-MODELO GLOBAL (BEST MATCH)" : lang === 'en' ? "GLOBAL MULTI-MODEL (BEST MATCH)" : lang === 'fr' ? "MULTI-MODÈLE GLOBAL (BEST MATCH)" : "MULTI-MODEL GLOBAL (BEST MATCH)"),
    sysActive: tWelcome.sysActive || (lang === 'es' ? "[ PRIORIDAD ]" : lang === 'en' ? "[ PRIORITY ]" : lang === 'fr' ? "[ PRIORITÉ ]" : "[ PRIORITAT ]"),
    sysAuto: tWelcome.sysAuto || (lang === 'es' ? "[ AUTO-SWITCH ]" : lang === 'en' ? "[ AUTO-SWITCH ]" : lang === 'fr' ? "[ AUTO-SWITCH ]" : "[ AUTO-SWITCH ]"),
  };

  // NAVEGACIÓ TÀCTICA (History API)
  const [showDiagnostics, setShowDiagnostics] = useState(false);

  const closeDiagnosticsModal = useCallback(() => {
    if (typeof window !== 'undefined' && window.history.state?.modal === 'meteo_diagnostics') {
      window.history.back();
    } else {
      setShowDiagnostics(false);
    }
  }, []);

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

  // ==========================================
  // ESTATS PURS (REACT STRICT MODE FIX)
  // Evitem 'Math.random' durant la fase de renderitzat.
  // ==========================================
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

  const [precipDrops] = useState(() => 
    Array.from({ length: 20 }).map(() => ({
      left: `${Math.random() * 80 + 10}%`,
      top: `${Math.random() * 40}%`,
      delay: `-${Math.random() * 4}s`,
      z: `${Math.random() * 60}px`
    }))
  );

  const [clouds] = useState(() => 
    Array.from({ length: 4 }).map(() => ({
      yDrift: `${Math.random() * 15 - 7.5}px`
    }))
  );

  const orbitingSensors = useMemo(() => [
    { Icon: CloudRain, color: 'text-sky-300', angle: 0, label: 'PRECIP', width: '75%' },
    { Icon: Wind, color: 'text-indigo-300', angle: 120, label: 'WIND', width: '65%' },
    { Icon: ThermometerSun, color: 'text-amber-300', angle: 240, label: 'TEMP', width: '85%' }
  ], []);

  return (
    <div className="relative w-full min-h-dvh overflow-y-auto bg-[#020617] select-none font-sans text-slate-200 antialiased flex flex-col">
      
      {/* CSS ESPECÍFIC DE LA PANTALLA */}
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
        @keyframes pulse-core {
          0%, 100% { transform: scale(1); opacity: 0.85; filter: blur(1px); }
          50% { transform: scale(1.08); opacity: 1; filter: blur(0px); }
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
        @keyframes telemetry-scan {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(200%); }
        }
        @keyframes title-shine {
          0% { background-position: 200% center; }
          100% { background-position: -200% center; }
        }
        @keyframes data-stream-flow {
          0% { background-position: 0% 100%; }
          100% { background-position: 0% -100%; }
        }
        @keyframes precip-flow {
          0% { transform: translateY(-20px) translateZ(var(--z)); opacity: 0; }
          10%, 90% { opacity: 0.6; }
          100% { transform: translateY(100px) translateZ(var(--z)); opacity: 0; }
        }
        @keyframes cloud-drift {
          0% { transform: translateX(100%) translateY(0px); opacity: 0; }
          15%, 85% { opacity: 0.4; }
          50% { transform: translateX(0%) translateY(var(--y-drift)); }
          100% { transform: translateX(-100%) translateY(0px); opacity: 0; }
        }
        @keyframes vertical-scan {
          0%, 100% { transform: translateY(120px) translateZ(100px); opacity: 0; }
          25%, 75% { opacity: 1; }
          50% { transform: translateY(-120px) translateZ(100px); opacity: 0; }
        }

        .perspective-lg { perspective: 2000px; }
        .preserve-3d { transform-style: preserve-3d; }
        .backface-hidden { backface-visibility: hidden; }
        
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

        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>

      {/* FONS ATMOSFÈRIC AMB AURORA */}
      <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(15,23,42,0)_0%,rgba(2,6,23,1)_95%)] z-10"></div>
        <div className="absolute -top-1/4 -left-1/4 w-full h-full bg-sky-600/15 rounded-full blur-[140px] mix-blend-screen animate-[aurora-shift_25s_ease-in-out_infinite]"></div>
        <div className="absolute -bottom-1/4 -right-1/4 w-full h-full bg-indigo-700/15 rounded-full blur-[140px] mix-blend-screen animate-[aurora-shift_30s_ease-in-out_infinite_reverse]"></div>

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

      {/* HUD CENTRAL */}
      <main className="relative z-30 flex-1 w-full max-w-screen-xl mx-auto px-4 py-8 flex flex-col lg:flex-row items-center justify-center gap-10 lg:gap-20 no-scrollbar">
        
        {/* HOLOGRAMA 3D V2.0 */}
        <div className="relative w-64 h-64 sm:w-80 sm:h-80 lg:w-[550px] lg:h-[550px] shrink-0 perspective-lg flex items-center justify-center">
            
            <div className={`absolute inset-0 rounded-full blur-[80px] sm:blur-[100px] lg:blur-[150px] transition-colors duration-1000 ${loading ? 'bg-amber-600/35' : 'bg-sky-500/30'}`}></div>
            
            <div className="absolute w-full h-full preserve-3d animate-[holographic-rotation_55s_linear_infinite]">
                
                {/* TERRENY TÀCTIC */}
                <div className="absolute inset-[15%] preserve-3d transform rotateX(75deg) translateZ(-80px) backface-hidden">
                    <div className="absolute inset-0 hologram-terrain bg-gradient-to-br from-black via-sky-950/20 to-black rounded-[40%_50%_60%_40%_/_50%_40%_50%_60%] border-[2px] border-sky-400/20 shadow-[0_0_40px_rgba(56,189,248,0.2)]"></div>
                    <div className="absolute inset-[2px] rounded-[40%_50%_60%_40%_/_50%_40%_50%_60%] overflow-hidden">
                        <div className="absolute inset-0 w-[400%] h-full text-[6px] font-mono font-black text-sky-200/20 animate-[data-stream-flow_3s_linear_infinite] uppercase" style={{ backgroundImage: 'repeating-linear-gradient(rgba(56,189,248,0.1) 0px, rgba(56,189,248,0.1) 1px, transparent 1px, transparent 10px)' }}>
                          {`...${Array(120).fill('TAW_AROME_HD_DATA_STREAM_OK').join('...')}...`}
                        </div>
                        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,black_80%)]"></div>
                    </div>
                </div>

                {/* COLUMNA ATMOSFÈRICA VOLUMÈTRICA */}
                <div className="absolute inset-x-[25%] inset-y-0 preserve-3d transform rotateX(12deg) translateZ(0px) backface-hidden">
                    <div className="absolute inset-0 atmos-column bg-gradient-to-b from-transparent via-indigo-950/15 to-sky-900/10 rounded-full border border-sky-400/10 shadow-[0_0_30px_rgba(56,189,248,0.15)] backdrop-blur-sm"></div>
                    
                    {[...Array(6)].map((_, i) => (
                      <div key={`wind-${i}`} className="absolute inset-y-0 left-1/2 w-[1px] preserve-3d" style={{ transform: `rotateY(${i * 60}deg)` }}>
                          <div className={`absolute top-0 left-0 w-20 h-0.5 bg-sky-300 rounded-full transform rotateZ(${i * 3}deg) animate-pulse`} style={{ transform: `translateZ(${i * 5}px) rotateZ(${i * 3}deg)` }}></div>
                          <div className={`absolute bottom-20 left-0 w-16 h-0.5 bg-sky-300 rounded-full transform rotateZ(${-i * 3}deg) animate-pulse`} style={{ transform: `translateZ(${i * 8}px) rotateZ(${-i * 3}deg)` }}></div>
                      </div>
                    ))}

                    {/* USANT L'ESTAT PUR PER LES GOTES */}
                    {precipDrops.map((drop, i) => (
                      <div 
                        key={`drop-${i}`} 
                        className="absolute inset-y-0 left-1/2 w-1.5 h-1.5 bg-sky-300 rounded-full opacity-60 animate-[precip-flow_4s_linear_infinite]" 
                        style={{ 
                            left: drop.left, 
                            top: drop.top, 
                            animationDelay: drop.delay, 
                            '--z': drop.z 
                        } as React.CSSProperties}>
                      </div>
                    ))}

                    {/* USANT L'ESTAT PUR PELS NÚVOLS */}
                    {clouds.map((cloud, i) => (
                        <div 
                            key={`cloud-${i}`} 
                            className="absolute preserve-3d animate-[cloud-drift_20s_linear_infinite]" 
                            style={{ 
                                top: `${15 + i * 15}%`, 
                                animationDelay: `-${i * 5}s`, 
                                '--y-drift': cloud.yDrift 
                            } as React.CSSProperties}>
                            <div className="relative w-20 h-10 preserve-3d" style={{ transform: `translateZ(${i * 30}px)` }}>
                                <div className="absolute inset-0 bg-white/30 rounded-full blur-[8px]"></div>
                                <div className="absolute inset-2 bg-slate-200/20 rounded-full blur-[10px]"></div>
                                <div className="absolute -bottom-1 -right-1 w-10 h-6 bg-white/20 rounded-full blur-[6px]"></div>
                            </div>
                        </div>
                    ))}
                </div>

                {/* CORE HOLOGRÀFIC I ESCANEIG */}
                <div className="absolute inset-[30%] rounded-full preserve-3d animate-[pulse-core_5s_ease-in-out_infinite] backface-hidden" style={{ transform: 'translateZ(90px)' }}>
                   <div className={`absolute inset-0 rounded-full blur-lg transition-colors duration-1000 ${loading ? 'bg-amber-500/60' : 'bg-sky-300/50'}`}></div>
                   <div className="absolute inset-3 rounded-full bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.9)_0%,rgba(56,189,248,0.3)_75%,transparent_100%)]"></div>
                   <div className="absolute inset-0 flex items-center justify-center">
                    {loading ? (
                      <Zap className="w-1/3 h-1/3 text-amber-200 animate-[thunder-bolt_3s_linear_infinite]" strokeWidth={1.5} />
                    ) : (
                      <CloudLightning className="w-1/3 h-1/3 text-white drop-shadow-[0_0_20px_rgba(255,255,255,1)]" strokeWidth={1} />
                    )}
                   </div>
                </div>

                <div className={`absolute inset-x-[-10%] preserve-3d animate-[vertical-scan_10s_ease-in-out_infinite] border-[3px] rounded-xl backface-hidden transition-colors ${loading ? 'border-amber-400/40 shadow-[0_0_30px_rgba(245,158,11,0.5)]' : 'border-sky-400/30 shadow-[0_0_25px_rgba(56,189,248,0.4)]'}`} style={{ transform: 'translateZ(100px)' }}>
                    <div className={`absolute inset-0 w-[400%] h-full text-[5px] font-mono font-black text-sky-200/10 animate-[data-stream-flow_1.5s_linear_infinite] uppercase overflow-hidden`} style={{ backgroundImage: 'repeating-linear-gradient(rgba(56,189,248,0.1) 0px, rgba(56,189,248,0.1) 1px, transparent 1px, transparent 10px)' }}>
                        {`...${Array(120).fill('TAW_AROME_DEEP_SCAN').join('...')}...`}
                    </div>
                </div>

                {/* SENSORS ORBITALS */}
                {orbitingSensors.map(({ Icon, color, angle, label, width }, i) => (
                  <div 
                    key={`sensor-${i}`}
                    className="absolute inset-0 preserve-3d"
                    style={{ transform: `rotateY(${angle}deg) translateZ(145px) scale(0.9)` }}
                  >
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-1.5 p-2 glass-panel rounded-lg transform rotateY(${-angle}deg) backface-hidden border border-sky-500/20 shadow-xl">
                      <Icon className={`w-4 h-4 sm:w-5 sm:h-5 ${color} animate-pulse`} />
                      <span className="text-[9px] font-mono tracking-wider font-bold text-slate-200 uppercase">{label}</span>
                      <div className={`w-10 h-0.5 ${loading ? 'bg-amber-500/40' : 'bg-sky-400/35'} rounded-full overflow-hidden mt-0.5`}>
                        <div className={`h-full ${loading ? 'bg-amber-400' : 'bg-sky-300'}`} style={{ width }}></div>
                      </div>
                    </div>
                  </div>
                ))}
            </div>
        </div>

        {/* PANELL PRINCIPAL */}
        <div className="flex flex-col items-center lg:items-start text-center lg:text-left w-full max-w-md shrink-0 z-30 gap-6">
            
            <div className="flex flex-col items-center lg:items-start w-full">
              <h1 className="text-5xl sm:text-6xl lg:text-7xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-br from-white via-sky-200 to-sky-500 drop-shadow-[0_0_25px_rgba(56,189,248,0.3)] animate-[title-shine_8s_linear_infinite] bg-[length:200%_auto]">
                METEOTONI
                <span className="text-sky-400 ml-2">AI</span>
              </h1>
              <div className="flex items-center gap-2 mt-2 px-3 py-1 rounded-full glass-panel border-sky-500/20">
                  <Activity className="w-3.5 h-3.5 text-sky-400 animate-pulse" />
                  <span className="text-[10px] sm:text-xs font-bold tracking-[0.2em] text-sky-100 uppercase">
                    {systemText.tagline}
                  </span>
              </div>
            </div>

            <div className="w-full glass-panel rounded-2xl p-4 sm:p-5 flex flex-col gap-5 border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.5)]">
              
              {/* SISTEMA DUAL DE COBERTURA */}
              <div className="w-full flex flex-col gap-2 bg-black/40 p-3 rounded-xl border border-white/5 shadow-inner">
                
                {/* Motor 1: AROME HD (Prioritari) */}
                <div className="flex flex-col gap-1">
                  <div className="flex justify-between items-center w-full">
                    <span className="text-[10px] sm:text-xs font-mono font-bold text-emerald-300">
                      {systemText.modelArome}
                    </span>
                    <span className="text-[10px] sm:text-xs font-mono font-bold text-emerald-400 animate-pulse">
                      {systemText.sysActive}
                    </span>
                  </div>
                  <div className="w-full h-1 bg-slate-800/80 rounded-full overflow-hidden relative">
                    <div className="absolute inset-0 w-3/4 bg-gradient-to-r from-transparent via-emerald-400/80 to-transparent animate-[telemetry-scan_2s_ease-in-out_infinite]"></div>
                  </div>
                </div>

                {/* Motor 2: GFS/WRF (Fallback Global) */}
                <div className="flex flex-col gap-1 pt-2 border-t border-white/10 mt-1">
                  <div className="flex justify-between items-center w-full opacity-75">
                    <span className="text-[9px] sm:text-[10px] font-mono font-semibold text-slate-400">
                      {systemText.modelFallback}
                    </span>
                    <span className="text-[9px] sm:text-[10px] font-mono font-semibold text-sky-400/80">
                      {systemText.sysAuto}
                    </span>
                  </div>
                  <div className="w-full h-[3px] bg-slate-800/80 rounded-full overflow-hidden relative">
                    <div className="absolute inset-0 w-1/2 bg-gradient-to-r from-transparent via-sky-400/30 to-transparent animate-[telemetry-scan_3s_ease-in-out_infinite]"></div>
                  </div>
                </div>
              </div>

              {/* BOTÓ D'ACCIÓ PRINCIPAL */}
              <button 
                  type="button"
                  onClick={onLocate}
                  disabled={loading}
                  className={`group relative w-full py-4 transition-all duration-300 overflow-hidden flex items-center justify-center rounded-xl border
                  ${loading 
                      ? 'cursor-wait bg-gradient-to-r from-amber-600 to-orange-700 border-amber-400 shadow-[0_0_30px_rgba(245,158,11,0.5)]' 
                      : 'cursor-pointer bg-gradient-to-r from-sky-500 to-indigo-600 border-sky-400/50 shadow-[0_0_25px_rgba(56,189,248,0.4)] hover:shadow-[0_0_40px_rgba(56,189,248,0.7)] hover:from-sky-400 hover:to-indigo-500 active:scale-[0.97]'
                  }`}
              >
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent w-[200%] animate-[title-shine_3s_linear_infinite] pointer-events-none"></div>
                  <div className="relative flex items-center gap-3 z-10">
                      {loading ? (
                          <>
                              <Loader2 className="w-5 h-5 text-white animate-spin drop-shadow-md" />
                              <span className="font-sans font-bold tracking-widest text-sm text-white uppercase drop-shadow-md">{systemText.loading}</span>
                          </>
                      ) : (
                          <>
                              <MapPin className="w-5 h-5 text-white group-hover:-translate-y-1 transition-transform duration-300 drop-shadow-[0_2px_5px_rgba(0,0,0,0.5)]" />
                              <span className="font-sans font-black tracking-[0.25em] text-lg text-white uppercase drop-shadow-[0_2px_5px_rgba(0,0,0,0.5)]">
                                  {systemText.start}
                              </span>
                          </>
                      )}
                  </div>
              </button>

              <div className="flex items-center justify-between w-full pt-1">
                  <button 
                      type="button"
                      onClick={openDiagnosticsModal}
                      className="flex items-center gap-1.5 group opacity-80 hover:opacity-100 transition-all cursor-pointer px-3 py-1.5 rounded-lg glass-panel-interactive border-white/10"
                  >
                      <HelpCircle className="w-4 h-4 text-sky-400 group-hover:scale-110 transition-transform" />
                      <span className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">
                          {systemText.manual}
                      </span>
                  </button>

                  <div className="flex gap-1 bg-black/30 p-1 rounded-full border border-white/5">
                      {(['ca', 'es', 'en', 'fr'] as Language[]).map((l) => (
                          <button
                              key={l}
                              type="button"
                              disabled={loading}
                              onClick={() => setLang(l)}
                              className={`
                                  px-3 py-1 font-sans text-[10px] font-bold uppercase transition-all duration-300 rounded-full
                                  ${lang === l 
                                      ? 'bg-sky-500 text-white shadow-[0_0_10px_rgba(56,189,248,0.5)]' 
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

      {/* MODAL I18N ENLLAÇAT */}
      {showDiagnostics && (
        <DiagnosticsModal
          onClose={closeDiagnosticsModal}
          lang={lang}
          t={t}
          wrfWindFormatted={systemText.sysAuto}
          aromeWindFormatted={systemText.sysActive}
        />
      )}

      {/* FOOTER TELEMÈTRIC */}
      <footer className="relative w-full border-t border-white/5 px-4 py-3 flex items-center justify-between z-40 shrink-0 bg-transparent mt-auto">
          <div className="flex items-center gap-2">
              <div className="relative flex items-center justify-center">
                <div className="absolute w-3 h-3 rounded-full bg-emerald-400 animate-ping opacity-60"></div>
                <div className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,1)]"></div>
              </div>
              <span className="text-[10px] font-bold text-emerald-200 tracking-widest uppercase">
                  {systemText.systemStatus}
              </span>
          </div>

          <div className="flex items-center gap-4">
              <div className="hidden xs:flex items-center gap-1.5 text-[10px] font-medium text-slate-400">
                  <ShieldCheck className="w-3.5 h-3.5 text-sky-400/80" /> {systemText.secure}
              </div>
              <div className="flex items-center gap-2 text-[10px] font-black text-slate-500 tracking-widest">
                  <span>© {year} MT-AI</span>
                  <span>v{safeVersion}</span>
              </div>
          </div>
      </footer>
    </div>
  );
}