// src/components/planet/PlanetExtremesCard.tsx
// Secció «Més enllà del teu cel», a la pestanya Cel: els rècords d'ara mateix de les estacions de tot
// el món i el recompte dels fenòmens actius. Cap dada fa de protagonista fixa: només quan passa alguna cosa
// excepcional (planetProtagonist) va a dalt, en gran, amb una línia que diu per què es destaca. Cada rajola i cada
// xip obre la seva fitxa al detall (PlanetExtremesModal).
import { useMemo, type ReactNode } from 'react';
import { Globe, Thermometer, Snowflake, Wind, Gauge, Flame, Waves, Mountain, ChevronRight, Droplets } from 'lucide-react';
import type { Language } from '../../translations';
import { getSafeLocale, type WeatherUnit } from '../../utils/formatters';
import { usePlanetExtremes } from '../../hooks/usePlanetExtremes';
import type { GdacsAlert, StationRecord } from '../../services/planetExtremesApi';
import {
    placeLabel, countryName, formatInteger, summarizeCyclone, planetProtagonist, recordRanking, minutesAgo, cycloneAlertsWithoutTrack,
    KMH_PER_KT, RAPID_INTENSIFICATION_KT, RECORD_KEYS, WET_BULB_DANGER_C, MOUNTAIN_ELEVATION_M,
    type CycloneSummary, type Protagonist, type RecordKey,
} from '../../utils/planetExtremes';
import type { PlanetEntry } from '../../utils/planetNav';
import { PLANET_STRINGS, fill, plural, type PlanetStrings } from './planetI18n';
import { CycloneIcon, WetBulbBar } from './PlanetBits';
import { tempText, kmhText, hpaText, alertTitle, shortDate } from './planetFormat';
import { TONES, cycloneTone, type Tone } from './planetTones';
import { cycloneLabel } from './orbitalMarkers';

interface PlanetExtremesCardProps {
    lang: Language;
    unit: WeatherUnit;
    /** Rellotge de l'app (ms): quant fa de cada mesura i si la dada del cicló encara és recent. */
    nowMs: number;
    onOpen: (entry: PlanetEntry) => void;
}

const timeOf = (iso: string, lang: Language) =>
    new Date(iso).toLocaleTimeString(getSafeLocale(lang), { hour: '2-digit', minute: '2-digit' });

const LABEL = 'font-mono text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400';

const RECORD_ICONS: Record<RecordKey, ReactNode> = {
    wetBulb: <Droplets aria-hidden="true" className="w-3.5 h-3.5 text-amber-300" />,
    hottest: <Thermometer aria-hidden="true" className="w-3.5 h-3.5 text-orange-400" />,
    coldest: <Snowflake aria-hidden="true" className="w-3.5 h-3.5 text-sky-300" />,
    gust: <Wind aria-hidden="true" className="w-3.5 h-3.5 text-indigo-300" />,
    lowPressure: <Gauge aria-hidden="true" className="w-3.5 h-3.5 text-violet-300" />,
};

const recordLabel = (key: RecordKey, s: PlanetStrings): string =>
    ({ wetBulb: s.wetBulb, hottest: s.hottest, coldest: s.coldest, gust: s.gust, lowPressure: s.lowPressure })[key];

const valueText = (key: RecordKey, station: StationRecord, unit: WeatherUnit, lang: Language): string =>
    key === 'gust' ? kmhText(station.value) : key === 'lowPressure' ? hpaText(station.value) : tempText(station.value, unit, lang);

/** La línia petita de sota el lloc: el cim de la ratxa, el nivell del mar de la pressió. */
const recordNote = (key: RecordKey, station: StationRecord, s: PlanetStrings, lang: Language): string | null =>
    key === 'gust' && station.elevM !== null && station.elevM >= MOUNTAIN_ELEVATION_M
        ? fill(s.summit, { m: formatInteger(station.elevM, lang) })
        : key === 'lowPressure' ? s.seaLevel : null;

