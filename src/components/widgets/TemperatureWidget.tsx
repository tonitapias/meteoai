// src/components/widgets/TemperatureWidget.tsx
// Giny panoràmic de Temperatura (primera fila del Detall, a tota l'amplada, com la cota de neu a l'última): a l'esquerra
// la temperatura d'ara, la sensació i on és ara dins la mínima i la màxima d'avui; a la dreta, les pròximes 24 hores amb
// el traç pintat amb el color de cada temperatura, la sensació en discontinu i la nit ombrejada.
// Totes les xifres són les de la capçalera (vegeu utils/temperatureDetail.ts). Sense blur ni animacions infinites.
import { useId, useMemo } from 'react';
import { Thermometer, CloudOff, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import type { ExtendedWeatherData } from '../../types/weatherLogicTypes';
import type { Language } from '../../translations';
import { formatTemp, type WeatherUnit } from '../../utils/formatters';
import { WIDGET_BASE_STYLE, TITLE_STYLE, MATRIX_BG } from './widgetStyles';
import { ChartGridLines, ChartTickLabels } from './ChartTicks';
import { POINT_LABEL_TRANSLATE, pointLabelAnchor } from '../../utils/chartTicks';
import { buildCapsuleGradient, getAbsoluteColor } from '../../utils/temperatureColors';
import { resolveTodayExtremes } from '../../utils/dailyExtremes';
import {
    buildTemperatureWindow, classifyTemperatureTrend, getFeelsCause, positionInRange, summarizeTemperature, toUserTempDelta,
} from '../../utils/temperatureDetail';
import {
    areaPathOf, dayChangesOf, linePathOf, makeXScale, makeYScale, nightBandsOf, segmentsOf, temperatureDomain, temperatureGradientStops,
} from '../../utils/temperatureChart';

const WINDOW_HOURS = 25; // ara + 24 h

const T: Record<Language, Record<string, string>> = {
    ca: { title: 'TEMPERATURA', now: 'Ara', feels: 'Sensació', today: 'Avui', min: 'Mín', max: 'Màx', rising: 'Pujant', falling: 'Baixant', steady: 'Estable', in3h: 'en 3 h', wind: 'pel vent', humidity: 'per la humitat', noData: 'SENSE DADES', end: '+24 h' },
    es: { title: 'TEMPERATURA', now: 'Ahora', feels: 'Sensación', today: 'Hoy', min: 'Mín', max: 'Máx', rising: 'Subiendo', falling: 'Bajando', steady: 'Estable', in3h: 'en 3 h', wind: 'por el viento', humidity: 'por la humedad', noData: 'SIN DATOS', end: '+24 h' },
    en: { title: 'TEMPERATURE', now: 'Now', feels: 'Feels like', today: 'Today', min: 'Low', max: 'High', rising: 'Rising', falling: 'Falling', steady: 'Steady', in3h: 'in 3 h', wind: 'wind chill', humidity: 'humidity', noData: 'NO DATA', end: '+24 h' },
    fr: { title: 'TEMPÉRATURE', now: 'Maintenant', feels: 'Ressenti', today: "Aujourd'hui", min: 'Min', max: 'Max', rising: 'En hausse', falling: 'En baisse', steady: 'Stable', in3h: 'en 3 h', wind: 'à cause du vent', humidity: "à cause de l'humidité", noData: 'PAS DE DONNÉES', end: '+24 h' },
};

// Zona útil del gràfic dins el viewBox 0-100 (marge perquè ni la màxima ni la mínima toquin la vora).
const PLOT_TOP = 10;
const PLOT_BOTTOM = 92;

export interface TemperatureWidgetProps {
    weatherData: ExtendedWeatherData;
    unit: WeatherUnit;
    lang: Language;
}

export const TemperatureWidget = ({ weatherData, unit, lang }: TemperatureWidgetProps) => {
    const safeLang: Language = T[lang] ? lang : 'ca';
    const t = T[safeLang];
    // useId porta caràcters (":", "«") que no sempre sobreviuen dins d'un url(#...) d'SVG.
    const gradientId = `tempw-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;

    const points = useMemo(() => buildTemperatureWindow(weatherData, WINDOW_HOURS), [weatherData]);
    const summary = useMemo(() => summarizeTemperature(points), [points]);
    const today = useMemo(() => resolveTodayExtremes(weatherData), [weatherData]);

    const nowTemp = points[0]?.temp ?? null;
    const nowFeels = points[0]?.feels ?? null;
    const hasData = nowTemp !== null;
    const current = weatherData.current;
    const cause = getFeelsCause(
        nowTemp,
        nowFeels,
        typeof current?.wind_speed_10m === 'number' ? current.wind_speed_10m : null,
        typeof current?.relative_humidity_2m === 'number' ? current.relative_humidity_2m : null
    );
    const trend = classifyTemperatureTrend(summary.trend3h);
    const trendDelta = summary.trend3h !== null ? Math.round(toUserTempDelta(summary.trend3h, unit)) : null;

    const show = (c: number | null) => {
        const v = formatTemp(c, unit);
        return v !== null ? `${v}°` : '--';
    };

    const accent = nowTemp !== null ? getAbsoluteColor(nowTemp) : '#64748b';
    const marker = positionInRange(nowTemp, today.min, today.max);
    const rangeGradient = today.max !== null && today.min !== null
        ? buildCapsuleGradient(today.max, today.min).replace('to bottom', 'to left')
        : undefined;

    const chart = useMemo(() => {
        const domain = temperatureDomain(points);
        if (!domain || points.length < 2) return null;
        const xOf = makeXScale(points.length);
        const yOf = makeYScale(domain, PLOT_TOP, PLOT_BOTTOM);
        const tempSegments = segmentsOf(points, 'temp', xOf, yOf);
        const mark = (m: { value: number; index: number } | null) => (m ? { x: xOf(m.index), y: yOf(m.value), value: m.value } : null);
        return {
            domain,
            yOf,
            stops: temperatureGradientStops(domain),
            line: linePathOf(tempSegments),
            area: areaPathOf(tempSegments, PLOT_BOTTOM),
            feels: linePathOf(segmentsOf(points, 'feels', xOf, yOf)),
            nights: nightBandsOf(points, xOf),
            days: dayChangesOf(points, xOf),
            nowPoint: points[0].temp !== null ? { x: 0, y: yOf(points[0].temp) } : null,
            maxPoint: summary.max && summary.max.index > 0 ? mark(summary.max) : null,
            minPoint: summary.min && summary.min.index > 0 ? mark(summary.min) : null,
            freezingY: domain.showFreezing ? yOf(0) : null,
        };
    }, [points, summary]);

    // Etiqueta d'un extrem: a dins del gràfic (a sota del màxim, a sobre del mínim), en una sola línia i, a prop d'una
    // vora, ancorada cap a dins (pointLabelAnchor) en lloc de centrada: abans es partia en dues línies a la dreta.

    const SPATIAL_WIDGET_STYLE = `${WIDGET_BASE_STYLE} !justify-start relative overflow-hidden bg-gradient-to-br transition-colors duration-700 ${hasData ? 'from-amber-950/20 to-black/80' : 'from-slate-900/50 to-black/80'} border ${hasData ? 'border-white/5' : 'border-slate-700/50'} shadow-[0_8px_32px_rgba(0,0,0,0.5)] p-3 sm:p-4 gap-3 select-none`;

    return (
        <div className={SPATIAL_WIDGET_STYLE}>
            <div className={MATRIX_BG}></div>

            {/* Capçalera: títol + tendència de les pròximes 3 hores */}
            <div className="flex items-center justify-between gap-3 z-20 relative">
                <div className={`${TITLE_STYLE.replace('mb-4', 'mb-0')} flex items-center gap-1.5`}>
                    {hasData ? <Thermometer className="w-4 h-4" style={{ color: accent }} /> : <CloudOff className="w-4 h-4 text-slate-400" />}
                    <span className="tracking-wider text-slate-200">{t.title}</span>
                </div>
                {hasData && (
                    <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md border bg-black/40 shrink-0 ${trend === 'rising' ? 'border-orange-400/25' : trend === 'falling' ? 'border-sky-400/25' : 'border-white/10'}`}>
                        {trend === 'rising' ? <TrendingUp className="w-3 h-3 text-orange-300" /> : trend === 'falling' ? <TrendingDown className="w-3 h-3 text-sky-300" /> : <Minus className="w-3 h-3 text-slate-400" />}
                        <span className={`text-[10px] font-mono font-bold tabular-nums ${trend === 'rising' ? 'text-orange-100' : trend === 'falling' ? 'text-sky-100' : 'text-slate-300'}`}>
                            {t[trend]}{trend !== 'steady' && trendDelta !== null ? ` · ${trendDelta > 0 ? '+' : ''}${trendDelta}° ${t.in3h}` : ''}
                        </span>
                    </div>
                )}
            </div>

            <div className="flex-1 flex flex-col sm:flex-row gap-3 sm:gap-5 z-10 relative min-h-0">
                {/* Ara, sensació i rang d'avui */}
                <div className="flex flex-col justify-center gap-3 sm:gap-4 sm:w-52 lg:w-60 shrink-0 px-1">
                    <div className="flex items-end justify-between sm:justify-start gap-4">
                        <div className="flex flex-col">
                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{t.now}</span>
                            <span className={`text-5xl sm:text-6xl font-black tracking-tighter tabular-nums leading-none ${hasData ? 'text-white' : 'text-slate-600'}`}>
                                {show(nowTemp)}
                            </span>
                        </div>
                        <div className="flex flex-col items-end sm:items-start pb-1">
                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{t.feels}</span>
                            <span className="text-xl font-black tabular-nums leading-tight text-slate-100">{show(nowFeels)}</span>
                            {(cause === 'wind' || cause === 'humidity') && (
                                <span className="text-[10px] font-bold text-slate-400 leading-tight">{t[cause]}</span>
                            )}
                        </div>
                    </div>

                    {hasData ? (
                        <div className="flex flex-col gap-1.5 sm:pt-3 sm:border-t sm:border-white/5">
                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{t.today}</span>
                            <div className="flex items-center gap-2">
                                <span className="text-xs font-bold tabular-nums text-slate-300 w-8 text-left">{show(today.min)}</span>
                                <div className="relative flex-1 h-1.5 rounded-full bg-white/10">
                                    {rangeGradient && <div className="absolute inset-0 rounded-full opacity-90" style={{ backgroundImage: rangeGradient }} />}
                                    {marker !== null && (
                                        <span
                                            className="absolute top-1/2 w-3 h-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white border-2 shadow-[0_0_8px_rgba(255,255,255,0.45)]"
                                            style={{ left: `${marker * 100}%`, borderColor: accent }}
                                        />
                                    )}
                                </div>
                                <span className="text-xs font-bold tabular-nums text-slate-100 w-8 text-right">{show(today.max)}</span>
                            </div>
                        </div>
                    ) : (
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{t.noData}</span>
                    )}
                </div>

                {/* Les pròximes 24 h (decoratiu per a lectors de pantalla: les xifres ja hi són a l'esquerra) */}
                <div aria-hidden="true" className={`relative flex-1 flex flex-col min-h-[8.5rem] sm:min-h-[10rem] rounded-xl border overflow-hidden ${hasData ? 'bg-black/25 border-white/5' : 'bg-slate-900/40 border-slate-800/50'}`}>
                    <div className="relative flex-1">
                        {chart && (
                            <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 w-full h-full">
                                <defs>
                                    <linearGradient id={`${gradientId}-stroke`} gradientUnits="userSpaceOnUse" x1="0" y1={PLOT_TOP} x2="0" y2={PLOT_BOTTOM}>
                                        {chart.stops.map(s => <stop key={s.offset} offset={s.offset} stopColor={s.color} />)}
                                    </linearGradient>
                                    <linearGradient id={`${gradientId}-fill`} gradientUnits="userSpaceOnUse" x1="0" y1={PLOT_TOP} x2="0" y2={PLOT_BOTTOM}>
                                        {chart.stops.map(s => <stop key={s.offset} offset={s.offset} stopColor={s.color} stopOpacity={0.22 * (1 - s.offset) + 0.02} />)}
                                    </linearGradient>
                                </defs>

                                {chart.nights.map(n => (
                                    <rect key={n.x1} x={n.x1} y="0" width={n.x2 - n.x1} height="100" fill="#020617" fillOpacity="0.45" />
                                ))}
                                <ChartGridLines ticks={chart.domain.ticks} y={chart.yOf} x2={100} />
                                {chart.days.map(d => (
                                    <line key={d.label} x1={d.x} x2={d.x} y1="0" y2="100" stroke="#64748b" strokeOpacity="0.35" strokeWidth="1" strokeDasharray="2 4" vectorEffect="non-scaling-stroke" />
                                ))}
                                {chart.freezingY !== null && (
                                    <line x1="0" x2="100" y1={chart.freezingY} y2={chart.freezingY} stroke="#22d3ee" strokeOpacity="0.55" strokeWidth="1" strokeDasharray="4 3" vectorEffect="non-scaling-stroke" />
                                )}

                                {chart.area && <path d={chart.area} fill={`url(#${gradientId}-fill)`} />}
                                {chart.feels && <path d={chart.feels} fill="none" stroke="#cbd5e1" strokeOpacity="0.45" strokeWidth="1.25" strokeDasharray="3 3" strokeLinecap="round" vectorEffect="non-scaling-stroke" />}
                                {chart.line && <path d={chart.line} fill="none" stroke={`url(#${gradientId}-stroke)`} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />}
                            </svg>
                        )}

                        {chart && (
                            <>
                                {/* Etiquetes i punts en HTML: el SVG s'estira (preserveAspectRatio none) i els deformaria */}
                                <ChartTickLabels
                                    ticks={chart.domain.ticks} topPct={chart.yOf} format={show}
                                    avoid={[chart.maxPoint, chart.minPoint].filter((p): p is NonNullable<typeof p> => p !== null)}
                                />
                                {chart.nowPoint && (
                                    <span className="absolute w-2.5 h-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white border-2 shadow-[0_0_8px_rgba(255,255,255,0.35)]" style={{ left: `${chart.nowPoint.x}%`, top: `${chart.nowPoint.y}%`, marginLeft: '5px', borderColor: accent }} />
                                )}
                                {chart.maxPoint && (
                                    <>
                                        <span className="absolute w-2 h-2 -translate-x-1/2 -translate-y-1/2 rounded-full" style={{ left: `${chart.maxPoint.x}%`, top: `${chart.maxPoint.y}%`, backgroundColor: getAbsoluteColor(chart.maxPoint.value) }} />
                                        <span className={`absolute ${POINT_LABEL_TRANSLATE[pointLabelAnchor(chart.maxPoint.x)]} mt-1.5 whitespace-nowrap px-1 rounded-sm bg-black/55 text-[10px] font-mono font-bold text-slate-100 tabular-nums`} style={{ left: `${chart.maxPoint.x}%`, top: `${chart.maxPoint.y}%` }}>
                                            {t.max} {show(chart.maxPoint.value)}
                                        </span>
                                    </>
                                )}
                                {chart.minPoint && (
                                    <>
                                        <span className="absolute w-2 h-2 -translate-x-1/2 -translate-y-1/2 rounded-full" style={{ left: `${chart.minPoint.x}%`, top: `${chart.minPoint.y}%`, backgroundColor: getAbsoluteColor(chart.minPoint.value) }} />
                                        <span className={`absolute ${POINT_LABEL_TRANSLATE[pointLabelAnchor(chart.minPoint.x)]} -translate-y-full -mt-1.5 whitespace-nowrap px-1 rounded-sm bg-black/55 text-[10px] font-mono font-bold text-slate-100 tabular-nums`} style={{ left: `${chart.minPoint.x}%`, top: `${chart.minPoint.y}%` }}>
                                            {t.min} {show(chart.minPoint.value)}
                                        </span>
                                    </>
                                )}
                            </>
                        )}
                    </div>

                    {/* Eix de temps en una franja pròpia perquè les dates no trepitgin la línia */}
                    {chart && (
                        <div className="relative h-5 shrink-0 border-t border-white/5 bg-black/20 text-[10px] font-mono font-bold">
                            <span className="absolute left-1.5 top-1/2 -translate-y-1/2" style={{ color: accent }}>{t.now.toUpperCase()}</span>
                            {chart.days.filter(d => d.x >= 14 && d.x <= 86).map(d => (
                                <span key={d.label} className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 text-slate-400" style={{ left: `${d.x}%` }}>
                                    {d.label}
                                </span>
                            ))}
                            <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-slate-400">{t.end}</span>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
