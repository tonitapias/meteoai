import { useId, useState, type ReactNode } from 'react';
import { ChevronDown, ChevronUp, CloudRain, Zap } from 'lucide-react';
import { useTranslation } from 'react-i18next';

// Llegenda del radar en un sol botó plegable (a baix a l'esquerra): la
// precipitació (pluja o neu) i els llamps a la mateixa escala de "menys" a
// "més". Plegada ocupa menys que l'antiga llegenda fixa dels llamps. Comença
// sempre plegada, també a l'ordinador (decisió de l'usuari, 11-11): no es
// desa si es deixa oberta.

// Precipitació: escala 6 de RainViewer/LibreWXR (NEXRAD Level III), un color
// cada 5 dBZ de 5 a 65 (taula oficial rainviewer_api_colors_table.csv). Les
// tessel·les van sense l'opció de neu (RADAR_TILE_OPTIONS): la neu surt amb
// els mateixos colors segons la intensitat, i per això la fila diu "Pluja o
// neu". Amb la neu activada, la neu moderada tenia el blau de la pluja feble.
const RAIN_LEGEND_COLORS = [
  '#00efe7', '#009cf7', '#0000f7', '#00ff00', '#03b703', '#087305', '#ffff00',
  '#ecce00', '#fe9300', '#ff0000', '#bd0000', '#d70065', '#fe00fe'
];
// RainViewer (si LibreWXR no respon o és encallat, vegeu useRadarSources) no
// fa cas de l'esquema i pinta sempre la seva paleta "Universal Blue": els
// mateixos passos de 5 a 65 dBZ de la seva taula (comprovats sobre tessel·les
// reals el 2026-11-12: la plugim beix de 10 dBZ i els blaus de 15 i 24 dBZ).
const RAINVIEWER_LEGEND_COLORS = [
  '#928871', '#cec087', '#88ddee', '#00a3e0', '#0077aa', '#005588', '#ffee00',
  '#ffaa00', '#ff4400', '#c10000', '#ffaaff', '#ff77ff', '#ffffff'
];
// Llamps: els mateixos colors recolorats de la capa (LIGHTNING_PAINT i
// AMERICAS_LIGHTNING_PAINT a useRadarAnimation). Sense xifres: MTG compta
// llamps per píxel en 5 min i nowCOAST, la densitat en 15 min.
const LIGHTNING_GRADIENT = 'linear-gradient(90deg, rgba(255,235,90,0.45), rgba(255,200,60,0.7), rgba(253,120,40,0.95) 53%, rgb(140,0,38))';

const FOCUS = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/80';

function Steps({ colors, className }: { colors: string[]; className: string }) {
  return (
    <span aria-hidden="true" className={`flex h-1.5 rounded-sm overflow-hidden ${className}`}>
      {colors.map((c, i) => (
        <span key={i} className="flex-1" style={{ background: c }} />
      ))}
    </span>
  );
}

function Row({ icon, label, children }: { icon: ReactNode; label: string; children: ReactNode }) {
  return (
    <>
      <span className="flex items-center gap-1 whitespace-nowrap">{icon}{label}</span>
      {children}
    </>
  );
}

interface RadarLegendProps {
  showPrecip: boolean;
  showLightning: boolean;
  /** Paleta de la font de radar que dibuixa el mapa. */
  palette?: 'nexrad' | 'rainviewer';
}

export function RadarLegend({ showPrecip, showLightning, palette = 'nexrad' }: RadarLegendProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const cardId = useId();

  if (!showPrecip && !showLightning) return null;
  const rainColors = palette === 'rainviewer' ? RAINVIEWER_LEGEND_COLORS : RAIN_LEGEND_COLORS;

  const toggle = () => setOpen((o) => !o);

  if (!open) {
    return (
      <button
        type="button"
        onClick={toggle}
        aria-expanded={false}
        className={`pointer-events-auto flex items-center gap-1.5 min-h-[28px] px-2 py-1 rounded-lg bg-black/55 border border-white/15 text-[10px] font-mono leading-none text-slate-300 hover:text-white hover:border-white/30 transition-colors ${FOCUS}`}
      >
        {showPrecip
          ? <Steps colors={rainColors.slice(1, 10)} className="w-8" />
          : <span aria-hidden="true" className="w-8 h-1.5 rounded-sm" style={{ background: LIGHTNING_GRADIENT }} />}
        {t('legendTitle', 'Llegenda')}
        <ChevronUp className="w-3 h-3" aria-hidden="true" />
      </button>
    );
  }

  return (
    <div
      id={cardId}
      data-testid="radar-legend"
      className="pointer-events-auto rounded-lg bg-black/60 border border-white/15 px-2 pt-1 pb-1.5 text-[10px] font-mono leading-none text-slate-300 animate-in fade-in duration-150"
    >
      <button
        type="button"
        onClick={toggle}
        aria-expanded={true}
        aria-controls={cardId}
        className={`w-full min-h-[24px] flex items-center justify-between gap-3 text-slate-200 hover:text-white rounded ${FOCUS}`}
      >
        {t('legendTitle', 'Llegenda')}
        <ChevronDown className="w-3 h-3" aria-hidden="true" />
      </button>
      <div className="grid grid-cols-[auto_auto] items-center gap-x-2 gap-y-1.5">
        {showPrecip && (
          <Row icon={<CloudRain className="w-3 h-3 text-cyan-300 shrink-0" aria-hidden="true" />} label={t('legendRain', 'Pluja o neu')}>
            <Steps colors={rainColors} className="w-[130px]" />
          </Row>
        )}
        {showLightning && (
          <Row icon={<Zap className="w-3 h-3 text-amber-300 shrink-0" aria-hidden="true" />} label={t('lightningLegend', 'Llamps')}>
            <span aria-hidden="true" className="w-[130px] h-1.5 rounded-sm" style={{ background: LIGHTNING_GRADIENT }} />
          </Row>
        )}
        <span />
        <span className="flex justify-between w-[130px] text-slate-400">
          <span>{t('legendLess', 'menys')}</span>
          <span>{t('legendMore', 'més')}</span>
        </span>
      </div>
    </div>
  );
}
