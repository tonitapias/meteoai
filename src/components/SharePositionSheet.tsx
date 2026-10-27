// src/components/SharePositionSheet.tsx
// "Què vols compartir?": amb la posició del GPS a pantalla, el botó Compartir pregunta abans si s'envia on és l'usuari
// exactament (coordenades i Google Maps) o només el temps d'aquí (~1 km); és l'únic cas en què l'enllaç diria on és.
// Mateix llenguatge que "Com funciona": full opac, sense desenfocaments, filtres ni animacions en bucle (mòbils modestos).
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { X, MapPinned, CloudSun, Copy } from 'lucide-react';
import { useDialogFocus } from '../hooks/useDialogFocus';
import type { TranslationType } from '../translations';
import type { ShareResult } from '../utils/shareLink';

interface SharePositionSheetProps {
  /** "41.98315, 2.82493" */
  coords: string;
  placeName?: string;
  texts: TranslationType['share'];
  closeLabel: string;
  onSharePosition: () => Promise<ShareResult | null>;
  onShareWeatherOnly: () => Promise<ShareResult | null>;
  onCopyCoords: () => Promise<boolean>;
  onClose: () => void;
}

interface OptionProps {
  icon: ReactNode;
  title: string;
  hint: string;
  primary?: boolean;
  disabled: boolean;
  onClick: () => void;
}

const Option = ({ icon, title, hint, primary = false, disabled, onClick }: OptionProps) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    className={`w-full min-h-[56px] flex items-center gap-3 rounded-2xl border px-4 py-3 text-left transition-colors active:scale-[0.99] disabled:opacity-60 ${primary
      ? 'border-cyan-400/40 bg-cyan-500/15 hover:bg-cyan-500/25'
      : 'border-slate-200/10 bg-white/[0.04] hover:bg-white/[0.08]'}`}
  >
    <span aria-hidden="true" className={`shrink-0 ${primary ? 'text-cyan-300' : 'text-slate-300'}`}>{icon}</span>
    <span className="min-w-0 flex flex-col">
      <span className={`text-[15px] font-semibold leading-snug ${primary ? 'text-cyan-50' : 'text-slate-100'}`}>{title}</span>
      <span className="text-[13px] leading-snug text-slate-400">{hint}</span>
    </span>
  </button>
);

export default function SharePositionSheet({
  coords, placeName, texts, closeLabel, onSharePosition, onShareWeatherOnly, onCopyCoords, onClose
}: SharePositionSheetProps) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  useDialogFocus(true, dialogRef);
  // Mentre el full del sistema és obert, un segon toc no n'obriria un altre (el navegador el rebutjaria).
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Compartit o copiat: la finestra ja ha fet la feina. Si l'usuari ha tancat el full del sistema, o no s'ha pogut,
  // es queda oberta per triar una altra opció.
  const run = (action: () => Promise<ShareResult | boolean | null>) => async () => {
    if (busy) return;
    setBusy(true);
    try {
      const result = await action();
      if (result === true || result === 'shared' || result === 'copied') onClose();
    } finally {
      setBusy(false);
    }
  };

  const weatherOnly = placeName
    ? texts.shareWeatherOnly.replace('{place}', () => placeName)
    : texts.shareWeatherOnlyHere;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-black/70 text-slate-100 antialiased"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      {/* Alçada en % de l'overlay (fixed inset-0) i no en dvh, com els altres fulls (motors sense dvh). */}
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="w-full max-w-md max-h-[92%] sm:max-h-full flex flex-col min-h-0 rounded-t-3xl sm:rounded-3xl border-t sm:border border-slate-200/15 bg-[#111623] shadow-[0_24px_64px_-24px_rgba(0,0,0,0.9)] outline-none"
      >
        <header className="shrink-0 flex items-center justify-between gap-4 px-5 pt-4 pb-2">
          <h2 id={titleId} className="text-lg font-semibold tracking-[-0.01em]">{texts.sheetTitle}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={closeLabel}
            className="-mr-2 h-11 w-11 shrink-0 rounded-xl flex items-center justify-center text-slate-300 hover:text-white hover:bg-white/5 transition-colors"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pt-1 pb-[max(1.25rem,env(safe-area-inset-bottom))] flex flex-col gap-2.5">
          {/* La posició que s'enviaria: a la vista abans de triar */}
          <div className="rounded-2xl border border-slate-200/10 bg-white/[0.04] px-4 py-3">
            <p className="text-xs text-slate-400">{texts.yourPosition}{placeName ? ` · ${placeName}` : ''}</p>
            <p className="mt-0.5 font-mono text-base font-bold tabular-nums text-cyan-100 select-all">{coords}</p>
          </div>

          <Option
            primary
            icon={<MapPinned className="w-5 h-5" />}
            title={texts.sharePosition}
            hint={texts.sharePositionHint}
            disabled={busy}
            onClick={run(onSharePosition)}
          />
          <Option
            icon={<CloudSun className="w-5 h-5" />}
            title={weatherOnly}
            hint={texts.shareWeatherOnlyHint}
            disabled={busy}
            onClick={run(onShareWeatherOnly)}
          />
          <Option
            icon={<Copy className="w-5 h-5" />}
            title={texts.copyCoords}
            hint={texts.copyCoordsHint}
            disabled={busy}
            onClick={run(onCopyCoords)}
          />
        </div>
      </div>
    </div>
  );
}
