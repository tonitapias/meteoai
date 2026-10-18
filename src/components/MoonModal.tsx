// src/components/MoonModal.tsx
// Modal "Fase lunar", amb el mateix llenguatge que la seva targeta del tauler (la Lluna com és dins de l'anell
// del cicle) i la mateixa estructura que el modal Cicle solar: capçalera amb el lloc, navegació per dies (fletxes,
// "Avui", tecles ←/→ i lliscament), targetes opaques i un calendari de 15 dies en llista.
// Pensat per a mòbils de gamma baixa: cap filtre ni animació en bucle; fa servir les classes de closca sm-* del
// modal solar (solarModal.css: full, vel, capçalera, targetes, botons), que no depenen de cap dada solar.
//
// Fonts: fase i edat, els instants reals de les fases principals (lunarPhases, Meeus); sortida, posta, posició i
// distància, suncalc al fus de la UBICACIÓ. Avui es calcula a l'hora real (com la targeta); els altres dies, al
// migdia UTC del dia. "Pròxima plena/nova" sempre és la real des d'ara, no relativa al dia que es mira.
import { useCallback, useEffect, useId, useMemo, useRef, useState, type CSSProperties, type TouchEvent } from 'react';
import { X, Sparkles } from 'lucide-react';
import { ExtendedWeatherData, LocationMeta } from '../types/weatherLogicTypes';
import { Language } from '../translations';
import { useAstroModalShell } from '../hooks/useAstroModalShell';
import { useDialogFocus } from '../hooks/useDialogFocus';
import { swipeDirection } from '../utils/dayNavigation';
import { getMoonPhase } from '../utils/weatherMath';
import { getMoonAgeDays } from '../utils/lunarPhases';
import {
  getMoonCompassPosition,
  getMoonRiseSetForDate,
  getMoonIlluminationPercent,
  getNextMoonEvent,
  getMoonDistanceCategory,
  getMoonDistanceGaugePercent,
  getCardinalLabel,
  type NextMoonEvent,
} from '../utils/astronomyMath';
import { addDays, formatDateStr, localDateOf, makeZoneCtx } from '../utils/solar/solarTime';
import { STARS_NIGHT } from '../utils/solar/solarSky';
import { MoonDisc, MoonWithRing } from './MoonDisc';
import { SolarDayNav } from './solar/SolarDayNav';
import './solar/solarModal.css';

/** Últim dia navegable: avui + 14 (la finestra del calendari, com el modal solar). */
const LAST_OFFSET = 14;
const MINUS = '−';

interface MoonModalProps {
  weatherData: ExtendedWeatherData;
  onClose: () => void;
  lang?: Language;
}

interface MoonStrings {
  title: string; locationFallback: string; close: string; noData: string;
  dayNav: string; prevDay: string; nextDay: string; today: string; tomorrow: string; inDays: string; backToToday: string;
  illuminated: string; age: string; days: string; now: string; below: string;
  riseSetTitle: string; rise: string; set: string; nextDayShort: string;
  distance: string; supermoon: string; micromoon: string; perigee: string; apogee: string;
  nextPhases: string; fullMoon: string; newMoon: string; inDaysShort: string; todayShort: string; tomorrowShort: string;
  folkName: string; calendarTitle: string; chooseDay: string; colDay: string; colPhase: string; source: string;
}

