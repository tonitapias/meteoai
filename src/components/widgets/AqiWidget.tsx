// src/components/widgets/AqiWidget.tsx
// Giny de Qualitat de l'aire (pestanya Detall): l'índex europeu (o l'americà de reserva), el nivell i el carril de
// bandes; i el desglossament de PM2.5, PM10, NO₂ i O₃ amb una barra del color de la banda del seu subíndex europeu.
// Bandes, colors i desglossament surten de utils/aqiLevel.ts, els mateixos que el modal i els destacats d'Ara.
// A partir de 768 px la targeta ocupa dues columnes: abans hi quedava una franja estreta i un buit al voltant; ara el
// desglossament va a la dreta (a sota en una sola columna).
import { Wind, CloudOff } from 'lucide-react';
import { WidgetProps } from './widgetTypes';
import { WIDGET_BASE_STYLE, CARD_VEIL, MATRIX_BG } from './widgetStyles';
import { getTrans } from './widgetHelpers';
import {
    AQI_NO_DATA_COLOR, AQI_SCALE_MAX, AQI_TRANSLATIONS, extractAqiData, extractPollutantBreakdown, getAqiLevel,
    getAqiLevelColor, getAqiLevelFor, getAqiSafeLang, isAqiAlertLevel, type AqiColorFamily,
} from '../../utils/aqiLevel';
import { formatDecimal } from '../../utils/formatters';

const T = {
    ca: { pollutants: 'Contaminants' },
    es: { pollutants: 'Contaminantes' },
    en: { pollutants: 'Pollutants' },
    fr: { pollutants: 'Polluants' },
} as const;

// Halo del llum de telemetria de cada color (classes senceres perquè Tailwind les generi).
const FAMILY_SHADOW: Record<AqiColorFamily, string> = {
    cyan: 'shadow-[0_0_8px_#22d3ee]',
    emerald: 'shadow-[0_0_8px_#34d399]',
    yellow: 'shadow-[0_0_8px_#fde047]',
    amber: 'shadow-[0_0_12px_#fbbf24]',
    rose: 'shadow-[0_0_12px_#f43f5e]',
    fuchsia: 'shadow-[0_0_12px_#d946ef]',
    purple: 'shadow-[0_0_12px_#a855f7]',
    red: 'shadow-[0_0_16px_#991b1b]',
    slate: 'shadow-none',
};

const SEGMENTS = 20;

