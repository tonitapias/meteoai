// src/components/AIInsights.tsx
import React from 'react';
import { Shirt, AlertTriangle, AlertOctagon, Info, Sparkles, Zap, Car, Umbrella, ShieldAlert, WifiOff, RefreshCw } from 'lucide-react';
import { TypewriterText } from './WeatherUI';
import { TRANSLATIONS, Language } from '../translations';

// --- INTERFACES ---

interface AlertItem {
    type: string;
    msg: string;
    level: 'high' | 'warning';
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

type TranslationSubset = Record<string, string>;

// --- SUB-COMPONENTS D'ESTIL ---

const ConfidenceBadge = ({ analysis }: { analysis: AnalysisResult }) => {
  if (!analysis) return null;
  const styles = {
    high: 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10',
    medium: 'text-amber-400 border-amber-500/30 bg-amber-500/10',
    low: 'text-rose-400 border-rose-500/30 bg-rose-500/10'
  };
  const level = analysis.confidenceLevel || 'medium';
  const currentStyle = styles[level] || styles.medium;
  
  return (
    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${currentStyle} flex items-center gap-1 shrink-0 uppercase tracking-wider`}>
      {analysis.confidence}
    </span>
  );
};

const InsightAlert = ({ alert, t }: { alert: AlertItem, t: TranslationSubset }) => {
  const isHigh = alert.level === 'high';
  return (
    <div className={`flex items-start gap-3 p-3 rounded-lg border shadow-sm ${
      isHigh ? 'bg-rose-500/10 border-rose-500/20 text-rose-200' : 'bg-amber-500/10 border-amber-500/20 text-amber-200'
    } animate-in slide-in-from-top-2 duration-500`}>
        <div className="shrink-0 mt-0.5">
            {isHigh ? <AlertOctagon className="w-5 h-5 text-rose-400 animate-pulse" /> : <AlertTriangle className="w-5 h-5 text-amber-400" />}
        </div>
        <div>
            <h4 className={`text-xs font-bold uppercase tracking-wider mb-0.5 ${isHigh ? 'text-rose-400' : 'text-amber-400'}`}>
                {isHigh ? t.alertDanger : t.alertWarning}
            </h4>
            <p className="text-sm font-medium leading-relaxed opacity-90 text-left">
                <span className="font-bold opacity-70 mr-1">{alert.type}:</span>{alert.msg}
            </p>
        </div>
    </div>
  );
};

const InsightTip = ({ tip, index }: { tip: string, index: number }) => {
  const lowerTip = tip.toLowerCase();
  let Icon = Info;
  if (['jaqueta', 'coat', 'tèrmica', 'abric', 'màniga', 'manteau', 'roba'].some(k => lowerTip.includes(k))) Icon = Shirt;
  else if (['cotxe', 'conducció', 'carretera', 'drive', 'traffic', 'trànsit'].some(k => lowerTip.includes(k))) Icon = Car;
  else if (['paraigua', 'umbrella', 'parapluie', 'mullar'].some(k => lowerTip.includes(k))) Icon = Umbrella;
  else if (['cuidado', 'precaució', 'atenció', 'warning'].some(k => lowerTip.includes(k))) Icon = ShieldAlert;

  return (
    <div 
        className="text-xs px-3 py-1.5 bg-white/5 hover:bg-white/10 text-indigo-100 rounded-full border border-white/10 flex items-center gap-2 shadow-sm transition-colors animate-in zoom-in duration-300 fill-mode-backwards" 
        style={{animationDelay: `${index * 100}ms`}}
    >
        <Icon className="w-3.5 h-3.5 opacity-70 text-indigo-300"/>
        <span>{tip}</span>
    </div>
  );
};

const InsightSkeleton = () => (
  <div className="flex flex-col gap-4 w-full h-full p-6 animate-pulse">
      <div className="flex justify-between items-center mb-2">
          <div className="h-4 w-24 bg-slate-700/50 rounded"></div>
          <div className="h-4 w-16 bg-slate-700/50 rounded-full"></div>
      </div>
      <div className="space-y-3">
          <div className="h-4 w-3/4 bg-slate-700/30 rounded"></div>
          <div className="h-4 w-full bg-slate-700/30 rounded"></div>
          <div className="h-4 w-5/6 bg-slate-700/30 rounded"></div>
      </div>
  </div>
);

// --- CORRECCIÓ AQUÍ: &apos; en lloc de ' ---
const InsightError = ({ onRetry }: { onRetry?: () => void }) => (
  <div className="flex flex-col items-center justify-center w-full h-full p-6 text-center animate-in fade-in duration-500">
      <div className="p-3 bg-slate-800/50 rounded-full mb-3 border border-white/5">
        <WifiOff className="w-6 h-6 text-slate-400" />
      </div>
      <p className="text-slate-300 font-medium text-sm mb-1">IA Descansant</p>
      <p className="text-slate-500 text-xs max-w-[250px] mb-4">
          No s&apos;ha pogut connectar amb el model de llenguatge. Les dades numèriques són correctes.
      </p>
      {onRetry && (
        <button 
          onClick={onRetry}
          className="flex items-center gap-2 px-3 py-1.5 bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 text-xs font-bold rounded-lg transition-all border border-indigo-500/30"
        >
          <RefreshCw className="w-3 h-3" />
          REINTENTAR
        </button>
      )}
  </div>
);

// --- COMPONENT PRINCIPAL ---

export default function AIInsights({ analysis, lang, isLoading = false, hasError = false, onRetry }: AIInsightsProps) { 
  const t = (TRANSLATIONS[lang] || TRANSLATIONS['ca']) as TranslationSubset;
  
  if (hasError) {
     return (
        <div className="flex-1 w-full bg-slate-950/40 border border-white/5 rounded-3xl backdrop-blur-md min-h-[200px] flex items-center justify-center">
            <InsightError onRetry={onRetry} />
        </div>
     );
  }

  if (isLoading || !analysis) {
      return (
          <div className="flex-1 w-full bg-slate-900/40 border border-white/5 rounded-3xl backdrop-blur-md min-h-[200px]">
            <InsightSkeleton />
          </div>
      );
  }

  const isGemini = analysis.source && analysis.source.includes('Gemini');

  return (
    <div className={`flex flex-col w-full h-full min-h-[200px] border rounded-3xl backdrop-blur-md shadow-2xl relative overflow-hidden transition-all duration-1000 ${
        isGemini 
            ? 'bg-gradient-to-br from-indigo-950/80 via-slate-900/90 to-purple-950/50 border-indigo-400/30 shadow-indigo-900/20' 
            : 'bg-slate-950/40 border-white/5'
    }`}>
        
        {isGemini && (
    <div 
        className="absolute inset-0 opacity-20 mix-blend-soft-light pointer-events-none"
        style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)' opacity='1'/%3E%3C/svg%3E")` }}
    ></div>
)}

        {/* CAPÇALERA */}
        <div className="flex items-center justify-between p-6 pb-2 shrink-0 z-10">
            <div className={`flex items-center gap-2 text-xs font-bold uppercase tracking-widest transition-colors duration-500 ${isGemini ? 'text-indigo-200' : 'text-slate-400'}`}>
                {isGemini ? (
                    <>
                        <Sparkles className="w-4 h-4 text-purple-400 animate-pulse" /> 
                        <span className="bg-gradient-to-r from-indigo-300 to-purple-300 bg-clip-text text-transparent">MeteoAI Gemini</span>
                    </>
                ) : (
                    <>
                        <Zap className="w-4 h-4" /> <span>{t.aiAnalysis}</span>
                    </>
                )}
            </div>
            <ConfidenceBadge analysis={analysis} />
        </div>
        
        {/* CONTINGUT SCROLLABLE */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-6 pt-3 relative z-10 flex flex-col">
            <div className="space-in fade-in duration-700">
                {/* 1. Alertes Prioritàries */}
                {analysis.alerts && analysis.alerts.length > 0 && (
                    <div className="flex flex-col gap-2 mb-4">
                        {analysis.alerts.map((alert, i) => (
                            <InsightAlert key={i} alert={alert} t={t} />
                        ))}
                    </div>
                )}

                {/* 2. Text Principal (Typewriter) */}
                <div key={analysis.source} className="min-h-[3rem]"> 
                    <TypewriterText 
                        text={analysis.text} 
                        className="text-lg md:text-xl text-slate-100 font-medium leading-relaxed drop-shadow-sm whitespace-pre-wrap"
                    />
                </div>
                
                {/* 3. Consells / Tips */}
                {analysis.tips && analysis.tips.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-4">
                        {analysis.tips.map((tip, i) => (
                            <InsightTip key={i} tip={tip} index={i} />
                        ))}
                    </div>
                )}
            </div>
        </div>
    </div>
  );
}