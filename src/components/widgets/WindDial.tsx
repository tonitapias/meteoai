// src/components/widgets/WindDial.tsx
// La brúixola del vent, compartida pel giny del Detall (CompassGauge) i pel modal (WindModal): abans cadascun en tenia una
// còpia. L'anell és només de la DIRECCIÓ (marques, N/E/S/O i l'agulla al costat d'on ve el vent, apuntant cap on va); la
// VELOCITAT i les RATXES van en un arc de velocímetre a baix, dins l'anell, d'esquerra a dreta (0 → 120 km/h).
// La geometria i el criteri de la fletxa són a utils/windDial.ts. El centre (xifres) el posa qui el fa servir.
import { useId, type ReactNode } from 'react';
import { Navigation2 } from 'lucide-react';
import { westLetter } from './widgetHelpers';
import { WIND_DIAL_MAX_KMH, dialPoint, speedArcPath, speedFraction, SPEED_ARC_START_DEG, SPEED_ARC_SWEEP_DEG } from '../../utils/windDial';

// Coordenades del viewBox 200 × 200 (quadrat: el text de l'SVG no es deforma).
const C = 100;
const BEZEL_R = 82;      // l'anell fosc de la direcció (de 76 a 88)
const BEZEL_W = 12;
const SPEED_R = 60;      // l'arc del velocímetre (de 56 a 64), lluny de les marques (des de 70)
const SPEED_W = 8;
const SCALE_GAP_DEG = 14;
const LETTER_R = 82;

export interface WindDialProps {
    /** D'on ve el vent (graus), o null. */
    degrees: number | null;
    /** km/h, o null. */
    speed: number | null;
    /** km/h, o null. */
    gusts: number | null;
    /** Pinta la ratxa (tènue, darrere la velocitat): la mateixa regla que la xifra de ratxes (més de 5 km/h per sobre). */
    showGusts: boolean;
    /** Degradat de l'arc de velocitat, d'esquerra a dreta. */
    speedColors: readonly [string, string];
    gustColor: string;
    /** Color de l'agulla (classe de text). */
    needleClassName: string;
    /** Sense dada de velocitat: marques apagades. */
    dimmed?: boolean;
    lang?: string;
    /** Mida (classes w/h). */
    className: string;
    children?: ReactNode;
}

export const WindDial = ({ degrees, speed, gusts, showGusts, speedColors, gustColor, needleClassName, dimmed = false, lang, className, children }: WindDialProps) => {
    // useId porta caràcters (":", "«") que no sempre sobreviuen dins d'un url(#...) d'SVG.
    const gradientId = `wdial-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
    const hasDir = typeof degrees === 'number' && Number.isFinite(degrees);

    const speedPath = speedArcPath(speedFraction(speed), C, C, SPEED_R);
    const gustPath = showGusts ? speedArcPath(speedFraction(gusts), C, C, SPEED_R) : '';
    const trackPath = speedArcPath(1, C, C, SPEED_R);
    // Escala als extrems de l'arc, uns graus més enllà de cada punta (just a sota, l'extrem arrodonit la tapava).
    const scaleStart = dialPoint(C, C, SPEED_R, SPEED_ARC_START_DEG + SCALE_GAP_DEG);
    const scaleEnd = dialPoint(C, C, SPEED_R, SPEED_ARC_START_DEG - SPEED_ARC_SWEEP_DEG - SCALE_GAP_DEG);

    const letters: { label: string; deg: number }[] = [
        { label: 'N', deg: 0 }, { label: 'E', deg: 90 }, { label: 'S', deg: 180 }, { label: westLetter(lang), deg: 270 },
    ];

    return (
        <div className={`relative flex items-center justify-center ${className}`}>
            <svg viewBox="0 0 200 200" className="absolute inset-0 w-full h-full drop-shadow-xl" aria-hidden="true" focusable="false">
                <defs>
                    <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor={speedColors[0]} />
                        <stop offset="100%" stopColor={speedColors[1]} />
                    </linearGradient>
                </defs>

                {/* Anell de la direcció: bisell fosc i marques cada 10° (més llargues als punts cardinals) */}
                <circle cx={C} cy={C} r={BEZEL_R} fill="none" stroke="#131722" strokeWidth={BEZEL_W} />
                {Array.from({ length: 36 }, (_, i) => {
                    const isCardinal = i % 9 === 0;
                    const inner = dialPoint(C, C, isCardinal ? 70 : 76, i * 10);
                    const outer = dialPoint(C, C, 88, i * 10);
                    return (
                        <line key={i} x1={inner.x} y1={inner.y} x2={outer.x} y2={outer.y}
                            stroke={dimmed ? '#1e293b' : isCardinal ? '#475569' : '#1e293b'}
                            strokeWidth={isCardinal ? 2 : 1} opacity={dimmed ? 0.25 : 0.7} />
                    );
                })}
                {letters.map(l => {
                    const p = dialPoint(C, C, LETTER_R, l.deg);
                    return (
                        <g key={l.label + l.deg}>
                            <circle cx={p.x} cy={p.y} r={7} fill="#0c0e15" />
                            <text x={p.x} y={p.y} dy="0.35em" textAnchor="middle" fontSize="10" fontWeight="900" fill={hasDir ? '#94a3b8' : '#334155'}>{l.label}</text>
                        </g>
                    );
                })}

                {/* Velocímetre: carril, ratxa (tènue, darrere) i velocitat; 0 i 120 km/h als extrems */}
                <path d={trackPath} fill="none" stroke="#1e293b" strokeOpacity={dimmed ? 0.4 : 0.9} strokeWidth={SPEED_W} strokeLinecap="round" />
                {gustPath && <path data-testid="wind-dial-gusts" d={gustPath} fill="none" stroke={gustColor} strokeOpacity={0.35} strokeWidth={SPEED_W} strokeLinecap="round" />}
                {speedPath && <path data-testid="wind-dial-speed" d={speedPath} fill="none" stroke={`url(#${gradientId})`} strokeWidth={SPEED_W} strokeLinecap="round" />}
                <text x={scaleStart.x} y={scaleStart.y} dy="0.35em" textAnchor="middle" fontSize="8" fontWeight="700" fill="#64748b">0</text>
                <text x={scaleEnd.x} y={scaleEnd.y} dy="0.35em" textAnchor="middle" fontSize="8" fontWeight="700" fill="#64748b">{WIND_DIAL_MAX_KMH}</text>
            </svg>

            {/* Agulla de la direcció: sobre l'anell, al costat d'on ve el vent, apuntant cap al centre (cap on va) */}
            {hasDir && (
                <div data-testid="wind-dial-needle" data-deg={Math.round(degrees)} className="absolute inset-0 flex items-start justify-center pointer-events-none z-20 transition-transform duration-1000 ease-out" style={{ transform: `rotate(${degrees}deg)` }} aria-hidden="true">
                    {/* Centrada sobre el bisell (r = 82 de 100): el 9 % de dalt, menys la meitat de la bombolla (17 px). */}
                    <div className="rounded-full p-1.5 border shadow-[0_4px_12px_rgba(0,0,0,0.8)] bg-[#0c0e15] border-slate-700" style={{ marginTop: 'calc(9% - 17px)' }}>
                        <Navigation2 className={`w-5 h-5 ${needleClassName} drop-shadow-[0_0_8px_currentColor]`} style={{ transform: 'rotate(180deg)', fill: 'currentColor', fillOpacity: 0.2 }} />
                    </div>
                </div>
            )}

            {children}
        </div>
    );
};
