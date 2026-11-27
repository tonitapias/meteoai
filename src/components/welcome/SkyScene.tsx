// src/components/welcome/SkyScene.tsx
// Tros de la benvinguda que es carrega després del primer pintat: el càlcul del cel (suncalc, colors del
// modal Solar, fase lunar) i la columna. Així el text, el botó i el cercador surten a l'instant i el paquet
// inicial no creix; quan arriba, avisa la pantalla perquè pinti el fons i la línia de dalt amb el cel real.
import { useEffect } from 'react';
import SkyColumn, { SkyColumnLabels } from './SkyColumn';
import { moonLitPath } from '../../utils/moonDisc';
import { useWelcomeSky } from '../../hooks/welcome/useWelcomeSky';
import type { GeoPermission } from '../../hooks/welcome/useGeoPermission';
import type { WelcomePhase, WelcomeSky } from '../../utils/welcome/welcomeSky';

interface SkySceneProps {
  permission: GeoPermission;
  labels: SkyColumnLabels;
  compact: boolean;
  onSky: (sky: WelcomeSky, now: Date) => void;
}

export default function SkyScene({ permission, labels, compact, onSky }: SkySceneProps) {
  const { sky, now } = useWelcomeSky(permission);
  useEffect(() => { onSky(sky, now); }, [sky, now, onSky]);
  return <SkyColumn sky={sky} labels={labels} compact={compact} />;
}

/**
 * La lluna de la benvinguda en petit (línia de dalt i titular), amb la fase real. La part fosca porta llum cendrosa i
 * una vora del color de la nit: sobre el cel negre, el disc fosc de la targeta Fase lunar s'hi perdia quan la lluna
 * era un fil. Amb `halo`, una mica de resplendor al voltant, com el sol del titular.
 */
function MoonGlyph({ phase, south, color, halo, className }: { phase: number; south: boolean; color: string; halo?: boolean; className: string }) {
  const lit = moonLitPath(phase, 10);
  return (
    <svg viewBox={halo ? '-16 -16 32 32' : '-11.2 -11.2 22.4 22.4'} aria-hidden="true" className={className}>
      {halo && <circle r="15" fill={color} opacity={0.2} />}
      <g transform={south ? 'rotate(180)' : undefined}>
        <circle r="10" fill={color} fillOpacity={0.28} stroke={color} strokeOpacity={0.9} strokeWidth={1.4} />
        {lit && <path d={lit} fill="#f6f3ea" />}
      </g>
    </svg>
  );
}

/** La lluna petita de la línia de dalt, amb la forma real: va en aquest tros perquè només surt quan ja hi ha cel. */
export function EyebrowMoon({ phase, south, color }: { phase: number; south: boolean; color: string }) {
  return <MoonGlyph phase={phase} south={south} color={color} className="inline-block w-[1.15em] h-[1.15em] -mt-[0.15em] mr-1.5 align-middle" />;
}

const SUN_RAYS = [0, 45, 90, 135, 180, 225, 270, 315].map(a => {
  const r = (a * Math.PI) / 180;
  const at = (d: number) => [16 + Math.cos(r) * d, 16 + Math.sin(r) * d].map(v => Math.round(v * 100) / 100);
  return [...at(10.5), ...at(15)];
});

/**
 * El que fa de punt de la "i" (o del punt final) al titular: el que hi ha al cel. Sol amb raigs de dia, a l'alba i a la
 * posta; de nit, la lluna amb la seva fase si és sobre l'horitzó (com a la línia de dalt) i, si no n'hi ha, una estrella.
 */
export function HeadlineAstre({ kind, color, phase, south }: { kind: 'sol' | 'lluna' | 'estrella'; color: string; phase: number; south: boolean }) {
  const cls = 'block w-full h-full overflow-visible';
  if (kind === 'lluna') return <MoonGlyph phase={phase} south={south} color={color} halo className={cls} />;
  if (kind === 'estrella') {
    return (
      <svg viewBox="-16 -16 32 32" aria-hidden="true" className={cls}>
        <circle r="10" fill={color} opacity={0.22} />
        <path d="M0-14C1.3-3.2 3.2-1.3 14 0 3.2 1.3 1.3 3.2 0 14-1.3 3.2-3.2 1.3-14 0-3.2-1.3-1.3-3.2 0-14Z" fill={color} />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" className={cls}>
      <circle cx="16" cy="16" r="9.5" fill={color} opacity={0.28} />
      <circle cx="16" cy="16" r="6.8" fill={color} />
      <g stroke={color} strokeWidth={2.3} strokeLinecap="round">
        {SUN_RAYS.map(([x1, y1, x2, y2], i) => <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} />)}
      </g>
    </svg>
  );
}

/** Colors del núvol del titular per moment del dia: els de la columna, una mica més clars perquè destaquin sobre el text. */
const HEADLINE_CLOUD: Readonly<Record<WelcomePhase, { fill: string; shade: string }>> = {
  alba: { fill: '#f2c6d4', shade: '#c9a0b8' },
  dia: { fill: '#f8fafc', shade: '#b8c4d6' },
  posta: { fill: '#ffe4d3', shade: '#e8b49a' },
  nit: { fill: '#c3cce6', shade: '#8792b4' },
};

/** El núvol que fa d'accent al titular, dibuixat com els cúmuls de la columna. */
export function HeadlineCloud({ phase }: { phase: WelcomePhase }) {
  const { fill, shade } = HEADLINE_CLOUD[phase];
  return (
    <svg viewBox="0 0 60 36" aria-hidden="true" className="block w-full h-full overflow-visible">
      <circle cx="16" cy="22" r="9" fill={fill} />
      <circle cx="30" cy="15" r="13" fill={fill} />
      <circle cx="44" cy="22" r="9" fill={fill} />
      <rect x="7" y="21" width="46" height="11" rx="5.5" fill={fill} />
      <ellipse cx="30" cy="31.5" rx="20" ry="1.8" fill={shade} />
    </svg>
  );
}

/** El sol petit de la línia de dalt, del color de l'accent: sencer de dia, mig sol sobre l'horitzó a l'alba i a la posta. */
export function EyebrowSun({ phase, color }: { phase: Exclude<WelcomePhase, 'nit'>; color: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="inline-block w-[1.15em] h-[1.15em] -mt-[0.15em] mr-1.5 align-middle">
      {phase === 'dia' ? (
        <>
          <circle cx="12" cy="12" r="10" fill={color} opacity={0.2} />
          <circle cx="12" cy="12" r="5.5" fill={color} />
        </>
      ) : (
        <>
          <path d="M6 15.5a6 6 0 0 1 12 0Z" fill={color} />
          <path d="M2.5 16.5h19" stroke={color} strokeWidth={1.6} strokeLinecap="round" opacity={0.7} />
        </>
      )}
    </svg>
  );
}
