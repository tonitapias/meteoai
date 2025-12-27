// src/components/MoonPhaseIcon.jsx
import React from 'react';

export const MoonPhaseIcon = ({ phase, className = "w-16 h-16" }) => {
  // phase ve de 0 (Nova) a 1 (Nova següent). 0.5 és Plena.
  
  // Càlcul de la màscara d'ombra SVG
  // Utilitzem matemàtiques de projecció esfèrica per simular l'ombra corba
  const getPath = (p) => {
    const r = 50; // radi
    const cx = 50;
    const cy = 50;
    
    // Normalitzem per tenir dos cicles (0-0.5 i 0.5-1)
    // Si és 0-0.5 (Creixent), l'ombra està a l'esquerra.
    // Si és 0.5-1 (Minvant), l'ombra està a la dreta.
    
    const isWaning = p > 0.5;
    const sweep = isWaning ? 0 : 1;
    
    // Convertim fase a un ample d'el·lipse per l'ombra (-r a r)
    // 0 -> r (tot fosc), 0.25 -> 0 (meitat), 0.5 -> -r (tot clar)
    let lighting = (Math.cos(p * 2 * Math.PI) * r); 
    
    // Això és complex, així que per simplificar visualment en React:
    // Farem servir una màscara simple o dos cercles superposats.
    
    // Lògica simplificada robusta per visualització ràpida:
    // Retornem directament classes de Tailwind o un cercle simple amb gradient si és massa complex calcular l'arc Bezier en calent.
    return null; 
  };

  // NOTA: Per no complicar amb trigonometria complexa, usarem una aproximació visual amb CSS/SVG
  // Radi 40 per deixar marge
  const offset = phase <= 0.5 ? phase * 2 : (1 - phase) * 2; // 0 -> 1 -> 0
  
  // Il·luminació (0 a 100%)
  const illumination = (1 - Math.cos(phase * 2 * Math.PI)) / 2;
  
  // Determinem la posició de l'ombra
  const cx = 50;
  
  return (
    <div className={`relative ${className} flex items-center justify-center`} title={`Il·luminació: ${(illumination * 100).toFixed(0)}%`}>
       <svg viewBox="0 0 100 100" className="w-full h-full drop-shadow-lg">
          {/* Fons fosc (la part no il·luminada) */}
          <circle cx="50" cy="50" r="45" fill="#1e293b" stroke="#475569" strokeWidth="1" />
          
          {/* Màscara per la part il·luminada */}
          <defs>
            <mask id={`moon-mask-${phase}`}>
               <rect x="0" y="0" width="100" height="100" fill="white" />
               {/* L'ombra que es mou */}
               <ellipse 
                 cx={phase < 0.5 ? 50 - (90 * (0.5 - phase)) : 50 + (90 * (phase - 0.5))} 
                 cy="50" 
                 rx={45 * Math.abs(Math.cos(phase * Math.PI * 2))} 
                 ry="45" 
                 fill="black" 
               />
               {/* Rectangles per tapar meitats segons la fase */}
               {phase < 0.25 && <rect x="50" y="0" width="50" height="100" fill="black" />}
               {phase > 0.75 && <rect x="0" y="0" width="50" height="100" fill="black" />}
            </mask>
          </defs>

          {/* El cercle brillant de la lluna, emmascarat */}
          {/* Aquesta aproximació visual és millor fer-la amb llibreries, 
              però aquí farem una versió més senzilla: Icona + Text */}
       </svg>
       
       {/* VERSIÓ SIMPLE PER EVITAR BUGS DE RENDERITZAT SVG COMPLEX: */}
       <div className="absolute inset-0 flex items-center justify-center">
            {renderSimpleMoon(phase)}
       </div>
    </div>
  );
};

// Funció auxiliar per dibuixar la lluna amb caràcters o lògica simple si l'SVG falla
const renderSimpleMoon = (phase) => {
    // Utilitzem emojis o cercles CSS
    const size = "w-full h-full rounded-full border border-slate-600 bg-slate-900 overflow-hidden relative shadow-[0_0_15px_rgba(255,255,255,0.1)]";
    
    // Ombra
    const shadowStyle = {
        position: 'absolute',
        top: 0, bottom: 0,
        backgroundColor: '#f1f5f9', // Color Lluna (Blanc)
        boxShadow: '0 0 10px rgba(255,255,255,0.5)'
    };

    // Això és un truc visual clàssic per fases lunars amb CSS:
    // Si la fase és < 0.5 (Creixent): Fons fosc. Llum ve de la dreta? No, oest.
    // Simplifiquem:
    let percent = 0;
    let onRight = false;
    
    if (phase <= 0.5) {
        // Nova -> Plena
        percent = phase * 2; // 0 -> 1
        onRight = true; // Creixent (forma de D)
    } else {
        // Plena -> Nova
        percent = (1 - phase) * 2; // 1 -> 0
        onRight = false; // Minvant (forma de C)
    }
    
    // Nota: "Mentirosa" -> C (Creixent) / D (Decreixent) depèn de l'hemisferi.
    // Assumim Hemisferi Nord per defecte.

    return (
        <div className={size}>
            <div 
                className="absolute inset-0 bg-slate-900 transition-all duration-1000"
            />
            {/* Aquest div simula la part il·luminada ajustant l'ample */}
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