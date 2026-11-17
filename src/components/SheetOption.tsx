// src/components/SheetOption.tsx
// Una opció dels fulls opacs («Què vols compartir?», «Configuració»): icona, títol i una línia d'explicació.
import type { ReactNode } from 'react';

interface SheetOptionProps {
  icon: ReactNode;
  title: string;
  hint: string;
  primary?: boolean;
  disabled?: boolean;
  onClick: () => void;
}

export default function SheetOption({ icon, title, hint, primary = false, disabled = false, onClick }: SheetOptionProps) {
  return (
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
}
