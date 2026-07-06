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
  stroke: string;
}

// DOCTRINA RISC ZERO: Diccionari tàctic ampliat amb missatges d'acció
const getUVCategory = (uv: number): UVCategory => {
  if (uv < 3) return { 
    label: { ca: 'BAIX', es: 'BAJO', en: 'LOW', fr: 'FAIBLE' }, 
    action: { ca: 'SENSE RISC', es: 'SIN RIESGO', en: 'SAFE', fr: 'SANS RISQUE' },
    color: 'text-emerald-400', glow: 'drop-shadow-[0_0_8px_rgba(52,211,153,0.5)]', stroke: 'stroke-emerald-400' 
  };
  if (uv < 6) return { 
    label: { ca: 'MODERAT', es: 'MODERADO', en: 'MODERATE', fr: 'MODÉRÉ' }, 
    action: { ca: 'PROTECCIÓ RECOMENADA', es: 'PROT. RECOMENDADA', en: 'PROTECTION REC.', fr: 'PROT. RECOMMANDÉE' },
    color: 'text-amber-400', glow: 'drop-shadow-[0_0_8px_rgba(251,191,36,0.5)]', stroke: 'stroke-amber-400' 
  };
  if (uv < 8) return { 
    label: { ca: 'ALT', es: 'ALTO', en: 'HIGH', fr: 'ÉLEVÉ' }, 
    action: { ca: 'PROTECCIÓ OBLIGATÒRIA', es: 'PROT. OBLIGATORIA', en: 'PROTECTION REQ.', fr: 'PROT. OBLIGATOIRE' },
    color: 'text-orange-500', glow: 'drop-shadow-[0_0_10px_rgba(249,115,22,0.6)]', stroke: 'stroke-orange-500' 
  };
  if (uv < 11) return { 
    label: { ca: 'MOLT ALT', es: 'M. ALTO', en: 'V. HIGH', fr: 'T. ÉLEVÉ' }, 
    action: { ca: 'EVITAR EXPOSICIÓ', es: 'EVITAR EXPOSICIÓN', en: 'AVOID EXPOSURE', fr: 'ÉVITER L\'EXPO.' },
    color: 'text-red-500', glow: 'drop-shadow-[0_0_12px_rgba(239,68,68,0.7)]', stroke: 'stroke-red-500' 
  };
  return { 
    label: { ca: 'EXTREM', es: 'EXTREMO', en: 'EXTREME', fr: 'EXTRÊME' }, 
    action: { ca: 'RISC DE QUEMADURA', es: 'RIESGO QUEMADURA', en: 'BURN RISK', fr: 'RISQUE BRÛLURE' },
    color: 'text-purple-500', glow: 'drop-shadow-[0_0_15px_rgba(168,85,247,0.8)]', stroke: 'stroke-purple-500' 
  };
};

