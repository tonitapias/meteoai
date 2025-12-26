import React from 'react';
import { BrainCircuit, Shirt, AlertTriangle } from 'lucide-react';
import { MinutelyPreciseChart } from './WeatherCharts';
import { TypewriterText } from './WeatherUI';
import { TRANSLATIONS } from '../constants/translations';

export default function AIInsights({ analysis, minutelyData, currentPrecip, lang }) {
  const t = TRANSLATIONS[lang] || TRANSLATIONS['ca'];

  return (
    <div className="flex-1 w-full lg:max-w-md bg-slate-950/30 border border-white/10 rounded-2xl p-5 backdrop-blur-md shadow-inner relative overflow-hidden self-stretch flex flex-col justify-center h-full">
        <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2 text-xs font-bold uppercase text-indigo-300 tracking-wider">
                <BrainCircuit className="w-4 h-4 animate-pulse" strokeWidth={2.5}/> {t.aiAnalysis}
            </div>
            {analysis && (
                <span className={`text-[10px] px-2 py-0.5 rounded-full border ${
                    analysis.confidenceLevel === 'high' ? 'text-green-400 border-green-500/30 bg-green-500/10' :
                    analysis.confidenceLevel === 'medium' ? 'text-yellow-400 border-yellow-500/30 bg-yellow-500/10' :
                    'text-red-400 border-red-500/30 bg-red-500/10'
                }`}>
                    {analysis.confidence}
                </span>
            )}
        </div>
        
        {analysis ? (
        <div className="space-y-4 animate-in fade-in">
            <TypewriterText text={analysis.text} />
            
            <div className="flex flex-wrap gap-2 mt-3 mb-4">
                {analysis.tips.map((tip, i) => (
                <span key={i} className="text-xs px-3 py-1.5 bg-indigo-500/20 text-indigo-100 rounded-lg border border-indigo-500/20 flex items-center gap-1.5 shadow-sm animate-in zoom-in duration-500" style={{animationDelay: `${i*150}ms`}}>
                    {tip.includes('jaqueta') || tip.includes('coat') ? <Shirt className="w-3.5 h-3.5 opacity-70"/> : <AlertTriangle className="w-3.5 h-3.5 opacity-70"/>}
                    {tip}
                </span>
                ))}
            </div>
            
            {/* Gràfica de pluja min·a·min */}
            <MinutelyPreciseChart data={minutelyData} label={t.preciseRain} currentPrecip={currentPrecip} />
        </div>
        ) : (
        <div className="flex items-center gap-2 text-slate-500 text-sm animate-pulse min-h-[3em]">
            <div className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce"></div> {t.generatingTips}
        </div>
        )}
    </div>
  );
}