// src/components/tabs/TabBar.tsx
// La barra de pestanyes del tauler.
// - 'bottom' (mòbil i tauleta): fixa a baix, on arriba el polze. Es pinta a <body> (portal): així cap context
//   d'apilament del tauler (el peu és z-20) no la tapa, i els modals (z-50/z-100) sí que la cobreixen.
// - 'top' (escriptori, a partir de 1024 px): sota la capçalera i enganxada a dalt en fer scroll; a baix, en una
//   pantalla ampla, quedaria lluny i estranya.
// Patró de pestanyes d'ARIA: fletxes, Inici i Fi mouen el focus i activen la pestanya. El Radar no és una pestanya
// (no té panell: obre el modal de sempre), per això va fora del tablist, al final, amb l'estil del botó RADAR de la
// targeta principal.
import { useRef, type KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { CalendarDays, CloudSun, LayoutGrid, Map, SunMoon, type LucideIcon } from 'lucide-react';
import type { TranslationType } from '../../translations';
import { DASHBOARD_TABS, panelElementId, tabElementId, type DashboardTab } from './dashboardTabs';

const TAB_ICONS: Record<DashboardTab, LucideIcon> = {
  now: CloudSun,
  forecast: CalendarDays,
  detail: LayoutGrid,
  sky: SunMoon,
};

// La mateixa matriu del botó RADAR de la targeta principal (WeatherActionButtons).
const MATRIX_BG = 'absolute inset-0 z-0 opacity-[0.05] pointer-events-none bg-[linear-gradient(to_right,#ffffff_1px,transparent_1px),linear-gradient(to_bottom,#ffffff_1px,transparent_1px)] bg-[size:8px_8px]';

interface TabBarProps {
  active: DashboardTab;
  /** Pestanyes que ja tenen el panell muntat: només aquestes porten aria-controls (cap id penjat). */
  mounted: ReadonlySet<DashboardTab>;
  onSelect: (tab: DashboardTab) => void;
  onRadar: () => void;
  strings: TranslationType['tabs'];
  /** On va la barra: fixa a baix (mòbil i tauleta, per defecte) o enganxada a dalt (escriptori). */
  placement?: 'bottom' | 'top';
  /** Amb un modal obert: ni clics ni teclat (el modal la tapa; amb el Tab s'hi podria arribar igualment). */
  inert?: boolean;
  /** S'amaga del tot (mentre s'escriu al cercador, que el teclat del mòbil la faria pujar damunt dels resultats). */
  concealed?: boolean;
}

// Les classes de cada lloc: a baix, icona damunt del nom (cinc espais a 320 px); a dalt, icona i nom en línia.
const PLACEMENT = {
  bottom: {
    bar: 'fixed inset-x-0 bottom-0 z-40 font-sans border-t border-white/10 bg-[#05060A]/95 shadow-[0_-8px_24px_rgba(0,0,0,0.5)] pb-[env(safe-area-inset-bottom)]',
    row: 'max-w-5xl mx-auto flex items-stretch gap-1 px-2',
    list: 'flex flex-1 min-w-0',
    tab: 'relative flex-1 min-w-0 min-h-[56px] flex flex-col items-center justify-center gap-1 px-1 rounded-xl text-[11px] font-semibold leading-none transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-sky-400/60',
    tabOn: 'text-sky-200',
    tabOff: 'text-slate-400 hover:text-slate-200',
    mark: 'absolute top-0 inset-x-4 h-0.5 rounded-full',
    divider: 'w-px my-3 bg-white/10',
    radar: 'relative overflow-hidden shrink-0 my-1.5 px-3 min-w-[64px] flex flex-col items-center justify-center gap-1 rounded-xl border border-indigo-500/30 bg-indigo-500/10 text-indigo-200 text-[11px] font-semibold leading-none transition-colors hover:bg-indigo-500/20 hover:text-indigo-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/60',
  },
  top: {
    bar: 'sticky top-0 z-30 -mx-4 md:-mx-6 mb-6 px-4 md:px-6 font-sans border-b border-white/10 bg-[#05060A]/95 shadow-[0_8px_24px_rgba(0,0,0,0.45)]',
    row: 'flex items-center gap-2 py-2',
    list: 'flex items-center gap-1',
    tab: 'relative min-h-[44px] flex items-center gap-2 px-4 rounded-xl text-sm font-semibold leading-none transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-sky-400/60',
    tabOn: 'text-sky-200 bg-sky-500/10',
    tabOff: 'text-slate-400 hover:text-slate-200 hover:bg-white/5',
    mark: 'absolute bottom-0 inset-x-3 h-0.5 rounded-full',
    divider: 'flex-1',
    radar: 'relative overflow-hidden shrink-0 min-h-[44px] px-4 flex items-center gap-2 rounded-xl border border-indigo-500/30 bg-indigo-500/10 text-indigo-200 text-sm font-semibold leading-none transition-colors hover:bg-indigo-500/20 hover:text-indigo-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/60',
  },
} as const;

export default function TabBar({ active, mounted, onSelect, onRadar, strings, placement = 'bottom', inert = false, concealed = false }: TabBarProps) {
  const css = PLACEMENT[placement];
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const last = DASHBOARD_TABS.length - 1;
    let next: number;
    switch (event.key) {
      case 'ArrowRight': next = index === last ? 0 : index + 1; break;
      case 'ArrowLeft': next = index === 0 ? last : index - 1; break;
      case 'Home': next = 0; break;
      case 'End': next = last; break;
      default: return;
    }
    event.preventDefault();
    onSelect(DASHBOARD_TABS[next]);
    tabRefs.current[next]?.focus();
  };

  if (typeof document === 'undefined') return null;

  const bar = (
    <div className={concealed ? `${css.bar} hidden` : css.bar} inert={inert}>
      <div className={css.row}>
        <div role="tablist" aria-label={strings.label} className={css.list}>
          {DASHBOARD_TABS.map((tab, index) => {
            const selected = tab === active;
            const Icon = TAB_ICONS[tab];
            return (
              <button
                key={tab}
                ref={(el) => { tabRefs.current[index] = el; }}
                type="button"
                role="tab"
                id={tabElementId(tab)}
                aria-selected={selected}
                aria-controls={mounted.has(tab) ? panelElementId(tab) : undefined}
                tabIndex={selected ? 0 : -1}
                onClick={() => onSelect(tab)}
                onKeyDown={(event) => handleKeyDown(event, index)}
                className={`${css.tab} ${selected ? css.tabOn : css.tabOff}`}
              >
                <span aria-hidden="true" className={`${css.mark} ${selected ? 'bg-sky-400' : 'bg-transparent'}`} />
                <Icon aria-hidden="true" className="w-5 h-5 shrink-0" />
                <span className="max-w-full truncate">{strings[tab]}</span>
              </button>
            );
          })}
        </div>

        <span aria-hidden="true" className={css.divider} />

        <button
          type="button"
          onClick={onRadar}
          aria-label={strings.radarAria}
          className={css.radar}
        >
          <span aria-hidden="true" className={MATRIX_BG} />
          <Map aria-hidden="true" className="relative w-5 h-5" />
          <span className="relative">{strings.radar}</span>
        </button>
      </div>
    </div>
  );

  return placement === 'bottom' ? createPortal(bar, document.body) : bar;
}
