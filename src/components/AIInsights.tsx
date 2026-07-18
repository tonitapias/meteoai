// src/components/AIInsights.tsx
import { 
    Activity, 
    AlertOctagon, 
    AlertTriangle, 
    Info, 
    Layers, 
    RefreshCw, 
    ShieldAlert, 
    Sparkles, 
    Thermometer, 
    WifiOff, 
    Wind, 
    Zap 
} from 'lucide-react';
import { TypewriterText } from './WeatherUI';
import { TRANSLATIONS, Language, TranslationType } from '../translations';
import { AICacheData, TacticalTip, TacticalRiskLevel, TacticalHazardType } from '../services/geminiService';

// --- INTERFÍCIES ESTRICTES I DE COMPATIBILITAT (DOCTRINA RISC ZERO) ---

interface AlertItem {
    type: string;
    msg: string;
    level: 'high' | 'warning' | 'info';
}

export interface TacticalAnalysisResult extends Omit<Partial<AICacheData>, 'tips'> {
    text: string;
    tips?: (TacticalTip | string)[];
    confidenceLevel?: 'high' | 'medium' | 'low';
    confidence?: string;
    alerts?: AlertItem[];
    source?: string;
}

interface AIInsightsProps {
    analysis: TacticalAnalysisResult | null;
    lang: Language;
    isLoading?: boolean; 
    hasError?: boolean;  
    onRetry?: () => void; 
}

// --- DICCIONARI TÀCTIC INTERN (100% MULTILINGÜE I RISC ZERO) ---

interface LocalUIText {
    stable: string;
    warning: string;
    danger: string;
    reason: string;
    tipsHeader: string;
    aiTitle: string;
    offlineTitle: string;
    offlineDesc: string;
    retry: string;
    hazards: Record<TacticalHazardType, string>;
}