const T: Readonly<Record<Language, MoonStrings>> = {
  ca: {
    title: 'Fase lunar', locationFallback: 'Lluna', close: 'Tanca', noData: 'Sense dades de la ubicació',
    dayNav: 'Navegació per dies', prevDay: 'Dia anterior', nextDay: 'Dia següent', today: 'Avui', tomorrow: 'Demà',
    inDays: "D'aquí a {n} dies", backToToday: 'Torna a avui',
    illuminated: 'il·luminada', age: 'Edat', days: 'dies', now: 'Ara', below: "sota l'horitzó",
    riseSetTitle: 'Sortida i posta', rise: 'Sortida', set: 'Posta', nextDayShort: "l'endemà",
    distance: 'Distància', supermoon: 'Superlluna', micromoon: 'Microlluna', perigee: 'Perigeu', apogee: 'Apogeu',
    nextPhases: 'Pròximes fases', fullMoon: 'Lluna plena', newMoon: 'Lluna nova', inDaysShort: 'en {n} dies',
    todayShort: 'avui', tomorrowShort: 'demà', folkName: 'nom tradicional',
    calendarTitle: 'Calendari lunar', chooseDay: 'Tria un dia', colDay: 'Dia', colPhase: 'Fase',
    source: 'Fase i edat: instants reals de les fases principals (algorisme de Meeus). Sortida, posta, posició i distància: càlcul astronòmic per a la ubicació; no depenen de la previsió.',
  },
  es: {
    title: 'Fase lunar', locationFallback: 'Luna', close: 'Cerrar', noData: 'Sin datos de la ubicación',
    dayNav: 'Navegación por días', prevDay: 'Día anterior', nextDay: 'Día siguiente', today: 'Hoy', tomorrow: 'Mañana',
    inDays: 'Dentro de {n} días', backToToday: 'Volver a hoy',
    illuminated: 'iluminada', age: 'Edad', days: 'días', now: 'Ahora', below: 'bajo el horizonte',
    riseSetTitle: 'Salida y puesta', rise: 'Salida', set: 'Puesta', nextDayShort: 'al día siguiente',
    distance: 'Distancia', supermoon: 'Superluna', micromoon: 'Microluna', perigee: 'Perigeo', apogee: 'Apogeo',
    nextPhases: 'Próximas fases', fullMoon: 'Luna llena', newMoon: 'Luna nueva', inDaysShort: 'en {n} días',
    todayShort: 'hoy', tomorrowShort: 'mañana', folkName: 'nombre tradicional',
    calendarTitle: 'Calendario lunar', chooseDay: 'Elige un día', colDay: 'Día', colPhase: 'Fase',
    source: 'Fase y edad: instantes reales de las fases principales (algoritmo de Meeus). Salida, puesta, posición y distancia: cálculo astronómico para la ubicación; no dependen de la previsión.',
  },
  en: {
    title: 'Moon phase', locationFallback: 'Moon', close: 'Close', noData: 'No location data',
    dayNav: 'Day navigation', prevDay: 'Previous day', nextDay: 'Next day', today: 'Today', tomorrow: 'Tomorrow',
    inDays: 'In {n} days', backToToday: 'Back to today',
    illuminated: 'illuminated', age: 'Age', days: 'days', now: 'Now', below: 'below the horizon',
    riseSetTitle: 'Moonrise and moonset', rise: 'Rise', set: 'Set', nextDayShort: 'next day',
    distance: 'Distance', supermoon: 'Supermoon', micromoon: 'Micromoon', perigee: 'Perigee', apogee: 'Apogee',
    nextPhases: 'Next phases', fullMoon: 'Full moon', newMoon: 'New moon', inDaysShort: 'in {n} days',
    todayShort: 'today', tomorrowShort: 'tomorrow', folkName: 'traditional name',
    calendarTitle: 'Moon calendar', chooseDay: 'Choose a day', colDay: 'Day', colPhase: 'Phase',
    source: 'Phase and age: real instants of the principal phases (Meeus algorithm). Rise, set, position and distance: astronomical calculation for the location; they do not depend on the forecast.',
  },
  fr: {
    title: 'Phase lunaire', locationFallback: 'Lune', close: 'Fermer', noData: 'Pas de données de localisation',
    dayNav: 'Navigation par jour', prevDay: 'Jour précédent', nextDay: 'Jour suivant', today: "Aujourd'hui", tomorrow: 'Demain',
    inDays: 'Dans {n} jours', backToToday: "Revenir à aujourd'hui",
    illuminated: 'éclairée', age: 'Âge', days: 'jours', now: 'Maintenant', below: "sous l'horizon",
    riseSetTitle: 'Lever et coucher', rise: 'Lever', set: 'Coucher', nextDayShort: 'le lendemain',
    distance: 'Distance', supermoon: 'Superlune', micromoon: 'Microlune', perigee: 'Périgée', apogee: 'Apogée',
    nextPhases: 'Prochaines phases', fullMoon: 'Pleine lune', newMoon: 'Nouvelle lune', inDaysShort: 'dans {n} jours',
    todayShort: "aujourd'hui", tomorrowShort: 'demain', folkName: 'nom traditionnel',
    calendarTitle: 'Calendrier lunaire', chooseDay: 'Choisir un jour', colDay: 'Jour', colPhase: 'Phase',
    source: 'Phase et âge : instants réels des phases principales (algorithme de Meeus). Lever, coucher, position et distance : calcul astronomique pour le lieu ; ils ne dépendent pas de la prévision.',
  },
};

