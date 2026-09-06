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
    <div 
      className={`relative ${className} flex items-center justify-center transition-transform duration-700 ease-out hover:scale-105`} 
      title={`Il·luminació: ${(illumination * 100).toFixed(0)}%`}
    >
       <svg viewBox="0 0 100 100" className="w-full h-full filter drop-shadow-[0_0_15px_rgba(255,255,255,0.15)]">
          <defs>
              {/* Gradient esfèric per a la part il·luminada (Volum lluminós) */}
              <radialGradient id="litGradient" cx="35%" cy="35%" r="65%">
                  <stop offset="0%" stopColor="#ffffff" />
                  <stop offset="60%" stopColor="#f8fafc" />
                  <stop offset="100%" stopColor="#cbd5e1" />
              </radialGradient>

              {/* Gradient esfèric per a la part fosca (Ombra profunda) */}
              <radialGradient id="darkGradient" cx="30%" cy="30%" r="70%">
                  <stop offset="0%" stopColor="#1e293b" />
                  <stop offset="100%" stopColor="#020617" />
              </radialGradient>

              {/* Ombra interior global (Simula la curvatura de l'esfera 3D) */}
              <radialGradient id="innerShadow" cx="50%" cy="50%" r="50%">
                  <stop offset="75%" stopColor="transparent" stopOpacity="0" />
                  <stop offset="100%" stopColor="#000000" stopOpacity="0.7" />
              </radialGradient>
          </defs>

          {/* Esfera base: Fons fosc de la lluna (Part no il·luminada) */}
          <circle cx="50" cy="50" r="45" fill="url(#darkGradient)" stroke="#334155" strokeWidth="0.5" className="opacity-90" />
          
          {/* Superfície Il·luminada */}
          {d && (
              <path 
                d={d} 
                fill="url(#litGradient)" 
                stroke="none" 
                className="drop-shadow-[0_0_8px_rgba(255,255,255,0.4)]" 
              />
          )}

          {/* Capa d'ombra interior (Multiplicada) per forçar l'estètica 3D unificada */}
          <circle 
            cx="50" cy="50" r="45" 
            fill="url(#innerShadow)" 
            className="pointer-events-none mix-blend-multiply" 
          />
       </svg>
    </div>
  );
};