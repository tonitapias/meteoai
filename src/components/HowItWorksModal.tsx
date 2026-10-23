// src/components/HowItWorksModal.tsx
// "Com funciona", obert des de la benvinguda: d'on surt la previsió (models globals, model d'alta resolució,
// observació i avisos oficials, resum amb IA). Mateix llenguatge que la benvinguda: superfície opaca, un sol
// accent i sense desenfocaments, filtres ni animacions en bucle (mòbils modestos). Les xifres del text (5 fonts,
// 14 models, 1-5 km, 7 fonts oficials) s'han de revisar si canvien API_MODELS_LIST, REGIONAL_MODELS o alertsApi.
import { useEffect, useId, useRef, type ReactNode } from 'react';
import { X, Globe, Mountain, Radar, Sparkles } from 'lucide-react';
import type { TranslationType } from '../translations';
import { useDialogFocus } from '../hooks/useDialogFocus';

interface HowItWorksModalProps {
  onClose: () => void;
  t: TranslationType;
}

interface Step {
  icon: ReactNode;
  title: string;
  badge: string;
  text: string;
  extra?: ReactNode;
}

export default function HowItWorksModal({ onClose, t }: HowItWorksModalProps) {
  const h = t.howItWorks;
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  useDialogFocus(true, dialogRef);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const iconClass = 'w-4 h-4 shrink-0 text-sky-300';
  const globalModels = [h.modelEcmwf, h.modelAifs, h.modelGfs, h.modelIcon, h.modelBestMatch];

  const steps: Step[] = [
    {
      icon: <Globe className={iconClass} aria-hidden="true" />,
      title: h.step1Title,
      badge: h.step1Badge,
      text: h.step1Text,
      extra: (
        <ul className="flex flex-wrap gap-1.5">
          {globalModels.map(m => (
            <li key={m} className="rounded-md bg-white/[0.06] px-2 py-1 text-xs text-slate-200">{m}</li>
          ))}
        </ul>
      ),
    },
    {
      icon: <Mountain className={iconClass} aria-hidden="true" />,
      title: h.step2Title,
      badge: h.step2Badge,
      text: h.step2Text,
      extra: (
        <div className="rounded-xl border border-slate-200/10 bg-white/[0.04] p-3 text-[13px] leading-snug text-slate-300">
          <p><span className="font-semibold text-slate-100">{h.coverageLabel}</span> {h.coverageText}</p>
          <p className="mt-1.5 text-xs text-slate-400">{h.coverageNote}</p>
        </div>
      ),
    },
    {
      icon: <Radar className={iconClass} aria-hidden="true" />,
      title: h.step3Title,
      badge: h.step3Badge,
      text: h.step3Text,
    },
    {
      icon: <Sparkles className={iconClass} aria-hidden="true" />,
      title: h.step4Title,
      badge: h.step4Badge,
      text: h.step4Text,
    },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-black/70 text-slate-100 antialiased"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      {/* Alçada en % de l'overlay (fixed inset-0) i no en dvh, com els altres fulls: als motors sense dvh el
          full creixia fins al contingut i el botó de tancar quedava fora de la pantalla. */}
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="w-full max-w-2xl max-h-[92%] sm:max-h-full flex flex-col min-h-0 rounded-t-3xl sm:rounded-3xl border-t sm:border border-slate-200/15 bg-[#111623] shadow-[0_24px_64px_-24px_rgba(0,0,0,0.9)] outline-none"
      >
        <header className="shrink-0 flex items-start justify-between gap-4 px-5 sm:px-7 pt-5 sm:pt-6 pb-4 border-b border-slate-200/10">
          <div>
            <h2 id={titleId} className="text-xl sm:text-2xl font-semibold tracking-[-0.01em]">{h.title}</h2>
            <p className="mt-0.5 text-sm text-slate-400">{h.subtitle}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t.closeWindow}
            className="-mr-2 -mt-1 h-11 w-11 shrink-0 rounded-xl flex items-center justify-center text-slate-300 hover:text-white hover:bg-white/5 transition-colors"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 sm:px-7 py-5">
          <p className="text-[15px] leading-relaxed text-slate-200 text-pretty">{h.intro}</p>

          <ol className="mt-5">
            {steps.map((step, i) => (
              <li key={step.title} className="relative flex gap-3.5 sm:gap-4 pb-6 last:pb-0">
                {/* Línia estàtica que uneix els passos (no al darrer). */}
                {i < steps.length - 1 && (
                  <span aria-hidden="true" className="absolute left-[15px] top-9 bottom-1 w-px bg-slate-200/15" />
                )}
                <span aria-hidden="true" className="relative shrink-0 w-8 h-8 rounded-full border border-slate-200/25 bg-[#111623] flex items-center justify-center text-sm font-semibold text-slate-200">
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1 flex flex-col gap-2 pt-1">
                  <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                    <h3 className="flex items-center gap-2 text-base font-semibold leading-tight">
                      {step.icon}
                      {step.title}
                    </h3>
                    <span className="rounded-full border border-slate-200/20 px-2 py-0.5 text-[11px] font-medium text-slate-300">{step.badge}</span>
                  </div>
                  <p className="text-sm leading-relaxed text-slate-300 text-pretty">{step.text}</p>
                  {step.extra}
                </div>
              </li>
            ))}
          </ol>

          <p className="mt-6 pt-4 border-t border-slate-200/10 text-[13px] leading-relaxed text-slate-400 text-pretty">
            <span className="font-semibold text-slate-200">{h.noteTitle}</span> {h.noteText}
          </p>
        </div>

        <div className="shrink-0 px-5 sm:px-7 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] sm:pb-6 border-t border-slate-200/10">
          <button
            type="button"
            onClick={onClose}
            className="h-12 w-full rounded-2xl bg-slate-100 text-slate-900 text-base font-semibold hover:bg-white transition-colors"
          >
            {h.close}
          </button>
        </div>
      </div>
    </div>
  );
}