const LOCAL_UI_TEXTS: Record<string, LocalUIText> = {
    ca: {
        stable: 'TEMPS TRANQUIL',
        warning: 'ATENCIÓ / CANVIS',
        danger: 'ALERTA METEO',
        reason: 'Motiu',
        tipsHeader: 'Punts clau per a les properes hores:',
        aiTitle: 'Previsió Intel·ligent IA',
        offlineTitle: 'Anàlisi IA no disponible',
        offlineDesc: "No s'ha pogut connectar amb el motor de previsió intel·ligent. Les dades i gràfics de la pantalla continuen 100% actualitzats.",
        retry: 'Torna-ho a provar',
        hazards: {
            NONE: '',
            WIND: 'VENT FORT I RÀFEGUES',
            THERMAL: 'TEMPERATURES EXTREMES',
            HEAT: 'CALOR INTENSA O XAFOGOR',
            COLD: 'FRED INTENS O SENSACIÓ GÈLIDA',
            CONVECTIVE: 'RISC DE TEMPESTA O PLUJA FORTA',
            VISIBILITY: 'BOIRA DENSA O VISIBILITAT REDUÏDA',
            SNOW_ICE: 'RISC DE NEU, GEBRADA O GEL'
        }
    },
    es: {
        stable: 'TIEMPO TRANQUILO',
        warning: 'ATENCIÓN / CAMBIOS',
        danger: 'ALERTA METEO',
        reason: 'Motivo',
        tipsHeader: 'Puntos clave para las próximas horas:',
        aiTitle: 'Previsión Inteligente IA',
        offlineTitle: 'Análisis IA no disponible',
        offlineDesc: 'No se pudo conectar con el motor de previsión inteligente. Los datos y gráficos de la pantalla siguen 100% actualizados.',
        retry: 'Volver a intentar',
        hazards: {
            NONE: '',
            WIND: 'VIENTO FUERTE Y RACHAS',
            THERMAL: 'TEMPERATURAS EXTREMAS',
            HEAT: 'CALOR INTENSO O BOCHORNO',
            COLD: 'FRÍO INTENSO O SENSACIÓN GÉLIDA',
            CONVECTIVE: 'RIESGO DE TORMENTA O LLUVIA FUERTE',
            VISIBILITY: 'NIEBLA DENSA O VISIBILIDAD REDUCIDA',
            SNOW_ICE: 'RIESGO DE NIEVE, HELADA O HIELO'
        }
    },
    fr: {
        stable: 'TEMPS CALME',
        warning: 'ATTENTION / CHANGEMENTS',
        danger: 'ALERTE MÉTÉO',
        reason: 'Raison',
        tipsHeader: 'Points clés pour les prochaines heures :',
        aiTitle: 'Prévision Intelligente IA',
        offlineTitle: 'Analyse IA indisponible',
        offlineDesc: "Impossible de se connecter au moteur de prévision. Les données et graphiques à l'écran restent 100% à jour.",
        retry: 'Réessayer',
        hazards: {
            NONE: '',
            WIND: 'VENT FORT ET RAFALES',
            THERMAL: 'TEMPÉRATURES EXTRÊMES',
            HEAT: 'CHALEUR INTENSE OU LOURDEUR',
            COLD: 'FROID INTENSE OU RESSENTI GLACIAL',
            CONVECTIVE: "RISQUE D'ORAGE OU FORTE PLUIE",
            VISIBILITY: 'BROUILLARD DENSE OU VISIBILITÉ RÉDUITE',
            SNOW_ICE: 'RISQUE DE NEIGE, GIVRE OU VERGLAS'
        }
    },
    en: {
        stable: 'CALM WEATHER',
        warning: 'CAUTION / CHANGES',
        danger: 'WEATHER ALERT',
        reason: 'Reason',
        tipsHeader: 'Key highlights for the next few hours:',
        aiTitle: 'AI Smart Forecast',
        offlineTitle: 'AI Analysis Unavailable',
        offlineDesc: 'Could not connect to the intelligent forecast engine. On-screen data and charts remain 100% updated in real time.',
        retry: 'Try again',
        hazards: {
            NONE: '',
            WIND: 'STRONG WIND & GUSTS',
            THERMAL: 'EXTREME TEMPERATURES',
            HEAT: 'INTENSE HEAT OR MUGGINESS',
            COLD: 'INTENSE COLD OR WIND CHILL',
            CONVECTIVE: 'THUNDERSTORM OR HEAVY RAIN RISK',
            VISIBILITY: 'DENSE FOG OR REDUCED VISIBILITY',
            SNOW_ICE: 'SNOW, FROST OR ICE RISK'
        }
    }
};

// --- SUB-COMPONENTS D'ESTIL CLARS I ENTENEDORS (SPATIAL UI) ---

/**
 * SEMÀFOR DE RISC ENTENEDOR
 * Adaptat dinàmicament a l'idioma seleccionat.
 */
const TacticalRiskBadge = ({ analysis, t, ui }: { analysis: TacticalAnalysisResult; t: TranslationType; ui: LocalUIText }) => {
    if (!analysis) return null;
    
    let risk: TacticalRiskLevel = analysis.risk_level || 'AMBER';
    
    if (!analysis.risk_level && Array.isArray(analysis.alerts) && analysis.alerts.length > 0) {
        risk = analysis.alerts.some(a => a.level === 'high') ? 'RED' : 'AMBER';
    }

    const styles: Record<TacticalRiskLevel, { badge: string; dot: string; label: string }> = {
        GREEN: {
            badge: 'text-emerald-300 border-emerald-500/50 bg-emerald-950/80 shadow-[0_0_15px_rgba(16,185,129,0.25)]',
            dot: 'bg-emerald-400 animate-pulse',
            label: ui.stable
        },
        AMBER: {
            badge: 'text-amber-300 border-amber-500/50 bg-amber-950/80 shadow-[0_0_15px_rgba(245,158,11,0.25)]',
            dot: 'bg-amber-400 animate-pulse',
            label: t.alertWarning || ui.warning
        },
        RED: {
            badge: 'text-rose-300 border-rose-500/60 bg-rose-950/90 shadow-[0_0_18px_rgba(244,63,94,0.35)]',
            dot: 'bg-rose-400 animate-ping',
            label: t.alertDanger || ui.danger
        }
    };
    
    const currentStyle = styles[risk] || styles.AMBER;
    
    return (
        <span className={`text-[10px] sm:text-xs font-mono font-bold px-3 py-1 rounded-full border ${currentStyle.badge} flex items-center gap-2 shrink-0 uppercase tracking-widest transition-all duration-300`}>
            <span className={`w-2 h-2 rounded-full ${currentStyle.dot} shrink-0`}></span>
            <span className="truncate max-w-[130px] sm:max-w-none font-sans font-extrabold tracking-wider">
                {currentStyle.label}
            </span>
        </span>
    );
};

