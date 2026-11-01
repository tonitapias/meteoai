// src/components/planet/RecordSheet.tsx
// La fitxa d'un rècord de les estacions (la calor humida, el més calent, el més fred, la ratxa o la pressió més
// baixa): el valor amb l'estació i quan es va mesurar, el podi, i tres capes per entendre'l: què és, per què passa
// aquí ara (fets calculats a partir de les dades) i què hi té a veure l'escalfament. La de la calor humida té, a
// més, l'escala del cos en paraules. Acaba amb el botó per veure-ho des de l'òrbita.
import type { Ref } from 'react';
import { Sun, Snowflake, Wind, Droplets, Mountain, Gauge } from 'lucide-react';
import type { Language } from '../../translations';
import type { WeatherUnit } from '../../utils/formatters';
import type { MetarRecords, StationRecord } from '../../services/planetExtremesApi';
import { distanceKm } from '../../utils/geoDistance';
import {
    recordRanking, minutesAgo, isWetBulbTie, wetBulbMarginC, wetBulbScalePct, solarPeriod, solarTime, isPolarNight, isPolarDay,
    placeLabel, placeInline, formatInteger, WET_BULB_CAUTION_C, WET_BULB_DANGER_C, WET_BULB_LIMIT_C, MOUNTAIN_ELEVATION_M,
    HIGH_ELEVATION_M, CIRCUMPOLAR_TROUGH_LAT, CYCLONE_NEAR_KM, DEEP_LOW_HPA, type CycloneSummary, type RecordKey,
} from '../../utils/planetExtremes';
import { fill, type PlanetStrings } from './planetI18n';
import type { RecordStrings } from './planetRecordsI18n';
import { tempText, tempDeltaText, kmhText, hpaText, recordValueText } from './planetFormat';
import { CycloneIcon, OrbitButton, SheetCard, SheetTitle, WarmingBlock, WhyList, type WhyItem } from './PlanetBits';

interface RecordSheetProps {
    record: RecordKey;
    metar: MetarRecords;
    summaries: CycloneSummary[];
    s: PlanetStrings;
    r: RecordStrings;
    lang: Language;
    unit: WeatherUnit;
    nowMs: number;
    onOrbit: () => void;
    orbitButtonRef?: Ref<HTMLButtonElement>;
}

