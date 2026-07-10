// src/components/widgets/UVIndexWidget.tsx
import React from 'react';
import { Sun, ShieldAlert, ShieldCheck } from 'lucide-react';
import { Language } from '../../translations';

interface UVIndexWidgetProps {
  uvIndex?: number | null;
  lang?: Language;
}

interface UVCategory {
  label: Record<Language, string>;
  action: Record<Language, string>;
  color: string;
  glow: string;
}

// DOCTRINA RISC ZERO: Diccionari tàctic purificat 
const getUVCategory = (uv: number): UVCategory => {
  if (uv < 3) return { 
    label: { ca: 'BAIX', es: 'BAJO', en: 'LOW', fr: 'FAIBLE' }, 
    action: { ca: 'SENSE RISC', es: 'SIN RIESGO', en: 'SAFE', fr: 'SANS RISQUE' },
    color: 'text-emerald-400', glow: 'drop-shadow-[0_0_8px_rgba(52,211,153,0.6)]'
  };
  if (uv < 6) return { 
    label: { ca: 'MODERAT', es: 'MODERADO', en: 'MODERATE', fr: 'MODÉRÉ' }, 
    action: { ca: 'PROT. RECOMENADA', es: 'PROT. RECOMENDADA', en: 'PROTECTION REC.', fr: 'PROT. RECOMMANDÉE' },
    color: 'text-amber-400', glow: 'drop-shadow-[0_0_10px_rgba(251,191,36,0.6)]' 
  };
  if (uv < 8) return { 
    label: { ca: 'ALT', es: 'ALTO', en: 'HIGH', fr: 'ÉLEVÉ' }, 
    action: { ca: 'PROT. OBLIGATÒRIA', es: 'PROT. OBLIGATORIA', en: 'PROTECTION REQ.', fr: 'PROT. OBLIGATOIRE' },
    color: 'text-orange-500', glow: 'drop-shadow-[0_0_12px_rgba(249,115,22,0.7)]' 
  };
  if (uv < 11) return { 
    label: { ca: 'MOLT ALT', es: 'M. ALTO', en: 'V. HIGH', fr: 'T. ÉLEVÉ' }, 
    action: { ca: 'EVITAR EXPOSICIÓ', es: 'EVITAR EXPOSICIÓN', en: 'AVOID EXPOSURE', fr: 'ÉVITER L\'EXPO.' },
    color: 'text-red-500', glow: 'drop-shadow-[0_0_15px_rgba(239,68,68,0.8)]' 
  };
  return { 
    label: { ca: 'EXTREM', es: 'EXTREMO', en: 'EXTREME', fr: 'EXTRÊME' }, 
    action: { ca: 'RISC DE QUEMADURA', es: 'RIESGO QUEMADURA', en: 'BURN RISK', fr: 'RISQUE BRÛLURE' },
    color: 'text-purple-500', glow: 'drop-shadow-[0_0_20px_rgba(168,85,247,0.9)]' 
  };
};

