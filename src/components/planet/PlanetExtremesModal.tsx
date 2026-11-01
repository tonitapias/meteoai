// src/components/planet/PlanetExtremesModal.tsx
// Detall d'«Extrems del planeta». És una pila de pantalles (vegeu usePlanetNavigation): la llista, amb les pestanyes
// de rècords i de fenòmens; les fitxes, d'un rècord (RecordSheet) o d'un cicló; i el visor orbital, que s'obre des
// de qualsevol, centrat en el que es mirava. Totes tenen la mateixa capçalera, i el botó «enrere» del mòbil puja un
// sol nivell. En tornar a la llista, es recupera on eres.
import { lazy, Suspense, useEffect, useLayoutEffect, useMemo, useRef, type ReactNode, type Ref } from 'react';
import { Flame, Waves, Mountain, ChevronRight, ExternalLink, CloudOff, Clock, Thermometer, Snowflake, Wind, Gauge, Droplets } from 'lucide-react';
import type { Language } from '../../translations';
import { getSafeLocale, type WeatherUnit } from '../../utils/formatters';
import { distanceKm } from '../../utils/geoDistance';
import { MATRIX_BG } from '../widgets/widgetStyles';
import { astroSheetVars, SHEET_HALO, sheetHaloStyle } from '../astroModalStyles';
import { useAstroModalShell } from '../../hooks/useAstroModalShell';
import { usePlanetExtremes } from '../../hooks/usePlanetExtremes';
import { usePlanetNavigation } from '../../hooks/usePlanetNavigation';
import type { MetarRecords, PlanetEvents, CountryCount, GdacsAlert, PlanetExtremes } from '../../services/planetExtremesApi';
import {
    summarizeCyclone, compassIndex, placeLabel, countryName, formatInteger, recordRanking, isWetBulbTie, matchCyclone,
    cycloneAlertsWithoutTrack, africanFireShare, KMH_PER_KT, CATEGORY_THRESHOLDS_KMH, RAPID_INTENSIFICATION_KT, OFFICIAL_CENTRE,
    RECORD_KEYS, SAVANNA_NOTE_SHARE, STALE_CYCLONE_HOURS, type CycloneSummary, type RecordKey,
} from '../../utils/planetExtremes';
import type { PlanetEntry, PlanetView } from '../../utils/planetNav';
import { initialEye, nearestEye } from '../../utils/orbitalView';
import { PLANET_STRINGS, fill, type PlanetStrings } from './planetI18n';
import { RECORD_STRINGS, type RecordStrings } from './planetRecordsI18n';
import { CycloneIcon, OrbitButton, SheetCard, SheetTitle, WarmingBlock } from './PlanetBits';
import { PlanetHeader } from './PlanetHeader';
import RecordSheet from './RecordSheet';
import { kmhText, alertTitle, shortDate, recordValueText } from './planetFormat';
import { TONES, cycloneTone } from './planetTones';

const OrbitalViewer = lazy(() => import('./OrbitalViewer'));

interface PlanetExtremesModalProps {
    lang: Language;
    unit: WeatherUnit;
    /** La pantalla amb què s'obre: la llista o directament una fitxa. */
    entry: PlanetEntry;
    // Lloc que mira l'usuari, per dir a quina distància és cada cicló.
    place: { name: string; lat: number; lon: number } | null;
    onClose: () => void;
}

const SHEET_GRADIENT = 'from-cyan-950/30 to-black/90';
const SHEET_VARS = astroSheetVars(SHEET_GRADIENT);
const HOUR_MS = 3600 * 1000;
const FIRE_COUNTRIES_SHOWN = 4;
const FLOOD_COUNTRIES_NAMED = 4;

const timeOf = (iso: string, lang: Language) =>
    new Date(iso).toLocaleTimeString(getSafeLocale(lang), { hour: '2-digit', minute: '2-digit' });

const cycloneTitle = (summary: CycloneSummary, s: PlanetStrings) => `${s.kinds[summary.kind]} ${summary.cyclone.name}`;

