// src/components/sky/SunPanel.tsx
// Plafó «El sol» de la pestanya Cel. És la targeta «Cel viu» d'abans (SunArcWidget) en el llenguatge de Previsió: el
// fons del gràfic és el color del cel d'ARA i la corba és l'alçada real del sol (el mateix model que el modal:
// buildSolarDay). De dia va primer i el compte enrere fins a la posta n'és la xifra gran; de nit, va segon i el compte
// enrere fins a la sortida va a la capçalera. A sota del gràfic, la franja de llum del dia (la mateixa paleta que la
// franja «Foscor» d'«Aquesta nit»), i al peu la sortida, la durada del dia, la posta, l'hora daurada i la nit fosca.
// Pensat per a mòbils de gama baixa: cap blur, filtre ni animació. L'SVG es fa un cop per dia; cada minut només es
// mouen el sol, el retall del tram recorregut i els textos.
import { useEffect, useId, useMemo, useState, type CSSProperties, type KeyboardEvent } from 'react';
import * as SunCalc from 'suncalc';
import { TRANSLATIONS, type Language } from '../../translations';
import { SKY_COLORS, type SkyHour, type SkyKind } from '../../utils/daySky';
import type { HourlySeries } from '../../utils/hourlyWeatherCode';
import { cloudHiddenSpans, skyCellsFor, type NightSpan } from '../../utils/sky/nightSky';
import { MATRIX_BG } from '../widgets/widgetStyles';
import { formatHoursMinutes } from '../../utils/formatters';
import { addDays, localClock, localDateOf, makeZoneCtx } from '../../utils/solar/solarTime';
import {
  astroLengthFor, buildSolarDay, geometricAltitude, markerTone, upcomingRiseSet, type SolarDayModel, type TimeText,
} from '../../utils/solar/solarDay';
import { omEdgesFor, type SolarDaily } from '../../utils/solar/solarForecast';
import {
  CARD_H, CARD_STARS_GEO, CARD_W, MINUS, azText, buildSunCardGeom, degText, formatCountdown, formatDeltaLong, sunCardSky,
  sunCardStars,
} from '../../utils/solar/sunCard';
import { dayLightSpans, daySkySpans, spansBackground } from '../../utils/sky/skyStrips';
import { SKY_TEXT, fill } from './skyI18n';
import {
  SKY_EYEBROW, SKY_LABEL, SKY_NOW_TICK, SKY_PAD, SKY_PANEL, SKY_PAST, SKY_RULE, SKY_RULER, SKY_TRACK, SKY_TRACK_EDGE,
} from './skyStyles';

export interface SunPanelProps {
  lang: Language;
  lat?: number;
  lon?: number;
  /** Fus IANA d'Open-Meteo; sense, el desplaçament fix. */
  timezone?: string | null;
  /** utc_offset_seconds d'Open-Meteo. */
  utcOffset?: number;
  /** daily d'Open-Meteo: les seves hores de sortida i posta (si quadren amb l'astronomia) són les que es mostren. */
  daily?: SolarDaily;
  /** calculations.daySky: el cel de cada hora (la franja de Previsió). */
  daySky?: Record<string, SkyHour[]> | null;
  /** weatherData.hourly: la cobertura efectiva de núvols de cada hora. */
  hourly?: HourlySeries | null;
  /** De dia: el compte enrere fins a la posta és la xifra gran del plafó. */
  hero?: boolean;
  /** Obre el modal Cicle solar (tot el plafó és el botó, com la targeta d'abans). */
  onOpen?: () => void;
  /** El dit toca o el focus arriba al plafó: precàrrega del modal. */
  onIntent?: () => void;
  /** Nom accessible del botó ("Cicle solar, posta de sol a les 17:26 · Detall"). */
  label?: string;
}

const pct = (v: number, of: number) => `${Math.round((v / of) * 10000) / 100}%`;

/** Hora de sortida/posta amb el "+1"/"−1" si cau en un altre dia local (dies polars o latituds altes). */
const EdgeTime = ({ tt }: { tt: TimeText | null }) => (
  <>
    {tt?.text ?? '—'}
    {tt && tt.shift !== 0 && <sup className="ml-0.5 text-[10px] text-slate-400">{tt.shift > 0 ? '+1' : `${MINUS}1`}</sup>}
  </>
);

