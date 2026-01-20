// src/components/MoonPhaseIcon.tsx
import React from 'react';

interface MoonPhaseIconProps {
  phase: number;
  className?: string;
}

export const MoonPhaseIcon = ({ phase, className = "w-16 h-16" }: MoonPhaseIconProps) => {
  // Nota: Mantenim la lògica original intacta, només afegim tipatge
  // phase ve de 0 (Nova) a 1 (Nova següent). 0.5 és Plena.

  const illumination = (1 - Math.cos(phase * 2 * Math.PI)) / 2;
  
  return (
    <div className={`relative ${className} flex items-center justify-center`} title={`Il·luminació: ${(illumination * 100).toFixed(0)}%`}>
       <svg viewBox="0 0 100 100" className="w-full h-full drop-shadow-lg">
          <circle cx="50" cy="50" r="45" fill="#1e293b" stroke="#475569" strokeWidth="1" />
          <defs>
            <mask id={`moon-mask-${phase}`}>
               <rect x="0" y="0" width="100" height="100" fill="white" />
               <ellipse 
                 cx="50" 
                 cy="50" 
                 rx={45 * Math.abs(Math.cos(phase * Math.PI * 2))} 
                 ry="45" 
                 fill="black" 
               />
               {phase < 0.25 && <rect x="50" y="0" width="50" height="100" fill="black" />}
               {phase > 0.75 && <rect x="0" y="0" width="50" height="100" fill="black" />}
            </mask>
          </defs>
          <circle cx="50" cy="50" r="45" fill="#f1f5f9" mask={`url(#moon-mask-${phase})`} />
       </svg>
       
       <div className="absolute inset-0 flex items-center justify-center opacity-0">
            {/* Visualització simplificada només per debug/accessibilitat si calgués */}
       </div>
    </div>
  );
};