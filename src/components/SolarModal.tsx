// src/components/SolarModal.tsx
// Modal "Cicle solar", pensat per a mòbils de gamma baixa: cap filtre ni animació en bucle, superfícies
// opaques i un sol SVG estàtic per dia. Arrel: closca (Escape, scroll, rellotge de 30 s), focus del diàleg,
// dia triat i minut fixat, models del dia (memòria cau de mòdul), valors derivats de "ara", graella,
// tecles ←/→ i lliscament per canviar de dia. Cada secció és memo i rep props estables.
//
// Fonts: hores, posicions i durades són càlcul astronòmic (suncalc) en el fus de la UBICACIÓ; la sortida i
// la posta dels dies que té Open-Meteo són les seves mateixes hores (paritat amb la targeta del tauler) si
// quadren amb l'astronomia; UV, hores de sol i radiació són previsió d'Open-Meteo.
import {
  useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type TouchEvent,
} from 'react';
import * as SunCalc from 'suncalc';
import type { ExtendedWeatherData, LocationMeta } from '../types/weatherLogicTypes';
import type { Language } from '../translations';
import { useAstroModalShell } from '../hooks/useAstroModalShell';
import { useDialogFocus } from '../hooks/useDialogFocus';
import { swipeDirection } from '../utils/dayNavigation';
import {
  addDays, diffDays, formatDateStr, formatUtcOffset, localClock, localDateOf, makeZoneCtx,
} from '../utils/solar/solarTime';
import {
  type CellId, type CellState, RISE_SET_GEO, astroLengthFor, buildSolarDay, ephemerisCellStates, geometricAltitude,
  nextEvent, noonAltFor, rangeAltMax, upcomingRiseSet,
} from '../utils/solar/solarDay';
import { capitalize, formatCountdown, formatDeltaLong, formatLatLon, untilDateText } from '../utils/solar/solarFormat';
import {
  type SolarDaily, type SolarHourly, forecastFor, lastDailyDate, lastForecastDate, omEdgesFor,
} from '../utils/solar/solarForecast';
import { STARS_DAY, STARS_NIGHT } from '../utils/solar/solarSky';
import { EVENT_KEY, SOLAR_LOCALE, SOLAR_T, fill, solarLang } from './solar/solarI18n';
import { SolarHeader } from './solar/SolarHeader';
import { SolarDayNav } from './solar/SolarDayNav';
import { SolarHero, type HeroDelta } from './solar/SolarHero';
import { SolarTrajectoryCard } from './solar/SolarTrajectoryCard';
import { SolarForecastCard } from './solar/SolarForecastCard';
import { SolarEphemeris } from './solar/SolarEphemeris';
import { SolarAlmanac } from './solar/SolarAlmanac';
import { SolarCompass } from './solar/SolarCompass';
import { createScrubChannel } from './solar/scrubChannel';
import { useMinWidth } from './solar/useMinWidth';
import { isSolarSkeletonOnScreen } from './solar/preloadSolarModal';
import './solar/solarModal.css';

interface SolarModalProps {
  weatherData: ExtendedWeatherData;
  onClose: () => void;
  lang?: Language;
}

type Theme = 'day' | 'night';
type Pin = { date: string; minute: number };

/** Últim dia navegable: avui + 14 (la finestra del calendari). */
const LAST_OFFSET = 14;
const LG_QUERY = '(min-width:1024px) and (min-height:481px)';

// Fons del full: estrelles estàtiques (rajola SVG), resplendor de dalt i degradat. Constants de mòdul:
// la identitat de l'estil no canvia mai i es pinta un sol cop.
const sheetStyle = (stars: string, glow: string, glow0: string, g: readonly string[]): CSSProperties => ({
  backgroundImage: `${stars},radial-gradient(70% 100% at 50% 0%,${glow},${glow0} 100%),`
    + `linear-gradient(180deg,${g[0]} 0%,${g[1]} 30%,${g[2]} 65%,${g[3]} 100%)`,
  backgroundSize: '360px 220px,100% 320px,100% 100%',
  backgroundRepeat: 'repeat-x,no-repeat,no-repeat',
  backgroundPosition: '50% 0,50% 0,0 0',
});
const SHEET_STYLE: Readonly<Record<Theme, CSSProperties>> = {
  day: sheetStyle(STARS_DAY, 'rgba(251,191,36,.14)', 'rgba(251,191,36,0)', ['#1c1307', '#110c05', '#08080a', '#060609']),
  night: sheetStyle(STARS_NIGHT, 'rgba(129,140,248,.12)', 'rgba(129,140,248,0)', ['#0e1222', '#090b16', '#07080d', '#060609']),
};

