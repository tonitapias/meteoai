// src/components/widgets/CompassGauge.tsx
// Giny de Vent de la pestanya Detall: la brúixola (WindDial, la mateixa que WindModal) amb la direcció a l'anell i la
// velocitat i les ratxes a l'arc de velocímetre de baix; al centre, el nom de Beaufort i la velocitat; a sota, les ratxes.
// Abans els arcs de velocitat i de ratxes sortien del Nord i es llegien com una direcció (vegeu utils/windDial.ts).
import { Wind, Zap, AlertTriangle, CloudOff } from 'lucide-react';
import { WidgetProps } from './widgetTypes';
import { WIDGET_BASE_STYLE, CARD_VEIL, TITLE_STYLE, MATRIX_BG } from './widgetStyles';
import { getTrans, getWindDirectionText } from './widgetHelpers';
import { WindDial } from './WindDial';
import { getBeaufort } from '../../utils/beaufort';
import type { Language } from '../../translations';

// Nom del vent amb l'escala de Beaufort oficial, la mateixa que el modal (utils/beaufort.ts). Abans era una escala
// simplificada pròpia: 13 km/h hi sortia "Moderat" quan a Beaufort és "vent fluix" (auditoria d'UX del 16/11/2026, B3).
const getTacticalLabel = (speed: number, isValid: boolean, t: Record<string, unknown>, lang: string) => {
    if (!isValid) return String(t.windNoData ?? 'NO DATA');
    return getBeaufort(speed, (['ca', 'es', 'en', 'fr'].includes(lang) ? lang : 'ca') as Language).label;
};

// Llindars de les ratxes (km/h) i el seu color a l'arc i al xip.
const GUST_THRESHOLDS = { warning: 50, danger: 80 };
const GUST_HEX = { safe: '#34d399', warning: '#fbbf24', danger: '#f43f5e' } as const;
const SPEED_COLORS = ['#22d3ee', '#3b82f6'] as const;

