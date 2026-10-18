// src/components/solar/SolarDayNav.tsx
// Navegador de dies: fletxes (aria-disabled als extrems, així el focus no cau mai al <body>), dia relatiu,
// data completa (regió viva: és l'únic que s'anuncia en canviar de dia) i la píndola "Avui".
import { memo, useRef } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { SolarStrings } from './solarI18n';

interface SolarDayNavProps {
  relLabel: string;
  dateLabel: string;
  dateId: string;
  isLive: boolean;
  canPrev: boolean;
  canNext: boolean;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
  /** Només els textos del navegador: el modal Fase lunar hi passa els seus. */
  t: Pick<SolarStrings, 'dayNav' | 'prevDay' | 'nextDay' | 'backToToday' | 'today'>;
}

export const SolarDayNav = memo(function SolarDayNav({
  relLabel, dateLabel, dateId, isLive, canPrev, canNext, onPrev, onNext, onToday, t,
}: SolarDayNavProps) {
  const dateRef = useRef<HTMLParagraphElement>(null);
  return (
    <nav className="sm-a-nav flex items-center gap-2 min-h-[44px]" aria-label={t.dayNav}>
      <button type="button" className="sm-btn sm-focus" aria-label={t.prevDay} aria-disabled={!canPrev} onClick={canPrev ? onPrev : undefined}>
        <ChevronLeft className="w-5 h-5" aria-hidden="true" />
      </button>
      <div className="flex-1 min-w-0 text-center">
        <p className={`sm-eyebrow${isLive ? ' sm-live' : ''}`}>{relLabel}</p>
        <p id={dateId} ref={dateRef} tabIndex={-1} aria-live="polite"
          className="text-[15px] md:text-[17px] leading-5 font-semibold text-slate-50 truncate outline-none">{dateLabel}</p>
      </div>
      {!isLive && (
        // La píndola desapareix en tornar a avui: abans, el focus passa a la data perquè no es perdi.
        <button type="button" className="sm-pill sm-focus" aria-label={t.backToToday}
          onClick={() => { dateRef.current?.focus(); onToday(); }}>{t.today}</button>
      )}
      <button type="button" className="sm-btn sm-focus" aria-label={t.nextDay} aria-disabled={!canNext} onClick={canNext ? onNext : undefined}>
        <ChevronRight className="w-5 h-5" aria-hidden="true" />
      </button>
    </nav>
  );
});