const RECORD_ICONS: Record<RecordKey, ReactNode> = {
    wetBulb: <Droplets aria-hidden="true" className="w-3.5 h-3.5 text-amber-300" />,
    hottest: <Thermometer aria-hidden="true" className="w-3.5 h-3.5 text-orange-400" />,
    coldest: <Snowflake aria-hidden="true" className="w-3.5 h-3.5 text-sky-300" />,
    gust: <Wind aria-hidden="true" className="w-3.5 h-3.5 text-indigo-300" />,
    lowPressure: <Gauge aria-hidden="true" className="w-3.5 h-3.5 text-violet-300" />,
};

const recordShortLabel = (key: RecordKey, s: PlanetStrings): string =>
    ({ wetBulb: s.wetBulb, hottest: s.hottest, coldest: s.coldest, gust: s.gust, lowPressure: s.lowPressure })[key];

export default function PlanetExtremesModal({ lang, unit, entry, place, onClose }: PlanetExtremesModalProps) {
    const s = PLANET_STRINGS[lang] ?? PLANET_STRINGS.ca;
    const r = RECORD_STRINGS[lang] ?? RECORD_STRINGS.ca;
    const nav = usePlanetNavigation(entry, onClose);
    const { now } = useAstroModalShell(nav.closeAll);
    const nowMs = now.getTime();
    const { status, data } = usePlanetExtremes();
    const scrollRef = useRef<HTMLDivElement>(null);
    const backRef = useRef<HTMLButtonElement>(null);
    // On era el scroll de cada pantalla de la pila, per tornar-hi.
    const positions = useRef<number[]>([]);

    const summaries = useMemo(
        () => (data?.cyclones?.cyclones ?? []).map(summarizeCyclone).sort((a, b) => b.last.windKt - a.last.windKt),
        [data?.cyclones],
    );
    const updatedAt = data?.metar?.updatedAt ?? data?.events?.updatedAt ?? data?.cyclones?.updatedAt ?? null;
    const { view, parent } = nav;
    const depth = nav.stack.length;

    const labelOf = (v: PlanetView): string => {
        switch (v.kind) {
            case 'list': return v.tab === 'records' ? s.tabRecords : s.tabEvents;
            case 'record': return s.recordTitles[v.record];
            case 'cyclone': {
                const summary = summaries.find((c) => c.cyclone.id === v.id);
                return summary ? cycloneTitle(summary, s) : s.cyclonesTitle;
            }
            default: return s.orbitTitle;
        }
    };
    const title = view.kind === 'list' ? s.title : labelOf(view);
    const eyebrow = parent ? labelOf(parent) : updatedAt ? `${s.updated} ${timeOf(updatedAt, lang)}` : s.eyebrow;
    const backLabel = parent ? fill(s.backTo, { where: labelOf(parent) }) : undefined;

    const go = (next: PlanetView) => {
        positions.current[depth - 1] = scrollRef.current?.scrollTop ?? 0;
        nav.push(next);
    };

    // Una pantalla nova comença a dalt; en tornar, cadascuna recupera el seu scroll.
    useLayoutEffect(() => {
        if (scrollRef.current) scrollRef.current.scrollTop = positions.current[depth - 1] ?? 0;
        positions.current.length = depth;
    }, [depth]);

    // En entrar a una pantalla nova, el focus va a la fletxa (el que s'ha tocat ja no hi és).
    const previousDepth = useRef(depth);
    useEffect(() => {
        if (depth > previousDepth.current) backRef.current?.focus();
        previousDepth.current = depth;
    }, [depth]);

    const isOrbit = view.kind === 'orbit';

    return (
        <div role="dialog" aria-modal="true" aria-labelledby="planet-modal-title" className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 md:p-6 landscape:p-0 landscape:sm:p-4 bg-black">
            {/* Alçades en % de l'overlay i no en dvh, com la resta de fulls (motors sense dvh). */}
            <div className={`w-full h-[96%] sm:h-auto sm:max-h-[calc(90%+1.8rem)] md:max-h-[calc(90%+2.7rem)] landscape:h-full landscape:sm:h-auto landscape:sm:max-h-[calc(90%+1.8rem)] max-w-sm md:max-w-3xl flex flex-col ${isOrbit ? 'min-h-0 sm:min-h-[min(46rem,90%)]' : 'min-h-0'} bg-gradient-to-b ${SHEET_GRADIENT} rounded-t-[24px] sm:rounded-[32px] border-t sm:border border-cyan-500/20 shadow-[0_0_100px_rgba(0,0,0,0.9)] overflow-hidden relative`} style={SHEET_VARS}>
                <div className={MATRIX_BG}></div>
                <div className={SHEET_HALO} style={sheetHaloStyle('cyan', 'slate')}></div>

                {!isOrbit && (
                    <>
                        <div className="shrink-0 relative z-20 border-b border-white/[0.04] px-4 pt-3 pb-3 md:px-6 md:pt-5 flex flex-col gap-3">
                            <PlanetHeader
                                eyebrow={eyebrow}
                                title={title}
                                titleId="planet-modal-title"
                                onBack={parent ? nav.back : undefined}
                                backLabel={backLabel}
                                backRef={backRef}
                                onClose={nav.closeAll}
                                closeLabel={s.close}
                            />
                            {view.kind === 'list' && (
                                <div role="tablist" aria-label={s.tabsLabel} className="grid grid-cols-2 gap-1 rounded-xl border border-white/10 bg-black/40 p-1">
                                    {(['records', 'events'] as const).map((key) => (
                                        <button
                                            key={key}
                                            type="button"
                                            role="tab"
                                            id={`planet-tab-${key}`}
                                            aria-selected={view.tab === key}
                                            aria-controls="planet-tabpanel"
                                            onClick={() => {
                                                nav.replace({ kind: 'list', tab: key });
                                                if (scrollRef.current) scrollRef.current.scrollTop = 0;
                                            }}
                                            className={`min-h-[40px] rounded-lg text-[13px] cursor-pointer transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/60 ${view.tab === key ? 'border border-cyan-400/45 bg-cyan-500/[0.16] font-bold text-cyan-200' : 'font-medium text-slate-300 hover:text-white'}`}
                                        >
                                            {key === 'records' ? s.tabRecords : s.tabEvents}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto overscroll-contain relative z-10 p-4 md:p-6 space-y-4">
                            {status === 'loading' && <p className="text-sm text-slate-400">{s.loading}</p>}
                            {status === 'error' && (
                                <div className="flex flex-col items-center justify-center text-center gap-3 py-12 text-slate-400 text-sm">
                                    <CloudOff className="w-10 h-10 text-slate-600" />
                                    {s.unavailable}
                                </div>
                            )}
                            {data && view.kind === 'list' && (
                                <div role="tabpanel" id="planet-tabpanel" aria-labelledby={`planet-tab-${view.tab}`} className="space-y-4">
                                    <OrbitRow s={s} onClick={() => go({ kind: 'orbit', eye: initialEye(view.tab, data, summaries) })} />
                                    {view.tab === 'records'
                                        ? data.metar
                                            ? <RecordsList metar={data.metar} s={s} r={r} lang={lang} unit={unit} onOpen={(record) => go({ kind: 'record', record })} />
                                            : <p className="text-sm text-slate-400">{s.unavailable}</p>
                                        : <EventsList data={data} summaries={summaries} s={s} lang={lang} nowMs={nowMs} onOpen={go} />}
                                </div>
                            )}
                            {data && view.kind === 'record' && (
                                data.metar
                                    ? <RecordSheet
                                        record={view.record} metar={data.metar} summaries={summaries} s={s} r={r} lang={lang} unit={unit} nowMs={nowMs}
                                        onOrbit={() => {
                                            const top = recordRanking(data.metar as MetarRecords, view.record)[0];
                                            go({ kind: 'orbit', eye: top ? nearestEye(top.lat, top.lon) : initialEye('records', data, summaries) });
                                        }}
                                    />
                                    : <p className="text-sm text-slate-400">{s.unavailable}</p>
                            )}
                            {data && view.kind === 'cyclone' && <CycloneView id={view.id} data={data} summaries={summaries} s={s} lang={lang} nowMs={nowMs} place={place} onOrbit={(eye) => go({ kind: 'orbit', eye })} />}
                        </div>
                    </>
                )}

                {isOrbit && data && (
                    <Suspense fallback={<div className="absolute inset-0 z-30 bg-[#010208]" />}>
                        <OrbitalViewer
                            data={data}
                            summaries={summaries}
                            eye={view.eye}
                            onEyeChange={(eye) => nav.replace({ kind: 'orbit', eye })}
                            s={s}
                            lang={lang}
                            unit={unit}
                            place={place}
                            nowMs={nowMs}
                            titleId="planet-modal-title"
                            eyebrow={parent ? labelOf(parent) : s.title}
                            backLabel={fill(s.backTo, { where: parent ? labelOf(parent) : s.title })}
                            onBack={nav.back}
                            onClose={nav.closeAll}
                            onOpenCyclone={(id) => go({ kind: 'cyclone', id })}
                        />
                    </Suspense>
                )}
            </div>
        </div>
    );
}

// --- La llista ---------------------------------------------------------------------------------------------

const OrbitRow = ({ s, onClick }: { s: PlanetStrings; onClick: () => void }) => (
    <button
        type="button"
        onClick={onClick}
        className="flex w-full min-h-[52px] items-center gap-3 rounded-[14px] border border-amber-200/40 bg-amber-200/[0.06] px-3 py-2 text-left cursor-pointer transition-colors hover:bg-amber-200/[0.1] focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-200/60"
    >
        <svg aria-hidden="true" width="34" height="34" viewBox="0 0 34 34" fill="none" className="flex-none">
            <circle cx="17" cy="17" r="15" fill="#0b1a33" stroke="#fde68a" strokeOpacity="0.6" />
            <path d="M5 13c5 1 9-2 14-1s7 3 10 2M4 20c6-1 9 2 14 1s8-3 12-1" stroke="#cbd5e1" strokeOpacity="0.5" strokeWidth="1.5" strokeLinecap="round" />
            <circle cx="21" cy="14" r="2.4" fill="#fb923c" />
        </svg>
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="text-sm font-semibold text-amber-200">{s.orbitOpen}</span>
            <span className="text-xs text-slate-400">{s.orbitRowSub}</span>
        </span>
        <ChevronRight aria-hidden="true" className="w-4 h-4 text-amber-200" />
    </button>
);

interface RecordsListProps {
    metar: MetarRecords;
    s: PlanetStrings;
    r: RecordStrings;
    lang: Language;
    unit: WeatherUnit;
    onOpen: (record: RecordKey) => void;
}

function RecordsList({ metar, s, r, lang, unit, onOpen }: RecordsListProps) {
    return (
        <>
            {RECORD_KEYS.map((key) => {
                const ranking = recordRanking(metar, key);
                const top = ranking[0];
                if (!top) return null;
                const tie = key === 'wetBulb' && ranking.length > 1 && isWetBulbTie(top, ranking[1]);
                const extra = key === 'gust' && top.elevM !== null && top.elevM >= 1000
                    ? fill(s.summit, { m: formatInteger(top.elevM, lang) })
                    : key === 'lowPressure' ? s.seaLevel : null;
                return (
                    <button
                        key={key}
                        type="button"
                        onClick={() => onOpen(key)}
                        className="flex w-full flex-col gap-1 rounded-2xl border border-white/5 astro-card-fill px-3.5 py-3 text-left cursor-pointer transition-colors hover:bg-white/[0.05] focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/60"
                    >
                        <span className="flex items-center gap-1.5">
                            {RECORD_ICONS[key]}
                            <span className="flex-1 font-mono text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400">{recordShortLabel(key, s)}</span>
                            <ChevronRight aria-hidden="true" className="w-4 h-4 text-slate-400" />
                        </span>
                        <span className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                            <span className="text-[19px] font-semibold tabular-nums text-white">{recordValueText(key, top.value, unit, lang)}</span>
                            <span className="text-[13px] text-slate-200">{placeLabel(top, lang)}</span>
                            {extra && <span className="text-xs text-slate-400">· {extra}</span>}
                            {tie && <span className="rounded-full border border-slate-400/45 px-2 text-[11.5px] text-slate-300">{r.tie}</span>}
                        </span>
                        {ranking.length > 1 && (
                            <span className="text-xs leading-snug text-slate-400">
                                {ranking.slice(1).map((station, i) => `${i + 2}. ${placeLabel(station, lang)}, ${recordValueText(key, station.value, unit, lang, key === 'wetBulb' ? 1 : 0)}`).join(' · ')}
                            </span>
                        )}
                    </button>
                );
            })}
            <p className="px-1 text-[12px] leading-relaxed text-slate-400">
                <span className="font-semibold text-slate-300">{s.qcLead}</span>{' '}
                {fill(s.qc, { n: formatInteger(metar.stations, lang), d: formatInteger(metar.discarded, lang) })} {s.sourceMetar}
            </p>
        </>
    );
}

const ALERT_ICONS: Record<GdacsAlert['type'], (className: string) => ReactNode> = {
    TC: (c) => <CycloneIcon className={c} />,
    FL: (c) => <Waves aria-hidden="true" className={c} />,
    WF: (c) => <Flame aria-hidden="true" className={c} />,
    VO: (c) => <Mountain aria-hidden="true" className={c} />,
};

const alertTone = (alert: GdacsAlert) => (alert.level === 'red' ? TONES.extreme : TONES.severe);

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

interface EventsListProps {
    data: PlanetExtremes;
    summaries: CycloneSummary[];
    s: PlanetStrings;
    lang: Language;
    nowMs: number;
    onOpen: (view: PlanetView) => void;
}

function EventsList({ data, summaries, s, lang, nowMs, onOpen }: EventsListProps) {
    const events: PlanetEvents | null = data.events;
    const alerts = events?.alerts ?? [];
    const cycloneAlerts = alerts.filter((a) => a.type === 'TC');
    const otherAlerts = alerts.filter((a) => a.type !== 'TC');
    const untracked = cycloneAlertsWithoutTrack(alerts, data.cyclones?.cyclones ?? []);
    const hasCyclones = !!data.cyclones || untracked.length > 0;
    const floodNames = (events?.floods.byCountry ?? []).map((c) => countryName(c.country, lang) ?? c.country);
    const floodText = floodNames.length > FLOOD_COUNTRIES_NAMED
        ? fill(s.andMore, { list: floodNames.slice(0, FLOOD_COUNTRIES_NAMED).join(', '), n: floodNames.length - FLOOD_COUNTRIES_NAMED })
        : floodNames.join(', ');
    const alertFor = (summary: CycloneSummary) => cycloneAlerts.find((a) => matchCyclone(a, [summary.cyclone]));

    return (
        <>
            {otherAlerts.length > 0 && (
                <SheetCard label={s.alertsTitle}>
                    <SheetTitle count={String(otherAlerts.length)}>{s.alertsTitle}</SheetTitle>
                    {otherAlerts.map((alert, i) => <AlertRow key={`${alert.type}-${alert.country}-${i}`} alert={alert} s={s} lang={lang} />)}
                    <p className="text-xs leading-relaxed text-slate-400">{s.alertsNote}</p>
                </SheetCard>
            )}

            {hasCyclones && (
                <SheetCard label={s.cyclonesTitle}>
                    <SheetTitle count={String(summaries.length + untracked.length)}>{s.cyclonesTitle}</SheetTitle>
                    {summaries.length + untracked.length === 0 && <p className="text-[13px] text-slate-400">{s.noCyclones}</p>}
                    {summaries.map((summary) => {
                        const tone = cycloneTone(summary);
                        const ageH = Math.floor((nowMs - Date.parse(summary.last.time)) / HOUR_MS);
                        const alert = alertFor(summary);
                        const parts = [
                            summary.category >= 1 ? fill(s.category, { n: summary.category }) : null,
                            kmhText(summary.last.windKt * KMH_PER_KT),
                            s.basins[summary.basin],
                            alert ? s.alertLevels[alert.level] : null,
                            ageH >= STALE_CYCLONE_HOURS ? fill(s.dataAge, { h: ageH }) : null,
                        ].filter(Boolean);
                        return (
                            <button
                                key={summary.cyclone.id}
                                type="button"
                                onClick={() => onOpen({ kind: 'cyclone', id: summary.cyclone.id })}
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
                    {untracked.map((alert, i) => <AlertRow key={`tc-${alert.name}-${i}`} alert={alert} s={s} lang={lang} note={s.noTrack} />)}
                </SheetCard>
            )}

            {events && (
                <>
                    <SheetCard label={s.firesTitle}>
                        <SheetTitle count={formatInteger(events.fires.count, lang)}>{s.firesTitle}</SheetTitle>
                        {events.fires.count === 0
                            ? <p className="text-[13px] text-slate-400">{s.noFires}</p>
                            : <CountryBars counts={events.fires.byCountry} total={events.fires.count} othersLabel={s.others} lang={lang} color="bg-orange-400" />}
                        {events.fires.largest && (
                            <p className="text-[12.5px] leading-snug text-slate-300 flex gap-2 items-start">
                                <Flame aria-hidden="true" className="w-3.5 h-3.5 mt-0.5 shrink-0 text-orange-400" />
                                {fill(s.largestFire, { ha: formatInteger(events.fires.largest.hectares, lang), place: countryName(events.fires.largest.country, lang) ?? '—' })}
                            </p>
                        )}
                        {africanFireShare(events.fires) >= SAVANNA_NOTE_SHARE && <p className="text-[12.5px] leading-snug text-slate-300">{s.savanna}</p>}
                    </SheetCard>

                    <SheetCard label={s.floodsTitle}>
                        <SheetTitle count={formatInteger(events.floods.count, lang)}>{s.floodsTitle}</SheetTitle>
                        <p className="text-[13px] leading-snug text-slate-300 flex gap-2 items-start">
                            <Waves aria-hidden="true" className="w-3.5 h-3.5 mt-0.5 shrink-0 text-amber-300" />
                            {events.floods.count === 0 ? s.noFloods : floodText}
                        </p>
                    </SheetCard>

                    {events.volcanoes.length > 0 && (
                        <SheetCard label={s.volcanoesTitle}>
                            <SheetTitle count={String(events.volcanoes.length)}>{s.volcanoesTitle}</SheetTitle>
                            <p className="text-[13px] leading-snug text-slate-300 flex gap-2 items-start">
                                <Mountain aria-hidden="true" className="w-3.5 h-3.5 mt-0.5 shrink-0 text-red-300" />
                                {events.volcanoes.map((v) => [v.name, countryName(v.country, lang)].filter(Boolean).join(', ')).join(' · ')}
                            </p>
                        </SheetCard>
                    )}
                </>
            )}

            {!events && !hasCyclones && <p className="text-sm text-slate-400">{s.unavailable}</p>}

            <p className="px-1 text-[12px] leading-relaxed text-slate-400">{s.sourceEvents}</p>
        </>
    );
}

/** Un esdeveniment amb alerta de GDACS: sense fitxa pròpia, porta a l'informe de GDACS. */
function AlertRow({ alert, s, lang, note }: { alert: GdacsAlert; s: PlanetStrings; lang: Language; note?: string }) {
    const tone = alertTone(alert);
    const sub = [
        alert.type === 'TC' || alert.type === 'VO' ? countryName(alert.country, lang) : null,
        s.alertLevels[alert.level],
        alert.from ? fill(s.since, { date: shortDate(alert.from, lang) }) : null,
    ].filter(Boolean).join(' · ');
    const body = (
        <>
            <span aria-hidden="true" className="flex-none w-8 h-8 rounded-[10px] bg-black/30 flex items-center justify-center">{ALERT_ICONS[alert.type](`w-4 h-4 ${tone.icon}`)}</span>
            <span className="flex-1 min-w-0 flex flex-col gap-0.5">
                <span className="text-[13.5px] font-semibold text-white">{alertTitle(alert, s, lang)}</span>
                <span className={`text-xs ${tone.text}`}>{sub}</span>
                {note && <span className="text-xs text-slate-400">{note}</span>}
            </span>
        </>
    );
    const className = `flex gap-2.5 items-center min-h-[52px] rounded-xl border px-2.5 py-2 text-left ${tone.border} ${tone.bg}`;
    return alert.url ? (
        <a href={alert.url} target="_blank" rel="noopener noreferrer" aria-label={`${alertTitle(alert, s, lang)}. ${s.gdacsReport}`} className={`${className} transition-colors hover:bg-white/[0.05] focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/60`}>
            {body}
            <ExternalLink aria-hidden="true" className={`w-4 h-4 flex-none ${tone.icon}`} />
        </a>
    ) : <div className={className}>{body}</div>;
}

// --- Fitxa del cicló ---------------------------------------------------------------------------------------

interface CycloneViewProps {
    id: string;
    data: PlanetExtremes;
    summaries: CycloneSummary[];
    s: PlanetStrings;
    lang: Language;
    nowMs: number;
    place: { name: string; lat: number; lon: number } | null;
    onOrbit: (eye: ReturnType<typeof nearestEye>) => void;
    orbitButtonRef?: Ref<HTMLButtonElement>;
}

function CycloneView({ id, data, summaries, s, lang, nowMs, place, onOrbit, orbitButtonRef }: CycloneViewProps) {
    const summary = summaries.find((c) => c.cyclone.id === id);
    if (!summary) return <p className="text-sm text-slate-400">{s.unavailable}</p>;
    const { last, cyclone, basin, category, maxGain24hKt, maxGainStart, motion } = summary;
    const tone = cycloneTone(summary);
    const centre = OFFICIAL_CENTRE[basin];
    const locale = getSafeLocale(lang);
    const alert = (data.events?.alerts ?? []).find((a) => a.type === 'TC' && matchCyclone(a, [cyclone]));
    const gainDate = maxGainStart ? shortDate(maxGainStart.time, lang) : null;
    const distance = place ? Math.round(distanceKm(place.lat, place.lon, last.lat, last.lon) / 100) * 100 : null;
    const coords = `${Math.abs(last.lat).toLocaleString(locale, { maximumFractionDigits: 1 })}° ${last.lat >= 0 ? 'N' : 'S'} ${Math.abs(last.lon).toLocaleString(locale, { maximumFractionDigits: 1 })}° ${last.lon >= 0 ? 'E' : (lang === 'en' ? 'W' : 'O')}`;
    const lastTimeUtc = new Date(last.time).toISOString().slice(11, 16);
    const ageH = Math.floor((nowMs - Date.parse(last.time)) / HOUR_MS);
    const source = cyclone.source ?? 'JTWC';

    return (
        <div className="space-y-4">
            <div className="flex items-start gap-2.5 rounded-xl border border-slate-400/35 bg-white/[0.03] px-3 py-2.5">
                <Clock aria-hidden="true" className="mt-0.5 w-[18px] h-[18px] flex-none text-slate-300" />
                <span className="flex flex-col gap-0.5">
                    <span className="text-[13.5px] font-semibold text-slate-100">{fill(ageH >= 1 ? s.ageBanner : s.ageBannerFresh, { time: lastTimeUtc, h: ageH })}</span>
                    <span className="text-xs text-slate-400">{fill(s.ageRenew, { source })}</span>
                </span>
            </div>

            <div className="flex flex-wrap gap-1.5">
                {category >= 1 && (
                    <span className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${tone.border} ${tone.bg} ${tone.text}`}>{fill(s.category, { n: category })}</span>
                )}
                {alert && (
                    <span className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${alertTone(alert).border} ${alertTone(alert).text}`}>{`${s.alertLevels[alert.level]} · GDACS`}</span>
                )}
                <span className="rounded-full border border-slate-400/40 px-2.5 py-0.5 text-xs text-slate-300">{s.basins[basin]} · {coords}</span>
            </div>

            <div className="grid grid-cols-3 gap-2">
                <div className="rounded-xl border border-white/5 astro-card-fill p-2.5 flex flex-col gap-1">
                    <span className="text-base font-semibold tabular-nums text-white">{kmhText(last.windKt * KMH_PER_KT)}</span>
                    <span className="text-[11.5px] leading-snug text-slate-400">{s.windNow}</span>
                </div>
                {maxGain24hKt !== null && maxGain24hKt > 0 && gainDate ? (
                    <div className={`rounded-xl border p-2.5 flex flex-col gap-1 ${maxGain24hKt >= RAPID_INTENSIFICATION_KT ? `${TONES.extreme.border} ${TONES.extreme.bg}` : 'border-white/5 astro-card-fill'}`}>
                        <span className={`text-base font-semibold tabular-nums ${maxGain24hKt >= RAPID_INTENSIFICATION_KT ? 'text-rose-300' : 'text-white'}`}>+{kmhText(maxGain24hKt * KMH_PER_KT)}</span>
                        <span className="text-[11.5px] leading-snug text-slate-400">{fill(s.gain24, { date: gainDate })}</span>
                    </div>
                ) : <div />}
                {motion ? (
                    <div className="rounded-xl border border-white/5 astro-card-fill p-2.5 flex flex-col gap-1">
                        <span className="text-base font-semibold tabular-nums text-white">{motion.speedKmh < 5 ? '—' : kmhText(motion.speedKmh)}</span>
                        <span className="text-[11.5px] leading-snug text-slate-400">{motion.speedKmh < 5 ? s.stationary : fill(s.speed, { dir: s.motionDirs[compassIndex(motion.bearingDeg)] })}</span>
                    </div>
                ) : <div />}
            </div>

            {cyclone.track.length > 1 && <CycloneChart summary={summary} s={s} lang={lang} />}

            <SheetCard label={s.why}>
                <SheetTitle>{s.why}</SheetTitle>
                <p className="text-[13px] leading-relaxed text-slate-300">
                    {s.physics}{' '}
                    {maxGain24hKt !== null && maxGain24hKt >= RAPID_INTENSIFICATION_KT && fill(s.rapid, {
                        name: cyclone.name,
                        gain: kmhText(maxGain24hKt * KMH_PER_KT),
                        threshold: kmhText(RAPID_INTENSIFICATION_KT * KMH_PER_KT),
                    })}
                </p>
                {centre?.tenMinute && <p className="text-xs leading-relaxed text-slate-400">{fill(s.tenMinute, { centre: centre.name })}</p>}
            </SheetCard>

            <WarmingBlock title={s.warmingTitle} badge={s.cycloneWarmingBadge} text={s.cycloneWarming} source={s.ipcc} />

            {distance !== null && place && <p className="px-1 text-[13px] text-slate-300">{fill(s.distance, { d: formatInteger(distance, lang), place: place.name })}</p>}

            <OrbitButton label={fill(s.orbitFor, { what: cyclone.name })} onClick={() => onOrbit(nearestEye(last.lat, last.lon))} buttonRef={orbitButtonRef} />

            <div className="flex flex-wrap items-center justify-between gap-3">
                <span className="font-mono text-[11px] uppercase tracking-[0.06em] text-slate-400">
                    {fill(s.sourceCyclone, { source, time: lastTimeUtc.slice(0, 2) })}
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
    const rangeLabel = `${shortDate(first.time, lang)} – ${shortDate(last.time, lang)}`;

    return (
        <SheetCard label={s.intensity}>
            <div className="flex items-baseline justify-between gap-2">
                <h3 className="text-[11px] font-black uppercase tracking-[0.14em] text-white">{s.intensity} <span className="font-mono font-medium normal-case tracking-normal text-slate-400">(km/h)</span></h3>
                <span className="font-mono text-[11px] text-slate-400">{rangeLabel}</span>
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
                        <span key={c.label} className="absolute -left-6 -translate-y-1/2 font-mono text-[10px] text-slate-400" style={{ top: `${pctY(c.v)}%` }}>{c.label}</span>
                    ))}
                    {days.map((d) => (
                        <span key={d.time} className="absolute bottom-[-4px] -translate-x-1/2 font-mono text-[10px] text-slate-400" style={{ left: `${pctX(d.time)}%` }}>{d.label}</span>
                    ))}
                    <span className="absolute w-2 h-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-slate-200" style={{ left: `${pctX(peak.time)}%`, top: `${pctY(kmh(peak.windKt))}%` }} />
                    <span className="absolute -translate-x-1/2 -translate-y-full font-mono text-[10px] text-slate-200 whitespace-nowrap" style={{ left: `${pctX(peak.time)}%`, top: `calc(${pctY(kmh(peak.windKt))}% - 5px)` }}>{s.peak} {Math.round(kmh(peak.windKt))}</span>
                    <span className="absolute w-2.5 h-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-rose-400 ring-2 ring-black/70" style={{ left: '100%', top: `${pctY(kmh(last.windKt))}%` }} />
                    <span className="absolute right-0 font-mono text-[10px] text-rose-300 whitespace-nowrap" style={{ top: `calc(${pctY(kmh(last.windKt))}% + 8px)` }}>{s.nowShort} {Math.round(kmh(last.windKt))}</span>
                    {rapid.length > 1 && (
                        <span className="absolute font-mono text-[10px] text-rose-300 whitespace-nowrap" style={{ left: `calc(${pctX(rapid[rapid.length - 1].time)}% + 6px)`, top: `${pctY(kmh(rapid[Math.floor(rapid.length / 2)].windKt))}%` }}>
                            +{Math.round(kmh(maxGain24hKt ?? 0))} / 24 h
                        </span>
                    )}
                </div>
            </div>
        </SheetCard>
    );
}

