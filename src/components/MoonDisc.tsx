// src/components/MoonDisc.tsx
// La Lluna "com és" (mars, terminador i llum cendrosa) de la targeta Fase lunar i del seu modal, amb o sense
// l'anell del cicle. Un sol SVG estàtic, sense filtres. A l'hemisferi sud es gira mig volt: el costat
// il·luminat i els mars hi canvien de lloc.
import { useId } from 'react';
import { MOON_MARIA, MOON_TYCHO, lunationArc, moonLitPath, ringPoint } from '../utils/moonDisc';

interface MoonGlyphProps {
    /** Fase 0..1 (lunarPhases.getMoonPhase). */
    phase: number;
    /** Hemisferi sud: girada mig volt. */
    south?: boolean;
    /** Sense dades: apagada i sense progrés. */
    dim?: boolean;
    /** Mars i enfosquiment del limbe (a mides de pocs píxels no es veuen: millor sense). */
    detail?: boolean;
    className?: string;
}

const useClipIds = () => {
    const uid = `mn${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
    return { lit: `${uid}l`, limb: `${uid}r` };
};

/** El disc de la Lluna centrat a (0, 0) amb radi R (per posar dins d'un SVG). */
const Disc = ({ phase, south, dim, detail, R, ids }: Required<Omit<MoonGlyphProps, 'className'>> & { R: number; ids: { lit: string; limb: string } }) => {
    const lit = moonLitPath(phase, R);
    return (
        <>
            <defs>
                <clipPath id={ids.lit}><path d={lit} /></clipPath>
                {detail && (
                    <radialGradient id={ids.limb} cx="50%" cy="50%" r="50%">
                        <stop offset="55%" stopColor="#000" stopOpacity="0" />
                        <stop offset="100%" stopColor="#000" stopOpacity=".42" />
                    </radialGradient>
                )}
            </defs>
            <g transform={south ? 'rotate(180)' : undefined} opacity={dim ? 0.4 : 1}>
                <circle r={R} fill="#151a2a" />
                {lit && (
                    <g clipPath={`url(#${ids.lit})`}>
                        <circle r={R} fill="#e6e3da" />
                        {detail && MOON_MARIA.map(([x, y, rx, ry], i) => (
                            <ellipse key={i} cx={x * R} cy={y * R} rx={rx * R} ry={ry * R} fill="#8f96a3" fillOpacity=".55" />
                        ))}
                        {detail && <circle cx={MOON_TYCHO[0] * R} cy={MOON_TYCHO[1] * R} r={Math.max(1, MOON_TYCHO[2] * R)} fill="#fbfaf6" />}
                        {detail && <circle r={R} fill={`url(#${ids.limb})`} />}
                    </g>
                )}
                <circle r={R} fill="none" stroke="#fff" strokeOpacity={detail ? 0.08 : 0.14} />
            </g>
        </>
    );
};

/** Només la Lluna (viewBox 100×100). */
export const MoonDisc = ({ phase, south = false, dim = false, detail = true, className = 'w-full h-full' }: MoonGlyphProps) => {
    const ids = useClipIds();
    return (
        <svg viewBox="-50 -50 100 100" className={className} aria-hidden="true" focusable="false">
            <Disc phase={phase} south={south} dim={dim} detail={detail} R={48} ids={ids} />
        </svg>
    );
};

/** La Lluna dins de l'anell del cicle: nova a dalt, quart creixent a la dreta, plena a baix (viewBox 120×120). */
export const MoonWithRing = ({ phase, south = false, dim = false, className = 'w-full h-full' }: Omit<MoonGlyphProps, 'detail'>) => {
    const ids = useClipIds();
    const C = 60, RING = 55, R = 41;
    const ang = Math.max(0, Math.min(1, phase)) * 360;
    const [px, py] = ringPoint(C, C, RING, ang);
    return (
        <svg viewBox="0 0 120 120" className={className} aria-hidden="true" focusable="false">
            <circle cx={C} cy={C} r={RING} fill="none" stroke="#fff" strokeOpacity=".08" strokeWidth="3" />
            {!dim && <path d={lunationArc(C, C, RING, phase)} fill="none" stroke="#a5b4fc" strokeWidth="3" strokeLinecap="round" />}
            {[0, 90, 180, 270].map(a => {
                const [x, y] = ringPoint(C, C, RING, a);
                return <circle key={a} cx={x} cy={y} r="2.6" fill={!dim && a <= ang ? '#a5b4fc' : '#3b4260'} />;
            })}
            <g transform={`translate(${C},${C})`}>
                <Disc phase={phase} south={south} dim={dim} detail R={R} ids={ids} />
            </g>
            {!dim && <circle cx={px} cy={py} r="4.6" fill="#eef2ff" stroke="#11131f" strokeWidth="2" />}
        </svg>
    );
};
