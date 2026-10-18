// src/components/widgets/SunArcWidget.tsx
// Targeta Cicle solar del tauler, direcció "Cel viu": el fons del gràfic és el color del cel d'ARA, la corba és
// l'alçada real del sol al llarg del dia local (el mateix model que el modal: buildSolarDay), pintada per fases
// de llum, i a sota hi ha la sortida, la durada del dia (amb la Δ respecte d'ahir) i la posta.
// Pensada per a mòbils de gama baixa: cap blur, filtre ni animació. L'SVG de la corba es fa un cop per dia;
// cada minut només es mouen el sol, el retall del tram ja recorregut i els textos.
import { useEffect, useId, useMemo, useState, type CSSProperties } from 'react';
import { Sun, CloudOff } from 'lucide-react';
import * as SunCalc from 'suncalc';
import type { Language } from '../../translations';
import { WIDGET_BASE_STYLE, TITLE_STYLE } from './widgetStyles';
import { formatHoursMinutes } from '../../utils/formatters';
import { addDays, localDateOf, makeZoneCtx } from '../../utils/solar/solarTime';
import {
    astroLengthFor, buildSolarDay, geometricAltitude, markerTone, upcomingRiseSet, type TimeText,
} from '../../utils/solar/solarDay';
import { omEdgesFor, type SolarDaily } from '../../utils/solar/solarForecast';
import {
    CARD_H, CARD_STARS_GEO, CARD_W, MINUS, azText, buildSunCardGeom, degText, formatCountdown, formatDeltaLong,
    signedDeg, sunCardSky, sunCardStars,
} from '../../utils/solar/sunCard';

// Textos propis de la targeta en els 4 idiomes: els mateixos que el modal Cicle solar (solarI18n), que viu al
// seu tros de codi diferit i no s'ha d'arrossegar fins aquí.
interface SunArcStrings {
    title: string; sunriseIn: string; sunsetIn: string; noData: string; sunrise: string; sunset: string;
    daylight: string; now: string; below: string; polarDay: string; polarNight: string;
    longer: string; shorter: string; same: string;
}
const SUN_ARC_TEXT: Readonly<Record<Language, SunArcStrings>> = {
    ca: {
        title: 'CICLE SOLAR', sunriseIn: 'Sortida en', sunsetIn: 'Posta de sol en', noData: 'SENSE DADES',
        sunrise: 'Sortida', sunset: 'Posta', daylight: 'Llum', now: 'Ara', below: "sota l'horitzó",
        polarDay: 'Sol de mitjanit', polarNight: 'Nit polar', longer: 'més que ahir', shorter: 'menys que ahir', same: 'Igual que ahir',
    },
    es: {
        title: 'CICLO SOLAR', sunriseIn: 'Salida del sol en', sunsetIn: 'Puesta de sol en', noData: 'SIN DATOS',
        sunrise: 'Salida', sunset: 'Puesta', daylight: 'Luz', now: 'Ahora', below: 'bajo el horizonte',
        polarDay: 'Sol de medianoche', polarNight: 'Noche polar', longer: 'más que ayer', shorter: 'menos que ayer', same: 'Igual que ayer',
    },
    en: {
        title: 'SUN CYCLE', sunriseIn: 'Sunrise in', sunsetIn: 'Sunset in', noData: 'NO DATA',
        sunrise: 'Sunrise', sunset: 'Sunset', daylight: 'Daylight', now: 'Now', below: 'below the horizon',
        polarDay: 'Midnight sun', polarNight: 'Polar night', longer: 'longer than yesterday', shorter: 'shorter than yesterday', same: 'Same as yesterday',
    },
    fr: {
        title: 'CYCLE SOLAIRE', sunriseIn: 'Lever du soleil dans', sunsetIn: 'Coucher du soleil dans', noData: 'PAS DE DONNÉES',
        sunrise: 'Lever', sunset: 'Coucher', daylight: 'Jour', now: 'Maintenant', below: "sous l'horizon",
        polarDay: 'Soleil de minuit', polarNight: 'Nuit polaire', longer: "de plus qu'hier", shorter: "de moins qu'hier", same: 'Identique à hier',
    },
};

