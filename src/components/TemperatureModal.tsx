// src/components/TemperatureModal.tsx
// Modal de detall de la temperatura: la d'ara i la sensació (amb el perquè quan és evident), on és ara dins la mínima i
// la màxima d'avui, l'avís del que ve (gelada, calor intensa o el canvi més brusc) i l'evolució de 48 h amb scrubbing,
// el traç pintat amb el color de cada temperatura, la sensació en discontinu, la nit ombrejada i la isoterma de 0 °C.
// Totes les xifres surten de utils/temperatureDetail.ts (les mateixes que la capçalera i el giny). Reutilitza
// hourly.temperature_2m i hourly.apparent_temperature, ja demanats a Open-Meteo: cap crida de xarxa nova.
import { useId, useMemo, useRef, useState, memo } from 'react';
import { X, Thermometer, TrendingUp, TrendingDown, Minus, CloudOff, Snowflake, Flame, Activity, ShieldCheck, ArrowUp, ArrowDown, Wind, Droplets } from 'lucide-react';
import type { ExtendedWeatherData } from '../types/weatherLogicTypes';
import type { Language } from '../translations';
import { formatTemp, getSafeLocale, type WeatherUnit } from '../utils/formatters';
import { MATRIX_BG } from './widgets/widgetStyles';
import { ChartGridLines, ChartTickLabels } from './widgets/ChartTicks';
import { POINT_LABEL_TRANSLATE, pointLabelAnchor } from '../utils/chartTicks';
import { astroSheetVars, SHEET_HALO, sheetHaloStyle } from './astroModalStyles';
import { StatCard } from './AstroStatCard';
import { useAstroModalShell } from '../hooks/useAstroModalShell';
import { WEATHER_THRESHOLDS } from '../constants/weatherConfig';
import { buildCapsuleGradient, getAbsoluteColor } from '../utils/temperatureColors';
import { resolveTodayExtremes } from '../utils/dailyExtremes';
import {
  buildTemperatureWindow, classifyTemperatureTrend, getFeelsCause, getThermalBand, positionInRange, summarizeTemperature,
  toUserTempDelta, SHARP_CHANGE_C, type TemperaturePoint,
} from '../utils/temperatureDetail';
import {
  areaPathOf, dayChangesOf, linePathOf, makeXScale, makeYScale, nightBandsOf, segmentsOf, temperatureDomain, temperatureGradientStops,
} from '../utils/temperatureChart';

const { TEMP } = WEATHER_THRESHOLDS;

interface TemperatureModalProps {
  weatherData: ExtendedWeatherData;
  unit: WeatherUnit;
  onClose: () => void;
  lang?: Language;
}

const WINDOW_HOURS = 48;
/** Fins a aquí, un avís diu "d'aquí a N h"; més enllà, el dia i l'hora. */
const EVENT_RELATIVE_MAX_H = 12;

