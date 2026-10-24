// src/components/welcome/SkyScene.tsx
// Tros de la benvinguda que es carrega després del primer pintat: el càlcul del cel (suncalc, colors del
// modal Solar, fase lunar) i la columna. Així el text, el botó i el cercador surten a l'instant i el paquet
// inicial no creix; quan arriba, avisa la pantalla perquè pinti el fons i la línia de dalt amb el cel real.
import { useEffect } from 'react';
import SkyColumn, { SkyColumnLabels } from './SkyColumn';
import { MoonDisc } from '../MoonDisc';
import { useWelcomeSky } from '../../hooks/welcome/useWelcomeSky';
import type { GeoPermission } from '../../hooks/welcome/useGeoPermission';
import type { WelcomeSky } from '../../utils/welcome/welcomeSky';

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

/** La lluna petita de la línia de dalt, amb la forma real: va en aquest tros perquè només surt quan ja hi ha cel. */
export function EyebrowMoon({ phase, south }: { phase: number; south: boolean }) {
  return <MoonDisc phase={phase} south={south} detail={false} className="inline-block w-[1.15em] h-[1.15em] -mt-[0.15em] mr-1.5 align-middle" />;
}