/**
 * BÀNER DE PERILL ATMOSFÈRIC CLAR I MULTILINGÜE
 */
const TacticalHazardBanner = ({ hazardType, riskLevel, t, ui }: { hazardType?: TacticalHazardType; riskLevel?: TacticalRiskLevel; t: TranslationType; ui: LocalUIText }) => {
    if (!hazardType || hazardType === 'NONE') return null;

    const isSevere = riskLevel === 'RED';
    const hazardText = ui.hazards[hazardType] || hazardType;

    return (
        <div className={`flex items-start gap-3 p-3.5 sm:p-4 rounded-xl border shadow-lg ${
            isSevere 
                ? 'bg-rose-950/85 border-rose-500/50 text-rose-100 shadow-[0_0_20px_rgba(244,63,94,0.2)]' 
                : 'bg-amber-950/85 border-amber-500/50 text-amber-100 shadow-[0_0_20px_rgba(245,158,11,0.2)]'
        } animate-in slide-in-from-top-2 duration-500 transform-gpu translate-z-0`}>
            <div className="shrink-0 mt-0.5">
                {isSevere ? (
                    <AlertOctagon className="w-5 h-5 text-rose-400 animate-pulse drop-shadow-[0_0_8px_rgba(244,63,94,0.8)]" />
                ) : (
                    <AlertTriangle className="w-5 h-5 text-amber-400 drop-shadow-[0_0_8px_rgba(245,158,11,0.8)]" />
                )}
            </div>
            <div className="flex-1 min-w-0">
                <h4 className={`text-xs font-mono font-bold uppercase tracking-widest mb-1 ${isSevere ? 'text-rose-400' : 'text-amber-400'}`}>
                    {isSevere ? (t.alertDanger || ui.danger) : (t.alertWarning || ui.warning)}
                </h4>
                <p className="text-xs sm:text-sm font-medium leading-normal opacity-95 text-left break-words">
                    <span className="font-bold mr-1.5">{ui.reason}:</span>
                    {hazardText}
                </p>
            </div>
        </div>
    );
};

/**
 * COMPONENT D'ALERTA CLÀSSIC (Compatibilitat)
 */
const InsightAlert = ({ alert, t, ui }: { alert: AlertItem; t: TranslationType; ui: LocalUIText }) => {
    if (!alert || typeof alert !== 'object') return null;

    const isHigh = alert.level === 'high';
    return (
        <div className={`flex items-start gap-3 p-3 sm:p-4 rounded-xl border shadow-md ${
            isHigh 
                ? 'bg-rose-950/80 border-rose-500/40 text-rose-100 shadow-rose-950/50' 
                : 'bg-amber-950/80 border-amber-500/40 text-amber-100 shadow-amber-950/50'
        } animate-in slide-in-from-top-2 duration-500 transform-gpu translate-z-0`}>
            <div className="shrink-0 mt-0.5">
                {isHigh ? (
                    <AlertOctagon className="w-5 h-5 text-rose-400 animate-pulse drop-shadow-[0_0_8px_rgba(244,63,94,0.6)]" />
                ) : (
                    <AlertTriangle className="w-5 h-5 text-amber-400 drop-shadow-[0_0_8px_rgba(245,158,11,0.6)]" />
                )}
            </div>
            <div className="flex-1 min-w-0">
                <h4 className={`text-xs font-mono font-bold uppercase tracking-widest mb-1 ${isHigh ? 'text-rose-400' : 'text-amber-400'}`}>
                    {isHigh ? (t.alertDanger || ui.danger) : (t.alertWarning || ui.warning)}
                </h4>
                <p className="text-xs sm:text-sm font-medium leading-normal opacity-95 text-left break-words">
                    {alert.type && <span className="font-bold underline decoration-current/40 mr-1.5">{alert.type}:</span>}
                    {alert.msg}
                </p>
            </div>
        </div>
    );
};

