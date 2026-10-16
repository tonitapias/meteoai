import { useId, useMemo } from 'react';
import { Mountain, CloudOff, Snowflake, Thermometer } from 'lucide-react';
import { WidgetProps } from './widgetTypes';
import { WIDGET_BASE_STYLE, TITLE_STYLE, MATRIX_BG } from './widgetStyles';
import { getTrans } from './widgetHelpers';
import { Language } from '../../translations';
import { buildSnowLevelWindow } from '../../utils/snowLevelWindow';

// Giny panoràmic: ocupa tota l'última fila de la graella (vegeu `fullRow` a ExpertWidgets), així que
// a l'esquerra hi ha la xifra d'ara i la mínima de 48 h, i a la dreta un perfil altitud × temps on la
// muntanya queda nevada per sobre de la cota. Sense blur ni animacions infinites (mòbils modestos).

const T: Record<Language, Record<string, string>> = {
    ca: { now: 'Ara', metres: 'METRES', feet: 'PEUS', noData: 'SENSE DADES', freezing: '0 °C', min48: 'Mínima 48 h', inH: "d'aquí a {h} h", nowLower: 'ara mateix', here: 'Aquí', end: '+48 h' },
    es: { now: 'Ahora', metres: 'METROS', feet: 'PIES', noData: 'SIN DATOS', freezing: '0 °C', min48: 'Mínima 48 h', inH: 'dentro de {h} h', nowLower: 'ahora mismo', here: 'Aquí', end: '+48 h' },
    en: { now: 'Now', metres: 'METERS', feet: 'FEET', noData: 'NO DATA', freezing: '0 °C', min48: '48 h minimum', inH: 'in {h} h', nowLower: 'right now', here: 'Here', end: '+48 h' },
    fr: { now: 'Maintenant', metres: 'MÈTRES', feet: 'PIEDS', noData: 'PAS DE DONNÉES', freezing: '0 °C', min48: 'Minimum 48 h', inH: 'dans {h} h', nowLower: "à l'instant", here: 'Ici', end: '+48 h' },
};

// Silueta decorativa (coordenades del viewBox 0-100); el tros que queda per sobre de la cota es pinta nevat.
const MOUNTAIN_PATH = 'M0,100 L0,74 L7,66 L13,71 L22,48 L29,58 L36,52 L46,26 L53,40 L59,34 L68,56 L76,44 L84,62 L91,54 L100,64 L100,100 Z';

const PLOT_TOP = 8;
const PLOT_BOTTOM = 90;

// Pas "rodó" perquè l'eix tingui 1-3 línies interiors, en la unitat que es mostra (m o peus).
const STEPS = [50, 100, 200, 250, 500, 1000, 2000, 2500, 5000];
const niceStep = (range: number) => STEPS.find(s => range / s <= 4) ?? 10000;

