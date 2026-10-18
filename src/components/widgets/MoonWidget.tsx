// src/components/widgets/MoonWidget.tsx
// Targeta Fase lunar del tauler, direcció "Cel viu": la Lluna com és (mars, terminador i llum cendrosa) dins
// d'un anell que marca el punt del cicle (nova a dalt, quart creixent a la dreta, plena a baix, quart minvant a
// l'esquerra), on és ara al cel, les hores de sortida i posta i la pròxima lluna plena.
// Pensada per a mòbils de gama baixa: cap blur, filtre ni animació; un SVG estàtic.
import { useId, useMemo } from 'react';
import { Moon, CloudOff } from 'lucide-react';
// DOCTRINA RISC ZERO: Importació mitjançant Namespace (* as)
import * as SunCalc from 'suncalc';
import type { Language } from '../../translations';
import { WIDGET_BASE_STYLE, TITLE_STYLE } from './widgetStyles';
import { getTrans } from './widgetHelpers';
import { getCardinalLabel, getMoonCompassPosition, getNextMoonEvent } from '../../utils/astronomyMath';
import { MOON_MARIA, MOON_TYCHO, lunationArc, moonLitPath, ringPoint } from '../../utils/moonDisc';

interface MoonWidgetProps {
    lang: Language;
    /** Fase 0..1 (lunarPhases.getMoonPhase) a l'instant `date`. */
    phase: number;
    /** Edat en dies des de la lluna nova real (lunarPhases.getMoonAgeDays), calculada al mateix instant que `phase`. */
    ageDays?: number;
    lat?: number;
    lon?: number;
    /** Instant de referència (el rellotge de l'app); sense, ara. */
    date?: Date | string | number;
    timezone?: string;
}

// Textos propis de la targeta en els 4 idiomes (els de fr i es, com els del modal Lunar).
interface MoonStrings {
    illuminated: string; below: string; rise: string; set: string; day: string;
    full: string; today: string; tomorrow: string; days: string;
}
const MOON_TEXT: Readonly<Record<Language, MoonStrings>> = {
    ca: { illuminated: 'il·luminada', below: "sota l'horitzó", rise: 'Sortida', set: 'Posta', day: 'Dia', full: 'Plena', today: 'avui', tomorrow: 'demà', days: 'dies' },
    es: { illuminated: 'iluminada', below: 'bajo el horizonte', rise: 'Salida', set: 'Puesta', day: 'Día', full: 'Llena', today: 'hoy', tomorrow: 'mañana', days: 'días' },
    en: { illuminated: 'illuminated', below: 'below the horizon', rise: 'Rise', set: 'Set', day: 'Day', full: 'Full', today: 'today', tomorrow: 'tomorrow', days: 'days' },
    fr: { illuminated: 'éclairée', below: "sous l'horizon", rise: 'Lever', set: 'Coucher', day: 'Jour', full: 'Pleine', today: "aujourd'hui", tomorrow: 'demain', days: 'jours' },
};
const LOCALE: Readonly<Record<Language, string>> = { ca: 'ca-ES', es: 'es-ES', en: 'en-GB', fr: 'fr-FR' };

