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
import { TRANSLATIONS, Language } from '../translations';
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
        warning: 'AVÍS PRECAUCIÓ',
        danger: 'ALERTA METEO',
        reason: 'Motiu',
        tipsHeader: 'Punts clau per a les properes hores:',
        aiTitle: 'Anàlisi Meteo IA',
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
        warning: 'AVISO PRECAUCIÓN',
        danger: 'ALERTA METEO',
        reason: 'Motivo',
        tipsHeader: 'Puntos clave para las próximas horas:',
        aiTitle: 'Análisis Meteo IA',
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
        warning: 'AVIS DE PRÉCAUTION',
        danger: 'ALERTE MÉTÉO',
        reason: 'Raison',
        tipsHeader: 'Points clés pour les prochaines heures :',
        aiTitle: 'Analyse Météo IA',
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
        warning: 'CAUTION ADVISORY',
        danger: 'WEATHER ALERT',
        reason: 'Reason',
        tipsHeader: 'Key highlights for the next few hours:',
        aiTitle: 'AI Weather Analysis',
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
 * SEMÀFOR DE RISC ENTENEDOR (Efecte Vidre)
 */
const TacticalRiskBadge = ({ analysis, ui }: { analysis: TacticalAnalysisResult; ui: LocalUIText }) => {
    if (!analysis) return null;
    
    let risk: TacticalRiskLevel = analysis.risk_level || 'AMBER';
    
    if (!analysis.risk_level && Array.isArray(analysis.alerts) && analysis.alerts.length > 0) {
        risk = analysis.alerts.some(a => a.level === 'high') ? 'RED' : 'AMBER';
    }

    const styles: Record<TacticalRiskLevel, { badge: string; dot: string; label: string }> = {
        GREEN: {
            badge: 'text-emerald-300 border-emerald-500/30 bg-emerald-500/10 backdrop-blur-md shadow-[inset_0_1px_0_rgba(255,255,255,0.1),0_0_10px_rgba(16,185,129,0.1)]',
            dot: 'bg-emerald-400 shadow-[0_0_5px_rgba(16,185,129,0.8)] animate-pulse',
            label: ui.stable
        },
        AMBER: {
            badge: 'text-amber-300 border-amber-500/30 bg-amber-500/10 backdrop-blur-md shadow-[inset_0_1px_0_rgba(255,255,255,0.1),0_0_10px_rgba(245,158,11,0.1)]',
            dot: 'bg-amber-400 shadow-[0_0_5px_rgba(245,158,11,0.8)] animate-pulse',
            label: ui.warning
        },
        RED: {
            badge: 'text-rose-200 border-rose-500/40 bg-rose-500/20 backdrop-blur-md shadow-[inset_0_1px_0_rgba(255,255,255,0.2),0_0_15px_rgba(244,63,94,0.3)]',
            dot: 'bg-rose-400 shadow-[0_0_8px_rgba(244,63,94,0.9)] animate-ping',
            label: ui.danger
        }
    };
    
    const currentStyle = styles[risk] || styles.AMBER;
    
    return (
        <span className={`text-[10px] sm:text-xs font-mono font-bold px-3 py-1.5 rounded-full border ${currentStyle.badge} flex items-center gap-2 shrink-0 uppercase tracking-widest transition-all duration-300`}>
            <span className={`w-2 h-2 rounded-full ${currentStyle.dot} shrink-0`}></span>
            <span className="truncate max-w-[130px] sm:max-w-none font-sans font-extrabold tracking-wider">
                {currentStyle.label}
            </span>
        </span>
    );
};

/**
 * BÀNER DE PERILL ATMOSFÈRIC CLAR (Sense duplicitats de títol, espaiat corregit)
 */
