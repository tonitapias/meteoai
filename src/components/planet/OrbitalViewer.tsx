// src/components/planet/OrbitalViewer.tsx
// «Mira-ho des de l'òrbita»: el visor orbital d'«Extrems del planeta», amb tres ulls geoestacionaris (Meteosat-12 a
// 0°, GOES-19 a 75,2° O i Himawari-9 a 140,7° E). Sobre la imatge real del disc hi ha marcats els ciclons, els
// rècords de les estacions, els incendis i les inundacions per país i els volcans; tocar un cicló n'obre la fitxa.
// Es baixa a part, només si s'obre. Sense blur, filtres ni animacions en bucle (mòbils modestos): el disc és una
// imatge, els marcadors són SVG estàtics i l'únic moviment és l'aparició de la imatge.
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import type { Language } from '../../translations';
import { getSafeLocale, type WeatherUnit } from '../../utils/formatters';
import type { PlanetExtremes, StationRecord } from '../../services/planetExtremesApi';
import { KMH_PER_KT, countryName, placeLabel, type CycloneSummary } from '../../utils/planetExtremes';
import {
    ORBIT_EYES, LABEL_HEIGHT, discPoint, eyeInfo, labelWidth, nearestEye, placeLabels, type DiscPoint, type OrbitEye,
} from '../../utils/orbitalView';
import { useOrbitalImage, type OrbitalImage } from '../../hooks/useOrbitalImage';
import { fill, type PlanetStrings } from './planetI18n';
import { hpaText, kmhText, tempText } from './planetFormat';
import { cycloneTone } from './planetTones';
import { CycloneIcon } from './CycloneIcon';
import { RECORD_COLORS, buildOrbitMarkers, capPerKind, cycloneLabel, type OrbitMarker, type RecordKey } from './orbitalMarkers';

interface OrbitalViewerProps {
    data: PlanetExtremes;
    summaries: CycloneSummary[];
    eye: OrbitEye;
    onEyeChange: (eye: OrbitEye) => void;
    s: PlanetStrings;
    lang: Language;
    unit: WeatherUnit;
    place: { name: string; lat: number; lon: number } | null;
    onBack: () => void;
    onClose: () => void;
    onOpenCyclone: (id: string) => void;
}

const EYE_NAMES: Record<OrbitEye, string> = { meteosat: 'Meteosat', goes: 'GOES', himawari: 'Himawari' };
const IMAGE_CREDITS: Record<OrbitEye, string> = { meteosat: 'EUMETSAT', goes: 'NOAA · NASA GIBS', himawari: 'JMA · NASA GIBS' };
// El disc ocupa el 90 % del quadre: la resta és per a l'halo de l'atmosfera i per a les etiquetes de la vora.
const DISC_INSET = 0.05;

const lonText = (lon: number, lang: Language) => {
    if (lon === 0) return '0°';
    const value = Math.abs(lon).toLocaleString(getSafeLocale(lang), { maximumFractionDigits: 1 });
    return `${value}° ${lon > 0 ? 'E' : lang === 'en' ? 'W' : 'O'}`;
};

const utcTime = (ms: number) => `${new Date(ms).toISOString().slice(11, 16)} UTC`;