export default function RecordSheet({ record, metar, summaries, s, r, lang, unit, nowMs, onOrbit, orbitButtonRef }: RecordSheetProps) {
    const ranking = recordRanking(metar, record);
    const top = ranking[0];
    if (!top) return <p className="text-sm text-slate-400">{s.unavailable}</p>;

    const isWetBulb = record === 'wetBulb';
    const tie = isWetBulb && ranking.length > 1 && isWetBulbTie(top, ranking[1]);
    const warming = r.warming[record];
    const hourUtc = new Date(top.time).toISOString().slice(11, 16);
    const meta = [top.id, top.elevM !== null ? `${formatInteger(top.elevM, lang)} m` : null, fill(r.measured, { time: hourUtc, min: minutesAgo(top.time, nowMs) })]
        .filter(Boolean).join(' · ');

    return (
        <div className="space-y-4">
            <div className="flex flex-col gap-1 px-1">
                <span className="text-5xl font-light tracking-tighter tabular-nums leading-none text-white">{recordValueText(record, top.value, unit, lang)}</span>
                <span className="mt-2 text-[17px] font-semibold text-slate-100">{placeLabel(top, lang)}</span>
                {isWetBulb && top.tempC !== undefined && top.dewC !== undefined && (
                    <span className="text-[13px] text-slate-300">{fill(s.tempDew, { t: tempText(top.tempC, unit, lang), td: tempText(top.dewC, unit, lang) })}</span>
                )}
                {record === 'lowPressure' && <span className="text-[13px] text-slate-300">{s.seaLevel}</span>}
                <span className="mt-0.5 font-mono text-[11px] uppercase tracking-[0.06em] text-slate-400">{meta}</span>
            </div>

            {isWetBulb && <WetBulbScale valueC={top.value} unit={unit} lang={lang} s={s} r={r} />}

            <SheetCard label={r.podium[record]}>
                <SheetTitle>{r.podium[record]}</SheetTitle>
                <ol className="flex flex-col gap-1.5 text-[13.5px] tabular-nums">
                    {ranking.map((station, i) => (
                        <li key={station.id} className="flex items-baseline gap-2.5">
                            <span className="w-4 flex-none text-slate-400">{i + 1}</span>
                            <span className={`min-w-0 flex-1 truncate ${i === 0 ? 'text-white' : 'text-slate-200'}`}>{placeLabel(station, lang)}</span>
                            <span className="flex-none font-bold text-white">{recordValueText(record, station.value, unit, lang, isWetBulb ? 1 : 0)}</span>
                        </li>
                    ))}
                </ol>
                {tie && (
                    <p className="text-[12.5px] leading-snug text-slate-300">
                        {fill(r.tieExplain, { m: tempDeltaText(wetBulbMarginC(top), unit, lang, 1) })}
                    </p>
                )}
            </SheetCard>

            <SheetCard label={r.whatTitle}>
                <SheetTitle>{r.whatTitle}</SheetTitle>
                {r.what[record].map((paragraph) => (
                    <p key={paragraph.slice(0, 24)} className="text-[13.5px] leading-relaxed text-slate-300">{paragraph}</p>
                ))}
            </SheetCard>

            <WhyCard record={record} metar={metar} summaries={summaries} s={s} r={r} lang={lang} unit={unit} />

            <WarmingBlock title={s.warmingTitle} badge={warming.badge} text={warming.text} source={warming.source} />

            <OrbitButton label={fill(s.orbitFor, { what: top.name ?? placeLabel(top, lang) })} onClick={onOrbit} buttonRef={orbitButtonRef} />
        </div>
    );
}

// --- L'escala de la calor humida, en paraules ----------------------------------------------------------------

const ZONE_SWATCH = ['bg-slate-600', 'bg-amber-400/70', 'bg-orange-400/80', 'bg-rose-400/90'];

