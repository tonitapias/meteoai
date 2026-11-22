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
  LineChart,
  AlertTriangle,
  ChevronRight
} from 'lucide-react';
import { MATRIX_BG } from './widgetStyles';

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
// automàtica de model que ja fem servir a weatherApi.ts): "Global", com a ConsensusModal.tsx.
// Paraules senceres i no "GLO" ni "Δ", que no s'entenien (auditoria d'UX, segona volta, N4). Al mòbil cada magnitud
// és una fila (en tres columnes de 390 px no hi cabien les xifres); a partir de 768 px, tres columnes.
//
// Sense veredicte d'acord: abans hi havia "Precisió NN %" i "Alineat / Discrepància / Divergència", una puntuació
// sense calibrar feta amb l'hora actual del regional contra best_match, que contradeia a la mateixa pantalla el xip
// "Acord alt/mitjà/baix" dels gràfics (24 h, quatre models globals, calibrat). L'acord el diuen els gràfics; aquí
// només hi ha la diferència d'ara entre els dos models (auditoria d'UX del 16/11/2026, A2). `{model}` = AROME HD, etc.
const translations = {
  ca: {
    title: '{model} contra el global',
    subtitle: 'Diferència ara mateix',
    temp: 'Temperatura', rain: 'Pluja', snow: 'Neu', wind: 'Vent', diff: 'Diferència', secondary: 'Global',
    chartsBtn: 'Compara els models',
    futureDivergence: 'Possible canvi brusc en 3h (pluja forta o vent fort)'
  },
  es: {
    title: '{model} frente al global',
    subtitle: 'Diferencia ahora mismo',
    temp: 'Temperatura', rain: 'Lluvia', snow: 'Nieve', wind: 'Viento', diff: 'Diferencia', secondary: 'Global',
    chartsBtn: 'Compara los modelos',
    futureDivergence: 'Posible cambio brusco en 3h (lluvia o viento fuerte)'
  },
  en: {
    title: '{model} vs global',
    subtitle: 'Difference right now',
    temp: 'Temperature', rain: 'Rain', snow: 'Snow', wind: 'Wind', diff: 'Difference', secondary: 'Global',
    chartsBtn: 'Compare models',
    futureDivergence: 'Possible sudden shift in 3h (heavy rain or strong wind)'
  },
  fr: {
    title: '{model} face au global',
    subtitle: 'Écart en ce moment',
    temp: 'Température', rain: 'Pluie', snow: 'Neige', wind: 'Vent', diff: 'Écart', secondary: 'Global',
    chartsBtn: 'Comparer les modèles',
    futureDivergence: 'Changement brusque possible en 3h (pluie ou vent fort)'
  }
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

  // Neutre: sense semàfor, perquè la targeta no jutja si els models coincideixen. La fletxa només diu cap on va el global.
  const title = t.title.replace('{model}', regionalModelLabel);

  const renderTrend = (local: number | null | undefined, global: number | null | undefined, type: 'temp' | 'rain' | 'wind') => {
    if (!isValidNum(local) || !isValidNum(global) || local === global) return <MoveRight className="w-3.5 h-3.5 text-slate-400" aria-hidden="true" />;
    const isUp = global > local;
    let iconClass = "w-3.5 h-3.5 ";
    if (type === 'temp') iconClass += isUp ? "text-rose-500" : "text-sky-400";
    else if (type === 'rain') iconClass += isUp ? "text-sky-400" : "text-slate-400";
    else iconClass += isUp ? "text-amber-400" : "text-emerald-400";
    return isUp ? <ArrowUpRight className={iconClass} aria-hidden="true" /> : <ArrowDownRight className={iconClass} aria-hidden="true" />;
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
  const CARD_FOCUS = 'focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-400/60';

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

  // Les tres xifres d'ara: el model regional en gran, el global al costat i la diferència a la dreta. Una fila per
  // magnitud al mòbil; a partir de 768 px, tres columnes separades per línies fines. Cada una obre el seu detall.
  const cells: Array<{ type: 'temp' | 'rain' | 'wind'; icon: React.ReactNode; label: string; local: string; unit: string; global: string; delta: string; trend: React.ReactNode }> = [
    {
      type: 'temp',
      icon: <Thermometer className="w-3.5 h-3.5" aria-hidden="true" />,
      label: t.temp,
      local: `${formatVal(localTemp)}°`, unit: '',
      global: `${formatVal(metrics.globalTemp)}°`,
      delta: `${formatDelta(metrics.tempDiff)}°`,
      trend: renderTrend(localTemp, metrics.globalTemp, 'temp')
    },
    {
      type: 'rain',
      icon: isSnowRisk ? <CloudSnow className="w-3.5 h-3.5 text-sky-300" aria-hidden="true" /> : <CloudRain className="w-3.5 h-3.5" aria-hidden="true" />,
      label: isSnowRisk ? t.snow : t.rain,
      local: formatVal(localPrecip), unit: 'mm',
      global: `${formatVal(metrics.globalPrecip)} mm`,
      delta: formatDelta(metrics.precipDiff),
      trend: renderTrend(localPrecip, metrics.globalPrecip, 'rain')
    },
    {
      type: 'wind',
      icon: <Wind className="w-3.5 h-3.5" aria-hidden="true" />,
      label: t.wind,
      local: formatVal(localWind), unit: 'km/h',
      global: `${formatVal(metrics.globalWind)} km/h`,
      delta: formatDelta(metrics.windDiff),
      trend: renderTrend(localWind, metrics.globalWind, 'wind')
    }
  ];

  return (
    <>
      <section className="relative w-full overflow-hidden rounded-[2rem] border border-white/[0.07] bg-gradient-to-b from-[#0e1018] to-[#0a0b11]">
        <div className={MATRIX_BG}></div>

        <div className="relative z-10 flex flex-wrap items-end justify-between gap-x-4 gap-y-2 px-4 sm:px-5 md:px-6 pt-4 md:pt-5 pb-3">
          <div className="min-w-0">
            <span className="block font-mono text-[11px] uppercase tracking-[0.16em] text-slate-400">{t.subtitle}</span>
            <h2 className="mt-1 text-base font-semibold text-slate-100">{title}</h2>
          </div>
          <button
            type="button"
            onClick={() => openModal('charts')}
            className="inline-flex items-center gap-1.5 min-h-[36px] text-[13px] font-semibold text-indigo-300 hover:text-indigo-100 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-400 rounded-md"
          >
            <LineChart className="w-4 h-4" aria-hidden="true" />
            <span>{t.chartsBtn}</span>
            <ChevronRight className="w-3.5 h-3.5" aria-hidden="true" />
          </button>
        </div>

        {metrics.futureDivergence && (
          <div className="relative z-10 mx-4 sm:mx-5 md:mx-6 mb-3 flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2">
            <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400" aria-hidden="true" />
            <span className="text-xs font-semibold text-amber-200">{t.futureDivergence}</span>
          </div>
        )}

        <div className="relative z-10 grid grid-cols-1 md:grid-cols-3 border-t border-white/[0.06]">
          {cells.map((cell, i) => (
            <div
              key={cell.type}
              {...cardButtonProps(cell.type)}
              className={`group flex cursor-pointer items-center gap-3 px-4 sm:px-5 md:px-6 py-3.5 md:py-4 transition-colors hover:bg-white/[0.03] ${CARD_FOCUS} ${i > 0 ? 'border-t md:border-t-0 md:border-l border-white/[0.06]' : ''}`}
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 text-[13px] text-slate-400">{cell.icon}<span>{cell.label}</span></div>
                <div className="mt-0.5 flex flex-wrap items-baseline gap-x-2.5">
                  <span className="text-xl md:text-2xl font-semibold tracking-tight text-slate-50 tabular-nums">
                    {cell.local}{cell.unit && <span className="ml-1 text-xs font-normal text-slate-400">{cell.unit}</span>}
                  </span>
                  <span className="text-[13px] text-slate-400 tabular-nums"><span>{t.secondary}</span> <span className="text-slate-200">{cell.global}</span></span>
                </div>
              </div>
              <div className="shrink-0 text-right">
                <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-[#7a879b]">{t.diff}</div>
                <div className="mt-0.5 flex items-center justify-end gap-1 font-mono text-[13px] text-slate-200 tabular-nums">{cell.delta}{cell.trend}</div>
              </div>
              <ChevronRight className="w-4 h-4 shrink-0 text-slate-500 group-hover:text-slate-300 transition-colors" aria-hidden="true" />
            </div>
          ))}
        </div>
      </section>

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
          localLabel={regionalModelLabel}
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