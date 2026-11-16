// src/components/widgets/ConsensusLoadingWidget.tsx
import React from 'react';
import { Language } from '../../translations';
import { Cpu } from 'lucide-react';

interface ConsensusLoadingWidgetProps {
  lang?: Language | string;
}

// Mateix nom que la targeta carregada (ConsensusWidget): el model regional contra el global, no un "motor de consens".
const translations = {
  ca: { label: 'Comparant amb el model global...' },
  es: { label: 'Comparando con el modelo global...' },
  en: { label: 'Comparing with the global model...' },
  fr: { label: 'Comparaison avec le modèle global...' }
};

// [NETEJA] Abans, mentre la petició del model global (best_match) encara
// estava en curs, ExpertWidgets.tsx mostrava directament ConsensusInactiveWidget
// amb reason='redundant' — un missatge que afirmava "el model coincideix amb
// el global" durant una finestra en què encara no hi havia cap dada per
// comparar-hi. Aquest component neutre la substitueix mentre useGlobalModel
// encara no ha resolt, sense afirmar res que encara no se sap.
export const ConsensusLoadingWidget: React.FC<ConsensusLoadingWidgetProps> = ({ lang = 'ca' }) => {
  const safeLang = lang in translations ? (lang as keyof typeof translations) : 'en';
  const t = translations[safeLang];

  return (
    <div className="w-full h-[168px] sm:h-[152px] bg-slate-900/60 border border-white/5 rounded-[24px] animate-pulse flex items-center justify-center gap-3">
      <Cpu className="w-4 h-4 text-slate-600 animate-spin" style={{ animationDuration: '2s' }} />
      <span className="text-[10px] sm:text-xs font-mono uppercase tracking-widest text-slate-600">{t.label}</span>
    </div>
  );
};
