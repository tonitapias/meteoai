// src/components/planet/PlanetExtremesModal.tsx
// Detall d'«Extrems del planeta». Pestanya de rècords: el bulb humit (els tres més alts), «Per què aquí?»
// (fets físics calculats a partir de les dades, no frases fixes) i el control de qualitat. Pestanya de
// fenòmens: ciclons tropicals, incendis grans, inundacions i volcans, amb la fitxa de cada cicló (corba
// d'intensitat real, intensificació ràpida, moviment i avís oficial). Cada pestanya acaba amb «Mira-ho des de
// l'òrbita», que obre el visor orbital (OrbitalViewer, que es baixa a part) a l'ull que toca.
import { lazy, Suspense, useEffect, useMemo, useRef, useState, type Ref } from 'react';
import { X, Globe, Sun, Snowflake, Wind, Flame, Waves, Mountain, ChevronLeft, ChevronRight, ExternalLink, CloudOff, Satellite } from 'lucide-react';
import type { Language } from '../../translations';
import { getSafeLocale, type WeatherUnit } from '../../utils/formatters';
import { distanceKm } from '../../utils/geoDistance';
import { MATRIX_BG } from '../widgets/widgetStyles';
import { astroSheetVars, SHEET_HALO, sheetHaloStyle } from '../astroModalStyles';
import { useAstroModalShell } from '../../hooks/useAstroModalShell';
import { usePlanetExtremes } from '../../hooks/usePlanetExtremes';
import type { MetarRecords, PlanetEvents, CountryCount } from '../../services/planetExtremesApi';
import {
    summarizeCyclone, compassIndex, solarTime, solarPeriod, isPolarNight, placeLabel, placeInline, countryName, formatInteger,
    KMH_PER_KT, CATEGORY_THRESHOLDS_KMH, RAPID_INTENSIFICATION_KT, OFFICIAL_CENTRE,
    MOUNTAIN_ELEVATION_M, DEEP_LOW_HPA, WET_BULB_DANGER_C, type CycloneSummary, type PlanetTab,
} from '../../utils/planetExtremes';
import { PLANET_STRINGS, fill, type PlanetStrings } from './planetI18n';
import { CycloneIcon, WetBulbBar } from './PlanetBits';
import { tempText, kmhText, hpaText } from './planetFormat';
import { TONES, cycloneTone } from './planetTones';
import { initialEye, type OrbitEye } from '../../utils/orbitalView';

const OrbitalViewer = lazy(() => import('./OrbitalViewer'));

interface PlanetExtremesModalProps {
    lang: Language;
    unit: WeatherUnit;
    initialTab: PlanetTab;
    // Lloc que mira l'usuari, per dir a quina distància és cada cicló.
    place: { name: string; lat: number; lon: number } | null;
    onClose: () => void;
}

const SHEET_GRADIENT = 'from-cyan-950/30 to-black/90';
const SHEET_VARS = astroSheetVars(SHEET_GRADIENT);
const HOUR_MS = 3600 * 1000;
// Una dada de cicló més vella que això es diu.
const STALE_CYCLONE_HOURS = 6;
const FIRE_COUNTRIES_SHOWN = 4;
const FLOOD_COUNTRIES_NAMED = 4;

const timeOf = (iso: string, lang: Language) =>
    new Date(iso).toLocaleTimeString(getSafeLocale(lang), { hour: '2-digit', minute: '2-digit' });

const cycloneTitle = (summary: CycloneSummary, s: PlanetStrings) => `${s.kinds[summary.kind]} ${summary.cyclone.name}`;

// `note`: el nom tècnic, petit i en gris al costat del planer ("Calor humida (bulb humit)").
const SectionTitle = ({ children, count, note }: { children: string; count?: string; note?: string }) => (
    <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-[11px] font-black uppercase tracking-[0.14em] text-white">
            {children}
            {note && <span className="font-mono font-medium normal-case tracking-normal text-slate-400">{` (${note})`}</span>}
        </h3>
        {count && <span className="font-mono text-[10px] text-slate-400">{count}</span>}
    </div>
);

const Card = ({ children, label }: { children: React.ReactNode; label: string }) => (
    <section aria-label={label} className="rounded-2xl border border-white/5 astro-card-fill p-4 flex flex-col gap-3">
        {children}
    </section>
);

