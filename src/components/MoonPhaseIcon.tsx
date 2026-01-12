// src/components/MoonPhaseIcon.tsx
import React from 'react';

interface MoonPhaseIconProps {
  phase: number;
  className?: string;
}

export const MoonPhaseIcon = ({ phase, className = "w-16 h-16" }: MoonPhaseIconProps) => {
  // Nota: Mantenim la lògica original intacta, només afegim tipatge
  // phase ve de 0 (Nova) a 1 (Nova següent). 0.5 és Plena.

  const offset = phase <= 0.5 ? phase * 2 : (1 - phase) * 2; // 0 -> 1 -> 0
  const illumination = (1 - Math.cos(phase * 2 * Math.PI)) / 2;
  
  return (
    <div className={`relative ${className} flex items-center justify-center`} title={`Il·luminació: ${(illumination * 100).toFixed(0)}%`}>
       <svg viewBox="0 0 100 100" className="w-full h-full drop-shadow-lg">
          <circle cx="50" cy="50" r="45" fill="#1e293b" stroke="#475569" strokeWidth="1" />
          <defs>
            <mask id={`moon-mask-${phase}`}>
               <rect x="0" y="0" width="100" height="100" fill="white" />
               <ellipse 
                 cx={phase < 0.5 ? 50 - (90 * (0.5 - phase)) : 50 + (90 * (phase - 0.5))} 
                 cy="50" 
                 rx={45 * Math.abs(Math.cos(phase * Math.PI * 2))} 
                 ry="45" 
                 fill="black" 
               />
               {phase < 0.25 && <rect x="50" y="0" width="50" height="100" fill="black" />}
               {phase > 0.75 && <rect x="0" y="0" width="50" height="100" fill="black" />}
            </mask>
          </defs>
       </svg>
       
       <div className="absolute inset-0 flex items-center justify-center">
            {renderSimpleMoon(phase)}
       </div>
    </div>
  );
};

// Funció auxiliar fora del component
const renderSimpleMoon = (phase: number) => {
    const size = "w-full h-full rounded-full border border-slate-600 bg-slate-900 overflow-hidden relative shadow-[0_0_15px_rgba(255,255,255,0.1)]";
    let onRight = false;
    
    if (phase <= 0.5) {
        onRight = true; 
    } else {
        onRight = false; 
    }
    
    return (
        <div className={size}>
            <div className="absolute inset-0 bg-slate-900 transition-all duration-1000" />
             <div 
                className={`absolute top-0 bottom-0 bg-slate-100 transition-all duration-1000 ${onRight ? 'right-0' : 'left-0'}`}
                style={{ 
                    width: `${(1 - Math.cos(phase * 2 * Math.PI)) / 2 * 100}%`,
                    opacity: 0.9
                }}
             />
             <div className="absolute inset-0 rounded-full shadow-inner shadow-black/50"></div>
        </div>
    );
}