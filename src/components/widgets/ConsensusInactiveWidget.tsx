// src/components/widgets/ConsensusInactiveWidget.tsx
import React from 'react';
import { Language } from '../../translations';
import { Globe, Cpu } from 'lucide-react';

interface ConsensusInactiveWidgetProps {
  lang?: Language | string;
}

export const ConsensusInactiveWidget: React.FC<ConsensusInactiveWidgetProps> = ({ lang = 'ca' }) => {
  const isCa = lang.includes('ca');
  
  // DICCIONARI CIENTÍFIC / HOLOGRÀFIC
  const t = {
    title: isCa ? 'Matriu Global Inactiva' : 'Global Matrix Inactive',
    badge: isCa ? 'Telemetria Remota' : 'Remote Telemetry',
    description: isCa
      ? "S'ha detectat una coordenada fora del sector local. El motor de consens s'ha posat en mode d'espera per evitar col·lisions de fusos horaris."
      : "Coordinate detected outside local sector. Consensus engine is in standby mode to prevent timezone data collisions.",
    action: isCa ? 'Mode observació activat' : 'Observation mode engaged'
  };

  return (
    // CONTENIDOR PRINCIPAL AMB PERSPECTIVA 3D
    <div className="w-full relative perspective-[1000px]">
      
      {/* ANIMACIONS 3D INJECTADES */}
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

      {/* TARGETA FLOTANT (HUD HOLOGRÀFIC) */}
      <div 
        className="w-full bg-[#030712]/80 backdrop-blur-xl border border-cyan-900/40 rounded-[24px] p-6 shadow-[0_20px_50px_rgba(8,145,178,0.15)] relative overflow-hidden flex flex-col sm:flex-row items-center gap-8 preserve-3d animate-[float3d_6s_ease-in-out_infinite]"
      >
         
         {/* Fons Digital Matrix (Línies verticals) */}
         <div className="absolute inset-0 bg-[linear-gradient(rgba(6,182,212,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(6,182,212,0.03)_1px,transparent_1px)] bg-[size:24px_24px] opacity-40 [transform:translateZ(-50px)]"></div>
         
         {/* PROJECTOR HOLOGRÀFIC I ESFERA 3D */}
         <div className="relative flex items-center justify-center shrink-0 w-32 h-32 preserve-3d">
            
            {/* Llum del projector inferior */}
            <div className="absolute -bottom-4 w-20 h-4 bg-cyan-400/40 rounded-[100%] blur-md shadow-[0_-20px_40px_rgba(6,182,212,0.6)]"></div>
            
            {/* Feix de llum (Con) */}
            <div className="absolute bottom-0 w-24 h-32 bg-gradient-to-t from-cyan-500/20 to-transparent blur-sm [transform:rotateX(45deg)] opacity-70"></div>

            {/* GLOBUS TERRAQÜI 3D (Construït amb CSS pur) */}
            <div className="relative w-20 h-20 preserve-3d animate-[spin3d_12s_linear_infinite]">
               {/* Equador */}
               <div className="absolute inset-0 rounded-full border-[1.5px] border-cyan-400/80 shadow-[0_0_15px_rgba(6,182,212,0.5)] [transform:rotateX(90deg)]"></div>
               {/* Meridians */}
               <div className="absolute inset-0 rounded-full border border-cyan-500/40"></div>
               <div className="absolute inset-0 rounded-full border border-cyan-500/40 [transform:rotateY(45deg)]"></div>
               <div className="absolute inset-0 rounded-full border border-cyan-500/40 [transform:rotateY(90deg)]"></div>
               <div className="absolute inset-0 rounded-full border border-cyan-500/40 [transform:rotateY(135deg)]"></div>
               
               {/* Nucli brillant */}
               <div className="absolute inset-0 flex items-center justify-center [transform:rotateY(-90deg)]">
                  <div className="w-2 h-2 bg-white rounded-full shadow-[0_0_20px_10px_rgba(255,255,255,0.8)]"></div>
               </div>
            </div>
         </div>

         {/* BLOC DE TEXT (Suspès en l'eix Z per efecte pop-out) */}
         <div className="flex flex-col text-center sm:text-left z-10 w-full [transform:translateZ(30px)]">
            
            {/* Capçalera */}
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center w-full mb-3 gap-3">
               <h2 className="text-[11px] sm:text-xs font-bold text-cyan-100 uppercase tracking-[0.2em] drop-shadow-[0_0_8px_rgba(6,182,212,0.8)]">
                 {t.title}
               </h2>
               <div className="inline-flex items-center self-center sm:self-auto gap-1.5 text-[9px] font-black uppercase px-3 py-1.5 rounded-full border border-cyan-500/30 bg-cyan-950/40 text-cyan-300 tracking-widest backdrop-blur-md">
                 <Globe className="w-3.5 h-3.5" />
                 {t.badge}
               </div>
            </div>
            
            {/* Descripció */}
            <p className="text-[11px] sm:text-[13px] text-cyan-100/60 leading-relaxed font-light mb-4">
               {t.description}
            </p>
            
            {/* Barra d'Estat del Sistema */}
            <div className="mt-auto flex items-center justify-between border-t border-cyan-900/50 pt-3">
               <div className="flex items-center gap-2 text-[9px] font-mono uppercase tracking-widest text-cyan-500">
                  <Cpu className="w-3.5 h-3.5 animate-pulse" />
                  <span>{t.action}</span>
               </div>
               
               {/* Gràfic de barres d'activitat lateral */}
               <div className="flex items-end gap-0.5 h-3 opacity-60">
                  <div className="w-1 h-full bg-cyan-600 animate-[bounce_1s_infinite]"></div>
                  <div className="w-1 h-2/3 bg-cyan-600 animate-[bounce_1.5s_infinite]"></div>
                  <div className="w-1 h-1 bg-cyan-600 animate-[bounce_0.8s_infinite]"></div>
                  <div className="w-1 h-3/4 bg-cyan-600 animate-[bounce_1.2s_infinite]"></div>
               </div>
            </div>
            
         </div>
      </div>
    </div>
  );
};