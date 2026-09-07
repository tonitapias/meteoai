// src/components/SolarModal.tsx
// Modal de detall del cicle solar — direcció visual "planetari/astronòmic": starfield,
// arc real d'altitud/azimut, cronologia completa de crepuscles i hora daurada, 8 dies vista.
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { X, Sunrise, Sunset, Gauge, Zap, CloudSun, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { ExtendedWeatherData, LocationMeta } from '../types/weatherLogicTypes';
import { Language } from '../translations';
import { MATRIX_BG } from './widgets/widgetStyles';
import { getUVCategory } from '../utils/uvIndexUtils';
import { StarfieldBackdrop } from './StarfieldBackdrop';
import { SunOrb } from './SunOrb';
import {
  getSunDayTimesSafe,
  getSunCompassPosition,
  getCardinalLabel,
  formatClockTime,
  estimateSunsetQuality,
  addDaysToDateStr,
  SunDayTimes,
} from '../utils/astronomyMath';

interface SolarModalProps {
  weatherData: ExtendedWeatherData;
  onClose: () => void;
  lang?: Language;
}

// Sortida/posta/durada del dia són pura astronomia (suncalc) i van a 14 dies sense perdre
// precisió ni fer cap crida de xarxa addicional. L'UV, en canvi, depèn del núvol previst per
// Open-Meteo — només es mostra als dies pels quals l'API realment ha retornat una dada.
const STRIP_DAYS = 14;

const T: Record<Language, Record<string, string>> = {
  ca: {
    title: 'SISTEMA SOLAR', subtitle: 'Observatori de Cicle Solar', noData: 'SENSE DADES SUFICIENTS',
    day: 'DIA', night: 'NIT', solarNoon: 'Migdia Solar', maxElevation: 'Elevació Màx.',
    dayLength: 'Durada del Dia', realSun: 'Sol Real vs Teòric', uvMax: 'Índex UV Màx.',
    uvClear: 'UV Cel Clar', radiation: 'Radiació Solar', sunriseAz: 'Azimut Sortida', sunsetAz: 'Azimut Posta',
    sunsetQuality: 'Qualitat de Posta', estimate: 'ESTIMAT', week: 'Pròxims 14 Dies', sunrise: 'SORTIDA', sunset: 'POSTA',
    todayCard: 'Avui', backToToday: 'Torna a avui',
    timeline: 'Cronologia', trajectory: 'Trajectòria Solar',
    astroDawn: 'Crep. Astronòmic (sortida)', nauticalDawn: 'Crep. Nàutic (sortida)', civilDawn: 'Crep. Civil (sortida)',
    goldenHourMorning: 'Hora Daurada (matí)', goldenHourEvening: 'Hora Daurada (tarda)',
    civilDusk: 'Crep. Civil (posta)', nauticalDusk: 'Crep. Nàutic (posta)', astroDusk: 'Crep. Astronòmic (posta)',
    in_: 'en', lengthening: 'Els dies s\'allarguen', shortening: 'Els dies s\'escurcen',
  },
  es: {
    title: 'SISTEMA SOLAR', subtitle: 'Observatorio de Ciclo Solar', noData: 'DATOS INSUFICIENTES',
    day: 'DÍA', night: 'NOCHE', solarNoon: 'Mediodía Solar', maxElevation: 'Elevación Máx.',
    dayLength: 'Duración del Día', realSun: 'Sol Real vs Teórico', uvMax: 'Índice UV Máx.',
    uvClear: 'UV Cielo Claro', radiation: 'Radiación Solar', sunriseAz: 'Azimut Salida', sunsetAz: 'Azimut Puesta',
    sunsetQuality: 'Calidad de Puesta', estimate: 'ESTIMADO', week: 'Próximos 14 Días', sunrise: 'SALIDA', sunset: 'PUESTA',
    todayCard: 'Hoy', backToToday: 'Volver a hoy',
    timeline: 'Cronología', trajectory: 'Trayectoria Solar',
    astroDawn: 'Crep. Astronómico (salida)', nauticalDawn: 'Crep. Náutico (salida)', civilDawn: 'Crep. Civil (salida)',
    goldenHourMorning: 'Hora Dorada (mañana)', goldenHourEvening: 'Hora Dorada (tarde)',
    civilDusk: 'Crep. Civil (puesta)', nauticalDusk: 'Crep. Náutico (puesta)', astroDusk: 'Crep. Astronómico (puesta)',
    in_: 'en', lengthening: 'Los días se alargan', shortening: 'Los días se acortan',
  },
  en: {
    title: 'SOLAR SYSTEM', subtitle: 'Solar Cycle Observatory', noData: 'INSUFFICIENT DATA',
    day: 'DAY', night: 'NIGHT', solarNoon: 'Solar Noon', maxElevation: 'Max. Elevation',
    dayLength: 'Day Length', realSun: 'Real vs Theoretical Sun', uvMax: 'Max UV Index',
    uvClear: 'Clear-Sky UV', radiation: 'Solar Radiation', sunriseAz: 'Sunrise Azimuth', sunsetAz: 'Sunset Azimuth',
    sunsetQuality: 'Sunset Quality', estimate: 'ESTIMATE', week: 'Next 14 Days', sunrise: 'SUNRISE', sunset: 'SUNSET',
    todayCard: 'Today', backToToday: 'Back to today',
    timeline: 'Timeline', trajectory: 'Solar Trajectory',
    astroDawn: 'Astronomical Dawn', nauticalDawn: 'Nautical Dawn', civilDawn: 'Civil Dawn',
    goldenHourMorning: 'Golden Hour (AM)', goldenHourEvening: 'Golden Hour (PM)',
    civilDusk: 'Civil Dusk', nauticalDusk: 'Nautical Dusk', astroDusk: 'Astronomical Dusk',
    in_: 'in', lengthening: 'Days are getting longer', shortening: 'Days are getting shorter',
  },
  fr: {
    title: 'SYSTÈME SOLAIRE', subtitle: 'Observatoire du Cycle Solaire', noData: 'DONNÉES INSUFFISANTES',
    day: 'JOUR', night: 'NUIT', solarNoon: 'Midi Solaire', maxElevation: 'Élévation Max.',
    dayLength: 'Durée du Jour', realSun: 'Soleil Réel vs Théorique', uvMax: 'Indice UV Max.',
    uvClear: 'UV Ciel Clair', radiation: 'Radiation Solaire', sunriseAz: 'Azimut Lever', sunsetAz: 'Azimut Coucher',
    sunsetQuality: 'Qualité du Coucher', estimate: 'ESTIMÉ', week: '14 Prochains Jours', sunrise: 'LEVER', sunset: 'COUCHER',
    todayCard: "Aujourd'hui", backToToday: "Retour à aujourd'hui",
    timeline: 'Chronologie', trajectory: 'Trajectoire Solaire',
    astroDawn: 'Crép. Astro. (matin)', nauticalDawn: 'Crép. Nautique (matin)', civilDawn: 'Crép. Civil (matin)',
    goldenHourMorning: 'Heure Dorée (matin)', goldenHourEvening: 'Heure Dorée (soir)',
    civilDusk: 'Crép. Civil (soir)', nauticalDusk: 'Crép. Nautique (soir)', astroDusk: 'Crép. Astro. (soir)',
    in_: 'dans', lengthening: 'Les jours rallongent', shortening: 'Les jours raccourcissent',
  },
};

const localeMap: Record<string, string> = { ca: 'ca-ES', es: 'es-ES', en: 'en-US', fr: 'fr-FR' };

const minutesToHM = (totalSeconds: number | null | undefined): string => {
  if (typeof totalSeconds !== 'number' || isNaN(totalSeconds)) return '--';
  const totalMin = Math.round(totalSeconds / 60);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return `${h}h ${m.toString().padStart(2, '0')}m`;
};

// Mapa d'altitud (-18..90 graus) a coordenada Y de l'SVG (150=horitzó/nadir, 10=zenit)
const MIN_ALT = -18, MAX_ALT = 90, TOP_Y = 12, BOTTOM_Y = 150;
const altToY = (alt: number) => {
  const clamped = Math.max(MIN_ALT, Math.min(MAX_ALT, alt));
  return BOTTOM_Y - ((clamped - MIN_ALT) / (MAX_ALT - MIN_ALT)) * (BOTTOM_Y - TOP_Y);
};
const HORIZON_Y = altToY(0);

export default function SolarModal({ weatherData, onClose, lang = 'ca' }: SolarModalProps) {
  const safeLang: Language = T[lang] ? lang : 'ca';
  const t = T[safeLang];
  const dateLocale = localeMap[safeLang] || 'ca-ES';

  const loc = weatherData.location as LocationMeta | undefined;
  const lat = typeof loc?.latitude === 'number' ? loc.latitude : NaN;
  const lon = typeof loc?.longitude === 'number' ? loc.longitude : NaN;
  const hasValidCoords = !isNaN(lat) && !isNaN(lon);
  const timezone = typeof weatherData.timezone === 'string' ? weatherData.timezone : undefined;
  const utcOffsetSeconds = typeof weatherData.utc_offset_seconds === 'number' ? weatherData.utc_offset_seconds : 0;
  const daily = weatherData.daily;

  // --- Tancament: Escape + bloqueig de scroll (l'historial "enrere" ja el gestiona useModalHistory) ---
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

  // --- Rellotge viu ---
  const [now, setNow] = useState<Date>(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(timer);
  }, []);

  // --- Selecció de dia: la tira de 14 dies és un selector real, no només informativa ---
  const [selectedDayOffset, setSelectedDayOffset] = useState(0); // 0 = avui
  const isToday = selectedDayOffset === 0;

  const todayStr = Array.isArray(daily?.time) ? daily.time[0] : undefined;
  const viewDateStr = isToday ? todayStr : addDaysToDateStr(todayStr, selectedDayOffset);

  // Sempre avui de veritat — independent de la selecció — per llavors la tendència de la
  // tira (cada dia comparat amb l'anterior) i per la lectura "ara mateix" del fons visual.
  const todaySunTimes: SunDayTimes = useMemo(
    () => hasValidCoords ? getSunDayTimesSafe(todayStr, lat, lon) : getSunDayTimesSafe(undefined, 0, 0),
    [todayStr, lat, lon, hasValidCoords]
  );

  // El dia que s'està consultant (avui o el seleccionat a la tira) — determina l'heroi,
  // la trajectòria, la cronologia i les targetes d'estadístiques.
  const sunDayTimes: SunDayTimes = useMemo(
    () => hasValidCoords ? getSunDayTimesSafe(viewDateStr, lat, lon) : getSunDayTimesSafe(undefined, 0, 0),
    [viewDateStr, lat, lon, hasValidCoords]
  );

  // Posició real "ara mateix" — sempre en temps real, mai depèn del dia consultat. Defineix
  // el tema visual dia/nit i només es mostra a l'heroi quan s'està consultant avui.
  const sunNowPos = useMemo(
    () => hasValidCoords ? getSunCompassPosition(now, lat, lon) : null,
    [now, lat, lon, hasValidCoords]
  );

  const isDaytime = (sunNowPos?.altitudeDeg ?? -1) > 0;

  const viewedDayLabel = useMemo(() => {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(viewDateStr || '');
    if (!m) return '';
    const weekday = new Intl.DateTimeFormat(dateLocale, { weekday: 'short' }).format(new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
    return `${weekday} ${Number(m[3])}`;
  }, [viewDateStr, dateLocale]);

  // --- Mostreig de l'arc real (cada 15 min, dia complet del dia consultat) ---
  const arcSamples = useMemo(() => {
    if (!hasValidCoords || !viewDateStr) return [];
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(viewDateStr);
    if (!m) return [];
    const localMidnightUtcMs = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 0, 0, 0) - utcOffsetSeconds * 1000;
    const points: { fraction: number; altitude: number; azimuth: number }[] = [];
    for (let i = 0; i <= 96; i++) {
      const sampleMs = localMidnightUtcMs + i * 15 * 60 * 1000;
      const pos = getSunCompassPosition(new Date(sampleMs), lat, lon);
      if (pos) points.push({ fraction: i / 96, altitude: pos.altitudeDeg, azimuth: pos.azimuthDeg });
    }
    return points;
  }, [hasValidCoords, viewDateStr, lat, lon, utcOffsetSeconds]);

  const arcPath = useMemo(() => {
    if (arcSamples.length === 0) return '';
    return arcSamples.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.fraction * 400} ${altToY(p.altitude)}`).join(' ');
  }, [arcSamples]);

  const nowFraction = useMemo(() => {
    const localSeconds = ((Math.floor(now.getTime() / 1000) + utcOffsetSeconds) % 86400 + 86400) % 86400;
    return localSeconds / 86400;
  }, [now, utcOffsetSeconds]);

  // Cronologia de demà (real, no la del dia consultat), només per poder oferir un "proper
  // esdeveniment" honest durant les hores de nit posteriors al crepuscle astronòmic d'avui
  // quan s'està consultant avui mateix (a un dia futur seleccionat, tots els seus
  // esdeveniments ja són posteriors a "ara" per definició, així que mai cal aquest fallback).
  const tomorrowStr = Array.isArray(daily?.time) ? daily.time[1] : undefined;
  const tomorrowSunTimes = useMemo(
    () => hasValidCoords && tomorrowStr ? getSunDayTimesSafe(tomorrowStr, lat, lon) : null,
    [hasValidCoords, tomorrowStr, lat, lon]
  );

  // --- Cronologia d'esdeveniments del dia consultat (per al comptador i la barra segmentada) ---
  const timelineEvents = useMemo(() => {
    const raw: { key: string; label: string }[] = [
      { key: 'astronomicalDawn', label: t.astroDawn },
      { key: 'nauticalDawn', label: t.nauticalDawn },
      { key: 'civilDawn', label: t.civilDawn },
      { key: 'sunrise', label: t.sunrise },
      { key: 'goldenHourEndMorning', label: t.goldenHourMorning },
      { key: 'solarNoon', label: t.solarNoon },
      { key: 'goldenHourStartEvening', label: t.goldenHourEvening },
      { key: 'sunset', label: t.sunset },
      { key: 'civilDusk', label: t.civilDusk },
      { key: 'nauticalDusk', label: t.nauticalDusk },
      { key: 'astronomicalDusk', label: t.astroDusk },
    ];
    return raw
      .map(r => ({ ...r, date: sunDayTimes[r.key as keyof SunDayTimes] as Date | null }))
      .filter((r): r is { key: string; label: string; date: Date } => r.date instanceof Date);
  }, [sunDayTimes, t]);

  // Primer esdeveniment de demà disponible (normalment l'alba astronòmica, però a
  // latituds altes pot no existir-hi — provem en cascada fins a la sortida de sol).
  const tomorrowFirstEvent = useMemo(() => {
    if (!tomorrowSunTimes) return null;
    const candidates: { key: string; label: string; date: Date | null }[] = [
      { key: 'astronomicalDawn', label: t.astroDawn, date: tomorrowSunTimes.astronomicalDawn },
      { key: 'nauticalDawn', label: t.nauticalDawn, date: tomorrowSunTimes.nauticalDawn },
      { key: 'civilDawn', label: t.civilDawn, date: tomorrowSunTimes.civilDawn },
      { key: 'sunrise', label: t.sunrise, date: tomorrowSunTimes.sunrise },
    ];
    const found = candidates.find((c): c is { key: string; label: string; date: Date } => c.date instanceof Date);
    return found ?? null;
  }, [tomorrowSunTimes, t]);

  const nextEvent = useMemo(() => {
    const upcoming = timelineEvents.filter(e => e.date.getTime() > now.getTime());
    if (upcoming.length > 0) return upcoming[0];
    return isToday ? tomorrowFirstEvent : null;
  }, [timelineEvents, now, tomorrowFirstEvent, isToday]);

  const countdownStr = useMemo(() => {
    if (!nextEvent) return '--';
    const diffMs = nextEvent.date.getTime() - now.getTime();
    const totalMin = Math.max(0, Math.round(diffMs / 60000));
    const h = Math.floor(totalMin / 60);
    const m = totalMin % 60;
    return `${h}h ${m}m`;
  }, [nextEvent, now]);

  // --- Estadístiques del dia consultat (índex = selectedDayOffset dins els arrays d'Open-Meteo) ---
  const getDailyNum = (key: string, idx: number = selectedDayOffset): number | null => {
    const arr = (daily as unknown as Record<string, (number | null)[] | undefined>)?.[key];
    const v = Array.isArray(arr) ? arr[idx] : undefined;
    return typeof v === 'number' && !isNaN(v) ? v : null;
  };

  const uvMax = getDailyNum('uv_index_max');
  const uvClear = getDailyNum('uv_index_clear_sky_max');
  const sunshineSec = getDailyNum('sunshine_duration');
  const radiationSum = getDailyNum('shortwave_radiation_sum');

  // Durada del dia real (astronomia local, no Open-Meteo) — disponible per als 14 dies,
  // no només pels ~7 que l'API arriba a cobrir.
  const viewDaylightSec = useMemo(
    () => (sunDayTimes.sunrise && sunDayTimes.sunset) ? (sunDayTimes.sunset.getTime() - sunDayTimes.sunrise.getTime()) / 1000 : null,
    [sunDayTimes]
  );

  const realSunPct = (viewDaylightSec && sunshineSec !== null) ? Math.round((sunshineSec / viewDaylightSec) * 100) : null;
  const uvCategory = uvMax !== null ? getUVCategory(uvMax) : null;

  const solarNoonAlt = useMemo(
    () => sunDayTimes.solarNoon && hasValidCoords ? getSunCompassPosition(sunDayTimes.solarNoon, lat, lon)?.altitudeDeg ?? null : null,
    [sunDayTimes.solarNoon, hasValidCoords, lat, lon]
  );
  const sunriseAz = useMemo(
    () => sunDayTimes.sunrise && hasValidCoords ? getSunCompassPosition(sunDayTimes.sunrise, lat, lon) : null,
    [sunDayTimes.sunrise, hasValidCoords, lat, lon]
  );
  const sunsetAz = useMemo(
    () => sunDayTimes.sunset && hasValidCoords ? getSunCompassPosition(sunDayTimes.sunset, lat, lon) : null,
    [sunDayTimes.sunset, hasValidCoords, lat, lon]
  );

  // --- Heurística experimental de qualitat de posta del dia consultat ---
  const sunsetQuality = useMemo(() => {
    const hourly = weatherData.hourly;
    const sunsetStr = Array.isArray(daily?.sunset) ? daily.sunset[selectedDayOffset] : undefined;
    if (!hourly || !Array.isArray(hourly.time) || !sunsetStr) return null;
    const targetHourKey = sunsetStr.slice(0, 13); // "YYYY-MM-DDTHH"
    const idx = hourly.time.findIndex(ts => typeof ts === 'string' && ts.slice(0, 13) === targetHourKey);
    if (idx === -1) return null;
    const hourlyAny = hourly as unknown as Record<string, (number | null)[] | undefined>;
    return estimateSunsetQuality(hourlyAny.cloud_cover_mid?.[idx], hourlyAny.cloud_cover_high?.[idx], hourlyAny.relative_humidity_2m?.[idx]);
  }, [weatherData.hourly, daily, selectedDayOffset]);

  // --- Tira de 14 dies (a partir de demà) ---
  // Sortida/posta/durada calculades amb astronomia local (suncalc) per a cada dia, no amb
  // daily.time.length — així no cal ampliar el fetch d'Open-Meteo per allargar la tira.
  // L'UV manté la font real d'Open-Meteo i només es mostra on l'API l'ha donat de veritat.
  // Sempre ancorada a avui (todaySunTimes), no al dia seleccionat — la tira no canvia de
  // contingut quan es tria un dia, només es ressalta la targeta triada.
  const weekDays = useMemo(() => {
    if (!todayStr || !hasValidCoords) return [];
    const dailyAny = daily as unknown as Record<string, (number | null)[] | string[] | undefined>;
    const uvArr = dailyAny.uv_index_max as (number | null)[] | undefined;
    const openMeteoDayCount = Array.isArray(daily?.time) ? daily.time.length : 0;

    let prevDaylightSec = (todaySunTimes.sunrise && todaySunTimes.sunset)
      ? (todaySunTimes.sunset.getTime() - todaySunTimes.sunrise.getTime()) / 1000
      : null;

    return Array.from({ length: STRIP_DAYS }, (_, idx) => {
      const i = idx + 1; // comença demà
      const dateStr = addDaysToDateStr(todayStr, i);
      const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateStr || '');
      const weekdayLabel = m ? new Intl.DateTimeFormat(dateLocale, { weekday: 'short' }).format(new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))) : '--';
      const dayNum = m ? Number(m[3]) : null;

      const dayTimes = getSunDayTimesSafe(dateStr, lat, lon);
      const daylightSecForDay = (dayTimes.sunrise && dayTimes.sunset)
        ? (dayTimes.sunset.getTime() - dayTimes.sunrise.getTime()) / 1000
        : null;

      let trend: 'up' | 'down' | 'flat' | null = null;
      if (typeof daylightSecForDay === 'number' && typeof prevDaylightSec === 'number') {
        const diffMin = Math.round((daylightSecForDay - prevDaylightSec) / 60);
        trend = diffMin > 0 ? 'up' : diffMin < 0 ? 'down' : 'flat';
      }
      prevDaylightSec = daylightSecForDay;

      // Risc Zero: mai extrapolem l'UV més enllà del que Open-Meteo ha retornat de veritat
      const uvMaxForDay = i < openMeteoDayCount && typeof uvArr?.[i] === 'number' ? Math.round(uvArr[i] as number) : null;

      return {
        dateStr: dateStr || '', offset: i, weekdayLabel, dayNum,
        sunrise: formatClockTime(dayTimes.sunrise, timezone) || '--:--',
        sunset: formatClockTime(dayTimes.sunset, timezone) || '--:--',
        dayLength: minutesToHM(daylightSecForDay),
        uvMax: uvMaxForDay,
        trend,
      };
    });
  }, [todayStr, hasValidCoords, lat, lon, timezone, dateLocale, daily, todaySunTimes]);

  // "Durada del dia" a la targeta d'estadístiques: per avui, compara amb demà (Open-Meteo,
  // com sempre); per un dia seleccionat, reutilitza la tendència ja calculada a la tira
  // (aquell dia comparat amb l'anterior).
  const displayTrend = useMemo(() => {
    if (isToday) {
      const arr = (daily as unknown as Record<string, (number | null)[] | undefined>)?.daylight_duration;
      const todayOM = Array.isArray(arr) && typeof arr[0] === 'number' ? arr[0] : null;
      const tomorrowOM = Array.isArray(arr) && typeof arr[1] === 'number' ? arr[1] : null;
      if (todayOM === null || tomorrowOM === null) return null;
      return tomorrowOM > todayOM ? t.lengthening : tomorrowOM < todayOM ? t.shortening : null;
    }
    const dayTrend = weekDays[selectedDayOffset - 1]?.trend;
    return dayTrend === 'up' ? t.lengthening : dayTrend === 'down' ? t.shortening : null;
  }, [isToday, daily, weekDays, selectedDayOffset, t]);

  const bgGradient = isDaytime
    ? 'from-[#241708] via-[#120b03] to-black'
    : 'from-[#0d1120] via-[#080a14] to-black';

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 md:p-6 landscape:p-0 landscape:sm:p-4 bg-black/95 backdrop-blur-3xl backdrop-saturate-150 animate-in fade-in duration-200">
      <style>{`
        .astro-scrollbar { -webkit-overflow-scrolling: touch; }
        .astro-scrollbar::-webkit-scrollbar { width: 5px; height: 5px; }
        .astro-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .astro-scrollbar::-webkit-scrollbar-thumb { background: rgba(251,191,36,0.2); border-radius: 8px; }
        .astro-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(251,191,36,0.4); }
        .astro-hscroll { overscroll-behavior-x: contain; touch-action: pan-x; }
      `}</style>

      <div className={`w-full h-[96dvh] sm:h-auto sm:max-h-[90dvh] landscape:h-[100dvh] landscape:sm:h-auto max-w-sm md:max-w-3xl lg:max-w-5xl flex flex-col min-h-0 bg-gradient-to-b ${bgGradient} rounded-t-[24px] sm:rounded-[32px] border-t sm:border border-amber-500/10 shadow-[0_0_100px_rgba(0,0,0,0.9)] overflow-hidden relative animate-in slide-in-from-bottom-8 sm:zoom-in-95 duration-300`}>
        <StarfieldBackdrop tint="#fbbf24" density={isDaytime ? 30 : 55} />
        <div className={MATRIX_BG}></div>
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[130%] h-56 bg-gradient-to-b from-amber-500/10 via-orange-900/5 to-transparent blur-[80px] pointer-events-none z-0"></div>

        {/* Capçalera */}
        <div className="flex justify-between items-center shrink-0 relative z-20 p-4 md:p-6 border-b border-white/[0.04]">
          <div className="flex items-center gap-3">
            <div className={`relative flex items-center justify-center w-10 h-10 rounded-full border ${isDaytime ? 'bg-amber-500/10 border-amber-500/30 text-amber-400' : 'bg-indigo-500/10 border-indigo-500/30 text-indigo-300'}`}>
              <CloudSun className="w-5 h-5" />
              <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${isDaytime ? 'bg-amber-400' : 'bg-indigo-400'}`}></span>
                <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${isDaytime ? 'bg-amber-500' : 'bg-indigo-500'}`}></span>
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

        {!hasValidCoords ? (
          <div className="flex-1 flex items-center justify-center text-slate-500 font-bold uppercase tracking-widest text-sm p-8 text-center">{t.noData}</div>
        ) : (
          <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain astro-scrollbar relative z-10 p-4 md:p-6 space-y-6">

            {/* HEROI: El Sol, protagonista */}
            <div className="relative rounded-2xl border border-white/5 bg-black/30 backdrop-blur-md p-5 flex flex-col sm:flex-row items-center gap-6">
              <div className="w-40 h-40 sm:w-48 sm:h-48 flex-shrink-0 relative">
                <div className={`absolute inset-0 rounded-full blur-[50px] pointer-events-none transition-colors duration-1000 ${isDaytime ? 'bg-amber-500/25' : 'bg-indigo-500/10'}`}></div>
                <SunOrb elevationDeg={isToday ? (sunNowPos?.altitudeDeg ?? -90) : (solarNoonAlt ?? -90)} className="w-full h-full relative z-10" />
              </div>
              <div className="flex flex-col items-center sm:items-start gap-2 flex-1">
                <span className="text-3xl font-black text-white tracking-tight leading-none">
                  {isToday ? (isDaytime ? t.day : t.night) : viewedDayLabel}
                </span>
                {isToday && sunNowPos ? (
                  <span className="text-sm font-bold text-amber-300">
                    {Math.round(sunNowPos.azimuthDeg)}° {getCardinalLabel(sunNowPos.azimuthDeg, safeLang)} · {sunNowPos.altitudeDeg >= 0 ? '+' : ''}{Math.round(sunNowPos.altitudeDeg)}°
                  </span>
                ) : !isToday && solarNoonAlt !== null ? (
                  <span className="text-sm font-bold text-amber-300">{t.maxElevation} {Math.round(solarNoonAlt)}°</span>
                ) : null}
                {nextEvent && (
                  <div className="flex items-center gap-3 mt-2 px-3 py-1.5 rounded-lg bg-black/40 border border-white/5">
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{nextEvent.label}</span>
                    <span className="text-xs font-mono font-bold text-amber-200">{t.in_} {countdownStr}</span>
                  </div>
                )}
                {!isToday && (
                  <button
                    onClick={() => setSelectedDayOffset(0)}
                    className="mt-1 text-[10px] font-black uppercase tracking-widest text-amber-400/80 hover:text-amber-300 underline underline-offset-2 transition-colors"
                  >
                    ← {t.backToToday}
                  </button>
                )}
              </div>
            </div>

            {/* Trajectòria del dia consultat */}
            <div className="relative rounded-2xl border border-white/5 bg-black/30 backdrop-blur-md p-4 overflow-hidden">
              <div className="flex items-center justify-between mb-1 relative z-10">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                  {t.trajectory} · {isToday ? t.todayCard : viewedDayLabel}
                </span>
              </div>
              <svg viewBox="0 0 400 160" className="w-full h-40 overflow-visible">
                <defs>
                  <filter id="solarGlow" x="-60%" y="-60%" width="220%" height="220%">
                    <feGaussianBlur stdDeviation="4" result="b" />
                    <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
                  </filter>
                </defs>
                <line x1="0" y1={HORIZON_Y} x2="400" y2={HORIZON_Y} stroke="#1e293b" strokeWidth="1" strokeDasharray="2 3" />
                {arcPath && <path d={arcPath} fill="none" stroke={isDaytime ? '#fbbf24' : '#818cf8'} strokeWidth="2" strokeLinecap="round" opacity="0.8" />}
                {arcSamples.length > 0 && (() => {
                  // Avui: marcador viu a la posició real "ara". Un altre dia: marcador estàtic
                  // al punt més alt de la corba (migdia solar), com a referència visual.
                  const p = isToday
                    ? arcSamples[Math.min(96, Math.round(nowFraction * 96))]
                    : arcSamples.reduce((max, s) => s.altitude > max.altitude ? s : max, arcSamples[0]);
                  if (!p) return null;
                  return (
                    <g style={{ transform: `translate(${p.fraction * 400}px, ${altToY(p.altitude)}px)` }}>
                      <circle r="8" fill={isDaytime ? '#fbbf24' : '#818cf8'} opacity={isToday ? 0.25 : 0.15} />
                      <circle r="4" fill="#fff" filter="url(#solarGlow)" opacity={isToday ? 1 : 0.8} />
                    </g>
                  );
                })()}
              </svg>
            </div>

            {/* Barra de cronologia segmentada */}
            <div className="rounded-2xl border border-white/5 bg-black/30 backdrop-blur-md p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                  {t.timeline} · {isToday ? t.todayCard : viewedDayLabel}
                </span>
              </div>
              <div className="relative h-3 rounded-full overflow-hidden bg-gradient-to-r from-indigo-950 via-amber-400 to-indigo-950">
                {timelineEvents.length > 0 && (
                  <div
                    className="absolute top-[-3px] w-[2px] h-[18px] bg-white shadow-[0_0_6px_rgba(255,255,255,0.8)]"
                    style={{ left: `${nowFraction * 100}%` }}
                  />
                )}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-3">
                {timelineEvents.map(e => (
                  <div key={e.key} className="rounded-lg border border-white/5 bg-black/25 px-2.5 py-2 flex flex-col gap-0.5">
                    <span className="text-[10px] text-slate-400 uppercase tracking-wide leading-tight">{e.label}</span>
                    <span className="text-sm font-mono font-bold text-slate-100">{formatClockTime(e.date, timezone)}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Targetes d'estadístiques */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <StatCard label={t.solarNoon} value={formatClockTime(sunDayTimes.solarNoon, timezone) || '--:--'} sub={solarNoonAlt !== null ? `${t.maxElevation} ${Math.round(solarNoonAlt)}°` : undefined} icon={<Sunrise className="w-3.5 h-3.5" />} />
              <StatCard
                label={t.dayLength}
                value={minutesToHM(viewDaylightSec)}
                sub={displayTrend || undefined}
                trendIcon={displayTrend === t.lengthening ? <TrendingUp className="w-3 h-3 text-emerald-400" /> : displayTrend === t.shortening ? <TrendingDown className="w-3 h-3 text-rose-400" /> : <Minus className="w-3 h-3 text-slate-500" />}
                icon={<Gauge className="w-3.5 h-3.5" />}
              />
              <StatCard label={t.realSun} value={realSunPct !== null ? `${realSunPct}%` : '--'} icon={<CloudSun className="w-3.5 h-3.5" />} />
              <StatCard
                label={t.uvMax}
                value={uvMax !== null ? uvMax.toFixed(1) : '--'}
                sub={uvCategory ? uvCategory.label[safeLang] : undefined}
                valueClassName={uvCategory?.color}
                icon={<Zap className="w-3.5 h-3.5" />}
              />
              <StatCard label={t.uvClear} value={uvClear !== null ? uvClear.toFixed(1) : '--'} icon={<Zap className="w-3.5 h-3.5" />} />
              <StatCard label={t.radiation} value={radiationSum !== null ? `${radiationSum.toFixed(1)} MJ/m²` : '--'} icon={<Zap className="w-3.5 h-3.5" />} />
              <StatCard
                label={t.sunriseAz}
                value={sunriseAz ? `${Math.round(sunriseAz.azimuthDeg)}° ${getCardinalLabel(sunriseAz.azimuthDeg, safeLang)}` : '--'}
                icon={<Sunrise className="w-3.5 h-3.5" />}
              />
              <StatCard
                label={t.sunsetAz}
                value={sunsetAz ? `${Math.round(sunsetAz.azimuthDeg)}° ${getCardinalLabel(sunsetAz.azimuthDeg, safeLang)}` : '--'}
                icon={<Sunset className="w-3.5 h-3.5" />}
              />
              {sunsetQuality !== null && (
                <StatCard label={t.sunsetQuality} value={`${sunsetQuality}%`} sub={t.estimate} icon={<Sunset className="w-3.5 h-3.5" />} />
              )}
            </div>

            {/* Tira de 14 dies — clicable: selecciona el dia consultat a tot el modal */}
            <div>
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 block">{t.week}</span>
              <div className="flex gap-2 overflow-x-auto astro-scrollbar astro-hscroll pb-2">
                <button
                  onClick={() => setSelectedDayOffset(0)}
                  className={`flex-shrink-0 w-20 rounded-xl border p-3 flex flex-col items-center justify-center gap-1 transition-colors ${isToday ? 'border-amber-400/60 bg-amber-950/40 ring-1 ring-amber-400/40' : 'border-white/5 bg-[#0c0a08] hover:border-white/20'}`}
                >
                  <span className={`text-[11px] font-black uppercase ${isToday ? 'text-amber-300' : 'text-slate-400'}`}>{t.todayCard}</span>
                </button>
                {weekDays.map((d) => (
                  <button
                    key={d.dateStr}
                    onClick={() => setSelectedDayOffset(d.offset)}
                    className={`flex-shrink-0 w-28 rounded-xl border p-3 flex flex-col items-center gap-1.5 text-left transition-colors ${selectedDayOffset === d.offset ? 'border-amber-400/60 bg-amber-950/40 ring-1 ring-amber-400/40' : 'border-white/5 bg-[#0c0a08] hover:border-white/20'}`}
                  >
                    <span className={`text-[10px] font-black uppercase ${selectedDayOffset === d.offset ? 'text-amber-300' : 'text-slate-400'}`}>{d.weekdayLabel} {d.dayNum}</span>
                    <div className="flex items-center gap-1 text-[11px] font-mono text-amber-300"><Sunrise className="w-3 h-3" />{d.sunrise}</div>
                    <div className="flex items-center gap-1 text-[11px] font-mono text-indigo-300"><Sunset className="w-3 h-3" />{d.sunset}</div>
                    <div className="flex items-center gap-1 text-[10px] font-bold text-slate-300">
                      {d.dayLength}
                      {d.trend === 'up' && <TrendingUp className="w-3 h-3 text-emerald-400" />}
                      {d.trend === 'down' && <TrendingDown className="w-3 h-3 text-rose-400" />}
                    </div>
                    {d.uvMax !== null && <span className="text-[9px] font-bold text-slate-500">UV {d.uvMax}</span>}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
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
  trendIcon?: React.ReactNode;
}

const StatCard = ({ label, value, sub, icon, valueClassName, trendIcon }: StatCardProps) => (
  <div className="rounded-xl border border-white/5 bg-black/30 backdrop-blur-md p-3 flex flex-col gap-1">
    <span className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest text-slate-500">
      {icon}{label}
    </span>
    <span className={`text-lg font-black tabular-nums leading-none flex items-center gap-1.5 ${valueClassName || 'text-white'}`}>
      {value}{trendIcon}
    </span>
    {sub && <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wide">{sub}</span>}
  </div>
);