const T: Record<Language, Record<string, string>> = {
  ca: {
    title: 'TEMPERATURA', subtitle: 'Evolució tèrmica i sensació', noData: 'SENSE DADES SUFICIENTS',
    tempNow: 'Temperatura actual', feels: 'Sensació', trend3h: 'Tendència (3h)', today: 'Avui', min: 'Mín', max: 'Màx',
    rising: 'Pujant', falling: 'Baixant', steady: 'Estable',
    wind: 'El vent la fa baixar', humidity: 'La humitat la fa pujar', colder: 'Se sent més fred', warmer: 'Se sent més calor', none: 'Coincideix amb la real',
    freezing: 'Gelada', cold: 'Fred', cool: 'Fresc', mild: 'Suau', warm: 'Càlid', hot: 'Calor', extreme: 'Calor extrema',
    frostTitle: 'Gelada prevista', frostNow: 'Gelada ara mateix', heatTitle: 'Calor intensa', heatNow: 'Calor intensa ara mateix',
    atOrBelow: 'a {v} o menys', atOrAbove: 'a {v} o més', close: 'Tanca',
    sharpTitle: 'Canvi més brusc', drop: 'Baixada', rise: 'Pujada', between: 'entre les {a} i les {b}',
    calmTitle: 'Pròximes 48 h', calm: 'Sense gelades, calor intensa ni canvis bruscos',
    in_: "d'aquí a {h} h", evolution: 'Evolució', scrubHint: 'Toca o arrossega per explorar', now: 'ARA', nowLower: 'ara',
    legendTemp: 'Temperatura', legendFeels: 'Sensació', legendNight: 'Nit', legendFreezing: '0 °C',
    max48: 'Màxima 48h', min48: 'Mínima 48h', amplitude: 'Amplitud avui', frostHours: 'Hores de gelada', heatHours: 'Hores de calor', feelsMin48: 'Sensació mín. 48h',
  },
  es: {
    title: 'TEMPERATURA', subtitle: 'Evolución térmica y sensación', noData: 'DATOS INSUFICIENTES',
    tempNow: 'Temperatura actual', feels: 'Sensación', trend3h: 'Tendencia (3h)', today: 'Hoy', min: 'Mín', max: 'Máx',
    rising: 'Subiendo', falling: 'Bajando', steady: 'Estable',
    wind: 'El viento la hace bajar', humidity: 'La humedad la hace subir', colder: 'Se siente más frío', warmer: 'Se siente más calor', none: 'Coincide con la real',
    freezing: 'Helada', cold: 'Frío', cool: 'Fresco', mild: 'Suave', warm: 'Cálido', hot: 'Calor', extreme: 'Calor extremo',
    frostTitle: 'Helada prevista', frostNow: 'Helada ahora mismo', heatTitle: 'Calor intenso', heatNow: 'Calor intenso ahora mismo',
    atOrBelow: 'a {v} o menos', atOrAbove: 'a {v} o más', close: 'Cerrar',
    sharpTitle: 'Cambio más brusco', drop: 'Bajada', rise: 'Subida', between: 'entre las {a} y las {b}',
    calmTitle: 'Próximas 48 h', calm: 'Sin heladas, calor intenso ni cambios bruscos',
    in_: 'dentro de {h} h', evolution: 'Evolución', scrubHint: 'Toca o arrastra para explorar', now: 'AHORA', nowLower: 'ahora',
    legendTemp: 'Temperatura', legendFeels: 'Sensación', legendNight: 'Noche', legendFreezing: '0 °C',
    max48: 'Máxima 48h', min48: 'Mínima 48h', amplitude: 'Amplitud hoy', frostHours: 'Horas de helada', heatHours: 'Horas de calor', feelsMin48: 'Sensación mín. 48h',
  },
  en: {
    title: 'TEMPERATURE', subtitle: 'Thermal trend and feels-like', noData: 'INSUFFICIENT DATA',
    tempNow: 'Current temperature', feels: 'Feels like', trend3h: 'Trend (3h)', today: 'Today', min: 'Low', max: 'High',
    rising: 'Rising', falling: 'Falling', steady: 'Steady',
    wind: 'Wind makes it feel colder', humidity: 'Humidity makes it feel warmer', colder: 'Feels colder', warmer: 'Feels warmer', none: 'Matches the actual temperature',
    freezing: 'Freezing', cold: 'Cold', cool: 'Cool', mild: 'Mild', warm: 'Warm', hot: 'Hot', extreme: 'Extreme heat',
    frostTitle: 'Frost expected', frostNow: 'Freezing right now', heatTitle: 'Intense heat', heatNow: 'Intense heat right now',
    atOrBelow: 'at {v} or below', atOrAbove: 'at {v} or above', close: 'Close',
    sharpTitle: 'Sharpest change', drop: 'Drop', rise: 'Rise', between: 'between {a} and {b}',
    calmTitle: 'Next 48 h', calm: 'No frost, intense heat or sharp changes',
    in_: 'in {h} h', evolution: 'Evolution', scrubHint: 'Tap or drag to explore', now: 'NOW', nowLower: 'now',
    legendTemp: 'Temperature', legendFeels: 'Feels like', legendNight: 'Night', legendFreezing: '0 °C',
    max48: 'High 48h', min48: 'Low 48h', amplitude: "Today's range", frostHours: 'Frost hours', heatHours: 'Hot hours', feelsMin48: 'Min feels-like 48h',
  },
  fr: {
    title: 'TEMPÉRATURE', subtitle: 'Évolution thermique et ressenti', noData: 'DONNÉES INSUFFISANTES',
    tempNow: 'Température actuelle', feels: 'Ressenti', trend3h: 'Tendance (3h)', today: "Aujourd'hui", min: 'Min', max: 'Max',
    rising: 'En hausse', falling: 'En baisse', steady: 'Stable',
    wind: 'Le vent la fait baisser', humidity: "L'humidité la fait monter", colder: 'Ressenti plus froid', warmer: 'Ressenti plus chaud', none: 'Correspond à la réelle',
    freezing: 'Gel', cold: 'Froid', cool: 'Frais', mild: 'Doux', warm: 'Chaud', hot: 'Très chaud', extreme: 'Chaleur extrême',
    frostTitle: 'Gel prévu', frostNow: 'Gel en ce moment', heatTitle: 'Forte chaleur', heatNow: 'Forte chaleur en ce moment',
    atOrBelow: 'à {v} ou moins', atOrAbove: 'à {v} ou plus', close: 'Fermer',
    sharpTitle: 'Changement le plus brusque', drop: 'Baisse', rise: 'Hausse', between: 'entre {a} et {b}',
    calmTitle: 'Prochaines 48 h', calm: 'Ni gel, ni forte chaleur, ni changement brusque',
    in_: 'dans {h} h', evolution: 'Évolution', scrubHint: 'Touchez ou glissez pour explorer', now: 'MAINTENANT', nowLower: 'maintenant',
    legendTemp: 'Température', legendFeels: 'Ressenti', legendNight: 'Nuit', legendFreezing: '0 °C',
    max48: 'Max 48h', min48: 'Min 48h', amplitude: "Amplitude aujourd'hui", frostHours: 'Heures de gel', heatHours: 'Heures chaudes', feelsMin48: 'Ressenti min 48h',
  },
};

