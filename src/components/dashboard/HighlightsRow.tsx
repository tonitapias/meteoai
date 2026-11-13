// src/components/dashboard/HighlightsRow.tsx
// Els destacats d'Ara (interfície per pestanyes): els mateixos valors que la targeta «Vols més detall?» de la vista
// essencial (utils/detailTeaser.ts: pressió, aire, lluna, visibilitat i, els dies que n'hi ha, el fenomen del planeta),
// amb el mateix aspecte de xip. Cada xip porta a la pestanya on hi ha el giny; el del planeta, com sempre, n'obre la fitxa.
// Sense blur, filtres ni animacions contínues (mòbils modestos).
import { ChevronRight, Eye, Flame, Gauge, Leaf, Moon, Mountain, Thermometer, Waves, Wind } from 'lucide-react';
import type { TranslationType } from '../../translations';
import type { DetailTeaserItem, DetailTeaserKey } from '../../utils/detailTeaser';
import type { PlanetEntry, PlanetHeadlineIcon } from '../../utils/planetNav';
import { CycloneIcon } from '../planet/CycloneIcon';
import type { DashboardTab } from '../tabs/dashboardTabs';

const ITEM_ICONS: Record<DetailTeaserKey, typeof Gauge | typeof CycloneIcon> = {
  planet: CycloneIcon,
  pressure: Gauge,
  air: Leaf,
  moon: Moon,
  visibility: Eye,
};

const PLANET_ICONS: Record<PlanetHeadlineIcon, typeof Gauge | typeof CycloneIcon> = {
  cyclone: CycloneIcon,
  heat: Thermometer,
  flood: Waves,
  fire: Flame,
  volcano: Mountain,
  wind: Wind,
  pressure: Gauge,
};

/** On és el giny de cada xip. */
const ITEM_TAB: Record<DetailTeaserKey, DashboardTab> = {
  pressure: 'detail',
  air: 'detail',
  visibility: 'detail',
  moon: 'sky',
  planet: 'sky',
};

interface HighlightsRowProps {
  items: DetailTeaserItem[];
  strings: TranslationType['tabs'];
  onGoTo: (tab: DashboardTab) => void;
  onOpenPlanet: (entry: PlanetEntry) => void;
}

export function HighlightsRow({ items, strings, onGoTo, onOpenPlanet }: HighlightsRowProps) {
  if (items.length === 0) return null;

  return (
    <nav aria-label={strings.highlights}>
      <ul className="flex flex-wrap gap-2">
        {items.map((item) => {
          const planet = item.key === 'planet';
          const Icon = planet && item.icon ? PLANET_ICONS[item.icon] : ITEM_ICONS[item.key];
          const tab = ITEM_TAB[item.key];
          const entry = planet ? item.entry : undefined;
          // El fenomen del planeta, sobri: només la vora i la icona en to d'avís (com a «Vols més detall?»).
          const tone = planet
            ? { border: 'border-rose-400/35 hover:border-rose-300/60 focus-visible:ring-rose-300/60', icon: 'text-rose-300' }
            : { border: 'border-white/10 hover:border-white/25 focus-visible:ring-sky-400/60', icon: 'text-slate-400' };
          return (
            <li key={item.key} className="inline-flex">
              <button
                type="button"
                onClick={() => (entry ? onOpenPlanet(entry) : onGoTo(tab))}
                aria-label={entry ? undefined : `${item.text} · ${strings[tab]}`}
                className={`inline-flex min-h-[36px] items-center gap-1.5 rounded-full border bg-black/30 px-3 py-1 text-left text-xs text-slate-200 cursor-pointer transition-colors focus:outline-none focus-visible:ring-2 ${tone.border}`}
              >
                <Icon aria-hidden="true" className={`w-3.5 h-3.5 shrink-0 ${tone.icon}`} />
                {item.text}
                <ChevronRight aria-hidden="true" className={`w-3.5 h-3.5 shrink-0 ${tone.icon}`} />
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