/**
 * PÍNDOLA D'INFORMACIÓ RÀPIDA (100% DETERMINÍSTICA)
 */
const InsightTip = ({ tip, index }: { tip: TacticalTip | string; index: number }) => {
    if (!tip) return null;

    const isObj = typeof tip === 'object' && 'category' in tip;
    const category = isObj ? tip.category : 'SKY';
    const textStr = isObj ? tip.text : String(tip);

    if (!textStr || textStr.trim() === '') return null;

    let Icon = Activity;
    let badgeStyle = "bg-slate-950/90 hover:bg-slate-900 text-cyan-200 border-cyan-500/40 hover:border-cyan-400/80 shadow-[0_2px_10px_rgba(6,182,212,0.15)]";
    let iconColor = "text-cyan-400 drop-shadow-[0_0_6px_rgba(6,182,212,0.8)]";

    switch (category) {
        case 'WIND':
            Icon = Wind;
            badgeStyle = "bg-slate-950/90 hover:bg-slate-900 text-cyan-200 border-cyan-500/40 hover:border-cyan-400/80 shadow-[0_2px_10px_rgba(6,182,212,0.15)]";
            iconColor = "text-cyan-400 drop-shadow-[0_0_6px_rgba(6,182,212,0.8)]";
            break;
        case 'THERMAL':
            Icon = Thermometer;
            badgeStyle = "bg-amber-950/60 hover:bg-amber-950/80 text-amber-200 border-amber-500/40 hover:border-amber-400/80 shadow-[0_2px_10px_rgba(245,158,11,0.15)]";
            iconColor = "text-amber-400 drop-shadow-[0_0_6px_rgba(245,158,11,0.8)]";
            break;
        case 'SKY':
            Icon = Layers;
            badgeStyle = "bg-indigo-950/60 hover:bg-indigo-950/80 text-indigo-200 border-indigo-500/40 hover:border-indigo-400/80 shadow-[0_2px_10px_rgba(99,102,241,0.15)]";
            iconColor = "text-indigo-400 drop-shadow-[0_0_6px_rgba(99,102,241,0.8)]";
            break;
        case 'HAZARD':
            Icon = ShieldAlert;
            badgeStyle = "bg-rose-950/70 hover:bg-rose-950/90 text-rose-200 border-rose-500/50 hover:border-rose-400/80 shadow-[0_2px_12px_rgba(244,63,94,0.25)]";
            iconColor = "text-rose-400 animate-pulse drop-shadow-[0_0_8px_rgba(244,63,94,0.8)]";
            break;
        default:
            Icon = Activity;
            break;
    }

    return (
        <div 
            className={`text-xs sm:text-sm px-3 sm:px-3.5 py-1.5 sm:py-2 rounded-xl border flex items-start sm:items-center gap-2.5 transition-all animate-in zoom-in-95 duration-300 fill-mode-backwards shrink-0 max-w-full break-words ${badgeStyle}`} 
            style={{ animationDelay: `${index * 120}ms` }}
        >
            <Icon className={`w-4 h-4 shrink-0 mt-0.5 sm:mt-0 ${iconColor}`} />
            <span className="leading-snug flex-1 font-medium">{textStr}</span>
        </div>
    );
};

