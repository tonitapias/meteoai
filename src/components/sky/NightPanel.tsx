// src/components/sky/NightPanel.tsx
// Plafó «Aquesta nit» de la pestanya Cel: la nit de la posta a la sortida del sol, on la lluna (la seva alçada al llarg
// de la nit, contínua on el cel previst la deixa veure i puntejada on la tapa), el cel del model hora a hora (la mateixa
// franja i els mateixos colors que Previsió) i la foscor (les fases de llum del sol) comparteixen el mateix eix de temps.
// A dalt, una frase que ho resumeix (utils/sky/nightVerdict.ts); a baix, la lluna (obre el modal Fase lunar) i com serà
// la nit següent. De nit és el primer plafó de la pestanya; de dia, el segon.
// Pensat per a mòbils de gama baixa: un SVG estàtic que es refà quan canvia la nit; cada minut només es mou la marca d'ara.
import { useId, useMemo } from 'react';
import { ChevronRight } from 'lucide-react';
import { TRANSLATIONS, type Language } from '../../translations';
import { MATRIX_BG } from '../widgets/widgetStyles';
import { MoonDisc } from '../MoonDisc';
import { diffDays, localClock, localDateOf, makeZoneCtx } from '../../utils/solar/solarTime';
import type { SolarDaily } from '../../utils/solar/solarForecast';
import { SKY_COLORS, type SkyHour, type SkyKind } from '../../utils/daySky';
import type { HourlySeries } from '../../utils/hourlyWeatherCode';
import { cloudHiddenSpans, findNightWindow, nextNightWindow, nightFraction, nightSkyFor, type NightSkyCell, type NightSpan } from '../../utils/sky/nightSky';
import { nightVerdict } from '../../utils/sky/nightVerdict';
import { moonRiseSetAround } from '../../utils/sky/moonEvents';
import { LIGHT_COLORS, nightSkySpans, spansBackground } from '../../utils/sky/skyStrips';
import { getMoonPhase, getMoonPhaseName, getNamedMoonPhase } from '../../utils/lunarPhases';
import { getCardinalLabel, getMoonCompassPosition, getMoonIlluminationPercent, getNextMoonEvent } from '../../utils/astronomyMath';
import { LOCALE, SKY_TEXT, fill } from './skyI18n';
import {
  SKY_EYEBROW, SKY_LABEL, SKY_NOW_TICK, SKY_PAD, SKY_PANEL, SKY_PAST, SKY_RULE, SKY_RULER, SKY_TRACK, SKY_TRACK_EDGE,
} from './skyStyles';

export interface NightPanelProps {
  lang: Language;
  lat?: number;
  lon?: number;
  timezone?: string | null;
  utcOffset?: number;
  daily?: SolarDaily;
  /** calculations.daySky: el cel de cada hora, la franja de Previsió. */
  daySky?: Record<string, SkyHour[]> | null;
  /** weatherData.hourly: la cobertura efectiva de núvols de cada hora (el % que decideix el codi). */
  hourly?: HourlySeries | null;
  /** Rellotge de l'app (ms, cada minut). */
  nowMs: number;
  /** Obre el modal Fase lunar. */
  onOpenMoon?: () => void;
  /** Nom accessible del botó de la lluna. */
  moonLabel?: string;
}

/** Sistema de coordenades del carril de la lluna (s'estira: preserveAspectRatio none + traços sense escalar). */
const VB_W = 400;
const VB_H = 100;
const BASE = 92;
const TOP = 12;

/** L'ordre de la llegenda de Previsió (el serè de nit hi és «serè», no «sol»). */
const SKY_LEGEND_ORDER: readonly SkyKind[] = ['clear', 'partly', 'cloudy', 'fog', 'rain', 'snow', 'storm'];

/** La precipitació que dura més en una nit (pluja, neu o tempesta), o null. */
const mainPrecipKind = (cells: ReadonlyArray<NightSkyCell>): 'rain' | 'snow' | 'storm' | null => {
  const total = (k: SkyKind) => cells.filter(c => c.kind === k).reduce((s, c) => s + (c.endMs - c.startMs), 0);
  const ranked = (['storm', 'snow', 'rain'] as const).map(k => [k, total(k)] as const).sort((a, b) => b[1] - a[1]);
  return ranked[0][1] > 0 ? ranked[0][0] : null;
};