const OrbitButton = ({ label, onClick, buttonRef }: { label: string; onClick: () => void; buttonRef: Ref<HTMLButtonElement> }) => (
    <button
        ref={buttonRef}
        type="button"
        onClick={onClick}
        className="flex w-full min-h-[52px] items-center justify-center gap-2 rounded-[14px] border border-amber-200/50 bg-amber-200/[0.08] text-[15px] font-semibold text-amber-200 cursor-pointer transition-colors hover:bg-amber-200/[0.14] focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-200/60"
    >
        <Satellite aria-hidden="true" className="w-[18px] h-[18px]" />{label}
    </button>
);

export default function PlanetExtremesModal({ lang, unit, initialTab, place, onClose }: PlanetExtremesModalProps) {
    const s = PLANET_STRINGS[lang] ?? PLANET_STRINGS.ca;
    const { handleClose, now } = useAstroModalShell(onClose);
    const { status, data } = usePlanetExtremes();
    const [tab, setTab] = useState<PlanetTab>(initialTab);
    const [cycloneId, setCycloneId] = useState<string | null>(null);
    // Visor orbital obert i l'ull que s'hi mira. Si s'hi obre la fitxa d'un cicló, tornar en surt cap al visor.
    const [orbitEye, setOrbitEye] = useState<OrbitEye | null>(null);
    const scrollRef = useRef<HTMLDivElement>(null);

    const summaries = useMemo(
        () => (data?.cyclones?.cyclones ?? []).map(summarizeCyclone).sort((a, b) => b.last.windKt - a.last.windKt),
        [data?.cyclones],
    );
    const selected = summaries.find((c) => c.cyclone.id === cycloneId) ?? null;
    const updatedAt = data?.metar?.updatedAt ?? data?.events?.updatedAt ?? data?.cyclones?.updatedAt ?? null;

    const openCyclone = (id: string | null) => {
        setCycloneId(id);
        scrollRef.current?.scrollTo({ top: 0 });
    };
    const openOrbit = () => {
        if (data) setOrbitEye(initialEye(tab, data, summaries));
    };
    // El visor tapa el detall: el que queda a sota no ha de rebre el focus, i el full no s'ha d'encongir fins a
    // l'alçada d'una pestanya curta.
    const orbitOpen = !!data && orbitEye !== null && !selected;
    // En tornar del visor, el focus torna al botó que l'ha obert.
    const orbitButtonRef = useRef<HTMLButtonElement>(null);
    const returnFocusRef = useRef(false);
    useEffect(() => {
        if (orbitEye !== null || !returnFocusRef.current) return;
        returnFocusRef.current = false;
        orbitButtonRef.current?.focus();
    }, [orbitEye]);
    const closeOrbit = () => {
        returnFocusRef.current = true;
        setOrbitEye(null);
    };

    return (
        <div role="dialog" aria-modal="true" aria-labelledby="planet-modal-title" className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 md:p-6 landscape:p-0 landscape:sm:p-4 bg-black">
            {/* Alçades en % de l'overlay i no en dvh, com la resta de fulls (motors sense dvh). */}
            <div className={`w-full h-[96%] sm:h-auto sm:max-h-[calc(90%+1.8rem)] md:max-h-[calc(90%+2.7rem)] landscape:h-full landscape:sm:h-auto landscape:sm:max-h-[calc(90%+1.8rem)] max-w-sm md:max-w-3xl flex flex-col ${orbitOpen ? 'min-h-0 sm:min-h-[min(46rem,90%)]' : 'min-h-0'} bg-gradient-to-b ${SHEET_GRADIENT} rounded-t-[24px] sm:rounded-[32px] border-t sm:border border-cyan-500/20 shadow-[0_0_100px_rgba(0,0,0,0.9)] overflow-hidden relative`} style={SHEET_VARS}>
                <div className={MATRIX_BG}></div>
                <div className={SHEET_HALO} style={sheetHaloStyle('cyan', 'slate')}></div>

                <div inert={orbitOpen} className="shrink-0 relative z-20 border-b border-white/[0.04]">
                    <div className="flex justify-between items-center p-4 md:p-6 pb-3 md:pb-4">
                        <div className="flex items-center gap-3">
                            <div className="relative flex items-center justify-center w-10 h-10 rounded-full border bg-black/40 border-cyan-500/30 text-cyan-300">
                                <Globe className="w-5 h-5" />
                            </div>
                            <div className="flex flex-col">
                                <h2 id="planet-modal-title" className="text-lg md:text-2xl font-black text-white tracking-tighter leading-none uppercase">{s.title}</h2>
                                {updatedAt && (
                                    <span className="text-[10px] md:text-xs text-slate-400 font-bold tracking-widest uppercase mt-0.5">{s.now} · {timeOf(updatedAt, lang)}</span>
                                )}
                            </div>
                        </div>
                        <button onClick={handleClose} aria-label={s.close} className="p-2.5 astro-card-fill border border-white/5 rounded-full text-slate-400 hover:bg-white/10 hover:text-white active:scale-90 transition-all duration-200 group relative">
                            <X className="w-5 h-5 group-hover:rotate-90 transition-transform duration-300" />
                        </button>
                    </div>
                    {!selected && (
                        <div role="tablist" aria-label={s.tabsLabel} className="mx-4 md:mx-6 mb-3 grid grid-cols-2 gap-1 rounded-xl border border-white/10 bg-black/40 p-1">
                            {(['records', 'events'] as const).map((key) => (
                                <button
                                    key={key}
                                    type="button"
                                    role="tab"
                                    id={`planet-tab-${key}`}
                                    aria-selected={tab === key}
                                    aria-controls="planet-tabpanel"
                                    onClick={() => setTab(key)}
                                    className={`min-h-[40px] rounded-lg text-[13px] cursor-pointer transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/60 ${tab === key ? 'border border-cyan-400/45 bg-cyan-500/[0.16] font-bold text-cyan-200' : 'font-medium text-slate-300 hover:text-white'}`}
                                >
                                    {key === 'records' ? s.tabRecords : s.tabEvents}
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                <div ref={scrollRef} inert={orbitOpen} className="flex-1 min-h-0 overflow-y-auto overscroll-contain relative z-10 p-4 md:p-6 space-y-4">
                    {status === 'loading' && <p className="text-sm text-slate-400">{s.loading}</p>}
                    {status === 'error' && (
                        <div className="flex flex-col items-center justify-center text-center gap-3 py-12 text-slate-400 text-sm">
                            <CloudOff className="w-10 h-10 text-slate-600" />
                            {s.unavailable}
                        </div>
                    )}
                    {data && selected && (
                        <CycloneSheet summary={selected} s={s} lang={lang} place={place} backLabel={orbitEye ? s.orbitTitle : s.back} onBack={() => openCyclone(null)} />
                    )}
                    {data && !selected && (
                        <div role="tabpanel" id="planet-tabpanel" aria-labelledby={`planet-tab-${tab}`} className="space-y-4">
                            {tab === 'records'
                                ? data.metar
                                    ? <RecordsTab metar={data.metar} summaries={summaries} s={s} lang={lang} unit={unit} />
                                    : <p className="text-sm text-slate-400">{s.unavailable}</p>
                                : <EventsTab events={data.events} summaries={summaries} hasCyclones={!!data.cyclones} s={s} lang={lang} nowMs={now.getTime()} onOpenCyclone={openCyclone} />}
                            <OrbitButton label={s.orbitOpen} onClick={openOrbit} buttonRef={orbitButtonRef} />
                        </div>
                    )}
                </div>

                {orbitOpen && orbitEye && (
                    <Suspense fallback={<div className="absolute inset-0 z-30 bg-[#010208]" />}>
                        <OrbitalViewer
                            data={data}
                            summaries={summaries}
                            eye={orbitEye}
                            onEyeChange={setOrbitEye}
                            s={s}
                            lang={lang}
                            unit={unit}
                            place={place}
                            onBack={closeOrbit}
                            onClose={handleClose}
                            onOpenCyclone={(id) => openCyclone(id)}
                        />
                    </Suspense>
                )}
            </div>
        </div>
    );
}

// --- Pestanya de rècords ------------------------------------------------------------------------------

interface RecordsTabProps {
    metar: MetarRecords;
    summaries: CycloneSummary[];
    s: PlanetStrings;
    lang: Language;
    unit: WeatherUnit;
}

interface WhyItem { key: string; icon: React.ReactNode; lead: string; text: string }

function RecordsTab({ metar, summaries, s, lang, unit }: RecordsTabProps) {
    const why: WhyItem[] = [];
    const hottest = metar.hottest[0];
    if (hottest) {
        why.push({
            key: 'hot', icon: <Sun className="w-[15px] h-[15px] text-orange-400" />, lead: s.whyHottestLead,
            text: fill(s.whyHottest[solarPeriod(hottest.time, hottest.lon)], { place: placeInline(hottest, lang), time: solarTime(hottest.time, hottest.lon) }),
        });
    }
    const coldest = metar.coldest[0];
    if (coldest && isPolarNight(coldest.lat, new Date(coldest.time))) {
        why.push({ key: 'cold', icon: <Snowflake className="w-[15px] h-[15px] text-sky-300" />, lead: s.whyPolarLead, text: fill(s.whyPolar, { place: placeInline(coldest, lang) }) });
    }
    const low = metar.lowPressure[0];
    const strongest = summaries[0];
    if (low && strongest && strongest.category >= 1) {
        why.push({
            key: 'low', icon: <CycloneIcon className="w-[15px] h-[15px] text-rose-400" />,
            lead: fill(s.whyLowCycloneLead, { ofCyclone: `${s.ofKinds[strongest.kind]} ${strongest.cyclone.name}` }),
            text: fill(s.whyLowCyclone, { p: hpaText(low.value), place: placeInline(low, lang) }),
        });
    } else if (low && low.value < DEEP_LOW_HPA) {
        why.push({ key: 'low', icon: <CycloneIcon className="w-[15px] h-[15px] text-violet-300" />, lead: fill(s.whyLowDeepLead, { p: hpaText(low.value), place: placeInline(low, lang) }), text: s.whyLowDeep });
    }
    const gust = metar.gustKmh[0];
    if (gust && gust.elevM !== null && gust.elevM >= MOUNTAIN_ELEVATION_M) {
        why.push({ key: 'gust', icon: <Wind className="w-[15px] h-[15px] text-indigo-300" />, lead: fill(s.whyGustLead, { v: kmhText(gust.value), elev: formatInteger(gust.elevM, lang) }), text: s.whyGust });
    }

    return (
        <>
            {metar.wetBulb.length > 0 && (
                <Card label={s.wetBulb}>
                    <SectionTitle count={s.top3} note={s.wetBulbNote}>{s.wetBulb}</SectionTitle>
                    <div className="flex flex-col gap-2.5">
                        {metar.wetBulb.map((record, i) => (
                            <div key={record.id} className="flex flex-col gap-1.5">
                                <div className="flex justify-between gap-3 text-[13px]">
                                    <span className="text-slate-200 min-w-0 truncate">{placeLabel(record, lang)}</span>
                                    <span className="font-bold tabular-nums text-white shrink-0">{tempText(record.value, unit, lang, 1)}</span>
                                </div>
                                <WetBulbBar valueC={record.value} unit={unit} lang={lang} tone={i === 0 ? 'strong' : 'soft'} labels={i === metar.wetBulb.length - 1 ? { danger: s.danger, limit: s.limit } : undefined} />
                            </div>
                        ))}
                    </div>
                    <p className="text-[13px] leading-relaxed text-slate-300">{fill(s.wetBulbExplain, { danger: tempText(WET_BULB_DANGER_C, unit, lang) })}</p>
                </Card>
            )}

            {why.length > 0 && (
                <Card label={s.whyHere}>
                    <SectionTitle>{s.whyHere}</SectionTitle>
                    {why.map((item) => (
                        <div key={item.key} className="flex gap-2.5 items-start">
                            <span aria-hidden="true" className="flex-none w-7 h-7 rounded-lg bg-white/[0.06] flex items-center justify-center">{item.icon}</span>
                            <p className="text-[13px] leading-snug text-slate-300">
                                <span className="font-semibold text-slate-100">{item.lead}</span> {item.text}
                            </p>
                        </div>
                    ))}
                </Card>
            )}

            <p className="px-1 text-[11.5px] leading-relaxed text-slate-400">
                <span className="font-semibold text-slate-300">{s.qcLead}</span>{' '}
                {fill(s.qc, { n: formatInteger(metar.stations, lang), d: formatInteger(metar.discarded, lang) })} {s.sourceMetar}
            </p>
        </>
    );
}

// --- Pestanya de fenòmens -----------------------------------------------------------------------------

interface EventsTabProps {
    events: PlanetEvents | null;
    summaries: CycloneSummary[];
    hasCyclones: boolean;
    s: PlanetStrings;
    lang: Language;
    nowMs: number;
    onOpenCyclone: (id: string) => void;
}

const CountryBars = ({ counts, total, othersLabel, lang, color }: { counts: CountryCount[]; total: number; othersLabel: string; lang: Language; color: string }) => {
    const shown = counts.slice(0, FIRE_COUNTRIES_SHOWN);
    const rest = total - shown.reduce((sum, c) => sum + c.count, 0);
    // L'escala és la dels països: «Altres» en suma molts i, amb barra, els aixafaria tots.
    const max = Math.max(1, ...shown.map((c) => c.count));
    return (
        <div className="flex flex-col gap-2">
            {shown.map((c) => (
                <div key={c.country} className="flex items-center gap-2.5 text-[12.5px]">
                    <span className="w-28 shrink-0 truncate text-slate-200">{countryName(c.country, lang) ?? c.country}</span>
                    <span className="flex-1 h-2 rounded-full bg-slate-800 overflow-hidden">
                        <span className={`block h-full rounded-full ${color}`} style={{ width: `${(c.count / max) * 100}%` }} />
                    </span>
                    <span className="w-8 text-right font-bold tabular-nums text-white">{c.count}</span>
                </div>
            ))}
            {rest > 0 && (
                <div className="flex items-center gap-2.5 text-[12.5px] text-slate-400">
                    <span className="flex-1">{othersLabel}</span>
                    <span className="w-8 text-right font-bold tabular-nums">{rest}</span>
                </div>
            )}
        </div>
    );
};

function EventsTab({ events, summaries, hasCyclones, s, lang, nowMs, onOpenCyclone }: EventsTabProps) {
    const floodNames = (events?.floods.byCountry ?? []).map((c) => countryName(c.country, lang) ?? c.country);
    const floodText = floodNames.length > FLOOD_COUNTRIES_NAMED
        ? fill(s.andMore, { list: floodNames.slice(0, FLOOD_COUNTRIES_NAMED).join(', '), n: floodNames.length - FLOOD_COUNTRIES_NAMED })
        : floodNames.join(', ');

    return (
        <>
            {hasCyclones && (
                <Card label={s.cyclonesTitle}>
                    <SectionTitle count={String(summaries.length)}>{s.cyclonesTitle}</SectionTitle>
                    {summaries.length === 0 && <p className="text-[13px] text-slate-400">{s.noCyclones}</p>}
                    {summaries.map((summary) => {
                        const tone = cycloneTone(summary);
                        const ageH = Math.floor((nowMs - Date.parse(summary.last.time)) / HOUR_MS);
                        const parts = [
                            summary.category >= 1 ? fill(s.category, { n: summary.category }) : null,
                            kmhText(summary.last.windKt * KMH_PER_KT),
                            s.basins[summary.basin],
                            ageH >= STALE_CYCLONE_HOURS ? fill(s.dataAge, { h: ageH }) : null,
                        ].filter(Boolean);
                        return (
                            <button
                                key={summary.cyclone.id}
                                type="button"
                                onClick={() => onOpenCyclone(summary.cyclone.id)}
                                className={`flex gap-2.5 items-center min-h-[52px] rounded-xl border px-2.5 py-2 text-left cursor-pointer transition-colors hover:bg-white/[0.05] focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/60 ${tone.border} ${tone.bg}`}
                            >
                                <span aria-hidden="true" className="flex-none w-8 h-8 rounded-[10px] bg-black/30 flex items-center justify-center"><CycloneIcon className={`w-4 h-4 ${tone.icon}`} /></span>
                                <span className="flex-1 min-w-0 flex flex-col gap-0.5">
                                    <span className="text-[13.5px] font-semibold text-white">{cycloneTitle(summary, s)}</span>
                                    <span className={`text-xs ${tone.text}`}>{parts.join(' · ')}</span>
                                </span>
                                <ChevronRight aria-hidden="true" className={`w-[18px] h-[18px] ${tone.icon}`} />
                            </button>
                        );
                    })}
                </Card>
            )}

            {events && (
                <>
                    <Card label={s.firesTitle}>
                        <SectionTitle count={formatInteger(events.fires.count, lang)}>{s.firesTitle}</SectionTitle>
                        {events.fires.count === 0
                            ? <p className="text-[13px] text-slate-400">{s.noFires}</p>
                            : <CountryBars counts={events.fires.byCountry} total={events.fires.count} othersLabel={s.others} lang={lang} color="bg-orange-400" />}
                        {events.fires.largest && (
                            <p className="text-[12.5px] leading-snug text-slate-300 flex gap-2 items-start">
                                <Flame aria-hidden="true" className="w-3.5 h-3.5 mt-0.5 shrink-0 text-orange-400" />
                                {fill(s.largestFire, { ha: formatInteger(events.fires.largest.hectares, lang), place: countryName(events.fires.largest.country, lang) ?? '—' })}
                            </p>
                        )}
                    </Card>

                    <Card label={s.floodsTitle}>
                        <SectionTitle count={formatInteger(events.floods.count, lang)}>{s.floodsTitle}</SectionTitle>
                        <p className="text-[13px] leading-snug text-slate-300 flex gap-2 items-start">
                            <Waves aria-hidden="true" className="w-3.5 h-3.5 mt-0.5 shrink-0 text-amber-300" />
                            {events.floods.count === 0 ? s.noFloods : floodText}
                        </p>
                    </Card>

                    {events.volcanoes.length > 0 && (
                        <Card label={s.volcanoesTitle}>
                            <SectionTitle count={String(events.volcanoes.length)}>{s.volcanoesTitle}</SectionTitle>
                            <p className="text-[13px] leading-snug text-slate-300 flex gap-2 items-start">
                                <Mountain aria-hidden="true" className="w-3.5 h-3.5 mt-0.5 shrink-0 text-red-300" />
                                {events.volcanoes.map((v) => [v.name, countryName(v.country, lang)].filter(Boolean).join(', ')).join(' · ')}
                            </p>
                        </Card>
                    )}
                </>
            )}

            {!events && !hasCyclones && <p className="text-sm text-slate-400">{s.unavailable}</p>}

            <p className="px-1 text-[11.5px] leading-relaxed text-slate-400">{s.sourceEvents}</p>
        </>
    );
}

// --- Fitxa del cicló ---------------------------------------------------------------------------------

interface CycloneSheetProps {
    summary: CycloneSummary;
    s: PlanetStrings;
    lang: Language;
    place: { name: string; lat: number; lon: number } | null;
    // On torna la fletxa: la llista de fenòmens o el visor orbital.
    backLabel: string;
    onBack: () => void;
}

function CycloneSheet({ summary, s, lang, place, backLabel, onBack }: CycloneSheetProps) {
    const { last, cyclone, basin, category, maxGain24hKt, maxGainStart, motion } = summary;
    const tone = cycloneTone(summary);
    const centre = OFFICIAL_CENTRE[basin];
    const locale = getSafeLocale(lang);
    const gainDate = maxGainStart
        ? new Date(maxGainStart.time).toLocaleDateString(locale, { day: 'numeric', month: 'short', timeZone: 'UTC' })
        : null;
    const distance = place ? Math.round(distanceKm(place.lat, place.lon, last.lat, last.lon) / 100) * 100 : null;
    const coords = `${Math.abs(last.lat).toLocaleString(locale, { maximumFractionDigits: 1 })}° ${last.lat >= 0 ? 'N' : 'S'} ${Math.abs(last.lon).toLocaleString(locale, { maximumFractionDigits: 1 })}° ${last.lon >= 0 ? 'E' : (lang === 'en' ? 'W' : 'O')}`;
    const lastHourUtc = new Date(last.time).toISOString().slice(11, 13);

    return (
        <div className="space-y-4">
            <button type="button" onClick={onBack} className="inline-flex items-center gap-1 min-h-[44px] -ml-1 -mt-2 px-1 rounded-lg text-[13px] font-semibold text-cyan-300 hover:text-cyan-200 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/60">
                <ChevronLeft aria-hidden="true" className="w-4 h-4" />{backLabel}
            </button>

            <div className="flex flex-col gap-2">
                <h3 className="text-[26px] font-bold leading-tight tracking-tight text-white">{cycloneTitle(summary, s)}</h3>
                <div className="flex flex-wrap gap-1.5">
                    {category >= 1 && (
                        <span className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${tone.border} ${tone.bg} ${tone.text}`}>{fill(s.category, { n: category })}</span>
                    )}
                    <span className="rounded-full border border-slate-400/40 px-2.5 py-0.5 text-xs text-slate-300">{s.basins[basin]} · {coords}</span>
                </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
                <div className="rounded-xl border border-white/5 astro-card-fill p-2.5 flex flex-col gap-1">
                    <span className="text-base font-semibold tabular-nums text-white">{kmhText(last.windKt * KMH_PER_KT)}</span>
                    <span className="text-[11px] leading-snug text-slate-400">{s.windNow}</span>
                </div>
                {maxGain24hKt !== null && maxGain24hKt > 0 && gainDate ? (
                    <div className={`rounded-xl border p-2.5 flex flex-col gap-1 ${maxGain24hKt >= RAPID_INTENSIFICATION_KT ? `${TONES.extreme.border} ${TONES.extreme.bg}` : 'border-white/5 astro-card-fill'}`}>
                        <span className={`text-base font-semibold tabular-nums ${maxGain24hKt >= RAPID_INTENSIFICATION_KT ? 'text-rose-300' : 'text-white'}`}>+{kmhText(maxGain24hKt * KMH_PER_KT)}</span>
                        <span className="text-[11px] leading-snug text-slate-400">{fill(s.gain24, { date: gainDate })}</span>
                    </div>
                ) : <div />}
                {motion ? (
                    <div className="rounded-xl border border-white/5 astro-card-fill p-2.5 flex flex-col gap-1">
                        <span className="text-base font-semibold tabular-nums text-white">{motion.speedKmh < 5 ? '—' : kmhText(motion.speedKmh)}</span>
                        <span className="text-[11px] leading-snug text-slate-400">{motion.speedKmh < 5 ? s.stationary : fill(s.speed, { dir: s.motionDirs[compassIndex(motion.bearingDeg)] })}</span>
                    </div>
                ) : <div />}
            </div>

            {cyclone.track.length > 1 && <CycloneChart summary={summary} s={s} lang={lang} />}

            <Card label={s.why}>
                <SectionTitle>{s.why}</SectionTitle>
                <p className="text-[13px] leading-relaxed text-slate-300">
                    {s.physics}{' '}
                    {maxGain24hKt !== null && maxGain24hKt >= RAPID_INTENSIFICATION_KT && fill(s.rapid, {
                        name: cyclone.name,
                        gain: kmhText(maxGain24hKt * KMH_PER_KT),
                        threshold: kmhText(RAPID_INTENSIFICATION_KT * KMH_PER_KT),
                    })}
                </p>
                {centre?.tenMinute && <p className="text-xs leading-relaxed text-slate-400">{fill(s.tenMinute, { centre: centre.name })}</p>}
            </Card>

            {distance !== null && place && <p className="px-1 text-[13px] text-slate-300">{fill(s.distance, { d: formatInteger(distance, lang), place: place.name })}</p>}

            <div className="flex flex-wrap items-center justify-between gap-3">
                <span className="font-mono text-[10px] uppercase tracking-[0.06em] text-slate-400">
                    {fill(s.sourceCyclone, { source: cyclone.source ?? 'JTWC', time: lastHourUtc })}
                </span>
                {centre && (
                    <a href={centre.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 min-h-[44px] rounded-[14px] border border-white/25 px-3.5 text-sm font-medium text-slate-100 hover:bg-white/[0.06] focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/60">
                        {fill(s.official, { centre: centre.name })}<ExternalLink aria-hidden="true" className="w-4 h-4" />
                    </a>
                )}
            </div>
        </div>
    );
}

// --- Corba d'intensitat --------------------------------------------------------------------------------

const CHART_W = 400, CHART_H = 160, TOP_Y = 14, BOTTOM_Y = 146;

function CycloneChart({ summary, s, lang }: { summary: CycloneSummary; s: PlanetStrings; lang: Language }) {
    const { cyclone, peak, last, maxGain24hKt, maxGainStart } = summary;
    const track = cyclone.track;
    const t0 = Date.parse(track[0].time);
    const t1 = Date.parse(last.time);
    const span = Math.max(1, t1 - t0);
    const kmh = (kt: number) => kt * KMH_PER_KT;
    const yMax = Math.max(260, kmh(peak.windKt) + 20);
    const x = (iso: string) => ((Date.parse(iso) - t0) / span) * CHART_W;
    const y = (valueKmh: number) => BOTTOM_Y - (valueKmh / yMax) * (BOTTOM_Y - TOP_Y);
    const pctX = (iso: string) => (x(iso) / CHART_W) * 100;
    const pctY = (valueKmh: number) => (y(valueKmh) / CHART_H) * 100;

    const line = track.map((p, i) => `${i === 0 ? 'M' : 'L'} ${x(p.time)} ${y(kmh(p.windKt))}`).join(' ');
    const area = `${line} L ${CHART_W} ${BOTTOM_Y} L 0 ${BOTTOM_Y} Z`;
    const rapid = maxGainStart && maxGain24hKt !== null && maxGain24hKt >= RAPID_INTENSIFICATION_KT
        ? track.filter((p) => Date.parse(p.time) >= Date.parse(maxGainStart.time) && Date.parse(p.time) <= Date.parse(maxGainStart.time) + 24 * HOUR_MS)
        : [];
    const rapidPath = rapid.map((p, i) => `${i === 0 ? 'M' : 'L'} ${x(p.time)} ${y(kmh(p.windKt))}`).join(' ');
    const categories = CATEGORY_THRESHOLDS_KMH.map((v, i) => ({ v, label: `C${i + 1}` })).filter((c) => c.v < yMax);
    // Una etiqueta per dia (a les 00 UTC), com la resta de gràfics de l'app.
    const days = track.filter((p) => p.time.slice(11, 13) === '00').map((p) => ({ time: p.time, label: String(Number(p.time.slice(8, 10))) }));
    const first = track[0];
    const summaryLabel = `${s.intensity}: ${kmhText(kmh(first.windKt))} → ${s.peak} ${kmhText(kmh(peak.windKt))} → ${s.nowShort} ${kmhText(kmh(last.windKt))}`;
    const rangeLabel = `${new Date(first.time).toLocaleDateString(getSafeLocale(lang), { day: 'numeric', month: 'short', timeZone: 'UTC' })} – ${new Date(last.time).toLocaleDateString(getSafeLocale(lang), { day: 'numeric', month: 'short', timeZone: 'UTC' })}`;

    return (
        <Card label={s.intensity}>
            <div className="flex items-baseline justify-between gap-2">
                <h3 className="text-[11px] font-black uppercase tracking-[0.14em] text-white">{s.intensity} <span className="font-mono font-medium normal-case tracking-normal text-slate-400">(km/h)</span></h3>
                <span className="font-mono text-[10px] text-slate-400">{rangeLabel}</span>
            </div>
            <div className="relative h-40 md:h-48 ml-6">
                <svg viewBox={`0 0 ${CHART_W} ${CHART_H}`} preserveAspectRatio="none" role="img" aria-label={summaryLabel} className="absolute inset-0 w-full h-full overflow-visible">
                    {categories.map((c) => (
                        <line key={c.label} x1={0} x2={CHART_W} y1={y(c.v)} y2={y(c.v)} stroke="#94a3b8" strokeOpacity="0.35" strokeDasharray="3 4" vectorEffect="non-scaling-stroke" />
                    ))}
                    <line x1={0} x2={CHART_W} y1={BOTTOM_Y} y2={BOTTOM_Y} stroke="#94a3b8" strokeOpacity="0.45" vectorEffect="non-scaling-stroke" />
                    <path d={area} fill="#f87171" fillOpacity="0.08" />
                    <path d={line} fill="none" stroke="#e2e8f0" strokeWidth="2" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
                    {rapidPath && <path d={rapidPath} fill="none" stroke="#f87171" strokeWidth="3.2" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />}
                </svg>
                <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
                    {categories.map((c) => (
                        <span key={c.label} className="absolute -left-6 -translate-y-1/2 font-mono text-[8.5px] text-slate-400" style={{ top: `${pctY(c.v)}%` }}>{c.label}</span>
                    ))}
                    {days.map((d) => (
                        <span key={d.time} className="absolute bottom-[-2px] -translate-x-1/2 font-mono text-[9px] text-slate-400" style={{ left: `${pctX(d.time)}%` }}>{d.label}</span>
                    ))}
                    <span className="absolute w-2 h-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-slate-200" style={{ left: `${pctX(peak.time)}%`, top: `${pctY(kmh(peak.windKt))}%` }} />
                    <span className="absolute -translate-x-1/2 -translate-y-full font-mono text-[9px] text-slate-200 whitespace-nowrap" style={{ left: `${pctX(peak.time)}%`, top: `calc(${pctY(kmh(peak.windKt))}% - 5px)` }}>{s.peak} {Math.round(kmh(peak.windKt))}</span>
                    <span className="absolute w-2.5 h-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-rose-400 ring-2 ring-black/70" style={{ left: '100%', top: `${pctY(kmh(last.windKt))}%` }} />
                    <span className="absolute right-0 font-mono text-[9px] text-rose-300 whitespace-nowrap" style={{ top: `calc(${pctY(kmh(last.windKt))}% + 8px)` }}>{s.nowShort} {Math.round(kmh(last.windKt))}</span>
                    {rapid.length > 1 && (
                        <span className="absolute font-mono text-[9px] text-rose-300 whitespace-nowrap" style={{ left: `calc(${pctX(rapid[rapid.length - 1].time)}% + 6px)`, top: `${pctY(kmh(rapid[Math.floor(rapid.length / 2)].windKt))}%` }}>
                            +{Math.round(kmh(maxGain24hKt ?? 0))} / 24 h
                        </span>
                    )}
                </div>
            </div>
        </Card>
    );
}
