import { useId, useState, type ReactNode } from 'react';
import { ChevronDown, ChevronUp, CloudRain, Snowflake, Zap } from 'lucide-react';
import { useTranslation } from 'react-i18next';

// Llegenda del radar en un sol botó plegable (a baix a l'esquerra): la
// precipitació (pluja o neu) i els llamps a la mateixa escala de "menys" a
// "més", i, amb l'Aire fred (Airmass) actiu, què vol dir cada color. Plegada ocupa menys que l'antiga llegenda fixa dels llamps. Comença
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

// Airmass RGB (recepta d'EUMETSAT): no és una escala de menys a més sinó tres
// famílies de color. Mostres preses de les imatges reals (2026-11-15): aire
// fred polar blau/morat, aire sec que baixa de l'estratosfera (jet, DANA)
// vermell/taronja i aire càlid tropical verd. Els núvols alts hi surten blancs.
const AIRMASS_LEGEND: { key: 'cold' | 'dry' | 'warm'; gradient: string }[] = [
  { key: 'cold', gradient: 'linear-gradient(90deg, #2f3f9f, #7b3fa3)' },
  { key: 'dry', gradient: 'linear-gradient(90deg, #a5322b, #c9772e)' },
  { key: 'warm', gradient: 'linear-gradient(90deg, #2f7d32, #6f8f2a)' }
];
const AIRMASS_GRADIENT = 'linear-gradient(90deg, #2f3f9f, #7b3fa3 33%, #a5322b 34%, #c9772e 66%, #2f7d32 67%, #6f8f2a)';

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
  /** Aire fred en alçada (Airmass) actiu. */
  showAirmass?: boolean;
  /** Hora de la imatge d'Airmass que es veu (el mosaic global surt cada 3 h). */
  airmassTime?: string | null;
}

export function RadarLegend({ showPrecip, showLightning, palette = 'nexrad', showAirmass = false, airmassTime = null }: RadarLegendProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const cardId = useId();

  if (!showPrecip && !showLightning && !showAirmass) return null;
  const showScale = showPrecip || showLightning;
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
          : <span aria-hidden="true" className="w-8 h-1.5 rounded-sm" style={{ background: showLightning ? LIGHTNING_GRADIENT : AIRMASS_GRADIENT }} />}
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
      {showScale && (
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
      )}
      {showAirmass && (
        <div data-testid="airmass-legend" className={showScale ? 'mt-2 pt-1.5 border-t border-white/10' : ''}>
          <span className="flex items-center gap-1 whitespace-nowrap text-slate-200">
            <Snowflake className="w-3 h-3 text-violet-300 shrink-0" aria-hidden="true" />
            {t('legendAirmass', "Masses d'aire")}
            {airmassTime && <span className="text-slate-400">· {t('legendAirmassTime', { time: airmassTime, defaultValue: 'imatge de les {{time}}' })}</span>}
          </span>
          <ul className="mt-1.5 space-y-1">
            {AIRMASS_LEGEND.map(({ key, gradient }) => (
              <li key={key} className="flex items-center gap-1.5 whitespace-nowrap">
                <span aria-hidden="true" className="w-6 h-1.5 rounded-sm shrink-0" style={{ background: gradient }} />
                {key === 'cold' ? t('legendAirmassCold', 'Aire fred')
                  : key === 'dry' ? t('legendAirmassDry', 'Aire sec (jet, DANA)')
                    : t('legendAirmassWarm', 'Aire càlid')}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