type Clock = (ms: number) => string;

/** La pròxima hora daurada (sol entre −4° i +6°, la del modal): la del matí, la de la tarda o la de demà al matí. */
function nextGolden(nowMs: number, today: SolarDayModel, tomorrow: SolarDayModel | null, clock: Clock): { text: string; tomorrow: boolean } | null {
  const range = (a: number | null, b: number | null) => (a !== null && b !== null ? `${clock(a)} – ${clock(b)}` : null);
  const t = today.t;
  const merged = t.goldenEndAM === null && t.goldenStartPM === null;
  if (merged) {
    if (t.blueStartPM !== null && nowMs < t.blueStartPM) {
      const text = range(t.goldenStartAM, t.blueStartPM);
      if (text) return { text, tomorrow: false };
    }
  } else {
    if (t.goldenEndAM !== null && nowMs < t.goldenEndAM) {
      const text = range(t.goldenStartAM, t.goldenEndAM);
      if (text) return { text, tomorrow: false };
    }
    if (t.blueStartPM !== null && nowMs < t.blueStartPM) {
      const text = range(t.goldenStartPM, t.blueStartPM);
      if (text) return { text, tomorrow: false };
    }
  }
  if (!tomorrow) return null;
  const tt = tomorrow.t;
  const text = tt.goldenEndAM === null && tt.goldenStartPM === null ? range(tt.goldenStartAM, tt.blueStartPM) : range(tt.goldenStartAM, tt.goldenEndAM);
  return text ? { text, tomorrow: true } : null;
}

/** L'ordre de la llegenda de Previsió. */
const LEGEND_ORDER: readonly SkyKind[] = ['clear', 'partly', 'cloudy', 'fog', 'rain', 'snow', 'storm'];

/** El complement dels trams tapats: on el sol es veu. */
const complementSpans = (hidden: ReadonlyArray<NightSpan>): NightSpan[] => {
  const out: NightSpan[] = [];
  let cursor = 0;
  for (const h of hidden) {
    if (h.from > cursor) out.push({ from: cursor, to: h.from });
    cursor = Math.max(cursor, h.to);
  }
  if (cursor < 1) out.push({ from: cursor, to: 1 });
  return out;
};

