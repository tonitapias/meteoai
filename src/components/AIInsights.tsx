// src/components/AIInsights.tsx
import { 
    Activity, 
    AlertOctagon, 
    AlertTriangle, 
    CloudLightning, 
    CloudRain, 
    Cpu, 
    Eye, 
    Info, 
    Layers, 
    RefreshCw, 
    ShieldAlert, 
    Sparkles, 
    Sun, 
    Thermometer, 
    WifiOff, 
    Wind, 
    Zap 
} from 'lucide-react';
import { TypewriterText } from './WeatherUI';
import { TRANSLATIONS, Language, TranslationType } from '../translations';

// --- INTERFACES ESTRICTES (DOCTRINA RISC ZERO) ---

interface AlertItem {
    type: string;
    msg: string;
    level: 'high' | 'warning' | 'info';
}

interface AnalysisResult {
    text: string;
    confidenceLevel: 'high' | 'medium' | 'low';
    confidence: string;
    alerts: AlertItem[];
    tips: string[];
    source?: string;
}

interface AIInsightsProps {
    analysis: AnalysisResult | null;
    lang: Language;
    isLoading?: boolean; 
    hasError?: boolean;  
    onRetry?: () => void; 
}

// --- SUB-COMPONENTS D'ESTIL BLINDATS I ADAPTATIUS ---

const ConfidenceBadge = ({ analysis }: { analysis: AnalysisResult }) => {
    if (!analysis) return null;
    
    // Semàntica de Color Tàctica: Verd (Segur), Ambre (Avís), Roig (Perill)
    const styles: Record<string, string> = {
        high: 'text-emerald-300 border-emerald-500/50 bg-emerald-950/80 shadow-[0_0_12px_rgba(16,185,129,0.25)]',
        medium: 'text-amber-300 border-amber-500/50 bg-amber-950/80 shadow-[0_0_12px_rgba(245,158,11,0.25)]',
        low: 'text-rose-300 border-rose-500/50 bg-rose-950/80 shadow-[0_0_12px_rgba(244,63,94,0.25)]'
    };
    
    // Risc Zero: Protecció contra valors inesperats del model o tipatge indefinit
    const level = (analysis.confidenceLevel && styles[analysis.confidenceLevel]) 
        ? analysis.confidenceLevel 
        : 'medium';
        
    const currentStyle = styles[level];
    
    return (
        <span className={`text-[10px] sm:text-xs font-mono font-bold px-2.5 py-1 rounded-full border ${currentStyle} flex items-center gap-1.5 shrink-0 uppercase tracking-widest transition-all duration-300`}>
            <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse shrink-0"></span>
            <span className="truncate max-w-[110px] sm:max-w-none">{analysis.confidence || 'Analitzant'}</span>
        </span>
    );
};

const InsightAlert = ({ alert, t }: { alert: AlertItem, t: TranslationType }) => {
    if (!alert || typeof alert !== 'object') return null; // Protecció Risc Zero

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
                    {isHigh ? (t.alertDanger || 'PERILL METEOROLÒGIC') : (t.alertWarning || 'AVÍS TÀCTIC')}
                </h4>
                <p className="text-xs sm:text-sm font-medium leading-normal opacity-95 text-left break-words">
                    {alert.type && <span className="font-bold underline decoration-current/40 mr-1.5">{alert.type}:</span>}
                    {alert.msg}
                </p>
            </div>
        </div>
    );
};