// DOCTRINA RISC ZERO: Motor de traducció local aïllat i amb tipatge estricte (mateixos llindars que el modal)
const getTranslatedMoonPhase = (phase: number, lang: string): string => {
    const safePhase = typeof phase === 'number' && !isNaN(phase) ? Math.max(0, Math.min(1, phase)) : 0;

    // Mapatge astronòmic rigorós (8 fases)
    let phaseIndex = 0;
    if (safePhase < 0.02 || safePhase > 0.98) phaseIndex = 0; // Nova
    else if (safePhase < 0.23) phaseIndex = 1; // Creixent
    else if (safePhase < 0.27) phaseIndex = 2; // Quart Creixent
    else if (safePhase < 0.48) phaseIndex = 3; // Gibosa Creixent
    else if (safePhase <= 0.52) phaseIndex = 4; // Plena
    else if (safePhase < 0.73) phaseIndex = 5; // Gibosa Minvant
    else if (safePhase < 0.77) phaseIndex = 6; // Quart Minvant
    else phaseIndex = 7; // Minvant

    const dict: Record<string, string[]> = {
        ca: ['Lluna Nova', 'Creixent', 'Quart Creixent', 'Gibosa Creixent', 'Lluna Plena', 'Gibosa Minvant', 'Quart Minvant', 'Minvant'],
        es: ['Luna Nueva', 'Creciente', 'Cuarto Creciente', 'Gibosa Creciente', 'Luna Llena', 'Gibosa Menguante', 'Cuarto Menguante', 'Menguante'],
        en: ['New Moon', 'Waxing Crescent', 'First Quarter', 'Waxing Gibbous', 'Full Moon', 'Waning Gibbous', 'Last Quarter', 'Waning Crescent'],
        fr: ['Nouvelle Lune', 'Premier Croissant', 'Premier Quartier', 'Lune Gibbeuse Crois.', 'Pleine Lune', 'Lune Gibbeuse Décrois.', 'Dernier Quartier', 'Dernier Croissant']
    };

    const safeLang = typeof lang === 'string' ? lang.toLowerCase() : 'ca';
    const activeLang = dict[safeLang] ? safeLang : 'ca';

    return dict[activeLang][phaseIndex] || '--';
};

interface RiseSet { rise: string | null; set: string | null; riseNextDay: boolean; setNextDay: boolean }

/**
 * Sortida i posta del dia LOCAL de la ubicació: SunCalc.getMoonTimes treballa per dies UTC, així que es
 * recullen els esdeveniments d'ahir, avui i demà i es tria el que cau a la data local (o el següent: "+1d").
 */
function moonRiseSet(target: Date, lat: number, lon: number, timezone?: string): RiseSet {
    const empty: RiseSet = { rise: null, set: null, riseNextDay: false, setNextDay: false };
    try {
        // Definim el fus horari. Si no en rebem, utilitzem el del dispositiu com a xarxa de seguretat.
        const tz = typeof timezone === 'string' && timezone.trim() !== ''
            ? timezone
            : Intl.DateTimeFormat().resolvedOptions().timeZone;
        const dateFormatter = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' });
        const timeFormatter = new Intl.DateTimeFormat('ca-ES', { timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false });
        const targetDateStr = dateFormatter.format(target);
        const days = [-1, 0, 1].map(k => SunCalc.getMoonTimes(new Date(target.getTime() + k * 86400000), lat, lon));
        const allRises = days.map(d => d.rise).filter(Boolean) as Date[];
        const allSets = days.map(d => d.set).filter(Boolean) as Date[];

        const pick = (list: Date[]) => {
            const same = list.find(d => dateFormatter.format(d) === targetDateStr);
            if (same) return { d: same, next: false };
            const later = list.find(d => dateFormatter.format(d) > targetDateStr);
            return later ? { d: later, next: true } : null;
        };
        const r = pick(allRises), s = pick(allSets);
        const fmt = (d?: Date) => (d && !isNaN(d.getTime()) ? timeFormatter.format(d) : null);
        return { rise: fmt(r?.d), set: fmt(s?.d), riseNextDay: !!r?.next, setNextDay: !!s?.next };
    } catch (error) {
        console.error("Error al calcular el cicle lunar global:", error);
        return empty;
    }
}

const LAB = 'text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500';