const LOCALE: Readonly<Record<Language, string>> = { ca: 'ca-ES', es: 'es-ES', en: 'en-GB', fr: 'fr-FR' };

const PHASE_NAME_DICT: Record<Language, string[]> = {
  ca: ['Lluna Nova', 'Creixent', 'Quart Creixent', 'Gibosa Creixent', 'Lluna Plena', 'Gibosa Minvant', 'Quart Minvant', 'Minvant'],
  es: ['Luna Nueva', 'Creciente', 'Cuarto Creciente', 'Gibosa Creciente', 'Luna Llena', 'Gibosa Menguante', 'Cuarto Menguante', 'Menguante'],
  en: ['New Moon', 'Waxing Crescent', 'First Quarter', 'Waxing Gibbous', 'Full Moon', 'Waning Gibbous', 'Last Quarter', 'Waning Crescent'],
  fr: ['Nouvelle Lune', 'Premier Croissant', 'Premier Quartier', 'Lune Gibbeuse Crois.', 'Pleine Lune', 'Lune Gibbeuse Décrois.', 'Dernier Quartier', 'Dernier Croissant'],
};

// Noms folklòrics anglosaxons tradicionals (hemisferi Nord). Curiositat cultural, no dada
// científica — no es mostren a l'hemisferi Sud perquè l'associació estacional s'inverteix.
const FOLK_FULL_MOON_NAMES: Record<Language, string[]> = {
  ca: ['Lluna del Llop', 'Lluna de Neu', 'Lluna del Cuc', 'Lluna Rosa', 'Lluna de les Flors', 'Lluna de Maduixa', 'Lluna del Cérvol', 'Lluna de l\'Esturió', 'Lluna de la Collita', 'Lluna del Caçador', 'Lluna del Castor', 'Lluna Freda'],
  es: ['Luna del Lobo', 'Luna de Nieve', 'Luna del Gusano', 'Luna Rosa', 'Luna de las Flores', 'Luna de Fresa', 'Luna del Ciervo', 'Luna del Esturión', 'Luna de la Cosecha', 'Luna del Cazador', 'Luna del Castor', 'Luna Fría'],
  en: ['Wolf Moon', 'Snow Moon', 'Worm Moon', 'Pink Moon', 'Flower Moon', 'Strawberry Moon', 'Buck Moon', 'Sturgeon Moon', 'Harvest Moon', "Hunter's Moon", 'Beaver Moon', 'Cold Moon'],
  fr: ['Lune du Loup', 'Lune de Neige', 'Lune des Vers', 'Lune Rose', 'Lune des Fleurs', 'Lune des Fraises', 'Lune du Cerf', "Lune de l'Esturgeon", 'Lune des Moissons', 'Lune du Chasseur', 'Lune du Castor', 'Lune Froide'],
};

// Mateixos llindars que la targeta (MoonWidget) i que MoonPhaseIcon.
const getPhaseName = (phase: number, lang: Language): string => {
  const p = Math.max(0, Math.min(1, phase));
  let idx = 0;
  if (p < 0.02 || p > 0.98) idx = 0;
  else if (p < 0.23) idx = 1;
  else if (p < 0.27) idx = 2;
  else if (p < 0.48) idx = 3;
  else if (p <= 0.52) idx = 4;
  else if (p < 0.73) idx = 5;
  else if (p < 0.77) idx = 6;
  else idx = 7;
  return PHASE_NAME_DICT[lang][idx];
};

