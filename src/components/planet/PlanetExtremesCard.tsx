// src/components/planet/PlanetExtremesCard.tsx
// Secció «Més enllà del teu cel», al final de la Vista completa: els rècords d'ara mateix de les estacions de
// tot el món (amb el bulb humit de protagonista: la mesura de la calor que de debò és perillosa) i el recompte
// dels fenòmens extrems actius. El detall s'obre a PlanetExtremesModal.
import type { ReactNode } from 'react';
import { Globe, Thermometer, Snowflake, Wind, Gauge, Flame, Waves, Mountain, ChevronRight } from 'lucide-react';
import type { Language } from '../../translations';
import { getSafeLocale, type WeatherUnit } from '../../utils/formatters';
import { usePlanetExtremes } from '../../hooks/usePlanetExtremes';
import type { StationRecord } from '../../services/planetExtremesApi';
import { placeLabel, formatInteger, WET_BULB_DANGER_C, WET_BULB_LIMIT_C, type PlanetTab } from '../../utils/planetExtremes';
import { PLANET_STRINGS, fill, plural } from './planetI18n';
import { CycloneIcon, WetBulbBar } from './PlanetBits';
import { tempText, tempDeltaText, kmhText, hpaText } from './planetFormat';

interface PlanetExtremesCardProps {
    lang: Language;
    unit: WeatherUnit;
    onOpen: (tab: PlanetTab) => void;
}

const timeOf = (iso: string, lang: Language) =>
    new Date(iso).toLocaleTimeString(getSafeLocale(lang), { hour: '2-digit', minute: '2-digit' });

interface TileProps {
    icon: ReactNode;
    label: string;
    value: string;
    record: StationRecord;
    lang: Language;
}

const Tile = ({ icon, label, value, record, lang }: TileProps) => (
    <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-3 flex flex-col gap-1 min-w-0">
        <span className="flex items-center gap-1.5 font-mono text-[9.5px] font-bold uppercase tracking-[0.14em] text-slate-400">
            {icon}{label}
        </span>
        <span className="text-2xl font-semibold tracking-tight tabular-nums text-white">{value}</span>
        <span className="text-xs leading-snug text-slate-300 break-words">{placeLabel(record, lang)}</span>
    </div>
);