const InsightSkeleton = () => (
    <div className="flex flex-col gap-4 w-full h-full p-4 sm:p-6 animate-pulse">
        <div className="flex justify-between items-center mb-1 sm:mb-2">
            <div className="h-4 w-28 sm:w-32 bg-slate-800/80 rounded"></div>
            <div className="h-6 w-24 bg-slate-800/80 rounded-full"></div>
        </div>
        <div className="space-y-3">
            <div className="h-4 sm:h-5 w-3/4 bg-slate-800/60 rounded"></div>
            <div className="h-4 sm:h-5 w-full bg-slate-800/60 rounded"></div>
            <div className="h-4 sm:h-5 w-5/6 bg-slate-800/60 rounded"></div>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 mt-2">
            <div className="h-9 w-full sm:w-48 bg-slate-800/50 rounded-xl"></div>
            <div className="h-9 w-full sm:w-44 bg-slate-800/50 rounded-xl"></div>
        </div>
    </div>
);

const InsightError = ({ ui, onRetry }: { ui: LocalUIText; onRetry?: () => void }) => (
    <div className="flex flex-col items-center justify-center w-full h-full p-5 sm:p-6 text-center animate-in fade-in duration-500">
        <div className="p-3 bg-slate-900/80 rounded-full mb-3 border border-white/10 shadow-inner">
            <WifiOff className="w-6 h-6 text-slate-400" />
        </div>
        <p className="text-slate-200 font-mono font-bold text-xs uppercase tracking-widest mb-1">{ui.offlineTitle}</p>
        <p className="text-slate-400 text-xs sm:text-sm max-w-[280px] mb-4 leading-relaxed">
            {ui.offlineDesc}
        </p>
        {onRetry && (
            <button 
                onClick={onRetry}
                className="flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-200 text-xs font-mono font-bold uppercase tracking-widest rounded-xl transition-all border border-indigo-500/40 shadow-[0_0_15px_rgba(99,102,241,0.2)] active:scale-95 min-h-[40px] w-full sm:w-auto"
            >
                <RefreshCw className="w-3.5 h-3.5 animate-spin-slow" />
                {ui.retry}
            </button>
        )}
    </div>
);

// --- COMPONENT PRINCIPAL ---