/** La Lluna amb l'anell del cicle (viewBox 120×120). */
const MoonWithRing = ({ phase, south, dim }: { phase: number; south: boolean; dim: boolean }) => {
    const uid = `mw${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
    const C = 60, RING = 55, R = 41;
    const lit = moonLitPath(phase, R);
    const ang = Math.max(0, Math.min(1, phase)) * 360;
    const [px, py] = ringPoint(C, C, RING, ang);
    return (
        <svg viewBox="0 0 120 120" className="w-full h-full" aria-hidden="true" focusable="false">
            <defs>
                <clipPath id={`${uid}l`}><path d={lit} /></clipPath>
                <radialGradient id={`${uid}r`} cx="50%" cy="50%" r="50%">
                    <stop offset="55%" stopColor="#000" stopOpacity="0" />
                    <stop offset="100%" stopColor="#000" stopOpacity=".42" />
                </radialGradient>
            </defs>
            <circle cx={C} cy={C} r={RING} fill="none" stroke="#fff" strokeOpacity=".08" strokeWidth="3" />
            {!dim && <path d={lunationArc(C, C, RING, phase)} fill="none" stroke="#a5b4fc" strokeWidth="3" strokeLinecap="round" />}
            {[0, 90, 180, 270].map(a => {
                const [x, y] = ringPoint(C, C, RING, a);
                return <circle key={a} cx={x} cy={y} r="2.6" fill={!dim && a <= ang ? '#a5b4fc' : '#3b4260'} />;
            })}
            {/* A l'hemisferi sud la Lluna es veu girada mig volt: el costat il·luminat i els mars canvien de lloc. */}
            <g transform={`translate(${C},${C})${south ? ' rotate(180)' : ''}`} opacity={dim ? 0.4 : 1}>
                <circle r={R} fill="#151a2a" />
                {lit && (
                    <g clipPath={`url(#${uid}l)`}>
                        <circle r={R} fill="#e6e3da" />
                        {MOON_MARIA.map(([x, y, rx, ry], i) => (
                            <ellipse key={i} cx={x * R} cy={y * R} rx={rx * R} ry={ry * R} fill="#8f96a3" fillOpacity=".55" />
                        ))}
                        <circle cx={MOON_TYCHO[0] * R} cy={MOON_TYCHO[1] * R} r={Math.max(1, MOON_TYCHO[2] * R)} fill="#fbfaf6" />
                        <circle r={R} fill={`url(#${uid}r)`} />
                    </g>
                )}
                <circle r={R} fill="none" stroke="#fff" strokeOpacity=".08" />
            </g>
            {!dim && <circle cx={px} cy={py} r="4.6" fill="#eef2ff" stroke="#11131f" strokeWidth="2" />}
        </svg>
    );
};