const TacticalHazardBanner = ({ hazardType, riskLevel, ui }: { hazardType?: TacticalHazardType; riskLevel?: TacticalRiskLevel; ui: LocalUIText }) => {
    if (!hazardType || hazardType === 'NONE') return null;

    const isSevere = riskLevel === 'RED';
    const hazardText = ui.hazards[hazardType] || hazardType;

    return (
        <div className={`relative flex items-center gap-3.5 p-3.5 sm:p-4 rounded-xl border backdrop-blur-md overflow-hidden shadow-lg ${
            isSevere 
                ? 'bg-rose-950/40 border-rose-500/40 text-rose-100 ring-1 ring-inset ring-rose-500/20' 
                : 'bg-amber-950/40 border-amber-500/40 text-amber-100 ring-1 ring-inset ring-amber-500/20'
        } animate-in slide-in-from-top-2 duration-500 transform-gpu translate-z-0`}>
            
            {/* Ràfega de llum tàctica de fons */}
            <div className={`absolute top-0 left-0 w-full h-full opacity-20 pointer-events-none ${isSevere ? 'bg-gradient-to-r from-rose-500 to-transparent' : 'bg-gradient-to-r from-amber-500 to-transparent'}`} />

            <div className="shrink-0 relative z-10">
                {isSevere ? (
                    <AlertOctagon className="w-6 h-6 text-rose-400 animate-pulse drop-shadow-[0_0_12px_rgba(244,63,94,0.8)]" />
                ) : (
                    <AlertTriangle className="w-6 h-6 text-amber-400 drop-shadow-[0_0_12px_rgba(245,158,11,0.8)]" />
                )}
            </div>
            
            <div className="flex-1 min-w-0 relative z-10">
                <p className="text-sm sm:text-base leading-tight font-sans">
                    <span className="font-mono text-[10px] sm:text-xs uppercase opacity-70 tracking-widest mr-1">{ui.reason}:</span>{' '}
                    <span className={`font-extrabold tracking-wide ${isSevere ? 'text-rose-300' : 'text-amber-300'}`}>
                        {hazardText}
                    </span>
                </p>
            </div>
        </div>
    );
};

/**
 * COMPONENT D'ALERTA CLÀSSIC (Compatibilitat)
 */
const InsightAlert = ({ alert }: { alert: AlertItem }) => {
    if (!alert || typeof alert !== 'object') return null;

    const isHigh = alert.level === 'high';
    return (
        <div className={`relative flex items-center gap-3.5 p-3.5 sm:p-4 rounded-xl border backdrop-blur-md overflow-hidden shadow-lg ${
            isHigh 
                ? 'bg-rose-950/40 border-rose-500/40 text-rose-100 ring-1 ring-inset ring-rose-500/20' 
                : 'bg-amber-950/40 border-amber-500/40 text-amber-100 ring-1 ring-inset ring-amber-500/20'
        } animate-in slide-in-from-top-2 duration-500 transform-gpu translate-z-0`}>
            
            <div className={`absolute top-0 left-0 w-full h-full opacity-20 pointer-events-none ${isHigh ? 'bg-gradient-to-r from-rose-500 to-transparent' : 'bg-gradient-to-r from-amber-500 to-transparent'}`} />

            <div className="shrink-0 relative z-10">
                {isHigh ? (
                    <AlertOctagon className="w-6 h-6 text-rose-400 animate-pulse drop-shadow-[0_0_12px_rgba(244,63,94,0.8)]" />
                ) : (
                    <AlertTriangle className="w-6 h-6 text-amber-400 drop-shadow-[0_0_12px_rgba(245,158,11,0.8)]" />
                )}
            </div>
            
            <div className="flex-1 min-w-0 relative z-10">
                <p className="text-sm sm:text-base leading-tight font-sans">
                    {alert.type && <span className="font-mono text-[10px] sm:text-xs uppercase opacity-70 tracking-widest mr-1">{alert.type}:</span>}{' '}
                    <span className={`font-extrabold tracking-wide ${isHigh ? 'text-rose-300' : 'text-amber-300'}`}>
                        {alert.msg}
                    </span>
                </p>
            </div>
        </div>
    );
};

/**
 * PÍNDOLA D'INFORMACIÓ RÀPIDA (Spatial UI Glassmorphism)
 */
