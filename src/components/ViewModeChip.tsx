// src/components/ViewModeChip.tsx
// Selector de vista de la capçalera: un xip petit ("Vista · Essencial") que obre un menú amb les dues
// vistes i una frase que explica cada una. Patró de desplegable (botó + grup de botons), sense animacions
// contínues ni blur, pensat per a mòbils modestos.
import { useEffect, useId, useRef, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import type { ViewMode } from '../hooks/usePreferences';
import type { TranslationType } from '../translations';

interface ViewModeChipProps {
  viewMode: ViewMode;
  onSelect: (mode: ViewMode) => void;
  strings: TranslationType['viewModes'];
  className?: string;
}

export default function ViewModeChip({ viewMode, onSelect, strings, className = '' }: ViewModeChipProps) {
  const [open, setOpen] = useState(false);
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
        onClick={() => setOpen((o) => !o)}
        className={`flex h-full min-h-[44px] items-center gap-1.5 rounded-xl border px-3 text-xs sm:text-sm transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/60 ${open ? 'border-sky-400/50 bg-black/60' : 'border-white/10 bg-black/40 hover:border-white/20 hover:bg-black/50'}`}
      >
        {/* Sota 360 px no hi cap al costat de la marca: només es deixa per als lectors de pantalla. */}
        <span className="sr-only min-[360px]:not-sr-only text-slate-400">{strings.label}</span>
        <span className="sr-only">: </span>
        <span className="font-semibold text-slate-100">{currentName}</span>
        <ChevronDown aria-hidden="true" className={`w-4 h-4 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

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
                  <span className="block text-sm font-semibold text-slate-100">{option.name}</span>
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