const InsightTip = ({ tip, index }: { tip: unknown, index: number }) => {
    // Risc Zero: Assegurar-nos que 'tip' és una cadena de text vàlida abans de processar
    if (!tip || typeof tip !== 'string') return null;

    const lowerTip = tip.toLowerCase();
    let Icon = Activity; // Fallback de telemetria científica (Cian)
    
    // Mapeig iconogràfic 100% meteorològic i tàctic (Zero paternalisme)
    if (['vent', 'ratxes', 'wind', 'gust', 'ràfegues', 'km/h', 'cisalladura', 'brisa'].some(k => lowerTip.includes(k))) {
        Icon = Wind;
    } else if (['temp', 'descens', 'fred', 'calor', 'ºc', 'tèrmic', 'inversió', 'radiatiu', 'gel', 'rosada', 'gebre'].some(k => lowerTip.includes(k))) {
        Icon = Thermometer;
    } else if (['model', 'arome', 'wrf', 'ecmwf', 'gfs', 'hd', 'resolució', 'simulació', 'fiabilitat'].some(k => lowerTip.includes(k))) {
        Icon = Layers;
    } else if (['uv', 'solar', 'radiació', 'sol', 'diürna', 'radiactiu'].some(k => lowerTip.includes(k))) {
        Icon = Sun;
    } else if (['tempesta', 'elèctrica', 'llamps', 'truens', 'pedra', 'granissa', 'convectiu'].some(k => lowerTip.includes(k))) {
        Icon = CloudLightning;
    } else if (['pluja', 'ruixat', 'xàfec', 'precip', 'mm', 'nevar', 'neu', 'plugim', 'wmo'].some(k => lowerTip.includes(k))) {
        Icon = CloudRain;
    } else if (['aqi', 'aire', 'calima', 'pols', 'boira', 'visibilitat', 'net', 'contaminació'].some(k => lowerTip.includes(k))) {
        Icon = Eye;
    } else if (['cuidado', 'precaució', 'atenció', 'risc', 'perill', 'alerta'].some(k => lowerTip.includes(k))) {
        Icon = ShieldAlert;
    } else if (['cpu', 'algoritme', 'càlcul', 'telemetria', 'dades'].some(k => lowerTip.includes(k))) {
        Icon = Cpu;
    }

    return (
        <div 
            className="text-xs sm:text-sm px-3 sm:px-3.5 py-1.5 sm:py-2 bg-slate-950/90 hover:bg-slate-900 text-cyan-200 font-medium rounded-xl border border-cyan-500/40 hover:border-cyan-400/80 flex items-start sm:items-center gap-2 shadow-[0_2px_10px_rgba(6,182,212,0.15)] transition-all animate-in zoom-in-95 duration-300 fill-mode-backwards shrink-0 max-w-full break-words" 
            style={{ animationDelay: `${index * 120}ms` }}
        >
            <Icon className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5 sm:mt-0 drop-shadow-[0_0_6px_rgba(6,182,212,0.8)]" />
            <span className="leading-snug flex-1">{tip}</span>
        </div>
    );
};

const InsightSkeleton = () => (
    <div className="flex flex-col gap-4 w-full h-full p-4 sm:p-6 animate-pulse">
        <div className="flex justify-between items-center mb-1 sm:mb-2">
            <div className="h-4 w-28 sm:w-32 bg-slate-800/80 rounded"></div>
            <div className="h-5 w-20 bg-slate-800/80 rounded-full"></div>
        </div>
        <div className="space-y-3">
            <div className="h-4 sm:h-5 w-3/4 bg-slate-800/60 rounded"></div>
            <div className="h-4 sm:h-5 w-full bg-slate-800/60 rounded"></div>
            <div className="h-4 sm:h-5 w-5/6 bg-slate-800/60 rounded"></div>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 mt-2">
            <div className="h-8 w-full sm:w-44 bg-slate-800/50 rounded-xl"></div>
            <div className="h-8 w-full sm:w-40 bg-slate-800/50 rounded-xl"></div>
        </div>
    </div>
);

const InsightError = ({ onRetry }: { onRetry?: () => void }) => (
    <div className="flex flex-col items-center justify-center w-full h-full p-5 sm:p-6 text-center animate-in fade-in duration-500">
        <div className="p-3 bg-slate-900/80 rounded-full mb-3 border border-white/10 shadow-inner">
            <WifiOff className="w-6 h-6 text-slate-400" />
        </div>
        <p className="text-slate-200 font-mono font-bold text-xs uppercase tracking-widest mb-1">Telemetria IA Desconnectada</p>
        <p className="text-slate-400 text-xs sm:text-sm max-w-[280px] mb-4 leading-relaxed">
            No s&apos;ha pogut sintetitzar l&apos;informe atmosfèric. Les dades numèriques de la graella continuen 100% operatives.
        </p>
        {onRetry && (
            <button 
                onClick={onRetry}
                className="flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-200 text-xs font-mono font-bold uppercase tracking-widest rounded-xl transition-all border border-indigo-500/40 shadow-[0_0_15px_rgba(99,102,241,0.2)] active:scale-95 min-h-[40px] w-full sm:w-auto"
            >
                <RefreshCw className="w-3.5 h-3.5 animate-spin-slow" />
                Reintentar Connexió
            </button>
        )}
    </div>
);