export default function AIInsights({ analysis, lang, isLoading = false, hasError = false, onRetry }: AIInsightsProps) { 
    // Risc Zero: Selecció d'idioma amb fallback segur a català
    const t = TRANSLATIONS[lang] || TRANSLATIONS['ca'];
    const ui = LOCAL_UI_TEXTS[lang] || LOCAL_UI_TEXTS['ca'];
    
    if (hasError) {
        return (
            <div className="flex-1 w-full bg-slate-950/80 border border-white/10 rounded-2xl sm:rounded-3xl backdrop-blur-xl min-h-[200px] sm:min-h-[220px] flex items-center justify-center transform-gpu translate-z-0 shadow-2xl">
                <InsightError ui={ui} onRetry={onRetry} />
            </div>
        );
    }

    if (isLoading || !analysis) {
        return (
            <div className="flex-1 w-full bg-slate-950/80 border border-white/10 rounded-2xl sm:rounded-3xl backdrop-blur-xl min-h-[200px] sm:min-h-[220px] transform-gpu translate-z-0 shadow-2xl">
                <InsightSkeleton />
            </div>
        );
    }

    const isGemini = analysis.source?.includes('Gemini') ?? true;
    const hasLegacyAlerts = Array.isArray(analysis.alerts) && analysis.alerts.length > 0;
    const hasNewHazard = analysis.hazard_type && analysis.hazard_type !== 'NONE';

    return (
        <div className={`flex flex-col w-full h-full min-h-[200px] sm:min-h-[220px] border rounded-2xl sm:rounded-3xl backdrop-blur-xl shadow-2xl relative overflow-hidden transition-all duration-700 transform-gpu translate-z-0 ${
            isGemini 
                ? 'bg-gradient-to-br from-slate-950 via-indigo-950/60 to-slate-950 border-indigo-500/30 shadow-[0_8px_32px_rgba(30,27,75,0.45)]' 
                : 'bg-slate-950/80 border-white/10 shadow-slate-950/50'
        }`}>
            
            <div 
                className="absolute inset-0 opacity-15 mix-blend-overlay pointer-events-none"
                style={{ 
                    backgroundImage: `
                        linear-gradient(to right, rgba(255,255,255,0.05) 1px, transparent 1px),
                        linear-gradient(to bottom, rgba(255,255,255,0.05) 1px, transparent 1px)
                    `,
                    backgroundSize: '24px 24px'
                }}
            ></div>

            {isGemini && (
                <div 
                    className="absolute inset-0 opacity-25 mix-blend-soft-light pointer-events-none"
                    style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)' opacity='1'/%3E%3C/svg%3E")` }}
                ></div>
            )}

            {/* CAPÇALERA ENTENEDORA I MULTILINGÜE */}
            <div className="flex flex-wrap items-center justify-between gap-2.5 p-4 sm:p-5 md:p-6 pb-2.5 sm:pb-3 shrink-0 z-10 border-b border-white/5">
                <div className={`flex items-center gap-1.5 sm:gap-2 text-xs font-mono font-bold uppercase tracking-widest transition-colors duration-500 ${isGemini ? 'text-indigo-300' : 'text-slate-400'}`}>
                    {isGemini ? (
                        <>
                            <Sparkles className="w-4 h-4 text-cyan-400 animate-pulse drop-shadow-[0_0_8px_rgba(6,182,212,0.8)] shrink-0" /> 
                            <span className="bg-gradient-to-r from-cyan-300 via-indigo-200 to-purple-300 bg-clip-text text-transparent font-extrabold tracking-wider truncate">
                                {ui.aiTitle} | +6H
                            </span>
                        </>
                    ) : (
                        <>
                            <Zap className="w-4 h-4 text-cyan-400 shrink-0" /> 
                            <span className="truncate">{t.aiAnalysis || ui.aiTitle} | +6H</span>
                        </>
                    )}
                </div>
                
                <TacticalRiskBadge analysis={analysis} t={t} ui={ui} />
            </div>
            
            {/* CONTINGUT SCROLLABLE */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-4 sm:p-5 md:p-6 pt-3.5 sm:pt-4 relative z-10 flex flex-col justify-between gap-4">
                <div className="animate-in fade-in duration-700 space-y-4">
                    
                    {/* 1. Bàners d'Avís i Alerta multilingües */}
                    {hasNewHazard && (
                        <TacticalHazardBanner 
                            hazardType={analysis.hazard_type} 
                            riskLevel={analysis.risk_level} 
                            t={t}
                            ui={ui}
                        />
                    )}
                    
                    {!hasNewHazard && hasLegacyAlerts && (
                        <div className="flex flex-col gap-2.5">
                            {analysis.alerts!.map((alert, i) => (
                                <InsightAlert key={i} alert={alert} t={t} ui={ui} />
                            ))}
                        </div>
                    )}

                    {/* 2. Text Principal amb màxima llegibilitat */}
                    <div key={analysis.source || 'default'} className="min-h-[3rem] py-0.5"> 
                        <TypewriterText 
                            text={analysis.text || ''} 
                            className="text-base sm:text-lg md:text-xl text-slate-100 font-medium leading-relaxed drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)] whitespace-pre-wrap font-sans"
                        />
                    </div>
                </div>
                
                {/* 3. Píndoles d'informació clau */}
                {Array.isArray(analysis.tips) && analysis.tips.length > 0 && (
                    <div className="pt-3.5 border-t border-white/5 flex flex-col gap-2.5">
                        <div className="flex items-center gap-1.5 text-[11px] font-mono font-bold uppercase tracking-widest text-slate-400">
                            <Info className="w-3.5 h-3.5 text-cyan-400 shrink-0 drop-shadow-[0_0_4px_rgba(6,182,212,0.6)]" />
                            <span>{ui.tipsHeader}</span>
                        </div>
                        <div className="flex flex-wrap gap-2 items-center">
                            {analysis.tips.map((tip, i) => (
                                <InsightTip key={i} tip={tip} index={i} />
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}