const pctOf = (f: number) => `${(Math.min(1, Math.max(0, f)) * 100).toFixed(2)}%`;

/** El complement dels trams tapats: on la lluna es veu. */
const visibleSpans = (hidden: ReadonlyArray<NightSpan>): NightSpan[] => {
  const out: NightSpan[] = [];
  let cursor = 0;
  for (const h of hidden) {
    if (h.from > cursor) out.push({ from: cursor, to: h.from });
    cursor = Math.max(cursor, h.to);
  }
  if (cursor < 1) out.push({ from: cursor, to: 1 });
  return out;
};

export const NightPanel = ({ lang, lat, lon, timezone, utcOffset, daily, daySky, hourly, nowMs, onOpenMoon, moonLabel }: NightPanelProps) => {
  const text = SKY_TEXT[lang] ?? SKY_TEXT.ca;
  const uid = `np${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const pos = typeof lat === 'number' && typeof lon === 'number' && Number.isFinite(lat) && Number.isFinite(lon)
    && Math.abs(lat) <= 90 && Math.abs(lon) <= 180;
  const la = pos ? (lat as number) : NaN;
  const lo = pos ? (lon as number) : NaN;
  const zone = useMemo(() => makeZoneCtx(timezone ?? null, utcOffset ?? 0), [timezone, utcOffset]);
  const clock = (ms: number) => localClock(ms, zone);
  const minuteMs = Math.floor(nowMs / 60000) * 60000;

  // La nit que toca (es recalcula cada minut, però és barat: els models del sol són a la memòria cau)...
  const win = useMemo(() => (pos ? findNightWindow(minuteMs, la, lo, zone, daily) : null), [pos, minuteMs, la, lo, zone, daily]);
  const winStart = win?.startMs ?? null, winEnd = win?.endMs ?? null, winPolar = win?.polar ?? 'none';
  // ...i el seu model (lluna, foscor, cel), només quan canvia la nit o la previsió.
  const sky = useMemo(
    () => (winStart !== null && winEnd !== null
      ? nightSkyFor({ startMs: winStart, endMs: winEnd, polar: winPolar }, { lat: la, lon: lo, zone, daily, daySky, hourly })
      : null),
    [winStart, winEnd, winPolar, la, lo, zone, daily, daySky, hourly],
  );
  const nextSky = useMemo(() => {
    if (winStart === null || winEnd === null) return null;
    const next = nextNightWindow({ startMs: winStart, endMs: winEnd, polar: winPolar }, la, lo, zone, daily);
    return next ? nightSkyFor(next, { lat: la, lon: lo, zone, daily, daySky, hourly }) : null;
  }, [winStart, winEnd, winPolar, la, lo, zone, daily, daySky, hourly]);

  // La lluna d'ara: fase (la de la targeta d'abans i el modal), on és, i quan surt i es pon.
  const instant = new Date(minuteMs);
  const phase = getMoonPhase(instant);
  const illum = getMoonIlluminationPercent(phase);
  const phaseName = getMoonPhaseName(getNamedMoonPhase(instant), lang);
  const moonNow = pos ? getMoonCompassPosition(instant, la, lo) : null;
  const riseSet = useMemo(() => (pos ? moonRiseSetAround(minuteMs, la, lo) : null), [pos, minuteMs, la, lo]);
  const localToday = localDateOf(minuteMs, zone);
  // La pròxima plena, la mateixa funció i el mateix instant que la targeta d'abans i el modal.
  const nextFull = useMemo(() => getNextMoonEvent('full', new Date(minuteMs), 45), [minuteMs]);

  const verdict = sky ? nightVerdict(sky.sky, sky.endMs - sky.startMs, sky.moon, illum) : null;
  const nextVerdict = nextSky ? nightVerdict(nextSky.sky, nextSky.endMs - nextSky.startMs, nextSky.moon, illum) : null;
  const nowF = sky ? nightFraction(minuteMs, sky) : null;

  // --- Textos ---
  const dayOffset = (ms: number) => diffDays(localToday, localDateOf(ms, zone));
  const moonLine = (() => {
    if (!riseSet) return null;
    const parts: string[] = [];
    if (riseSet.riseMs !== null) {
      const off = dayOffset(riseSet.riseMs);
      const tpl = riseSet.up ? (off < 0 ? text.roseYesterdayAt : text.roseAt) : (off > 0 ? text.risesTomorrowAt : text.risesAt);
      parts.push(fill(tpl, { t: clock(riseSet.riseMs) }));
    }
    if (riseSet.setMs !== null) {
      parts.push(fill(dayOffset(riseSet.setMs) > 0 ? text.setsTomorrowAt : text.setsAt, { t: clock(riseSet.setMs) }));
    }
    if (parts.length === 0) return null;
    const line = parts.join(' · ');
    return line.charAt(0).toLocaleUpperCase(lang) + line.slice(1);
  })();
  const nextFullText = (() => {
    if (!nextFull) return '—';
    if (nextFull.daysAhead === 0) return text.today;
    if (nextFull.daysAhead === 1) return text.tomorrow;
    // La data de getNextMoonEvent és el migdia UTC del dia de l'esdeveniment (el mateix dia que compta el modal).
    const day = new Intl.DateTimeFormat(LOCALE[lang] ?? 'ca-ES', { weekday: 'short', day: 'numeric', timeZone: 'UTC' }).format(nextFull.date);
    return `${day} · ${nextFull.daysAhead} ${text.days}`;
  })();

  const detail = (() => {
    if (!sky || !verdict) return null;
    const parts: string[] = [];
    if (verdict.change) parts.push(fill(verdict.change.kind === 'opens' ? text.opens : text.closes, { t: clock(verdict.change.atMs) }));
    const upShare = sky.moon.length > 0 ? sky.moon.filter(s => s.alt > 0).length / sky.moon.length : 0;
    if (upShare === 0 || illum < 1) parts.push(text.moonAbsent);
    else if (upShare >= 0.9) parts.push(fill(text.moonAllNight, { p: illum }));
    else if (sky.moonRiseMs !== null && sky.moonSetMs !== null && sky.moonSetMs > sky.moonRiseMs) parts.push(fill(text.moonBetween, { a: clock(sky.moonRiseMs), b: clock(sky.moonSetMs) }));
    else if (sky.moonRiseMs !== null) parts.push(fill(text.moonRises, { t: clock(sky.moonRiseMs) }));
    else if (sky.moonSetMs !== null) parts.push(fill(text.moonSets, { t: clock(sky.moonSetMs) }));
    return parts.join(' ');
  })();

  // La nit següent en poques paraules: el cel, o quan s'obre o es tapa (amb la precipitació d'abans, si n'hi ha: la
  // franja la pinta de blau i la frase no la podia callar).
  const tomorrowSummary = (() => {
    if (!nextVerdict || !nextSky) return null;
    if (nextVerdict.change) {
      const when = fill(nextVerdict.change.kind === 'opens' ? text.tomorrowOpens : text.tomorrowCloses, { t: clock(nextVerdict.change.atMs) });
      const precip = nextVerdict.change.kind === 'opens' ? mainPrecipKind(nextSky.sky) : null;
      return precip ? `${text.tomorrowSky[precip]}, ${when}` : when;
    }
    return nextVerdict.sky === 'unknown' ? null : text.tomorrowSky[nextVerdict.sky];
  })();

  // --- Geometria del carril de la lluna ---
  const lane = useMemo(() => {
    if (!sky) return null;
    const peak = sky.moonPeak?.alt ?? 0;
    const altMax = Math.min(90, Math.max(30, Math.ceil((peak + 8) / 10) * 10));
    const y = (alt: number) => BASE - (alt / altMax) * (BASE - TOP);
    const path = sky.moon.map((s, i) => `${i === 0 ? 'M' : 'L'}${(s.f * VB_W).toFixed(1)} ${y(s.alt).toFixed(1)}`).join(' ');
    const hidden = cloudHiddenSpans(sky.sky);
    return { y, path, hidden, visible: visibleSpans(hidden), cloudBg: spansBackground(nightSkySpans(sky.sky)), darkBg: spansBackground(sky.darkness.map(d => ({ from: d.from, to: d.to, color: LIGHT_COLORS[d.phase] }))) };
  }, [sky]);
  const nextCloudBg = useMemo(() => (nextSky ? spansBackground(nightSkySpans(nextSky.sky)) : 'none'), [nextSky]);

  // La llegenda dels colors del cel: només els que surten aquesta nit, en l'ordre de Previsió.
  const skyKinds = SKY_LEGEND_ORDER.filter(k => sky?.sky.some(c => c.kind === k) || nextSky?.sky.some(c => c.kind === k));
  const weekSky = (TRANSLATIONS[lang] ?? TRANSLATIONS.ca).forecastWeek.sky;

  const moonUpNow = moonNow !== null && moonNow.altitudeDeg > 0;
  const moonMarker = lane && nowF !== null && moonUpNow ? { f: nowF, top: (lane.y(moonNow.altitudeDeg) / VB_H) * 100 } : null;
  const peakLabel = sky?.moonPeak && lane ? { f: nightFraction(sky.moonPeak.ms, sky) ?? 0, top: (lane.y(sky.moonPeak.alt) / VB_H) * 100 } : null;

  const moonRow = (
    <button
      type="button"
      onClick={onOpenMoon}
      aria-label={moonLabel}
      className={`relative z-10 w-full flex items-center gap-3.5 ${SKY_PAD} py-3.5 text-left ${SKY_RULE} transition-colors hover:bg-white/[0.04] focus-visible:outline-none focus-visible:bg-white/[0.05] focus-visible:shadow-[inset_0_0_0_2px_rgba(34,211,238,0.5)]`}
    >
      <span className="block w-11 h-11 shrink-0"><MoonDisc phase={phase} south={pos && la < 0} /></span>
      <span className="flex-1 min-w-0 flex flex-col gap-0.5">
        <span className="text-[15px] font-semibold text-slate-100">
          {phaseName} · <span className="font-mono tabular-nums">{illum}%</span>
        </span>
        {moonLine && <span className="text-[12.5px] leading-snug text-slate-400">{moonLine}</span>}
      </span>
      <span className="shrink-0 text-right flex flex-col gap-0.5">
        <span className={SKY_LABEL}>{text.full}</span>
        <span className="text-[13px] text-slate-200 whitespace-nowrap">{nextFullText}</span>
      </span>
      <ChevronRight className="w-4 h-4 shrink-0 text-[#7a879b]" aria-hidden="true" />
    </button>
  );

  return (
    <section className={`${SKY_PANEL} h-full`} aria-labelledby={`${uid}t`}>
      <div className={MATRIX_BG}></div>

      <div className={`relative z-10 flex items-center justify-between gap-3 ${SKY_PAD} pt-4 md:pt-5 pb-1`}>
        <h3 id={`${uid}t`} className={SKY_EYEBROW}>{text.nightTitle}</h3>
        {sky && (
          <span className="font-mono text-xs tabular-nums text-[#7a879b] whitespace-nowrap">
            {sky.polar === 'night' ? text.polarNightTag : `${clock(sky.startMs)} → ${clock(sky.endMs)}`}
          </span>
        )}
      </div>

      {!sky ? (
        // Sol de mitjanit (o sense coordenades): no hi ha nit; només la lluna.
        <p className={`relative z-10 ${SKY_PAD} pt-2 pb-4 text-sm text-slate-400`}>{pos ? text.midnightSun : text.noData}</p>
      ) : (
        <>
          <div className={`relative z-10 ${SKY_PAD} pt-2 pb-4 flex flex-col gap-1.5`}>
            <p className="text-[19px] sm:text-xl leading-tight font-semibold tracking-tight text-slate-100">{verdict ? text.titles[verdict.title] : text.titles.unknown}</p>
            {detail && <p className="text-sm leading-snug text-slate-400">{detail}</p>}
          </div>

          <div className={`relative z-10 ${SKY_PAD} flex flex-col lg:flex-1`} aria-hidden="true">
            {/* La lluna al llarg de la nit (a partir de 1024 px, creix fins a l'alçada del plafó del sol) */}
            <div className="relative h-[104px] lg:h-auto lg:min-h-[104px] lg:flex-1">
              {lane && (
                <svg viewBox={`0 0 ${VB_W} ${VB_H}`} preserveAspectRatio="none" className="absolute inset-0 w-full h-full" focusable="false">
                  <defs>
                    <clipPath id={`${uid}u`}><rect x="0" y="0" width={VB_W} height={BASE} /></clipPath>
                    <clipPath id={`${uid}v`}>
                      {lane.visible.map((s, i) => <rect key={i} x={s.from * VB_W} y="0" width={(s.to - s.from) * VB_W} height={BASE} />)}
                    </clipPath>
                  </defs>
                  {sky.ticks.map(tk => (
                    <line key={tk.f} x1={tk.f * VB_W} x2={tk.f * VB_W} y1={TOP + 6} y2={BASE} stroke="#ffffff" strokeOpacity=".05" vectorEffect="non-scaling-stroke" />
                  ))}
                  <line x1="0" x2={VB_W} y1={BASE} y2={BASE} stroke="#cbd5e1" strokeOpacity=".3" vectorEffect="non-scaling-stroke" />
                  {lane.hidden.length > 0 && (
                    <path d={lane.path} fill="none" stroke="#cbd5e1" strokeOpacity=".55" strokeWidth="1.5" strokeDasharray="3 3" clipPath={`url(#${uid}u)`} vectorEffect="non-scaling-stroke" />
                  )}
                  <g clipPath={`url(#${uid}v)`}>
                    <path d={lane.path} fill="none" stroke="#e2e8f0" strokeWidth="2.25" strokeLinejoin="round" clipPath={`url(#${uid}u)`} vectorEffect="non-scaling-stroke" />
                  </g>
                  {nowF !== null && (
                    <line x1={nowF * VB_W} x2={nowF * VB_W} y1="0" y2={VB_H} stroke="#f8fafc" strokeOpacity=".2" vectorEffect="non-scaling-stroke" />
                  )}
                </svg>
              )}
              {peakLabel && sky.moonPeak && (
                <span className="absolute -translate-x-1/2 -translate-y-full whitespace-nowrap font-mono text-[10.5px] leading-none text-slate-200"
                  style={{ left: pctOf(Math.min(0.88, Math.max(0.12, peakLabel.f))), top: `calc(${peakLabel.top.toFixed(2)}% - 5px)` }}>
                  {Math.round(sky.moonPeak.alt)}° · {clock(sky.moonPeak.ms)}
                </span>
              )}
              {[sky.moonRiseMs, sky.moonSetMs].map((ms, i) => ms !== null && (
                <span key={i} className="absolute w-[7px] h-[7px] -translate-x-1/2 -translate-y-1/2 rounded-full border-[1.5px] border-[#0b0c13] bg-slate-300"
                  style={{ left: pctOf(nightFraction(ms, sky) ?? 0), top: `${(BASE / VB_H) * 100}%` }} />
              ))}
              {moonMarker && moonNow && (
                <span className="absolute flex items-center gap-1.5 -translate-y-1/2" style={{ left: pctOf(moonMarker.f), top: `${moonMarker.top.toFixed(2)}%` }}>
                  <span className="block w-[15px] h-[15px] -ml-[7.5px] rounded-full bg-[#e6e3da]/15 p-px">
                    <MoonDisc phase={phase} south={la < 0} detail={false} />
                  </span>
                  <span className={`font-mono text-[10.5px] leading-none text-slate-200 whitespace-nowrap ${moonMarker.f > 0.78 ? 'absolute right-full mr-3' : ''}`}>
                    {Math.round(moonNow.altitudeDeg)}° {getCardinalLabel(moonNow.azimuthDeg, lang)}
                  </span>
                </span>
              )}
            </div>

            {/* Núvols previstos, hora a hora (la franja de Previsió) */}
            <div className="mt-2.5 flex items-baseline justify-between gap-3">
              <span className={SKY_LABEL}>{text.clouds}</span>
              <span className="font-mono text-[11.5px] text-slate-400 tabular-nums">
                {sky.cloudRange ? (sky.cloudRange.min === sky.cloudRange.max ? `${sky.cloudRange.max}%` : `${sky.cloudRange.min}–${sky.cloudRange.max}%`) : '—'}
              </span>
            </div>
            <span className="relative block mt-1.5">
              <span className={`${SKY_TRACK} h-3`} style={{ backgroundImage: lane?.cloudBg ?? 'none' }}>
                {nowF !== null && <span className={SKY_PAST} style={{ width: pctOf(nowF) }}></span>}
                <span className={SKY_TRACK_EDGE}></span>
              </span>
              {nowF !== null && <span className={`${SKY_NOW_TICK} h-5`} style={{ left: pctOf(nowF) }}></span>}
            </span>

            {/* Foscor: crepuscles i nit fosca */}
            <div className="mt-2.5 flex items-baseline justify-between gap-3">
              <span className={SKY_LABEL}>{text.darkness}</span>
              <span className="font-mono text-[11.5px] text-slate-400 tabular-nums">
                {sky.dark ? fill(text.darkRange, { a: clock(sky.dark.startMs), b: clock(sky.dark.endMs) }) : text.noFullDark}
              </span>
            </div>
            <span className="relative block mt-1.5">
              <span className={`${SKY_TRACK} h-3`} style={{ backgroundImage: lane?.darkBg ?? 'none' }}>
                {nowF !== null && <span className={SKY_PAST} style={{ width: pctOf(nowF) }}></span>}
                <span className={SKY_TRACK_EDGE}></span>
              </span>
              {nowF !== null && <span className={`${SKY_NOW_TICK} h-5`} style={{ left: pctOf(nowF) }}></span>}
            </span>

            <span className={`${SKY_RULER} mt-1.5`}>
              {sky.ticks.map(tk => (
                <span key={tk.f} className="absolute -translate-x-1/2" style={{ left: pctOf(tk.f) }}>{tk.label}</span>
              ))}
            </span>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 pt-1 pb-3 font-mono text-[10.5px] text-slate-400">
              {skyKinds.map(kind => (
                <span key={kind} className="flex items-center gap-1.5">
                  <span className="w-3.5 h-2 rounded-sm shadow-[inset_0_0_0_1px_rgba(255,255,255,0.12)]" style={{ backgroundColor: SKY_COLORS[kind].night }}></span>
                  {kind === 'clear' ? text.tomorrowSky.clear : weekSky[kind]}
                </span>
              ))}
              <span className="flex items-center gap-1.5"><span className="w-3.5 h-[2.5px] rounded-sm bg-slate-200"></span>{text.seen}</span>
              {lane && lane.hidden.length > 0 && (
                <span className="flex items-center gap-1.5"><span className="w-3.5 border-t-2 border-dashed border-slate-400"></span>{text.hidden}</span>
              )}
              {nowF !== null && <span className="flex items-center gap-1.5"><span className="w-0.5 h-2.5 rounded-full bg-slate-50"></span>{text.now}</span>}
            </div>
          </div>
        </>
      )}

      {pos && moonRow}

      {/* Com serà la nit següent */}
      {nextSky && tomorrowSummary && (
        <div className={`relative z-10 ${SKY_PAD} pt-3 pb-4 ${SKY_RULE} flex flex-col gap-2`}>
          <div className="flex items-baseline justify-between gap-3">
            <span className={SKY_LABEL}>{text.tomorrowNight}</span>
            <span className="text-[13px] text-slate-200">{tomorrowSummary}</span>
          </div>
          <span className={`${SKY_TRACK} h-2`} style={{ backgroundImage: nextCloudBg }} aria-hidden="true">
            <span className={SKY_TRACK_EDGE}></span>
          </span>
        </div>
      )}
    </section>
  );
};