const InsightTip = ({ tip, index }: { tip: TacticalTip | string; index: number }) => {
    if (!tip) return null;

    const isObj = typeof tip === 'object' && 'category' in tip;
    const category = isObj ? tip.category : 'SKY';
    const textStr = isObj ? tip.text : String(tip);

    if (!textStr || textStr.trim() === '') return null;

    let Icon = Activity;
    let badgeStyle = "bg-slate-800/40 hover:bg-slate-800/60 text-cyan-100 border-cyan-500/30 ring-1 ring-inset ring-cyan-500/10 shadow-[0_2px_10px_rgba(6,182,212,0.1)]";
    let iconColor = "text-cyan-400 drop-shadow-[0_0_8px_rgba(6,182,212,0.8)]";

    switch (category) {
        case 'WIND':
            Icon = Wind;
            badgeStyle = "bg-slate-800/40 hover:bg-slate-800/60 text-cyan-100 border-cyan-500/30 ring-1 ring-inset ring-cyan-500/10 shadow-[0_2px_10px_rgba(6,182,212,0.1)]";
            iconColor = "text-cyan-400 drop-shadow-[0_0_8px_rgba(6,182,212,0.8)]";
            break;
        case 'THERMAL':
            Icon = Thermometer;
            badgeStyle = "bg-amber-950/40 hover:bg-amber-950/60 text-amber-100 border-amber-500/30 ring-1 ring-inset ring-amber-500/10 shadow-[0_2px_10px_rgba(245,158,11,0.1)]";
            iconColor = "text-amber-400 drop-shadow-[0_0_8px_rgba(245,158,11,0.8)]";
            break;
        case 'SKY':
            Icon = Layers;
            badgeStyle = "bg-indigo-950/40 hover:bg-indigo-950/60 text-indigo-100 border-indigo-500/30 ring-1 ring-inset ring-indigo-500/10 shadow-[0_2px_10px_rgba(99,102,241,0.1)]";
            iconColor = "text-indigo-400 drop-shadow-[0_0_8px_rgba(99,102,241,0.8)]";
            break;
        case 'HAZARD':
            Icon = ShieldAlert;
            badgeStyle = "bg-rose-950/40 hover:bg-rose-950/60 text-rose-100 border-rose-500/30 ring-1 ring-inset ring-rose-500/10 shadow-[0_2px_12px_rgba(244,63,94,0.15)]";
            iconColor = "text-rose-400 animate-pulse drop-shadow-[0_0_8px_rgba(244,63,94,0.8)]";
            break;
        default:
            Icon = Activity;
            break;
    }

    return (
        <div 
            className={`text-xs sm:text-sm px-3.5 py-2 rounded-xl backdrop-blur-md border flex items-start sm:items-center gap-2.5 transition-all animate-in zoom-in-95 duration-300 fill-mode-backwards shrink-0 max-w-full break-words ${badgeStyle}`} 
            style={{ animationDelay: `${index * 120}ms` }}
        >
            <Icon className={`w-4 h-4 shrink-0 mt-0.5 sm:mt-0 ${iconColor}`} />
            <span className="leading-snug flex-1 font-medium tracking-wide">{textStr}</span>
        </div>
    );
};