export const CompassGauge = ({ degrees, speed, gusts, lang }: WidgetProps) => {
    const t = getTrans(lang) as Record<string, unknown>;

    // DOCTRINA RISC ZERO: Validació estricta d'integritat de dades abans de qualsevol càlcul de UI
    const isValidSpeed = typeof speed === 'number' && !isNaN(speed);
    const isValidDeg = typeof degrees === 'number' && !isNaN(degrees);
    const isValidGusts = typeof gusts === 'number' && !isNaN(gusts);

    const safeSpeed = isValidSpeed ? speed : 0;
    const safeDeg = isValidDeg ? degrees : 0;
    const safeGusts = isValidGusts ? gusts : 0;

    const directionText = isValidDeg ? getWindDirectionText(safeDeg, lang) : '--';
    const displayDeg = isValidDeg ? Math.round(safeDeg) : '--';
    const displaySpeed = isValidSpeed ? Math.round(safeSpeed) : '--';
    const displayGusts = isValidGusts ? Math.round(safeGusts) : '--';

    // Escala tàctica i colors de les ratxes
    const isDanger = isValidGusts && safeGusts > GUST_THRESHOLDS.danger;
    const isWarning = isValidGusts && safeGusts > GUST_THRESHOLDS.warning && !isDanger;
    const gustColorText = isDanger ? 'text-rose-500' : isWarning ? 'text-amber-500' : 'text-cyan-400';
    const gustHex = isDanger ? GUST_HEX.danger : isWarning ? GUST_HEX.warning : GUST_HEX.safe;

    const hasGusts = isValidGusts && isValidSpeed && (safeGusts > safeSpeed + 5);

    const tacticalLabel = getTacticalLabel(safeSpeed, isValidSpeed, t, lang ?? 'ca');

    // SPATIAL UI BASE
    const SPATIAL_WIDGET_STYLE = `${WIDGET_BASE_STYLE} ${CARD_VEIL} relative overflow-hidden bg-gradient-to-br from-[#0c0e15]/95 to-[#05060a]/95 border border-white/10 shadow-[0_16px_32px_rgba(0,0,0,0.6)] transform-gpu flex flex-col transition-colors duration-700`;

    return (
        <div className={SPATIAL_WIDGET_STYLE}>

            {/* Capes de fons espacials */}
            <div className={MATRIX_BG}></div>

            {/* Glow d'emergència si les ratxes són extremes */}
            {isDanger && isValidSpeed && (
                <div className="absolute inset-0 bg-rose-500/5 animate-pulse pointer-events-none z-0"></div>
            )}

            <div className="flex justify-between items-start w-full z-10 p-2">
                <div className={`${TITLE_STYLE.replace('mb-4', 'mb-0')} flex items-center gap-2`}>
                    <div className={`p-1.5 rounded-lg border shadow-sm transition-colors duration-500 ${isValidSpeed ? 'bg-cyan-500/10 border-cyan-500/20 shadow-[0_0_12px_rgba(34,211,238,0.2)]' : 'bg-slate-800/50 border-slate-700/50'}`}>
                        {isValidSpeed ? <Wind className="w-4 h-4 text-cyan-400" /> : <CloudOff className="w-4 h-4 text-slate-400" />}
                    </div>
                    <span className="tracking-widest font-bold text-slate-200">{String(t.wind || "VENT")}</span>
                </div>
                <div className={`flex flex-col items-end px-3 py-1.5 rounded-lg border shadow-[inset_0_2px_8px_rgba(0,0,0,0.5)] transition-colors duration-500 ${isValidDeg ? 'bg-[#0a0c12] border-white/5' : 'bg-transparent border-transparent'}`}>
                    <span className={`text-xs font-mono font-black tracking-wider ${isValidDeg ? 'text-slate-300' : 'text-slate-600'}`}>
                        {isValidDeg ? `${displayDeg}° ${directionText}` : '--°'}
                    </span>
                </div>
            </div>

            {/* Brúixola: direcció a l'anell, velocitat i ratxes a l'arc de baix */}
            <div className="relative flex-1 flex flex-col items-center justify-center gap-2 min-h-[220px] my-2 z-10">
                <WindDial
                    degrees={isValidDeg ? safeDeg : null}
                    speed={isValidSpeed ? safeSpeed : null}
                    gusts={isValidGusts ? safeGusts : null}
                    showGusts={hasGusts}
                    speedColors={SPEED_COLORS}
                    gustColor={gustHex}
                    needleClassName="text-cyan-400"
                    dimmed={!isValidSpeed}
                    lang={lang}
                    className="w-56 h-56"
                >
                    {/* Nucli de dades: Beaufort i velocitat, una mica amunt perquè l'arc de baix respiri */}
                    <div className="absolute flex flex-col items-center justify-center z-30 -mt-3">
                        <span className={`text-[10px] font-bold uppercase tracking-widest mb-1 px-2 py-0.5 rounded-full border transition-colors duration-500 ${isValidSpeed ? 'text-slate-400 bg-white/5 border-white/5' : 'text-slate-400 bg-black/40 border-slate-700/50'}`}>
                            {tacticalLabel}
                        </span>
                        <span className={`text-6xl font-mono font-black tabular-nums tracking-tighter leading-none drop-shadow-2xl transition-colors duration-500 ${isValidSpeed ? 'text-white' : 'text-slate-600'}`}>
                            {displaySpeed}
                        </span>
                        <span className={`text-[11px] font-bold uppercase tracking-widest mt-1 drop-shadow-md transition-colors duration-500 ${isValidSpeed ? 'text-cyan-400 opacity-90' : 'text-slate-600'}`}>
                            km/h
                        </span>
                    </div>
                </WindDial>

                {/* Ratxes (amb iconografia d'alerta si cal; sense ratxes rellevants, un buit de la mateixa alçada) */}
                {hasGusts ? (
                    <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full bg-black/50 border border-white/10 shadow-inner ${gustColorText}`}>
                        {isDanger ? <AlertTriangle className="w-3.5 h-3.5 fill-current" /> : <Zap className="w-3.5 h-3.5 fill-current" />}
                        <span className="text-[10px] font-black uppercase tracking-widest">
                            {String(t.gustsLabel || 'Gusts')}:
                        </span>
                        <span className="text-sm font-mono font-black tabular-nums">
                            {displayGusts}
                        </span>
                    </div>
                ) : (
                    <div className="h-[30px]" aria-hidden="true" />
                )}
            </div>
        </div>
    );
};
