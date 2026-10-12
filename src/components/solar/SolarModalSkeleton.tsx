// src/components/solar/SolarModalSkeleton.tsx
// Esquelet del modal Cicle solar mentre arriba el seu tros de codi (fallback de Suspense, paquet principal).
// Estàtic i lleuger: ~14 nodes, només Tailwind (el CSS sm-* viatja amb el modal), cap animació. Les
// condicions de mitjana són les mateixes que solarModal.css, perquè el marc no salti en arribar el modal.
// No pren el focus: així useDialogFocus del modal encara troba la targeta del tauler com a origen i hi
// retorna el focus en tancar. Escape i el botó tanquen.
import { useEffect, useLayoutEffect } from 'react';
import { X } from 'lucide-react';
import type { Language } from '../../translations';
import { registerSolarSkeleton } from './preloadSolarModal';

// Còpia de SOLAR_T.title/close: solarI18n viu al tros diferit i no es pot importar aquí.
const TEXT: Readonly<Record<Language, { title: string; close: string }>> = {
  ca: { title: 'Cicle solar', close: 'Tanca' },
  es: { title: 'Ciclo solar', close: 'Cerrar' },
  en: { title: 'Sun cycle', close: 'Close' },
  fr: { title: 'Cycle solaire', close: 'Fermer' },
};

// Mòbil vertical: full de baix (96 %, cantons de dalt). Ample i prou alt: targeta centrada. Apaïsat baix:
// pantalla completa sense radi (les tres condicions de solarModal.css, escrites senceres per a Tailwind).
const ROOT = 'fixed inset-0 z-[100] flex items-end justify-center touch-none'
  + ' [@media(min-width:640px)_and_(min-height:481px)]:items-center [@media(min-width:640px)_and_(min-height:481px)]:p-4'
  + ' [@media(min-width:768px)_and_(min-height:481px)]:p-6';
const SHEET = 'relative flex flex-col w-full h-[96%] max-h-full overflow-hidden rounded-t-[24px] bg-[#07080C] border-t border-white/[0.08]'
  + ' [@media(min-width:640px)_and_(min-height:481px)]:h-full [@media(min-width:640px)_and_(min-height:481px)]:max-w-xl'
  + ' [@media(min-width:640px)_and_(min-height:481px)]:rounded-[28px] [@media(min-width:640px)_and_(min-height:481px)]:border'
  + ' [@media(min-width:768px)_and_(min-height:481px)]:max-w-3xl [@media(min-width:1024px)_and_(min-height:481px)]:max-w-5xl'
  + ' [@media(max-height:480px)_and_(min-width:480px)]:h-full [@media(max-height:480px)_and_(min-width:480px)]:rounded-none'
  + ' [@media(max-height:480px)_and_(min-width:480px)]:border-0';
const HEADER = 'flex-none flex items-center gap-3 h-14 pl-4 pr-1.5 border-b border-white/[0.06]'
  + ' [@media(min-width:768px)_and_(min-height:481px)]:h-16 [@media(min-width:768px)_and_(min-height:481px)]:pl-6'
  + ' [@media(min-width:768px)_and_(min-height:481px)]:pr-3 [@media(max-height:480px)_and_(min-width:480px)]:h-11';
// Disc solar com .sm-tile (pseudoelement, 0 nodes).
const TILE = "relative flex-none w-9 h-9 rounded-full border border-amber-400/30 bg-amber-400/10 after:content-['']"
  + ' after:absolute after:left-[10px] after:top-[10px] after:w-[14px] after:h-[14px] after:rounded-full'
  + ' after:bg-[radial-gradient(circle_at_38%_34%,#fffbeb_0,#fde68a_45%,#f59e0b_100%)]';
// pb-4 reserva la línia del lloc del modal, perquè el títol no es mogui (l'apaïsat baix l'amaga).
const TITLE = 'min-w-0 flex-1 truncate pb-4 text-[17px] leading-[22px] font-black uppercase tracking-tight text-white'
  + ' [@media(min-width:768px)_and_(min-height:481px)]:text-xl [@media(max-height:480px)_and_(min-width:480px)]:pb-0';
const CLOSE = 'flex-none inline-flex items-center justify-center w-11 h-11 rounded-full border border-white/10'
  + ' bg-white/[0.04] text-slate-300 focus:outline-none focus-visible:outline focus-visible:outline-2'
  + ' focus-visible:outline-offset-2 focus-visible:outline-[#fbbf24]';
const BLOCK = 'rounded-2xl bg-[#0C0F17] border border-white/[0.07]';

interface SolarModalSkeletonProps {
  lang?: Language;
  onClose: () => void;
}

export function SolarModalSkeleton({ lang = 'ca', onClose }: SolarModalSkeletonProps) {
  const text = TEXT[lang] ?? TEXT.ca;

  // Mentre és a la pantalla, el modal que el substitueixi en prendrà el relleu sense repetir l'entrada.
  useLayoutEffect(registerSolarSkeleton, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return (
    <div className={ROOT} role="dialog" aria-modal="true" aria-label={text.title} aria-busy="true">
      <div className="absolute inset-0 bg-[#05060A]" aria-hidden="true" />
      <div className={SHEET}>
        <div className={HEADER}>
          <span className={TILE} aria-hidden="true" />
          <h2 className={TITLE}>{text.title}</h2>
          <button type="button" className={CLOSE} aria-label={text.close} aria-keyshortcuts="Escape" onClick={onClose}>
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>
        <div className="p-4 space-y-4" aria-hidden="true">
          <div className="h-11" />
          <div className={`h-[169px] ${BLOCK}`} />
          <div className={`h-[290px] ${BLOCK}`} />
        </div>
      </div>
    </div>
  );
}
