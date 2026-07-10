import React from 'react';
import { ArrowDown, ArrowDownRight, ArrowRight, ArrowUpRight } from 'lucide-react';

interface CircularGaugeProps {
    icon: React.ReactNode;
    label: string;
    value: number;
    max?: number;
    subText?: string;
    color?: string;
    trendValue?: number | null; // DOCTRINA RISC ZERO: Accepta nulls de l'API
    lang?: 'ca' | 'es' | 'en' | 'fr' | string;
}

// Diccionari Tàctic i18n
const widgetTranslations: Record<string, Record<string, string>> = {
    ca: { rapid_drop: "Caiguda brusca", drop: "En descens", stable: "Estable / Pujant", no_data: "--" },
    es: { rapid_drop: "Caída brusca", drop: "En descenso", stable: "Estable / Subiendo", no_data: "--" },
    en: { rapid_drop: "Rapid drop", drop: "Falling", stable: "Stable / Rising", no_data: "--" },
    fr: { rapid_drop: "Baisse brutale", drop: "En baisse", stable: "Stable / Hausse", no_data: "--" }
};

export const CircularGauge = ({ 
    icon, 
    label, 
    value, 
    max = 100, 
    subText, 
    color = 'text-indigo-400', 
    trendValue, 
    lang = 'ca' 
}: CircularGaugeProps) => {
    
    // Extracció segura de l'idioma
    const t = widgetTranslations[lang] || widgetTranslations['ca'];

    // Matemàtica Risc Zero per al SVG Circular
    const radius = 36;
    const circumference = 2 * Math.PI * radius;
    const safeValue = isNaN(value) ? 0 : value;
    
    // Per a la pressió atmosfèrica (1050hPa), ajustem l'escala de l'anell.
    // Assumim un mínim operatiu de 950 per calcular el percentatge de l'arc.
    const percent = max > 500 
        ? Math.max(0, Math.min(100, ((safeValue - 950) / (max - 950)) * 100)) 
        : Math.max(0, Math.min(100, (safeValue / max) * 100));
        
    const strokeDashoffset = circumference - (percent / 100) * circumference;

    // --- AVALUACIÓ DE TENDÈNCIA (ESTRÈS BAROMÈTRIC) ---
    let trendColor = "text-slate-500";
    let trendBg = "bg-black/20 border-white/5";
    let trendIcon = <ArrowRight className="w-3 h-3" />;
    let trendText = t.no_data;
    let showTrend = false;

    if (typeof trendValue === 'number') {
        showTrend = true;
        if (trendValue <= -2.0) {
            // Caiguda brusca: Risc real de fronts violents (Roig)
            trendColor = "text-red-400 drop-shadow-[0_0_5px_rgba(248,113,113,0.8)]";
            trendBg = "bg-red-950/40 border-red-500/30";
            trendIcon = <ArrowDown className="w-3 h-3" />;
            trendText = t.rapid_drop;
        } else if (trendValue < -0.5) {
            // Caiguda lleu: Canvi de temps / Front suau (Ambre)
            trendColor = "text-amber-400 drop-shadow-[0_0_5px_rgba(251,191,36,0.6)]";
            trendBg = "bg-amber-950/40 border-amber-500/30";
            trendIcon = <ArrowDownRight className="w-3 h-3" />;
            trendText = t.drop;
        } else {
            // Estabilitat o pujada anticiclònica (Cian)
            trendColor = "text-cyan-400 drop-shadow-[0_0_5px_rgba(34,211,238,0.5)]";
            trendBg = "bg-cyan-950/30 border-cyan-500/20";
            trendIcon = trendValue > 0.5 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowRight className="w-3 h-3" />;
            trendText = t.stable;
        }
    }

    // SPATIAL UI BASE
    const SPATIAL_WIDGET_STYLE = `w-full h-full backdrop-blur-md bg-gradient-to-br from-indigo-950/40 to-black/60 border border-indigo-500/10 shadow-[0_8px_32px_rgba(0,0,0,0.5)] transform-gpu p-3 sm:p-4 flex flex-col rounded-2xl relative overflow-hidden`;

    return (
        <div className={SPATIAL_WIDGET_STYLE}>
            {/* Llum ambiental de fons (Glow subtil) */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-24 h-24 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none"></div>

            {/* Capçalera */}
            <div className="flex items-center gap-1.5 mb-2 z-10">
                <span className="drop-shadow-[0_0_8px_rgba(165,180,252,0.5)]">{icon}</span>
                <span className="text-xs font-bold text-slate-300 uppercase tracking-widest">{label}</span>
            </div>

            {/* Indicador Analògic Central */}
            <div className="flex-1 flex flex-col items-center justify-center relative my-2 z-10">
                <div className="relative flex items-center justify-center">
                    <svg className="w-24 h-24 sm:w-28 sm:h-28 transform -rotate-90 filter drop-shadow-lg" viewBox="0 0 100 100">
                        {/* Pista de fons */}
                        <circle cx="50" cy="50" r={radius} stroke="currentColor" strokeWidth="6" fill="transparent" className="text-indigo-950/50" />
                        {/* Valor de pressió */}
                        <circle 
                            cx="50" cy="50" r={radius} 
                            stroke="currentColor" 
                            strokeWidth="6" 
                            fill="transparent" 
                            strokeDasharray={circumference} 
                            strokeDashoffset={strokeDashoffset} 
                            strokeLinecap="round"
                            className={`${color} transition-all duration-1000 ease-out`} 
                        />
                    </svg>
                    
                    <div className="absolute flex flex-col items-center justify-center">
                        <span className="text-2xl sm:text-3xl font-black text-white tracking-tighter drop-shadow-md leading-none">
                            {safeValue}
                        </span>
                        {subText && (
                            <span className="text-[9px] text-slate-400 font-bold uppercase tracking-widest mt-1">
                                {subText}
                            </span>
                        )}
                    </div>
                </div>
            </div>

            {/* TELEMETRIA: Càpsula de Tendència (ΔP) */}
            <div className="mt-auto pt-2 z-10 w-full h-8 flex items-end">
                {showTrend ? (
                    <div className={`w-full flex items-center justify-between px-2 py-1.5 rounded border backdrop-blur-sm ${trendBg} transition-colors duration-500`}>
                        <div className={`flex items-center gap-1.5 ${trendColor}`}>
                            {trendIcon}
                            <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider leading-none">
                                {trendText}
                            </span>
                        </div>
                        <span className={`text-xs font-mono font-black tracking-tight ${trendColor} leading-none`}>
                            {trendValue! > 0 ? '+' : ''}{trendValue!.toFixed(1)}
                        </span>
                    </div>
                ) : (
                    // Placeholder per mantenir l'alçada intacta si no hi ha dades 
                    <div className="w-full h-[28px]"></div> 
                )}
            </div>
        </div>
    );
}