export const SnowLevelWidget = ({ freezingLevel, unit, lang, chartData, elevation }: WidgetProps) => {
    const safeLang: Language = T[lang as Language] ? (lang as Language) : 'ca';
    const t = T[safeLang];
    const tGlobal = getTrans(lang) as Record<string, unknown>;
    const tTitle = typeof tGlobal.snowLevel === 'string' ? tGlobal.snowLevel : 'COTA NEU';
    // useId porta caràcters (":", "«") que no sempre sobreviuen dins d'un url(#...) d'SVG.
    const gradientId = `snowlvl-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;

    // Risc Zero: Validació estricta abans de cap càlcul termodinàmic
    const hasValidData = typeof freezingLevel === 'number' && !isNaN(freezingLevel);
    // El límit de neu sol situar-se uns 300m per sota de la isoterma 0ºC (mateix càlcul que el modal).
    const snowLimit = hasValidData ? Math.max(0, freezingLevel - 300) : null;

    const isFt = unit === 'imperial' || unit === 'F';
    const toDisplay = (m: number) => Math.round(isFt ? m * 3.28084 : m);
    const unitLabel = isFt ? t.feet : t.metres;
    const unitShort = isFt ? 'ft' : 'm';
    const displayLevel = snowLimit !== null ? toDisplay(snowLimit) : '--';
    const hereM = typeof elevation === 'number' && isFinite(elevation) ? elevation : null;

    const { entries, min } = useMemo(() => buildSnowLevelWindow(chartData), [chartData]);

    const chart = useMemo(() => {
        const n = entries.length;
        const values = entries.map(e => e.snowLevel).filter((v): v is number => v !== null);
        if (n < 2 || values.length < 2) return null;

        // Domini en la unitat mostrada; inclou la teva altitud perquè la línia "Aquí" hi càpiga.
        const conv = (m: number) => (isFt ? m * 3.28084 : m);
        const pool = values.map(conv);
        if (hereM !== null) pool.push(conv(hereM));
        const lo = Math.min(...pool);
        const hi = Math.max(...pool);
        const pad = Math.max(isFt ? 300 : 100, (hi - lo) * 0.2);
        const step = niceStep(hi - lo + 2 * pad);
        const dMin = Math.max(0, Math.floor((lo - pad) / step) * step);
        const dMax = Math.ceil((hi + pad) / step) * step;
        // Marge a dalt i a baix: una cota de 0 m no s'ha d'enganxar a la vora del gràfic.
        const yOfDisplay = (v: number) => PLOT_BOTTOM - ((v - dMin) / (dMax - dMin)) * (PLOT_BOTTOM - PLOT_TOP);
        const yOf = (m: number) => yOfDisplay(conv(m));
        const xOf = (i: number) => (i / (n - 1)) * 100;

        // Trams continus (un forat de dades talla la línia en lloc d'inventar-se el tros que falta).
        const segments: { x: number; y: number }[][] = [];
        let current: { x: number; y: number }[] = [];
        entries.forEach((e, i) => {
            if (e.snowLevel === null) {
                if (current.length) segments.push(current);
                current = [];
                return;
            }
            current.push({ x: xOf(i), y: yOf(e.snowLevel) });
        });
        if (current.length) segments.push(current);

        const linePath = segments.map(seg => seg.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' ')).join(' ');
        // Zona de neu: del traç cap amunt fins al sostre del gràfic.
        const snowZonePath = segments
            .filter(seg => seg.length > 1)
            .map(seg => `M${seg[0].x.toFixed(2)},0 ${seg.map(p => `L${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' ')} L${seg[seg.length - 1].x.toFixed(2)},0 Z`)
            .join(' ');

        const ticks: { y: number; label: number }[] = [];
        for (let v = dMin + step; v < dMax; v += step) ticks.push({ y: yOfDisplay(v), label: v });

        const days: { x: number; label: string }[] = [];
        let prevDay = entries[0].timeStr.slice(8, 10);
        entries.forEach((e, i) => {
            const day = e.timeStr.slice(8, 10);
            if (i > 0 && day && day !== prevDay) days.push({ x: xOf(i), label: `${day}/${e.timeStr.slice(5, 7)}` });
            prevDay = day;
        });

        const first = entries[0].snowLevel;
        return {
            linePath,
            snowZonePath,
            ticks,
            days,
            hereY: hereM !== null ? yOf(hereM) : null,
            nowPoint: first !== null ? { x: 0, y: yOf(first) } : null,
            minPoint: min && min.idx > 0 ? { x: xOf(min.idx), y: yOf(min.value) } : null,
        };
    }, [entries, min, isFt, hereM]);

    const minText = min
        ? `${toDisplay(min.value)} ${unitShort} · ${min.idx === 0 ? t.nowLower : t.inH.replace('{h}', String(min.idx))}`
        : null;

    const borderColor = hasValidData ? 'border-white/5' : 'border-slate-700/50';
    const SPATIAL_WIDGET_STYLE = `${WIDGET_BASE_STYLE} !justify-start relative overflow-hidden bg-gradient-to-br transition-colors duration-700 ${hasValidData ? 'from-sky-950/25 to-black/80' : 'from-slate-900/50 to-black/80'} border ${borderColor} shadow-[0_8px_32px_rgba(0,0,0,0.5)] p-3 sm:p-4 gap-3 select-none`;

    return (
        <div className={SPATIAL_WIDGET_STYLE}>
            {/* Matriu Tàctica */}
            <div className={MATRIX_BG}></div>

            {/* Capçalera: títol + isoterma 0 °C */}
            <div className="flex items-center justify-between gap-3 z-20 relative">
                <div className={`${TITLE_STYLE.replace('mb-4', 'mb-0')} flex items-center gap-1.5`}>
                    {hasValidData ? (
                        <Mountain className="w-4 h-4 text-sky-300" />
                    ) : (
                        <CloudOff className="w-4 h-4 text-slate-500" />
                    )}
                    <span className="tracking-wider text-slate-200">{tTitle}</span>
                </div>
                {hasValidData && (
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-sky-500/20 bg-black/40 shrink-0">
                        <Thermometer className="w-3 h-3 text-sky-300" />
                        <span className="text-[10px] font-mono font-bold text-sky-100 tabular-nums">{t.freezing} · {toDisplay(freezingLevel)} {unitShort}</span>
                    </div>
                )}
            </div>

            <div className="flex-1 flex flex-col sm:flex-row gap-3 sm:gap-5 z-10 relative min-h-0">
                {/* Xifra d'ara + mínima de les pròximes 48 h */}
                <div className="flex sm:flex-col items-center sm:items-start justify-between sm:justify-center gap-3 sm:gap-4 sm:w-48 lg:w-56 shrink-0 px-1">
                    <div className="flex flex-col">
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">{t.now}</span>
                        <span className={`text-4xl sm:text-5xl font-black tracking-tighter tabular-nums leading-none ${hasValidData ? 'text-white' : 'text-slate-600'}`}>
                            {displayLevel}
                        </span>
                        <span className={`text-[10px] font-black uppercase tracking-widest mt-1.5 ${hasValidData ? 'text-sky-200' : 'text-slate-500'}`}>
                            {hasValidData ? unitLabel : t.noData}
                        </span>
                    </div>
                    {minText && (
                        <div className="flex items-start gap-2 sm:pt-3 sm:border-t sm:border-white/5 sm:w-full">
                            <Snowflake className="w-3.5 h-3.5 text-rose-300 mt-0.5 shrink-0" />
                            <div className="flex flex-col">
                                <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">{t.min48}</span>
                                <span className="text-xs font-bold text-slate-100 tabular-nums">{minText}</span>
                            </div>
                        </div>
                    )}
                </div>

                {/* Perfil altitud × temps (decoratiu per a lectors de pantalla: les xifres ja hi són a l'esquerra) */}
                <div aria-hidden="true" className={`relative flex-1 flex flex-col min-h-[8rem] sm:min-h-[10rem] rounded-xl border overflow-hidden ${hasValidData ? 'bg-black/25 border-white/5' : 'bg-slate-900/40 border-slate-800/50'}`}>
                    <div className="relative flex-1">
                        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 w-full h-full">
                            <defs>
                                <linearGradient id={`${gradientId}-snow`} x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor="#e0f2fe" stopOpacity="0.16" />
                                    <stop offset="100%" stopColor="#7dd3fc" stopOpacity="0.04" />
                                </linearGradient>
                                {/* Neu sobre la muntanya: brillant als cims i esvaint-se cap avall */}
                                <linearGradient id={`${gradientId}-cap`} x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor="#f0f9ff" stopOpacity="0.6" />
                                    <stop offset="100%" stopColor="#bae6fd" stopOpacity="0.12" />
                                </linearGradient>
                                {chart?.snowZonePath && (
                                    <clipPath id={`${gradientId}-clip`}>
                                        <path d={chart.snowZonePath} />
                                    </clipPath>
                                )}
                            </defs>

                            {chart?.ticks.map(tk => (
                                <line key={tk.label} x1="0" x2="100" y1={tk.y} y2={tk.y} stroke="#94a3b8" strokeOpacity="0.12" strokeWidth="1" vectorEffect="non-scaling-stroke" />
                            ))}
                            {chart?.days.map(d => (
                                <line key={d.label} x1={d.x} x2={d.x} y1="0" y2="100" stroke="#64748b" strokeOpacity="0.35" strokeWidth="1" strokeDasharray="2 4" vectorEffect="non-scaling-stroke" />
                            ))}

                            {/* Muntanya fosca + la mateixa muntanya nevada retallada per la zona de neu */}
                            <path d={MOUNTAIN_PATH} fill={hasValidData ? '#0c4a6e' : '#334155'} fillOpacity={hasValidData ? 0.35 : 0.2} />
                            {chart?.snowZonePath ? (
                                <>
                                    <path d={chart.snowZonePath} fill={`url(#${gradientId}-snow)`} />
                                    <path d={MOUNTAIN_PATH} fill={`url(#${gradientId}-cap)`} clipPath={`url(#${gradientId}-clip)`} />
                                </>
                            ) : null}

                            {chart?.hereY != null && (
                                <line x1="0" x2="100" y1={chart.hereY} y2={chart.hereY} stroke="#fbbf24" strokeOpacity="0.55" strokeWidth="1" strokeDasharray="4 3" vectorEffect="non-scaling-stroke" />
                            )}
                            {chart?.linePath && (
                                <path d={chart.linePath} fill="none" stroke="#7dd3fc" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
                            )}
                        </svg>

                        {chart ? (
                            <>
                                {/* Etiquetes en HTML: el SVG s'estira (preserveAspectRatio none) i deformaria el text i els punts */}
                                {chart.ticks.map(tk => (
                                    <span key={tk.label} className="absolute left-4 -translate-y-1/2 px-0.5 rounded-sm bg-black/40 text-[9px] leading-none font-mono text-slate-500 tabular-nums" style={{ top: `${tk.y}%` }}>
                                        {tk.label}
                                    </span>
                                ))}
                                {chart.hereY !== null && hereM !== null && (
                                    <span className={`absolute right-1.5 ${chart.hereY < 20 ? 'translate-y-0.5' : '-translate-y-full'} px-1 rounded-sm bg-black/50 text-[9px] font-mono font-bold text-amber-300/80 tabular-nums`} style={{ top: `${chart.hereY}%` }}>
                                        {t.here} · {toDisplay(hereM)} {unitShort}
                                    </span>
                                )}
                                {chart.nowPoint && (
                                    <span className="absolute w-2.5 h-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white border-2 border-sky-300 shadow-[0_0_8px_rgba(125,211,252,0.6)]" style={{ left: `${chart.nowPoint.x}%`, top: `${chart.nowPoint.y}%`, marginLeft: '5px' }} />
                                )}
                                {chart.minPoint && (
                                    <span className="absolute w-2 h-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-rose-400" style={{ left: `${Math.min(98.5, Math.max(1.5, chart.minPoint.x))}%`, top: `${chart.minPoint.y}%` }} />
                                )}
                            </>
                        ) : snowLimit !== null ? (
                            /* Sense sèrie horària: només la línia d'ara sobre la muntanya, com el giny antic */
                            <div className="absolute inset-x-0 border-t-[1.5px] border-dashed border-sky-300/50" style={{ top: `${Math.max(10, Math.min(90, 100 - (snowLimit / 4000) * 100))}%` }} />
                        ) : null}
                    </div>

                    {/* Eix de temps en una franja pròpia perquè les dates no trepitgin la línia */}
                    {chart && (
                        <div className="relative h-5 shrink-0 border-t border-white/5 bg-black/20 text-[9px] font-mono font-bold">
                            <span className="absolute left-1.5 top-1/2 -translate-y-1/2 text-sky-300">{t.now.toUpperCase()}</span>
                            {/* Un canvi de dia a tocar dels extrems no s'etiqueta: xocaria amb "ARA" o "+48 h" */}
                            {chart.days.filter(d => d.x >= 14 && d.x <= 86).map(d => (
                                <span key={d.label} className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 text-slate-400" style={{ left: `${d.x}%` }}>
                                    {d.label}
                                </span>
                            ))}
                            <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-slate-500">{t.end}</span>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
