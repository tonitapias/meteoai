// src/components/widgets/ConsensusInactiveWidget.tsx
import React from 'react';
import { Language } from '../../translations';
import { Globe, Cpu, AlertTriangle } from 'lucide-react';

interface ConsensusInactiveWidgetProps {
  lang?: Language | string;
  reason?: 'timezone' | 'fallback'; 
}

export const ConsensusInactiveWidget: React.FC<ConsensusInactiveWidgetProps> = ({ 
    lang = 'ca', 
    reason = 'timezone' 
}) => {
  const isCa = lang.includes('ca');
  
  const t = {
    title: reason === 'timezone' 
        ? (isCa ? 'Matriu Global Inactiva' : 'Global Matrix Inactive')
        : (isCa ? 'Motor de Consens Suspès' : 'Consensus Engine Suspended'),
    badge: reason === 'timezone'
        ? (isCa ? 'Telemetria Remota' : 'Remote Telemetry')
        : (isCa ? 'Cobertura Global' : 'Global Coverage'),
    description: reason === 'timezone'
      ? (isCa
        ? "S'ha detectat una coordenada fora del sector local. El motor de consens s'ha posat en mode d'espera per evitar col·lisions de fusos horaris."
        : "Coordinate detected outside local sector. Consensus engine is in standby mode to prevent timezone data collisions.")
      : (isCa
        ? "Ubicació fora de la malla d'alta resolució. L'anàlisi de divergències s'ha suspès temporalment per evitar redundància matemàtica amb models globals base."
        : "Location outside high-resolution mesh. Divergence analysis is temporarily suspended to prevent mathematical redundancy with base global models."),
    action: reason === 'timezone' 
        ? (isCa ? 'Mode observació activat' : 'Observation mode engaged')
        : (isCa ? 'Mode global en ús' : 'Global mode in use'),
    icon: reason === 'timezone' ? <Globe className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
  };

  return (
    <div className="w-full relative perspective-[1000px]">
      <style>
        {`
          @keyframes float3d {
            0%, 100% { transform: translateY(0) rotateX(2deg) rotateY(-2deg); }
            50% { transform: translateY(-5px) rotateX(-1deg) rotateY(1deg); }
          }
          @keyframes spin3d {
            from { transform: rotateY(0deg) rotateX(15deg); }
            to { transform: rotateY(360deg) rotateX(15deg); }
          }
          .preserve-3d {
            transform-style: preserve-3d;
          }
        `}
      </style>

      <div className={`w-full bg-[#030712]/80 backdrop-blur-xl border ${reason === 'timezone' ? 'border-cyan-900/40' : 'border-amber-900/40'} rounded-[24px] p-6 shadow-[0_20px_50px_rgba(8,145,178,0.15)] relative overflow-hidden flex flex-col sm:flex-row items-center gap-8 preserve-3d animate-[float3d_6s_ease-in-out_infinite]`}>
         
         <div className="absolute inset-0 bg-[linear-gradient(rgba(6,182,212,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(6,182,212,0.03)_1px,transparent_1px)] bg-[size:24px_24px] opacity-40 [transform:translateZ(-50px)]"></div>
         
         <div className="relative flex items-center justify-center shrink-0 w-32 h-32 preserve-3d">
            <div className={`absolute -bottom-4 w-20 h-4 ${reason === 'timezone' ? 'bg-cyan-400/40 shadow-[0_-20px_40px_rgba(6,182,212,0.6)]' : 'bg-amber-400/30 shadow-[0_-20px_40px_rgba(251,191,36,0.5)]'} rounded-[100%] blur-md`}></div>
            <div className={`absolute bottom-0 w-24 h-32 bg-gradient-to-t ${reason === 'timezone' ? 'from-cyan-500/20' : 'from-amber-500/10'} to-transparent blur-sm [transform:rotateX(45deg)] opacity-70`}></div>

            <div className="relative w-20 h-20 preserve-3d animate-[spin3d_12s_linear_infinite]">
               <div className={`absolute inset-0 rounded-full border-[1.5px] ${reason === 'timezone' ? 'border-cyan-400/80 shadow-[0_0_15px_rgba(6,182,212,0.5)]' : 'border-amber-500/60 shadow-[0_0_15px_rgba(251,191,36,0.3)]'} [transform:rotateX(90deg)]`}></div>
               <div className={`absolute inset-0 rounded-full border ${reason === 'timezone' ? 'border-cyan-500/40' : 'border-amber-500/30'}`}></div>
               <div className={`absolute inset-0 rounded-full border ${reason === 'timezone' ? 'border-cyan-500/40' : 'border-amber-500/30'} [transform:rotateY(45deg)]`}></div>
               <div className={`absolute inset-0 rounded-full border ${reason === 'timezone' ? 'border-cyan-500/40' : 'border-amber-500/30'} [transform:rotateY(90deg)]`}></div>
               <div className={`absolute inset-0 rounded-full border ${reason === 'timezone' ? 'border-cyan-500/40' : 'border-amber-500/30'} [transform:rotateY(135deg)]`}></div>
               
               <div className="absolute inset-0 flex items-center justify-center [transform:rotateY(-90deg)]">
                  <div className={`w-2 h-2 ${reason === 'timezone' ? 'bg-white shadow-[0_0_20px_10px_rgba(255,255,255,0.8)]' : 'bg-amber-100 shadow-[0_0_20px_10px_rgba(251,191,36,0.5)]'} rounded-full`}></div>
               </div>
            </div>
         </div>

         <div className="flex flex-col text-center sm:text-left z-10 w-full [transform:translateZ(30px)]">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center w-full mb-3 gap-3">
               <h2 className={`text-[11px] sm:text-xs font-bold ${reason === 'timezone' ? 'text-cyan-100 drop-shadow-[0_0_8px_rgba(6,182,212,0.8)]' : 'text-amber-100 drop-shadow-[0_0_8px_rgba(251,191,36,0.6)]'} uppercase tracking-[0.2em]`}>
                 {t.title}
               </h2>
               <div className={`inline-flex items-center self-center sm:self-auto gap-1.5 text-[9px] font-black uppercase px-3 py-1.5 rounded-full border ${reason === 'timezone' ? 'border-cyan-500/30 bg-cyan-950/40 text-cyan-300' : 'border-amber-500/30 bg-amber-950/40 text-amber-300'} tracking-widest backdrop-blur-md`}>
                 {t.icon}
                 {t.badge}
               </div>
            </div>
            
            <p className={`text-[11px] sm:text-[13px] ${reason === 'timezone' ? 'text-cyan-100/60' : 'text-amber-100/60'} leading-relaxed font-light mb-4`}>
               {t.description}
            </p>
            
            <div className={`mt-auto flex items-center justify-between border-t ${reason === 'timezone' ? 'border-cyan-900/50' : 'border-amber-900/50'} pt-3`}>
               <div className={`flex items-center gap-2 text-[9px] font-mono uppercase tracking-widest ${reason === 'timezone' ? 'text-cyan-500' : 'text-amber-500'}`}>
                  <Cpu className="w-3.5 h-3.5 animate-pulse" />
                  <span>{t.action}</span>
               </div>
               
               <div className="flex items-end gap-0.5 h-3 opacity-60">
                  <div className={`w-1 h-full ${reason === 'timezone' ? 'bg-cyan-600' : 'bg-amber-600'} animate-[bounce_1s_infinite]`}></div>
                  <div className={`w-1 h-2/3 ${reason === 'timezone' ? 'bg-cyan-600' : 'bg-amber-600'} animate-[bounce_1.5s_infinite]`}></div>
                  <div className={`w-1 h-1 ${reason === 'timezone' ? 'bg-cyan-600' : 'bg-amber-600'} animate-[bounce_0.8s_infinite]`}></div>
                  <div className={`w-1 h-3/4 ${reason === 'timezone' ? 'bg-cyan-600' : 'bg-amber-600'} animate-[bounce_1.2s_infinite]`}></div>
               </div>
            </div>
         </div>
      </div>
    </div>
  );
};