export const UVIndexWidget: React.FC<UVIndexWidgetProps> = ({ uvIndex, lang = 'ca' }) => {
  // DOCTRINA RISC ZERO: Extracció matemàtica segura
  const isDataMissing = uvIndex === null || uvIndex === undefined;
  const safeUV = isDataMissing ? 0 : uvIndex;
  
  const category = getUVCategory(safeUV);
  const displayLabel = category.label[lang] || category.label['ca'];
  const actionLabel = category.action[lang] || category.action['ca'];
  
  // SPATIAL UI: Matemàtica per al gràfic SVG (Arc de 180 graus)
  const clampedUV = Math.max(0, Math.min(safeUV, 12)); // Limitem a 12 per escalat visual
  const radius = 40;
  const circumference = Math.PI * radius; // Aprox 125.6
  // Calculem l'offset del dash per omplir l'arc (0 = ple, circumference = buit)
  const fillPercentage = isDataMissing ? 0 : (clampedUV / 12);
  const strokeDashoffset = circumference - (fillPercentage * circumference);

  // Escut visual tàctic segons perill
  const requiresShield = safeUV >= 6;

  return (
    <div className="flex flex-col h-full p-4 md:p-5 relative group overflow-hidden">
      {/* SPATIAL UI: Efecte de resplendor de fons condicionat al risc UV */}
      {!isDataMissing && safeUV >= 6 && (
        <div className={`absolute -bottom-10 -right-10 w-32 h-32 rounded-full blur-3xl opacity-20 ${category.color.replace('text-', 'bg-')} transition-all duration-1000 pointer-events-none`} />
      )}

      {/* Capçalera del giny */}
      <div className="flex items-center justify-between mb-4 relative z-10">
        <div className="flex items-center gap-2">
          <Sun className={`w-4 h-4 ${isDataMissing ? 'text-slate-500' : category.color} transition-colors ${!isDataMissing && safeUV > 5 ? category.glow : ''}`} />
          <span className="text-[10px] text-slate-400 font-black uppercase tracking-widest">
            {lang === 'ca' ? "Índex UV" : lang === 'es' ? "Índice UV" : lang === 'en' ? "UV Index" : "Indice UV"}
          </span>
        </div>
        {!isDataMissing && (
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-[#0B0C15] border border-white/5 shadow-inner">
            {requiresShield ? (
              <ShieldAlert className={`w-3 h-3 ${category.color}`} />
            ) : (
              <ShieldCheck className="w-3 h-3 text-emerald-500" />
            )}
            <span className={`text-[8px] font-bold uppercase tracking-wider ${requiresShield ? category.color : 'text-emerald-500'}`}>
              {actionLabel}
            </span>
          </div>
        )}
      </div>

      {/* Cos Principal: Gràfic Radial SVG i Mètriques */}
      <div className="flex-1 flex flex-col items-center justify-center relative mt-2 z-10">
        {/* SPATIAL UI: Data Arc In-Line */}
        <div className="relative w-full max-w-[140px] aspect-[2/1] flex items-end justify-center">
          <svg 
            viewBox="0 0 100 55" 
            className="absolute top-0 left-0 w-full h-full overflow-visible"
          >
            {/* Fons de l'arc (Grid/Track tàctic) */}
            <path 
              d="M 10 50 A 40 40 0 0 1 90 50" 
              fill="none" 
              stroke="rgba(255,255,255,0.05)" 
              strokeWidth="6" 
              strokeLinecap="round"
            />
            {/* Marcadors d'escala tàctics (Segmentació) */}
            <path 
              d="M 10 50 A 40 40 0 0 1 90 50" 
              fill="none" 
              stroke="rgba(255,255,255,0.1)" 
              strokeWidth="6" 
              strokeLinecap="round"
              strokeDasharray="2 8"
            />
            
            {/* Arc d'Omplert Dinàmic */}
            <path 
              d="M 10 50 A 40 40 0 0 1 90 50" 
              fill="none" 
              className={`transition-all duration-1000 ease-out ${isDataMissing ? 'stroke-transparent' : category.stroke} ${category.glow}`}
              strokeWidth="6" 
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
            />
          </svg>

          {/* Valors Centrals Dins de l'Arc */}
          <div className="flex flex-col items-center pb-1">
            <span className={`text-4xl sm:text-5xl font-mono font-bold tabular-nums tracking-tighter leading-none ${isDataMissing ? 'text-slate-600' : 'text-white drop-shadow-md'}`}>
              {isDataMissing ? '--' : safeUV.toFixed(1)}
            </span>
            <span className={`text-[11px] font-black tracking-widest mt-1 ${isDataMissing ? 'text-slate-600' : category.color}`}>
              {isDataMissing ? 'NO DATA' : displayLabel}
            </span>
          </div>
        </div>
      </div>

      {/* Llegendes inferior (Escala Mín/Màx) */}
      <div className="flex justify-between w-full text-[9px] font-mono text-slate-500 font-bold px-4 mt-2">
        <span className="opacity-60">0.0</span>
        <span className="opacity-60 text-purple-400/50">11+</span>
      </div>
    </div>
  );
};