// src/components/solar/SolarTrajectoryCard.tsx
// "Alçada del sol": lectura de mida fixa (hora, ARA/MIGDIA, azimut, alçada, ombra i fase), el gràfic (que és
// el control lliscant) i la llegenda. React només és amo dels atributs data-live/data-pinned i de l'aria;
// fase, arrossegament, textos de la lectura, marcador i cursor els escriu el motor (useSolarScrub).
import { memo, useCallback, useMemo, useRef, useState } from 'react';
import { RotateCcw } from 'lucide-react';
import * as SunCalc from 'suncalc';
import type { Language } from '../../translations';
import { getCardinalLabel } from '../../utils/astronomyMath';
import { type SolarDayModel, clockAtMinute, geometricAltitude, lightPhase } from '../../utils/solar/solarDay';
import { buildChartGeom, chartLayout, plotBackground } from '../../utils/solar/solarChart';
import { signedDeg } from '../../utils/solar/solarFormat';
import { formatDateStr } from '../../utils/solar/solarTime';
import { PHASE_KEY, fill, solarLocale, type SolarStrings } from './solarI18n';
import { SolarChartSvg } from './SolarChartSvg';
import type { ScrubChannel } from './scrubChannel';
import { useSolarScrub, useTextSlot } from './useSolarScrub';

/** Mida de reserva del gràfic (jsdom, contenidor ocult): la del mòbil de 360 px. */
const FALLBACK_W = 328;
const FALLBACK_H = 156;

export interface TrajectoryIds { trajTitle: string; hint: string }

interface SolarTrajectoryCardProps {
  model: SolarDayModel;
  /** Sostre de l'eix Y per a tota la finestra de 15 dies (la geometria no salta en canviar de dia). */
  altMax: number;
  isLive: boolean;
  /** Minut actual dins del dia d'avui, o null. */
  nowMinute: number | null;
  /** Minut fixat per l'usuari en aquest dia, o null. */
  pinMinute: number | null;
  onCommit: (minute: number | null) => void;
  channel: ScrubChannel | null;
  lang: Language;
  t: SolarStrings;
  ids: TrajectoryIds;
}

type Size = { w: number; h: number };

const r1 = (v: number) => Math.round(v * 10) / 10;
const lowerFirst = (s: string, lang: Language) => (s ? s.charAt(0).toLocaleLowerCase(lang) + s.slice(1) : s);

