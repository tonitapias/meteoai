// src/components/widgets/ConsensusWidget.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { ConsensusMetrics, HourlySeriesBundle } from '../../utils/consensusMath';
import { Language } from '../../translations';
import { ConsensusModal } from './ConsensusModal';
import { ConsensusChartsModal } from './ConsensusChartsModal';
import { formatDecimal } from '../../utils/formatters';
import {
  Thermometer,
  CloudRain,
  CloudSnow,
  Wind,
  ArrowUpRight,
  ArrowDownRight,
  MoveRight,
  Cpu,
  LineChart,
  AlertTriangle
} from 'lucide-react';

export type ModalType = 'temp' | 'rain' | 'wind' | 'charts';

interface ConsensusWidgetProps {
  metrics: ConsensusMetrics;
  localTemp: number | undefined;
  localPrecip: number | undefined;
  localWind: number | undefined;
  lang: Language | string;
  utcOffset?: number;
  regionalModelLabel?: string;
  hourlyTimes?: string[];
  hourlyGlobalTimes?: string[];
  hourlyLocal?: HourlySeriesBundle;
  hourlyGlobal?: HourlySeriesBundle;
  hourlyEcmwf?: HourlySeriesBundle;
  hourlyGfs?: HourlySeriesBundle;
  hourlyIcon?: HourlySeriesBundle;
  hourlyAifs?: HourlySeriesBundle;
}

// [FIX PRECISIÓ] La comparació és amb Open-Meteo "best_match" (el mateix motor de selecció
// automàtica de model que ja fem servir a weatherApi.ts). Fem servir "GLO"/"GLOBAL" — la
// mateixa etiqueta que ja feia servir ConsensusModal.tsx per a aquesta mateixa dada.
//
// Sense veredicte d'acord: abans hi havia "Precisió NN %" i "Alineat / Discrepància / Divergència", una puntuació
// sense calibrar feta amb l'hora actual del regional contra best_match, que contradeia a la mateixa pantalla el xip
// "Acord alt/mitjà/baix" dels gràfics (24 h, quatre models globals, calibrat). L'acord el diuen els gràfics; aquí
// només hi ha la diferència d'ara entre els dos models (auditoria d'UX del 16/11/2026, A2). `{model}` = AROME HD, etc.
const translations = {
  ca: {
    title: '{model} contra el global',
    subtitle: 'Diferència ara mateix',
    temp: 'TEMP', rain: 'PLUJA', snow: 'NEU', wind: 'VENT', diff: 'Δ', secondary: 'GLO',
    chartsBtn: 'Compara els models',
    futureDivergence: 'Possible canvi brusc en 3h (pluja forta o vent fort)'
  },
  es: {
    title: '{model} frente al global',
    subtitle: 'Diferencia ahora mismo',
    temp: 'TEMP', rain: 'LLUVIA', snow: 'NIEVE', wind: 'VIENTO', diff: 'Δ', secondary: 'GLO',
    chartsBtn: 'Compara los modelos',
    futureDivergence: 'Posible cambio brusco en 3h (lluvia o viento fuerte)'
  },
  en: {
    title: '{model} vs global',
    subtitle: 'Difference right now',
    temp: 'TEMP', rain: 'RAIN', snow: 'SNOW', wind: 'WIND', diff: 'Δ', secondary: 'GLO',
    chartsBtn: 'Compare models',
    futureDivergence: 'Possible sudden shift in 3h (heavy rain or strong wind)'
  },
  fr: {
    title: '{model} face au global',
    subtitle: 'Écart en ce moment',
    temp: 'TEMP', rain: 'PLUIE', snow: 'NEIGE', wind: 'VENT', diff: 'Δ', secondary: 'GLO',
    chartsBtn: 'Comparer les modèles',
    futureDivergence: 'Changement brusque possible en 3h (pluie ou vent fort)'
  }
};

// Un sol to, neutre: sense semàfor, perquè la targeta ja no jutja si els models coincideixen.
const THEME = {
  accent: 'text-indigo-300',
  border: 'border-indigo-500/20',
  bg: 'bg-indigo-500/10',
  glow: 'from-indigo-900/20',
  shadow: 'shadow-[0_15px_40px_rgba(99,102,241,0.12)]',
};