// --- COMPONENT PRINCIPAL ---

export default function AIInsights({ analysis, lang, isLoading = false, hasError = false, onRetry }: AIInsightsProps) { 
    // Risc Zero: Fallback de seguretat per a la càrrega de l'idioma
    const t = TRANSLATIONS[lang] || TRANSLATIONS['ca'];
    
    if (hasError) {
        return (
            <div className="flex-1 w-full bg-slate-950/80 border border-white/10 rounded-2xl sm:rounded-3xl backdrop-blur-xl min-h-[200px] sm:min-h-[220px] flex items-center justify-center transform-gpu translate-z-0 shadow-2xl">
                <InsightError onRetry={onRetry} />
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

    const isGemini = analysis.source?.includes('Gemini') ?? false;

    return (
        <div className={`flex flex-col w-full h-full min-h-[200px] sm:min-h-[220px] border rounded-2xl sm:rounded-3xl backdrop-blur-xl shadow-2xl relative overflow-hidden transition-all duration-700 transform-gpu translate-z-0 ${
            isGemini 
                ? 'bg-gradient-to-br from-slate-950 via-indigo-950/60 to-slate-950 border-indigo-500/30 shadow-[0_8px_32px_rgba(30,27,75,0.45)]' 
                : 'bg-slate-950/80 border-white/10 shadow-slate-950/50'
        }`}>
            
            {/* Fons tàctic espacial amb graella mil·limetrada (Zero dependències pesades) */}
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

            {/* CAPÇALERA TÀCTICA (Protegida amb flex-wrap per a pantalles estretes) */}
            <div className="flex flex-wrap items-center justify-between gap-2 p-4 sm:p-5 md:p-6 pb-2 sm:pb-2 shrink-0 z-10 border-b border-white/5">
                <div className={`flex items-center gap-1.5 sm:gap-2 text-xs font-mono font-bold uppercase tracking-widest transition-colors duration-500 ${isGemini ? 'text-indigo-300' : 'text-slate-400'}`}>
                    {isGemini ? (
                        <>
                            <Sparkles className="w-4 h-4 text-cyan-400 animate-pulse drop-shadow-[0_0_8px_rgba(6,182,212,0.8)] shrink-0" /> 
                            <span className="bg-gradient-to-r from-cyan-300 via-indigo-200 to-purple-300 bg-clip-text text-transparent font-extrabold tracking-wider truncate">
                                Telemetria AI
                            </span>
                        </>
                    ) : (
                        <>
                            <Zap className="w-4 h-4 text-cyan-400 shrink-0" /> 
                            <span className="truncate">{t.aiAnalysis || 'ANÀLISI TÀCTICA IA'}</span>
                        </>
                    )}
                </div>
                <ConfidenceBadge analysis={analysis} />
            </div>
            
            {/* CONTINGUT SCROLLABLE */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-4 sm:p-5 md:p-6 pt-3 sm:pt-4 relative z-10 flex flex-col justify-between gap-4">
                <div className="animate-in fade-in duration-700 space-y-4">
                    
                    {/* 1. Alertes Prioritàries Segures */}
                    {Array.isArray(analysis.alerts) && analysis.alerts.length > 0 && (
                        <div className="flex flex-col gap-2.5">
                            {analysis.alerts.map((alert, i) => (
                                <InsightAlert key={i} alert={alert} t={t} />
                            ))}
                        </div>
                    )}

                    {/* 2. Text Principal (Typewriter) amb escala augmentada per a màxima llegibilitat en mòbil */}
                    <div key={analysis.source || 'default'} className="min-h-[3rem] py-0.5"> 
                        <TypewriterText 
                            text={analysis.text || ''} 
                            className="text-base sm:text-lg md:text-xl text-slate-100 font-medium leading-relaxed drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)] whitespace-pre-wrap font-sans"
                        />
                    </div>
                </div>
                
                {/* 3. Píndoles de Telemetria / Punts Clau d'Observació (Reorganitzades en bloc vertical per a mòbil) */}
                {Array.isArray(analysis.tips) && analysis.tips.length > 0 && (
                    <div className="pt-3 border-t border-white/5 flex flex-col gap-2">
                        <div className="flex items-center gap-1 text-[11px] font-mono font-bold uppercase tracking-widest text-slate-400">
                            <Info className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                            <span>Punts Clau de Previsió:</span>
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