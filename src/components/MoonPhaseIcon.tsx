// src/components/MoonPhaseIcon.tsx
import React from 'react';

interface MoonPhaseIconProps {
  phase: number; // 0..1
  className?: string;
}

export const MoonPhaseIcon = ({ phase, className = "w-16 h-16" }: MoonPhaseIconProps) => {
  const illumination = (1 - Math.cos(phase * 2 * Math.PI)) / 2;
  
  // Lògica de visualització SVG (Hemisferi Nord)
  const r = 45;
  const cx = 50;
  const cy = 50;
  
  let d = "";
  
  // Corregim errors de precisió als extrems
  const isFull = phase > 0.48 && phase < 0.52;
  const isNew = phase < 0.02 || phase > 0.98;

  if (isNew) {
      d = ""; 
  } else if (isFull) {
      d = `M ${cx} ${cy - r} A ${r} ${r} 0 1 1 ${cx} ${cy + r} A ${r} ${r} 0 1 1 ${cx} ${cy - r}`;
  } else if (phase <= 0.5) {
      // WAXING (Creixent)
      const w = r * Math.cos(phase * 2 * Math.PI);
      d = `M ${cx} ${cy - r} A ${r} ${r} 0 0 1 ${cx} ${cy + r}`;
      // CORRECCIÓ: Invertits els flags 1 i 0
      d += ` A ${Math.abs(w)} ${r} 0 0 ${phase < 0.25 ? 0 : 1} ${cx} ${cy - r}`;
  } else {
      // WANING (Minvant)
      const w = r * Math.cos(phase * 2 * Math.PI);
      d = `M ${cx} ${cy - r} A ${r} ${r} 0 0 0 ${cx} ${cy + r}`;
      // CORRECCIÓ: Invertits els flags 0 i 1
      d += ` A ${Math.abs(w)} ${r} 0 0 ${phase > 0.75 ? 1 : 0} ${cx} ${cy - r}`;
  }

  return (
    <div className={`relative ${className} flex items-center justify-center`} title={`Il·luminació: ${(illumination * 100).toFixed(0)}%`}>
       <svg viewBox="0 0 100 100" className="w-full h-full drop-shadow-md filter">
          <circle cx="50" cy="50" r="45" fill="#1e293b" stroke="#334155" strokeWidth="1" />
          <path d={d} fill="#f8fafc" stroke="none" />
       </svg>
    </div>
  );
};