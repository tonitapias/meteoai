// src/components/welcome/EarthElevator.tsx
// L'ascensor cap avall: el segon secret de la benvinguda. S'obre aixafant la columna cap avall tres cops
// (hooks/welcome/useColumnStretch) i es carrega a part, només llavors. La càmera baixa per quatre parades (el pou de
// Kola, el mantell, el nucli de ferro i el centre de la Terra) i surt a les antípodes: la foto real del satèl·lit i el
// temps d'ara allà i aquí. "Torna per dins" hi torna en caiguda lliure i el casc surt per la benvinguda.
// Com l'ascensor (SkyElevator), pensat per a mòbils modestos: un sol rellotge (requestAnimationFrame) mou les capes amb
// opacitat i transformacions escrites directament, res de filtres ni desenfocaments, i amb "reduir el moviment" les
// parades es fonen sense desplaçar-se.
import { KeyboardEvent as ReactKeyboardEvent, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { Language } from '../../translations';
import type { StrictCurrentWeather } from '../../types/weatherLogicTypes';
import { formatDecimal, formatHoursMinutes, getSafeLocale, getWeatherLabel, type WeatherUnit } from '../../utils/formatters';
import { getCardinalLabel } from '../../utils/astronomyMath';
import { shareLink } from '../../utils/shareLink';
import { markSecretFound } from '../../utils/welcome/secretsFound';
import { formatAltitude, formatDistance, NBSP, viewBoxFor } from '../../utils/welcome/skyElevator';
import {
  antipode, DESCENT_MS, DESCENT_STOPS, descentFrame, descentSkip, descentStopSpan, EARTH_DIAMETER_M, EARTH_LAYERS,
  EARTH_RADIUS_M, earthTemperature, formatCmRange, formatCoords, formatEarthTemperature, MEASURED_DEPTH_M, NEAR_LAND_KM,
  photoAgeDays, photoLabels, RETURN_MS, returnRemaining, rulerFraction, rulerTicks, scaleBar, seasonAt, type PhotoScale,
} from '../../utils/welcome/earthElevator';
import type { WelcomeSky } from '../../utils/welcome/welcomeSky';
import { useAntipodesPhoto } from '../../hooks/welcome/useAntipodesPhoto';
import { useAntipodesPlace } from '../../hooks/welcome/useAntipodesPlace';
import { useAntipodesWeather, type PlaceWeather } from '../../hooks/welcome/useAntipodesWeather';
import { AntipodesPhotoView } from './AntipodesPhotoView';
import { CentreScene, CoreScene, Helmet, KolaScene, MantleScene, ReturnScene } from './EarthScenes';
import { EARTH_ELEVATOR_TEXT } from './earthElevatorI18n';

export interface EarthElevatorProps {
  sky: WelcomeSky;
  lang: Language;
  unit: WeatherUnit;
  /** Lletres dels punts cardinals de l'idioma (les de la columna). */
  cardinals: { north: string; south: string; east: string; west: string };
  onClose: () => void;
  /** El casc ha sortit per la benvinguda: el missatge de l'avís final, ja traduït. */
  onLand: (message: string) => void;
}

type Phase = 'descent' | 'arrived' | 'return' | 'landing';

const STOPS = DESCENT_STOPS.length;
const ARRIVAL = STOPS - 1;
/** Quant es desplaça una parada (en fracció de la pantalla) quan entra per baix o surt per dalt. */
const SLIDE = 0.38;
const LANDING_MS = 1700;
/** La foto ocupa aquesta part de dalt de la pantalla; la targeta del temps, la resta (i hi passa 28 px per sobre). */
const PHOTO_SHARE = 0.4;
const prefersReducedMotion = () =>
  typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const fill = (template: string, values: Record<string, string>) =>
  template.replace(/\{(\w+)\}/g, (match, key: string) => values[key] ?? match);

/** Regla de l'esquerra: viewBox 70 × 520, de y = 10 (on ets) a y = 510 (les antípodes). */
const rulerY = (depth: number) => 10 + rulerFraction(depth) * 500;
const LAYER_FILL = { crust: '#d6d3d1', mantle: 'url(#ee-mantle)', outerCore: '#f97316', innerCore: '#fde68a' } as const;
/** Les capes de la regla, de baixada fins al centre i de pujada a l'altra banda. */
const RULER_LAYERS = (() => {
  const down = EARTH_LAYERS.map((layer, i) => ({ id: layer.id, from: i === 0 ? 0 : EARTH_LAYERS[i - 1].to, to: layer.to }));
  const up = [...down].reverse().map(l => ({ id: l.id, from: EARTH_DIAMETER_M - l.to, to: EARTH_DIAMETER_M - l.from }));
  return [...down, ...up];
})();

/** Nom d'un país a partir del codi, en l'idioma de l'usuari (sense, el codi). */
function countryName(cc: string, locale: string): string {
  if (!cc) return '';
  try {
    return new Intl.DisplayNames([locale], { type: 'region' }).of(cc) ?? cc;
  } catch {
    return cc;
  }
}

/** El dia del calendari ("2026-10-27") d'una hora local ja desplaçada a UTC. */
const isoDay = (d: Date) => d.toISOString().slice(0, 10);

interface Caption { eyebrow: string; title: string; body: string }

export default function EarthElevator({ sky, lang, unit, cardinals, onClose, onLand }: EarthElevatorProps) {
  const labels = EARTH_ELEVATOR_TEXT[lang];
  const locale = getSafeLocale(lang);
  const [reduced] = useState(prefersReducedMotion);
  const home = sky.place;
  const there = useMemo(() => antipode(home.lat, home.lon), [home.lat, home.lon]);

  const [vb, setVb] = useState(() => viewBoxFor(window.innerWidth, window.innerHeight));
  useEffect(() => {
    const onResize = () => setVb(viewBoxFor(window.innerWidth, window.innerHeight));
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  // La foto es baixa per a la mida de pantalla d'ara, amb marge perquè no s'hi vegin vores si canvia una mica.
  const [frame] = useState(() => ({ width: Math.round(window.innerWidth + 64), height: Math.round(window.innerHeight * PHOTO_SHARE + 64) }));

  // Tot es demana en obrir l'ascensor: arriba mentre es baixa.
  const weather = useAntipodesWeather(home, there, unit);
  const place = useAntipodesPlace(there.lat, there.lon, lang);
  const photoScale: PhotoScale | null = !place ? null
    : place.reverse?.locality || (place.nearest && place.nearest.km < NEAR_LAND_KM) ? 'land' : 'sea';
  const photo = useAntipodesPhoto(there.lat, there.lon, photoScale, frame);

  const [phase, setPhase] = useState<Phase>('descent');
  const [stage, setStage] = useState(0);
  const [copied, setCopied] = useState(false);

  // --- Textos ---
  const km = useCallback((v: number) => formatDistance(v, unit, locale), [unit, locale]);
  const temp = (celsius: number, depth: number) => formatEarthTemperature(celsius, depth > MEASURED_DEPTH_M + 1, unit, locale);
  const captions: Caption[] = [
    { eyebrow: fill(labels.kolaEyebrow, { km: km(12) }), title: labels.kolaTitle, body: fill(labels.kolaBody, { depth: formatAltitude(DESCENT_STOPS[0].depth, unit, locale) }) },
    { eyebrow: fill(labels.mantleEyebrow, { km: km(100) }), title: labels.mantleTitle, body: labels.mantleBody },
    { eyebrow: fill(labels.coreEyebrow, { km: km(2890) }), title: labels.coreTitle, body: labels.coreBody },
    { eyebrow: fill(labels.centreEyebrow, { km: km(EARTH_RADIUS_M / 1000) }), title: labels.centreTitle, body: fill(labels.centreBody, { temp: formatEarthTemperature(earthTemperature(EARTH_RADIUS_M), true, unit, locale, false) }) },
  ];
  const returnCaption: Caption = { eyebrow: labels.returnEyebrow, title: labels.returnTitle, body: labels.returnBody };
  const ticks = useMemo(() => rulerTicks(unit, locale), [unit, locale]);

  // --- L'arribada ---
  // L'hora de les dues bandes: la d'obrir l'ascensor, posada al dia en arribar i cada quinze segons mentre s'hi és.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (phase !== 'arrived') return;
    const raf = requestAnimationFrame(() => setNow(Date.now()));
    const timer = window.setInterval(() => setNow(Date.now()), 15_000);
    return () => { cancelAnimationFrame(raf); window.clearInterval(timer); };
  }, [phase]);
  const ready = weather.status === 'ready' ? weather : null;
  const atSea = !place?.reverse?.locality && (ready ? ready.sea !== null : (place?.nearest?.km ?? Infinity) > NEAR_LAND_KM);
  const nearName = place?.nearest ? `${place.nearest.place.name}${place.nearest.place.cc ? ` (${countryName(place.nearest.place.cc, locale)})` : ''}` : '';
  const nearKm = place?.nearest ? km(Math.round(place.nearest.km)) : '';
  let placeLine = '';
  if (place?.reverse?.locality && place.reverse.country) placeLine = `${place.reverse.locality}, ${place.reverse.country}.`;
  else if (place?.nearest) {
    // El nom de l'oceà obre la frase: el servei el dona en minúscula en català ("oceà Pacífic").
    const sea = place.reverse?.sea ?? labels.openSea;
    placeLine = atSea
      ? fill(labels.placeSea, { sea: sea.charAt(0).toLocaleUpperCase(locale) + sea.slice(1), km: nearKm, place: nearName })
      : fill(labels.placeNear, { km: nearKm, place: nearName });
  }
  const deviceOffsetSec = -new Date(now).getTimezoneOffset() * 60;
  const localAt = (offsetSec: number) => new Date(now + offsetSec * 1000);
  const thereLocal = localAt(ready?.there.utcOffsetSec ?? Math.round(there.lon / 15) * 3600);
  const hereLocal = localAt(ready?.here.utcOffsetSec ?? deviceOffsetSec);
  const dayShift = isoDay(thereLocal) === isoDay(hereLocal) ? 0 : isoDay(thereLocal) > isoDay(hereLocal) ? 1 : -1;
  // Al mar, el fus és el nàutic i la data pot no ser la de la terra més propera (prop del meridià 180): només l'hora.
  const showDay = dayShift !== 0 && !atSea;
  const arrivalTitle = showDay ? (dayShift > 0 ? labels.arrivalTomorrow : labels.arrivalYesterday) : labels.arrivalTitle;
  const clock = (d: Date) => {
    const time = new Intl.DateTimeFormat(locale, { hour: 'numeric', minute: '2-digit', timeZone: 'UTC' }).format(d);
    return showDay ? `${new Intl.DateTimeFormat(locale, { weekday: 'short', timeZone: 'UTC' }).format(d)} ${time}` : time;
  };
  const degrees = (v: number | null) => (v === null ? '—' : `${formatDecimal(v, lang, 1)}${NBSP}°${unit}`);
  const skyLabel = (w: PlaceWeather) => (w.code === null ? '—' : getWeatherLabel({ weather_code: w.code } as unknown as StrictCurrentWeather, lang, w.cloudCover));
  const seasonThere = seasonAt(thereLocal, there.lat);
  const seasonHere = seasonAt(hereLocal, home.lat);
  const rows: [string, string, string][] = ready ? [
    [labels.rowTime, clock(thereLocal), clock(hereLocal)],
    ...(seasonThere && seasonHere ? [[labels.rowSeason, labels[seasonThere], labels[seasonHere]] as [string, string, string]] : []),
    [labels.rowTemp, degrees(ready.there.temperature), degrees(ready.here.temperature)],
    [labels.rowSky, skyLabel(ready.there), skyLabel(ready.here)],
    [labels.rowDaylight, formatHoursMinutes(ready.there.daylightSec), formatHoursMinutes(ready.here.daylightSec)],
  ] : [];
  const chips: string[] = [];
  if (ready && atSea && ready.sea) {
    const height = `${formatDecimal(ready.sea.waveHeight, lang, 1)}${NBSP}${unit === 'F' ? 'ft' : 'm'}`;
    if (ready.sea.wavePeriod !== null) chips.push(fill(labels.waves, { h: height, s: String(Math.round(ready.sea.wavePeriod)) }));
    if (ready.sea.seaTemp !== null) chips.push(fill(labels.water, { t: degrees(ready.sea.seaTemp) }));
  } else if (ready) {
    const w = ready.there;
    if (w.windSpeed !== null && w.windDir !== null) {
      chips.push(fill(labels.wind, { speed: `${Math.round(w.windSpeed)}${NBSP}${unit === 'F' ? 'mph' : 'km/h'}`, dir: getCardinalLabel(w.windDir, lang) }));
    }
    if (w.apparent !== null) chips.push(fill(labels.feels, { t: degrees(w.apparent) }));
  }
  const photoLabelsList = useMemo(() => {
    if (photo.status !== 'ready' || !place) return [];
    return photoLabels(place.places, there.lat, there.lon, photo.zoom, photo.tilePx, window.innerWidth, window.innerHeight * PHOTO_SHARE)
      .map(({ place: p, x, y }) => ({ key: `${p.name}${p.lat}`, text: p.name, x, y }));
  }, [photo, place, there.lat, there.lon]);
  const bar = photo.status === 'ready' ? scaleBar(there.lat, photo.zoom, photo.tilePx, unit) : null;
  const age = photo.status === 'ready' ? photoAgeDays(now, there.lon, photo.passDay) : 0;
  const credit = `NOAA-20 · NASA · ${age === 0 ? labels.photoToday : age === 1 ? labels.photoYesterday : fill(labels.photoDaysAgo, { n: String(age) })}`;

  // --- Escriptura directa a cada fotograma ---
  const rootRef = useRef<HTMLDivElement>(null);
  const layerRefs = useRef<(HTMLDivElement | null)[]>([]);
  const captionRefs = useRef<(HTMLDivElement | null)[]>([]);
  const returnLayerRef = useRef<HTMLDivElement>(null);
  const returnCaptionRef = useRef<HTMLDivElement>(null);
  const valueRef = useRef<HTMLSpanElement>(null);
  const tempRef = useRef<HTMLSpanElement>(null);
  const markerRef = useRef<SVGGElement>(null);
  const restRef = useRef<SVGRectElement>(null);
  const helmetRef = useRef<SVGGElement>(null);
  const streaksRef = useRef<SVGGElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const backRef = useRef<HTMLButtonElement>(null);
  const clockRef = useRef({ t0: -1, skip: false });
  const stageRef = useRef(0);
  // Últim valor escrit de cada propietat: si no canvia, no es toca el DOM.
  const written = useRef(new Map<string, string>());

  const write = (el: HTMLElement | SVGElement | null, key: string, prop: 'opacity' | 'transform' | 'visibility', value: string) => {
    if (!el || written.current.get(key + prop) === value) return;
    written.current.set(key + prop, value);
    el.style[prop] = value;
  };
  const writeAttr = (el: Element | null, key: string, attr: string, value: string) => {
    if (!el || written.current.get(key + attr) === value) return;
    written.current.set(key + attr, value);
    el.setAttribute(attr, value);
  };
  const writeText = (el: HTMLElement | null, text: string) => {
    if (el && el.textContent !== text) el.textContent = text;
  };
  const setLayer = (el: HTMLElement | null, key: string, weight: number, offset: number) => {
    write(el, key, 'visibility', weight > 0.001 ? 'visible' : 'hidden');
    write(el, key, 'opacity', weight.toFixed(3));
    write(el, key, 'transform', `translate3d(0, ${offset.toFixed(1)}px, 0)`);
  };
  /** Les lectures de dalt i la regla: `depth` és la distància des d'on ets (a la tornada, la que falta). */
  const setDepth = (depth: number, value: string) => {
    writeText(valueRef.current, value);
    writeText(tempRef.current, temp(earthTemperature(depth), depth));
    const y = rulerY(depth);
    writeAttr(markerRef.current, 'marker', 'transform', `translate(0 ${y.toFixed(1)})`);
    writeAttr(restRef.current, 'rest', 'y', y.toFixed(1));
    writeAttr(restRef.current, 'rest', 'height', Math.max(0, 510 - y).toFixed(1));
  };
  /** Progrés (0–1) del temps en què es veu una parada. */
  const spanProgress = (stop: number, t: number) => {
    const { start, end } = descentStopSpan(stop);
    return clamp01((t - start) / (end - start));
  };

  const applyDescent = (t: number) => {
    const f = descentFrame(t);
    const slide = reduced ? 0 : (rootRef.current?.clientHeight ?? 800) * SLIDE;
    for (let i = 0; i < STOPS; i++) {
      let weight = 0, offset = 0, caption = 0;
      if (i === f.stop) {
        weight = f.leg;
        offset = (1 - f.leg) * slide;
        caption = clamp01((f.leg - 0.5) * 2);
      } else if (i === f.stop - 1 && f.leg < 1) {
        // La que se'n va queda opaca a sota mentre la nova (a sobre, amb fons propi) apareix.
        weight = 1;
        offset = -f.leg * slide;
        caption = clamp01((0.5 - f.leg) * 2);
      }
      setLayer(layerRefs.current[i], `l${i}`, weight, offset);
      if (i < ARRIVAL) {
        write(captionRefs.current[i], `c${i}`, 'opacity', caption.toFixed(3));
        write(captionRefs.current[i], `c${i}`, 'visibility', caption > 0.001 ? 'visible' : 'hidden');
      }
    }
    // De la benvinguda al pou: el fons de l'ascensor apareix mentre la càmera s'enfonsa.
    write(backdropRef.current, 'backdrop', 'opacity', (reduced ? 1 : Math.min(1, t / 450)).toFixed(3));
    setDepth(f.depth, formatAltitude(f.depth, unit, locale));
    if (!reduced) {
      // Al centre, el casc sura sense pes.
      const c = spanProgress(3, t);
      writeAttr(helmetRef.current, 'helmet', 'transform', `translate(${(Math.sin(c * 5) * 6).toFixed(1)} ${(-14 * c).toFixed(1)}) rotate(${(40 * c).toFixed(1)} 262 318)`);
    }
    const visible = f.leg >= 0.5 ? f.stop : Math.max(0, f.stop - 1);
    if (visible !== stageRef.current) {
      stageRef.current = visible;
      setStage(visible);
    }
    if (f.arrived) setPhase('arrived');
  };

  // Baixada.
  useEffect(() => {
    if (phase !== 'descent') return;
    let raf = 0;
    const step = (ts: number) => {
      const c = clockRef.current;
      if (c.t0 < 0) c.t0 = ts;
      if (c.skip) {
        c.skip = false;
        c.t0 = ts - descentSkip(ts - c.t0);
      }
      const t = ts - c.t0;
      applyDescent(t);
      if (t < DESCENT_MS) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
    // applyDescent llegeix refs i valors estables durant el viatge; el bucle només depèn de la fase.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  // Tornada per dins.
  useEffect(() => {
    if (phase !== 'return') return;
    let raf = 0;
    let t0 = -1;
    const step = (ts: number) => {
      if (t0 < 0) t0 = ts;
      const t = ts - t0;
      const p = Math.min(1, t / 300);
      setLayer(layerRefs.current[ARRIVAL], `l${ARRIVAL}`, 1 - p, 0);
      setLayer(returnLayerRef.current, 'return', p, 0);
      write(returnCaptionRef.current, 'rc', 'opacity', p.toFixed(3));
      write(returnCaptionRef.current, 'rc', 'visibility', 'visible');
      const remaining = returnRemaining(t);
      setDepth(remaining, formatAltitude(remaining, unit, locale));
      if (!reduced) writeAttr(streaksRef.current, 'streaks', 'transform', `translate(0 ${(-((t * 1.1) % 844)).toFixed(1)})`);
      if (t < RETURN_MS) raf = requestAnimationFrame(step);
      else setPhase('landing');
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  // Aterratge: el fons es fon i el casc surt per la benvinguda; després, a terra.
  const [helmetUp, setHelmetUp] = useState(false);
  useEffect(() => {
    if (phase !== 'landing') return;
    const raf = requestAnimationFrame(() => setHelmetUp(true));
    const message = fill(labels.landed, { km: km(EARTH_DIAMETER_M / 1000), n: String(markSecretFound('earth')) });
    const timer = window.setTimeout(() => onLand(message), reduced ? 400 : LANDING_MS);
    return () => { cancelAnimationFrame(raf); window.clearTimeout(timer); };
  }, [phase, reduced, onLand, labels, km]);

  // Abans del primer pintat, el fons transparent: apareix des de la benvinguda amb el primer tram.
  useLayoutEffect(() => {
    if (!reduced && backdropRef.current) backdropRef.current.style.opacity = '0';
  }, [reduced]);

  // Focus: al botó de sortir en obrir-se; a "Torna per dins" en arribar.
  useEffect(() => { closeRef.current?.focus({ preventScroll: true }); }, []);
  useEffect(() => { if (phase === 'arrived') backRef.current?.focus({ preventScroll: true }); }, [phase]);

  // La pàgina de sota no es desplaça mentre dura el viatge.
  useEffect(() => {
    const html = document.documentElement;
    const previous = html.style.overflow;
    html.style.overflow = 'hidden';
    return () => { html.style.overflow = previous; };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const skip = () => { if (phase === 'descent') clockRef.current.skip = true; };
  const handleKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Tab') {
      // El focus no surt de l'ascensor.
      const items = Array.from(rootRef.current?.querySelectorAll<HTMLElement>('button:not([disabled])') ?? []);
      if (items.length === 0) return;
      const i = items.indexOf(document.activeElement as HTMLElement);
      const next = e.shiftKey ? (i <= 0 ? items.length - 1 : i - 1) : (i === items.length - 1 ? 0 : i + 1);
      e.preventDefault();
      items[next].focus();
    } else if ((e.key === ' ' || e.key === 'ArrowRight') && phase === 'descent' && (e.target as HTMLElement).tagName !== 'BUTTON') {
      e.preventDefault();
      skip();
    }
  };

  const share = async () => {
    const url = `${window.location.origin}${window.location.pathname}`;
    const text = fill(labels.shareText, { km: km(EARTH_DIAMETER_M / 1000) });
    const result = await shareLink({ title: 'MeteoToni AI', text, url, clipboardText: `${text} ${url}` });
    if (result === 'copied') {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
    }
  };

  const landing = phase === 'landing';
  const arrived = phase === 'arrived';
  const returning = phase === 'return' || landing;
  const fadeOut = { opacity: landing ? 0 : 1, transition: 'opacity 700ms ease-out' };
  const hiddenLayer = { visibility: 'hidden' as const, opacity: 0 };
  const accent = '#fdba74';
  const readoutLabel = returning ? labels.remaining : arrived ? labels.crossed : labels.depth;
  const live = returning ? returnCaption : stage < ARRIVAL ? captions[stage] : { title: arrivalTitle, body: placeLine };

  return (
    <div
      ref={rootRef}
      role="dialog"
      aria-modal="true"
      aria-label={labels.dialog}
      onKeyDown={handleKeyDown}
      className="fixed inset-0 z-[1000] overflow-hidden text-slate-100 antialiased select-none"
    >
      {/* Les parades, una damunt de l'altra; un toc a qualsevol lloc avança. */}
      <div ref={backdropRef} className="absolute inset-0 bg-[#120d0a]" style={landing ? fadeOut : undefined} onClick={skip}>
        <div ref={el => { layerRefs.current[0] = el; }} className="absolute inset-0" style={hiddenLayer}>
          <KolaScene
            vb={vb}
            bottomTag={labels.kolaTag}
            fact={fill(labels.kolaFact, { depth: formatAltitude(DESCENT_STOPS[0].depth, unit, locale), temp: temp(180, 0) })}
            share={labels.kolaShare}
          />
        </div>
        <div ref={el => { layerRefs.current[1] = el; }} className="absolute inset-0" style={hiddenLayer}>
          <MantleScene vb={vb} plates={fill(labels.plates, { range: formatCmRange(2, 5, unit, locale) })} karman={fill(labels.mantleKarman, { km: km(100) })} plume={labels.plume} />
        </div>
        <div ref={el => { layerRefs.current[2] = el; }} className="absolute inset-0" style={hiddenLayer}>
          <CoreScene vb={vb} edge={labels.coreEdge} field={labels.field} iron={labels.iron} />
        </div>
        <div ref={el => { layerRefs.current[3] = el; }} className="absolute inset-0" style={hiddenLayer}>
          <CentreScene vb={vb} solid={labels.solid} weightless={labels.weightless} halfway={labels.halfway} helmetRef={helmetRef} />
        </div>
        <div ref={el => { layerRefs.current[ARRIVAL] = el; }} className="absolute inset-0" style={hiddenLayer}>
          <AntipodesPhotoView
            photo={photo}
            share={PHOTO_SHARE}
            frame={frame}
            alt={labels.photoAlt}
            hereLabel={labels.hereTag}
            coords={formatCoords(there.lat, there.lon, locale, cardinals)}
            labels={photoLabelsList}
            scale={bar ? { px: bar.px, label: `${new Intl.NumberFormat(locale).format(bar.value)}${NBSP}${unit === 'F' ? 'mi' : 'km'}` } : null}
            credit={credit}
            failedText={labels.photoFailed}
          />
        </div>
        <div ref={returnLayerRef} className="absolute inset-0" style={hiddenLayer}>
          <ReturnScene vb={vb} streaksRef={streaksRef} />
        </div>
      </div>

      {landing && !reduced && (
        <svg
          aria-hidden="true"
          viewBox="-40 -30 80 60"
          className="absolute left-1/2 bottom-0 w-24 -ml-12 pointer-events-none"
          style={{
            transform: `translateY(${helmetUp ? '-58vh' : '20vh'})`,
            opacity: helmetUp ? 1 : 0.6,
            transition: 'transform 1500ms cubic-bezier(.2,.7,.3,1), opacity 400ms ease-out',
          }}
        >
          <Helmet />
        </svg>
      )}

      {/* Lectures, sortir i regla. */}
      <div className="absolute inset-0 pointer-events-none" style={fadeOut}>
        <div className="absolute inset-x-0 top-0 flex items-start justify-between px-5 pt-[max(18px,env(safe-area-inset-top))]">
          <div className="flex flex-col gap-0.5">
            <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-stone-200">{readoutLabel}</span>
            <span className="flex items-center gap-1.5 font-mono text-[30px] font-semibold leading-tight tracking-[-0.02em]" style={{ color: arrived || returning ? accent : undefined }}>
              <span ref={valueRef}>{formatAltitude(0, unit, locale)}</span>
              {returning && (
                <svg aria-hidden="true" viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 19V5M5 12l7-7 7 7" />
                </svg>
              )}
            </span>
            <span className="mt-1 flex items-center gap-1 font-mono text-[13px] font-medium text-orange-300 transition-opacity duration-500 motion-reduce:transition-none" style={{ opacity: arrived ? 0 : 1 }}>
              <svg aria-hidden="true" viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a4.5 4.5 0 1 0 5 0z" />
              </svg>
              <span ref={tempRef}>{temp(15, 0)}</span>
            </span>
            {phase === 'descent' && stage === 0 && <span className="mt-1 text-[12px] text-stone-200/80">{labels.skipHint}</span>}
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label={labels.close}
            className="pointer-events-auto w-11 h-11 rounded-xl border border-stone-200/30 bg-[rgba(18,13,10,0.5)] flex items-center justify-center text-stone-200 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-orange-300"
          >
            <svg aria-hidden="true" viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* La regla: un testimoni de sondeig de la Terra a escala real. A l'arribada s'aparta per a la foto. */}
        <svg
          aria-hidden="true"
          viewBox="0 0 70 520"
          className="absolute left-2.5 top-[132px] transition-opacity duration-500 motion-reduce:transition-none"
          style={{ height: 'max(140px, min(520px, calc(100% - 360px)))', width: 'auto', opacity: arrived ? 0 : 1 }}
        >
          <defs>
            <linearGradient id="ee-mantle" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#7c2d12" />
              <stop offset="1" stopColor="#c2410c" />
            </linearGradient>
          </defs>
          <rect width={70} height={520} rx={12} fill="rgba(10,6,4,0.5)" />
          {RULER_LAYERS.map((l, i) => (
            <rect key={i} x={6} y={rulerY(l.from)} width={8} height={Math.max(2, rulerY(l.to) - rulerY(l.from))} fill={LAYER_FILL[l.id]} />
          ))}
          <rect ref={restRef} x={6} y={10} width={8} height={500} fill="#000" opacity={0.58} />
          <path d={ticks.map(t => `M16 ${rulerY(t.depth).toFixed(1)}H22`).join('')} stroke="#a8a29e" />
          <g ref={markerRef} transform="translate(0 10)">
            <circle cx={10} r={9} fill={accent} opacity={0.3} />
            <circle cx={10} r={4.5} fill={accent} />
          </g>
          <g fontFamily="ui-monospace, SFMono-Regular, Menlo, Consolas, monospace" fontSize={9} fill="#e7e5e4">
            {ticks.map(t => <text key={t.depth} x={25} y={rulerY(t.depth) + 3}>{t.label}</text>)}
          </g>
        </svg>
      </div>

      {/* El text de cada parada, al peu; les parades es fonen l'una en l'altra. */}
      <div className="absolute inset-x-0 bottom-0 px-6 pb-[max(36px,env(safe-area-inset-bottom))] pointer-events-none" style={fadeOut}>
        <div className="mx-auto grid max-w-[34rem] lg:mx-16 lg:max-w-[36rem]">
          {captions.map((c, i) => (
            <div key={i} ref={el => { captionRefs.current[i] = el; }} aria-hidden="true" className="col-start-1 row-start-1 self-end flex flex-col gap-2" style={hiddenLayer}>
              <CaptionText caption={c} />
            </div>
          ))}
          <div ref={returnCaptionRef} aria-hidden="true" className="col-start-1 row-start-1 self-end flex flex-col gap-2" style={hiddenLayer}>
            <CaptionText caption={returnCaption} />
          </div>
        </div>
      </div>

      {/* L'arribada: la targeta del temps d'allà i d'aquí, a sota de la foto. */}
      {(arrived || phase === 'return') && (
        <div
          className="absolute inset-x-0 bottom-0 overflow-y-auto rounded-t-[28px] border-t border-slate-200/10 bg-[#0b1220] transition-opacity duration-300"
          style={{ maxHeight: `calc(${((1 - PHOTO_SHARE) * 100).toFixed(0)}% + 28px)`, opacity: arrived ? 1 : 0 }}
        >
          <div className="mx-auto flex max-w-[34rem] flex-col gap-1.5 px-[22px] pt-5 pb-[max(20px,env(safe-area-inset-bottom))]">
            <span className="font-mono text-[11px] uppercase tracking-[0.14em]" style={{ color: accent }}>{fill(labels.arrivalEyebrow, { km: km(EARTH_DIAMETER_M / 1000) })}</span>
            <h2 className="m-0 text-[28px] leading-[1.1] font-semibold tracking-[-0.02em] text-balance">{arrivalTitle}</h2>
            {placeLine && <p className="m-0 text-[14px] leading-snug text-slate-200/90 text-pretty">{placeLine}</p>}
            {home.source !== 'gps' && <p className="m-0 text-[12px] leading-snug text-slate-400">{labels.approx}</p>}

            {rows.length > 0 ? (
              <div className="mt-2 grid grid-cols-3 text-[14px]">
                <span />
                <span className="pb-1.5 font-mono text-[10px] uppercase tracking-[0.12em]" style={{ color: accent }}>{labels.there}</span>
                <span className="pb-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-slate-400">{labels.here}</span>
                {rows.map(([label, a, b]) => (
                  <div key={label} className="contents">
                    <span className="border-t border-slate-200/10 py-1.5 text-slate-400">{label}</span>
                    <span className="border-t border-slate-200/10 py-1.5 font-semibold">{a}</span>
                    <span className="border-t border-slate-200/10 py-1.5 text-slate-300">{b}</span>
                  </div>
                ))}
              </div>
            ) : weather.status === 'failed' ? (
              <p className="m-0 mt-2 text-[14px] text-slate-300">{labels.noWeather}</p>
            ) : null}

            {chips.length > 0 && (
              <div className="mt-1.5 flex flex-wrap gap-2">
                {chips.map(c => (
                  <span key={c} className="flex h-[30px] items-center rounded-full border border-sky-300/30 bg-sky-400/10 px-2.5 text-[13px] text-sky-50">{c}</span>
                ))}
              </div>
            )}

            <div className="mt-3 flex flex-col gap-2">
              <button
                ref={backRef}
                type="button"
                onClick={() => setPhase('return')}
                className="h-[52px] w-full rounded-2xl bg-slate-100 text-slate-900 font-semibold text-base flex items-center justify-center gap-2.5 hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-300"
              >
                <svg aria-hidden="true" viewBox="0 0 24 24" className="w-[18px] h-[18px]" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 19V5M5 12l7-7 7 7" />
                </svg>
                {labels.back}
              </button>
              <button
                type="button"
                onClick={share}
                className="h-11 w-full rounded-[14px] border border-slate-200/30 text-slate-200 text-[15px] font-medium flex items-center justify-center gap-2 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-300"
              >
                <svg aria-hidden="true" viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8M16 6l-4-4-4 4M12 2v13" />
                </svg>
                {copied ? labels.shareCopied : labels.share}
              </button>
            </div>
          </div>
        </div>
      )}

      <p className="sr-only" aria-live="polite">{`${live.title} ${live.body}`}</p>
    </div>
  );
}

function CaptionText({ caption }: { caption: Caption }) {
  return (
    <>
      <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-orange-300">{caption.eyebrow}</span>
      <h2 className="m-0 text-[28px] leading-[1.1] font-semibold tracking-[-0.02em] text-balance">{caption.title}</h2>
      <p className="m-0 text-[15px] leading-normal text-orange-50/90 text-pretty">{caption.body}</p>
    </>
  );
}