export default function PlanetExtremesCard({ lang, unit, nowMs, onOpen }: PlanetExtremesCardProps) {
    const s = PLANET_STRINGS[lang] ?? PLANET_STRINGS.ca;
    const { status, data } = usePlanetExtremes();

    const metar = data?.metar ?? null;
    const events = data?.events ?? null;
    const cyclones = data?.cyclones?.cyclones ?? null;
    const summaries = useMemo(
        () => (cyclones ?? []).map(summarizeCyclone).sort((a, b) => b.last.windKt - a.last.windKt),
        [cyclones],
    );
    const protagonist = data ? planetProtagonist(data, nowMs) : null;
    const nothing = status === 'error' || (status === 'ready' && !metar && !events && !cyclones);

    // El rècord que fa de protagonista ja és a dalt: no es repeteix a les rajoles.
    const heroRecord: RecordKey | null = protagonist?.kind === 'wetBulb' ? 'wetBulb' : protagonist?.kind === 'record' ? protagonist.record : null;
    const tops = metar
        ? RECORD_KEYS.map((key) => ({ key, station: recordRanking(metar, key)[0] }))
            .filter((t): t is { key: RecordKey; station: StationRecord } => t.station !== undefined)
        : [];
    const wetTile = tops.find((t) => t.key === 'wetBulb' && heroRecord !== 'wetBulb');
    const tiles = tops.filter((t) => t.key !== 'wetBulb' && t.key !== heroRecord);
    const ages = tops.map((t) => minutesAgo(t.station.time, nowMs));
    const ageText = ages.length === 0 ? null
        : Math.min(...ages) === Math.max(...ages) ? fill(s.obsAgeOne, { a: ages[0] })
            : fill(s.obsAge, { a: Math.min(...ages), b: Math.max(...ages) });

    const alerts = events?.alerts ?? [];
    const untracked = cycloneAlertsWithoutTrack(alerts, cyclones ?? []);
    const chips: { key: string; icon: ReactNode; text: string; tone: Tone; entry: PlanetEntry }[] = [];
    const cycloneCount = summaries.length + untracked.length;
    if (cycloneCount > 0) {
        const tone = summaries[0] ? cycloneTone(summaries[0]) : TONES.notable;
        const single = summaries.length === 1 && untracked.length === 0 ? summaries[0] : null;
        chips.push({
            key: 'tc', tone, icon: <CycloneIcon className={`w-3.5 h-3.5 ${tone.icon}`} />,
            text: single ? cycloneLabel(single, s) : plural(cycloneCount, s.cyclonesOne, s.cyclonesMany),
            entry: single ? { kind: 'cyclone', id: single.cyclone.id } : { kind: 'list', tab: 'events' },
        });
    }
    // En color, només els que tenen alerta de GDACS; la resta, en un to neutre.
    const eventChip = (key: string, type: GdacsAlert['type'], count: number, one: string, many: string, icon: (className: string) => ReactNode) => {
        if (count <= 0) return;
        const withAlert = alerts.filter((a) => a.type === type).length;
        const tone = withAlert > 0 ? TONES.severe : TONES.quiet;
        chips.push({
            key, tone, icon: icon(`w-3.5 h-3.5 ${withAlert > 0 ? tone.icon : 'text-slate-300'}`),
            text: withAlert > 0 ? `${plural(count, one, many)} · ${fill(s.withAlert, { n: withAlert })}` : plural(count, one, many),
            entry: { kind: 'list', tab: 'events' },
        });
    };
    if (events) {
        eventChip('wf', 'WF', events.fires.count, s.firesOne, s.firesMany, (c) => <Flame aria-hidden="true" className={c} />);
        eventChip('fl', 'FL', events.floods.count, s.floodsOne, s.floodsMany, (c) => <Waves aria-hidden="true" className={c} />);
        eventChip('vo', 'VO', events.volcanoes.length, s.volcanoesOne, s.volcanoesMany, (c) => <Mountain aria-hidden="true" className={c} />);
    }

    return (
        <section aria-labelledby="planet-extremes-title" className="flex flex-col gap-2">
            <span className="ml-1 text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400">{s.eyebrow}</span>
            <div className="rounded-2xl bg-white/5 border border-white/10 shadow-lg p-4 sm:p-5 flex flex-col gap-3.5">
                <div className="flex items-center justify-between gap-3">
                    <h2 id="planet-extremes-title" className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.2em] text-slate-300">
                        <Globe aria-hidden="true" className="w-4 h-4 text-cyan-300" />
                        {s.title}
                    </h2>
                    {metar && (
                        <span className="font-mono text-[11px] uppercase tracking-[0.06em] text-slate-400">{s.updated} {timeOf(metar.updatedAt, lang)}</span>
                    )}
                </div>

                {status === 'loading' && <p className="text-sm text-slate-400">{s.loading}</p>}
                {nothing && <p className="text-sm text-slate-400">{s.unavailable}</p>}

                {protagonist
                    ? <ProtagonistHero protagonist={protagonist} s={s} lang={lang} unit={unit} onOpen={onOpen} />
                    : metar && <p className="-mt-1 text-[13px] leading-snug text-slate-400">{s.calm}</p>}

                {wetTile && (
                    <button
                        type="button"
                        onClick={() => onOpen({ kind: 'record', record: 'wetBulb' })}
                        className="relative flex flex-col gap-1.5 rounded-xl border border-white/[0.1] bg-white/[0.03] p-3 text-left cursor-pointer transition-colors hover:bg-white/[0.06] focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/60"
                    >
                        <ChevronRight aria-hidden="true" className="absolute right-2.5 top-3 w-4 h-4 text-slate-400" />
                        <span className="flex items-center gap-1.5 pr-6">
                            {RECORD_ICONS.wetBulb}
                            <span className={LABEL}>{s.wetBulb}</span>
                            {s.wetBulbNote && <span className="text-[11px] text-slate-400">· {s.wetBulbNote}</span>}
                        </span>
                        <span className="flex flex-wrap items-baseline gap-x-2.5">
                            <span className="text-[26px] font-semibold tracking-tight tabular-nums text-white">{tempText(wetTile.station.value, unit, lang)}</span>
                            <span className="text-[13px] text-slate-200">{placeLabel(wetTile.station, lang)}</span>
                        </span>
                        <WetBulbBar valueC={wetTile.station.value} unit={unit} labels={{ danger: s.danger, limit: s.limit }} />
                    </button>
                )}

                {tiles.length > 0 && (
                    <div className="grid grid-cols-2 gap-2.5">
                        {tiles.map(({ key, station }) => {
                            const note = recordNote(key, station, s, lang);
                            return (
                                <button
                                    key={key}
                                    type="button"
                                    onClick={() => onOpen({ kind: 'record', record: key })}
                                    className="relative flex min-w-0 flex-col gap-1 rounded-xl border border-white/[0.1] bg-white/[0.03] p-3 text-left cursor-pointer transition-colors hover:bg-white/[0.06] focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/60"
                                >
                                    <ChevronRight aria-hidden="true" className="absolute right-2 top-3 w-3.5 h-3.5 text-slate-400" />
                                    <span className="flex items-center gap-1.5 pr-5">{RECORD_ICONS[key]}<span className={LABEL}>{recordLabel(key, s)}</span></span>
                                    <span className="text-2xl font-semibold tracking-tight tabular-nums text-white">{valueText(key, station, unit, lang)}</span>
                                    <span className="text-[12.5px] leading-snug text-slate-300 break-words">{placeLabel(station, lang)}</span>
                                    {note && <span className="text-[11.5px] text-slate-400">{note}</span>}
                                </button>
                            );
                        })}
                    </div>
                )}

                {chips.length > 0 && (
                    <div className="flex flex-col gap-2">
                        <span className={LABEL}>{s.activeNow}</span>
                        <div className="flex flex-wrap gap-1.5">
                            {chips.map((chip) => (
                                <button
                                    key={chip.key}
                                    type="button"
                                    onClick={() => onOpen(chip.entry)}
                                    className={`inline-flex min-h-[36px] items-center gap-1.5 rounded-full border px-3 text-[13px] font-medium text-slate-100 cursor-pointer transition-colors hover:bg-white/[0.06] focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/60 ${chip.tone.border} ${chip.tone.bg}`}
                                >
                                    {chip.icon}{chip.text}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {metar && (
                    <div className="flex items-center justify-between gap-3 border-t border-white/[0.08] pt-1">
                        <span className="flex flex-col font-mono text-[11px] leading-relaxed tracking-[0.04em] text-slate-400">
                            <span>{fill(s.stations, { n: formatInteger(metar.stations, lang) })}</span>
                            {ageText && <span>{ageText}</span>}
                        </span>
                        <button
                            type="button"
                            onClick={() => onOpen({ kind: 'list', tab: 'records' })}
                            className="inline-flex shrink-0 items-center gap-1 min-h-[44px] text-[13.5px] font-semibold text-cyan-300 hover:text-cyan-200 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/60 rounded-lg px-1"
                        >
                            {s.allDetail}<ChevronRight aria-hidden="true" className="w-4 h-4" />
                        </button>
                    </div>
                )}
            </div>
        </section>
    );
}

// --- El protagonista del dia --------------------------------------------------------------------------------

interface ProtagonistHeroProps {
    protagonist: Protagonist;
    s: PlanetStrings;
    lang: Language;
    unit: WeatherUnit;
    onOpen: (entry: PlanetEntry) => void;
}

function ProtagonistHero({ protagonist, s, lang, unit, onOpen }: ProtagonistHeroProps) {
    let icon: ReactNode;
    let title: string;
    let line: string;
    let value: string | null = null;
    let extra: ReactNode = null;
    let reason: string;
    let entry: PlanetEntry;

    switch (protagonist.kind) {
        case 'cyclone': {
            const summary = protagonist.summary;
            icon = <CycloneIcon className="w-6 h-6 text-rose-400" />;
            title = `${s.kinds[summary.kind]} ${summary.cyclone.name}`;
            line = [fill(s.category, { n: summary.category }), kmhText(summary.last.windKt * KMH_PER_KT), s.basins[summary.basin]].join(' · ');
            extra = <CycloneSparkline summary={summary} s={s} />;
            reason = s.reasons.cyclone;
            entry = { kind: 'cyclone', id: summary.cyclone.id };
            break;
        }
        case 'wetBulb':
            icon = <Droplets className="w-6 h-6 text-rose-300" />;
            title = s.wetBulb;
            value = tempText(protagonist.station.value, unit, lang);
            line = placeLabel(protagonist.station, lang);
            extra = <WetBulbBar valueC={protagonist.station.value} unit={unit} labels={{ danger: s.danger, limit: s.limit }} />;
            reason = fill(s.reasons.wetBulb, { t: tempText(WET_BULB_DANGER_C, unit, lang) });
            entry = { kind: 'record', record: 'wetBulb' };
            break;
        case 'alert': {
            const { alert, cycloneId } = protagonist;
            icon = alert.type === 'TC' ? <CycloneIcon className="w-6 h-6 text-rose-400" />
                : alert.type === 'FL' ? <Waves className="w-6 h-6 text-rose-300" />
                    : alert.type === 'WF' ? <Flame className="w-6 h-6 text-rose-300" />
                        : <Mountain className="w-6 h-6 text-rose-300" />;
            title = alertTitle(alert, s, lang);
            line = [
                alert.type === 'TC' || alert.type === 'VO' ? countryName(alert.country, lang) : null,
                s.alertLevels[alert.level],
                alert.from ? fill(s.since, { date: shortDate(alert.from, lang) }) : null,
            ].filter(Boolean).join(' · ');
            reason = s.reasons.alert;
            entry = cycloneId ? { kind: 'cyclone', id: cycloneId } : { kind: 'list', tab: 'events' };
            break;
        }
        default: {
            const { record, station } = protagonist;
            icon = record === 'gust' ? <Wind className="w-6 h-6 text-rose-300" /> : record === 'lowPressure' ? <Gauge className="w-6 h-6 text-rose-300" /> : <Thermometer className="w-6 h-6 text-rose-300" />;
            title = s.recordTitles[record];
            value = valueText(record, station, unit, lang);
            line = placeLabel(station, lang);
            reason = fill(s.reasons[record], { t: tempText(station.value, unit, lang), v: kmhText(station.value), p: hpaText(station.value) });
            entry = { kind: 'record', record };
        }
    }

    return (
        <div className="flex flex-col gap-2">
            <span className="font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-rose-300">{s.highlight}</span>
            <button
                type="button"
                onClick={() => onOpen(entry)}
                className="flex flex-col gap-3 rounded-[14px] border border-rose-400/50 bg-rose-400/[0.07] p-3.5 text-left cursor-pointer transition-colors hover:bg-rose-400/[0.11] focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-300/60"
            >
                <span className="flex items-center gap-3">
                    <span aria-hidden="true" className="flex h-11 w-11 flex-none items-center justify-center rounded-xl bg-rose-400/[0.16]">{icon}</span>
                    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                        <span className="text-[21px] font-bold leading-tight tracking-tight text-white">{title}</span>
                        <span className="text-[13px] text-rose-200">{line}</span>
                    </span>
                    <ChevronRight aria-hidden="true" className="w-[18px] h-[18px] flex-none text-rose-200" />
                </span>
                {value && <span className="text-4xl font-light tracking-tight tabular-nums text-white">{value}</span>}
                {extra}
            </button>
            <p className="text-xs leading-snug text-slate-400">{reason}</p>
        </div>
    );
}

/** La corba del vent del cicló en petit, amb la intensificació ràpida en vermell. */
function CycloneSparkline({ summary, s }: { summary: CycloneSummary; s: PlanetStrings }) {
    const track = summary.cyclone.track;
    if (track.length < 2) return null;
    const W = 150, H = 36;
    const kmh = (kt: number) => kt * KMH_PER_KT;
    const yMax = Math.max(260, kmh(summary.peak.windKt) + 20);
    const t0 = Date.parse(track[0].time);
    const span = Math.max(1, Date.parse(summary.last.time) - t0);
    const x = (iso: string) => 3 + ((Date.parse(iso) - t0) / span) * (W - 6);
    const y = (kt: number) => H - 2 - (kmh(kt) / yMax) * (H - 6);
    const points = track.map((p) => `${x(p.time).toFixed(1)},${y(p.windKt).toFixed(1)}`).join(' ');
    const start = summary.maxGainStart;
    const rapid = start && summary.maxGain24hKt !== null && summary.maxGain24hKt >= RAPID_INTENSIFICATION_KT
        ? track.filter((p) => Date.parse(p.time) >= Date.parse(start.time) && Date.parse(p.time) <= Date.parse(start.time) + 24 * 3600 * 1000)
        : [];
    const lastTimeUtc = new Date(summary.last.time).toISOString().slice(11, 16);
    return (
        <span className="flex items-end justify-between gap-3">
            <svg aria-hidden="true" width={W} height={H} viewBox={`0 0 ${W} ${H}`} fill="none">
                <path d={`M3 ${H - 2}H${W - 3}`} stroke="#94a3b8" strokeOpacity="0.35" />
                <polyline points={points} stroke="#e2e8f0" strokeWidth="1.6" strokeLinejoin="round" />
                {rapid.length > 1 && <polyline points={rapid.map((p) => `${x(p.time).toFixed(1)},${y(p.windKt).toFixed(1)}`).join(' ')} stroke="#f87171" strokeWidth="2.6" strokeLinejoin="round" strokeLinecap="round" />}
                <circle cx={x(summary.last.time)} cy={y(summary.last.windKt)} r="3" fill="#f87171" stroke="#05070c" strokeWidth="1.2" />
            </svg>
            <span className="text-right font-mono text-[11px] leading-relaxed text-slate-400">
                {rapid.length > 1 && <span className="block">+{kmhText(kmh(summary.maxGain24hKt ?? 0))} / 24 h</span>}
                <span className="block">{fill(s.dataFrom, { time: lastTimeUtc })}</span>
            </span>
        </span>
    );
}