const fill = (template: string, values: Record<string, string | number>) =>
  template.replace(/\{(\w+)\}/g, (_, k: string) => String(values[k] ?? ''));

// Zona útil del gràfic dins el viewBox 0-100.
const PLOT_TOP = 8;
const PLOT_BOTTOM = 92;
const SHEET_GRADIENT = 'from-orange-950/30 to-black/90';
const SHEET_VARS = astroSheetVars(SHEET_GRADIENT);

export default function TemperatureModal({ weatherData, unit, onClose, lang = 'ca' }: TemperatureModalProps) {
  const safeLang: Language = T[lang] ? lang : 'ca';
  const t = T[safeLang];
  const gradientId = `tempm-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;

  // Focus dins el diàleg, Tab que no en surt i fons inert (com la resta de modals dels ginys).
  const dialogRef = useRef<HTMLDivElement>(null);
  const { handleClose } = useAstroModalShell(onClose, dialogRef);

  const points = useMemo(() => buildTemperatureWindow(weatherData, WINDOW_HOURS), [weatherData]);
  const summary = useMemo(() => summarizeTemperature(points), [points]);
  const today = useMemo(() => resolveTodayExtremes(weatherData), [weatherData]);
  const N = points.length;
  const hasData = N > 0 && points[0].temp !== null;

  const show = (c: number | null | undefined) => {
    const v = formatTemp(c, unit);
    return v !== null ? `${v}°` : '--';
  };
  const showDelta = (deltaC: number) => {
    const v = Math.round(toUserTempDelta(deltaC, unit));
    return `${v > 0 ? '+' : ''}${v}°`;
  };

  // Hora d'un punt: "ara", "15:00" si és avui o "dv. 15:00" si és un altre dia.
  const locale = getSafeLocale(safeLang);
  const whenLabel = (p: TemperaturePoint | undefined, index: number): string => {
    if (!p) return '--';
    if (index === 0) return t.nowLower;
    const hhmm = p.time.slice(11, 16);
    if (p.time.slice(0, 10) === points[0]?.time.slice(0, 10)) return hhmm;
    const weekday = new Date(`${p.time.slice(0, 10)}T12:00:00`).toLocaleDateString(locale, { weekday: 'short' });
    return `${weekday} ${hhmm}`;
  };

  // Quan passa una cosa: "d'aquí a 5 h" si és a prop; si no, el dia i l'hora ("dv. 07:00"), més fàcil de llegir que "d'aquí a 40 h".
  const eventWhen = (index: number): string =>
    index <= EVENT_RELATIVE_MAX_H ? fill(t.in_, { h: index }) : whenLabel(points[index], index);

  const nowTemp = points[0]?.temp ?? null;
  const nowFeels = points[0]?.feels ?? null;
  const current = weatherData.current;
  const cause = getFeelsCause(
    nowTemp,
    nowFeels,
    typeof current?.wind_speed_10m === 'number' ? current.wind_speed_10m : null,
    typeof current?.relative_humidity_2m === 'number' ? current.relative_humidity_2m : null
  );
  const band = nowFeels !== null ? getThermalBand(nowFeels) : nowTemp !== null ? getThermalBand(nowTemp) : null;
  const bandColor = nowFeels !== null ? getAbsoluteColor(nowFeels) : nowTemp !== null ? getAbsoluteColor(nowTemp) : '#94a3b8';
  const accent = nowTemp !== null ? getAbsoluteColor(nowTemp) : '#94a3b8';
  const trend = classifyTemperatureTrend(summary.trend3h);
  const marker = positionInRange(nowTemp, today.min, today.max);
  const rangeGradient = today.max !== null && today.min !== null
    ? buildCapsuleGradient(today.max, today.min).replace('to bottom', 'to left')
    : undefined;

  // --- Avisos: gelada i calor intensa tenen prioritat; si no n'hi ha, el canvi més brusc (si ho és); si no, tot tranquil ---
  const notices = (() => {
    const list: { key: string; tone: 'frost' | 'heat' | 'sharp' | 'calm'; title: string; body: string }[] = [];
    if (summary.firstFrost) {
      const f = summary.firstFrost;
      list.push({
        key: 'frost', tone: 'frost',
        title: f.index === 0 ? t.frostNow : t.frostTitle,
        body: [
          f.index === 0 ? null : `${eventWhen(f.index)} (${show(f.value)})`,
          `${summary.frostHours} h ${fill(t.atOrBelow, { v: show(TEMP.FREEZING) })}`,
        ].filter(Boolean).join(' · '),
      });
    }
    if (summary.firstHeat) {
      const h = summary.firstHeat;
      list.push({
        key: 'heat', tone: 'heat',
        title: h.index === 0 ? t.heatNow : t.heatTitle,
        body: [
          h.index === 0 ? null : `${eventWhen(h.index)} (${show(h.value)})`,
          `${summary.heatHours} h ${fill(t.atOrAbove, { v: show(TEMP.HOT) })}`,
        ].filter(Boolean).join(' · '),
      });
    }
    const s = summary.steepest3h;
    if (list.length === 0 && s && Math.abs(s.delta) >= SHARP_CHANGE_C) {
      list.push({
        key: 'sharp', tone: 'sharp',
        title: t.sharpTitle,
        body: `${s.delta < 0 ? t.drop : t.rise} ${showDelta(s.delta)} ${fill(t.between, { a: points[s.fromIndex].time.slice(11, 16), b: points[s.toIndex].time.slice(11, 16) })}`,
      });
    }
    if (list.length === 0) list.push({ key: 'calm', tone: 'calm', title: t.calmTitle, body: t.calm });
    return list;
  })();

  // --- Gràfic ---
  const chart = useMemo(() => {
    const domain = temperatureDomain(points);
    if (!domain || N < 2) return null;
    const xOf = makeXScale(N);
    const yOf = makeYScale(domain, PLOT_TOP, PLOT_BOTTOM);
    const tempSegments = segmentsOf(points, 'temp', xOf, yOf);
    return {
      domain, xOf, yOf,
      stops: temperatureGradientStops(domain),
      line: linePathOf(tempSegments),
      area: areaPathOf(tempSegments, PLOT_BOTTOM),
      feels: linePathOf(segmentsOf(points, 'feels', xOf, yOf)),
      nights: nightBandsOf(points, xOf),
      days: dayChangesOf(points, xOf),
      freezingY: domain.showFreezing ? yOf(0) : null,
    };
  }, [points, N]);

  // --- Scrub horitzontal (mateix patró RAF que Pressió/Vent) ---
  const [scrubIndex, setScrubIndex] = useState<number | null>(null);
  const scrubRafRef = useRef<number | null>(null);
  const latestPointerRef = useRef<{ clientX: number; rect: DOMRect } | null>(null);

  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (N === 0) return;
    latestPointerRef.current = { clientX: e.clientX, rect: e.currentTarget.getBoundingClientRect() };
    if (scrubRafRef.current !== null) return;
    scrubRafRef.current = requestAnimationFrame(() => {
      scrubRafRef.current = null;
      const latest = latestPointerRef.current;
      if (!latest) return;
      const fraction = Math.max(0, Math.min(1, (latest.clientX - latest.rect.left) / latest.rect.width));
      setScrubIndex(Math.round(fraction * (N - 1)));
    });
  };
  const clearScrub = () => {
    if (scrubRafRef.current !== null) { cancelAnimationFrame(scrubRafRef.current); scrubRafRef.current = null; }
    setScrubIndex(null);
  };
  const handleKeyDown = (e: React.KeyboardEvent<SVGSVGElement>) => {
    if (N === 0) return;
    const from = scrubIndex ?? 0;
    let next: number | null = null;
    switch (e.key) {
      case 'ArrowRight': case 'ArrowUp': next = Math.min(N - 1, from + 1); break;
      case 'ArrowLeft': case 'ArrowDown': next = Math.max(0, from - 1); break;
      case 'PageUp': next = Math.min(N - 1, from + 6); break;
      case 'PageDown': next = Math.max(0, from - 6); break;
      case 'Home': next = 0; break;
      case 'End': next = N - 1; break;
      default: return;
    }
    e.preventDefault();
    setScrubIndex(next);
  };

  const activeIndex = scrubIndex ?? 0;
  const active = N > 0 ? points[activeIndex] : null;
  const isScrubbing = scrubIndex !== null && scrubIndex !== 0;
  const readout = active
    ? `${isScrubbing ? whenLabel(active, activeIndex) : t.now} · ${show(active.temp)} · ${t.legendFeels.toLowerCase()} ${show(active.feels)}`
    : null;

  // Amplitud = la diferència de les dues xifres que surten a sota: "17° → 21°" ha de dir 4°, no 5° (16,6 → 21,4).
  const shownTodayMax = formatTemp(today.max, unit);
  const shownTodayMin = formatTemp(today.min, unit);
  const amplitude = shownTodayMax !== null && shownTodayMin !== null ? shownTodayMax - shownTodayMin : null;

  return (
    <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="temperature-modal-title" className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 md:p-6 landscape:p-0 landscape:sm:p-4 bg-black">
      <style>{`
        .temperature-scrollbar { -webkit-overflow-scrolling: touch; }
        .temperature-scrollbar::-webkit-scrollbar { width: 5px; }
        .temperature-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .temperature-scrollbar::-webkit-scrollbar-thumb { background: rgba(251,146,60,0.2); border-radius: 8px; }
        .temperature-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(251,146,60,0.4); }
      `}</style>

      {/* Alçades en % de l'overlay (no en dvh), com la resta de modals dels ginys (vegeu PressureModal). */}
      <div className={`w-full h-[96%] sm:h-auto sm:max-h-[calc(90%+1.8rem)] md:max-h-[calc(90%+2.7rem)] landscape:h-full landscape:sm:h-auto landscape:sm:max-h-[calc(90%+1.8rem)] max-w-sm md:max-w-3xl lg:max-w-5xl flex flex-col min-h-0 bg-gradient-to-b ${SHEET_GRADIENT} rounded-t-[24px] sm:rounded-[32px] border-t sm:border border-orange-500/20 shadow-[0_0_100px_rgba(0,0,0,0.9)] overflow-hidden relative`} style={SHEET_VARS}>
        <div className={MATRIX_BG}></div>
        <div className={SHEET_HALO} style={sheetHaloStyle('amber', 'orange')}></div>

        {/* Capçalera */}
        <div className="flex justify-between items-center shrink-0 relative z-20 p-4 md:p-6 border-b border-white/[0.04]">
          <div className="flex items-center gap-3">
            <div className="relative flex items-center justify-center w-10 h-10 rounded-full border bg-black/40 border-orange-500/30" style={{ color: accent }}>
              <Thermometer className="w-5 h-5" />
            </div>
            <div className="flex flex-col">
              <h2 id="temperature-modal-title" className="text-lg md:text-2xl font-black text-white tracking-tighter leading-none">{t.title}</h2>
              <span className="text-[10px] md:text-xs text-slate-400 font-bold tracking-widest uppercase mt-0.5">{t.subtitle}</span>
            </div>
          </div>
          <button onClick={handleClose} aria-label={t.close} className="p-2.5 astro-card-fill border border-white/5 rounded-full text-slate-400 hover:bg-white/10 hover:text-white active:scale-90 transition-all duration-200 group relative">
            <X className="w-5 h-5 group-hover:rotate-90 transition-transform duration-300" />
            <span className="absolute -bottom-8 left-1/2 -translate-x-1/2 text-[10px] font-mono font-bold text-slate-400 opacity-0 group-hover:opacity-100 hidden md:block transition-opacity">ESC</span>
          </button>
        </div>

        {!hasData ? (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-400 font-bold uppercase tracking-widest text-sm p-8 text-center gap-3">
            <CloudOff className="w-10 h-10 text-slate-600" />
            {t.noData}
          </div>
        ) : (
          <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain temperature-scrollbar relative z-10 p-4 md:p-6 space-y-6">

            {/* HEROI: temperatura i sensació d'ara + rang d'avui */}
            <div className="relative rounded-2xl border border-white/5 astro-card-fill p-5 grid grid-cols-1 md:grid-cols-[auto_1fr_16rem] items-center gap-6">
              <div className="flex flex-col items-center md:items-start gap-1">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{t.tempNow}</span>
                <span className="text-6xl sm:text-7xl font-black tracking-tighter tabular-nums leading-none text-white">{show(nowTemp)}</span>
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{unit === 'F' ? '°F' : '°C'}</span>
              </div>

              <div className="flex flex-col items-center md:items-start gap-2">
                {band && (
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border bg-black/40 w-fit" style={{ borderColor: `${bandColor}66` }}>
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: bandColor }} />
                    <span className="text-xs font-black uppercase tracking-wider" style={{ color: bandColor }}>{t[band]}</span>
                  </div>
                )}
                <div className="flex items-baseline gap-2">
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{t.feels}</span>
                  <span className="text-2xl font-black tabular-nums text-slate-100">{show(nowFeels)}</span>
                </div>
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-300">
                  {cause === 'wind' ? <Wind className="w-3.5 h-3.5 text-sky-300" /> : cause === 'humidity' ? <Droplets className="w-3.5 h-3.5 text-amber-300" /> : null}
                  <span>{t[cause]}</span>
                </div>
                {summary.trend3h !== null && (
                  <div className="flex items-center gap-2 mt-1 px-3 py-1.5 rounded-lg bg-black/40 border border-white/5">
                    {trend === 'rising' ? <TrendingUp className="w-3.5 h-3.5 text-orange-300" /> : trend === 'falling' ? <TrendingDown className="w-3.5 h-3.5 text-sky-300" /> : <Minus className="w-3.5 h-3.5 text-slate-400" />}
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{t.trend3h}</span>
                    <span className={`text-xs font-mono font-bold ${trend === 'rising' ? 'text-orange-300' : trend === 'falling' ? 'text-sky-300' : 'text-slate-300'}`}>
                      {/* Com al giny: "Estable" sense xifra (−0,6° s'arrodonia a "−1°" i semblava que baixava). */}
                      {t[trend]}{trend !== 'steady' ? ` · ${showDelta(summary.trend3h)}` : ''}
                    </span>
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-2 w-full md:border-l md:border-white/5 md:pl-6">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{t.today}</span>
                <div className="flex items-center justify-between text-xs font-bold tabular-nums">
                  <span className="flex items-center gap-1 text-slate-300"><ArrowDown className="w-3 h-3 text-sky-300" />{show(today.min)}</span>
                  <span className="flex items-center gap-1 text-slate-100"><ArrowUp className="w-3 h-3 text-orange-300" />{show(today.max)}</span>
                </div>
                <div className="relative h-2 rounded-full bg-white/10">
                  {rangeGradient && <div className="absolute inset-0 rounded-full opacity-90" style={{ backgroundImage: rangeGradient }} />}
                  {marker !== null && (
                    <span className="absolute top-1/2 w-3.5 h-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white border-2 shadow-[0_0_10px_rgba(255,255,255,0.45)]" style={{ left: `${marker * 100}%`, borderColor: accent }} />
                  )}
                </div>
              </div>
            </div>

            {/* AVISOS */}
            <div className={`grid gap-3 ${notices.length > 1 ? 'md:grid-cols-2' : ''}`}>
              {notices.map(n => <NoticeCard key={n.key} tone={n.tone} title={n.title} body={n.body} />)}
            </div>

            {/* GRÀFIC D'EVOLUCIÓ (scrubbable) */}
            {chart && (
              <div className="relative rounded-2xl border border-white/5 astro-card-fill p-4 overflow-hidden">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-2 sm:mb-1 relative z-10 gap-0.5 sm:gap-2">
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 shrink-0">{t.evolution} · {WINDOW_HOURS}h</span>
                  {readout ? (
                    <span className="text-[11px] font-mono font-bold text-slate-200">{readout}</span>
                  ) : (
                    <span className="text-[10px] text-slate-600 italic">{t.scrubHint}</span>
                  )}
                </div>

                <div className="relative h-44 md:h-56">
                  <svg
                    viewBox="0 0 100 100"
                    preserveAspectRatio="none"
                    className="absolute inset-0 w-full h-full overflow-visible cursor-crosshair rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-400/60"
                    style={{ touchAction: 'none' }}
                    onPointerMove={handlePointerMove}
                    onPointerDown={handlePointerMove}
                    onPointerUp={clearScrub}
                    onPointerLeave={clearScrub}
                    onPointerCancel={clearScrub}
                    tabIndex={0}
                    role="slider"
                    aria-label={`${t.evolution} · ${WINDOW_HOURS}h`}
                    aria-valuemin={0}
                    aria-valuemax={N - 1}
                    aria-valuenow={activeIndex}
                    aria-valuetext={readout ?? undefined}
                    onKeyDown={handleKeyDown}
                  >
                    <defs>
                      <linearGradient id={`${gradientId}-stroke`} gradientUnits="userSpaceOnUse" x1="0" y1={PLOT_TOP} x2="0" y2={PLOT_BOTTOM}>
                        {chart.stops.map(s => <stop key={s.offset} offset={s.offset} stopColor={s.color} />)}
                      </linearGradient>
                      <linearGradient id={`${gradientId}-fill`} gradientUnits="userSpaceOnUse" x1="0" y1={PLOT_TOP} x2="0" y2={PLOT_BOTTOM}>
                        {chart.stops.map(s => <stop key={s.offset} offset={s.offset} stopColor={s.color} stopOpacity={0.24 * (1 - s.offset) + 0.03} />)}
                      </linearGradient>
                    </defs>

                    {chart.nights.map(n => (
                      <rect key={n.x1} x={n.x1} y="0" width={n.x2 - n.x1} height="100" fill="#020617" fillOpacity="0.5" />
                    ))}
                    <ChartGridLines ticks={chart.domain.ticks} y={chart.yOf} x2={100} />
                    {chart.days.map(d => (
                      <line key={d.label} x1={d.x} y1="0" x2={d.x} y2="100" stroke="#475569" strokeOpacity="0.4" strokeWidth="1" strokeDasharray="1 3" vectorEffect="non-scaling-stroke" />
                    ))}
                    {chart.freezingY !== null && (
                      <line x1="0" x2="100" y1={chart.freezingY} y2={chart.freezingY} stroke="#22d3ee" strokeOpacity="0.6" strokeWidth="1" strokeDasharray="4 3" vectorEffect="non-scaling-stroke" />
                    )}

                    {chart.area && <path d={chart.area} fill={`url(#${gradientId}-fill)`} />}
                    {chart.feels && <path d={chart.feels} fill="none" stroke="#cbd5e1" strokeOpacity="0.5" strokeWidth="1.5" strokeDasharray="4 3" strokeLinecap="round" vectorEffect="non-scaling-stroke" />}
                    {chart.line && <path d={chart.line} fill="none" stroke={`url(#${gradientId}-stroke)`} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />}

                    {isScrubbing && active && (
                      <line x1={chart.xOf(activeIndex)} x2={chart.xOf(activeIndex)} y1="0" y2="100" stroke="#fdba74" strokeWidth="1" strokeDasharray="2 2" opacity="0.45" vectorEffect="non-scaling-stroke" />
                    )}
                  </svg>

                  {/* Capa HTML per sobre del SVG (sense capturar el punter: el scrub el fa el SVG) */}
                  <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
                    <ChartTickLabels
                      ticks={chart.domain.ticks} topPct={chart.yOf} format={show}
                      avoid={[summary.max, summary.min]
                        .filter((m): m is NonNullable<typeof m> => m !== null && m.index > 0)
                        .map(m => ({ x: chart.xOf(m.index), y: chart.yOf(m.value) }))}
                    />
                    {chart.days.map(d => (
                      <span key={d.label} className="absolute bottom-0 -translate-x-1/2 text-[10px] font-mono font-bold text-slate-400" style={{ left: `${d.x}%` }}>
                        {d.label}
                      </span>
                    ))}
                    {summary.max && summary.max.index > 0 && (
                      <ExtremeDot x={chart.xOf(summary.max.index)} y={chart.yOf(summary.max.value)} color={getAbsoluteColor(summary.max.value)} label={show(summary.max.value)} placement="below" />
                    )}
                    {summary.min && summary.min.index > 0 && (
                      <ExtremeDot x={chart.xOf(summary.min.index)} y={chart.yOf(summary.min.value)} color={getAbsoluteColor(summary.min.value)} label={show(summary.min.value)} placement="above" />
                    )}
                    {active && active.temp !== null && (
                      <span className="absolute w-3.5 h-3.5 -translate-x-1/2 -translate-y-1/2 flex items-center justify-center" style={{ left: `${chart.xOf(activeIndex)}%`, top: `${chart.yOf(active.temp)}%` }}>
                        <span className="absolute inset-0 rounded-full opacity-30" style={{ backgroundColor: getAbsoluteColor(active.temp) }} />
                        <span className="relative w-[7px] h-[7px] rounded-full bg-white/95" />
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 mt-3 relative z-10">
                  <LegendItem kind="gradient" label={t.legendTemp} />
                  <LegendItem kind="dashed" color="#cbd5e1" label={t.legendFeels} />
                  <LegendItem kind="night" label={t.legendNight} />
                  {chart.freezingY !== null && <LegendItem kind="dashed" color="#22d3ee" label={t.legendFreezing} />}
                </div>
              </div>
            )}

            {/* TARGETES D'ESTADÍSTIQUES */}
            <StatsSection
              t={t}
              max={summary.max ? { value: show(summary.max.value), when: whenLabel(points[summary.max.index], summary.max.index) } : null}
              min={summary.min ? { value: show(summary.min.value), when: whenLabel(points[summary.min.index], summary.min.index) } : null}
              amplitude={amplitude !== null ? `${amplitude}°` : '--'}
              amplitudeSub={`${show(today.min)} → ${show(today.max)}`}
              fourth={
                summary.frostHours > 0
                  ? { label: t.frostHours, value: `${summary.frostHours} h`, sub: fill(t.atOrBelow, { v: show(TEMP.FREEZING) }), icon: <Snowflake className="w-3.5 h-3.5" />, color: 'text-cyan-300' }
                  : summary.heatHours > 0
                    ? { label: t.heatHours, value: `${summary.heatHours} h`, sub: fill(t.atOrAbove, { v: show(TEMP.HOT) }), icon: <Flame className="w-3.5 h-3.5" />, color: 'text-orange-300' }
                    : { label: t.feelsMin48, value: show(summary.feelsMin?.value), sub: summary.feelsMin ? whenLabel(points[summary.feelsMin.index], summary.feelsMin.index) : '', icon: <Thermometer className="w-3.5 h-3.5" />, color: 'text-white' }
              }
            />
          </div>
        )}
      </div>
    </div>
  );
}