export const MoonWidget = ({ phase, ageDays, lat, lon, lang, date, timezone }: MoonWidgetProps) => {
    // DOCTRINA RISC ZERO: Validació estricta d'objecte i extracció tipada
    const t = getTrans(lang) as Record<string, unknown>;
    const titleMoon = typeof t.moonPhase === 'string' ? t.moonPhase : "LLUNA";
    const text = MOON_TEXT[lang] ?? MOON_TEXT.ca;

    // Separació estricta de disponibilitat de dades
    const hasData = typeof phase === 'number' && !isNaN(phase);
    const hasValidCoords = typeof lat === 'number' && !isNaN(lat) && typeof lon === 'number' && !isNaN(lon);
    const isSouth = hasValidCoords && (lat as number) < 0;

    // Càlcul de la il·luminació real (0-100%) protegit contra divisions o nuls
    const illumination = hasData ? Math.round(((1 - Math.cos(phase * 2 * Math.PI)) / 2) * 100) : 0;
    const moonText = hasData ? getTranslatedMoonPhase(phase, lang) : '--';
    // Edat real (dies des de la lluna nova), no fase × 29,53: les lunacions no duren igual.
    const moonAge = hasData && typeof ageDays === 'number' && !isNaN(ageDays) ? ageDays : '--';

    const instant = useMemo(() => {
        const d = date !== undefined ? new Date(date) : new Date();
        return isNaN(d.getTime()) ? new Date() : d;
    }, [date]);
    const instantMs = instant.getTime();

    // Sortida i posta: depenen només del dia local (es recalculen quan canvia la data, no cada minut).
    const localDay = useMemo(() => {
        try {
            const tz = typeof timezone === 'string' && timezone.trim() !== '' ? timezone : undefined;
            return new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(instantMs));
        } catch {
            return new Date(instantMs).toDateString();
        }
    }, [instantMs, timezone]);
    const riseSet = useMemo(
        () => (hasValidCoords ? moonRiseSet(new Date(instantMs), lat as number, lon as number, timezone) : null),
        // eslint-disable-next-line react-hooks/exhaustive-deps -- es recalcula per dia local, no per minut
        [hasValidCoords, lat, lon, timezone, localDay],
    );

    // On és ara (la mateixa funció que la "Posició actual" del modal) i la pròxima plena (també la del modal).
    const pos = hasValidCoords ? getMoonCompassPosition(instant, lat as number, lon as number) : null;
    const nextFull = useMemo(() => (hasData ? getNextMoonEvent('full', new Date(instantMs), 45) : null), [hasData, instantMs]);
    const nextFullText = useMemo(() => {
        if (!nextFull) return '--';
        if (nextFull.daysAhead === 0) return text.today;
        if (nextFull.daysAhead === 1) return text.tomorrow;
        // La data de getNextMoonEvent és el migdia UTC del dia de l'esdeveniment (el mateix dia que compta el modal).
        const day = new Intl.DateTimeFormat(LOCALE[lang] ?? 'ca-ES', { weekday: 'short', day: 'numeric', timeZone: 'UTC' }).format(nextFull.date);
        return `${day} · ${nextFull.daysAhead} ${text.days}`;
    }, [nextFull, lang, text]);

    return (
        <div className={`${WIDGET_BASE_STYLE} select-none`}>
            <div className="flex items-center justify-between gap-2 min-h-[28px] relative z-10">
                <span className={`${TITLE_STYLE.replace('mb-4', 'mb-0')} min-w-0`}>
                    {hasData ? <Moon className="w-4 h-4 text-indigo-300 shrink-0" aria-hidden="true" /> : <CloudOff className="w-4 h-4 text-slate-500 shrink-0" aria-hidden="true" />}
                    <span className="tracking-wider text-slate-200 truncate">{titleMoon}</span>
                </span>
                <span className="shrink-0 rounded-full border border-white/10 bg-black/30 px-2 py-0.5 font-mono text-[11px] font-semibold text-slate-300">
                    {text.day} {moonAge}
                </span>
            </div>

            <div className="flex justify-center mt-2">
                <div className="w-[120px] h-[120px] lg:w-[92px] lg:h-[92px]">
                    <MoonWithRing phase={hasData ? phase : 0} south={isSouth} dim={!hasData} />
                </div>
            </div>

            <div className="text-center mt-0.5">
                <div className={`text-[17px] font-bold leading-tight ${hasData ? 'text-slate-100' : 'text-slate-500'}`}>{moonText}</div>
                <div className="text-[12px] text-slate-400 mt-0.5">
                    <span className="font-mono text-indigo-100">{hasData ? illumination : '--'}%</span> {text.illuminated}
                    {pos && (
                        <>
                            {' · '}
                            {pos.altitudeDeg > 0
                                ? <><span className="font-mono">{Math.round(pos.altitudeDeg)}°</span> {getCardinalLabel(pos.azimuthDeg, lang)}</>
                                : text.below}
                        </>
                    )}
                </div>
            </div>

            <div className="flex items-end justify-between gap-2 border-t border-white/[0.07] pt-2.5 mt-2.5 relative z-10">
                <div className="font-mono text-[12.5px] leading-[1.45]">
                    <div className="flex items-baseline gap-1">
                        <span className="sr-only">{text.rise}</span>
                        <span className="text-slate-500" aria-hidden="true">↑</span>
                        <span className={riseSet?.rise ? 'text-cyan-300' : 'text-slate-600'}>{riseSet?.rise || '--:--'}</span>
                        {riseSet?.riseNextDay && <span className="font-sans text-[9px] text-cyan-200/60">+1d</span>}
                    </div>
                    <div className="flex items-baseline gap-1">
                        <span className="sr-only">{text.set}</span>
                        <span className="text-slate-500" aria-hidden="true">↓</span>
                        <span className={riseSet?.set ? 'text-amber-300' : 'text-slate-600'}>{riseSet?.set || '--:--'}</span>
                        {riseSet?.setNextDay && <span className="font-sans text-[9px] text-amber-200/60">+1d</span>}
                    </div>
                </div>
                <div className="text-right min-w-0">
                    <div className={LAB}>{text.full}</div>
                    <div className="text-[13px] text-slate-200 whitespace-nowrap">{nextFullText}</div>
                </div>
            </div>
        </div>
    );
};
