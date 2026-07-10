import React from 'react';
import { ArrowDown, ArrowDownRight, ArrowRight, ArrowUpRight, AlertTriangle } from 'lucide-react';

interface CircularGaugeProps {
    icon: React.ReactNode;
    label: string;
    value?: number | null; // DOCTRINA RISC ZERO: Accepta forats de l'API directament
    max?: number;
    subText?: string;
    color?: string;
    trendValue?: number | null; 
    lang?: 'ca' | 'es' | 'en' | 'fr' | string;
}

// Diccionari Tàctic i18n
const widgetTranslations: Record<string, Record<string, string>> = {
    ca: { rapid_drop: "Caiguda brusca", drop: "En descens", stable: "Estable / Pujant", no_data: "--", error: "SENSE DADES" },
    es: { rapid_drop: "Caída brusca", drop: "En descenso", stable: "Estable / Subiendo", no_data: "--", error: "SIN DATOS" },
    en: { rapid_drop: "Rapid drop", drop: "Falling", stable: "Stable / Rising", no_data: "--", error: "NO DATA" },
    fr: { rapid_drop: "Baisse brutale", drop: "En baisse", stable: "Stable / Hausse", no_data: "--", error: "PAS DE DONNÉES" }
};

export const CircularGauge = ({ 
    icon, 
    label, 
    value, 
    max = 1050, 
    subText = 'hPa', 
    color = 'text-indigo-400', 
    trendValue, 
    lang = 'ca' 
}: CircularGaugeProps) => {
    
    const t = widgetTranslations[lang] || widgetTranslations['ca'];

    // --- PROTECCIÓ D'ESTAT (RISC ZERO) ---
    const hasValidData = typeof value === 'number' && !isNaN(value);
    const safeValue = hasValidData ? Math.round(value) : 0;

    // Matemàtica Segura per al SVG Circular
    const radius = 36;
    const circumference = 2 * Math.PI * radius;
    
    // Escala tàctica de muntanya: 930hPa a 1050hPa
    const MIN_PRESS = 930;
    const safeMax = max > MIN_PRESS ? max : 1050; // Protecció contra divisió per zero
    const range = safeMax - MIN_PRESS;
    
    const percent = hasValidData 
        ? Math.max(0, Math.min(100, ((safeValue - MIN_PRESS) / range) * 100))
        : 0;
        
    const strokeDashoffset = circumference - (percent / 100) * circumference;

    // --- AVALUACIÓ DE TENDÈNCIA (ESTRÈS BAROMÈTRIC) ---
    let trendColor = "text-slate-500";
    let trendBg = "bg-black/20 border-white/5";
    let trendIcon = <ArrowRight className="w-3 h-3" />;
    let trendText = t.no_data;
    let showTrend = false;
    let safeTrendValue: string | null = null;

    if (typeof trendValue === 'number' && !isNaN(trendValue)) {
        showTrend = true;
        safeTrendValue = `${trendValue > 0 ? '+' : ''}${trendValue.toFixed(1)}`;

        if (trendValue <= -2.0) {
            // Caiguda brusca (Roig Tàctic)
            trendColor = "text-red-400 drop-shadow-[0_0_5px_rgba(248,113,113,0.8)]";
            trendBg = "bg-red-950/40 border-red-500/30";
            trendIcon = <ArrowDown className="w-3 h-3" />;
            trendText = t.rapid_drop;
        } else if (trendValue < -0.5) {
            // Caiguda lleu (Ambre Tàctic)
            trendColor = "text-amber-400 drop-shadow-[0_0_5px_rgba(251,191,36,0.6)]";
            trendBg = "bg-amber-950/40 border-amber-500/30";
            trendIcon = <ArrowDownRight className="w-3 h-3" />;
            trendText = t.drop;
        } else {
            // Estabilitat o pujada (Cian Tàctic)
            trendColor = "text-cyan-400 drop-shadow-[0_0_5px_rgba(34,211,238,0.5)]";
            trendBg = "bg-cyan-950/30 border-cyan-500/20";
            trendIcon = trendValue > 0.5 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowRight className="w-3 h-3" />;
            trendText = t.stable;
        }
    }

    // Generació de l'anell de marques (Ticks) integrat al propi SVG per evitar paquets externs
    const renderTicks = () => {
        return Array.from({ length: 40 }).map((_, i) => {
            const angle = (i * 9) * (Math.PI / 180);
            const x1 = 50 + 41 * Math.cos(angle);
            const y1 = 50 + 41 * Math.sin(angle);
            const x2 = 50 + 44 * Math.cos(angle);
            const y2 = 50 + 44 * Math.sin(angle);
            
            // Les marques de dalt i baix es fan més gruixudes per orientació
            const isCardinal = i % 10 === 0; 
            
            return (
                <line 
                    key={i} 
                    x1={x1} y1={y1} x2={x2} y2={y2} 
                    stroke="currentColor" 
                    strokeWidth={isCardinal ? "1.5" : "0.5"} 
                    className={isCardinal ? "text-indigo-400/40" : "text-slate-500/20"} 
                />
            );
        });
    };

    // SPATIAL UI BASE AMB MATRIU DE FONS
    const SPATIAL_WIDGET_STYLE = `w-full h-full transform-gpu p-3 sm:p-4 flex flex-col rounded-2xl relative overflow-hidden backdrop-blur-md bg-gradient-to-br from-indigo-950/40 to-black/60 border border-indigo-500/10 shadow-[0_8px_32px_rgba(0,0,0,0.5)]`;
    
    const MATRIX_BG = `absolute inset-0 z-0 opacity-[0.03] pointer-events-none bg-[linear-gradient(to_right,#ffffff_1px,transparent_1px),linear-gradient(to_bottom,#ffffff_1px,transparent_1px)] bg-[size:12px_12px]`;

    return (
        <div className={SPATIAL_WIDGET_STYLE}>
            {/* Capa 0: Matriu Tàctica i Llum ambiental */}
            <div className={MATRIX_BG}></div>
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-24 h-24 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none z-0"></div>

            {/* Capa 1: Capçalera */}
            <div className="flex items-center gap-1.5 mb-2 z-10">
                <span className={`drop-shadow-[0_0_8px_rgba(165,180,252,0.5)] ${!hasValidData ? 'text-red-400' : ''}`}>
                    {hasValidData ? icon : <AlertTriangle className="w-5 h-5" />}
                </span>
                <span className="text-xs font-bold text-slate-300 uppercase tracking-widest">{label}</span>
            </div>

            {/* Capa 2: Indicador Analògic Central */}
            <div className="flex-1 flex flex-col items-center justify-center relative my-2 z-10">
                <div className="relative flex items-center justify-center">
                    <svg className="w-28 h-28 sm:w-32 sm:h-32 transform -rotate-90 filter drop-shadow-lg" viewBox="0 0 100 100">
                        {/* Anell de telemetria (Ticks) */}
                        {renderTicks()}
                        
                        {/* Pista de fons del gauge */}
                        <circle cx="50" cy="50" r={radius} stroke="currentColor" strokeWidth="5" fill="transparent" className="text-indigo-950/40" />
                        
                        {/* Arc de valor de pressió */}
                        {hasValidData && (
                            <circle 
                                cx="50" cy="50" r={radius} 
                                stroke="currentColor" 
                                strokeWidth="5" 
                                fill="transparent" 
                                strokeDasharray={circumference} 
                                strokeDashoffset={strokeDashoffset} 
                                strokeLinecap="round"
                                className={`${color} transition-all duration-1000 ease-out`} 
                            />
                        )}
                    </svg>
                    
                    <div className="absolute flex flex-col items-center justify-center">
                        {hasValidData ? (
                            <>
                                <span className="text-2xl sm:text-3xl font-black text-white tracking-tighter drop-shadow-md leading-none">
                                    {safeValue}
                                </span>
                                {subText && (
                                    <span className="text-[9px] text-slate-400 font-bold uppercase tracking-widest mt-1">
                                        {subText}
                                    </span>
                                )}
                            </>
                        ) : (
                            <span className="text-[10px] font-bold text-red-400/80 uppercase tracking-widest drop-shadow-md">
                                {t.error}
                            </span>
                        )}
                    </div>
                </div>
            </div>

            {/* Capa 3: TELEMETRIA - Càpsula de Tendència (ΔP) */}
            <div className="mt-auto pt-2 z-10 w-full h-8 flex items-end">
                {showTrend && safeTrendValue !== null ? (
                    <div className={`w-full flex items-center justify-between px-2 py-1.5 rounded border backdrop-blur-sm ${trendBg} transition-colors duration-500`}>
                        <div className={`flex items-center gap-1.5 ${trendColor}`}>
                            {trendIcon}
                            <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider leading-none">
                                {trendText}
                            </span>
                        </div>
                        <span className={`text-xs font-mono font-black tracking-tight ${trendColor} leading-none`}>
                            {safeTrendValue}
                        </span>
                    </div>
                ) : (
                    // Placeholder per mantenir l'alçada de la graella intacta quan l'API no té l'històric
                    <div className="w-full h-[28px] rounded border border-transparent"></div> 
                )}
            </div>
        </div>
    );
}