function WetBulbScale({ valueC, unit, lang, s, r }: { valueC: number; unit: WeatherUnit; lang: Language; s: PlanetStrings; r: RecordStrings }) {
    const bounds = [WET_BULB_CAUTION_C, WET_BULB_DANGER_C, WET_BULB_LIMIT_C];
    const zone = bounds.filter((b) => valueC >= b).length;
    const num = (c: number) => String(Math.round(unit === 'F' ? (c * 9) / 5 + 32 : c));
    const ranges = [
        `< ${tempText(bounds[0], unit, lang)}`,
        `${num(bounds[0])}–${tempText(bounds[1], unit, lang)}`,
        `${num(bounds[1])}–${tempText(bounds[2], unit, lang)}`,
        `≥ ${tempText(bounds[2], unit, lang)}`,
    ];
    const pct = (c: number) => wetBulbScalePct(c);
    return (
        <SheetCard label={r.bodyTitle}>
            <SheetTitle>{r.bodyTitle}</SheetTitle>
            <div aria-hidden="true" className="flex flex-col gap-1.5">
                <div className="relative h-2.5 rounded-full overflow-hidden bg-slate-600">
                    <span className="absolute inset-y-0 bg-amber-400/55" style={{ left: `${pct(bounds[0])}%`, width: `${pct(bounds[1]) - pct(bounds[0])}%` }} />
                    <span className="absolute inset-y-0 bg-orange-400/75" style={{ left: `${pct(bounds[1])}%`, width: `${pct(bounds[2]) - pct(bounds[1])}%` }} />
                    <span className="absolute inset-y-0 right-0 bg-rose-400/90" style={{ left: `${pct(bounds[2])}%` }} />
                </div>
                <div className="relative h-0">
                    <span className="absolute -top-[15px] h-4 w-4 -translate-x-1/2 rounded-full border-[2.5px] border-slate-100 bg-[#05070c]" style={{ left: `${pct(valueC)}%` }} />
                </div>
                <div className="relative mt-1 h-3.5 font-mono text-[11px] text-slate-400">
                    {bounds.map((b) => (
                        <span key={b} className="absolute -translate-x-1/2" style={{ left: `${pct(b)}%` }}>{num(b)}</span>
                    ))}
                </div>
            </div>
            <ul className="flex flex-col gap-1">
                {r.zones.map((text, i) => (
                    <li
                        key={ranges[i]}
                        aria-current={i === zone ? 'true' : undefined}
                        className={`grid grid-cols-[12px_68px_minmax(0,1fr)] items-start gap-2.5 rounded-[10px] px-2 py-1.5 text-[12.5px] leading-snug ${i === zone ? 'border border-amber-400/50 bg-amber-400/[0.08] text-slate-100' : 'border border-transparent text-slate-300'}`}
                    >
                        <span className={`mt-[3px] h-3 w-3 rounded-[3px] ${ZONE_SWATCH[i]}`} />
                        <span className={`font-mono text-[11.5px] ${i === zone ? 'text-amber-100' : 'text-slate-300'}`}>{ranges[i]}</span>
                        <span>
                            {text}
                            {i === zone && <span className="font-bold text-amber-200">{` ${r.zonesNow}`}</span>}
                        </span>
                    </li>
                ))}
            </ul>
            <p className="text-[11.5px] leading-relaxed text-slate-400">
                {fill(r.zonesSource, { a: tempText(WET_BULB_DANGER_C, unit, lang), b: tempText(WET_BULB_LIMIT_C, unit, lang) })}
            </p>
            <span className="sr-only">{`${s.wetBulb}: ${tempText(valueC, unit, lang)}. ${ranges[zone]}: ${r.zones[zone]}`}</span>
        </SheetCard>
    );
}

// --- Per què aquí ara --------------------------------------------------------------------------------------

interface WhyCardProps {
    record: RecordKey;
    metar: MetarRecords;
    summaries: CycloneSummary[];
    s: PlanetStrings;
    r: RecordStrings;
    lang: Language;
    unit: WeatherUnit;
}

