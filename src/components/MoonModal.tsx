// src/components/MoonModal.tsx
// Modal de detall del cicle lunar — direcció visual "planetari/astronòmic": starfield dens,
// icona de fase gran amb orientació real del limbe, azimut de sortida/posta, distància i
// insígnia de superlluna, pròxima lluna plena/nova, 8 dies vista.
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { X, ArrowUpCircle, ArrowDownCircle, Orbit, Sparkles, CalendarClock } from 'lucide-react';
import { ExtendedWeatherData, LocationMeta } from '../types/weatherLogicTypes';
import { Language } from '../translations';
import { MATRIX_BG } from './widgets/widgetStyles';
import { MoonPhaseIcon } from './MoonPhaseIcon';
import { StarfieldBackdrop } from './StarfieldBackdrop';
import { getMoonPhase } from '../utils/weatherMath';
import {
  getMoonCompassPosition,
  getMoonRiseSetForDate,
  getMoonIlluminationPercent,
  getMoonAgeDays,
  getNextMoonEvent,
  getMoonDistanceCategory,
  getMoonDistanceGaugePercent,
  getCardinalLabel,
} from '../utils/astronomyMath';

interface MoonModalProps {
  weatherData: ExtendedWeatherData;
  onClose: () => void;
  lang?: Language;
}

const T: Record<Language, Record<string, string>> = {
  ca: {
    title: 'OBSERVATORI LUNAR', subtitle: 'Cicle i Posició de la Lluna', noData: 'SENSE DADES SUFICIENTS',
    illumination: 'Il·luminació', age: 'Edat', days: 'dies', rise: 'SORTIDA', set: 'POSTA',
    distance: 'Distància', supermoon: 'SUPERLLUNA', micromoon: 'MICRO LLUNA', nextFull: 'Pròxima Lluna Plena',
    nextNew: 'Pròxima Lluna Nova', inDays: 'en {n} dies', today: 'avui', tomorrow: 'demà', week: 'Pròxims 7 Dies',
    livePosition: 'Posició Actual', azimuth: 'Azimut', altitude: 'Altitud', folkName: 'Nom Tradicional (curiositat)',
    perigee: 'Perigeu', apogee: 'Apogeu',
  },
  es: {
    title: 'OBSERVATORIO LUNAR', subtitle: 'Ciclo y Posición de la Luna', noData: 'DATOS INSUFICIENTES',
    illumination: 'Iluminación', age: 'Edad', days: 'días', rise: 'SALIDA', set: 'PUESTA',
    distance: 'Distancia', supermoon: 'SUPERLUNA', micromoon: 'MICRO LUNA', nextFull: 'Próxima Luna Llena',
    nextNew: 'Próxima Luna Nueva', inDays: 'en {n} días', today: 'hoy', tomorrow: 'mañana', week: 'Próximos 7 Días',
    livePosition: 'Posición Actual', azimuth: 'Azimut', altitude: 'Altitud', folkName: 'Nombre Tradicional (curiosidad)',
    perigee: 'Perigeo', apogee: 'Apogeo',
  },
  en: {
    title: 'LUNAR OBSERVATORY', subtitle: 'Moon Cycle & Position', noData: 'INSUFFICIENT DATA',
    illumination: 'Illumination', age: 'Age', days: 'days', rise: 'RISE', set: 'SET',
    distance: 'Distance', supermoon: 'SUPERMOON', micromoon: 'MICROMOON', nextFull: 'Next Full Moon',
    nextNew: 'Next New Moon', inDays: 'in {n} days', today: 'today', tomorrow: 'tomorrow', week: 'Next 7 Days',
    livePosition: 'Live Position', azimuth: 'Azimuth', altitude: 'Altitude', folkName: 'Traditional Name (folklore)',
    perigee: 'Perigee', apogee: 'Apogee',
  },
  fr: {
    title: 'OBSERVATOIRE LUNAIRE', subtitle: 'Cycle et Position de la Lune', noData: 'DONNÉES INSUFFISANTES',
    illumination: 'Illumination', age: 'Âge', days: 'jours', rise: 'LEVER', set: 'COUCHER',
    distance: 'Distance', supermoon: 'SUPERLUNE', micromoon: 'MICRO LUNE', nextFull: 'Prochaine Pleine Lune',
    nextNew: 'Prochaine Nouvelle Lune', inDays: 'dans {n} jours', today: "aujourd'hui", tomorrow: 'demain', week: '7 Prochains Jours',
    livePosition: 'Position Actuelle', azimuth: 'Azimut', altitude: 'Altitude', folkName: 'Nom Traditionnel (folklore)',
    perigee: 'Périgée', apogee: 'Apogée',
  },
};