interface SunArcWidgetProps {
    lang: Language;
    lat?: number;
    lon?: number;
    /** Fus IANA d'Open-Meteo; sense, el desplaçament fix. */
    timezone?: string | null;
    /** utc_offset_seconds d'Open-Meteo. */
    utcOffset?: number;
    /** daily d'Open-Meteo: les seves hores de sortida i posta (si quadren amb l'astronomia) són les que es mostren. */
    daily?: SolarDaily;
}

const pct = (v: number, of: number) => `${Math.round((v / of) * 10000) / 100}%`;
const LAB = 'text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500';

/** Hora de sortida/posta amb el "+1"/"−1" si cau en un altre dia local (dies polars o latituds altes). */
const EdgeTime = ({ tt }: { tt: TimeText | null }) => (
    <>
        {tt?.text ?? '—'}
        {tt && tt.shift !== 0 && <sup className="ml-0.5 text-[10px] text-slate-400">{tt.shift > 0 ? '+1' : `${MINUS}1`}</sup>}
    </>
);

export const SunArcWidget = ({ lang, lat, lon, timezone, utcOffset, daily }: SunArcWidgetProps) => {
    const text = SUN_ARC_TEXT[lang] ?? SUN_ARC_TEXT.ca;
    const uid = `sa${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;

    // Rellotge alineat amb el canvi de minut: les hores d'Open-Meteo són minuts sencers i el compte enrere
    // arrodoneix avall, així que només canvia a hh:mm:00. Es guarda l'instant real (ms): amb els segons
    // arrodonits, a hh:mm:00 la targeta marcava un minut més que el modal durant tot el minut.
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

    // --- Derivats d'ara (un cop per minut) ---
    const sunNow = pos ? SunCalc.getPosition(new Date(nowMs), la, lo) : null;   // suncalc 2: graus, azimut des del nord
    const geoNow = sunNow ? geometricAltitude(sunNow.altitude) : -90;
    const tone = markerTone(geoNow);
    const night = geoNow < CARD_STARS_GEO;
    const stars = useMemo(() => (model && geom && night ? sunCardStars(model, geom.yH) : ''), [model, geom, night]);

    // Compte enrere idèntic al del modal (upcomingRiseSet + format arrodonit avall): abans de sortir, la sortida;
    // de dia, la posta; després, la sortida real de demà. Dies polars: cap.
    const upcoming = model ? upcomingRiseSet(nowMs, model, neighbours.tomorrow, neighbours.yesterday) : null;
    const countdown = upcoming ? formatCountdown(upcoming.ms - nowMs) : null;

    // Δ de la durada respecte d'ahir: astronòmica (suncalc), la mateixa definició que el modal.
    const astroLen = model ? model.astroLengthSec : null;
    const deltaSec = astroLen !== null && neighbours.prevAstro !== null ? astroLen - neighbours.prevAstro : null;
    const delta = deltaSec === null ? null : formatDeltaLong(deltaSec);

    const nowMin = model ? (nowMs - model.startMs) / 60000 : null;
    const marker = geom && model && sunNow && nowMin !== null && nowMin >= 0 && nowMin <= model.spanMin
        ? { x: geom.x(nowMin), y: geom.y(sunNow.altitude) } : null;
    const skyStyle: CSSProperties | undefined = geom ? { backgroundImage: sunCardSky(geoNow, geom.yH) } : undefined;
    const noonClock = model?.text.noon?.text ?? null;

    const cdIsSunset = upcoming?.kind === 'sunset';
    const polarText = model?.polar === 'day' ? text.polarDay : model?.polar === 'night' ? text.polarNight : null;

    return (
        <div className={`${WIDGET_BASE_STYLE} select-none`}>
            {/* Capçalera: títol i compte enrere */}
            <div className="flex items-center justify-between gap-2 min-h-[28px] relative z-10">
                <span className={`${TITLE_STYLE.replace('mb-4', 'mb-0')} min-w-0`}>
                    {pos ? <Sun className="w-4 h-4 text-amber-400 shrink-0" aria-hidden="true" /> : <CloudOff className="w-4 h-4 text-slate-500 shrink-0" aria-hidden="true" />}
                    <span className="tracking-wider text-slate-200 truncate">{text.title}</span>
                </span>
                {!pos ? (
                    <span className="shrink-0 rounded-full border border-white/10 bg-black/30 px-2.5 py-1 text-[11px] font-bold text-slate-500">{text.noData}</span>
                ) : countdown ? (
                    <span className={`shrink-0 inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-black/30 px-2.5 py-1 text-[12px] font-semibold ${cdIsSunset ? 'text-amber-200' : 'text-indigo-200'}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${cdIsSunset ? 'bg-amber-400' : 'bg-indigo-400'}`} aria-hidden="true" />
                        <span>{cdIsSunset ? text.sunsetIn : text.sunriseIn}</span>
                        <span className="font-mono tabular-nums">{countdown}</span>
                    </span>
                ) : null}
            </div>

            {/* Gràfic: cel d'ara, corba real del dia i el sol a la seva posició */}
            <div className="relative mt-3 h-[140px] sm:h-[150px] rounded-2xl overflow-hidden border border-white/[0.06] bg-[#0c0f17]" style={skyStyle}>
                {geom && model && (
                    <>
                        <svg viewBox={`0 0 ${CARD_W} ${CARD_H}`} preserveAspectRatio="none" className="absolute inset-0 w-full h-full" aria-hidden="true" focusable="false">
                            <defs>
                                <clipPath id={`${uid}d`}><rect x="0" y={geom.clip.day.y} width={CARD_W} height={geom.clip.day.h} /></clipPath>
                                <clipPath id={`${uid}g`}><rect x="0" y={geom.clip.gold.y} width={CARD_W} height={geom.clip.gold.h} /></clipPath>
                                <clipPath id={`${uid}b`}><rect x="0" y={geom.clip.blue.y} width={CARD_W} height={geom.clip.blue.h} /></clipPath>
                                <clipPath id={`${uid}p`}><rect x="0" y="-10" width={marker ? Math.max(0, marker.x) : 0} height={CARD_H + 20} /></clipPath>
                            </defs>
                            {stars && <path d={stars} fill="#e2e8f0" fillOpacity=".55" />}
                            <line x1="0" x2={CARD_W} y1={geom.yH} y2={geom.yH} stroke="#cbd5e1" strokeOpacity=".35" vectorEffect="non-scaling-stroke" />
                            {geom.ticks.map(tk => (
                                <line key={tk.label} x1={tk.x} x2={tk.x} y1={geom.yH} y2={geom.yH + 4} stroke="#cbd5e1" strokeOpacity=".45" vectorEffect="non-scaling-stroke" />
                            ))}
                            {geom.noon && (
                                <line x1={geom.noon.x} x2={geom.noon.x} y1={geom.noon.y + 3} y2={geom.yH} stroke="#fde68a" strokeOpacity=".3" strokeDasharray="1 3" vectorEffect="non-scaling-stroke" />
                            )}
                            <path d={geom.curve} fill="none" stroke="#05070f" strokeOpacity=".5" strokeWidth="5.5" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
                            {/* El tram per recórrer, apagat; el recorregut (fins al sol), a tot color */}
                            {[0.4, 1].map(op => (
                                <g key={op} opacity={op} clipPath={op === 1 ? `url(#${uid}p)` : undefined}>
                                    <path d={geom.curve} fill="none" stroke="#818cf8" strokeOpacity=".7" strokeWidth="1.75" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
                                    <path d={geom.curve} fill="none" stroke="#60a5fa" strokeWidth="2.5" strokeLinejoin="round" clipPath={`url(#${uid}b)`} vectorEffect="non-scaling-stroke" />
                                    <path d={geom.curve} fill="none" stroke="#f59e0b" strokeWidth="2.75" strokeLinejoin="round" clipPath={`url(#${uid}g)`} vectorEffect="non-scaling-stroke" />
                                    <path d={geom.curve} fill="none" stroke="#fcd34d" strokeWidth="2.5" strokeLinejoin="round" clipPath={`url(#${uid}d)`} vectorEffect="non-scaling-stroke" />
                                </g>
                            ))}
                        </svg>

                        {/* Capa HTML en %: cercles i textos sense deformar-se quan l'SVG s'estira */}
                        <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
                            {geom.ticks.map(tk => (
                                <span key={tk.label} className="absolute -translate-x-1/2 font-mono text-[10px] leading-none text-slate-400/80"
                                    style={{ left: pct(tk.x, CARD_W), top: pct(geom.yH + 7, CARD_H) }}>{tk.label}</span>
                            ))}
                            {geom.noon && (
                                <span className="absolute -translate-x-1/2 -translate-y-full whitespace-nowrap text-[10.5px] leading-none text-amber-200/90"
                                    style={{ left: pct(geom.noon.x, CARD_W), top: pct(geom.noon.y - 4, CARD_H) }}>
                                    {degText(model.noonAltApp)}{noonClock && <> · <span className="font-mono">{noonClock}</span></>}
                                </span>
                            )}
                            {[geom.riseX, geom.setX].map((x, i) => x !== null && (
                                <span key={i} className={`absolute w-[7px] h-[7px] -translate-x-1/2 -translate-y-1/2 rounded-full border-[1.5px] border-[#0c0f17] ${i === 0 ? 'bg-amber-400' : 'bg-indigo-300'}`}
                                    style={{ left: pct(x, CARD_W), top: pct(geom.yH, CARD_H) }} />
                            ))}
                            {marker && tone !== 'below' && (
                                <span className="absolute border-l border-dashed border-amber-200/40"
                                    style={{ left: pct(marker.x, CARD_W), top: pct(marker.y, CARD_H), height: pct(Math.max(0, geom.yH - marker.y), CARD_H) }} />
                            )}
                            {marker && (
                                <span data-testid="sun-card-marker" data-x={Math.round(marker.x * 10) / 10}
                                    className="absolute -translate-x-1/2 -translate-y-1/2 flex items-center justify-center"
                                    style={{ left: pct(marker.x, CARD_W), top: `${Math.min(95, (marker.y / CARD_H) * 100)}%` }}>
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

                        {sunNow && (
                            <span className="absolute left-2 top-2 rounded-full bg-[rgba(5,7,15,0.6)] px-2.5 py-[3px] text-[11px] leading-4 text-slate-200 whitespace-nowrap">
                                <span className="text-slate-400">{text.now}</span>{' '}
                                <span className="font-mono">{signedDeg(sunNow.altitude)}</span>
                                {' · '}
                                {tone === 'below' ? text.below : <span className="font-mono">{azText(sunNow.azimuth, lang)}</span>}
                            </span>
                        )}
                    </>
                )}
            </div>

            {/* Peu: sortida · durada · posta */}
            <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-end gap-2 mt-3 relative z-10">
                <div className="min-w-0">
                    <div className={LAB}>{text.sunrise}</div>
                    <div className="font-mono tabular-nums text-[22px] sm:text-[24px] font-bold leading-tight text-amber-200">
                        {model ? <EdgeTime tt={model.riseLabel} /> : '--:--'}
                    </div>
                    <div className="font-mono text-[12px] text-slate-400 truncate">{model ? azText(model.riseAz, lang) : ''}</div>
                </div>
                <div className="text-center">
                    <div className={LAB}>{text.daylight}</div>
                    <div className="font-mono tabular-nums text-[16px] font-bold leading-snug text-slate-100">{model ? formatHoursMinutes(model.dayLengthSec) : '--'}</div>
                    <div className="text-[12px] whitespace-nowrap">
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
                    <div className={LAB}>{text.sunset}</div>
                    <div className="font-mono tabular-nums text-[22px] sm:text-[24px] font-bold leading-tight text-indigo-200">
                        {model ? <EdgeTime tt={model.setLabel} /> : '--:--'}
                    </div>
                    <div className="font-mono text-[12px] text-slate-400 truncate">{model ? azText(model.setAz, lang) : ''}</div>
                </div>
            </div>
        </div>
    );
};
