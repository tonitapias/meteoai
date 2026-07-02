import React from 'react';
// Hem canviat les icones d'alerta per 'Mountain' i 'Activity' per donar un toc científic
import { Thermometer, CloudRain, GitCompare, Wind, Clock, TrendingUp, TrendingDown, MoveRight, Mountain, Activity } from 'lucide-react';
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
    tempDiff, precipDiff, windDiff, 
    wrfTemp, wrfPrecip, wrfWind, score, futureDivergence,
    tempTrend, precipTrend, windTrend 
  } = metrics;
  
  const isCa = lang === 'ca';

  // 1. GRAUS D'AFINITAT (Sense alarmismes)
  const isHighConsensus = score >= 75;
  const isMidConsensus = score >= 50 && score < 75;
  
  // 2. PALETA DE COLORS ANALÍTICA
  // Maragda (Sincronitzat) -> Cian (Lleugera variació) -> Indi (Complexitat orogràfica)
  const accentText = isHighConsensus ? 'text-emerald-400' : (isMidConsensus ? 'text-cyan-400' : 'text-indigo-400');
  const accentBg = isHighConsensus ? 'bg-emerald-500' : (isMidConsensus ? 'bg-cyan-500' : 'bg-indigo-500');
  const badgeClass = isHighConsensus ? 'bg-emerald-500/10 text-emerald-300' : (isMidConsensus ? 'bg-cyan-500/10 text-cyan-300' : 'bg-indigo-500/10 text-indigo-300');
  
  // 3. ICONOGRAFIA CONTEXTUAL
  const StatusIcon = isHighConsensus ? Activity : Mountain;

  // 4. LÈXIC PROFESSIONAL I GEOGRÀFIC
  const title = isCa 
    ? (isHighConsensus ? 'Models Alineats' : 'Efecte Orogràfic')
    : (isHighConsensus ? 'Models Aligned' : 'Orographic Effect');

  const subtitle = isCa
    ? (isHighConsensus ? 'Alta estabilitat atmosfèrica a la zona' : 'El relleu genera discrepàncies locals')
    : (isHighConsensus ? 'High atmospheric stability' : 'Terrain causes local discrepancies');

  return (
    // Fons elegant de 'dashboard' científic. Mai es torna vermell.
    <div className="relative overflow-hidden rounded-2xl border border-slate-700/50 bg-gradient-to-br from-slate-900/90 to-slate-950/90 p-3 sm:p-5 backdrop-blur-xl animate-in fade-in slide-in-from-bottom-4 duration-700 shadow-xl flex flex-col gap-3 sm:gap-4">
      <div className={`absolute -top-12 -right-12 w-48 h-48 rounded-full blur-[60px] opacity-15 pointer-events-none ${accentBg}`}></div>

      {/* CAPÇALERA I SCORE */}
      <div className="flex items-start sm:items-center justify-between relative z-10 gap-2">
        <div className="flex items-center gap-2 sm:gap-4 flex-1 min-w-0">
          <div className={`p-1.5 sm:p-2 rounded-full bg-white/5 border border-white/5 flex-shrink-0 ${accentText}`}>
            <StatusIcon className="w-5 h-5 sm:w-6 sm:h-6" strokeWidth={2.5} />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm sm:text-lg font-bold text-slate-100 tracking-wide leading-tight truncate sm:whitespace-normal">
              {title}
            </h3>
            <p className="text-[9px] sm:text-xs text-slate-400 line-clamp-1 sm:line-clamp-none mt-0.5">
              {subtitle}
            </p>
          </div>
        </div>
        
        <div className="flex flex-col items-end flex-shrink-0 pl-1 sm:pl-2">
           <span className="text-[8px] sm:text-[10px] text-slate-500 uppercase tracking-wider font-semibold mb-0.5 sm:mb-1">
             {isCa ? 'Afinitat' : 'Affinity'}
           </span>
           <div className={`text-xl sm:text-2xl font-black leading-none ${accentText}`}>
             {score}%
           </div>
        </div>
      </div>

      {/* TAULA DE DADES (Amb les fletxes de tendència intactes) */}
      <div className="grid grid-cols-3 gap-1 sm:gap-2 relative z-10 bg-black/40 rounded-xl p-1.5 sm:p-3 border border-white/5 shadow-inner">
        
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
          <div className="flex items-center justify-between text-xs sm:text-sm font-bold text-white">
            <Thermometer className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-300 flex-shrink-0"/> 
            <span className="flex items-center gap-1">
              {tempTrend === 'up' && <TrendingUp className="w-3 h-3 text-red-400/80"/>}
              {tempTrend === 'down' && <TrendingDown className="w-3 h-3 text-blue-400/80"/>}
              {tempTrend === 'flat' && <MoveRight className="w-3 h-3 text-slate-500/50"/>}
              {wrfTemp ?? '--'}°
            </span>
          </div>
          <div className="flex items-center justify-between text-xs sm:text-sm font-bold text-white">
            <CloudRain className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-blue-400 flex-shrink-0"/> 
            <span className="flex items-center gap-1">
              {precipTrend === 'up' && <TrendingUp className="w-3 h-3 text-cyan-400/80"/>}
              {precipTrend === 'down' && <TrendingDown className="w-3 h-3 text-slate-400/80"/>}
              {precipTrend === 'flat' && <MoveRight className="w-3 h-3 text-slate-500/50"/>}
              {wrfPrecip ?? 0} mm
            </span>
          </div>
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

        {/* DESVIACIÓ */}
        <div className="flex flex-col gap-1.5 sm:gap-2 p-1.5 sm:p-2 rounded-lg border-l border-white/10 pl-1.5 sm:pl-3">
          <div className="flex items-center gap-1 text-slate-400 justify-center border-b border-white/10 pb-1">
            <GitCompare className="w-3 h-3 hidden sm:block" />
            <span className="text-[8px] sm:text-[10px] uppercase tracking-wider font-semibold">Delta</span>
          </div>
          <div className={`text-center py-0.5 px-0.5 sm:px-0 rounded text-[9px] sm:text-xs font-bold ${badgeClass}`}>Δ {tempDiff}°</div>
          <div className={`text-center py-0.5 px-0.5 sm:px-0 rounded text-[9px] sm:text-xs font-bold ${badgeClass}`}>Δ {precipDiff}</div>
          <div className={`text-center py-0.5 px-0.5 sm:px-0 rounded text-[9px] sm:text-xs font-bold ${badgeClass}`}>Δ {windDiff}</div>
        </div>
      </div>

      {/* RADAR 3H - Ara és una nota informativa, no una alerta taronja */}
      {futureDivergence && (
        <div className="flex items-start sm:items-center gap-2 mt-1 sm:mt-2 bg-white/5 border border-white/10 text-slate-300 text-[10px] sm:text-xs py-1.5 sm:py-2 px-2 sm:px-3 rounded-lg relative z-10">
          <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0 text-cyan-400 mt-0.5 sm:mt-0" />
          <span className="leading-tight">
            {isCa ? 'Nota: El radar detecta inèrcia de canvi (vent/pluja) a 3 hores vista.' : 'Note: Change inertia (wind/rain) detected in the next 3 hours.'}
          </span>
        </div>
      )}
    </div>
  );
};