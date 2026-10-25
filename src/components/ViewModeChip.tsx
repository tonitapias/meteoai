// src/components/ViewModeChip.tsx
// Selector de vista de la capçalera: un xip petit ("Vista · Essencial") que obre un menú amb les dues
// vistes i una frase que explica cada una. Patró de desplegable (botó + grup de botons), sense animacions
// contínues ni blur, pensat per a mòbils modestos.
// Perquè es distingeixi del cercador porta color d'accent i una icona que diu quanta informació es veu
// (un quadre a Essencial, una graella a Completa), i un punt de novetat fins que s'obre el menú per primer cop.
import { useEffect, useId, useRef, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import type { ViewMode } from '../hooks/usePreferences';
import type { TranslationType } from '../translations';
import { readStorage, writeStorage } from '../utils/safeStorage';
import { VIEW_MODE_STYLE as MODE_STYLE } from './viewModeStyle';

const MENU_SEEN_KEY = 'meteoai_view_menu_seen';

interface ViewModeChipProps {
  viewMode: ViewMode;
  onSelect: (mode: ViewMode) => void;
  strings: TranslationType['viewModes'];
  className?: string;
}

export default function ViewModeChip({ viewMode, onSelect, strings, className = '' }: ViewModeChipProps) {
  const [open, setOpen] = useState(false);
  // Es desa en obrir el menú (no amb un efecte en muntar), com l'"Ara no" de la targeta del tauler.
  const [menuSeen, setMenuSeen] = useState(() => readStorage(MENU_SEEN_KEY) === '1');
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();

  // Es tanca tocant fora o amb Esc (i llavors el focus torna al xip).
  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  const options: { mode: ViewMode; name: string; hint: string }[] = [
    { mode: 'basic', name: strings.essential, hint: strings.essentialHint },
    { mode: 'expert', name: strings.complete, hint: strings.completeHint },
  ];
  const currentName = viewMode === 'expert' ? strings.complete : strings.essential;
  const style = MODE_STYLE[viewMode];
  const CurrentIcon = style.Icon;

  const toggle = () => {
    setOpen((o) => !o);
    if (!menuSeen) {
      setMenuSeen(true);
      writeStorage(MENU_SEEN_KEY, '1');
    }
  };

  const choose = (mode: ViewMode) => {
    setOpen(false);
    buttonRef.current?.focus();
    if (mode !== viewMode) onSelect(mode);
  };

  return (
    <div
      ref={rootRef}
      className={`relative ${className}`}
      // Amb el teclat, sortir del menú amb Tab també el tanca.
      onBlur={(e) => {
        if (open && !e.currentTarget.contains(e.relatedTarget as Node | null)) setOpen(false);
      }}
    >
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={toggle}
        className={`flex h-full min-h-[44px] items-center gap-1.5 rounded-xl border px-3 text-xs sm:text-sm transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/60 ${open ? style.chipOpen : style.chip}`}
      >
        <CurrentIcon aria-hidden="true" className={`w-4 h-4 shrink-0 ${style.soft}`} />
        {/* Al costat de la marca, mesurat en els 4 idiomes: "Vista" hi cap a partir de 375 px (abans, només per
            als lectors de pantalla) i la fletxa a partir de 360 px; per sota, el xip baixava a una segona línia. */}
        <span className={`sr-only min-[375px]:not-sr-only ${style.soft}`}>{strings.label}</span>
        <span className="sr-only">: </span>
        <span className={`font-semibold ${style.strong}`}>{currentName}</span>
        <ChevronDown aria-hidden="true" className={`hidden min-[360px]:block w-4 h-4 shrink-0 transition-transform ${style.soft} ${open ? 'rotate-180' : ''}`} />
      </button>

      {/* Punt de novetat: fix, sense animació, fins que s'obre el menú per primer cop. */}
      {!menuSeen && (
        <span
          aria-hidden="true"
          data-testid="view-menu-new-dot"
          className={`pointer-events-none absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full ring-2 ring-[#0b0e17] ${style.dot}`}
        />
      )}

      {open && (
        <div
          id={panelId}
          role="group"
          aria-label={strings.menuTitle}
          className="absolute right-0 top-full z-30 mt-2 w-[min(18rem,calc(100vw-2rem))] rounded-2xl border border-white/10 bg-[#0b1020] p-2 shadow-[0_15px_40px_rgba(0,0,0,0.8)]"
        >
          <p className="px-2 pt-1 pb-2 text-[11px] text-slate-400">{strings.menuTitle}</p>
          {options.map((option) => {
            const selected = option.mode === viewMode;
            const { Icon: OptionIcon, soft } = MODE_STYLE[option.mode];
            return (
              <button
                key={option.mode}
                type="button"
                aria-pressed={selected}
                onClick={() => choose(option.mode)}
                className={`flex w-full gap-2.5 rounded-xl px-2.5 py-2.5 text-left transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/60 ${selected ? 'bg-sky-500/10' : 'hover:bg-white/5'}`}
              >
                <Check aria-hidden="true" className={`mt-0.5 w-4 h-4 shrink-0 ${selected ? 'text-sky-400' : 'invisible'}`} />
                <span>
                  <span className="flex items-center gap-1.5 text-sm font-semibold text-slate-100">
                    <OptionIcon aria-hidden="true" className={`w-3.5 h-3.5 shrink-0 ${soft}`} />
                    {option.name}
                  </span>
                  <span className="mt-0.5 block text-xs leading-snug text-slate-400">{option.hint}</span>
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
