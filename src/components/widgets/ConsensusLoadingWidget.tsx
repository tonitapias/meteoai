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
    // Mateix marc que la targeta carregada (vores fines, sense resplendor); l'alçada és la d'una fila de tres xifres.
    <div className="w-full h-[168px] md:h-[150px] rounded-[2rem] border border-white/[0.07] bg-gradient-to-b from-[#0e1018] to-[#0a0b11] flex items-center justify-center gap-3">
      <Cpu className="w-4 h-4 text-slate-500 animate-spin" style={{ animationDuration: '2s' }} aria-hidden="true" />
      <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-slate-400">{t.label}</span>
    </div>
  );
};
