// src/components/SettingsSheet.tsx
// «Configuració», l'engranatge de la capçalera del tauler (auditoria d'UX del 16/11/2026, B11): abans l'idioma només es
// podia canviar a la benvinguda, «Com funciona» només s'hi obria i buidar la memòria cau estava amagat al botó d'estat
// del peu. Mateix full que «Què vols compartir?»: opac, sense desenfocaments, filtres ni animacions en bucle.
// «Com funciona» s'obre a sobre amb un pas d'historial propi (com les pantalles d'«Extrems del planeta»): la creu,
// Escape i l'«enrere» del mòbil tornen al menú, no el tanquen sencer.
import { lazy, Suspense, useCallback, useEffect, useId, useRef, useState } from 'react';
import { X, HelpCircle, Trash2 } from 'lucide-react';
import { useDialogFocus } from '../hooks/useDialogFocus';
import {
  ignoreNextPopState, isPopStateHandled, markPopStateHandled, pushHistoryLevel, removeHistoryLevel
} from '../hooks/useModalHistory';
import { cacheService } from '../services/cacheService';
import { APP_VERSION } from '../utils/appVersion';
import type { Language, TranslationType } from '../translations';
import SheetOption from './SheetOption';

const HowItWorksModal = lazy(() => import('./HowItWorksModal'));

// El mateix ordre que el selector de la benvinguda.
const LANGS: readonly Language[] = ['ca', 'es', 'en', 'fr'];

interface SettingsSheetProps {
  t: TranslationType;
  lang: Language;
  onLangChange: (lang: Language) => void;
  /** Mentre es carrega una previsió, l'idioma no es canvia (com a la benvinguda). */
  langDisabled?: boolean;
  onClose: () => void;
}

export default function SettingsSheet({ t, lang, onLangChange, langDisabled = false, onClose }: SettingsSheetProps) {
  const s = t.settings;
  const titleId = useId();
  const langLabelId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);

  // --- «Com funciona», a sobre del menú i amb el seu pas d'historial ---
  const [helpOpen, setHelpOpen] = useState(false);
  const helpLevelRef = useRef<symbol | null>(null);
  // Amb «Com funciona» obert, el focus i el Tab són seus: el menú de sota els deixa anar.
  useDialogFocus(!helpOpen, dialogRef);

  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      if (isPopStateHandled(event)) return;
      const level = helpLevelRef.current;
      if (!level) return;
      helpLevelRef.current = null;
      removeHistoryLevel(level);
      markPopStateHandled(event);
      setHelpOpen(false);
    };
    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
      // Un nivell que quedés a la pila impediria tancar els altres modals amb l'«enrere».
      if (helpLevelRef.current) removeHistoryLevel(helpLevelRef.current);
      helpLevelRef.current = null;
    };
  }, []);

  const openHelp = () => {
    window.history.pushState({ settingsHelp: true }, '', window.location.href);
    helpLevelRef.current = pushHistoryLevel();
    setHelpOpen(true);
  };

  const closeHelp = useCallback(() => {
    const level = helpLevelRef.current;
    helpLevelRef.current = null;
    setHelpOpen(false);
    if (!level) return;
    removeHistoryLevel(level);
    // El retrocés que treu el pas de «Com funciona» no l'ha de llegir ningú com un «enrere» de l'usuari.
    ignoreNextPopState();
    window.history.back();
  }, []);

  // Escape tanca el menú; amb «Com funciona» a sobre, ja el tanca ell (i es torna al menú).
  useEffect(() => {
    if (helpOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, helpOpen]);

  // Només les previsions i les anàlisis desades (vegeu cacheService.clearCachedData): els favorits i les preferències
  // es mantenen, tal com diu el diàleg.
  const clearCache = async () => {
    if (!window.confirm(s.resetConfirm)) return;
    try {
      await cacheService.clearCachedData();
    } catch (e) {
      console.error('Error esborrant la memòria cau:', e);
    } finally {
      window.location.reload();
    }
  };

  return (
    <>
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
            <h2 id={titleId} className="text-lg font-semibold tracking-[-0.01em]">{s.title}</h2>
            <button
              type="button"
              onClick={onClose}
              aria-label={t.closeWindow}
              className="-mr-2 h-11 w-11 shrink-0 rounded-xl flex items-center justify-center text-slate-300 hover:text-white hover:bg-white/5 transition-colors"
            >
              <X className="w-5 h-5" aria-hidden="true" />
            </button>
          </header>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pt-1 pb-[max(1.25rem,env(safe-area-inset-bottom))] flex flex-col gap-2.5">
            {/* Idioma: el mateix grup de quatre botons que la benvinguda; canvia a l'instant. */}
            <div>
              <p id={langLabelId} className="mb-1.5 text-xs text-slate-400">{s.language}</p>
              <div role="group" aria-labelledby={langLabelId} className="grid grid-cols-4 rounded-xl border border-slate-200/25 overflow-hidden">
                {LANGS.map(l => (
                  <button
                    key={l}
                    type="button"
                    lang={l}
                    aria-pressed={lang === l}
                    disabled={langDisabled}
                    onClick={() => onLangChange(l)}
                    className={`h-11 text-[13px] font-semibold uppercase transition-colors disabled:opacity-50 ${lang === l ? 'bg-slate-100 text-slate-900' : 'text-slate-300 hover:text-white hover:bg-white/5'}`}
                  >
                    {l}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-1.5 flex flex-col gap-2.5">
              <SheetOption
                icon={<HelpCircle className="w-5 h-5" />}
                title={t.howItWorks.title}
                hint={s.howItWorksHint}
                onClick={openHelp}
              />
              <SheetOption
                icon={<Trash2 className="w-5 h-5" />}
                title={s.clearCache}
                hint={s.clearCacheHint}
                onClick={() => { void clearCache(); }}
              />
            </div>

            <p className="mt-2 text-center font-mono text-[11px] tracking-widest text-slate-400">
              <span className="uppercase">MeteoToni AI</span> · v{APP_VERSION}
            </p>
          </div>
        </div>
      </div>

      {helpOpen && (
        <Suspense fallback={null}>
          <HowItWorksModal onClose={closeHelp} t={t} />
        </Suspense>
      )}
    </>
  );
}