export default function OrbitalViewer({ data, summaries, eye, onEyeChange, s, lang, unit, place, onBack, onClose, onOpenCyclone }: OrbitalViewerProps) {
    const info = eyeInfo(eye);
    const image = useOrbitalImage(eye);
    const titleId = useId();
    const backRef = useRef<HTMLButtonElement>(null);

    // En obrir el visor, el focus hi entra (el botó que l'ha obert ja no es veu).
    useEffect(() => backRef.current?.focus(), []);

    const markers = useMemo(() => buildOrbitMarkers({ data, summaries, s, lang, unit, place }), [data, summaries, s, lang, unit, place]);
    const visible = useMemo(
        () => capPerKind(markers.flatMap((marker) => {
            const point = discPoint(marker.lat, marker.lon, info.subLon);
            return point ? [{ marker, point }] : [];
        })),
        [markers, info.subLon],
    );
    const inView = (lat: number, lon: number) => discPoint(lat, lon, info.subLon) !== null;

    // El cicló més intens, si aquest ull no el veu: un botó porta a l'ull que el té al centre.
    const strongest = summaries.find((summary) => summary.category >= 1);
    const elsewhere = strongest && !inView(strongest.last.lat, strongest.last.lon)
        ? { summary: strongest, eye: nearestEye(strongest.last.lat, strongest.last.lon) }
        : null;

    const cyclonesHere = summaries.filter((summary) => inView(summary.last.lat, summary.last.lon));
    const recordsHere = visible.filter((v) => v.marker.kind === 'record');
    const firesHere = (data.events?.fires.byCountry ?? []).filter((c) => c.lat !== undefined && c.lon !== undefined && inView(c.lat, c.lon));
    const floodsHere = (data.events?.floods.byCountry ?? []).filter((c) => c.lat !== undefined && c.lon !== undefined && inView(c.lat, c.lon));
    const volcanoesHere = (data.events?.volcanoes ?? []).filter((v) => v.lat !== undefined && v.lon !== undefined && inView(v.lat, v.lon));
    const nothingHere = cyclonesHere.length + recordsHere.length + firesHere.length + floodsHere.length + volcanoesHere.length === 0;

    const satLine = [info.satellite, lonText(info.subLon, lang), image.status === 'ready' && image.timeMs !== null ? utcTime(image.timeMs) : null]
        .filter(Boolean).join(' · ');

    return (
        <div className="absolute inset-0 z-30 flex flex-col bg-[#010208] text-slate-100" aria-labelledby={titleId} role="region">
            <div className="shrink-0 flex items-center justify-between gap-2 px-4 pt-4 pb-3 md:px-6">
                <button
                    ref={backRef}
                    type="button"
                    onClick={onBack}
                    className="inline-flex min-h-[44px] items-center gap-1 rounded-xl border border-slate-200/25 bg-[#0c0f17]/60 pl-2 pr-3.5 text-sm font-medium text-slate-200 cursor-pointer transition-colors hover:bg-white/[0.06] focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-200/60"
                >
                    <ChevronLeft aria-hidden="true" className="w-5 h-5" />{s.title}
                </button>
                <div className="flex items-center gap-2">
                    <span id={titleId} className="hidden min-[360px]:inline font-mono text-[10px] uppercase tracking-[0.16em] text-slate-300">{s.orbitTitle}</span>
                    <button type="button" onClick={onClose} aria-label={s.close} className="flex h-11 w-11 items-center justify-center rounded-full border border-white/10 text-slate-400 cursor-pointer transition-colors hover:bg-white/10 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-200/60">
                        <X aria-hidden="true" className="w-5 h-5" />
                    </button>
                </div>
            </div>

            <div role="group" aria-label={s.eyesLabel} className="shrink-0 mx-4 md:mx-6 grid grid-cols-3 gap-[3px] rounded-[14px] border border-slate-200/15 bg-[#0c0f17]/70 p-[3px]">
                {ORBIT_EYES.map((option) => (
                    <button
                        key={option.id}
                        type="button"
                        aria-pressed={option.id === eye}
                        onClick={() => onEyeChange(option.id)}
                        className={`min-h-[38px] rounded-[11px] text-[13px] cursor-pointer transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-200/60 ${option.id === eye ? 'border border-amber-200/60 bg-amber-200/[0.14] font-bold text-amber-200' : 'font-medium text-slate-300 hover:text-white'}`}
                    >
                        {EYE_NAMES[option.id]}
                    </button>
                ))}
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
                <div className="mx-auto flex max-w-xl flex-col gap-4 px-4 pb-6 pt-2 md:px-6">
                    <OrbitDisc
                        key={eye}
                        image={image}
                        visible={visible}
                        alt={fill(s.discAlt, { sat: info.satellite })}
                        s={s}
                        onOpenCyclone={onOpenCyclone}
                    />

                    <div className="flex flex-col gap-1.5 px-1">
                        <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-amber-200">{satLine}</span>
                        <h3 className="text-[22px] font-semibold leading-tight tracking-tight text-white">{s.orbitLead}</h3>
                        {image.status === 'loading' && <p className="text-[13px] text-slate-400">{s.imageLoading}</p>}
                        {image.status === 'failed' && <p className="text-[13px] text-slate-400">{s.imageFailed}</p>}
                        {image.status === 'ready' && image.product === 'ir' && <p className="text-[13px] leading-snug text-slate-400">{s.infrared}</p>}
                    </div>

                    {elsewhere && (
                        <button
                            type="button"
                            onClick={() => onEyeChange(elsewhere.eye)}
                            className={`flex min-h-[56px] items-center gap-2.5 rounded-[14px] border px-3 py-2.5 text-left cursor-pointer transition-colors hover:bg-white/[0.05] focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-200/60 ${cycloneTone(elsewhere.summary).border} ${cycloneTone(elsewhere.summary).bg}`}
                        >
                            <span aria-hidden="true" className="flex h-8 w-8 flex-none items-center justify-center rounded-[10px] bg-black/30">
                                <CycloneIcon className={`w-4 h-4 ${cycloneTone(elsewhere.summary).icon}`} />
                            </span>
                            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                                <span className="text-[13.5px] font-semibold text-white">{s.elsewhereLead}</span>
                                <span className={`text-xs ${cycloneTone(elsewhere.summary).text}`}>
                                    {fill(s.elsewhere, { what: cycloneLabel(elsewhere.summary, s), eye: EYE_NAMES[elsewhere.eye] })}
                                </span>
                            </span>
                            <ChevronRight aria-hidden="true" className={`w-[18px] h-[18px] ${cycloneTone(elsewhere.summary).icon}`} />
                        </button>
                    )}

                    {!nothingHere && <h4 className="px-1 text-[11px] font-black uppercase tracking-[0.14em] text-white">{s.inView}</h4>}
                    {nothingHere && <p className="px-1 text-[13px] text-slate-400">{s.nothingInView}</p>}

                    {cyclonesHere.map((summary) => {
                        const tone = cycloneTone(summary);
                        const parts = [
                            summary.category >= 1 ? fill(s.category, { n: summary.category }) : null,
                            kmhText(summary.last.windKt * KMH_PER_KT),
                            s.basins[summary.basin],
                        ].filter(Boolean);
                        return (
                            <button
                                key={summary.cyclone.id}
                                type="button"
                                onClick={() => onOpenCyclone(summary.cyclone.id)}
                                className={`flex min-h-[52px] items-center gap-2.5 rounded-xl border px-2.5 py-2 text-left cursor-pointer transition-colors hover:bg-white/[0.05] focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-200/60 ${tone.border} ${tone.bg}`}
                            >
                                <span aria-hidden="true" className="flex h-8 w-8 flex-none items-center justify-center rounded-[10px] bg-black/30"><CycloneIcon className={`w-4 h-4 ${tone.icon}`} /></span>
                                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                                    <span className="text-[13.5px] font-semibold text-white">{`${s.kinds[summary.kind]} ${summary.cyclone.name}`}</span>
                                    <span className={`text-xs ${tone.text}`}>{parts.join(' · ')}</span>
                                </span>
                                <ChevronRight aria-hidden="true" className={`w-[18px] h-[18px] ${tone.icon}`} />
                            </button>
                        );
                    })}

                    {recordsHere.length > 0 && data.metar && (
                        <div className="flex flex-col gap-2 rounded-2xl border border-white/[0.08] bg-white/[0.04] p-3">
                            {recordsHere.map(({ marker }) => {
                                const key = marker.record as RecordKey;
                                const record = recordOf(data, key);
                                if (!record) return null;
                                return (
                                    <div key={marker.id} className="flex items-center justify-between gap-3 text-[13px]">
                                        <span className="flex min-w-0 items-center gap-2">
                                            <svg aria-hidden="true" viewBox="-6 -6 12 12" className="h-3 w-3 flex-none"><rect x={-3.6} y={-3.6} width={7.2} height={7.2} transform="rotate(45)" fill={RECORD_COLORS[key].hex} /></svg>
                                            <span className="text-slate-200 shrink-0">{recordTitle(key, s)}</span>
                                            <span className="min-w-0 truncate text-slate-400">{placeLabel(record, lang)}</span>
                                        </span>
                                        <span className="shrink-0 font-semibold tabular-nums text-white">{recordValue(key, record, unit, lang)}</span>
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {(firesHere.length > 0 || floodsHere.length > 0 || volcanoesHere.length > 0) && (
                        <div className="flex flex-col gap-2 rounded-2xl border border-white/[0.08] bg-white/[0.04] p-3 text-[13px] leading-snug">
                            {firesHere.length > 0 && (
                                <p className="text-slate-300"><span className="font-semibold text-orange-200">{s.firesTitle}:</span> {firesHere.map((c) => `${countryName(c.country, lang) ?? c.country} (${c.count})`).join(', ')}</p>
                            )}
                            {floodsHere.length > 0 && (
                                <p className="text-slate-300"><span className="font-semibold text-amber-200">{s.floodsTitle}:</span> {floodsHere.map((c) => `${countryName(c.country, lang) ?? c.country} (${c.count})`).join(', ')}</p>
                            )}
                            {volcanoesHere.length > 0 && (
                                <p className="text-slate-300"><span className="font-semibold text-red-200">{s.volcanoesTitle}:</span> {volcanoesHere.map((v) => v.name).join(', ')}</p>
                            )}
                        </div>
                    )}

                    <p className="px-1 font-mono text-[10px] uppercase tracking-[0.06em] text-slate-400">{s.imageCredit}: {IMAGE_CREDITS[eye]}</p>
                </div>
            </div>
        </div>
    );
}

const recordOf = (data: PlanetExtremes, key: RecordKey): StationRecord | undefined => {
    const metar = data.metar;
    if (!metar) return undefined;
    return { hottest: metar.hottest, coldest: metar.coldest, wetBulb: metar.wetBulb, gust: metar.gustKmh, lowPressure: metar.lowPressure }[key][0];
};

const recordTitle = (key: RecordKey, s: PlanetStrings): string =>
    ({ hottest: s.hottest, coldest: s.coldest, wetBulb: s.wetBulb, gust: s.gust, lowPressure: s.lowPressure })[key];

const recordValue = (key: RecordKey, record: StationRecord, unit: WeatherUnit, lang: Language): string => {
    switch (key) {
        case 'wetBulb': return tempText(record.value, unit, lang, 1);
        case 'gust': return kmhText(record.value);
        case 'lowPressure': return hpaText(record.value);
        default: return tempText(record.value, unit, lang);
    }
};

// --- El disc --------------------------------------------------------------------------------------------

interface OrbitDiscProps {
    image: OrbitalImage;
    visible: { marker: OrbitMarker; point: DiscPoint }[];
    alt: string;
    s: PlanetStrings;
    onOpenCyclone: (id: string) => void;
}

/** Radi del marcador (px) a efectes de no tapar-lo amb una etiqueta. */
const markerRadius = (marker: OrbitMarker) =>
    marker.kind === 'cyclone' ? ((marker.category ?? 0) >= 3 ? 15 : 11) : 8;

function OrbitDisc({ image, visible, alt, s, onOpenCyclone }: OrbitDiscProps) {
    // Mida del quadre (px), per col·locar les etiquetes; es mesura en enganxar-lo i quan canvia de debò.
    const [size, setSize] = useState(0);
    const attachBox = useCallback((el: HTMLDivElement | null) => {
        if (!el) return;
        const apply = () => setSize((prev) => (prev === el.clientWidth ? prev : el.clientWidth));
        apply();
        if (typeof ResizeObserver === 'function') {
            const observer = new ResizeObserver(apply);
            observer.observe(el);
            return () => observer.disconnect();
        }
        window.addEventListener('resize', apply);
        return () => window.removeEventListener('resize', apply);
    }, []);
    const [shownSrc, setShownSrc] = useState<string | null>(null);

    const disc = size * (1 - 2 * DISC_INSET);
    const positioned = visible.map(({ marker, point }) => ({
        marker,
        x: size * DISC_INSET + disc * (0.5 + point.x / 2),
        y: size * DISC_INSET + disc * (0.5 - point.y / 2),
    }));
    const labels = size > 0
        ? placeLabels(positioned.map(({ marker, x, y }) => ({ x, y, w: labelWidth(marker.label), h: LABEL_HEIGHT, r: markerRadius(marker) })), size, size)
        : [];
    // Dibuix: primer els grups i el lloc, després els rècords i, a sobre de tot, els ciclons (que es poden tocar).
    const drawOrder = [...positioned].sort((a, b) => drawRank(a.marker) - drawRank(b.marker));

    return (
        <div ref={attachBox} className="relative w-full" style={{ paddingBottom: '100%' }}>
            <div className="absolute" style={{ inset: `${DISC_INSET * 100}%` }}>
                {/* L'atmosfera: un anell de llum a la vora, amb un degradat (cap filtre). */}
                <div aria-hidden="true" className="absolute -inset-[5.5%] rounded-full pointer-events-none" style={{ background: 'radial-gradient(closest-side, rgba(125,211,252,0) 86%, rgba(125,211,252,0.38) 92%, rgba(59,130,246,0.1) 96%, rgba(30,58,138,0) 100%)' }} />
                <div className="absolute inset-0 overflow-hidden rounded-full bg-[#081e3d]">
                    <Graticule />
                    {image.status === 'ready' && (
                        <img
                            key={image.src}
                            src={image.src}
                            alt={alt}
                            onLoad={() => setShownSrc(image.src)}
                            className="absolute inset-0 h-full w-full transition-opacity duration-700 motion-reduce:transition-none"
                            style={{ opacity: shownSrc === image.src ? 1 : 0 }}
                        />
                    )}
                    <div aria-hidden="true" className="absolute inset-0" style={{ background: 'radial-gradient(closest-side, rgba(0,0,0,0) 70%, rgba(0,0,0,0.16) 90%, rgba(0,0,0,0.38) 100%)' }} />
                </div>
                <div aria-hidden="true" className="absolute inset-0 rounded-full border border-sky-200/45 pointer-events-none" />
            </div>

            {size > 0 && drawOrder.map(({ marker, x, y }) => marker.kind === 'cyclone' && marker.cycloneId ? (
                <button
                    key={marker.id}
                    type="button"
                    onClick={() => onOpenCyclone(marker.cycloneId as string)}
                    aria-label={fill(s.openSheet, { what: marker.label })}
                    className="absolute z-10 flex h-11 w-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-200/70"
                    style={{ left: x, top: y }}
                >
                    <MarkerGlyph marker={marker} />
                </button>
            ) : (
                <span key={marker.id} aria-hidden="true" className="absolute flex -translate-x-1/2 -translate-y-1/2 pointer-events-none" style={{ left: x, top: y }}>
                    <MarkerGlyph marker={marker} />
                </span>
            ))}

            {size > 0 && positioned.map(({ marker }, i) => {
                const at = labels[i];
                if (!at) return null;
                return marker.kind === 'here' ? (
                    <span key={`label-${marker.id}`} aria-hidden="true" className="absolute z-20 whitespace-nowrap rounded-full bg-[#fde68a] px-2 text-[11px] font-bold leading-[22px] text-stone-900 pointer-events-none" style={{ left: at.left, top: at.top }}>
                        {marker.label}
                    </span>
                ) : (
                    <span key={`label-${marker.id}`} aria-hidden="true" className={`absolute z-20 whitespace-nowrap rounded-full border bg-[#0c0f17]/90 px-2 text-[11px] font-semibold leading-[20px] pointer-events-none ${marker.color.border} ${marker.color.text}`} style={{ left: at.left, top: at.top }}>
                        {marker.label}
                    </span>
                );
            })}
        </div>
    );
}

const drawRank = (marker: OrbitMarker) =>
    marker.kind === 'cyclone' ? 3 : marker.kind === 'record' ? 2 : marker.kind === 'here' ? 1 : 0;

const FLAME = 'M12 3c1 3 5 5 5 10a5 5 0 0 1-10 0c0-3 2-4 2-6 1 1 2 2 2 3 0-3 0-5 1-7z';
const WAVES = 'M3 10c2 0 2-1.5 4.5-1.5S9.5 10 12 10s2-1.5 4.5-1.5S18.5 10 21 10M3 15c2 0 2-1.5 4.5-1.5S9.5 15 12 15s2-1.5 4.5-1.5S18.5 15 21 15';

/** La forma diu què és; el color, com és d'intens (ciclons) o quin rècord és (estacions). */
function MarkerGlyph({ marker }: { marker: OrbitMarker }) {
    const { hex } = marker.color;
    switch (marker.kind) {
        case 'cyclone': {
            const strong = (marker.category ?? 0) >= 3;
            return (
                <svg aria-hidden="true" viewBox="-16 -16 32 32" className="h-8 w-8 overflow-visible">
                    {strong && <circle r={15} fill="none" stroke={hex} strokeOpacity={0.3} strokeWidth={1.2} />}
                    <circle r={11} fill="none" stroke={hex} strokeOpacity={0.45} strokeWidth={1.5} />
                    <circle r={7.5} fill="#0c0f17" stroke={hex} strokeWidth={2} />
                    <g transform="translate(-5.4 -5.4) scale(0.45)" fill="none" stroke={hex} strokeWidth={2.6} strokeLinecap="round">
                        <circle cx={12} cy={12} r={2.5} />
                        <path d="M5 9a8 8 0 0 1 12-4M19 15a8 8 0 0 1-12 4" />
                    </g>
                </svg>
            );
        }
        case 'record':
            return (
                <svg aria-hidden="true" viewBox="-8 -8 16 16" className="h-4 w-4 overflow-visible">
                    <rect x={-4.6} y={-4.6} width={9.2} height={9.2} transform="rotate(45)" fill={hex} stroke="#0c0f17" strokeWidth={1.5} />
                </svg>
            );
        case 'here':
            return (
                <svg aria-hidden="true" viewBox="-10 -10 20 20" className="h-5 w-5 overflow-visible">
                    <circle r={8} fill="none" stroke={hex} strokeOpacity={0.6} strokeWidth={1.5} />
                    <circle r={3.6} fill={hex} stroke="#0c0f17" strokeWidth={1.2} />
                </svg>
            );
        case 'volcano':
            return (
                <svg aria-hidden="true" viewBox="-10 -10 20 20" className="h-5 w-5 overflow-visible">
                    <path d="M-7 5.5L0 -6.5L7 5.5Z" fill={hex} stroke="#0c0f17" strokeWidth={1.5} strokeLinejoin="round" />
                </svg>
            );
        default:
            return (
                <svg aria-hidden="true" viewBox="-10 -10 20 20" className="h-5 w-5 overflow-visible">
                    <circle r={8} fill="#0c0f17" stroke={hex} strokeWidth={1.8} />
                    <path
                        d={marker.kind === 'fires' ? FLAME : WAVES}
                        transform="translate(-5.5 -5.5) scale(0.46)"
                        fill={marker.kind === 'fires' ? hex : 'none'}
                        stroke={marker.kind === 'fires' ? 'none' : hex}
                        strokeWidth={2.6}
                        strokeLinecap="round"
                    />
                </svg>
            );
    }
}

/**
 * Meridians i paral·lels cada 30°, en la mateixa projecció que la imatge: el que es veu mentre la imatge arriba,
 * o si no arriba. En aquesta vista, cada parell de meridians ±Δλ és una el·lipse de semieix sin Δλ.
 */
function Graticule() {
    const parallels = [-60, -30, 0, 30, 60].map((lat) => ({ y: -Math.sin((lat * Math.PI) / 180), half: Math.cos((lat * Math.PI) / 180) }));
    const meridians = [30, 60].map((dLon) => Math.sin((dLon * Math.PI) / 180));
    return (
        <svg aria-hidden="true" viewBox="-1 -1 2 2" className="absolute inset-0 h-full w-full">
            <g fill="none" stroke="#7dd3fc" strokeOpacity={0.22} strokeWidth={0.006}>
                {parallels.map(({ y, half }) => <line key={y} x1={-half} x2={half} y1={y} y2={y} />)}
                <line x1={0} x2={0} y1={-1} y2={1} />
                {meridians.map((rx) => <ellipse key={rx} rx={rx} ry={1} />)}
            </g>
        </svg>
    );
}