const fill = (tpl: string, n: number) => tpl.replace('{n}', String(n));
const capitalize = (s: string, locale: string) => (s ? s.charAt(0).toLocaleUpperCase(locale) + s.slice(1) : s);
const signedDeg = (v: number) => { const r = Math.round(v); return r > 0 ? `+${r}°` : r < 0 ? `${MINUS}${-r}°` : '0°'; };
const azText = (az: number, lang: Language) => `${((Math.round(az) % 360) + 360) % 360}° ${getCardinalLabel(az, lang)}`;
/** Migdia UTC d'una data local "YYYY-MM-DD" (instant de referència dels dies que no són avui). */
const utcNoon = (dateStr: string) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateStr);
  return m ? new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12)) : null;
};

// Fons del full: el mateix de nit que el modal solar (estrelles estàtiques, resplendor de dalt i degradat).
const SHEET_STYLE: CSSProperties = {
  backgroundImage: `${STARS_NIGHT},radial-gradient(70% 100% at 50% 0%,rgba(129,140,248,.12),rgba(129,140,248,0) 100%),`
    + 'linear-gradient(180deg,#0e1222 0%,#090b16 30%,#07080d 65%,#060609 100%)',
  backgroundSize: '360px 220px,100% 320px,100% 100%',
  backgroundRepeat: 'repeat-x,no-repeat,no-repeat',
  backgroundPosition: '50% 0,50% 0,0 0',
};

const LAB = 'sm-eyebrow';