export default function PlanetExtremesCard({ lang, unit, onOpen }: PlanetExtremesCardProps) {
    const s = PLANET_STRINGS[lang] ?? PLANET_STRINGS.ca;
    const { status, data } = usePlanetExtremes();

    const metar = data?.metar ?? null;
    const events = data?.events ?? null;
    const cyclones = data?.cyclones?.cyclones ?? null;
    const wetBulb = metar?.wetBulb[0];
    const hottest = metar?.hottest[0];
    const coldest = metar?.coldest[0];
    const gust = metar?.gustKmh[0];
    const low = metar?.lowPressure[0];
    const nothing = status === 'error' || (status === 'ready' && !metar && !events && !cyclones);

    const margin = wetBulb
        ? wetBulb.value >= WET_BULB_LIMIT_C ? s.marginLimit
            : wetBulb.value >= WET_BULB_DANGER_C ? s.marginAbove
                : fill(s.marginBelow, { d: tempDeltaText(WET_BULB_DANGER_C - wetBulb.value, unit) })
        : null;

    const chips: { key: string; icon: ReactNode; text: string; tone: string }[] = [];
    if (cyclones && cyclones.length > 0) chips.push({ key: 'tc', icon: <CycloneIcon className="w-3.5 h-3.5 text-rose-400" />, text: plural(cyclones.length, s.cyclonesOne, s.cyclonesMany), tone: 'border-rose-400/40 bg-rose-400/[0.08]' });
    if (events && events.fires.count > 0) chips.push({ key: 'wf', icon: <Flame className="w-3.5 h-3.5 text-orange-400" />, text: plural(events.fires.count, s.firesOne, s.firesMany), tone: 'border-orange-400/40 bg-orange-400/[0.08]' });
    if (events && events.floods.count > 0) chips.push({ key: 'fl', icon: <Waves className="w-3.5 h-3.5 text-amber-300" />, text: plural(events.floods.count, s.floodsOne, s.floodsMany), tone: 'border-amber-300/40 bg-amber-300/[0.08]' });
    if (events && events.volcanoes.length > 0) chips.push({ key: 'vo', icon: <Mountain className="w-3.5 h-3.5 text-red-300" />, text: plural(events.volcanoes.length, s.volcanoesOne, s.volcanoesMany), tone: 'border-red-300/40 bg-red-300/[0.08]' });

    return (
        <section aria-labelledby="planet-extremes-title" className="flex flex-col gap-2">
            <span className="ml-1 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">{s.eyebrow}</span>
            <div className="rounded-2xl bg-white/5 border border-white/10 shadow-lg p-4 sm:p-5 flex flex-col gap-4">
                <div className="flex items-center justify-between gap-3">
                    <h2 id="planet-extremes-title" className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-300">
                        <Globe aria-hidden="true" className="w-4 h-4 text-cyan-300" />
                        {s.title}
                    </h2>
                    {metar && (
                        <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-slate-400">{s.now} · {timeOf(metar.updatedAt, lang)}</span>
                    )}
                </div>

                {status === 'loading' && <p className="text-sm text-slate-400">{s.loading}</p>}
                {nothing && <p className="text-sm text-slate-400">{s.unavailable}</p>}

                {metar && (
                    <div className="grid gap-4 md:grid-cols-2 md:gap-6">
                        {wetBulb && (
                            <div className="flex flex-col gap-1.5">
                                <span className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-amber-300">{s.wetBulbTop}</span>
                                {s.wetBulbTerm && <span className="text-[11px] text-slate-400">{s.wetBulbTerm}</span>}
                                <span className="text-5xl font-light tracking-tighter tabular-nums leading-none text-white mt-1">
                                    {tempText(wetBulb.value, unit, lang, 1)}
                                </span>
                                <span className="text-[15px] font-semibold text-slate-100 mt-1">{placeLabel(wetBulb, lang)}</span>
                                {wetBulb.tempC !== undefined && wetBulb.dewC !== undefined && (
                                    <span className="text-xs text-slate-400">
                                        {fill(s.tempDew, { t: tempText(wetBulb.tempC, unit, lang), td: tempText(wetBulb.dewC, unit, lang) })}
                                    </span>
                                )}
                                <div className="mt-2">
                                    <WetBulbBar valueC={wetBulb.value} unit={unit} lang={lang} labels={{ danger: s.danger, limit: s.limit }} />
                                </div>
                                {margin && <p className="text-[13px] leading-snug text-slate-300 mt-1">{margin}</p>}
                            </div>
                        )}

                        <div className="grid grid-cols-2 gap-2.5 content-start">
                            {hottest && <Tile icon={<Thermometer aria-hidden="true" className="w-3.5 h-3.5 text-orange-400" />} label={s.hottest} value={tempText(hottest.value, unit, lang)} record={hottest} lang={lang} />}
                            {coldest && <Tile icon={<Snowflake aria-hidden="true" className="w-3.5 h-3.5 text-sky-300" />} label={s.coldest} value={tempText(coldest.value, unit, lang)} record={coldest} lang={lang} />}
                            {gust && <Tile icon={<Wind aria-hidden="true" className="w-3.5 h-3.5 text-indigo-300" />} label={s.gust} value={kmhText(gust.value)} record={gust} lang={lang} />}
                            {low && <Tile icon={<Gauge aria-hidden="true" className="w-3.5 h-3.5 text-violet-300" />} label={s.lowPressure} value={hpaText(low.value)} record={low} lang={lang} />}
                        </div>
                    </div>
                )}

                {chips.length > 0 && (
                    <button
                        type="button"
                        onClick={() => onOpen('events')}
                        className="flex flex-col gap-2 text-left rounded-xl -mx-1 px-1 py-1 min-h-[44px] cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/60"
                    >
                        <span className="font-mono text-[9.5px] font-bold uppercase tracking-[0.14em] text-slate-400">{s.activeNow}</span>
                        <span className="flex flex-wrap gap-1.5">
                            {chips.map((chip) => (
                                <span key={chip.key} className={`inline-flex items-center gap-1.5 h-[30px] rounded-full border px-2.5 text-[12.5px] font-medium text-slate-100 ${chip.tone}`}>
                                    {chip.icon}{chip.text}
                                </span>
                            ))}
                        </span>
                    </button>
                )}

                {metar && (
                    <div className="flex items-center justify-between gap-3 border-t border-white/[0.08] pt-1">
                        <span className="font-mono text-[9.5px] uppercase tracking-[0.08em] text-slate-400">
                            {s.sources} · {fill(s.stations, { n: formatInteger(metar.stations, lang) })}
                        </span>
                        <button
                            type="button"
                            onClick={() => onOpen('records')}
                            className="inline-flex shrink-0 items-center gap-1 min-h-[44px] text-[13px] font-semibold text-cyan-300 hover:text-cyan-200 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/60 rounded-lg px-1"
                        >
                            {s.detail}<ChevronRight aria-hidden="true" className="w-4 h-4" />
                        </button>
                    </div>
                )}
            </div>
        </section>
    );
}
