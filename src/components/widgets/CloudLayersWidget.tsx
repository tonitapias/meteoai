// src/components/widgets/CloudLayersWidget.tsx
// Giny "Capes de núvols" (abans "Profunditat de núvols": no mostra el gruix dels núvols, i el títol no cabia a
// PC): el perfil vertical del cel ara mateix. La cobertura efectiva i el seu nivell (els mateixos que el modal i
// que la icona de cel, utils/cloudCoverLevel.ts) i les tres capes apilades com al cel (alts a dalt, baixos a
// baix), amb les alçades que les defineixen a Open-Meteo (< 3 km, 3-8 km, > 8 km) marcades a les línies que les
// separen i una barra horitzontal per capa.
// Abans eren tres barres verticals l'una al costat de l'altra: a PC (226 px d'ample i 354 d'alt) les xifres
// "100%" es tocaven i les etiquetes quedaven apretades; al mòbil les línies de fons travessaven les xifres.
// Sense blur, filtres ni animacions infinites (mòbils modestos).
import { Layers, CloudOff } from 'lucide-react';
import { WidgetProps } from './widgetTypes';
import { WIDGET_BASE_STYLE, CARD_VEIL, TITLE_STYLE, MATRIX_BG } from './widgetStyles';
import { getTrans } from './widgetHelpers';
import { cloudCoverLevel, effectiveCloudCoverNow, CLOUD_LEVEL_LABEL, CloudCoverLevel } from '../../utils/cloudCoverLevel';
import type { Language } from '../../translations';

type LayerKey = 'high' | 'mid' | 'low';

// De dalt a baix, com al cel. `base`: alçada de la línia que la separa de la capa de sota (Open-Meteo: baixos fins
// a 3 km, mitjans de 3 a 8 km, alts des de 8 km). Colors = LAYER_STROKE del modal.
const LAYERS: { key: LayerKey; color: string; base: string | null }[] = [
  { key: 'high', color: '#7dd3fc', base: '8 km' },
  { key: 'mid', color: '#3b82f6', base: '3 km' },
  { key: 'low', color: '#4f46e5', base: null },
];

// Mateixos colors que el número i l'etiqueta del modal (getCloudSeverity).
const LEVEL_TEXT: Record<CloudCoverLevel | 'unknown', string> = {
  clear: 'text-emerald-400',
  partial: 'text-sky-400',
  veryCloudy: 'text-indigo-400',
  overcast: 'text-slate-300',
  unknown: 'text-slate-500',
};

// Xifra al costat del perfil només quan la targeta fa >= 340 px; més estreta, apilats (si no, "MITJANS" no hi cabia).
// Amplada de la targeta a la graella d'ExpertWidgets segons la pantalla: < 372 px → 288-339 (apilat) · 372-639 →
// 340-607 (costat) · sm → 292-348 (apilat) · md → 348-483 (costat) · lg, 4 columnes → ~226 (apilat).
const BODY_LAYOUT = 'flex-col gap-3 min-[372px]:flex-row min-[372px]:gap-4 sm:flex-col sm:gap-3 md:flex-row md:gap-4 lg:flex-col lg:gap-3';
const HERO_BOX = 'w-auto gap-1 min-[372px]:w-[6.5rem] min-[372px]:gap-1.5 sm:w-auto sm:gap-1 md:w-[6.5rem] md:gap-1.5 lg:w-auto lg:gap-1';
const HERO_VALUE = 'flex-row items-center gap-3 min-[372px]:flex-col min-[372px]:items-start min-[372px]:gap-1.5 sm:flex-row sm:items-center sm:gap-3 md:flex-col md:items-start md:gap-1.5 lg:flex-row lg:items-center lg:gap-3';

const asPercent = (v: unknown): number | null =>
  typeof v === 'number' && !isNaN(v) ? Math.max(0, Math.min(v, 100)) : null;

