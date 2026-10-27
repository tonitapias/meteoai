// src/components/welcome/SkyElevator.tsx
// L'ascensor de la Columna del cel: el secret de la benvinguda. S'obre estirant la columna cap amunt tres cops
// (hooks/welcome/useColumnStretch) i es carrega a part, només llavors. La càmera puja per cinc parades (els teus
// núvols, el sostre del temps, la línia de Kármán, l'Estació Espacial i el Meteosat, amb la foto real de la Terra i
// una agulla on ets), i "Torna a terra" en baixa amb una reentrada i un paracaigudes.
// Pensat per a mòbils modestos: un sol rellotge (requestAnimationFrame) mou les capes amb opacitat i transformacions
// escrites directament (React només repinta quan canvia la parada), res de filtres ni desenfocaments, i amb "reduir
// el moviment" les parades es fonen sense desplaçar-se.
import { KeyboardEvent as ReactKeyboardEvent, ReactNode, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { Language } from '../../translations';
import { getSafeLocale, type WeatherUnit } from '../../utils/formatters';
import { useElevatorClouds } from '../../hooks/welcome/useElevatorClouds';
import { shareLink } from '../../utils/shareLink';
import {
  ASCENT_MS, ELEVATOR_STOPS, elevatorFrame, elevatorSkip, formatAltitude, formatDistance, formatSpeed, GEO_ALTITUDE_M,
  meteosatDiscPoint, NBSP, reentryAltitude, REENTRY_MS, rulerFraction, rulerTicks, stopSpan, viewBoxFor, viewingSatellite,
  type GeoSatellite,
} from '../../utils/welcome/skyElevator';
import type { WelcomeSky } from '../../utils/welcome/welcomeSky';
import {
  ArrivalBackdrop, CloudsScene, MeteosatSatellite, Parachute, ReentryScene, SpaceScene, StationScene, TropopauseScene,
} from './ElevatorScenes';
import { ELEVATOR_TEXT } from './elevatorI18n';
import { MeteosatDisc } from './MeteosatDisc';
import { useMeteosatImage } from '../../hooks/welcome/useMeteosatImage';

export interface SkyElevatorProps {
  sky: WelcomeSky;
  lang: Language;
  unit: WeatherUnit;
  /** Noms de les tres capes de núvols (els de la columna). */
  cloudNames: { high: string; mid: string; low: string };
  /** En tornar, l'app obrirà la previsió d'on és l'usuari (permís d'ubicació ja donat): ho diu la reentrada. */
  landsOnForecast: boolean;
  onClose: () => void;
  /** El paracaigudes ha tocat terra: el missatge de l'avís final, ja traduït. */
  onLand: (message: string) => void;
}

type Phase = 'ascent' | 'arrived' | 'reentry' | 'landing';

const STOPS = ELEVATOR_STOPS.length;
const ARRIVAL = STOPS - 1;
/** Quant es desplaça una parada (en fracció de la pantalla) quan entra per dalt o surt per baix. */
const SLIDE = 0.38;
const LANDING_MS = 1700;
const SATELLITE_NAMES: Readonly<Record<GeoSatellite, string>> = {
  meteosat: 'Meteosat-12', goesEast: 'GOES-19', goesWest: 'GOES-18', himawari: 'Himawari-9',
};
const prefersReducedMotion = () =>
  typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const fill = (template: string, values: Record<string, string>) =>
  template.replace(/\{(\w+)\}/g, (match, key: string) => values[key] ?? match);

/** Regla de l'esquerra: viewBox 70 × 520, de y = 510 (terra) a y = 10 (Meteosat). */
const rulerY = (altitude: number) => 510 - rulerFraction(altitude) * 500;

interface Caption { eyebrow: string; title: string; body: string }

export default function SkyElevator({ sky, lang, unit, cloudNames, landsOnForecast, onClose, onLand }: SkyElevatorProps) {
  const labels = ELEVATOR_TEXT[lang];
  const locale = getSafeLocale(lang);
  const [reduced] = useState(prefersReducedMotion);
  const night = sky.phase === 'nit';
  const { lat, lon } = sky.place;

  const [vb, setVb] = useState(() => viewBoxFor(window.innerWidth, window.innerHeight));
  useEffect(() => {
    const onResize = () => setVb(viewBoxFor(window.innerWidth, window.innerHeight));
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const clouds = useElevatorClouds(sky.place);
  const image = useMeteosatImage();
  const view = useMemo(() => viewingSatellite(lat, lon), [lat, lon]);
  const pin = useMemo(() => meteosatDiscPoint(lat, lon), [lat, lon]);

  const [phase, setPhase] = useState<Phase>('ascent');
  const [stage, setStage] = useState(0);
  const [copied, setCopied] = useState(false);

  // --- Textos ---
  const km = useCallback((v: number) => formatDistance(v, unit, locale), [unit, locale]);
  const range = useCallback((from: number, to: number) => {
    const a = km(from);
    return `${a.slice(0, a.lastIndexOf(NBSP))}–${km(to)}`;
  }, [km]);
  const pct = useMemo(() => new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 0 }), [locale]);

  const cloudTag = (name: string, cover: number | undefined, band: string): ReactNode => (
    <>
      {cover === undefined ? name : `${name} · ${pct.format(cover / 100)}`}
      <span className="font-mono text-[11px] font-medium text-slate-300">{band}</span>
    </>
  );
  const cloudTags = {
    high: cloudTag(cloudNames.high, clouds?.high, fill(labels.bandHigh, { km: km(8) })),
    mid: cloudTag(cloudNames.mid, clouds?.mid, fill(labels.bandMid, { range: range(3, 8) })),
    low: cloudTag(cloudNames.low, clouds?.low, fill(labels.bandLow, { km: km(3) })),
  };
  const snow = clouds?.snowLevel != null
    ? { line: labels.snowLine, level: fill(labels.snowLevel, { alt: formatAltitude(clouds.snowLevel, unit, locale) }) }
    : null;

  let arrivalBody = labels.arrivalBodyNoAge;
  if (!pin) arrivalBody = view.visible ? fill(labels.otherBody, { satellite: SATELLITE_NAMES[view.satellite] }) : labels.polarBody;
  else if (image.status === 'failed') arrivalBody = labels.arrivalBodyOffline;
  else if (image.status === 'ready' && image.ageMinutes !== null && image.ageMinutes >= 1 && image.ageMinutes <= 180) {
    arrivalBody = fill(labels.arrivalBody, { min: String(image.ageMinutes) });
  }

  const captions: Caption[] = [
    { eyebrow: clouds ? labels.cloudsEyebrow : labels.cloudsEyebrowNoData, title: labels.cloudsTitle, body: clouds ? labels.cloudsBody : labels.cloudsBodyNoData },
    { eyebrow: fill(labels.tropoEyebrow, { km: km(12) }), title: labels.tropoTitle, body: labels.tropoBody },
    { eyebrow: fill(labels.spaceEyebrow, { km: km(100) }), title: labels.spaceTitle, body: labels.spaceBody },
    { eyebrow: fill(labels.stationEyebrow, { km: km(400) }), title: labels.stationTitle, body: fill(labels.stationBody, { speed: formatSpeed(27_600, unit, locale) }) },
    {
      eyebrow: fill(labels.arrivalEyebrow, { km: km(GEO_ALTITUDE_M / 1000) }),
      title: pin ? labels.arrivalTitle : view.visible ? labels.otherTitle : labels.polarTitle,
      body: arrivalBody,
    },
  ];
  const reentryCaption: Caption = { eyebrow: labels.reentryEyebrow, title: labels.reentryTitle, body: landsOnForecast ? labels.reentryBody : labels.reentryBodyHome };
  const live = phase === 'reentry' || phase === 'landing' ? reentryCaption : captions[stage];

  const ticks = useMemo(() => rulerTicks(unit, locale), [unit, locale]);

  // --- Escriptura directa a cada fotograma ---
  const rootRef = useRef<HTMLDivElement>(null);
  const layerRefs = useRef<(HTMLDivElement | null)[]>([]);
  const captionRefs = useRef<(HTMLDivElement | null)[]>([]);
  const reentryLayerRef = useRef<HTMLDivElement>(null);
  const reentryCaptionRef = useRef<HTMLDivElement>(null);
  const altRef = useRef<HTMLSpanElement>(null);
  const markerRef = useRef<SVGGElement>(null);
  const trackRef = useRef<SVGPathElement>(null);
  const planeRef = useRef<SVGGElement>(null);
  const meteorsRef = useRef<SVGGElement>(null);
  const issRef = useRef<SVGGElement>(null);
  const speedRef = useRef<SVGGElement>(null);
  const reentryArtRef = useRef<SVGGElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const backRef = useRef<HTMLButtonElement>(null);
  const clock = useRef({ t0: -1, skip: false });
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
  const setLayer = (el: HTMLElement | null, key: string, weight: number, offset: number) => {
    write(el, key, 'visibility', weight > 0.001 ? 'visible' : 'hidden');
    write(el, key, 'opacity', weight.toFixed(3));
    write(el, key, 'transform', `translate3d(0, ${offset.toFixed(1)}px, 0)`);
  };
  const setAltitude = (altitude: number) => {
    const text = formatAltitude(altitude, unit, locale);
    if (altRef.current && altRef.current.textContent !== text) altRef.current.textContent = text;
    const y = rulerY(altitude).toFixed(1);
    writeAttr(markerRef.current, 'marker', 'transform', `translate(0 ${y})`);
    writeAttr(trackRef.current, 'track', 'd', `M10 510V${y}`);
  };
  /** Progrés (0–1) del temps en què es veu una parada. */
  const spanProgress = (stop: number, t: number) => {
    const { start, end } = stopSpan(stop);
    return clamp01((t - start) / (end - start));
  };

  const applyAscent = (t: number) => {
    const f = elevatorFrame(t);
    const slide = reduced ? 0 : (rootRef.current?.clientHeight ?? 800) * SLIDE;
    for (let i = 0; i < STOPS; i++) {
      let weight = 0, offset = 0, caption = 0;
      if (i === f.stop) {
        weight = f.leg;
        offset = -(1 - f.leg) * slide;
        caption = clamp01((f.leg - 0.5) * 2);
      } else if (i === f.stop - 1 && f.leg < 1) {
        // La que se'n va queda opaca a sota mentre la nova (a sobre, amb fons propi) apareix: fondre-les totes dues
        // deixaria veure la benvinguda a mig camí.
        weight = 1;
        offset = f.leg * slide;
        caption = clamp01((0.5 - f.leg) * 2);
      }
      setLayer(layerRefs.current[i], `l${i}`, weight, offset);
      write(captionRefs.current[i], `c${i}`, 'opacity', caption.toFixed(3));
      write(captionRefs.current[i], `c${i}`, 'visibility', caption > 0.001 ? 'visible' : 'hidden');
    }
    // De la benvinguda als núvols: el fons de l'ascensor apareix mentre la càmera surt de terra.
    write(backdropRef.current, 'backdrop', 'opacity', (reduced ? 1 : Math.min(1, t / 450)).toFixed(3));
    setAltitude(f.altitude);
    if (!reduced) {
      writeAttr(planeRef.current, 'plane', 'transform', `translate(${(150 - 320 * spanProgress(1, t)).toFixed(1)} 0)`);
      const m = spanProgress(2, t);
      writeAttr(meteorsRef.current, 'meteors', 'transform', `translate(${(-80 * m).toFixed(1)} ${(56 * m).toFixed(1)})`);
      const s = spanProgress(3, t);
      writeAttr(issRef.current, 'iss', 'transform', `translate(${(-50 + 100 * s).toFixed(1)} ${(-8 * s).toFixed(1)})`);
      // Cap al Meteosat l'altímetre corre: línies de velocitat que passen avall.
      const rush = f.stop === ARRIVAL && f.leg < 1 ? f.leg : 0;
      writeAttr(speedRef.current, 'speed', 'opacity', Math.sin(Math.PI * rush).toFixed(3));
      writeAttr(speedRef.current, 'speed', 'transform', `translate(0 ${(rush * 520).toFixed(1)})`);
    }
    const visible = f.leg >= 0.5 ? f.stop : Math.max(0, f.stop - 1);
    if (visible !== stageRef.current) {
      stageRef.current = visible;
      setStage(visible);
    }
    if (f.arrived) setPhase('arrived');
  };

  // Pujada.
  useEffect(() => {
    if (phase !== 'ascent') return;
    let raf = 0;
    const step = (now: number) => {
      const c = clock.current;
      if (c.t0 < 0) c.t0 = now;
      if (c.skip) {
        c.skip = false;
        c.t0 = now - elevatorSkip(now - c.t0);
      }
      const t = now - c.t0;
      applyAscent(t);
      if (t < ASCENT_MS) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
    // applyAscent llegeix refs i valors estables durant el viatge; el bucle només depèn de la fase.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  // Reentrada.
  useEffect(() => {
    if (phase !== 'reentry') return;
    let raf = 0;
    let t0 = -1;
    const step = (now: number) => {
      if (t0 < 0) t0 = now;
      const t = now - t0;
      const p = Math.min(1, t / 300);
      setLayer(layerRefs.current[ARRIVAL], `l${ARRIVAL}`, 1 - p, 0);
      write(captionRefs.current[ARRIVAL], `c${ARRIVAL}`, 'opacity', (1 - p).toFixed(3));
      setLayer(reentryLayerRef.current, 'reentry', p, 0);
      write(reentryCaptionRef.current, 'rc', 'opacity', p.toFixed(3));
      write(reentryCaptionRef.current, 'rc', 'visibility', 'visible');
      setAltitude(reentryAltitude(t));
      if (!reduced) {
        const shake = Math.min(1, t / 600);
        writeAttr(reentryArtRef.current, 'shake', 'transform', `translate(${(Math.sin(t * 0.09) * 1.8 * shake).toFixed(2)} ${(Math.cos(t * 0.13) * 1.8 * shake).toFixed(2)})`);
      }
      if (t < REENTRY_MS) raf = requestAnimationFrame(step);
      else setPhase('landing');
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  // Aterratge: el fons es fon i el paracaigudes baixa sobre la benvinguda; després, a terra.
  const [chuteDown, setChuteDown] = useState(false);
  useEffect(() => {
    if (phase !== 'landing') return;
    const raf = requestAnimationFrame(() => setChuteDown(true));
    const message = fill(labels.landed, { km: km(GEO_ALTITUDE_M / 1000) });
    const timer = window.setTimeout(() => onLand(message), reduced ? 400 : LANDING_MS);
    return () => { cancelAnimationFrame(raf); window.clearTimeout(timer); };
  }, [phase, reduced, onLand, labels, km]);

  // Abans del primer pintat, el fons transparent: apareix des de la benvinguda amb el primer tram.
  useLayoutEffect(() => {
    if (!reduced && backdropRef.current) backdropRef.current.style.opacity = '0';
  }, [reduced]);

  // Focus: al botó de sortir en obrir-se; a "Torna a terra" en arribar.
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

  const skip = () => { if (phase === 'ascent') clock.current.skip = true; };
  const handleKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Tab') {
      // El focus no surt de l'ascensor.
      const items = Array.from(rootRef.current?.querySelectorAll<HTMLElement>('button:not([disabled])') ?? []);
      if (items.length === 0) return;
      const i = items.indexOf(document.activeElement as HTMLElement);
      const next = e.shiftKey ? (i <= 0 ? items.length - 1 : i - 1) : (i === items.length - 1 ? 0 : i + 1);
      e.preventDefault();
      items[next].focus();
    } else if ((e.key === ' ' || e.key === 'ArrowRight') && phase === 'ascent' && (e.target as HTMLElement).tagName !== 'BUTTON') {
      e.preventDefault();
      skip();
    }
  };

  const share = async () => {
    const url = `${window.location.origin}${window.location.pathname}`;
    const text = fill(labels.shareText, { km: km(GEO_ALTITUDE_M / 1000) });
    const result = await shareLink({ title: 'MeteoToni AI', text, url, clipboardText: `${text} ${url}` });
    if (result === 'copied') {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
    }
  };

  const landing = phase === 'landing';
  const reentry = phase === 'reentry' || landing;
  const fadeOut = { opacity: landing ? 0 : 1, transition: 'opacity 700ms ease-out' };
  const hiddenLayer = { visibility: 'hidden' as const, opacity: 0 };
  const accent = reentry ? '#fdba74' : '#fde68a';

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
      <div ref={backdropRef} className="absolute inset-0 bg-[#05070f]" style={landing ? fadeOut : undefined} onClick={skip}>
        <div ref={el => { layerRefs.current[0] = el; }} className="absolute inset-0" style={hiddenLayer}>
          <CloudsScene vb={vb} phase={sky.phase} sky={sky.colors} clouds={clouds} tags={cloudTags} snow={snow} />
        </div>
        <div ref={el => { layerRefs.current[1] = el; }} className="absolute inset-0" style={hiddenLayer}>
          <TropopauseScene vb={vb} night={night} tropoTag={fill(labels.tropoTag, { km: km(12) })} planeTag={fill(labels.plane, { km: km(11) })} planeRef={planeRef} />
        </div>
        <div ref={el => { layerRefs.current[2] = el; }} className="absolute inset-0" style={hiddenLayer}>
          <SpaceScene vb={vb} night={night} karmanTag={fill(labels.karmanTag, { km: km(100) })} meteorsTag={fill(labels.meteorsTag, { range: range(80, 100) })} meteorsRef={meteorsRef} />
        </div>
        <div ref={el => { layerRefs.current[3] = el; }} className="absolute inset-0" style={hiddenLayer}>
          <StationScene
            vb={vb}
            night={night}
            issTag={fill(labels.stationTag, { km: km(400) })}
            next={[fill(labels.nextGps, { km: km(20_200) }), fill(labels.nextMeteosat, { km: km(GEO_ALTITUDE_M / 1000) })]}
            issRef={issRef}
            speedRef={speedRef}
          />
        </div>
        <div ref={el => { layerRefs.current[ARRIVAL] = el; }} className="absolute inset-0" style={hiddenLayer}>
          <ArrivalBackdrop vb={vb} />
          <div className="absolute left-1/2 top-[44%] -translate-x-1/2 -translate-y-1/2" style={{ width: 'min(74vw, 40vh, 440px)', height: 'min(74vw, 40vh, 440px)' }}>
            <MeteosatSatellite className="absolute -right-[4%] -top-[27%] w-[40%]" />
            <MeteosatDisc image={image} pin={pin} hereLabel={labels.hereTag} />
            <p className="absolute inset-x-0 -bottom-7 text-center text-[11px] text-slate-400">{labels.photoCredit}</p>
          </div>
        </div>
        <div ref={reentryLayerRef} className="absolute inset-0" style={hiddenLayer}>
          <ReentryScene vb={vb} artRef={reentryArtRef} />
        </div>
      </div>

      {landing && !reduced && (
        <Parachute
          className="absolute left-1/2 top-0 w-20 -ml-10 pointer-events-none"
          style={{
            transform: `translateY(${chuteDown ? '32vh' : '-20vh'})`,
            opacity: chuteDown ? 1 : 0.6,
            transition: 'transform 1500ms cubic-bezier(.2,.7,.3,1), opacity 400ms ease-out',
          }}
        />
      )}

      {/* Altímetre, sortir i regla. */}
      <div className="absolute inset-0 pointer-events-none" style={fadeOut}>
        <div className="absolute inset-x-0 top-0 flex items-start justify-between px-5 pt-[max(18px,env(safe-area-inset-top))]">
          <div className="flex flex-col gap-0.5">
            <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-slate-300">{labels.altitude}</span>
            <span className="flex items-center gap-1.5 font-mono text-[30px] font-semibold leading-tight tracking-[-0.02em]" style={{ color: reentry ? accent : phase === 'arrived' ? accent : undefined }}>
              <span ref={altRef}>{formatAltitude(0, unit, locale)}</span>
              {reentry && (
                <svg aria-hidden="true" viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 5v14M19 12l-7 7-7-7" />
                </svg>
              )}
            </span>
            {phase === 'ascent' && stage === 0 && <span className="mt-1 text-[12px] text-slate-200/80">{labels.skipHint}</span>}
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label={labels.close}
            className="pointer-events-auto w-11 h-11 rounded-xl border border-slate-200/30 bg-[rgba(12,15,23,0.45)] flex items-center justify-center text-slate-200 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-300"
          >
            <svg aria-hidden="true" viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* A l'arribada la regla ja és plena i s'aparta: el text i els botons hi ocupen més lloc. */}
        <svg
          aria-hidden="true"
          viewBox="0 0 70 520"
          className="absolute left-2.5 top-[112px] transition-opacity duration-500 motion-reduce:transition-none"
          style={{ height: 'max(140px, min(520px, calc(100% - 340px)))', width: 'auto', opacity: phase === 'arrived' ? 0 : 1 }}
        >
          <rect width={70} height={520} rx={12} fill="rgba(8,12,24,0.38)" />
          <path d="M10 10V510" stroke="#94a3b8" strokeOpacity={0.5} />
          <path d={ticks.map(t => `M6 ${rulerY(t.altitude).toFixed(1)}H14`).join('')} stroke="#94a3b8" />
          <path ref={trackRef} d="M10 510V510" stroke={accent} strokeWidth={2.5} strokeLinecap="round" />
          <g ref={markerRef} transform="translate(0 510)">
            <circle cx={10} r={9} fill={accent} opacity={0.25} />
            <circle cx={10} r={4.5} fill={accent} />
          </g>
          <g fontFamily="ui-monospace, SFMono-Regular, Menlo, Consolas, monospace" fontSize={9} fill="#cbd5e1">
            {ticks.map(t => <text key={t.label} x={19} y={rulerY(t.altitude) + 3}>{t.label}</text>)}
          </g>
        </svg>
      </div>

      {/* El text de cada parada, al peu; les parades es fonen l'una en l'altra. */}
      <div className="absolute inset-x-0 bottom-0 px-6 pb-[max(36px,env(safe-area-inset-bottom))] pointer-events-none" style={fadeOut}>
        <div className="mx-auto grid max-w-[34rem] lg:mx-16 lg:max-w-[36rem]">
          {captions.map((c, i) => (
            // El text el llegeix la regió viva de sota; només l'arribada, amb els botons, queda a l'abast tal qual.
            <div key={i} ref={el => { captionRefs.current[i] = el; }} aria-hidden={!(i === ARRIVAL && phase === 'arrived')} className="col-start-1 row-start-1 self-end flex flex-col gap-2" style={hiddenLayer}>
              <CaptionText caption={c} accent="#fde68a" />
              {i === ARRIVAL && phase === 'arrived' && (
                <div className="mt-2 flex flex-col gap-2 pointer-events-auto">
                  <button
                    ref={backRef}
                    type="button"
                    onClick={() => setPhase('reentry')}
                    className="h-[52px] w-full rounded-2xl bg-slate-100 text-slate-900 font-semibold text-base flex items-center justify-center gap-2.5 hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-300"
                  >
                    <svg aria-hidden="true" viewBox="0 0 24 24" className="w-[18px] h-[18px]" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 5v14M19 12l-7 7-7-7" />
                    </svg>
                    {labels.backToEarth}
                  </button>
                  <button
                    type="button"
                    onClick={share}
                    className="h-11 w-full rounded-[14px] border border-slate-200/30 text-slate-200 text-[15px] font-medium flex items-center justify-center gap-2 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-300"
                  >
                    <svg aria-hidden="true" viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                      <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8M16 6l-4-4-4 4M12 2v13" />
                    </svg>
                    {copied ? labels.shareCopied : labels.share}
                  </button>
                </div>
              )}
            </div>
          ))}
          <div ref={reentryCaptionRef} aria-hidden="true" className="col-start-1 row-start-1 self-end flex flex-col gap-2" style={hiddenLayer}>
            <CaptionText caption={reentryCaption} accent="#fdba74" />
          </div>
        </div>
      </div>

      <p className="sr-only" aria-live="polite">{`${live.title} ${live.body}`}</p>
    </div>
  );
}

function CaptionText({ caption, accent }: { caption: Caption; accent: string }) {
  return (
    <>
      <span className="font-mono text-[11px] uppercase tracking-[0.14em]" style={{ color: accent }}>{caption.eyebrow}</span>
      <h2 className="m-0 text-[28px] leading-[1.1] font-semibold tracking-[-0.02em] text-balance">{caption.title}</h2>
      <p className="m-0 text-[15px] leading-normal text-slate-200/90 text-pretty">{caption.body}</p>
    </>
  );
}
