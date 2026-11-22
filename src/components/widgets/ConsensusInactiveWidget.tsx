// src/components/widgets/ConsensusInactiveWidget.tsx
import React from 'react';
import { Language } from '../../translations';
import { Cpu, AlertTriangle } from 'lucide-react';
import { MATRIX_BG } from './widgetStyles';

interface ConsensusInactiveWidgetProps {
  lang?: Language | string;
  // 'no-coverage': cap model regional actiu (fora de les 13 malles HD, ECMWF global pur).
  // 'unavailable': hi ha un model regional actiu però la petició del model
  // global (best_match) ha fallat — sense dades no hi ha res a comparar.
  // Mentre la petició encara està EN CURS (cas normal, sub-segon) es mostra
  // ConsensusLoadingWidget en lloc d'aquest component — 'unavailable' només
  // apareix si la petició ha acabat i ha fallat de debò.
  reason?: 'no-coverage' | 'unavailable';
}

// [NETEJA] Abans tenia dos motius ('timezone'/'fallback'): el motiu 'timezone'
// desactivava tot el widget quan el fus horari del dispositiu no coincidia amb
// el de la ubicació consultada, independentment de si hi havia un model
// regional actiu. Era una cautela obsoleta — consensusMath.ts ja alinea totes
// les sèries per timestamp absolut (resolveHourlyEpoch), no per fus horari
// del dispositiu — i amb 13 models arreu del món desactivava el motor de
// consens gairebé sempre que es consultava una ubicació fora de la teva
// pròpia zona horària, encara que hi hagués un model HD real actiu.
// [FIX PRECISIÓ] Un cop eliminat aquell gate, va sortir a la llum un segon
// motiu real: per a moltes zones (EUA/HRRR, Japó/JMA...) el propi "best_match"
// d'Open-Meteo ja escull el model regional com a font — els valors hi
// coincideixen gairebé exacte. Inicialment això també suspenia el widget
// ('redundant'), però l'usuari va preferir que es mantingués actiu i mostrés
// la comparació igualment (Δ0, "Alineat") en lloc d'amagar-lo.
// [NETEJA] El motiu 'redundant' es va mantenir després d'això només per a la
// finestra de càrrega/error del model global — però durant la càrrega normal
// (sub-segon, cada canvi d'ubicació) dir "redundant" hi era directament fals,
// ja que encara no hi havia cap dada per comparar. Ara aquesta finestra de
// càrrega la cobreix ConsensusLoadingWidget, i aquest component només tracta
// el cas real restant: la petició ha fallat de debò ('unavailable').
const translations = {
  ca: {
    title: 'Model regional contra el global',
    badge: { 'no-coverage': 'Cobertura Global', unavailable: 'Comparació No Disponible' },
    description: {
      'no-coverage': "Aquí no arriba cap model d'alta resolució: la previsió ja surt dels models globals i no hi ha cap model regional per comparar-hi. L'acord entre els globals és als gràfics de dalt.",
      unavailable: "No s'ha pogut obtenir la comparació amb el model global en aquest moment. Torna-ho a provar més tard."
    },
    action: { 'no-coverage': 'Mode global en ús', unavailable: 'Sense comparació' }
  },
  es: {
    title: 'Modelo regional frente al global',
    badge: { 'no-coverage': 'Cobertura Global', unavailable: 'Comparación No Disponible' },
    description: {
      'no-coverage': "Aquí no llega ningún modelo de alta resolución: la previsión ya sale de los modelos globales y no hay ningún modelo regional con el que compararla. El acuerdo entre los globales está en los gráficos de arriba.",
      unavailable: "No se ha podido obtener la comparación con el modelo global en este momento. Vuelve a intentarlo más tarde."
    },
    action: { 'no-coverage': 'Modo global en uso', unavailable: 'Sin comparación' }
  },
  en: {
    title: 'Regional model vs global',
    badge: { 'no-coverage': 'Global Coverage', unavailable: 'Comparison Unavailable' },
    description: {
      'no-coverage': "No high-resolution model covers this place: the forecast already comes from the global models, so there is no regional model to compare. The agreement between the global models is shown in the charts above.",
      unavailable: "Could not retrieve the global model comparison right now. Please try again later."
    },
    action: { 'no-coverage': 'Global mode in use', unavailable: 'No comparison' }
  },
  fr: {
    title: 'Modèle régional face au global',
    badge: { 'no-coverage': 'Couverture Globale', unavailable: 'Comparaison Indisponible' },
    description: {
      'no-coverage': "Aucun modèle haute résolution ne couvre ce lieu : la prévision vient déjà des modèles globaux et il n'y a pas de modèle régional à comparer. L'accord entre les modèles globaux est dans les graphiques ci-dessus.",
      unavailable: "Impossible d'obtenir la comparaison avec le modèle global pour le moment. Réessayez plus tard."
    },
    action: { 'no-coverage': 'Mode global en cours', unavailable: 'Aucune comparaison' }
  }
};

export const ConsensusInactiveWidget: React.FC<ConsensusInactiveWidgetProps> = ({
    lang = 'ca',
    reason = 'no-coverage'
}) => {
  const safeLang = lang in translations ? (lang as keyof typeof translations) : 'en';
  const langT = translations[safeLang];
  const t = {
    title: langT.title,
    badge: langT.badge[reason],
    description: langT.description[reason],
    action: langT.action[reason]
  };

  // Mateix marc que la targeta activa (vores fines, sense animacions infinites ni resplendor): és un avís tranquil.
  return (
    <section className="relative w-full overflow-hidden rounded-[2rem] border border-white/[0.07] bg-gradient-to-b from-[#0e1018] to-[#0a0b11]">
      <div className={MATRIX_BG}></div>
      <div className="relative z-10 px-4 sm:px-5 md:px-6 py-4 md:py-5">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <h2 className="text-base font-semibold text-slate-100">{t.title}</h2>
          <span className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-amber-300">
            <AlertTriangle className="w-3.5 h-3.5" aria-hidden="true" />
            {t.badge}
          </span>
        </div>
        <p className="mt-2 max-w-3xl text-[13px] leading-relaxed text-slate-400">{t.description}</p>
        <div className="mt-3 flex items-center gap-2 border-t border-white/[0.06] pt-3 font-mono text-[11px] uppercase tracking-[0.12em] text-[#7a879b]">
          <Cpu className="w-3.5 h-3.5" aria-hidden="true" />
          <span>{t.action}</span>
        </div>
      </div>
    </section>
  );
};