export const UVIndexWidget: React.FC<UVIndexWidgetProps> = ({ uvIndex, lang = 'ca' }) => {
  // Risc Zero: Protecció matemàtica contra nuls
  const isDataMissing = uvIndex === null || uvIndex === undefined || isNaN(uvIndex);
  const safeUV = isDataMissing ? 0 : uvIndex;
  
  const category = getUVCategory(safeUV);
  
  // Garantim el tipatge en l'accés al diccionari i la caiguda a Català si falta la key
  const safeLang = lang as Language;
  const displayLabel = category.label[safeLang] || category.label['ca'];
  const actionLabel = category.action[safeLang] || category.action['ca'];
  
  const requiresShield = safeUV >= 6;
  
  // SPATIAL UI - GEOMETRIA RADAR 270 GRAUS
  const RADIUS = 42; 
  const CIRCUMFERENCE = 2 * Math.PI * RADIUS; // Aprox 263.89
  
  // 75% cercle, 25% buit inferior
  const GAUGE_LENGTH = CIRCUMFERENCE * 0.75;
  const GAP_LENGTH = CIRCUMFERENCE * 0.25;
  
  // DOCTRINA RISC ZERO (Muntanya): L'escala base de l'OMS és 11+, però a l'estiu a les cotes altes pot arribar a 13-14.
  // Escalem dinàmicament l'anell base si el valor supera 12 perquè mai superi el 100% de la longitud.
  const maxGaugeUV = Math.max(12, safeUV); 
  const clampedUV = Math.max(0, safeUV); 
  
  const fillPercentage = isDataMissing ? 0 : (clampedUV / maxGaugeUV);
  const strokeDashoffset = GAUGE_LENGTH - (fillPercentage * GAUGE_LENGTH);

  const MATRIX_BG = `absolute inset-0 z-0 opacity-[0.03] pointer-events-none bg-[linear-gradient(to_right,#ffffff_1px,transparent_1px),linear-gradient(to_bottom,#ffffff_1px,transparent_1px)] bg-[size:12px_12px]`;

  return (
    <div className={`flex flex-col h-full p-4 md:p-5 relative group overflow-hidden backdrop-blur-md rounded-2xl border shadow-[0_8px_32px_rgba(0,0,0,0.5)] transform-gpu transition-colors duration-700 ${isDataMissing ? 'bg-gradient-to-br from-slate-900/50 to-black/80 border-slate-700/50' : 'bg-gradient-to-br from-black/60 to-[#0f111a]/80 border-white/5'}`}>
      
      <div className={MATRIX_BG}></div>

      {/* Resplendor Atmosfèric: Reacciona a l'índex UV, apagat si no hi ha dades */}
      {!isDataMissing && safeUV > 3 && (
        <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 rounded-full blur-[60px] opacity-15 ${category.color.replace('text-', 'bg-')} transition-all duration-1000 pointer-events-none transform-gpu z-0`} />
      )}

      {/* Capçalera */}
      <div className="flex items-center justify-between mb-2 relative z-10">
        <div className="flex items-center gap-2">
          <Sun className={`w-4 h-4 transition-colors duration-500 ${isDataMissing ? 'text-slate-500' : category.color} ${!isDataMissing && requiresShield ? 'animate-pulse ' + category.glow : ''}`} />
          <span className="text-[10px] text-slate-400 font-black uppercase tracking-widest">
            {lang === 'ca' ? "Índex UV" : lang === 'es' ? "Índice UV" : lang === 'en' ? "UV Index" : "Indice UV"}
          </span>
        </div>
      </div>

      {/* Contenidor Principal del Radar */}
      <div className="flex-1 flex flex-col items-center justify-center relative z-10 w-full mt-2">
        <div className="relative w-full max-w-[160px] aspect-square flex justify-center items-center mx-auto">
          
          {/* Llenç SVG 270 Graus */}
          <svg 
            viewBox="0 0 100 100" 
            className="absolute inset-0 w-full h-full overflow-visible transform-gpu drop-shadow-lg"
            // Rotem 135 graus per posar l'inici del traçat a sota a l'esquerra
            style={{ transform: 'rotate(135deg)' }}
          >
            {/* Carril de Fons (Track) */}
            <circle 
              cx="50" cy="50" r={RADIUS}
              fill="none" 
              stroke="rgba(255,255,255,0.05)" 
              strokeWidth="7" 
              strokeLinecap="round"
              strokeDasharray={`${GAUGE_LENGTH} ${GAP_LENGTH}`}
              strokeDashoffset="0"
            />
            
            {/* Indicador de Valor UV (Progress) */}
            <circle 
              cx="50" cy="50" r={RADIUS}
              fill="none" 
              className={`transition-all duration-1000 ease-out ${isDataMissing ? 'text-transparent' : category.color}`}
              stroke="currentColor"
              strokeWidth="7" 
              strokeLinecap="round"
              strokeDasharray={`${GAUGE_LENGTH} ${GAP_LENGTH}`}
              strokeDashoffset={strokeDashoffset}
              style={{ filter: !isDataMissing && safeUV > 3 ? 'drop-shadow(0px 0px 6px currentColor)' : 'none' }}
            />
          </svg>

          {/* Dades Centrals Flotants */}
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            {/* Sol Hologràfic Giratori al Fons */}
            {!isDataMissing && safeUV > 0 && (
               <Sun 
                 className={`absolute w-20 h-20 opacity-5 ${category.color} blur-sm transition-all duration-1000 z-0`} 
                 style={{ animation: 'spin 15s linear infinite' }}
               />
            )}
            
            <span className={`text-4xl sm:text-5xl font-mono font-black tabular-nums tracking-tighter leading-none relative z-10 transition-colors duration-500 ${isDataMissing ? 'text-slate-600' : 'text-white drop-shadow-md'}`}>
              {isDataMissing ? '--' : safeUV.toFixed(1)}
            </span>
            <span className={`text-[10px] sm:text-[11px] font-black tracking-widest mt-1 uppercase relative z-10 transition-colors duration-500 ${isDataMissing ? 'text-slate-600' : category.color}`}>
              {isDataMissing ? 'NO DATA' : displayLabel}
            </span>
          </div>

          {/* Etiqueta d'Acció (Ancorada al buit inferior) */}
          <div className="absolute -bottom-2 w-full flex justify-center z-20">
            {!isDataMissing && (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#0a0b10] border border-white/10 shadow-[0_4px_12px_rgba(0,0,0,0.5)] backdrop-blur-md">
                {requiresShield ? (
                  <ShieldAlert className={`w-3.5 h-3.5 ${category.color}`} />
                ) : (
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                )}
                <span className={`text-[8.5px] sm:text-[9.5px] font-bold uppercase tracking-wider ${requiresShield ? category.color : 'text-emerald-500'}`}>
                  {actionLabel}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};