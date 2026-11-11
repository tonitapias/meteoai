import { useId, useState, type ReactNode } from 'react';
import { ChevronDown, ChevronUp, CloudRain, Snowflake, Zap } from 'lucide-react';
import { useTranslation } from 'react-i18next';

// Llegenda del radar en un sol botó plegable (a baix a l'esquerra): pluja,
// neu i llamps a la mateixa escala de "menys" a "més". Plegada ocupa menys que
// l'antiga llegenda fixa dels llamps. Comença sempre plegada, també a
// l'ordinador (decisió de l'usuari, 11-11): no es desa si es deixa oberta.

// Pluja: escala 6 de RainViewer/LibreWXR (NEXRAD Level III), un color cada
// 5 dBZ de 5 a 65 (taula oficial rainviewer_api_colors_table.csv).
const RAIN_LEGEND_COLORS = [
  '#00efe7', '#009cf7', '#0000f7', '#00ff00', '#03b703', '#087305', '#ffff00',
  '#ecce00', '#fe9300', '#ff0000', '#bd0000', '#d70065', '#fe00fe'
];
// Neu (opció snow=1 de les tessel·les): blaus propis, mesurats l'11-11 sobre
// tessel·les reals amb la neu activada i desactivada (la taula oficial diu,
// malament, que són els de la pluja). Alineats amb la pluja per dBZ: de 10 a
// 40; més amunt la neu pràcticament no hi arriba.
const SNOW_LEGEND_COLORS: (string | null)[] = [
  null, '#a3f3ff', '#51cffd', '#0d99fc', '#0f75fb', '#1053fb', '#103ffb', '#0b32cf',
  null, null, null, null, null
];
// Llamps: els mateixos colors recolorats de la capa (LIGHTNING_PAINT i
// AMERICAS_LIGHTNING_PAINT a useRadarAnimation). Sense xifres: MTG compta
// llamps per píxel en 5 min i nowCOAST, la densitat en 15 min.
const LIGHTNING_GRADIENT = 'linear-gradient(90deg, rgba(255,235,90,0.45), rgba(255,200,60,0.7), rgba(253,120,40,0.95) 53%, rgb(140,0,38))';

const FOCUS = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/80';

function Steps({ colors, className }: { colors: (string | null)[]; className: string }) {
  return (
    <span aria-hidden="true" className={`flex h-1.5 rounded-sm overflow-hidden ${className}`}>
      {colors.map((c, i) => (
        <span key={i} className="flex-1" style={{ background: c ?? 'transparent' }} />
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
}

export function RadarLegend({ showPrecip, showLightning }: RadarLegendProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const cardId = useId();

  if (!showPrecip && !showLightning) return null;

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
          ? <Steps colors={RAIN_LEGEND_COLORS.slice(1, 10)} className="w-8" />
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
          <>
            <Row icon={<CloudRain className="w-3 h-3 text-cyan-300 shrink-0" aria-hidden="true" />} label={t('legendRain', 'Pluja')}>
              <Steps colors={RAIN_LEGEND_COLORS} className="w-[130px]" />
            </Row>
            <Row icon={<Snowflake className="w-3 h-3 text-sky-200 shrink-0" aria-hidden="true" />} label={t('legendSnow', 'Neu')}>
              <Steps colors={SNOW_LEGEND_COLORS} className="w-[130px]" />
            </Row>
          </>
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