const localeMap: Record<string, string> = { ca: 'ca-ES', es: 'es-ES', en: 'en-US', fr: 'fr-FR' };

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

const dayNounFor = (t: Record<string, string>, days: number) => t.inDays.replace('{n}', String(days));

export default function MoonModal({ weatherData, onClose, lang = 'ca' }: MoonModalProps) {
  const safeLang: Language = T[lang] ? lang : 'ca';
  const t = T[safeLang];
  const dateLocale = localeMap[safeLang] || 'ca-ES';

  const loc = weatherData.location as LocationMeta | undefined;
  const lat = typeof loc?.latitude === 'number' ? loc.latitude : NaN;
  const lon = typeof loc?.longitude === 'number' ? loc.longitude : NaN;
  const hasValidCoords = !isNaN(lat) && !isNaN(lon);
  const timezone = typeof weatherData.timezone === 'string' ? weatherData.timezone : undefined;
  const daily = weatherData.daily;
  const isSouth = hasValidCoords && lat < 0;

  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);
  const handleClose = useCallback(() => onCloseRef.current(), []);

  useEffect(() => {
    const original = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = original; };
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') handleClose(); };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleClose]);

  const [now, setNow] = useState<Date>(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(timer);
  }, []);

  const phase = useMemo(() => getMoonPhase(now), [now]);
  const illumination = getMoonIlluminationPercent(phase);
  const ageDays = getMoonAgeDays(phase);
  const phaseName = getPhaseName(phase, safeLang);

  const livePos = useMemo(
    () => hasValidCoords ? getMoonCompassPosition(now, lat, lon) : null,
    [now, hasValidCoords, lat, lon]
  );

  const distanceCategory = livePos ? getMoonDistanceCategory(livePos.distanceKm) : 'normal';
  const gaugePercent = livePos ? getMoonDistanceGaugePercent(livePos.distanceKm) : 50;

  const todayStr = Array.isArray(daily?.time) ? daily.time[0] : undefined;
  const riseSetToday = useMemo(
    () => hasValidCoords ? getMoonRiseSetForDate(todayStr, lat, lon, timezone) : { rise: { date: null, formatted: null, isNextDay: false }, set: { date: null, formatted: null, isNextDay: false } },
    [hasValidCoords, todayStr, lat, lon, timezone]
  );
  const riseAz = useMemo(
    () => riseSetToday.rise.date && hasValidCoords ? getMoonCompassPosition(riseSetToday.rise.date, lat, lon) : null,
    [riseSetToday.rise.date, hasValidCoords, lat, lon]
  );
  const setAz = useMemo(
    () => riseSetToday.set.date && hasValidCoords ? getMoonCompassPosition(riseSetToday.set.date, lat, lon) : null,
    [riseSetToday.set.date, hasValidCoords, lat, lon]
  );

  const nextFull = useMemo(() => getNextMoonEvent('full', now, 45), [now]);
  const nextNew = useMemo(() => getNextMoonEvent('new', now, 45), [now]);

  const folkName = useMemo(() => {
    if (isSouth || !nextFull || nextFull.daysAhead > 1) return null;
    return FOLK_FULL_MOON_NAMES[safeLang][nextFull.date.getUTCMonth()];
  }, [isSouth, nextFull, safeLang]);

  const weekDays = useMemo(() => {
    if (!Array.isArray(daily?.time) || !hasValidCoords) return [];
    return daily.time.map((dateStr, i) => {
      const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateStr || '');
      const weekdayLabel = m ? new Intl.DateTimeFormat(dateLocale, { weekday: 'short' }).format(new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))) : '--';
      const dayNum = m ? Number(m[3]) : null;
      const anchor = m ? new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12, 0, 0)) : null;
      const dayPhase = anchor ? getMoonPhase(anchor) : 0;
      const riseSet = getMoonRiseSetForDate(dateStr, lat, lon, timezone);
      return {
        dateStr, weekdayLabel, dayNum, phase: dayPhase,
        illumination: getMoonIlluminationPercent(dayPhase),
        rise: riseSet.rise.formatted || '--:--',
        set: riseSet.set.formatted || '--:--',
        i,
      };
    }).slice(1); // Avui ja es mostra a l'heroi i a les targetes — la tira comença demà, com fa ForecastSection.tsx
  }, [daily, hasValidCoords, lat, lon, timezone, dateLocale]);

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 md:p-6 landscape:p-0 landscape:sm:p-4 bg-black/95 backdrop-blur-3xl backdrop-saturate-150 animate-in fade-in duration-200">
      <style>{`
        .astro-scrollbar { -webkit-overflow-scrolling: touch; }
        .astro-scrollbar::-webkit-scrollbar { width: 5px; height: 5px; }
        .astro-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .astro-scrollbar::-webkit-scrollbar-thumb { background: rgba(129,140,248,0.25); border-radius: 8px; }
        .astro-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(129,140,248,0.45); }
        .astro-hscroll { overscroll-behavior-x: contain; touch-action: pan-x; }
        @keyframes moon-hero-levitate {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-8px); }
        }
        .moon-hero-float { animation: moon-hero-levitate 8s ease-in-out infinite; }
      `}</style>

      <div className="w-full h-[96dvh] sm:h-auto sm:max-h-[90dvh] landscape:h-[100dvh] landscape:sm:h-auto max-w-sm md:max-w-3xl lg:max-w-5xl flex flex-col min-h-0 bg-gradient-to-b from-[#0a0a1a] via-[#050510] to-black rounded-t-[24px] sm:rounded-[32px] border-t sm:border border-indigo-500/10 shadow-[0_0_100px_rgba(0,0,0,0.9)] overflow-hidden relative animate-in slide-in-from-bottom-8 sm:zoom-in-95 duration-300">
        <StarfieldBackdrop tint="#a5b4fc" density={90} />
        <div className={MATRIX_BG}></div>
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[130%] h-56 bg-gradient-to-b from-indigo-500/10 via-violet-900/5 to-transparent blur-[80px] pointer-events-none z-0"></div>

        <div className="flex justify-between items-center shrink-0 relative z-20 p-4 md:p-6 border-b border-white/[0.04]">
          <div className="flex items-center gap-3">
            <div className="relative flex items-center justify-center w-10 h-10 rounded-full border bg-indigo-500/10 border-indigo-500/30 text-indigo-300">
              <Orbit className="w-5 h-5" />
              <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 bg-indigo-400"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-indigo-500"></span>
              </span>
            </div>
            <div className="flex flex-col">
              <h2 className="text-lg md:text-2xl font-black text-white tracking-tighter drop-shadow-md leading-none">{t.title}</h2>
              <span className="text-[10px] md:text-xs text-slate-400 font-bold tracking-widest uppercase mt-0.5">{t.subtitle}</span>
            </div>
          </div>
          <button onClick={handleClose} className="p-2.5 bg-black/40 border border-white/5 rounded-full text-slate-400 hover:bg-white/10 hover:text-white active:scale-90 transition-all duration-200 group relative backdrop-blur-md">
            <X className="w-5 h-5 group-hover:rotate-90 transition-transform duration-300" />
            <span className="absolute -bottom-8 left-1/2 -translate-x-1/2 text-[10px] font-mono font-bold text-slate-500 opacity-0 group-hover:opacity-100 hidden md:block transition-opacity">ESC</span>
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain astro-scrollbar relative z-10 p-4 md:p-6 space-y-6">

          {/* HEROI: icona de fase gran + lectura en viu */}
          <div className="relative rounded-2xl border border-white/5 bg-black/30 backdrop-blur-md p-5 flex flex-col sm:flex-row items-center gap-6">
            <div className={`w-40 h-40 sm:w-48 sm:h-48 flex-shrink-0 relative ${isSouth ? 'scale-x-[-1]' : ''}`}>
              <div className="moon-hero-float relative w-full h-full">
                <div className="absolute inset-0 rounded-full blur-[50px] bg-indigo-500/20 pointer-events-none"></div>
                <MoonPhaseIcon phase={phase} className="w-full h-full relative z-10" />
              </div>
            </div>
            <div className="flex flex-col items-center sm:items-start gap-2 flex-1">
              <span className="text-3xl font-black text-white tracking-tight leading-none">{phaseName}</span>
              <span className="text-sm font-bold text-indigo-300">{illumination}% {t.illumination} · {t.age} {ageDays} {t.days}</span>
              {folkName && (
                <span className="text-[10px] font-bold text-amber-300/80 uppercase tracking-wide mt-1">✨ {folkName} <span className="text-slate-500 normal-case">({t.folkName})</span></span>
              )}
              {hasValidCoords && livePos && (
                <div className="flex items-center gap-3 mt-2 px-3 py-1.5 rounded-lg bg-black/40 border border-white/5">
                  <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">{t.livePosition}</span>
                  <span className="text-xs font-mono font-bold text-indigo-200">
                    {Math.round(livePos.azimuthDeg)}° {getCardinalLabel(livePos.azimuthDeg, safeLang)} · {livePos.altitudeDeg >= 0 ? '+' : ''}{Math.round(livePos.altitudeDeg)}°
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Targetes d'estadístiques */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard
              label={t.rise}
              value={riseSetToday.rise.formatted || '--:--'}
              sub={riseAz ? `${Math.round(riseAz.azimuthDeg)}° ${getCardinalLabel(riseAz.azimuthDeg, safeLang)}${riseSetToday.rise.isNextDay ? ' +1d' : ''}` : undefined}
              icon={<ArrowUpCircle className="w-3.5 h-3.5" />}
              valueClassName="text-cyan-300"
            />
            <StatCard
              label={t.set}
              value={riseSetToday.set.formatted || '--:--'}
              sub={setAz ? `${Math.round(setAz.azimuthDeg)}° ${getCardinalLabel(setAz.azimuthDeg, safeLang)}${riseSetToday.set.isNextDay ? ' +1d' : ''}` : undefined}
              icon={<ArrowDownCircle className="w-3.5 h-3.5" />}
              valueClassName="text-amber-300"
            />
            <div className="rounded-xl border border-white/5 bg-black/30 backdrop-blur-md p-3 flex flex-col gap-1.5 col-span-2 sm:col-span-1">
              <span className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest text-slate-500"><Orbit className="w-3.5 h-3.5" />{t.distance}</span>
              <span className="text-lg font-black tabular-nums text-white leading-none">{livePos ? `${Math.round(livePos.distanceKm).toLocaleString(dateLocale)} km` : '--'}</span>
              <div className="relative h-1.5 rounded-full bg-gradient-to-r from-cyan-500/40 via-slate-600/40 to-violet-500/40 mt-1">
                <div className="absolute top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-white shadow-[0_0_6px_white]" style={{ left: `${gaugePercent}%`, transform: `translate(-50%, -50%)` }} />
              </div>
              <div className="flex justify-between text-[8px] text-slate-600 font-bold uppercase"><span>{t.perigee}</span><span>{t.apogee}</span></div>
              {distanceCategory !== 'normal' && (
                <span className={`flex items-center gap-1 text-[9px] font-black uppercase tracking-wide mt-1 ${distanceCategory === 'supermoon' ? 'text-amber-300' : 'text-cyan-300'}`}>
                  <Sparkles className="w-3 h-3" />{distanceCategory === 'supermoon' ? t.supermoon : t.micromoon}
                </span>
              )}
            </div>
            <StatCard
              label={t.nextFull}
              value={nextFull ? (nextFull.daysAhead === 0 ? t.today : nextFull.daysAhead === 1 ? t.tomorrow : dayNounFor(t, nextFull.daysAhead)) : '--'}
              icon={<CalendarClock className="w-3.5 h-3.5" />}
            />
            <StatCard
              label={t.nextNew}
              value={nextNew ? (nextNew.daysAhead === 0 ? t.today : nextNew.daysAhead === 1 ? t.tomorrow : dayNounFor(t, nextNew.daysAhead)) : '--'}
              icon={<CalendarClock className="w-3.5 h-3.5" />}
            />
          </div>

          {/* Tira de 8 dies */}
          <div>
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 block">{t.week}</span>
            <div className="flex gap-2 overflow-x-auto astro-scrollbar astro-hscroll pb-2">
              {weekDays.map(d => (
                <div key={d.dateStr + d.i} className="flex-shrink-0 w-28 rounded-xl border border-white/5 bg-[#0a0a14] p-3 flex flex-col items-center gap-1.5">
                  <span className="text-[10px] font-black uppercase text-slate-400">{d.weekdayLabel} {d.dayNum}</span>
                  <div className={`w-10 h-10 ${isSouth ? 'scale-x-[-1]' : ''}`}><MoonPhaseIcon phase={d.phase} className="w-full h-full" /></div>
                  <span className="text-[10px] font-bold text-indigo-200">{d.illumination}%</span>
                  <div className="flex items-center gap-1 text-[10px] font-mono text-cyan-300"><ArrowUpCircle className="w-3 h-3" />{d.rise}</div>
                  <div className="flex items-center gap-1 text-[10px] font-mono text-amber-300"><ArrowDownCircle className="w-3 h-3" />{d.set}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

interface StatCardProps {
  label: string;
  value: string;
  sub?: string;
  icon?: React.ReactNode;
  valueClassName?: string;
}

const StatCard = ({ label, value, sub, icon, valueClassName }: StatCardProps) => (
  <div className="rounded-xl border border-white/5 bg-black/30 backdrop-blur-md p-3 flex flex-col gap-1">
    <span className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest text-slate-500">
      {icon}{label}
    </span>
    <span className={`text-lg font-black tabular-nums leading-none ${valueClassName || 'text-white'}`}>{value}</span>
    {sub && <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wide">{sub}</span>}
  </div>
);