export const SunPanel = ({ lang, lat, lon, timezone, utcOffset, daily, daySky, hourly, hero = false, onOpen, onIntent, label }: SunPanelProps) => {
  const text = SKY_TEXT[lang] ?? SKY_TEXT.ca;
  const uid = `sp${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;

  // Rellotge alineat amb el canvi de minut (paritat amb el modal: les hores d'Open-Meteo són minuts sencers i el compte
  // enrere arrodoneix avall). Es guarda l'instant real (ms), no els segons arrodonits.
  const [nowMs, setNowMs] = useState<number>(() => Date.now());
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const schedule = () => {
      timer = setTimeout(() => {
        setNowMs(Date.now());
        schedule();
      }, 60000 - (Date.now() % 60000) + 50);
    };
    schedule();
    return () => clearTimeout(timer);
  }, []);

  const pos = typeof lat === 'number' && typeof lon === 'number' && Number.isFinite(lat) && Number.isFinite(lon)
    && Math.abs(lat) <= 90 && Math.abs(lon) <= 180;
  const la = pos ? (lat as number) : NaN;
  const lo = pos ? (lon as number) : NaN;
  const zone = useMemo(() => makeZoneCtx(timezone ?? null, utcOffset ?? 0), [timezone, utcOffset]);
  const today = localDateOf(nowMs, zone);
  const clock = (ms: number) => localClock(ms, zone);

  // Models del dia (memòria cau LRU compartida amb el modal: obrir-lo no recalcula avui).
  const model = useMemo(
    () => (pos ? buildSolarDay({ dateStr: today, lat: la, lon: lo, zone, ...omEdgesFor(daily, today) }) : null),
    [pos, la, lo, today, zone, daily],
  );
  const neighbours = useMemo(() => {
    if (!pos) return { yesterday: null, tomorrow: null, prevAstro: null };
    const y = addDays(today, -1), t = addDays(today, 1);
    return {
      yesterday: buildSolarDay({ dateStr: y, lat: la, lon: lo, zone, ...omEdgesFor(daily, y) }, { lite: true }),
      tomorrow: buildSolarDay({ dateStr: t, lat: la, lon: lo, zone, ...omEdgesFor(daily, t) }, { lite: true }),
      prevAstro: astroLengthFor(y, la, lo, zone),
    };
  }, [pos, la, lo, today, zone, daily]);
  const geom = useMemo(() => (model ? buildSunCardGeom(model) : null), [model]);
  const lightStrip = useMemo(() => (model ? spansBackground(dayLightSpans(model)) : 'none'), [model]);

  // El cel previst d'avui hora a hora (els mateixos codis i colors que la fila «Avui» de Previsió): la franja «Núvols»,
  // el rang de núvols de les hores de llum i els trams en què el sol queda tapat (la corba s'hi dibuixa puntejada).
  const clouds = useMemo(() => {
    if (!model || !daySky?.[today]?.length) return null;
    const only = { [today]: daySky[today] };
    const { cells } = skyCellsFor({ startMs: model.startMs, endMs: model.endMs }, zone, only, hourly);
    if (cells.length === 0) return null;
    const lit = skyCellsFor({ startMs: model.t.sunrise ?? model.startMs, endMs: model.t.sunset ?? model.endMs }, zone, only, hourly);
    const hidden = cloudHiddenSpans(cells.filter(c => c.isDay));
    return {
      strip: spansBackground(daySkySpans(cells)),
      hidden,
      visible: complementSpans(hidden),
      range: lit.cloudRange,
      kinds: LEGEND_ORDER.filter(k => cells.some(c => c.isDay && c.kind === k)),
      hasNight: cells.some(c => !c.isDay && c.kind !== null),
    };
  }, [model, daySky, today, zone, hourly]);
  const weekSky = (TRANSLATIONS[lang] ?? TRANSLATIONS.ca).forecastWeek.sky;

  // --- Derivats d'ara (un cop per minut) ---
  const sunNow = pos ? SunCalc.getPosition(new Date(nowMs), la, lo) : null;   // suncalc 2: graus, azimut des del nord
  const geoNow = sunNow ? geometricAltitude(sunNow.altitude) : -90;
  const tone = markerTone(geoNow);
  const night = geoNow < CARD_STARS_GEO;
  const stars = useMemo(() => (model && geom && night ? sunCardStars(model, geom.yH) : ''), [model, geom, night]);

  // Compte enrere idèntic al del modal: abans de sortir, la sortida; de dia, la posta; després, la sortida de demà.
  const upcoming = model ? upcomingRiseSet(nowMs, model, neighbours.tomorrow, neighbours.yesterday) : null;
  const countdown = upcoming ? formatCountdown(upcoming.ms - nowMs) : null;
  const cdIsSunset = upcoming?.kind === 'sunset';
  const showHero = hero && cdIsSunset && countdown !== null;

  // Δ de la durada respecte d'ahir: astronòmica (suncalc), la mateixa definició que el modal.
  const astroLen = model ? model.astroLengthSec : null;
  const deltaSec = astroLen !== null && neighbours.prevAstro !== null ? astroLen - neighbours.prevAstro : null;
  const delta = deltaSec === null ? null : formatDeltaLong(deltaSec);

  const nowMin = model ? (nowMs - model.startMs) / 60000 : null;
  const marker = geom && model && sunNow && nowMin !== null && nowMin >= 0 && nowMin <= model.spanMin
    ? { x: geom.x(nowMin), y: geom.y(sunNow.altitude) } : null;
  const nowFrac = model && nowMin !== null ? Math.min(1, Math.max(0, nowMin / model.spanMin)) : null;
  const skyStyle: CSSProperties | undefined = geom ? { backgroundImage: sunCardSky(geoNow, geom.yH) } : undefined;
  const noonClock = model?.text.noon?.text ?? null;
  const polarText = model?.polar === 'day' ? text.polarDay : model?.polar === 'night' ? text.polarNight : null;

  const golden = model ? nextGolden(nowMs, model, neighbours.tomorrow, clock) : null;
  // De dia, quan es fa fosc del tot; de nit, quan clareja (el crepuscle civil del matí que ve).
  const darkCell = (() => {
    if (!model) return null;
    if (showHero) return { label: text.fullDark, value: model.t.astroDusk !== null ? clock(model.t.astroDusk) : '—' };
    const dawn = model.t.civilDawn !== null && nowMs < model.t.civilDawn ? model.t.civilDawn : neighbours.tomorrow?.t.civilDawn ?? null;
    return { label: text.firstLight, value: dawn !== null ? clock(dawn) : '—' };
  })();

  const heroSub = (() => {
    if (!showHero || !model || !sunNow) return null;
    const parts: string[] = [];
    const { goldenStartPM, blueStartPM } = model.t;
    if (goldenStartPM !== null && nowMs < goldenStartPM) parts.push(fill(text.goldenFrom, { t: clock(goldenStartPM) }));
    else if (blueStartPM !== null && nowMs < blueStartPM) parts.push(fill(text.goldenUntil, { t: clock(blueStartPM) }));
    parts.push(fill(text.nowAt, { alt: degText(sunNow.altitude), az: azText(sunNow.azimuth, lang) }));
    return parts.join(' ');
  })();

  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!onOpen) return;
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(); }
  };

  return (
    <div
      className={`${SKY_PANEL} h-full select-none ${onOpen ? 'cursor-pointer transition-colors hover:border-white/[0.14] focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/60' : ''}`}
      role={onOpen ? 'button' : undefined}
      tabIndex={onOpen ? 0 : undefined}
      aria-label={onOpen ? label : undefined}
      onClick={onOpen}
      onKeyDown={onOpen ? onKey : undefined}
      onPointerDown={onIntent}
      onFocus={onIntent}
    >
      <div className={MATRIX_BG}></div>

      {/* Capçalera: de nit (o en un dia polar), el compte enrere hi va a la dreta */}
      <div className={`relative z-10 flex items-center justify-between gap-3 ${SKY_PAD} pt-4 md:pt-5 ${showHero ? 'pb-1' : 'pb-3'}`}>
        <h3 className={SKY_EYEBROW}>{text.sunTitle}</h3>
        {!pos ? (
          <span className="text-[13px] text-slate-400">{text.noData}</span>
        ) : !showHero && countdown ? (
          <span className="text-[13px] text-slate-400 whitespace-nowrap">
            {cdIsSunset ? text.sunsetIn : text.sunriseIn}{' '}
            <span className="font-mono tabular-nums text-slate-100">{countdown}</span>
          </span>
        ) : null}
      </div>

      {/* De dia: quant falta per a la posta, gran */}
      {showHero && (
        <div className={`relative z-10 ${SKY_PAD} pt-1 pb-4 flex flex-col gap-1`}>
          <p className="text-[15px] text-slate-400">{text.setsInHero}</p>
          <p className="font-mono tabular-nums text-[34px] leading-none font-semibold tracking-tight text-amber-200">{countdown}</p>
          {heroSub && <p className="mt-1 text-sm leading-snug text-slate-400">{heroSub}</p>}
        </div>
      )}

      {/* Gràfic: cel d'ara, corba real del dia i el sol a la seva posició. A partir de 1024 px el plafó fa l'alçada del
          de la nit i el gràfic creix per omplir-la (si no, quedava un buit entre el gràfic i el peu). */}
      <div className={`relative z-10 ${SKY_PAD} flex flex-col lg:flex-1`}>
        <div className="relative h-[132px] sm:h-[150px] lg:h-auto lg:min-h-[150px] lg:flex-1 rounded-2xl overflow-hidden border border-white/[0.06] bg-[#0c0f17]" style={skyStyle}>
          {geom && model && (
            <>
              <svg viewBox={`0 0 ${CARD_W} ${CARD_H}`} preserveAspectRatio="none" className="absolute inset-0 w-full h-full" aria-hidden="true" focusable="false">
                <defs>
                  <clipPath id={`${uid}d`}><rect x="0" y={geom.clip.day.y} width={CARD_W} height={geom.clip.day.h} /></clipPath>
                  <clipPath id={`${uid}g`}><rect x="0" y={geom.clip.gold.y} width={CARD_W} height={geom.clip.gold.h} /></clipPath>
                  <clipPath id={`${uid}b`}><rect x="0" y={geom.clip.blue.y} width={CARD_W} height={geom.clip.blue.h} /></clipPath>
                  <clipPath id={`${uid}p`}><rect x="0" y="-10" width={marker ? Math.max(0, marker.x) : 0} height={CARD_H + 20} /></clipPath>
                  {clouds && (
                    <>
                      <clipPath id={`${uid}v`}>{clouds.visible.map((s, i) => <rect key={i} x={s.from * CARD_W} y="-10" width={(s.to - s.from) * CARD_W} height={CARD_H + 20} />)}</clipPath>
                      <clipPath id={`${uid}h`}>{clouds.hidden.map((s, i) => <rect key={i} x={s.from * CARD_W} y="-10" width={(s.to - s.from) * CARD_W} height={CARD_H + 20} />)}</clipPath>
                    </>
                  )}
                </defs>
                {stars && <path d={stars} fill="#e2e8f0" fillOpacity=".55" />}
                <line x1="0" x2={CARD_W} y1={geom.yH} y2={geom.yH} stroke="#cbd5e1" strokeOpacity=".35" vectorEffect="non-scaling-stroke" />
                {geom.ticks.map(tk => (
                  <line key={tk.label} x1={tk.x} x2={tk.x} y1={geom.yH} y2={geom.yH + 4} stroke="#cbd5e1" strokeOpacity=".45" vectorEffect="non-scaling-stroke" />
                ))}
                {geom.noon && (
                  <line x1={geom.noon.x} x2={geom.noon.x} y1={geom.noon.y + 3} y2={geom.yH} stroke="#fde68a" strokeOpacity=".3" strokeDasharray="1 3" vectorEffect="non-scaling-stroke" />
                )}
                <path d={geom.curve} fill="none" stroke="#05070f" strokeOpacity={clouds?.hidden.length ? '.3' : '.5'} strokeWidth="5.5" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
                {/* El tram per recórrer, apagat; el recorregut (fins al sol), a tot color. Contínua on el cel previst deixa
                    veure el sol; puntejada on el tapa. */}
                {(clouds ? [['v', undefined], ['h', '3 3']] as const : [['', undefined]] as const).map(([layer, dash]) => (layer === 'h' && clouds?.hidden.length === 0) ? null : (
                  <g key={layer} clipPath={layer ? `url(#${uid}${layer})` : undefined}>
                    {[0.4, 1].map(op => (
                      <g key={op} opacity={op} clipPath={op === 1 ? `url(#${uid}p)` : undefined}>
                        <path d={geom.curve} fill="none" stroke="#818cf8" strokeOpacity=".7" strokeWidth="1.75" strokeLinejoin="round" strokeDasharray={dash} vectorEffect="non-scaling-stroke" />
                        <path d={geom.curve} fill="none" stroke="#60a5fa" strokeWidth="2.5" strokeLinejoin="round" strokeDasharray={dash} clipPath={`url(#${uid}b)`} vectorEffect="non-scaling-stroke" />
                        <path d={geom.curve} fill="none" stroke="#f59e0b" strokeWidth="2.75" strokeLinejoin="round" strokeDasharray={dash} clipPath={`url(#${uid}g)`} vectorEffect="non-scaling-stroke" />
                        <path d={geom.curve} fill="none" stroke="#fcd34d" strokeWidth="2.5" strokeLinejoin="round" strokeDasharray={dash} clipPath={`url(#${uid}d)`} vectorEffect="non-scaling-stroke" />
                      </g>
                    ))}
                  </g>
                ))}
              </svg>

              {/* Capa HTML en %: cercles i textos sense deformar-se quan l'SVG s'estira */}
              <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
                {geom.noon && (
                  <span className="absolute -translate-x-1/2 -translate-y-full whitespace-nowrap font-mono text-[10.5px] leading-none text-amber-200/90"
                    style={{ left: pct(geom.noon.x, CARD_W), top: pct(geom.noon.y - 4, CARD_H) }}>
                    {degText(model.noonAltApp)}{noonClock && <> · {noonClock}</>}
                  </span>
                )}
                {[geom.riseX, geom.setX].map((x, i) => x !== null && (
                  <span key={i} className="absolute w-[7px] h-[7px] -translate-x-1/2 -translate-y-1/2 rounded-full border-[1.5px] border-[#0c0f17] bg-amber-400"
                    style={{ left: pct(x, CARD_W), top: pct(geom.yH, CARD_H) }} />
                ))}
                {marker && tone !== 'below' && (
                  <span className="absolute border-l border-dashed border-amber-200/40"
                    style={{ left: pct(marker.x, CARD_W), top: pct(marker.y, CARD_H), height: pct(Math.max(0, geom.yH - marker.y), CARD_H) }} />
                )}
                {marker && (
                  <span data-testid="sun-card-marker" data-x={Math.round(marker.x * 10) / 10}
                    className="absolute -translate-x-1/2 -translate-y-1/2 flex items-center justify-center"
                    style={{ left: pct(marker.x, CARD_W), top: `${Math.min(92, (marker.y / CARD_H) * 100)}%` }}>
                    {tone === 'below' ? (
                      <span className="block w-[11px] h-[11px] rounded-full border-[1.5px] border-indigo-300 bg-[#0c0f17]" />
                    ) : (
                      <span className={`flex items-center justify-center w-6 h-6 rounded-full ${tone === 'day' ? 'bg-amber-200/20' : 'bg-orange-400/25'}`}>
                        <span className={`block w-[13px] h-[13px] rounded-full border-[1.5px] ${tone === 'day' ? 'bg-amber-50 border-amber-400' : 'bg-orange-200 border-orange-500'}`} />
                      </span>
                    )}
                  </span>
                )}
              </div>
            </>
          )}
        </div>

        {/* Els núvols previstos d'avui (la fila de Previsió) i la llum del dia: nit, crepuscles, hora blava, hora daurada
            i dia (la paleta de «Foscor»), sobre el mateix eix que el gràfic */}
        {model && (
          <div className="mt-2.5" aria-hidden="true">
            {clouds && (
              <>
                <span className="flex items-baseline justify-between gap-3">
                  <span className={SKY_LABEL}>{text.clouds}</span>
                  <span className="font-mono text-[11.5px] text-slate-400 tabular-nums">
                    {clouds.range ? (clouds.range.min === clouds.range.max ? `${clouds.range.max}%` : `${clouds.range.min}–${clouds.range.max}%`) : '—'}
                  </span>
                </span>
                <span className="relative block mt-1.5 mb-2.5">
                  <span className={`${SKY_TRACK} h-2.5`} style={{ backgroundImage: clouds.strip }}>
                    {nowFrac !== null && <span className={SKY_PAST} style={{ width: `${(nowFrac * 100).toFixed(2)}%` }}></span>}
                    <span className={SKY_TRACK_EDGE}></span>
                  </span>
                  {nowFrac !== null && <span className={`${SKY_NOW_TICK} h-[18px]`} style={{ left: `${(nowFrac * 100).toFixed(2)}%` }}></span>}
                </span>
                <span className={`flex ${SKY_LABEL}`}>{text.daylight}</span>
              </>
            )}
            <span className={`relative block ${clouds ? 'mt-1.5' : ''}`}>
              <span className={`${SKY_TRACK} h-2.5`} style={{ backgroundImage: lightStrip }}>
                {clouds && nowFrac !== null && <span className={SKY_PAST} style={{ width: `${(nowFrac * 100).toFixed(2)}%` }}></span>}
                <span className={SKY_TRACK_EDGE}></span>
              </span>
              {nowFrac !== null && <span className={`${SKY_NOW_TICK} h-[18px]`} style={{ left: `${(nowFrac * 100).toFixed(2)}%` }}></span>}
            </span>
            <span className={`${SKY_RULER} mt-1.5`}>
              <span className="absolute left-0">00</span>
              {geom?.ticks.map(tk => (
                <span key={tk.label} className="absolute -translate-x-1/2" style={{ left: pct(tk.x, CARD_W) }}>{tk.label}</span>
              ))}
              <span className="absolute right-0">24 h</span>
            </span>
            {clouds && (
              <span className="flex flex-wrap items-center gap-x-4 gap-y-1.5 pt-2 font-mono text-[10.5px] text-slate-400">
                {clouds.kinds.map(kind => (
                  <span key={kind} className="flex items-center gap-1.5">
                    <span className="w-3.5 h-2 rounded-sm" style={{ backgroundColor: SKY_COLORS[kind].day }}></span>{weekSky[kind]}
                  </span>
                ))}
                {clouds.hasNight && (
                  <span className="flex items-center gap-1.5">
                    <span className="w-3.5 h-2 rounded-sm shadow-[inset_0_0_0_1px_rgba(255,255,255,0.12)]" style={{ backgroundColor: SKY_COLORS.clear.night }}></span>{weekSky.night}
                  </span>
                )}
                {clouds.hidden.length > 0 && (
                  <>
                    <span className="flex items-center gap-1.5"><span className="w-3.5 h-[2.5px] rounded-sm bg-amber-300"></span>{text.seen}</span>
                    <span className="flex items-center gap-1.5"><span className="w-3.5 border-t-2 border-dashed border-amber-300/70"></span>{text.sunHidden}</span>
                  </>
                )}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Sortida · durada · posta */}
      <div className={`relative z-10 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-end gap-2 ${SKY_PAD} pt-3 pb-3.5 mt-3 ${SKY_RULE}`}>
        <div className="min-w-0">
          <div className={SKY_LABEL}>{text.sunrise}</div>
          <div className="font-mono tabular-nums text-[20px] sm:text-[22px] font-semibold leading-tight text-amber-200">
            {model ? <EdgeTime tt={model.riseLabel} /> : '--:--'}
          </div>
          <div className="font-mono text-[11.5px] text-slate-400 truncate">{model ? azText(model.riseAz, lang) : ''}</div>
        </div>
        <div className="text-center">
          <div className={SKY_LABEL}>{text.daylight}</div>
          <div className="font-mono tabular-nums text-[16px] font-semibold leading-snug text-slate-100">{model ? formatHoursMinutes(model.dayLengthSec) : '--'}</div>
          <div className="text-[11.5px] font-mono whitespace-nowrap">
            {polarText ? (
              <span className="text-slate-300">{polarText}</span>
            ) : delta && delta.sign !== 0 ? (
              <span className={delta.sign < 0 ? 'text-rose-300' : 'text-emerald-300'} title={`${delta.text} ${delta.sign < 0 ? text.shorter : text.longer}`}>
                {delta.sign < 0 ? MINUS : '+'}{delta.text}
                <span className="sr-only"> {delta.sign < 0 ? text.shorter : text.longer}</span>
              </span>
            ) : delta ? (
              <span className="text-slate-400">{text.same}</span>
            ) : null}
          </div>
        </div>
        <div className="min-w-0 text-right">
          <div className={SKY_LABEL}>{text.sunset}</div>
          <div className="font-mono tabular-nums text-[20px] sm:text-[22px] font-semibold leading-tight text-amber-200">
            {model ? <EdgeTime tt={model.setLabel} /> : '--:--'}
          </div>
          <div className="font-mono text-[11.5px] text-slate-400 truncate">{model ? azText(model.setAz, lang) : ''}</div>
        </div>
      </div>

      {/* Hora daurada que ve · nit fosca (de dia) o quan clareja (de nit) */}
      {model && (
        <dl className={`relative z-10 mt-auto grid grid-cols-2 ${SKY_RULE}`}>
          <div className={`${SKY_PAD} pt-3 pb-4 flex flex-col gap-1`}>
            <dt className={SKY_LABEL}>{text.golden}</dt>
            <dd className="text-[13px] text-slate-400 whitespace-nowrap">
              {golden ? (
                <>
                  {golden.tomorrow && <>{text.tomorrow} </>}
                  <span className="font-mono tabular-nums text-[14px] text-amber-200">{golden.text}</span>
                </>
              ) : '—'}
            </dd>
          </div>
          {darkCell && (
            <div className={`${SKY_PAD} pt-3 pb-4 flex flex-col gap-1 border-l border-white/[0.06]`}>
              <dt className={SKY_LABEL}>{darkCell.label}</dt>
              <dd className="font-mono tabular-nums text-[14px] text-slate-200">{darkCell.value}</dd>
            </div>
          )}
        </dl>
      )}
    </div>
  );
};
