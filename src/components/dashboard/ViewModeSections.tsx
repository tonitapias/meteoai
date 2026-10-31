// src/components/dashboard/ViewModeSections.tsx
// Les dues peces del tauler que lliguen les vistes, al punt on apareix el contingut de la vista completa
// (just després del resum de la IA):
// - MoreDetailPrompt (vista essencial): "Vols més detall?" amb valors d'ara que la vista essencial no ensenya.
//   Sencera només per a qui encara no coneix la vista completa; si no, una sola línia. Els dies amb un cicló de
//   categoria 4 o 5, el primer xip (i el començament de la línia) és aquest fenomen.
// - CompleteViewHeading (vista completa): una franja amb els colors i la icona de la vista completa que marca
//   on comença el contingut nou, amb el botó per tornar a l'essencial (colors i icona de l'essencial).
// Sense blur, filtres ni animacions contínues (mòbils modestos).
import { useEffect, useId, useRef } from 'react';
import { ChevronRight, Eye, Gauge, Leaf, Moon, Plus } from 'lucide-react';
import type { TranslationType } from '../../translations';
import type { DetailTeaserItem, DetailTeaserKey } from '../../utils/detailTeaser';
import { VIEW_MODE_STYLE } from '../viewModeStyle';
import { CycloneIcon } from '../planet/CycloneIcon';
import { COMPLETE_VIEW_ANCHOR_ID } from './completeViewAnchor';

type ViewModeStrings = TranslationType['viewModes'];

// El botó que s'acaba de tocar desapareix en canviar de vista: la peça que el substitueix agafa el focus
// del teclat si ho demana el tauler (takeFocus torna true una sola vegada per petició).
export type TakeFocusRequest = (target: 'prompt' | 'heading') => boolean;

const TEASER_ICONS: Record<DetailTeaserKey, typeof Gauge | typeof CycloneIcon> = {
  planet: CycloneIcon,
  pressure: Gauge,
  air: Leaf,
  moon: Moon,
  visibility: Eye,
};

interface MoreDetailPromptProps {
  compact: boolean;
  teaser: DetailTeaserItem[];
  strings: ViewModeStrings;
  onShow: () => void;
  onDismiss: () => void;
  takeFocus: TakeFocusRequest;
}