export default function MoonModal({ weatherData, onClose, lang = 'ca' }: MoonModalProps) {
  const safeLang: Language = T[lang] ? lang : 'ca';
  const t = T[safeLang];
  const locale = LOCALE[safeLang];

  const loc = weatherData.location as LocationMeta | undefined;
  const lat = typeof loc?.latitude === 'number' ? loc.latitude : NaN;
  const lon = typeof loc?.longitude === 'number' ? loc.longitude : NaN;
  const hasValidCoords = Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180;
  const timezone = typeof weatherData.timezone === 'string' ? weatherData.timezone : undefined;
  const utcOffsetSec = typeof weatherData.utc_offset_seconds === 'number' ? weatherData.utc_offset_seconds : 0;
  const isSouth = hasValidCoords && lat < 0;
  const location = typeof loc?.name === 'string' && loc.name.trim() !== '' ? loc.name : t.locationFallback;

  // --- Closca: Escape, bloqueig de scroll, pausa de les animacions de sota i rellotge de 30 s; focus atrapat ---
  const { handleClose, now } = useAstroModalShell(onClose);
  const rootRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  useDialogFocus(true, rootRef);
  const titleId = useId();
  const dateId = useId();

  // --- Dia consultat ---
  const zone = useMemo(() => makeZoneCtx(timezone ?? null, utcOffsetSec), [timezone, utcOffsetSec]);
  const nowMs = now.getTime();
  const liveDate = localDateOf(nowMs, zone);
  const [offset, setOffset] = useState(0);               // 0 = avui
  const isToday = offset === 0;
  const viewDate = addDays(liveDate, offset);
  const viewAnchor = useMemo(() => utcNoon(viewDate), [viewDate]);

  const phase = useMemo(
    () => (isToday ? getMoonPhase(now) : viewAnchor ? getMoonPhase(viewAnchor) : 0),
    [isToday, now, viewAnchor],
  );
  const illumination = getMoonIlluminationPercent(phase);
  // Edat = temps des de la lluna nova real (no fase × 29,53: les lunacions no duren igual).
  const ageDays = useMemo(() => {
    const at = isToday ? now : viewAnchor;
    const age = at ? getMoonAgeDays(at) : NaN;
    return isNaN(age) ? 0 : age;
  }, [isToday, now, viewAnchor]);
  const phaseName = getPhaseName(phase, safeLang);

  // Posició real "ara mateix" (la mateixa funció que la targeta): només es mostra avui.
  const livePos = useMemo(() => (hasValidCoords ? getMoonCompassPosition(now, lat, lon) : null), [now, hasValidCoords, lat, lon]);
  // Distància del dia consultat (avui en viu; un altre dia, al migdia UTC).
  const viewMoonPos = useMemo(() => {
    if (!hasValidCoords) return null;
    return isToday ? livePos : viewAnchor ? getMoonCompassPosition(viewAnchor, lat, lon) : null;
  }, [hasValidCoords, isToday, livePos, viewAnchor, lat, lon]);
  const distanceCategory = viewMoonPos ? getMoonDistanceCategory(viewMoonPos.distanceKm) : 'normal';
  const gaugePercent = viewMoonPos ? getMoonDistanceGaugePercent(viewMoonPos.distanceKm) : 50;

  const riseSet = useMemo(
    () => (hasValidCoords ? getMoonRiseSetForDate(viewDate, lat, lon, timezone) : null),
    [hasValidCoords, viewDate, lat, lon, timezone],
  );
  const riseAz = riseSet?.rise.date ? getMoonCompassPosition(riseSet.rise.date, lat, lon) : null;
  const setAz = riseSet?.set.date ? getMoonCompassPosition(riseSet.set.date, lat, lon) : null;

  // Sempre des d'ara (la mateixa funció i el mateix instant de referència que la targeta).
  const nextFull = useMemo(() => getNextMoonEvent('full', now, 45), [now]);
  const nextNew = useMemo(() => getNextMoonEvent('new', now, 45), [now]);
  const folkName = !isSouth && nextFull && nextFull.daysAhead <= 1 ? FOLK_FULL_MOON_NAMES[safeLang][nextFull.date.getUTCMonth()] : null;

  // Calendari: avui (a l'hora real, com l'heroi i la targeta) i els 14 dies següents (al migdia UTC).
  const nowPhase = getMoonPhase(now);
  // Hores i dates: un cop per dia i lloc. La fase de la fila d'avui es posa a part (canvia amb el rellotge).
  const rowsBase = useMemo(() => {
    if (!hasValidCoords) return [];
    return Array.from({ length: LAST_OFFSET + 1 }, (_, k) => {
      const dateStr = addDays(liveDate, k);
      const anchor = utcNoon(dateStr);
      const rs = getMoonRiseSetForDate(dateStr, lat, lon, timezone);
      return {
        offset: k, dateStr, noonPhase: anchor ? getMoonPhase(anchor) : 0,
        label: k === 0 ? t.today : formatDateStr(dateStr, locale, 'weekdayDay'),
        long: formatDateStr(dateStr, locale, 'long'),
        rise: rs.rise.formatted, set: rs.set.formatted, setNext: rs.set.isNextDay,
      };
    });
  }, [hasValidCoords, liveDate, lat, lon, timezone, locale, t]);
  const rows = rowsBase.map(r => {
    const p = r.offset === 0 ? nowPhase : r.noonPhase;
    return { ...r, phase: p, illum: getMoonIlluminationPercent(p) };
  });
  const rangeLabel = `${formatDateStr(liveDate, locale, 'dayMonth')} – ${formatDateStr(addDays(liveDate, LAST_OFFSET), locale, 'dayMonth')}`;

  // --- Navegació per dies ---
  const goTo = useCallback((k: number) => setOffset(Math.max(0, Math.min(LAST_OFFSET, k))), [setOffset]);
  const goPrev = useCallback(() => setOffset(o => Math.max(0, o - 1)), [setOffset]);
  const goNext = useCallback(() => setOffset(o => Math.min(LAST_OFFSET, o + 1)), [setOffset]);
  const goToday = useCallback(() => setOffset(0), [setOffset]);
  const selectRow = (k: number, viaPointer: boolean) => {
    goTo(k);
    // Amb el dit o el ratolí es torna a dalt per veure el dia triat; amb teclat el focus es queda a la fila.
    if (viaPointer && scrollRef.current) scrollRef.current.scrollTop = 0;
  };

  // ←/→ a qualsevol lloc del diàleg canvien de dia (com al modal solar), si ningú no ha fet servir la tecla.
  useEffect(() => {
    if (!hasValidCoords) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
      const el = e.target instanceof HTMLElement ? e.target : null;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable)) return;
      // La píndola "Avui" desapareix en tornar a avui: si tenia el focus, passa abans a la data.
      if (el?.closest('.sm-pill')) document.getElementById(dateId)?.focus();
      if (e.key === 'ArrowLeft') goPrev(); else goNext();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [hasValidCoords, goPrev, goNext, dateId]);

  // Lliscament horitzontal d'un dit per canviar de dia.
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const onTouchStart = useCallback((e: TouchEvent<HTMLDivElement>) => {
    touchStartRef.current = e.touches.length === 1 ? { x: e.touches[0].clientX, y: e.touches[0].clientY } : null;
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

  const relLabel = offset === 0 ? t.today : offset === 1 ? t.tomorrow : fill(t.inDays, offset);
  const dateLabel = capitalize(formatDateStr(viewDate, locale, isToday ? 'long' : 'short'), locale);
  const navStrings = useMemo(() => ({ dayNav: t.dayNav, prevDay: t.prevDay, nextDay: t.nextDay, backToToday: t.backToToday, today: t.today }), [t]);

  const eventWhen = (ev: NextMoonEvent | null) => {
    if (!ev) return { rel: '--', date: '' };
    const rel = ev.daysAhead === 0 ? t.todayShort : ev.daysAhead === 1 ? t.tomorrowShort : fill(t.inDaysShort, ev.daysAhead);
    // La data de getNextMoonEvent és el migdia UTC del dia de l'esdeveniment (el mateix dia que compta la targeta).
    const date = formatDateStr(ev.date.toISOString().slice(0, 10), locale, 'weekdayDayMonth');
    return { rel, date };
  };

  return (
    <div ref={rootRef} className="sm-root" role="dialog" aria-modal="true" aria-labelledby={titleId}>
      <div className="sm-scrim" aria-hidden="true" />
      <div className="sm-sheet" data-theme="night" style={SHEET_STYLE}>
        <header className="sm-header">
          <span className="flex-none w-9 h-9" aria-hidden="true"><MoonDisc phase={nowPhase} south={isSouth} detail={false} /></span>
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="text-[17px] leading-[22px] md:text-xl font-black uppercase tracking-tight text-white">{t.title}</h2>
            <p className="sm-loc text-xs leading-4 text-slate-400 truncate">{location}</p>
          </div>
          <button type="button" className="sm-btn sm-focus" aria-label={t.close} aria-keyshortcuts="Escape" onClick={handleClose}>
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </header>

        <div ref={scrollRef} className="sm-scroll" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
          {!hasValidCoords ? (
            <p className="p-8 text-center text-[13px] leading-relaxed text-slate-300">{t.noData}</p>
          ) : (
            <div className="flex flex-col gap-3 min-[360px]:gap-4 md:grid md:grid-cols-2 md:gap-5 md:items-stretch lg:grid-cols-3 lg:gap-6">
              <div className="md:col-span-2 lg:col-span-3">
                <SolarDayNav relLabel={relLabel} dateLabel={dateLabel} dateId={dateId} isLive={isToday}
                  canPrev={offset > 0} canNext={offset < LAST_OFFSET} onPrev={goPrev} onNext={goNext} onToday={goToday} t={navStrings} />
              </div>

              {/* Heroi: la Lluna del dia, com a la targeta */}
              <section className="sm-card sm-hero md:col-span-2 lg:col-span-3" data-theme="night" aria-label={phaseName}>
                <div className="flex flex-col items-center gap-4 md:flex-row md:gap-8">
                  <div className="flex-none w-[176px] h-[176px] md:w-[196px] md:h-[196px]">
                    <MoonWithRing phase={phase} south={isSouth} />
                  </div>
                  <div className="min-w-0 text-center md:text-left">
                    <p className="text-[26px] md:text-[32px] font-black leading-tight text-white">{phaseName}</p>
                    <p className="mt-1 text-[14px] leading-5 text-slate-300">
                      <span className="font-mono text-indigo-100">{illumination}%</span> {t.illuminated}
                      {' · '}{t.age} <span className="font-mono text-slate-100">{ageDays}</span> {t.days}
                    </p>
                    {isToday && livePos && (
                      <p className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-black/30 px-3 py-1 text-[12px] leading-4 text-slate-200">
                        <span className="text-slate-400">{t.now}</span>
                        <span className="font-mono">{signedDeg(livePos.altitudeDeg)}</span>
                        <span aria-hidden="true">·</span>
                        {livePos.altitudeDeg > 0 ? <span className="font-mono">{azText(livePos.azimuthDeg, safeLang)}</span> : <span>{t.below}</span>}
                      </p>
                    )}
                    {folkName && (
                      <p className="mt-2 text-[12px] text-amber-200/90">{folkName} <span className="text-slate-500">({t.folkName})</span></p>
                    )}
                  </div>
                </div>
              </section>

              {/* Sortida i posta del dia, amb l'azimut */}
              <section className="sm-card" aria-label={t.riseSetTitle}>
                <h3 className={LAB}>{t.riseSetTitle}</h3>
                <div className="mt-2 grid grid-cols-2 gap-3">
                  {([['rise', riseSet?.rise, riseAz, 'text-cyan-200'], ['set', riseSet?.set, setAz, 'text-amber-200']] as const).map(([k, ev, az, cls]) => (
                    <div key={k} className={k === 'set' ? 'text-right' : ''}>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">{k === 'rise' ? t.rise : t.set}</p>
                      <p className={`mt-1 font-mono tabular-nums text-[28px] md:text-[30px] font-semibold leading-none ${ev?.formatted ? cls : 'text-slate-600'}`}>
                        {ev?.formatted ?? '--:--'}
                        {ev?.isNextDay && <sup className="ml-0.5 text-[11px] text-slate-400" title={t.nextDayShort}>+1d</sup>}
                      </p>
                      <p className="mt-1.5 font-mono text-[12px] text-slate-400">{az ? azText(az.azimuthDeg, safeLang) : '—'}</p>
                    </div>
                  ))}
                </div>
              </section>

              {/* Distància Terra-Lluna */}
              <section className="sm-card" aria-label={t.distance}>
                <div className="flex items-center justify-between gap-2">
                  <h3 className={LAB}>{t.distance}</h3>
                  {distanceCategory !== 'normal' && (
                    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${distanceCategory === 'supermoon' ? 'border-amber-300/40 text-amber-200' : 'border-cyan-300/40 text-cyan-200'}`}>
                      <Sparkles className="w-3 h-3" aria-hidden="true" />{distanceCategory === 'supermoon' ? t.supermoon : t.micromoon}
                    </span>
                  )}
                </div>
                <p className="mt-2 font-mono tabular-nums text-[22px] font-semibold text-slate-100">
                  {viewMoonPos ? `${Math.round(viewMoonPos.distanceKm).toLocaleString(locale)} km` : '--'}
                </p>
                <div className="relative mt-3 h-1.5 rounded-full bg-gradient-to-r from-cyan-500/40 via-slate-600/40 to-violet-500/40" aria-hidden="true">
                  <span className="absolute top-1/2 w-2.5 h-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white ring-2 ring-[#0c0f17]" style={{ left: `${gaugePercent}%` }} />
                </div>
                <div className="mt-1.5 flex justify-between text-[11px] text-slate-500"><span>{t.perigee}</span><span>{t.apogee}</span></div>
              </section>

              {/* Pròxima plena i nova (des d'ara) */}
              <section className="sm-card md:col-span-2 lg:col-span-1" aria-label={t.nextPhases}>
                <h3 className={LAB}>{t.nextPhases}</h3>
                <ul className="mt-1 divide-y divide-white/[0.06]">
                  {([['full', nextFull, 0.5, t.fullMoon], ['new', nextNew, 0, t.newMoon]] as const).map(([k, ev, p, name]) => {
                    const w = eventWhen(ev);
                    return (
                      <li key={k} className="flex items-center gap-3 py-2.5">
                        <span className="flex-none w-7 h-7"><MoonDisc phase={p} south={isSouth} detail={false} /></span>
                        <div className="min-w-0 flex-1">
                          <p className="text-[14px] leading-5 text-slate-100">{name}</p>
                          <p className="text-[12px] leading-4 text-slate-400">{w.date}</p>
                        </div>
                        <p className="font-mono text-[13px] text-indigo-200 whitespace-nowrap">{w.rel}</p>
                      </li>
                    );
                  })}
                </ul>
              </section>

              {/* Calendari lunar: avui + 14 dies; tocar una fila tria el dia */}
              <section className="sm-card md:col-span-2 lg:col-span-3" aria-label={t.calendarTitle}>
                <div className="flex items-baseline justify-between gap-2">
                  <h3 className={LAB}>{t.calendarTitle}</h3>
                  <span className="text-[11px] text-slate-400 tabular-nums">{rangeLabel}</span>
                </div>
                <div className="mt-2 grid grid-cols-1 lg:grid-cols-2 lg:gap-x-8" aria-hidden="true">
                  {[0, 1].map(k => (
                    <div key={k} className={`${k === 1 ? 'hidden lg:grid' : 'grid'} grid-cols-[minmax(0,1fr)_28px_3rem_3.25rem_3.75rem] gap-x-2 px-2 h-7 items-center sm-eyebrow`}>
                      <span>{t.colDay}</span><span>{t.colPhase}</span><span className="text-right">%</span>
                      <span className="text-right" title={t.rise}>↑</span><span className="text-right" title={t.set}>↓</span>
                    </div>
                  ))}
                </div>
                <ol className="grid grid-cols-1 lg:grid-cols-2 lg:grid-rows-[repeat(8,auto)] lg:grid-flow-col lg:gap-x-8" aria-label={t.chooseDay}>
                  {rows.map(r => {
                    const selected = r.offset === offset;
                    return (
                      <li key={r.dateStr}>
                        <button type="button" aria-pressed={selected} aria-current={r.offset === 0 ? 'date' : undefined}
                          aria-label={`${r.long}: ${getPhaseName(r.phase, safeLang)}, ${r.illum}% ${t.illuminated}, ${t.rise} ${r.rise ?? '--:--'}, ${t.set} ${r.set ?? '--:--'}`}
                          onClick={e => selectRow(r.offset, e.detail > 0)}
                          className={`sm-focus grid w-full grid-cols-[minmax(0,1fr)_28px_3rem_3.25rem_3.75rem] items-center gap-x-2 rounded-xl px-2 py-1.5 text-left ${selected ? 'bg-indigo-500/[0.12] ring-1 ring-inset ring-indigo-400/40' : 'hover:bg-white/[0.04]'}`}>
                          <span className={`min-w-0 truncate text-[13px] leading-4 ${r.offset === 0 ? 'font-semibold text-indigo-200' : 'text-slate-200'}`}>{r.label}</span>
                          <span className="w-6 h-6"><MoonDisc phase={r.phase} south={isSouth} detail={false} /></span>
                          <span className="text-right font-mono tabular-nums text-[12px] text-slate-300">{r.illum}%</span>
                          <span className="text-right font-mono tabular-nums text-[12px] text-cyan-200">{r.rise ?? '--:--'}</span>
                          <span className="text-right font-mono tabular-nums text-[12px] text-amber-200">
                            {r.set ?? '--:--'}{r.setNext && <sup className="text-[9px] text-slate-400">+1d</sup>}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ol>
              </section>

              <p className="px-1 text-[11px] leading-relaxed text-slate-400 md:col-span-2 lg:col-span-3">{t.source}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