/** Els fets que expliquen el rècord, calculats a partir de les dades. Sense cap fet que ho expliqui, no hi és. */
function recordWhy({ record, metar, summaries, s, r, lang, unit }: WhyCardProps): WhyItem[] {
    const station: StationRecord | undefined = recordRanking(metar, record)[0];
    if (!station) return [];
    const items: WhyItem[] = [];
    const place = placeInline(station, lang);
    const elev = station.elevM;

    switch (record) {
        case 'wetBulb': {
            const hour = r.why.wetBulbHour[solarPeriod(station.time, station.lon)];
            items.push({ key: 'hour', icon: <Sun className="w-[15px] h-[15px] text-orange-400" />, lead: fill(hour.lead, { time: solarTime(station.time, station.lon) }), text: hour.text });
            if (station.dewC !== undefined) {
                items.push({ key: 'dew', icon: <Droplets className="w-[15px] h-[15px] text-amber-300" />, lead: r.why.wetBulbDew.lead, text: fill(r.why.wetBulbDew.text, { td: tempText(station.dewC, unit, lang) }) });
            }
            break;
        }
        case 'hottest':
            items.push({
                key: 'sun', icon: <Sun className="w-[15px] h-[15px] text-orange-400" />, lead: s.whyHottestLead,
                text: fill(s.whyHottest[solarPeriod(station.time, station.lon)], { place, time: solarTime(station.time, station.lon) }),
            });
            break;
        case 'coldest': {
            const date = new Date(station.time);
            const icon = <Snowflake className="w-[15px] h-[15px] text-sky-300" />;
            if (isPolarNight(station.lat, date)) {
                items.push({ key: 'polar', icon, lead: s.whyPolarLead, text: fill(s.whyPolar, { place }) });
            } else if (elev !== null && elev >= HIGH_ELEVATION_M && isPolarDay(station.lat, date)) {
                items.push({ key: 'polarDay', icon, lead: r.why.polarDay.lead, text: fill(r.why.polarDay.text, { elev: formatInteger(elev, lang) }) });
            } else if (elev !== null && elev >= HIGH_ELEVATION_M) {
                items.push({ key: 'high', icon: <Mountain className="w-[15px] h-[15px] text-sky-300" />, lead: r.why.high.lead, text: fill(r.why.high.text, { elev: formatInteger(elev, lang) }) });
            } else if (Math.abs(station.lat) >= 40) {
                items.push({ key: 'continental', icon, lead: r.why.continental.lead, text: r.why.continental.text });
            }
            break;
        }
        case 'gust': {
            if (elev !== null && elev >= MOUNTAIN_ELEVATION_M) {
                items.push({ key: 'summit', icon: <Mountain className="w-[15px] h-[15px] text-indigo-300" />, lead: fill(s.whyGustLead, { v: kmhText(station.value), elev: formatInteger(elev, lang) }), text: s.whyGust });
                break;
            }
            const near = summaries
                .map((summary) => ({ summary, d: distanceKm(station.lat, station.lon, summary.last.lat, summary.last.lon) }))
                .filter(({ d }) => d <= CYCLONE_NEAR_KM)
                .sort((a, b) => a.d - b.d)[0];
            if (near) {
                items.push({
                    key: 'cyclone', icon: <CycloneIcon className="w-[15px] h-[15px] text-rose-400" />, lead: r.why.gustCyclone.lead,
                    text: fill(r.why.gustCyclone.text, { d: formatInteger(Math.round(near.d / 10) * 10, lang), ofCyclone: `${s.ofKinds[near.summary.kind]} ${near.summary.cyclone.name}` }),
                });
            } else {
                items.push({ key: 'storm', icon: <Wind className="w-[15px] h-[15px] text-indigo-300" />, lead: r.why.gustStorm.lead, text: r.why.gustStorm.text });
            }
            break;
        }
        case 'lowPressure': {
            if (station.lat <= CIRCUMPOLAR_TROUGH_LAT) {
                items.push({ key: 'trough', icon: <Gauge className="w-[15px] h-[15px] text-violet-300" />, lead: r.why.circumpolar.lead, text: fill(r.why.circumpolar.text, { p: hpaText(station.value) }) });
            }
            const strongest = summaries[0];
            if (strongest && strongest.category >= 1) {
                items.push({
                    key: 'eye', icon: <CycloneIcon className="w-[15px] h-[15px] text-rose-400" />,
                    lead: fill(s.whyLowCycloneLead, { ofCyclone: `${s.ofKinds[strongest.kind]} ${strongest.cyclone.name}` }),
                    text: fill(s.whyLowCyclone, { p: hpaText(station.value), place }),
                });
            } else if (station.value < DEEP_LOW_HPA && station.lat > CIRCUMPOLAR_TROUGH_LAT) {
                items.push({ key: 'deep', icon: <CycloneIcon className="w-[15px] h-[15px] text-violet-300" />, lead: fill(s.whyLowDeepLead, { p: hpaText(station.value), place }), text: s.whyLowDeep });
            }
            break;
        }
    }
    return items;
}

function WhyCard(props: WhyCardProps) {
    const items = recordWhy(props);
    if (items.length === 0) return null;
    return (
        <SheetCard label={props.r.whyTitle}>
            <SheetTitle>{props.r.whyTitle}</SheetTitle>
            <WhyList items={items} />
        </SheetCard>
    );
}
