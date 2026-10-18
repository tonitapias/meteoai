// src/components/solar/SolarCompass.tsx
// "Direcció del sol" (totes les mides; a pantalles estretes la figura i la llegenda s'apilen): el recorregut del sol vist des de dalt amb el nord a dalt
// (projecció azimutal equidistant: l'horitzó és el cercle, el zenit el centre). SVG estàtic per dia; el punt
// del sol el mou el canal del gràfic (una transformació per fotograma, sense render de React).
import { memo, useId, useLayoutEffect, useMemo, useRef } from 'react';
import * as SunCalc from 'suncalc';
import type { Language } from '../../translations';
import { getCardinalLabel } from '../../utils/astronomyMath';
import { azText } from '../../utils/solar/solarFormat';
import { type SolarDayModel, geometricAltitude, markerTone } from '../../utils/solar/solarDay';
import { type SolarStrings } from './solarI18n';
import type { ScrubChannel } from './scrubChannel';
import { DEFERRED_MOUNT_MS, useDeferredMount } from './useDeferredMount';

const C = 60;          // centre del viewBox 120×120
const R = 48;          // radi de l'horitzó
const FIG_PX = 168;    // mida CSS de la figura
const SCALE = FIG_PX / 120;
const SAMPLES = 96;

const r1 = (v: number) => Math.round(v * 10) / 10;

/** Punt del cel (azimut des del nord, alçada) al pla: r = R·(1 − alt/90), nord a dalt, est a la dreta. */
const project = (az: number, alt: number): [number, number] => {
  const r = R * (1 - Math.max(0, Math.min(90, alt)) / 90);
  const a = (az * Math.PI) / 180;
  return [C + r * Math.sin(a), C - r * Math.cos(a)];
};

interface SolarCompassProps {
  model: SolarDayModel;
  channel: ScrubChannel;
  t: SolarStrings;
  lang: Language;
}

export const SolarCompass = memo(function SolarCompass(props: SolarCompassProps) {
  const ready = useDeferredMount(DEFERRED_MOUNT_MS);
  if (!ready) return <div className="sm-a-cmp" />;
  return <CompassBody {...props} />;
});

function CompassBody({ model, channel, t, lang }: SolarCompassProps) {
  const id = useId();
  const gid = `smc${id.replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const dotRef = useRef<HTMLDivElement | null>(null);

  const fig = useMemo(() => {
    const { startMs, endMs, lat, lon } = model;
    // Trams per sobre de l'horitzó (alçada aparent ≥ 0), enganxats a l'horitzó pels extrems.
    let path = '';
    let open = false;
    for (let i = 0; i <= SAMPLES; i++) {
      const p = SunCalc.getPosition(new Date(startMs + (i * (endMs - startMs)) / SAMPLES), lat, lon);
      if (p.altitude >= 0) {
        const [x, y] = project(p.azimuth, p.altitude);
        path += `${open ? 'L' : 'M'}${r1(x)},${r1(y)}`;
        open = true;
      } else open = false;
    }
    const dot = (az: number | null, alt: number) => (az === null ? null : project(az, alt).map(r1) as [number, number]);
    const noonPos = model.t.noon !== null ? SunCalc.getPosition(new Date(model.t.noon), lat, lon) : null;
    return {
      path,
      rise: model.polar === 'none' ? dot(model.riseAz, 0) : null,
      set: model.polar === 'none' ? dot(model.setAz, 0) : null,
      noon: noonPos && noonPos.altitude >= 0 ? dot(noonPos.azimuth, noonPos.altitude) : null,
    };
  }, [model]);

  const cardinals = useMemo(() => ([[0, C, 9], [90, 113.5, C + 3], [180, C, 117], [270, 6.5, C + 3]] as const)
    .map(([az, x, y]) => ({ x, y, text: getCardinalLabel(az, lang) })), [lang]);

  // Punt actiu: el canal recorda l'última posició pintada (confirmada o d'arrossegament) i la torna en subscriure's.
  useLayoutEffect(() => channel.subscribe((az, alt) => {
    const el = dotRef.current;
    if (!el) return;
    const [x, y] = project(az, alt);
    el.style.transform = `translate(${(x * SCALE).toFixed(1)}px,${(y * SCALE).toFixed(1)}px)`;
    const tone = markerTone(geometricAltitude(alt));
    if (el.dataset.tone !== tone) el.dataset.tone = tone;
  }), [channel]);

  return (
    <section className="sm-card sm-a-cmp" aria-labelledby={id}>
      <h3 id={id} className="sm-eyebrow">{t.compassTitle}</h3>
      {/* 168 px de figura + la llegenda al costat no caben per sota de ~380 px d'amplada: s'apilen. */}
      <div className="mt-2 flex flex-col items-center gap-3 min-[380px]:flex-row min-[380px]:gap-5">
        <div className="sm-cmp-fig" role="img" aria-label={t.compassAria}>
          <svg width={FIG_PX} height={FIG_PX} viewBox="0 0 120 120" aria-hidden="true" focusable="false">
            <defs>
              <radialGradient id={gid}>
                <stop offset="0" stopColor="#15223f" />
                <stop offset="1" stopColor="#0a1020" />
              </radialGradient>
            </defs>
            <circle cx={C} cy={C} r={R} fill={`url(#${gid})`} />
            <path d={`M${C},${C - 32}a32,32 0 1,0 0.01,0M${C},${C - 16}a16,16 0 1,0 0.01,0`} fill="none" stroke="rgba(255,255,255,.07)" strokeDasharray="2 3" />
            <path d={`M${C},${C - R}V${C + R}M${C - R},${C}H${C + R}`} stroke="rgba(255,255,255,.05)" />
            <circle cx={C} cy={C} r={R} fill="none" stroke="rgba(148,163,184,.45)" />
            {cardinals.map(c => (
              <text key={c.text + c.x} x={c.x} y={c.y} textAnchor="middle" fontSize="8.5" fill="#94a3b8">{c.text}</text>
            ))}
            {fig.path && (
              <>
                <path d={fig.path} fill="none" stroke="#fbbf24" strokeOpacity=".18" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
                <path d={fig.path} fill="none" stroke="#fbbf24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </>
            )}
            {fig.rise && <circle cx={fig.rise[0]} cy={fig.rise[1]} r="2.6" fill="#fbbf24" />}
            {fig.set && <circle cx={fig.set[0]} cy={fig.set[1]} r="2.6" fill="#818cf8" />}
            {fig.noon && <circle cx={fig.noon[0]} cy={fig.noon[1]} r="2.2" fill="#fff8e1" />}
          </svg>
          <div ref={dotRef} className="sm-cmp-dot" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex flex-wrap justify-center gap-x-4 gap-y-1 min-[380px]:block">
          <p className="flex items-center gap-2 text-[13px] leading-5 text-slate-200">
            <span className="inline-block w-2 h-2 rounded-full bg-amber-400" aria-hidden="true" />
            {t.sunrise} <span className="tabular-nums text-slate-300">{azText(model.polar === 'none' ? model.riseAz : null, lang)}</span>
          </p>
          <p className="min-[380px]:mt-1 flex items-center gap-2 text-[13px] leading-5 text-slate-200">
            <span className="inline-block w-2 h-2 rounded-full bg-indigo-400" aria-hidden="true" />
            {t.sunset} <span className="tabular-nums text-slate-300">{azText(model.polar === 'none' ? model.setAz : null, lang)}</span>
          </p>
        </div>
      </div>
    </section>
  );
}
