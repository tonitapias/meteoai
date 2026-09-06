// src/components/widgets/ConsensusInactiveWidget.tsx
import React from 'react';
import { Language } from '../../translations';
import { Cpu, AlertTriangle } from 'lucide-react';

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
    title: 'Motor de Consens Suspès',
    badge: { 'no-coverage': 'Cobertura Global', unavailable: 'Comparació No Disponible' },
    description: {
      'no-coverage': "Ubicació fora de la malla d'alta resolució. L'anàlisi de divergències s'ha suspès temporalment per evitar redundància matemàtica amb models globals base.",
      unavailable: "No s'ha pogut obtenir la comparació amb el model global en aquest moment. Torna-ho a provar més tard."
    },
    action: { 'no-coverage': 'Mode global en ús', unavailable: 'Sense comparació' }
  },
  es: {
    title: 'Motor de Consenso Suspendido',
    badge: { 'no-coverage': 'Cobertura Global', unavailable: 'Comparación No Disponible' },
    description: {
      'no-coverage': "Ubicación fuera de la malla de alta resolución. El análisis de divergencias se ha suspendido temporalmente para evitar redundancia matemática con modelos globales base.",
      unavailable: "No se ha podido obtener la comparación con el modelo global en este momento. Vuelve a intentarlo más tarde."
    },
    action: { 'no-coverage': 'Modo global en uso', unavailable: 'Sin comparación' }
  },
  en: {
    title: 'Consensus Engine Suspended',
    badge: { 'no-coverage': 'Global Coverage', unavailable: 'Comparison Unavailable' },
    description: {
      'no-coverage': "Location outside high-resolution mesh. Divergence analysis is temporarily suspended to prevent mathematical redundancy with base global models.",
      unavailable: "Could not retrieve the global model comparison right now. Please try again later."
    },
    action: { 'no-coverage': 'Global mode in use', unavailable: 'No comparison' }
  },
  fr: {
    title: 'Moteur de Consensus Suspendu',
    badge: { 'no-coverage': 'Couverture Globale', unavailable: 'Comparaison Indisponible' },
    description: {
      'no-coverage': "Emplacement hors de la maille haute résolution. L'analyse des divergences est temporairement suspendue pour éviter une redondance mathématique avec les modèles globaux de base.",
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

  return (
    <div className="w-full relative perspective-[1000px]">
      <style>
        {`
          @keyframes float3d {
            0%, 100% { transform: translateY(0) rotateX(2deg) rotateY(-2deg); }
            50% { transform: translateY(-5px) rotateX(-1deg) rotateY(1deg); }
          }
          @keyframes spin3d {
            from { transform: rotateY(0deg) rotateX(15deg); }
            to { transform: rotateY(360deg) rotateX(15deg); }
          }
          .preserve-3d { transform-style: preserve-3d; }
        `}
      </style>

      <div className="w-full bg-[#030712]/80 backdrop-blur-xl border border-amber-900/40 rounded-[24px] p-6 shadow-[0_20px_50px_rgba(245,158,11,0.15)] relative overflow-hidden flex flex-col sm:flex-row items-center gap-8 preserve-3d animate-[float3d_6s_ease-in-out_infinite]">

         <div className="absolute inset-0 bg-[linear-gradient(rgba(6,182,212,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(6,182,212,0.03)_1px,transparent_1px)] bg-[size:24px_24px] opacity-40 [transform:translateZ(-50px)]"></div>

         <div className="relative flex items-center justify-center shrink-0 w-32 h-32 preserve-3d">
            <div className="absolute -bottom-4 w-20 h-4 bg-amber-400/30 shadow-[0_-20px_40px_rgba(251,191,36,0.5)] rounded-[100%] blur-md"></div>
            <div className="absolute bottom-0 w-24 h-32 bg-gradient-to-t from-amber-500/10 to-transparent blur-sm [transform:rotateX(45deg)] opacity-70"></div>

            <div className="relative w-20 h-20 preserve-3d animate-[spin3d_12s_linear_infinite]">
               <div className="absolute inset-0 rounded-full border-[1.5px] border-amber-500/60 shadow-[0_0_15px_rgba(251,191,36,0.3)] [transform:rotateX(90deg)]"></div>
               <div className="absolute inset-0 rounded-full border border-amber-500/30"></div>
               <div className="absolute inset-0 rounded-full border border-amber-500/30 [transform:rotateY(45deg)]"></div>
               <div className="absolute inset-0 rounded-full border border-amber-500/30 [transform:rotateY(90deg)]"></div>
               <div className="absolute inset-0 rounded-full border border-amber-500/30 [transform:rotateY(135deg)]"></div>

               <div className="absolute inset-0 flex items-center justify-center [transform:rotateY(-90deg)]">
                  <div className="w-2 h-2 rounded-full bg-amber-100 shadow-[0_0_20px_10px_rgba(251,191,36,0.5)]"></div>
               </div>
            </div>
         </div>

         <div className="flex flex-col text-center sm:text-left z-10 w-full [transform:translateZ(30px)]">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center w-full mb-3 gap-3">
               <h2 className="text-[11px] sm:text-xs font-bold text-amber-100 drop-shadow-[0_0_8px_rgba(251,191,36,0.6)] uppercase tracking-[0.2em]">
                 {t.title}
               </h2>
               <div className="inline-flex items-center self-center sm:self-auto gap-1.5 text-[9px] font-black uppercase px-3 py-1.5 rounded-full border border-amber-500/30 bg-amber-950/40 text-amber-300 tracking-widest backdrop-blur-md">
                 <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                 {t.badge}
               </div>
            </div>

            <p className="text-[11px] sm:text-[13px] text-amber-100/60 leading-relaxed font-light mb-4">
               {t.description}
            </p>

            <div className="mt-auto flex items-center justify-between border-t border-amber-900/50 pt-3">
               <div className="flex items-center gap-2 text-[9px] font-mono uppercase tracking-widest text-amber-500">
                  <Cpu className="w-3.5 h-3.5 animate-pulse" />
                  <span>{t.action}</span>
               </div>

               <div className="flex items-end gap-0.5 h-3 opacity-60">
                  <div className="w-1 h-full bg-amber-600 animate-[bounce_1s_infinite]"></div>
                  <div className="w-1 h-2/3 bg-amber-600 animate-[bounce_1.5s_infinite]"></div>
                  <div className="w-1 h-1 bg-amber-600 animate-[bounce_0.8s_infinite]"></div>
                  <div className="w-1 h-3/4 bg-amber-600 animate-[bounce_1.2s_infinite]"></div>
               </div>
            </div>
         </div>
      </div>
    </div>
  );
};
