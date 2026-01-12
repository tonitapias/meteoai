// src/components/AIInsights.tsx
import React from 'react';
import { BrainCircuit, Shirt, AlertTriangle, AlertOctagon, Info, Sparkles, Zap } from 'lucide-react';
import { MinutelyPreciseChart } from './WeatherCharts';
import { TypewriterText } from './WeatherUI';
import { TRANSLATIONS, Language } from '../constants/translations';

// --- SUB-COMPONENTS ---

interface AnalysisResult {
    text: string;
    confidenceLevel: 'high' | 'medium' | 'low';
    confidence: string;
    alerts: Array<{ type: string; msg: string; level: 'high' | 'warning' }>;
    tips: string[];
    source?: 'algorithm' | 'gemini';
}

interface AIInsightsProps {
    analysis: AnalysisResult | null;
    minutelyData: number[];
    currentPrecip: number;
    lang: Language;
}

const ConfidenceBadge = ({ analysis }: { analysis: AnalysisResult }) => {
  if (!analysis) return null;
  const styles = {
    high: 'text-green-400 border-green-500/30 bg-green-500/10',
    medium: 'text-yellow-400 border-yellow-500/30 bg-yellow-500/10',
    low: 'text-red-400 border-red-500/30 bg-red-500/10'
  };
  const currentStyle = styles[analysis.confidenceLevel] || styles.low;
  return (
    <span className={`text-[10px] px-2 py-0.5 rounded-full border ${currentStyle} flex items-center gap-1 shrink-0`}>
      {analysis.confidence}
    </span>
  );
};

const InsightAlert = ({ alert, t }: { alert: any, t: any }) => {
  const isHigh = alert.level === 'high';
  return (
    <div className={`flex items-start gap-3 p-3 rounded-lg border shadow-sm ${
      isHigh ? 'bg-red-500/10 border-red-500/30 text-red-200' : 'bg-amber-500/10 border-amber-500/30 text-amber-200'
    } animate-in slide-in-from-top-2 duration-500`}>
        <div className="shrink-0 mt-0.5">
            {isHigh ? <AlertOctagon className="w-5 h-5 text-red-400 animate-pulse" /> : <AlertTriangle className="w-5 h-5 text-amber-400" />}
        </div>
        <div>
            <h4 className={`text-xs font-bold uppercase tracking-wider mb-0.5 ${isHigh ? 'text-red-400' : 'text-amber-400'}`}>
                {isHigh ? t.alertDanger : t.alertWarning}
            </h4>
            <p className="text-xs font-medium leading-relaxed opacity-90 text-left">
                <span className="font-bold">{alert.type}:</span> {alert.msg}
            </p>
        </div>
    </div>
  );
};

const InsightTip = ({ tip, index }: { tip: string, index: number }) => {
  const isClothingTip = ['jaqueta', 'coat', 'tèrmica', 'abric', 'màniga', 'manteau'].some(k => tip.toLowerCase().includes(k));
  return (
    <span className="text-xs px-3 py-1.5 bg-indigo-500/20 text-indigo-100 rounded-lg border border-indigo-500/20 flex items-center gap-1.5 shadow-sm animate-in zoom-in duration-500" style={{animationDelay: `${index * 150}ms`}}>
        {isClothingTip ? <Shirt className="w-3.5 h-3.5 opacity-70"/> : <Info className="w-3.5 h-3.5 opacity-70"/>}
        {tip}
    </span>
  );
};

const LoadingState = ({ t }: { t: any }) => (
  <div className="flex items-center justify-center gap-2 text-slate-500 text-sm animate-pulse min-h-[10rem]">
      <div className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce"></div> {t.generatingTips}
  </div>
);

// --- COMPONENT PRINCIPAL ---

export default function AIInsights({ analysis, minutelyData, currentPrecip, lang }: AIInsightsProps) {
  const t = TRANSLATIONS[lang] || TRANSLATIONS['ca'];

  if (!analysis) return (
      <div className="flex-1 w-full bg-slate-900/40 border border-white/10 rounded-3xl p-5 backdrop-blur-md h-full flex items-center justify-center min-h-[200px]">
        <LoadingState t={t} />
      </div>
  );

  const isGemini = analysis.source === 'gemini';

  return (
    <div className={`flex flex-col w-full h-full min-h-[250px] border rounded-3xl backdrop-blur-md shadow-inner relative overflow-hidden transition-all duration-1000 ${
        isGemini 
            ? 'bg-gradient-to-br from-indigo-950/60 to-purple-900/30 border-indigo-400/30' 
            : 'bg-slate-950/40 border-white/10'
    }`}>
        
        {/* CAPÇALERA FIXA */}
        <div className="flex items-center justify-between p-5 pb-2 shrink-0 z-10">
            <div className={`flex items-center gap-2 text-xs font-bold uppercase tracking-wider transition-colors duration-500 ${isGemini ? 'text-indigo-200' : 'text-slate-400'}`}>
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
        
        {/* ZONA DE CONTINGUT AMB SCROLL */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-5 pt-2 relative z-10">
            <div className="space-y-4 animate-in fade-in">
                {/* Llista d'Alertes */}
                {analysis.alerts && analysis.alerts.length > 0 && (
                    <div className="flex flex-col gap-2 mb-2">
                        {analysis.alerts.map((alert, i) => (
                            <InsightAlert key={i} alert={alert} t={t} />
                        ))}
                    </div>
                )}

                {/* Text Generat */}
                <div key={analysis.source} className="min-h-[3rem]">
                    <TypewriterText text={analysis.text} />
                </div>
                
                {/* Badges/Consells */}
                <div className="flex flex-wrap gap-2 mt-3 mb-4">
                    {analysis.tips.map((tip, i) => (
                        <InsightTip key={i} tip={tip} index={i} />
                    ))}
                </div>
                
                {/* Gràfica */}
                <MinutelyPreciseChart data={minutelyData} label={t.preciseRain} currentPrecip={currentPrecip} />
            </div>
        </div>
    </div>
  );
}