export function MoreDetailPrompt({ compact, teaser, strings, onShow, onDismiss, takeFocus }: MoreDetailPromptProps) {
  const titleId = useId();
  const focusRef = useRef<HTMLElement | null>(null);

  // També quan la targeta passa a una línia ("Ara no"): el botó tocat ja no hi és.
  useEffect(() => {
    if (takeFocus('prompt')) focusRef.current?.focus();
  }, [takeFocus, compact]);

  if (compact) {
    const lead = teaser.find((item) => item.compactText)?.compactText;
    return (
      <button
        ref={(el) => { focusRef.current = el; }}
        type="button"
        onClick={onShow}
        className="flex w-full min-h-[48px] items-center gap-3 rounded-2xl border border-sky-500/20 bg-[#0b1220] px-4 py-3 text-left transition-colors cursor-pointer hover:border-sky-400/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/60"
      >
        <Plus aria-hidden="true" className="w-4 h-4 shrink-0 text-sky-400" />
        <span className="min-w-0 flex-1 truncate text-sm">
          <span className="font-semibold text-slate-100">{strings.sectionTitle}</span>
          <span className="text-slate-400"> · {lead ? `${lead}, ${strings.compactRow}` : strings.compactRow}</span>
        </span>
        <ChevronRight aria-hidden="true" className="w-4 h-4 shrink-0 text-slate-500" />
      </button>
    );
  }

  return (
    <section
      aria-labelledby={titleId}
      className="flex flex-col gap-4 rounded-2xl border border-sky-500/20 bg-[#0b1220] p-4 sm:p-5 md:flex-row md:items-center md:gap-6"
    >
      <div className="min-w-0 md:flex-1">
        <h2 id={titleId} ref={(el) => { focusRef.current = el; }} tabIndex={-1} className="text-base font-semibold text-slate-100 focus:outline-none">{strings.cardTitle}</h2>
        <p className="mt-1 text-sm text-slate-400">{strings.cardText}</p>
      </div>

      {teaser.length > 0 && (
        <ul className="flex flex-wrap gap-2 md:flex-[1.4]">
          {teaser.map((item, index) => {
            const Icon = TEASER_ICONS[item.key];
            // El fenomen del planeta, sobri: només la vora i la icona en to d'avís.
            const planet = item.key === 'planet';
            return (
              // Al mòbil n'hi caben tres en una línia i mitja; la quarta, a partir de tauleta.
              <li
                key={item.key}
                className={`${index >= 3 ? 'hidden sm:inline-flex' : 'inline-flex'} items-center gap-1.5 rounded-full border ${planet ? 'border-rose-400/35' : 'border-white/10'} bg-black/30 px-3 py-1 text-xs text-slate-200`}
              >
                <Icon aria-hidden="true" className={`w-3.5 h-3.5 shrink-0 ${planet ? 'text-rose-300' : 'text-slate-400'}`} />
                {item.text}
              </li>
            );
          })}
        </ul>
      )}

      <div className="flex items-center gap-2 md:shrink-0">
        <button
          type="button"
          onClick={onShow}
          className="min-h-[44px] flex-1 rounded-xl bg-sky-700 px-4 text-sm font-semibold text-white transition-colors cursor-pointer hover:bg-sky-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-300 md:flex-none"
        >
          {strings.cardShow}
        </button>
        <button
          type="button"
          onClick={onDismiss}
          className="min-h-[44px] rounded-xl px-4 text-sm text-slate-400 transition-colors cursor-pointer hover:bg-white/5 hover:text-slate-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/60"
        >
          {strings.cardDismiss}
        </button>
      </div>
    </section>
  );
}

interface CompleteViewHeadingProps {
  strings: ViewModeStrings;
  onBack: () => void;
  takeFocus: TakeFocusRequest;
}

export function CompleteViewHeading({ strings, onBack, takeFocus }: CompleteViewHeadingProps) {
  const titleRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (takeFocus('heading')) titleRef.current?.focus();
  }, [takeFocus]);

  const complete = VIEW_MODE_STYLE.expert;
  const essential = VIEW_MODE_STYLE.basic;

  return (
    <div
      id={COMPLETE_VIEW_ANCHOR_ID}
      // flex-wrap: en mòbils molt estrets (o en francès a 360 px) el botó baixa a una segona línia en lloc
      // d'aprimar el títol i l'explicació fins a quatre línies.
      className="flex flex-wrap scroll-mt-4 items-center gap-x-3 gap-y-2 rounded-2xl border border-indigo-400/50 bg-indigo-500/[0.14] px-3 py-2.5 sm:px-4"
    >
      <span aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-400/20">
        <complete.Icon className={`h-[18px] w-[18px] ${complete.soft}`} />
      </span>
      <div className="min-w-[8rem] flex-1">
        <h2 ref={titleRef} tabIndex={-1} className={`text-base font-semibold leading-tight focus:outline-none ${complete.strong}`}>{strings.sectionTitle}</h2>
        <p className={`mt-0.5 text-xs leading-snug ${complete.soft}`}>{strings.sectionHint}</p>
      </div>
      {/* Al mòbil "Torna a l'essencial" no hi cap al costat del títol: es veu "Essencial" i es diu sencer. */}
      <button
        type="button"
        onClick={onBack}
        aria-label={strings.backToEssential}
        className={`ml-auto inline-flex min-h-[44px] shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-sm font-semibold transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/60 ${essential.chip} ${essential.strong}`}
      >
        <essential.Icon aria-hidden="true" className={`h-4 w-4 ${essential.soft}`} />
        {strings.essential}
      </button>
    </div>
  );
}