const NOTICE_TONES = {
  frost: { border: 'border-cyan-400/30', icon: 'text-cyan-300 border-cyan-400/30', text: 'text-cyan-200' },
  heat: { border: 'border-orange-500/30', icon: 'text-orange-400 border-orange-500/30', text: 'text-orange-300' },
  sharp: { border: 'border-amber-400/30', icon: 'text-amber-300 border-amber-400/30', text: 'text-amber-200' },
  calm: { border: 'border-emerald-500/25', icon: 'text-emerald-400 border-emerald-500/25', text: 'text-emerald-400' },
} as const;

const NoticeCard = memo(function NoticeCard({ tone, title, body }: { tone: keyof typeof NOTICE_TONES; title: string; body: string }) {
  const c = NOTICE_TONES[tone];
  const Icon = tone === 'frost' ? Snowflake : tone === 'heat' ? Flame : tone === 'sharp' ? Activity : ShieldCheck;
  return (
    <div className={`rounded-2xl border p-4 flex items-center gap-4 bg-black/30 ${c.border}`}>
      <div className={`shrink-0 w-10 h-10 rounded-full flex items-center justify-center border bg-black/40 ${c.icon}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div className="flex flex-col min-w-0">
        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{title}</span>
        <span className={`text-sm font-bold ${c.text}`}>{body}</span>
      </div>
    </div>
  );
});

const ExtremeDot = memo(function ExtremeDot({ x, y, color, label, placement }: { x: number; y: number; color: string; label: string; placement: 'above' | 'below' }) {
  // L'etiqueta queda dins el gràfic (a sota del màxim, a sobre del mínim), en una línia i, a prop d'una vora, ancorada
  // cap a dins (pointLabelAnchor), com al giny.
  return (
    <>
      <span className="absolute w-2 h-2 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-black/60" style={{ left: `${x}%`, top: `${y}%`, backgroundColor: color }} />
      <span
        className={`absolute ${POINT_LABEL_TRANSLATE[pointLabelAnchor(x)]} whitespace-nowrap px-1 rounded-sm bg-black/60 text-[10px] font-mono font-bold tabular-nums text-slate-100 ${placement === 'below' ? 'mt-2' : '-translate-y-full -mt-2'}`}
        style={{ left: `${x}%`, top: `${y}%` }}
      >
        {label}
      </span>
    </>
  );
});

const LegendItem = memo(function LegendItem({ kind, color, label }: { kind: 'gradient' | 'dashed' | 'night'; color?: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      {kind === 'gradient' && <span className="w-4 h-1 rounded-full" style={{ backgroundImage: 'linear-gradient(to right, #06b6d4, #10b981, #a3e635, #fbbf24, #f97316)' }} />}
      {kind === 'dashed' && <span className="w-4 h-0" style={{ borderTop: `1.5px dashed ${color}` }} />}
      {kind === 'night' && <span className="w-3 h-3 rounded-sm bg-slate-950 border border-white/10" />}
      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</span>
    </div>
  );
});

interface StatsSectionProps {
  t: Record<string, string>;
  max: { value: string; when: string } | null;
  min: { value: string; when: string } | null;
  amplitude: string;
  amplitudeSub: string;
  fourth: { label: string; value: string; sub: string; icon: React.ReactNode; color: string };
}

const StatsSection = memo(function StatsSection({ t, max, min, amplitude, amplitudeSub, fourth }: StatsSectionProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      <StatCard label={t.max48} value={max?.value ?? '--'} sub={max?.when} icon={<ArrowUp className="w-3.5 h-3.5" />} valueClassName={max ? undefined : 'text-slate-500'} />
      <StatCard label={t.min48} value={min?.value ?? '--'} sub={min?.when} icon={<ArrowDown className="w-3.5 h-3.5" />} valueClassName={min ? undefined : 'text-slate-500'} />
      <StatCard label={t.amplitude} value={amplitude} sub={amplitudeSub} icon={<Activity className="w-3.5 h-3.5" />} />
      <StatCard label={fourth.label} value={fourth.value} sub={fourth.sub} icon={fourth.icon} valueClassName={fourth.color} />
    </div>
  );
});