export default function SolarModal({ weatherData, onClose, lang = 'ca' }: SolarModalProps) {
  const language = solarLang(lang);
  const t = SOLAR_T[language];
  const locale = SOLAR_LOCALE[language];

  const loc = weatherData.location as LocationMeta | undefined;
  const lat = typeof loc?.latitude === 'number' ? loc.latitude : NaN;
  const lon = typeof loc?.longitude === 'number' ? loc.longitude : NaN;
  const coordsOk = Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180;
  const timezone = typeof weatherData.timezone === 'string' ? weatherData.timezone : null;
  const utcOffsetSec = typeof weatherData.utc_offset_seconds === 'number' ? weatherData.utc_offset_seconds : 0;
  const daily = weatherData.daily as SolarDaily | undefined;
  const hourly = weatherData.hourly as SolarHourly | undefined;
  const location = typeof loc?.name === 'string' && loc.name.trim() !== '' ? loc.name : t.subtitleFallback;

  // --- Closca: Escape, bloqueig de scroll i rellotge de 30 s; focus atrapat i retornat a la targeta ---
  const { handleClose, now } = useAstroModalShell(onClose);
  const rootRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  useDialogFocus(true, rootRef);
  // Lectura pura (segura amb StrictMode): si aquest render pren el relleu de l'esquelet de càrrega (encara
  // a la pantalla), ni el full ni el vel tornen a fer l'entrada, per molt que hagi trigat la càrrega.
  const [skipEnter] = useState(isSolarSkeletonOnScreen);
  const [channel] = useState(createScrubChannel);
  const isLg = useMinWidth(LG_QUERY);

  const titleId = useId();
  const dateId = useId();
  const trajTitleId = useId();
  const hintId = useId();
  const trajIds = useMemo(() => ({ trajTitle: trajTitleId, hint: hintId }), [trajTitleId, hintId]);

  // --- Dia consultat ---
  const zone = useMemo(() => makeZoneCtx(timezone, utcOffsetSec), [timezone, utcOffsetSec]);
  const nowMs = now.getTime();
  const liveDate = useMemo(() => localDateOf(nowMs, zone), [nowMs, zone]);

  const [selectedDate, setSelectedDate] = useState<string | null>(null);   // null = avui (viu)
  const [pin, setPin] = useState<Pin | null>(null);

  // Una data guardada que ja ha passat (modal obert de nit) torna a avui; mai més enllà de la finestra.
  const viewDate = useMemo(() => {
    if (selectedDate === null || selectedDate <= liveDate) return liveDate;
    return diffDays(liveDate, selectedDate) > LAST_OFFSET ? addDays(liveDate, LAST_OFFSET) : selectedDate;
  }, [selectedDate, liveDate]);
  const offset = diffDays(liveDate, viewDate);
  const isLive = offset === 0;
  // Només val per al seu dia (p. ex. si avui passa a ser un altre dia a mitjanit); en navegar es descarta.
  const pinMinute = pin !== null && pin.date === viewDate ? pin.minute : null;

  // --- Models del dia (memòria cau LRU de mòdul: anar i tornar entre dies no recalcula res) ---
  const liveModel = useMemo(
    () => (coordsOk ? buildSolarDay({ dateStr: liveDate, lat, lon, zone, ...omEdgesFor(daily, liveDate) }) : null),
    [coordsOk, liveDate, lat, lon, zone, daily],
  );
  const viewModel = useMemo(() => {
    if (!coordsOk) return null;
    if (viewDate === liveDate) return liveModel;
    return buildSolarDay({ dateStr: viewDate, lat, lon, zone, ...omEdgesFor(daily, viewDate) });
  }, [coordsOk, viewDate, liveDate, liveModel, lat, lon, zone, daily]);
  // Demà (només hores): compte enrere després de la posta i "Pròxim:" de nit.
  const tomorrowLite = useMemo(() => {
    if (!coordsOk) return null;
    const d = addDays(liveDate, 1);
    return buildSolarDay({ dateStr: d, lat, lon, zone, ...omEdgesFor(daily, d) }, { lite: true });
  }, [coordsOk, liveDate, lat, lon, zone, daily]);
  // Ahir (només hores): a latituds altes a l'estiu la seva posta o els crepuscles cauen passada la mitjanit.
  const yesterdayLite = useMemo(() => {
    if (!coordsOk) return null;
    const d = addDays(liveDate, -1);
    return buildSolarDay({ dateStr: d, lat, lon, zone, ...omEdgesFor(daily, d) }, { lite: true });
  }, [coordsOk, liveDate, lat, lon, zone, daily]);
  const prevAstro = useMemo(
    () => (coordsOk ? astroLengthFor(addDays(viewDate, -1), lat, lon, zone) : null),
    [coordsOk, viewDate, lat, lon, zone],
  );
  // Sostre de l'eix Y per a tota la finestra: la geometria del gràfic no salta en canviar de dia.
  const altMax = useMemo(
    () => (coordsOk ? rangeAltMax([0, 7, LAST_OFFSET].map(k => noonAltFor(addDays(liveDate, k), lat, lon, zone))) : 30),
    [coordsOk, liveDate, lat, lon, zone],
  );

  // --- Previsió ---
  const forecast = useMemo(
    () => forecastFor(daily, hourly, viewDate, viewModel?.dayLengthSec ?? null),
    [daily, hourly, viewDate, viewModel],
  );
  const hasDaily = Array.isArray(daily?.time) && daily.time.length > 0;
  const lastFcLabel = useMemo(() => {
    const d = lastForecastDate(daily);
    return d ? untilDateText(d, language, locale) : null;
  }, [daily, locale, language]);

  // --- Derivats de "ara" (cada 30 s) ---
  const nowMinute = liveModel && nowMs >= liveModel.startMs && nowMs < liveModel.endMs
    ? Math.floor((nowMs - liveModel.startMs) / 60000) : null;
  const geoNow = useMemo(
    () => (coordsOk ? geometricAltitude(SunCalc.getPosition(new Date(nowMs), lat, lon).altitude) : -90),
    [coordsOk, nowMs, lat, lon],
  );
  const theme: Theme = geoNow > RISE_SET_GEO ? 'day' : 'night';

  // Compte enrere idèntic al de la targeta (arrodonit avall, "3h 13m"); després de la posta, la sortida real de demà.
  const upcoming = liveModel ? upcomingRiseSet(nowMs, liveModel, tomorrowLite, yesterdayLite) : null;
  const cdKind = upcoming?.kind ?? null;
  const cdText = upcoming ? formatCountdown(upcoming.ms - nowMs) : null;
  const countdown = useMemo(() => (cdKind && cdText ? { kind: cdKind, text: cdText } : null), [cdKind, cdText]);

  // "Pròxim:" — el primer dels 13 esdeveniments que ve (ahir passada la mitjanit, avui o demà); s'amaga si és
  // el mateix que el compte enrere.
  let nextLine: string | null = null;
  const next = liveModel ? nextEvent(nowMs, liveModel, tomorrowLite, yesterdayLite) : null;
  if (next && !(upcoming && upcoming.ms === next.ms)) {
    const d = formatCountdown(next.ms - nowMs);
    if (d) nextLine = fill(t.nextEvent, { event: t[EVENT_KEY[next.key]], time: localClock(next.ms, zone), t: d });
  }

  // Estats de les efemèrides: la identitat només canvia quan canvia algun estat (poques vegades al dia).
  const cellKey = isLive && liveModel
    ? Object.entries(ephemerisCellStates(liveModel, nowMs)).map(([k, v]) => `${k}:${v}`).join(',')
    : null;
  const cellStates = useMemo(() => {
    if (cellKey === null) return null;
    const out: Partial<Record<CellId, CellState>> = {};
    if (cellKey) for (const pair of cellKey.split(',')) {
      const [k, v] = pair.split(':');
      out[k as CellId] = v as CellState;
    }
    return out;
  }, [cellKey]);

  // Marca "ara" a la barra sortida→posta: només avui i amb el sol fora.
  let dbarFrac: number | null = null;
  if (isLive && liveModel && liveModel.polar === 'none') {
    const { sunrise, sunset } = liveModel.t;
    if (sunrise !== null && sunset !== null && sunset > sunrise && nowMs >= sunrise && nowMs <= sunset) {
      dbarFrac = Math.round(((nowMs - sunrise) / (sunset - sunrise)) * 1000) / 1000;
    }
  }

  // Δ respecte del dia anterior: sempre astronòmica (suncalc), la mateixa definició al calendari.
  const astroLen = viewModel?.astroLengthSec ?? null;
  const deltaSec = astroLen !== null && prevAstro !== null ? astroLen - prevAstro : null;
  const deltaText = useMemo((): HeroDelta => {
    if (deltaSec === null) return { cls: 'sm-tr-flat', mag: '', rest: '' };
    const { sign, text } = formatDeltaLong(deltaSec);
    if (sign === 0) return { cls: 'sm-tr-flat', mag: '', rest: isLive ? t.sameAsYesterday : t.sameAsPrev };
    const longer = sign > 0;
    return {
      cls: longer ? 'sm-tr-up' : 'sm-tr-down',
      mag: text,
      rest: isLive ? (longer ? t.vsYesterdayLonger : t.vsYesterdayShorter) : (longer ? t.vsPrevLonger : t.vsPrevShorter),
    };
  }, [deltaSec, isLive, t]);

  const relLabel = offset === 0 ? t.today : offset === 1 ? t.tomorrow : fill(t.inDays, { n: offset });
  const dateLabel = useMemo(
    () => capitalize(formatDateStr(viewDate, locale, isLive ? 'long' : 'short'), locale),
    [viewDate, locale, isLive],
  );

  const footnote = useMemo(() => {
    if (!coordsOk) return '';
    let s = fill(t.sourceAstro, { coords: formatLatLon(lat, lon, language), tz: zone.tz ?? formatUtcOffset(zone.fixedOffsetSec) });
    const last = lastDailyDate(daily);
    if (last) s += ` ${fill(t.sourceForecast, { date: untilDateText(last, language, locale) })}`;
    return s;
  }, [coordsOk, t, lat, lon, language, zone, daily, locale]);

  // --- Accions (estables) ---
  // Dia que es veu, per a les accions (mai es llegeix durant el render).
  const viewDateRef = useRef(viewDate);
  useLayoutEffect(() => { viewDateRef.current = viewDate; }, [viewDate]);
  /** Va a un dia (null = avui). Si canvia de dia, el minut fixat es descarta: no reapareix en tornar-hi. */
  const goToDate = useCallback((date: string | null) => {
    const target = date === null || date <= liveDate ? liveDate : date;
    if (target === viewDateRef.current) return;
    setSelectedDate(target === liveDate ? null : target);
    setPin(null);
  }, [liveDate]);
  const shiftDay = useCallback((delta: number) => {
    const cur = Math.max(0, Math.min(LAST_OFFSET, diffDays(liveDate, viewDateRef.current)));
    goToDate(addDays(liveDate, Math.max(0, Math.min(LAST_OFFSET, cur + delta))));
  }, [liveDate, goToDate]);
  const goPrev = useCallback(() => shiftDay(-1), [shiftDay]);
  const goNext = useCallback(() => shiftDay(1), [shiftDay]);
  const goToday = useCallback(() => goToDate(null), [goToDate]);
  const selectDate = useCallback((date: string, viaPointer: boolean) => {
    goToDate(date);
    // Amb el dit o el ratolí es torna a dalt (instantani) per veure el dia triat; amb teclat el focus es queda.
    const scroller = scrollRef.current;
    if (viaPointer && scroller) scroller.scrollTop = 0;
  }, [goToDate]);
  const commitPin = useCallback(
    (minute: number | null) => setPin(minute === null ? null : { date: viewDate, minute }),
    [viewDate],
  );

  const hasData = liveModel !== null && viewModel !== null;

  // ←/→ a qualsevol lloc del diàleg canvien de dia, llevat que algú ja hagi fet servir la tecla (el control
  // lliscant fa preventDefault), hi hagi un modificador o s'estigui escrivint.
  useEffect(() => {
    if (!hasData) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
      const el = e.target instanceof HTMLElement ? e.target : null;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable)) return;
      // El botó "Avui" i el de tornar a l'hora desapareixen en canviar de dia: si tenien el focus, passa
      // abans a la data (o al gràfic) perquè no caigui al <body>.
      if (el?.closest('.sm-pill')) {
        const dest = el.closest('.sm-traj')?.querySelector<HTMLElement>('.sm-plot') ?? document.getElementById(dateId);
        dest?.focus();
      }
      if (e.key === 'ArrowLeft') goPrev(); else goNext();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [hasData, goPrev, goNext, dateId]);

  // Lliscament horitzontal d'un dit per canviar de dia (mai des del gràfic, que és un control lliscant).
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const onTouchStart = useCallback((e: TouchEvent<HTMLDivElement>) => {
    const target = e.target instanceof Element ? e.target : null;
    if (e.touches.length !== 1 || target?.closest('[data-no-swipe]')) {
      touchStartRef.current = null;
      return;
    }
    touchStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  }, []);
  const onTouchEnd = useCallback((e: TouchEvent<HTMLDivElement>) => {
    const start = touchStartRef.current;
    touchStartRef.current = null;
    const end = e.changedTouches[0];
    if (!start || !end) return;
    const dir = swipeDirection(end.clientX - start.x, end.clientY - start.y);
    if (dir < 0) goPrev();
    else if (dir > 0) goNext();
  }, [goPrev, goNext]);

  return (
    <div ref={rootRef} className="sm-root" role="dialog" aria-modal="true" aria-labelledby={titleId}
      data-enter={skipEnter ? 'none' : undefined}>
      <div className="sm-scrim" aria-hidden="true" />
      <div className="sm-sheet" data-theme={theme} style={SHEET_STYLE[theme]}>
        <SolarHeader titleId={titleId} title={t.title} location={location} closeLabel={t.close} onClose={handleClose} />
        <div ref={scrollRef} className="sm-scroll" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
          {liveModel && viewModel ? (
            <div className="sm-grid">
              <SolarDayNav relLabel={relLabel} dateLabel={dateLabel} dateId={dateId} isLive={isLive}
                canPrev={offset > 0} canNext={offset < LAST_OFFSET} onPrev={goPrev} onNext={goNext} onToday={goToday} t={t} />
              <SolarHero model={viewModel} isLive={isLive} theme={theme} countdown={countdown} nextLine={nextLine}
                dbarFrac={dbarFrac} deltaText={deltaText} dateId={dateId} t={t} lang={language} />
              <SolarTrajectoryCard model={viewModel} altMax={altMax} isLive={isLive} nowMinute={isLive ? nowMinute : null}
                pinMinute={pinMinute} onCommit={commitPin} channel={channel} lang={language} t={t} ids={trajIds} />
              <SolarForecastCard forecast={forecast} lastDateLabel={lastFcLabel} hasDaily={hasDaily}
                dayLengthSec={viewModel.dayLengthSec} t={t} lang={language} />
              {isLg && <SolarCompass model={viewModel} channel={channel} t={t} lang={language} />}
              <SolarEphemeris model={viewModel} cellStates={isLive ? cellStates : null} t={t} lang={language} />
              <SolarAlmanac liveDate={liveDate} zone={zone} lat={lat} lon={lon} daily={daily} viewDate={viewDate}
                isLg={isLg} onSelect={selectDate} t={t} lang={language} />
              <p className="sm-a-foot px-1 text-[11px] leading-relaxed text-slate-400">{footnote}</p>
            </div>
          ) : (
            <p className="p-8 text-center text-[13px] leading-relaxed text-slate-300">{t.noData}</p>
          )}
        </div>
      </div>
    </div>
  );
}