export const ConsensusWidget: React.FC<ConsensusWidgetProps> = ({
  metrics, localTemp, localPrecip, localWind, lang,
  utcOffset = 0, regionalModelLabel = 'LOC',
  hourlyTimes = [], hourlyGlobalTimes = [], hourlyLocal = {}, hourlyGlobal = {},
  hourlyEcmwf = {}, hourlyGfs = {}, hourlyIcon = {}, hourlyAifs = {}
}) => {
  const [activeModal, setActiveModal] = useState<ModalType | null>(null);
  const [nowTimestamp, setNowTimestamp] = useState(() => Date.now());
  
  const safeLang = lang in translations ? (lang as keyof typeof translations) : 'en';
  const t = translations[safeLang];

  // DOCTRINA RISC ZERO: Validació estricta de números
  const isValidNum = (val: unknown): val is number => typeof val === 'number' && !Number.isNaN(val);
  
  const safeLocalTemp = isValidNum(localTemp) ? localTemp : undefined;
  const safeGlobalTemp = isValidNum(metrics.globalTemp) ? metrics.globalTemp : null;
  const isSnowRisk = (safeLocalTemp !== undefined && safeLocalTemp <= 2) || (safeGlobalTemp !== null && safeGlobalTemp <= 2);

  const theme = THEME;
  const title = t.title.replace('{model}', regionalModelLabel);

  const renderTrend = (local: number | null | undefined, global: number | null | undefined, type: 'temp' | 'rain' | 'wind') => {
    if (!isValidNum(local) || !isValidNum(global) || local === global) return <MoveRight className="w-4 h-4 text-slate-500" />;
    const isUp = global > local;
    let iconClass = "w-4 h-4 transition-transform duration-300 drop-shadow-sm ";
    if (type === 'temp') iconClass += isUp ? "text-rose-500" : "text-sky-400";
    else if (type === 'rain') iconClass += isUp ? "text-sky-400" : "text-slate-500";
    else iconClass += isUp ? "text-amber-400" : "text-emerald-400";
    return isUp ? <ArrowUpRight className={iconClass} /> : <ArrowDownRight className={iconClass} />;
  };

  // Decimals en el format de l'idioma ("18,3", no "18.3"), com la resta de l'app.
  const formatVal = (val: number | null | undefined) => isValidNum(val) ? formatDecimal(val, safeLang, 1, true) : '--';
  const formatDelta = (val: number | null | undefined) => isValidNum(val) ? formatDecimal(val, safeLang) : '--';

  // PROTECCIÓ HISTORY API: Prevé dobles clicks ràpids que trenquen el "botó enrere" natiu
  const openModal = useCallback((type: ModalType) => {
    if (activeModal) return;
    setNowTimestamp(Date.now());
    window.history.pushState({ modalOpen: 'consensus' }, '');
    setActiveModal(type);
  }, [activeModal]);

  // Targetes que obren el detall: també amb el teclat i el lector de pantalla (mateix patró que WidgetCard de DetailWidgetsGrid).
  const cardButtonProps = (type: ModalType) => ({
    onClick: () => openModal(type),
    role: 'button' as const,
    tabIndex: 0,
    onKeyDown: (e: React.KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openModal(type); } }
  });
  const CARD_FOCUS = 'focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/60';

  const closeModal = useCallback(() => {
    setActiveModal(null);
    if (window.history.state?.modalOpen === 'consensus') {
        window.history.back();
    }
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => { 
        if (e.key === 'Escape' && activeModal) closeModal();
    };
    const handlePopState = () => { if (activeModal) setActiveModal(null); };
    
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('popstate', handlePopState);
    return () => { 
        window.removeEventListener('keydown', handleKeyDown); 
        window.removeEventListener('popstate', handlePopState); 
    };
  }, [activeModal, closeModal]);

  // Bloqueig del scroll de la pàgina de darrere mentre un modal és obert (com la resta de modals).
  const isModalOpen = activeModal !== null;
  useEffect(() => {
      if (!isModalOpen) return;
      const original = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = original; };
  }, [isModalOpen]);

  return (
    <>
      <div className="w-full relative perspective-[2000px]">
        {/* SPATIAL UI: Animacions restringides a Desktop (md:) per estalviar bateria operativa en mòbil */}
        <style>
          {`
            @keyframes spatial-float-pc { 0%, 100% { transform: rotateX(1deg) rotateY(-0.5deg) translateY(0px); } 50% { transform: rotateX(-0.5deg) rotateY(0.5deg) translateY(-2px); } }
            .preserve-3d { transform-style: preserve-3d; }
          `}
        </style>

        <div className={`w-full relative bg-[#060913]/90 border ${theme.border} rounded-[24px] md:rounded-[32px] ${theme.shadow} preserve-3d md:animate-[spatial-float-pc_10s_ease-in-out_infinite] transition-transform duration-500`}>
           <div className="absolute inset-0 overflow-hidden rounded-[24px] md:rounded-[32px]">
              <div className={`absolute inset-0 bg-[linear-gradient(currentColor_1px,transparent_1px),linear-gradient(90deg,currentColor_1px,transparent_1px)] bg-[size:24px_24px] md:bg-[size:32px_32px] opacity-[0.03] [transform:translateZ(-50px)] ${theme.accent}`}></div>
              <div className={`absolute inset-0 bg-gradient-to-br ${theme.glow} to-transparent opacity-60 md:opacity-40`}></div>
           </div>

           <div className="p-4 sm:p-6 md:p-8 flex flex-col gap-6 md:gap-8 relative z-10 preserve-3d">
              <div className="flex flex-col sm:flex-row sm:justify-between items-start sm:items-center w-full gap-4 sm:gap-0 [transform:translateZ(30px)]">
                 <div className="flex items-center gap-3 md:gap-4">
                    <div className={`w-9 h-9 md:w-12 md:h-12 rounded-xl md:rounded-2xl bg-[#0a0f1c] border ${theme.border} flex items-center justify-center shadow-[inset_0_0_15px_rgba(0,0,0,0.8)] relative overflow-hidden`}>
                       <Cpu className={`w-4 h-4 md:w-5 md:h-5 ${theme.accent} relative z-10 drop-shadow-[0_0_8px_currentColor]`} />
                       {/* Animació pulse només visible a Desktop o evitada si es vol màxim estalvi */}
                       <div className={`absolute inset-0 opacity-20 md:animate-pulse ${theme.bg}`}></div>
                    </div>
                    <div>
                       <h2 className="text-xs md:text-sm font-black text-white uppercase tracking-[0.2em] drop-shadow-md">{title}</h2>
                       <span className={`block mt-0.5 md:mt-1 text-[10px] sm:text-[11px] md:text-xs font-black uppercase tracking-widest ${theme.accent} drop-shadow-sm`}>{t.subtitle}</span>
                    </div>
                 </div>
              </div>

              {metrics.futureDivergence && (
                <div className="flex items-center gap-2 md:gap-3 bg-amber-500/10 border border-amber-500/30 rounded-xl md:rounded-2xl px-3 md:px-4 py-2 md:py-2.5 [transform:translateZ(35px)] shadow-[0_8px_20px_rgba(245,158,11,0.15)]">
                   <AlertTriangle className="w-4 h-4 md:w-5 md:h-5 text-amber-400 shrink-0 drop-shadow-md animate-pulse" />
                   <span className="text-[10px] sm:text-[11px] md:text-xs font-bold text-amber-200 tracking-wide">{t.futureDivergence}</span>
                </div>
              )}

              <div className="grid grid-cols-3 gap-2 sm:gap-4 md:gap-6 w-full preserve-3d [transform:translateZ(40px)]">
                 {/* MIDES DE TEXT I CONTRAST MILLORATS PER A LECTURA EXTERIOR */}
                 <div {...cardButtonProps('temp')} className={`cursor-pointer ${CARD_FOCUS} group relative bg-black/40 transition-all duration-300 rounded-[20px] md:rounded-[24px] p-3 sm:p-4 md:p-5 border border-white/10 flex flex-col items-center justify-between shadow-[0_10px_30px_rgba(0,0,0,0.6)] hover:border-rose-500/30 hover:bg-black/60 md:hover:-translate-y-1 active:scale-95`}>
                    <div className="flex items-center gap-1.5 md:gap-2 text-slate-300 mb-2 sm:mb-3 md:mb-4">
                        <Thermometer className="w-4 h-4 md:w-5 md:h-5 group-hover:text-rose-500 transition-colors duration-300 drop-shadow-md" />
                        <span className="text-[10px] sm:text-[11px] md:text-xs font-black tracking-widest drop-shadow-sm">{t.temp}</span>
                    </div>
                    <div className="flex flex-col items-center mb-4 md:mb-5">
                        <div className="text-2xl sm:text-3xl md:text-4xl font-black text-white leading-none tracking-tighter drop-shadow-lg">{formatVal(localTemp)}<span className="text-xs sm:text-sm text-slate-400 font-bold ml-0.5">°</span></div>
                        <div className="text-[10px] sm:text-[11px] font-medium text-slate-400 mt-1.5 flex gap-1 items-baseline">{t.secondary} <span className="text-slate-200 font-black">{formatVal(metrics.globalTemp)}°</span></div>
                    </div>
                    <div className="w-full bg-black/80 rounded-xl py-2 flex justify-center items-center gap-2 border border-white/5 shadow-inner">
                        <span className="text-[10px] md:text-[11px] text-slate-500 font-black">{t.diff}</span>
                        <div className="flex items-center gap-1 text-[11px] sm:text-xs font-black text-white">{formatDelta(metrics.tempDiff)}° {renderTrend(localTemp, metrics.globalTemp, 'temp')}</div>
                    </div>
                 </div>

                 <div {...cardButtonProps('rain')} className={`cursor-pointer ${CARD_FOCUS} group relative bg-black/40 transition-all duration-300 rounded-[20px] md:rounded-[24px] p-3 sm:p-4 md:p-5 border flex flex-col items-center justify-between shadow-[0_10px_30px_rgba(0,0,0,0.6)] hover:bg-black/60 md:hover:-translate-y-1 active:scale-95 ${isSnowRisk ? 'border-sky-500/30' : 'border-white/10 hover:border-sky-500/30'}`}>
                    {isSnowRisk && <div className="absolute inset-0 bg-sky-500/10 rounded-[20px] md:rounded-[24px] animate-pulse pointer-events-none"></div>}
                    <div className={`flex items-center gap-1.5 md:gap-2 mb-2 sm:mb-3 md:mb-4 ${isSnowRisk ? 'text-sky-300 drop-shadow-[0_0_8px_currentColor]' : 'text-slate-300'}`}>
                        {isSnowRisk ? <CloudSnow className="w-4 h-4 md:w-5 md:h-5 text-white transition-colors duration-300" /> : <CloudRain className="w-4 h-4 md:w-5 md:h-5 group-hover:text-sky-400 transition-colors duration-300 drop-shadow-md" />}
                        <span className="text-[10px] sm:text-[11px] md:text-xs font-black tracking-widest drop-shadow-sm">{isSnowRisk ? t.snow : t.rain}</span>
                    </div>
                    <div className="flex flex-col items-center mb-4 md:mb-5">
                        <div className="flex items-baseline leading-none tracking-tighter drop-shadow-lg"><span className="text-2xl sm:text-3xl md:text-4xl font-black text-white">{formatVal(localPrecip)}</span><span className="text-[10px] sm:text-xs text-slate-400 font-bold ml-1">mm</span></div>
                        <div className="text-[10px] sm:text-[11px] font-medium text-slate-400 mt-1.5 flex gap-1 items-baseline">{t.secondary} <span className="text-slate-200 font-black">{formatVal(metrics.globalPrecip)}<span className="text-[9px] font-normal text-slate-400 ml-[1px]">mm</span></span></div>
                    </div>
                    <div className="w-full bg-black/80 rounded-xl py-2 flex justify-center items-center gap-2 border border-white/5 shadow-inner">
                        <span className="text-[10px] md:text-[11px] text-slate-500 font-black">{t.diff}</span>
                        <div className="flex items-center gap-1 text-[11px] sm:text-xs font-black text-white">{formatDelta(metrics.precipDiff)} {renderTrend(localPrecip, metrics.globalPrecip, 'rain')}</div>
                    </div>
                 </div>

                 <div {...cardButtonProps('wind')} className={`cursor-pointer ${CARD_FOCUS} group relative bg-black/40 transition-all duration-300 rounded-[20px] md:rounded-[24px] p-3 sm:p-4 md:p-5 border border-white/10 flex flex-col items-center justify-between shadow-[0_10px_30px_rgba(0,0,0,0.6)] hover:border-amber-500/30 hover:bg-black/60 md:hover:-translate-y-1 active:scale-95`}>
                    <div className="flex items-center gap-1.5 md:gap-2 text-slate-300 mb-2 sm:mb-3 md:mb-4">
                        <Wind className="w-4 h-4 md:w-5 md:h-5 group-hover:text-amber-400 transition-colors duration-300 drop-shadow-md" />
                        <span className="text-[10px] sm:text-[11px] md:text-xs font-black tracking-widest drop-shadow-sm">{t.wind}</span>
                    </div>
                    <div className="flex flex-col items-center mb-4 md:mb-5">
                        <div className="flex items-baseline leading-none tracking-tighter drop-shadow-lg"><span className="text-2xl sm:text-3xl md:text-4xl font-black text-white">{formatVal(localWind)}</span><span className="text-[10px] sm:text-xs text-slate-400 font-bold ml-1">km/h</span></div>
                        <div className="text-[10px] sm:text-[11px] font-medium text-slate-400 mt-1.5 flex gap-1 items-baseline">{t.secondary} <span className="text-slate-200 font-black">{formatVal(metrics.globalWind)}<span className="text-[9px] font-normal text-slate-400 ml-[1px]">km/h</span></span></div>
                    </div>
                    <div className="w-full bg-black/80 rounded-xl py-2 flex justify-center items-center gap-2 border border-white/5 shadow-inner">
                        <span className="text-[10px] md:text-[11px] text-slate-500 font-black">{t.diff}</span>
                        <div className="flex items-center gap-1 text-[11px] sm:text-xs font-black text-white">{formatDelta(metrics.windDiff)} {renderTrend(localWind, metrics.globalWind, 'wind')}</div>
                    </div>
                 </div>
              </div>

              <div className="w-full [transform:translateZ(20px)] mt-[-10px] md:mt-[-15px]">
                  <button 
                     onClick={() => openModal('charts')}
                     className="w-full relative group overflow-hidden bg-black/60 border border-white/10 hover:border-cyan-500/40 rounded-xl md:rounded-2xl py-3 md:py-4 flex items-center justify-center gap-3 transition-all duration-300 shadow-[inset_0_0_20px_rgba(0,0,0,0.8)] active:scale-[0.98]"
                  >
                     <LineChart className="w-4 h-4 md:w-5 md:h-5 text-cyan-400 group-hover:text-cyan-300 drop-shadow-[0_0_8px_currentColor] transition-colors relative z-10" />
                     <span className="text-[11px] sm:text-xs md:text-sm font-black text-cyan-100 group-hover:text-white uppercase tracking-[0.2em] relative z-10 transition-colors drop-shadow-md">
                        {t.chartsBtn}
                     </span>
                  </button>
              </div>

           </div>
        </div>
      </div>

      {/* Els modals van a document.body: dins del tauler, algun contenidor amb transform crea un context d'apilament
          propi i la capçalera de la pàgina (z-50) es pintava per sobre del modal (z-100) quan era visible. */}
      {activeModal && activeModal !== 'charts' && createPortal(
        <ConsensusModal
          activeModal={activeModal}
          closeModal={closeModal}
          lang={lang}
          utcOffset={utcOffset}
          nowTimestamp={nowTimestamp}
          hourlyTimes={hourlyTimes}
          hourlyGlobalTimes={hourlyGlobalTimes}
          hourlyLocal={hourlyLocal}
          hourlyGlobal={hourlyGlobal}
        />,
        document.body
      )}
      
      {activeModal === 'charts' && createPortal(
        <ConsensusChartsModal
          closeModal={closeModal}
          lang={lang}
          utcOffset={utcOffset}
          nowTimestamp={nowTimestamp}
          hourlyTimes={hourlyTimes}
          hourlyGlobalTimes={hourlyGlobalTimes}
          regionalModelLabel={regionalModelLabel}
          hourlyLocal={hourlyLocal}
          hourlyGlobal={hourlyGlobal}
          hourlyEcmwf={hourlyEcmwf}
          hourlyGfs={hourlyGfs}
          hourlyIcon={hourlyIcon}
          hourlyAifs={hourlyAifs}
        />,
        document.body
      )}
    </>
  );
};