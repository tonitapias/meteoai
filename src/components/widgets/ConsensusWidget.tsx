import React from 'react';
// 1. Canviem AlertTriangle per Info
import { CheckCircle2, Info, Thermometer, CloudRain, GitCompare, Wind, Clock, TrendingUp, TrendingDown, MoveRight } from 'lucide-react';
import { ConsensusMetrics } from '../../utils/consensusMath';

interface ConsensusWidgetProps {
  metrics: ConsensusMetrics;
  aromeTemp?: number;
  aromePrecip?: number;
  aromeWind?: number;
  lang?: 'ca' | 'en' | 'es' | 'fr' | string;
}

export const ConsensusWidget: React.FC<ConsensusWidgetProps> = ({ 
  metrics, aromeTemp, aromePrecip = 0, aromeWind = 0, lang = 'ca' 
}) => {
  if (!metrics.isConsensusActive) return null;

  const { 
    modelsAgree, tempDiff, precipDiff, windDiff, 
    wrfTemp, wrfPrecip, wrfWind, score, futureDivergence,
    tempTrend, precipTrend, windTrend 
  } = metrics;
  
  const isCa = lang === 'ca';

  // 2. Canvi de colors: Ambre per Indigo (Anàlisi/Incertesa en lloc de Perill)
  const bgGradient = modelsAgree 
    ? 'from-emerald-900/40 to-teal-900/20 border-emerald-500/30' 
    : 'from-indigo-900/40 to-blue-900/20 border-indigo-500/30';
  
  const iconColor = modelsAgree ? 'text-emerald-400' : 'text-indigo-400';
  const glowColor = modelsAgree ? 'bg-emerald-500' : 'bg-indigo-500';
  const deltaBadgeBg = modelsAgree ? 'bg-emerald-500/20 text-emerald-300' : 'bg-indigo-500/20 text-indigo-300';
  const StatusIcon = modelsAgree ? CheckCircle2 : Info; // Nova icona neutral

  return (
    <div className={`relative overflow-hidden rounded-2xl border ${bgGradient} p-3 sm:p-5 backdrop-blur-md animate-in fade-in slide-in-from-bottom-4 duration-700 shadow-lg flex flex-col gap-3 sm:gap-4`}>
      <div className={`absolute -top-10 -right-10 w-40 h-40 rounded-full blur-3xl opacity-20 ${glowColor} pointer-events-none`}></div>

      {/* CAPÇALERA I SCORE */}
      <div className="flex items-start sm:items-center justify-between relative z-10 gap-2">
        <div className="flex items-center gap-2 sm:gap-4 flex-1 min-w-0">
          <div className={`p-1.5 sm:p-2 rounded-full bg-black/40 shadow-inner border border-white/5 flex-shrink-0 ${iconColor}`}>
            <StatusIcon className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
          <div className="min-w-0">
            {/* 3. Textos informatius en lloc d'alarmistes */}
            <h3 className="text-sm sm:text-lg font-bold text-slate-100 tracking-wide leading-tight truncate sm:whitespace-normal">
              {modelsAgree 
                ? (isCa ? 'Models Sincronitzats' : 'Models Synced') 
                : (isCa ? 'Models en Desacord' : 'Models Disagree')}
            </h3>
            <p className="text-[9px] sm:text-xs text-slate-400 line-clamp-1 sm:line-clamp-none mt-0.5">
              {modelsAgree
                ? (isCa ? 'Alta fiabilitat de la previsió actual.' : 'High reliability of current forecast.')
                : (isCa ? 'Incertesa local. La previsió pot variar.' : 'Local uncertainty. Forecast may vary.')}
            </p>
          </div>
        </div>
        
        <div className="flex flex-col items-end flex-shrink-0 pl-1 sm:pl-2">
           <span className="text-[8px] sm:text-[10px] text-slate-400 uppercase tracking-wider font-semibold mb-0.5 sm:mb-1">
             {isCa ? 'Consens' : 'Consensus'}
           </span>
           {/* L'score baixa, però ja no és vermell/ambre d'emergència, sinó colors freds/neutres */}
           <div className={`text-xl sm:text-2xl font-black leading-none ${score >= 75 ? 'text-emerald-400' : score >= 50 ? 'text-indigo-400' : 'text-slate-400'}`}>
             {score}%
           </div>
        </div>
      </div>

      {/* TAULA DE DADES */}
      <div className="grid grid-cols-3 gap-1 sm:gap-2 relative z-10 bg-black/20 rounded-xl p-1.5 sm:p-3 border border-white/5">
        
        {/* LOCAL */}
        <div className="flex flex-col gap-1.5 sm:gap-2 p-1.5 sm:p-2 rounded-lg bg-white/5 overflow-hidden">
          <span className="text-[8px] sm:text-[10px] text-slate-400 uppercase tracking-wider font-semibold text-center border-b border-white/10 pb-1 truncate">
            {isCa ? 'Local' : 'Local'} <span className="hidden sm:inline">Model</span>
          </span>
          <div className="flex items-center justify-between text-xs sm:text-sm font-bold text-white"><Thermometer className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-300 flex-shrink-0"/> <span>{aromeTemp ?? '--'}°</span></div>
          <div className="flex items-center justify-between text-xs sm:text-sm font-bold text-white"><CloudRain className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-blue-400 flex-shrink-0"/> <span>{aromePrecip ?? 0} mm</span></div>
          <div className="flex items-center justify-between text-xs sm:text-sm font-bold text-white"><Wind className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-400 flex-shrink-0"/> <span>{aromeWind ?? 0}</span></div>
        </div>

        {/* GLOBAL AMB TENDÈNCIA */}
        <div className="flex flex-col gap-1.5 sm:gap-2 p-1.5 sm:p-2 rounded-lg bg-white/5 overflow-hidden">
          <span className="text-[8px] sm:text-[10px] text-slate-400 uppercase tracking-wider font-semibold text-center border-b border-white/10 pb-1 truncate">
            {isCa ? 'Global' : 'Global'} <span className="hidden sm:inline">Model</span>
          </span>
          
          {/* Temperatura */}
          <div className="flex items-center justify-between text-xs sm:text-sm font-bold text-white">
            <Thermometer className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-300 flex-shrink-0"/> 
            <span className="flex items-center gap-1">
              {tempTrend === 'up' && <TrendingUp className="w-3 h-3 text-red-400/80"/>}
              {tempTrend === 'down' && <TrendingDown className="w-3 h-3 text-blue-400/80"/>}
              {tempTrend === 'flat' && <MoveRight className="w-3 h-3 text-slate-500/50"/>}
              {wrfTemp ?? '--'}°
            </span>
          </div>
          
          {/* Pluja */}
          <div className="flex items-center justify-between text-xs sm:text-sm font-bold text-white">
            <CloudRain className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-blue-400 flex-shrink-0"/> 
            <span className="flex items-center gap-1">
              {precipTrend === 'up' && <TrendingUp className="w-3 h-3 text-cyan-400/80"/>}
              {precipTrend === 'down' && <TrendingDown className="w-3 h-3 text-slate-400/80"/>}
              {precipTrend === 'flat' && <MoveRight className="w-3 h-3 text-slate-500/50"/>}
              {wrfPrecip ?? 0} mm
            </span>
          </div>
          
          {/* Vent */}
          <div className="flex items-center justify-between text-xs sm:text-sm font-bold text-white">
            <Wind className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-400 flex-shrink-0"/> 
            <span className="flex items-center gap-1">
              {windTrend === 'up' && <TrendingUp className="w-3 h-3 text-amber-400/80"/>}
              {windTrend === 'down' && <TrendingDown className="w-3 h-3 text-emerald-400/80"/>}
              {windTrend === 'flat' && <MoveRight className="w-3 h-3 text-slate-500/50"/>}
              {wrfWind ?? 0}
            </span>
          </div>
        </div>

        {/* DESVIACIÓ (Sense canvis) */}
        <div className="flex flex-col gap-1.5 sm:gap-2 p-1.5 sm:p-2 rounded-lg border-l border-white/10 pl-1.5 sm:pl-3">
          <div className="flex items-center gap-1 text-slate-400 justify-center border-b border-white/10 pb-1">
            <GitCompare className="w-3 h-3 hidden sm:block" />
            <span className="text-[8px] sm:text-[10px] uppercase tracking-wider font-semibold">Delta</span>
          </div>
          <div className={`text-center py-0.5 px-0.5 sm:px-0 rounded text-[9px] sm:text-xs font-bold ${deltaBadgeBg}`}>Δ {tempDiff}°</div>
          <div className={`text-center py-0.5 px-0.5 sm:px-0 rounded text-[9px] sm:text-xs font-bold ${deltaBadgeBg}`}>Δ {precipDiff}</div>
          <div className={`text-center py-0.5 px-0.5 sm:px-0 rounded text-[9px] sm:text-xs font-bold ${deltaBadgeBg}`}>Δ {windDiff}</div>
        </div>
      </div>

      {/* RADAR 3H */}
      {futureDivergence && (
        <div className="flex items-start sm:items-center gap-2 mt-1 sm:mt-2 bg-amber-500/10 border border-amber-500/20 text-amber-300 text-[10px] sm:text-xs py-1.5 sm:py-2 px-2 sm:px-3 rounded-lg relative z-10">
          <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0 mt-0.5 sm:mt-0" />
          <span className="leading-tight">{isCa ? 'Alerta: El model preveu un canvi sobtat (vent/pluja) en les properes 3 hores.' : 'Alert: Sudden change (wind/rain) predicted in the next 3 hours.'}</span>
        </div>
      )}
    </div>
  );
};