export const AqiWidget = ({ data, lang }: WidgetProps) => {
    const t = getTrans(lang);
    const safeLang = getAqiSafeLang(lang);
    const tLocal = AQI_TRANSLATIONS[safeLang];

    // Prioritzem el diccionari global pel títol si existeix, si no, usem el local
    const tRecord = (typeof t === 'object' && t !== null) ? (t as Record<string, unknown>) : {};
    const titleAqi = typeof tRecord.aqi === 'string' ? tRecord.aqi : tLocal.title;

    const aqiData = extractAqiData(data);
    const level = aqiData ? getAqiLevel(aqiData) : null;
    const levelColor = aqiData && level ? getAqiLevelColor(level, aqiData.type) : AQI_NO_DATA_COLOR;
    const label = level ? tLocal[level] : tLocal.nd;
    const barMax = AQI_SCALE_MAX[aqiData?.type ?? 'EAQI'];
    const displayValue = aqiData ? Math.round(aqiData.value) : null;
    const hasValidData = displayValue !== null;

    // Alerta tàctica (el llum parpelleja): el nivell dolent o pitjor de cada escala
    const isAlert = level !== null && isAqiAlertLevel(level);

    // DOCTRINA RISC ZERO: el contaminant que no arriba surt amb "--" i la barra buida (mai un 0).
    const pollutants = extractPollutantBreakdown(data);

    // SPATIAL UI BASE AMB MATRIU DE FONS
    const SPATIAL_WIDGET_STYLE = `${WIDGET_BASE_STYLE} ${CARD_VEIL} gap-4 md:!flex-row md:items-stretch md:gap-6 transition-colors duration-700 relative overflow-hidden border shadow-[0_8px_32px_rgba(0,0,0,0.5)] transform-gpu p-3 sm:p-4 ${hasValidData ? 'bg-gradient-to-br from-[#0f111a]/90 to-black/80 border-white/10' : 'bg-gradient-to-br from-slate-900/50 to-black/80 border-slate-700/50'}`;

    return (
        <div className={SPATIAL_WIDGET_STYLE}>
            {/* Matriu Tàctica */}
            <div className={MATRIX_BG}></div>

            {/* Resum: icona amb el llum de telemetria, índex, carril de bandes i nivell. Una mica més ample que el
                desglossament (3:2): a 1024 px, a parts iguals, el títol es partia en dues línies. */}
            <div className="flex items-center gap-6 z-10 md:flex-[3] md:min-w-0">
                {/* Contenidor Icona */}
                <div className={`relative shrink-0 w-16 h-16 sm:w-20 sm:h-20 flex items-center justify-center rounded-xl border shadow-inner group z-10 transition-colors duration-500 ${hasValidData ? 'bg-[#0f111a]/80 border-white/10' : 'bg-slate-800/40 border-slate-700/50'}`}>
                    {!hasValidData ? (
                        <CloudOff className="w-8 h-8 sm:w-10 sm:h-10 text-slate-400 opacity-80" />
                    ) : (
                        <Wind className={`w-8 h-8 sm:w-10 sm:h-10 ${levelColor.text} transition-colors duration-500 filter drop-shadow-[0_0_8px_currentColor]`} />
                    )}
                    {/* Llum de telemetria (Només brilla si hi ha dades) */}
                    <div className={`absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full ${hasValidData ? levelColor.bg : 'bg-slate-600'} ${isAlert ? 'animate-pulse' : ''} ${FAMILY_SHADOW[levelColor.family]} border-2 border-[#151725] transition-colors duration-500`}></div>
                </div>

                {/* Panell de Dades i Telemetria */}
                <div className="flex-1 min-w-0 flex flex-col justify-center z-10">
                    <div className="flex justify-between items-center gap-2 mb-1">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">
                            {titleAqi} {hasValidData && aqiData?.type === 'EAQI' ? '(EU)' : ''}
                        </span>
                        <span className={`shrink-0 text-xs sm:text-sm font-mono font-black ${levelColor.text} tabular-nums px-2 py-0.5 rounded border transition-colors duration-500 ${hasValidData ? 'bg-black/40 border-white/5' : 'bg-transparent border-slate-700/50'}`}>
                            {hasValidData ? `AQI ${displayValue}` : 'AQI --'}
                        </span>
                    </div>

                    {/* Carril de bandes: cada segment amb el color del nivell on comença (les mateixes bandes que el modal) */}
                    <div className={`flex gap-0.5 h-3.5 w-full mb-1.5 rounded-sm border p-px transition-colors duration-500 ${hasValidData ? 'bg-[#0f111a] border-white/5' : 'bg-slate-900/50 border-slate-800'}`}>
                        {Array.from({ length: SEGMENTS }).map((_, i) => {
                            const threshold = i * (barMax / SEGMENTS);
                            const isActive = aqiData !== null && displayValue !== null && displayValue >= threshold;
                            const segmentColor = aqiData ? getAqiLevelColor(getAqiLevelFor(threshold, aqiData.type), aqiData.type).bg : 'bg-slate-700';
                            return (
                                <div
                                    key={`aqi-segment-${i}`}
                                    className={`flex-1 rounded-[1px] transition-all duration-500 ${isActive ? segmentColor : 'bg-[#1a1d2e]'}`}
                                    style={{ opacity: isActive ? 1 : 0.3 }}
                                ></div>
                            );
                        })}
                    </div>

                    <span className={`text-xl sm:text-2xl font-black ${levelColor.text} tracking-tighter uppercase drop-shadow-md leading-none transition-colors duration-500 mt-0.5`}>
                        {label}
                    </span>
                </div>
            </div>

            {/* Desglossament: la xifra en µg/m³ (la del modal) i la barra del subíndex europeu, amb el color de la seva banda */}
            <div className="z-10 flex flex-col gap-2 pt-3 border-t border-white/5 md:flex-[2] md:min-w-0 md:justify-center md:gap-3 md:pt-0 md:pl-6 md:border-t-0 md:border-l">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">{T[safeLang].pollutants}</span>
                <ul className="grid grid-cols-2 gap-x-4 gap-y-2.5 md:grid-cols-1 md:gap-y-3">
                    {pollutants.map(p => {
                        const color = p.level ? getAqiLevelColor(p.level, 'EAQI') : null;
                        const width = p.index !== null ? Math.min(100, Math.max(0, (p.index / AQI_SCALE_MAX.EAQI) * 100)) : 0;
                        return (
                            <li key={p.key} data-pollutant={p.key} data-level={p.level ?? undefined} className="min-w-0">
                                <div className="flex items-baseline justify-between gap-2">
                                    <span className="text-[10px] font-mono font-bold text-slate-400">{p.label}</span>
                                    <span className="whitespace-nowrap text-xs font-mono font-black tabular-nums text-slate-200">
                                        {p.value !== null ? formatDecimal(p.value, safeLang) : '--'}
                                        {p.value !== null && <span className="ml-1 text-[9px] font-bold text-slate-500">µg/m³</span>}
                                    </span>
                                </div>
                                <div className="mt-1 h-1.5 rounded-full bg-[#1a1d2e] overflow-hidden">
                                    {color && <div className={`h-full rounded-full ${color.bg}`} style={{ width: `${width}%` }} />}
                                </div>
                            </li>
                        );
                    })}
                </ul>
            </div>
        </div>
    );
};
