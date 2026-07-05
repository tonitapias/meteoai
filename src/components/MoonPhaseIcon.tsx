// src/components/MoonPhaseIcon.tsx
interface MoonPhaseIconProps {
  phase: number; // 0..1
  className?: string;
}

export const MoonPhaseIcon = ({ phase, className = "w-16 h-16" }: MoonPhaseIconProps) => {
  // Risc Zero: Protegim contra valors nuls, indefinits o fora de rang
  const safePhase = typeof phase === 'number' && !isNaN(phase) ? Math.max(0, Math.min(1, phase)) : 0;
  const illumination = (1 - Math.cos(safePhase * 2 * Math.PI)) / 2;
  
  // Lògica de visualització SVG (Hemisferi Nord)
  const r = 45;
  const cx = 50;
  const cy = 50;
  
  let d = "";
  
  // Corregim errors de precisió als extrems
  const isFull = safePhase > 0.48 && safePhase < 0.52;
  const isNew = safePhase < 0.02 || safePhase > 0.98;

  if (isNew) {
      d = ""; 
  } else if (isFull) {
      d = `M ${cx} ${cy - r} A ${r} ${r} 0 1 1 ${cx} ${cy + r} A ${r} ${r} 0 1 1 ${cx} ${cy - r}`;
  } else if (safePhase <= 0.5) {
      // WAXING (Creixent)
      const w = r * Math.cos(safePhase * 2 * Math.PI);
      d = `M ${cx} ${cy - r} A ${r} ${r} 0 0 1 ${cx} ${cy + r}`;
      d += ` A ${Math.abs(w)} ${r} 0 0 ${safePhase < 0.25 ? 0 : 1} ${cx} ${cy - r}`;
  } else {
      // WANING (Minvant)
      const w = r * Math.cos(safePhase * 2 * Math.PI);
      d = `M ${cx} ${cy - r} A ${r} ${r} 0 0 0 ${cx} ${cy + r}`;
      d += ` A ${Math.abs(w)} ${r} 0 0 ${safePhase > 0.75 ? 1 : 0} ${cx} ${cy - r}`;
  }

  return (
    <div className={`relative ${className} flex items-center justify-center transition-transform duration-700 ease-out hover:scale-105`} title={`Il·luminació: ${(illumination * 100).toFixed(0)}%`}>
       <svg viewBox="0 0 100 100" className="w-full h-full drop-shadow-[0_0_12px_rgba(255,255,255,0.2)] filter">
          {/* Fons fosc de la lluna (Part no il·luminada) */}
          <circle cx="50" cy="50" r="45" fill="#0f172a" stroke="#334155" strokeWidth="1" className="opacity-80" />
          {/* Part il·luminada amb efecte tàctic */}
          {d && <path d={d} fill="#f1f5f9" stroke="none" className="drop-shadow-[0_0_4px_rgba(255,255,255,0.8)]" />}
       </svg>
    </div>
  );
};