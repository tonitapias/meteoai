// src/components/AIInsights.jsx
import React from 'react';
import { BrainCircuit, Shirt, AlertTriangle, AlertOctagon, Info } from 'lucide-react';
import { MinutelyPreciseChart } from './WeatherCharts';
import { TypewriterText } from './WeatherUI';
import { TRANSLATIONS } from '../constants/translations';

// --- SUB-COMPONENTS (Per mantenir el codi net) ---

const ConfidenceBadge = ({ analysis }) => {
  if (!analysis) return null;
  
  const styles = {
    high: 'text-green-400 border-green-500/30 bg-green-500/10',
    medium: 'text-yellow-400 border-yellow-500/30 bg-yellow-500/10',
    low: 'text-red-400 border-red-500/30 bg-red-500/10'
  };

  const currentStyle = styles[analysis.confidenceLevel] || styles.low;

  return (
    <span className={`text-[10px] px-2 py-0.5 rounded-full border ${currentStyle}`}>
      {analysis.confidence}
    </span>
  );
};

const InsightAlert = ({ alert, t }) => {
  const isHigh = alert.level === 'high';
  
  return (
    <div className={`flex items-start gap-3 p-3 rounded-lg border shadow-sm ${
      isHigh 
        ? 'bg-red-500/10 border-red-500/30 text-red-200' 
        : 'bg-amber-500/10 border-amber-500/30 text-amber-200'
    } animate-in slide-in-from-top-2 duration-500`}>
        <div className="shrink-0 mt-0.5">
            {isHigh 
                ? <AlertOctagon className="w-5 h-5 text-red-400 animate-pulse" /> 
                : <AlertTriangle className="w-5 h-5 text-amber-400" />
            }
        </div>
        <div>
            <h4 className={`text-xs font-bold uppercase tracking-wider mb-0.5 ${
                isHigh ? 'text-red-400' : 'text-amber-400'
            }`}>
                {isHigh ? t.alertDanger : t.alertWarning}
            </h4>
            <p className="text-xs font-medium leading-relaxed opacity-90">
                <span className="font-bold">{alert.type}:</span> {alert.msg}
            </p>
        </div>
    </div>
  );
};

const InsightTip = ({ tip, index }) => {
  const isClothingTip = tip.includes('jaqueta') || tip.includes('coat') || tip.includes('tèrmica');
  
  return (
    <span 
      className="text-xs px-3 py-1.5 bg-indigo-500/20 text-indigo-100 rounded-lg border border-indigo-500/20 flex items-center gap-1.5 shadow-sm animate-in zoom-in duration-500" 
      style={{animationDelay: `${index * 150}ms`}}
    >
        {isClothingTip 
            ? <Shirt className="w-3.5 h-3.5 opacity-70"/> 
            : <Info className="w-3.5 h-3.5 opacity-70"/>}
        {tip}
    </span>
  );
};

const LoadingState = ({ t }) => (
  <div className="flex items-center gap-2 text-slate-500 text-sm animate-pulse min-h-[3em]">
      <div className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce"></div> {t.generatingTips}
  </div>
);

// --- COMPONENT PRINCIPAL ---

export default function AIInsights({ analysis, minutelyData, currentPrecip, lang }) {
  const t = TRANSLATIONS[lang] || TRANSLATIONS['ca'];

  return (
    <div className="flex-1 w-full lg:max-w-md bg-slate-950/30 border border-white/10 rounded-2xl p-5 backdrop-blur-md shadow-inner relative overflow-hidden self-stretch flex flex-col justify-center h-full">
        
        {/* Capçalera */}
        <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2 text-xs font-bold uppercase text-indigo-300 tracking-wider">
                <BrainCircuit className="w-4 h-4 animate-pulse" strokeWidth={2.5}/> {t.aiAnalysis}
            </div>
            <ConfidenceBadge analysis={analysis} />
        </div>
        
        {/* Contingut Principal */}
        {analysis ? (
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
            <TypewriterText text={analysis.text} />
            
            {/* Badges/Consells */}
            <div className="flex flex-wrap gap-2 mt-3 mb-4">
                {analysis.tips.map((tip, i) => (
                    <InsightTip key={i} tip={tip} index={i} />
                ))}
            </div>
            
            {/* Gràfica */}
            <MinutelyPreciseChart data={minutelyData} label={t.preciseRain} currentPrecip={currentPrecip} />
        </div>
        ) : (
            <LoadingState t={t} />
        )}
    </div>
  );
}