export const SolarTrajectoryCard = memo(function SolarTrajectoryCard({
  model, altMax, isLive, nowMinute, pinMinute, onCommit, channel, lang, t, ids,
}: SolarTrajectoryCardProps) {
  const cardRef = useRef<HTMLElement | null>(null);
  const plotRef = useRef<HTMLDivElement | null>(null);
  const markerRef = useRef<HTMLDivElement | null>(null);
  const cursorRef = useRef<HTMLDivElement | null>(null);
  const [timeRef, timeEl] = useTextSlot();
  const [tagRef, tagEl] = useTextSlot();
  const [coordsRef, coordsEl] = useTextSlot();
  const [phaseRef, phaseEl] = useTextSlot();

  // Mida del gràfic: es mesura en enganxar l'element (abans del primer pintat, així el gràfic surt al
  // primer fotograma) i després només quan canvia de debò. clientWidth/Height no depenen de transforms.
  const [size, setSize] = useState<Size | null>(null);
  const attachPlot = useCallback((el: HTMLDivElement | null) => {
    plotRef.current = el;
    if (!el) return;
    const apply = (w: number, h: number) => {
      const next = { w: Math.round(w) || FALLBACK_W, h: Math.round(h) || FALLBACK_H };
      setSize(prev => (prev && prev.w === next.w && prev.h === next.h ? prev : next));
    };
    apply(el.clientWidth, el.clientHeight);
    if (typeof ResizeObserver === 'function') {
      const ro = new ResizeObserver(entries => {
        const r = entries[0]?.contentRect;
        if (r && r.width > 0 && r.height > 0) apply(r.width, r.height);
      });
      ro.observe(el);
      return () => { ro.disconnect(); plotRef.current = null; };
    }
    const onResize = () => apply(el.clientWidth, el.clientHeight);
    window.addEventListener('resize', onResize);
    return () => { window.removeEventListener('resize', onResize); plotRef.current = null; };
  }, []);

  const L = useMemo(() => (size ? chartLayout(size.w, size.h, altMax, model.spanMin) : null), [size, altMax, model.spanMin]);
  const geom = useMemo(() => (L ? buildChartGeom(model, L) : null), [model, L]);
  // Cel real de cada hora + bandes de crepuscle: capes de fons del mateix element (0 nodes).
  const plotBgStyle = useMemo(() => (L ? plotBackground(model, L) : undefined), [model, L]);

  const unpinnedMinute = isLive && nowMinute !== null ? nowMinute : model.noonMin;
  const committedMinute = pinMinute ?? unpinnedMinute;
  const tag = pinMinute !== null ? '' : isLive && nowMinute !== null ? t.tagNow : t.tagNoon;

  // Valor accessible de l'slider: amb el focus a sobre i sense fixar, avui, el minut "ara" avança sol cada
  // minut; un lector de pantalla anunciaria cada canvi. Mentre té el focus es congela al valor d'en arribar-hi
  // (el marcador i la lectura visual sí que segueixen l'hora); una tecla o un toc el tornen a actualitzar.
  const [focusMinute, setFocusMinute] = useState<number | null>(null);
  const ariaMinute = pinMinute === null && focusMinute !== null ? Math.min(focusMinute, model.spanMin) : committedMinute;

  const longDate = useMemo(() => formatDateStr(model.dateStr, solarLocale(lang), 'long'), [model.dateStr, lang]);
  // Text de l'slider: només canvia en confirmar (mai per fotograma).
  const valueText = useMemo(() => {
    const p = SunCalc.getPosition(new Date(model.startMs + ariaMinute * 60000), model.lat, model.lon);
    const az = ((Math.round(p.azimuth) % 360) + 360) % 360;
    return fill(t.valueText, {
      time: clockAtMinute(model, ariaMinute),
      az: `${az}° ${getCardinalLabel(p.azimuth, lang)}`,
      alt: signedDeg(p.altitude),
      phase: t[PHASE_KEY[lightPhase(geometricAltitude(p.altitude))]],
    });
  }, [model, ariaMinute, lang, t]);

  const handlers = useSolarScrub({
    model, L, lang, t, channel, committedMinute, tag, onCommit,
    cardRef, plotRef, markerRef, cursorRef, timeRef, tagRef, coordsRef, phaseRef,
  });

  const nowX = isLive && nowMinute !== null && L ? r1(L.x(nowMinute)) : null;
  const lineBox = useMemo(() => (L ? { top: L.top, height: L.bottom - L.top } : undefined), [L]);
  const resetText = isLive ? t.tagNow : t.tagNoon;

  return (
    <section ref={cardRef} className="sm-card sm-traj sm-a-traj" aria-labelledby={ids.trajTitle}
      data-live={isLive && pinMinute === null ? '1' : '0'} data-pinned={pinMinute !== null ? '1' : '0'}>
      <div className="flex items-center justify-between gap-2 h-5">
        <h3 id={ids.trajTitle} className="sm-eyebrow">{t.trajectoryTitle}</h3>
        <span ref={phaseEl} className="sm-phase" aria-hidden="true" />
      </div>
      <div className="sm-readout">
        {/* El botó de tornar comparteix la fila curta de l'hora; les coordenades tenen tota l'amplada. */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-baseline min-w-0" aria-hidden="true">
            <span ref={timeEl} className="sm-time font-mono" /><span ref={tagEl} className="sm-eyebrow sm-tag" />
          </div>
          {pinMinute !== null && (
            // El nom accessible comença pel text visible (WCAG 2.5.3): "Ara, torna a l'hora actual".
            <button type="button" className="sm-pill sm-pill-sm sm-focus" aria-label={`${resetText}, ${lowerFirst(isLive ? t.resetToNow : t.resetToNoon, lang)}`}
              onClick={() => { plotRef.current?.focus(); onCommit(null); }}>
              <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />{resetText}
            </button>
          )}
        </div>
        <span ref={coordsEl} className="sm-coords" aria-hidden="true" />
      </div>
      <div ref={attachPlot} className="sm-plot" style={plotBgStyle} data-no-swipe="" role="slider" tabIndex={0}
        aria-label={fill(t.sliderLabel, { date: longDate })} aria-describedby={ids.hint}
        aria-valuemin={0} aria-valuemax={model.spanMin} aria-valuenow={ariaMinute} aria-valuetext={valueText}
        onFocus={() => setFocusMinute(unpinnedMinute)} onBlur={() => setFocusMinute(null)}
        {...handlers}>
        {geom && <SolarChartSvg geom={geom} />}
        {nowX !== null && lineBox && (
          <div className="sm-now" aria-hidden="true" style={{ transform: `translate(${nowX}px,0)`, ...lineBox }} />
        )}
        <div ref={cursorRef} className="sm-cursor" aria-hidden="true" style={lineBox} />
        <div ref={markerRef} className="sm-marker" aria-hidden="true" />
      </div>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-[11px] leading-4 text-slate-400">
        <div className="flex flex-wrap gap-x-3 gap-y-1" aria-hidden="true">
          <span className="sm-lg sm-lg-golden">{t.phaseGolden}</span>
          <span className="sm-lg sm-lg-blue">{t.phaseBlue}</span>
          <span className="sm-lg sm-lg-tw">{t.legendTwilight}</span>
        </div>
        <span id={ids.hint}>{t.scrubHint}</span>
      </div>
    </section>
  );
});