export const CloudLayersWidget = ({ low, mid, high, lang }: WidgetProps) => {
  // DOCTRINA RISC ZERO: Extracció segura de traduccions sense "any"
  const t = getTrans(lang) as Record<string, unknown>;
  const cl = (t && typeof t.cloudLayers === 'object' && t.cloudLayers !== null ? t.cloudLayers : {}) as Record<string, string>;
  const title = (cl.title || 'Núvols').toUpperCase();
  const labels: Record<LayerKey, string> = { high: cl.high || 'Alts', mid: cl.mid || 'Mitjans', low: cl.low || 'Baixos' };
  const levelLabels = CLOUD_LEVEL_LABEL[lang as Language] ?? CLOUD_LEVEL_LABEL.ca;

  // DOCTRINA RISC ZERO: 0 % (cel net) i null (sense dada) són coses diferents.
  const values: Record<LayerKey, number | null> = { high: asPercent(high), mid: asPercent(mid), low: asPercent(low) };
  const effective = effectiveCloudCoverNow(low, mid, high);
  const level = effective === null ? 'unknown' : cloudCoverLevel(effective);

  return (
    <div className={`${WIDGET_BASE_STYLE} ${CARD_VEIL} bg-gradient-to-br from-indigo-950/20 to-black/80 !justify-start gap-3 select-none`}>
      <div className={MATRIX_BG}></div>

      <div className={`${TITLE_STYLE.replace('mb-4', 'mb-0')} min-w-0`}>
        <Layers className="w-4 h-4 text-sky-400 shrink-0" />
        <span className="truncate">{title}</span>
      </div>

      {/* Targeta ampla (mòbil, tauleta): xifra a l'esquerra i perfil a la dreta. Estreta (PC, mòbil petit): apilats. */}
      <div className={`relative z-10 flex-1 flex min-h-0 ${BODY_LAYOUT}`}>
        {/* Cobertura efectiva ara: el mateix número i nivell que el modal */}
        <div className={`shrink-0 flex flex-col justify-center ${HERO_BOX}`}>
          <span className="text-[9px] font-black uppercase tracking-widest text-slate-500 leading-snug">{cl.effective || 'Cobertura efectiva'}</span>
          <div className={`flex min-w-0 ${HERO_VALUE}`}>
            <span className={`flex items-start leading-none shrink-0 ${LEVEL_TEXT[level]}`}>
              <span className="text-4xl font-black tracking-tighter tabular-nums">{effective === null ? '--' : Math.round(effective)}</span>
              {effective !== null && <span className="text-xs font-bold text-slate-400 mt-0.5 ml-0.5">%</span>}
            </span>
            <span className={`min-w-0 text-[11px] font-black uppercase tracking-wider leading-tight ${LEVEL_TEXT[level]}`}>{levelLabels[level]}</span>
          </div>
        </div>

        {/* Perfil vertical: una franja per capa, amb l'alçada de cada frontera marcada a la línia */}
        <div className="relative flex-1 min-w-0 flex flex-col rounded-2xl border border-white/5 bg-gradient-to-b from-black/50 to-indigo-950/40">
          {LAYERS.map(({ key, color, base }, i) => {
            const value = values[key];
            const isValid = value !== null;
            return (
              <div key={key} className={`relative flex-1 flex flex-col justify-center gap-2 px-3 py-3 ${i > 0 ? 'border-t border-dashed border-white/10' : ''}`}>
                <div className="flex items-center gap-1.5 min-w-0">
                  {isValid
                    ? <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: color }}></span>
                    : <CloudOff className="w-3 h-3 text-slate-500 shrink-0" />}
                  <span className={`text-[10px] font-black uppercase tracking-widest truncate ${isValid ? 'text-slate-200' : 'text-slate-500'}`}>{labels[key]}</span>
                  <span className={`ml-auto pl-1 flex items-start leading-none shrink-0 ${isValid ? 'text-white' : 'text-slate-500'}`}>
                    <span className="text-[15px] font-black tabular-nums">{isValid ? Math.round(value) : '--'}</span>
                    {isValid && <span className="text-[9px] font-bold text-slate-400 ml-0.5">%</span>}
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-white/[0.07] overflow-hidden">
                  {isValid && value > 0 && (
                    <div
                      className="h-full rounded-full transition-[width] duration-700 ease-out"
                      // Mínim visible del 3 % perquè un 1-2 % no desaparegui; el número diu el valor exacte.
                      style={{ width: `${Math.max(3, value)}%`, backgroundImage: `linear-gradient(90deg, ${color}80, ${color})` }}
                    ></div>
                  )}
                </div>
                {base && (
                  <span className="absolute right-2.5 bottom-0 translate-y-1/2 z-10 px-1.5 rounded-full border border-white/10 bg-[#0c0f1c] text-[8px] leading-[14px] font-bold tabular-nums text-slate-400">
                    {base}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