const InsightSkeleton = () => (
    <div className="flex flex-col gap-4 w-full h-full p-4 sm:p-6 animate-pulse">
        <div className="flex justify-between items-center mb-1 sm:mb-2">
            <div className="h-4 w-28 sm:w-32 bg-slate-800/80 rounded"></div>
            <div className="h-7 w-28 bg-slate-800/80 rounded-full"></div>
        </div>
        <div className="space-y-3">
            <div className="h-4 sm:h-5 w-3/4 bg-slate-800/60 rounded"></div>
            <div className="h-4 sm:h-5 w-full bg-slate-800/60 rounded"></div>
            <div className="h-4 sm:h-5 w-5/6 bg-slate-800/60 rounded"></div>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 mt-2">
            <div className="h-10 w-full sm:w-48 bg-slate-800/50 rounded-xl"></div>
            <div className="h-10 w-full sm:w-44 bg-slate-800/50 rounded-xl"></div>
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
                className="flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600/20 hover:bg-indigo-600/40 text-indigo-200 text-xs font-mono font-bold uppercase tracking-widest rounded-xl transition-all border border-indigo-500/40 shadow-[0_0_15px_rgba(99,102,241,0.15)] active:scale-95 min-h-[40px] w-full sm:w-auto backdrop-blur-md"
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
            <div className="flex-1 w-full bg-slate-950/60 border border-white/10 rounded-2xl sm:rounded-3xl backdrop-blur-2xl min-h-[200px] sm:min-h-[220px] flex items-center justify-center transform-gpu translate-z-0 shadow-[0_8px_32px_rgba(0,0,0,0.5)]">
                <InsightError ui={ui} onRetry={onRetry} />
            </div>
        );
    }

    if (isLoading || !analysis) {
        return (
            <div className="flex-1 w-full bg-slate-950/60 border border-white/10 rounded-2xl sm:rounded-3xl backdrop-blur-2xl min-h-[200px] sm:min-h-[220px] transform-gpu translate-z-0 shadow-[0_8px_32px_rgba(0,0,0,0.5)]">
                <InsightSkeleton />
            </div>
        );
    }

    const isGemini = analysis.source?.includes('Gemini') ?? true;
    const hasLegacyAlerts = Array.isArray(analysis.alerts) && analysis.alerts.length > 0;
    const hasNewHazard = analysis.hazard_type && analysis.hazard_type !== 'NONE';

    return (
        <div className={`flex flex-col w-full h-full min-h-[200px] sm:min-h-[220px] rounded-2xl sm:rounded-3xl backdrop-blur-2xl shadow-[0_8px_32px_rgba(0,0,0,0.5)] relative overflow-hidden transition-all duration-700 transform-gpu translate-z-0 ring-1 ring-inset ${
            isGemini 
                ? 'bg-gradient-to-br from-slate-900/90 via-indigo-950/40 to-slate-950/90 ring-indigo-500/20' 
                : 'bg-slate-950/80 ring-white/10'
        }`}>
            
            {/* Matriu Tàctica (Fons) */}
            <div 
                className="absolute inset-0 opacity-[0.08] mix-blend-overlay pointer-events-none"
                style={{ 
                    backgroundImage: `
                        linear-gradient(to right, rgba(255,255,255,0.2) 1px, transparent 1px),
                        linear-gradient(to bottom, rgba(255,255,255,0.2) 1px, transparent 1px)
                    `,
                    backgroundSize: '24px 24px'
                }}
            ></div>

            {isGemini && (
                <div 
                    className="absolute inset-0 opacity-[0.15] mix-blend-soft-light pointer-events-none"
                    style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)' opacity='1'/%3E%3C/svg%3E")` }}
                ></div>
            )}

            {/* CAPÇALERA ENTENEDORA I MULTILINGÜE */}
            <div className="flex flex-wrap items-center justify-between gap-2.5 p-4 sm:p-5 md:p-6 pb-2.5 sm:pb-3 shrink-0 z-10 border-b border-white/5 relative">
                <div className={`flex items-center gap-2 text-xs font-mono font-bold uppercase tracking-widest transition-colors duration-500 ${isGemini ? 'text-indigo-300' : 'text-slate-400'}`}>
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
                
                <TacticalRiskBadge analysis={analysis} ui={ui} />
            </div>
            
            {/* CONTINGUT SCROLLABLE */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-4 sm:p-5 md:p-6 pt-3.5 sm:pt-4 relative z-10 flex flex-col justify-between gap-5">
                <div className="animate-in fade-in duration-700 space-y-4">
                    
                    {/* 1. Bàners d'Avís i Alerta multilingües */}
                    {hasNewHazard && (
                        <TacticalHazardBanner 
                            hazardType={analysis.hazard_type} 
                            riskLevel={analysis.risk_level} 
                            ui={ui}
                        />
                    )}
                    
                    {!hasNewHazard && hasLegacyAlerts && (
                        <div className="flex flex-col gap-2.5">
                            {analysis.alerts!.map((alert, i) => (
                                <InsightAlert key={i} alert={alert} />
                            ))}
                        </div>
                    )}

                    {/* 2. Text Principal amb màxima llegibilitat */}
                    <div key={analysis.source || 'default'} className="min-h-[3rem] py-1"> 
                        <TypewriterText 
                            text={analysis.text || ''} 
                            className="text-base sm:text-lg md:text-xl text-slate-100 font-medium leading-relaxed drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)] whitespace-pre-wrap font-sans tracking-wide"
                        />
                    </div>
                </div>
                
                {/* 3. Píndoles d'informació clau */}
                {Array.isArray(analysis.tips) && analysis.tips.length > 0 && (
                    <div className="pt-4 border-t border-white/5 flex flex-col gap-3">
                        <div className="flex items-center gap-2 text-[11px] font-mono font-bold uppercase tracking-widest text-slate-400">
                            <Info className="w-3.5 h-3.5 text-cyan-400 shrink-0 drop-shadow-[0_0_4px_rgba(6,182,212,0.6)]" />
                            <span>{ui.tipsHeader}</span>
                        </div>
                        <div className="flex flex-wrap gap-2.5 items-center">
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