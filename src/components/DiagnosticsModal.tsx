// src/components/DiagnosticsModal.tsx
import { useEffect, useState } from 'react';
import { X, Globe, Radar, ArrowDown, Cpu, Layers, Radio, Network, Info, Compass, MapPin } from 'lucide-react';
import { Language, TranslationType } from '../translations';

interface DiagnosticsModalProps {
  onClose: () => void;
  lang: Language;
  t: TranslationType;
  wrfWindFormatted: string;
  aromeWindFormatted: string;
}

/**
 * METEOTONI AI - PUBLIC WEATHER INFOGRAPHIC MODAL (v6.0 i18n FULL COMPATIBILITY)
 * Arquitectura: Smart Dictionary intern (ca, es, en, fr), Component Autònom.
 * Doctrina Risc Zero: 0 Errors TS/ESLint, resolució nativa d'apòstrofs i caràcters especials.
 */
export default function DiagnosticsModal({
  onClose,
  lang,
  t,
  wrfWindFormatted,
  aromeWindFormatted
}: DiagnosticsModalProps) {

  // Aïllament d'esdeveniments: Escoltem ESC només quan el modal està obert
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // ============================================================================
  // SMART DICTIONARY: DICCIONARI INTERN MULTILINGÜE DEL MODAL (Fallback 4 Idiomes)
  // ============================================================================
  const tRecord = (t && typeof t === 'object') ? (t as Record<string, unknown>) : {};
  const tDiag = (tRecord.diagnostics && typeof tRecord.diagnostics === 'object') ? (tRecord.diagnostics as Record<string, string>) : {};

  const dict = {
    diagTitle: tDiag.diagTitle || (lang === 'es' ? "CÓMO TRABAJA LA PREVISIÓN COMPARATIVA" : lang === 'en' ? "HOW COMPARATIVE FORECAST WORKS" : lang === 'fr' ? "COMMENT FONCTIONNE LA PRÉVISION COMPARATIVE" : "COM TREBALLA LA PREVISIÓ COMPARATIVA"),
    subtitle: tDiag.subtitle || (lang === 'es' ? "Motor de Inteligencia Meteorológica" : lang === 'en' ? "Meteorological Intelligence Engine" : lang === 'fr' ? "Moteur d'Intelligence Météorologique" : "Motor d'Intel·ligència Meteorològica"),
    pedagogicIntro: tDiag.pedagogicIntro || (lang === 'es' ? "En la montaña el tiempo puede cambiar en minutos y los relieves locales crean microclimas. Por eso nunca confiamos en una sola fuente meteorológica:" : lang === 'en' ? "In the mountains, weather can change in minutes and terrain creates microclimates. That is why we never rely on a single weather source:" : lang === 'fr' ? "En montagne, le temps peut changer en quelques minutes et le relief crée des microclimats. C'est pourquoi nous ne nous fions jamais à une seule source météo :" : "A la muntanya el tiempo pot canviar en minuts i els relleus locals creen microclimes. Per això mai confiem en una sola font meteorològica:"),
    
    step1Title: tDiag.step1Title || (lang === 'es' ? "GENERAL" : lang === 'en' ? "GENERAL" : lang === 'fr' ? "GÉNÉRAL" : "GENERAL"),
    step1Header: tDiag.step1Header || (lang === 'es' ? "MODELOS GLOBALES" : lang === 'en' ? "GLOBAL MODELS" : lang === 'fr' ? "MODÈLES GLOBAUX" : "MODELS GLOBALS"),
    step1Badge: tDiag.step1Badge || (lang === 'es' ? "4 FUENTES MUNDIALES" : lang === 'en' ? "4 WORLDWIDE SOURCES" : lang === 'fr' ? "4 SOURCES MONDIALES" : "4 FONTS MUNDIALS"),
    step1Desc: tDiag.step1Desc || (lang === 'es' ? "Analizan la atmósfera a gran escala para adelantar el tiempo a varios días vista. Son la base más fiable para conocer las tendencias generales en cualquier parte del planeta." : lang === 'en' ? "They analyze the atmosphere on a large scale to forecast the weather several days ahead. They are the most reliable baseline for general trends anywhere on the planet." : lang === 'fr' ? "Ils analysent l'atmosphère à grande échelle pour prévoir le temps à plusieurs jours. Ils constituent la base la plus fiable pour connaître les tendances générales partout dans le monde." : "Analitzen l'atmosfera a gran escala per avançar el temps a diversos dies vista. Són la base més fiable per conèixer les tendències generals a qualsevol part del planeta."),
    step1WindLabel: tDiag.step1WindLabel || (lang === 'es' ? "Racha máx (Media Global):" : lang === 'en' ? "Max gust (Global Average):" : lang === 'fr' ? "Rafale max (Moyenne Globale) :" : "Ràfega màx (Mitjana Global):"),
    
    step2Title: tDiag.step2Title || (lang === 'es' ? "LOCAL" : lang === 'en' ? "LOCAL" : lang === 'fr' ? "LOCAL" : "LOCAL"),
    step2Header: tDiag.step2Header || (lang === 'es' ? "DETALLE DE PRECISIÓN" : lang === 'en' ? "PRECISION DETAIL" : lang === 'fr' ? "DÉTAIL DE PRÉCISION" : "DETALL DE PRECISIÓ"),
    step2Badge: tDiag.step2Badge || (lang === 'es' ? "Resolución 1.3km" : lang === 'en' ? "1.3km Resolution" : lang === 'fr' ? "Résolution 1.3km" : "Resolució 1.3km"),
    step2Desc: tDiag.step2Desc || (lang === 'es' ? "Los relieves, montañas y costas modifican el viento y la lluvia. Este modelo aplica un zoom de alta precisión para entender qué pasará exactamente en tu municipio o valle." : lang === 'en' ? "Terrain, mountains, and coasts modify wind and rain. This model applies a high-precision zoom to understand exactly what will happen in your specific town or valley." : lang === 'fr' ? "Le relief, les montagnes et les côtes modifient le vent et la pluie. Ce modèle applique un zoom ultra-précis pour comprendre ce qui se passera dans votre commune ou vallée." : "Els relleus, muntanyes i costes modifiquen el vent i la pluja. Aquest model aplica un zoom d'alta precisió per entendre què passarà exactament al teu municipi o vall."),
    step2CoverageTitle: tDiag.step2CoverageTitle || (lang === 'es' ? "Zona Cobertura:" : lang === 'en' ? "Coverage Zone:" : lang === 'fr' ? "Zone Couverture :" : "Zona Cobertura:"),
    step2CoverageText: tDiag.step2CoverageText || (lang === 'es' ? "Península Ibérica, Francia, Pirineos y Europa Occidental." : lang === 'en' ? "Iberian Peninsula, France, Pyrenees, and Western Europe." : lang === 'fr' ? "Péninsule Ibérique, France, Pyrénées et Europe Occidentale." : "Península Ibèrica, França, Pirineus i Europa Occidental."),
    step2CoverageNote: tDiag.step2CoverageNote || (lang === 'es' ? "*Fuera de esta región, la app utiliza el consenso de los modelos globales (Paso 1)." : lang === 'en' ? "*Outside this region, the app uses the consensus of global models (Step 1)." : lang === 'fr' ? "*En dehors de cette région, l'app utilise le consensus des modèles globaux (Étape 1)." : "*Fora d'aquesta regió, l'app utilitza el consens dels models globals (Pas 1)."),
    step2WindLabel: tDiag.step2WindLabel || (lang === 'es' ? "Racha máx (Cálculo Local):" : lang === 'en' ? "Max gust (Local Calc):" : lang === 'fr' ? "Rafale max (Calcul Local) :" : "Ràfega màx (Càlcul Local):"),
    
    step3Title: tDiag.step3Title || (lang === 'es' ? "SÍNTESIS" : lang === 'en' ? "SYNTHESIS" : lang === 'fr' ? "SYNTHÈSE" : "SÍNTESI"),
    step3Header: tDiag.step3Header || (lang === 'es' ? "ASISTENTE METEOROLÓGICO" : lang === 'en' ? "WEATHER ASSISTANT" : lang === 'fr' ? "ASSISTANT MÉTÉO" : "ASSISTENT METEOROLÒGIC"),
    aiFooter: tDiag.aiFooter || (lang === 'es' ? "MeteoToni AI analizará ambos modelos en tiempo real para avisarte de cualquier peligro en cuanto despliegues los sensores." : lang === 'en' ? "MeteoToni AI will analyze both models in real-time to warn you of any hazards as soon as you deploy sensors." : lang === 'fr' ? "MeteoToni AI analysera les deux modèles en temps réel pour vous avertir de tout danger dès le déploiement." : "MeteoToni AI analitzarà ambdós models en temps real per avisar-te de qualsevol perill tan bon punt despleguis els sensors."),
    
    transparencyTitle: tDiag.transparencyTitle || (lang === 'es' ? "Nota de transparencia:" : lang === 'en' ? "Transparency Note:" : lang === 'fr' ? "Note de transparence :" : "Nota de transparència:"),
    transparencyText: tDiag.transparencyText || (lang === 'es' ? "La meteorología es una ciencia probabilística. Esta comparativa te ayuda a tomar decisiones más informadas, pero te recomendamos observar siempre la evolución real del cielo y tu entorno." : lang === 'en' ? "Meteorology is a probabilistic science. This comparison helps you make informed decisions, but we always recommend observing the actual sky and your surroundings." : lang === 'fr' ? "La météorologie est une science probabiliste. Cette comparaison vous aide à prendre des décisions informées, mais nous recommandons toujours d'observer l'évolution réelle du ciel et de votre environnement." : "La meteorologia és una ciència probabilística. Aquesta comparativa t'ajuda a prendre decisions més informades, però et recomanem observar sempre l'evolució real del cel i el teu entorn."),
    
    aligned: tDiag.aligned || (lang === 'es' ? "SISTEMA LISTO PARA CALIBRAR" : lang === 'en' ? "SYSTEM READY TO CALIBRATE" : lang === 'fr' ? "SYSTÈME PRÊT À CALIBRER" : "SISTEMA LLEST PER CALIBRAR"),
    standbyReceiver: tDiag.standbyReceiver || (lang === 'es' ? "STANDBY (Esperando señal GPS)" : lang === 'en' ? "STANDBY (Awaiting GPS signal)" : lang === 'fr' ? "STANDBY (En attente de signal GPS)" : "STANDBY (Esperant senyal GPS)"),
    closeModal: tDiag.closeModal || (lang === 'es' ? "ENTENDIDO, VOLVER A LA APP" : lang === 'en' ? "GOT IT, BACK TO APP" : lang === 'fr' ? "COMPRIS, RETOUR À L'APP" : "ENTÈS, TORNA A L'APP"),
  };

  const globalModels = [
    lang === 'es' ? 'ECMWF (Europeo)' : lang === 'en' ? 'ECMWF (European)' : lang === 'fr' ? 'ECMWF (Européen)' : 'ECMWF (Europeu)',
    lang === 'es' ? 'GFS (Americano)' : lang === 'en' ? 'GFS (American)' : lang === 'fr' ? 'GFS (Américain)' : 'GFS (Americà)',
    lang === 'es' ? 'ICON (Alemán)' : lang === 'en' ? 'ICON (German)' : lang === 'fr' ? 'ICON (Allemand)' : 'ICON (Alemany)',
    'WRF (Global)'
  ];

  // Generació pura (només a l'inici) de partícules atmosfèriques exclusives del modal
  const [modalParticles] = useState(() => 
    Array.from({ length: 15 }).map(() => ({
      left: `${Math.random() * 100}%`,
      top: `${Math.random() * 100}%`,
      size: `${Math.random() * 2 + 1}px`,
      duration: `${4 + Math.random() * 6}s`,
      delay: `-${Math.random() * 5}s`
    }))
  );

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-md animate-fadeIn select-none font-sans text-slate-200 overflow-hidden">
      
      {/* =========================================
          MOTOR D'EFECTES ESPECIALS INTERNS (CSS GPU)
          ========================================= */}
      <style>{`
        .grid-coarse {
          background-image: linear-gradient(rgba(56, 189, 248, 0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(56, 189, 248, 0.08) 1px, transparent 1px);
          background-size: 20px 20px;
        }
        
        @keyframes data-flow {
          0% { transform: translateY(-100%); opacity: 0; }
          10%, 90% { opacity: 1; }
          100% { transform: translateY(400%); opacity: 0; }
        }
        
        @keyframes radar-scan {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        @keyframes globe-spin {
          from { transform: rotate(0deg) scale(1.2); }
          to { transform: rotate(360deg) scale(1.2); }
        }

        @keyframes modal-float {
          0% { transform: translateY(0px) translateX(0px); opacity: 0; }
          20% { opacity: 0.5; }
          80% { opacity: 0.3; }
          100% { transform: translateY(-80px) translateX(20px); opacity: 0; }
        }

        @keyframes title-shimmer {
          0% { background-position: 200% center; }
          100% { background-position: -200% center; }
        }

        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>

      {/* Finestra Modal Principal (Amb resplendor esfèrica de fons) */}
      <div className="relative w-full max-w-2xl glass-panel rounded-t-3xl sm:rounded-3xl border-t sm:border border-sky-400/30 p-5 sm:p-7 shadow-[0_0_60px_rgba(0,0,0,0.9)] max-h-[92vh] overflow-y-auto no-scrollbar flex flex-col gap-4 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900 via-[#030712] to-black">
        
        {/* Partícules Atmosfèriques Internes */}
        <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none rounded-3xl">
          {modalParticles.map((p, i) => (
            <div 
              key={i}
              className="absolute bg-sky-300 rounded-full"
              style={{
                left: p.left,
                top: p.top,
                width: p.size,
                height: p.size,
                opacity: 0,
                filter: `blur(${parseFloat(p.size) / 2}px)`,
                animation: `modal-float ${p.duration} linear infinite`,
                animationDelay: p.delay,
              }}
            />
          ))}
          {/* Resplendor superior intern */}
          <div className="absolute top-[-20%] left-[20%] w-[60%] h-[30%] bg-sky-500/10 blur-[80px] rounded-full"></div>
        </div>

        {/* =========================================================
            CAPÇALERA: TÍTOL I BOTÓ DE TANCAMENT
            ========================================================= */}
        <div className="relative z-10 flex items-center justify-between pb-3.5 border-b border-white/10 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-sky-500/10 border border-sky-500/30 shadow-[0_0_15px_rgba(56,189,248,0.2)]">
              <Network className="w-5 h-5 text-sky-400 animate-pulse" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-black tracking-widest uppercase text-transparent bg-clip-text bg-gradient-to-r from-white via-sky-200 to-white bg-[length:200%_auto] animate-[title-shimmer_4s_linear_infinite]">
                {dict.diagTitle}
              </h3>
              <p className="text-[10px] text-sky-400/80 font-mono hidden xs:block uppercase tracking-wider">
                {dict.subtitle}
              </p>
            </div>
          </div>
          <button 
            type="button" 
            onClick={onClose}
            title="Tanca (ESC)"
            className="p-2 rounded-full hover:bg-white/10 text-slate-400 hover:text-white transition-colors cursor-pointer bg-white/5 border border-white/10"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* =========================================================
            INTRODUCCIÓ PEDAGÒGICA
            ========================================================= */}
        <div className="relative z-10 p-3.5 rounded-2xl bg-white/5 border border-white/10 flex items-start gap-3 shrink-0 backdrop-blur-sm">
          <Layers className="w-5 h-5 text-sky-400 shrink-0 mt-0.5" />
          <p className="text-slate-300 leading-relaxed text-xs sm:text-sm">
            {dict.pedagogicIntro}
          </p>
        </div>

        {/* =========================================================
            EL PIPELINE INFOGRÀFIC ANIMAT
            ========================================================= */}
        <div className="flex flex-col gap-3 relative z-10 mt-1">
          
          {/* LÍNIA DATA-FLOW LÀSER: Connecta els 3 passos */}
          <div className="absolute left-6 sm:left-8 top-8 bottom-8 w-[2px] bg-slate-800/50 z-0 hidden xs:block overflow-hidden rounded-full">
            <div className="w-full h-[25%] bg-gradient-to-b from-transparent via-sky-400 to-transparent animate-[data-flow_2.5s_ease-in-out_infinite]"></div>
          </div>

          {/* --- PAS 1: CONSORCI GLOBAL (Amb animació de Globus) --- */}
          <div className="relative z-10 flex flex-col xs:flex-row items-stretch xs:items-center gap-3 sm:gap-4 p-4 rounded-2xl glass-panel border-sky-500/30 bg-sky-950/30 overflow-hidden group hover:border-sky-400/60 hover:-translate-y-0.5 hover:shadow-[0_10px_30px_rgba(56,189,248,0.15)] transition-all duration-300">
            <div className="absolute -right-10 -top-10 w-40 h-40 border border-sky-500/10 rounded-full grid-coarse animate-[globe-spin_30s_linear_infinite] opacity-30 pointer-events-none"></div>
            
            <div className="flex xs:flex-col items-center justify-between xs:justify-center gap-2 shrink-0 z-10 xs:w-16">
              <div className="w-10 h-10 rounded-xl bg-sky-500/20 border border-sky-400/40 flex items-center justify-center shadow-[0_0_15px_rgba(56,189,248,0.2)]">
                <Globe className="w-5 h-5 text-sky-300 group-hover:rotate-12 transition-transform duration-500" />
              </div>
              <span className="text-[9px] font-mono font-bold px-2 py-0.5 rounded bg-sky-500/20 text-sky-300 uppercase shadow-[0_0_10px_rgba(56,189,248,0.2)]">
                {dict.step1Title}
              </span>
            </div>

            <div className="flex-1 z-10 flex flex-col gap-1.5">
              <div className="flex items-center justify-between flex-wrap gap-1">
                <h4 className="text-xs sm:text-sm font-bold text-white tracking-wide flex items-center gap-1.5 drop-shadow-md">
                  <span>{dict.step1Header}</span>
                  <span className="text-[9px] sm:text-[10px] text-sky-400 font-mono bg-sky-500/10 px-1.5 py-0.5 rounded border border-sky-500/20">{dict.step1Badge}</span>
                </h4>
              </div>

              <div className="flex flex-wrap gap-1 my-0.5">
                {globalModels.map((m, idx) => (
                  <span key={idx} className="text-[8px] sm:text-[9px] font-mono bg-black/60 text-slate-300 px-2 py-0.5 rounded border border-white/10 hover:border-sky-500/50 hover:text-sky-300 transition-colors cursor-default">
                    {m}
                  </span>
                ))}
              </div>

              <p className="text-[11px] sm:text-xs text-slate-300 leading-normal">
                {dict.step1Desc}
              </p>
              
              <div className="mt-1 pt-2 border-t border-white/10 flex items-center justify-between font-mono text-[10px] sm:text-[11px]">
                <span className="text-slate-400">{dict.step1WindLabel}</span>
                <span className="font-bold text-sky-300 bg-sky-950/80 px-2.5 py-0.5 rounded border border-sky-500/30">{wrfWindFormatted}</span>
              </div>
            </div>
          </div>

          <div className="flex justify-center -my-2.5 z-10 relative">
            <div className="w-6 h-6 rounded-full bg-[#030712] border border-sky-500/30 flex items-center justify-center text-sky-400/70 shadow-[0_0_10px_rgba(56,189,248,0.1)] backdrop-blur-md">
              <ArrowDown className="w-3.5 h-3.5" />
            </div>
          </div>

          {/* --- PAS 2: MODEL ALTA RESOLUCIÓ (Amb escombrat de Radar CSS) --- */}
          <div className="relative z-10 flex flex-col xs:flex-row items-stretch xs:items-center gap-3 sm:gap-4 p-4 rounded-2xl glass-panel border-emerald-500/30 bg-emerald-950/30 overflow-hidden group hover:border-emerald-400/60 hover:-translate-y-0.5 hover:shadow-[0_10px_30px_rgba(52,211,153,0.15)] transition-all duration-300">
            <div className="absolute inset-0 opacity-10 pointer-events-none">
              <div className="absolute top-1/2 right-[10%] w-48 h-48 -translate-y-1/2 translate-x-1/2 rounded-full bg-[conic-gradient(from_0deg,transparent_70%,rgba(52,211,153,1)_100%)] animate-[radar-scan_4s_linear_infinite]"></div>
              <div className="absolute top-1/2 right-[10%] w-48 h-48 -translate-y-1/2 translate-x-1/2 border border-emerald-500/30 rounded-full"></div>
            </div>
            
            <div className="flex xs:flex-col items-center justify-between xs:justify-center gap-2 shrink-0 z-10 xs:w-16">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center shadow-[0_0_15px_rgba(52,211,153,0.2)]">
                <Radar className="w-5 h-5 text-emerald-300 group-hover:scale-110 transition-transform duration-300" />
              </div>
              <span className="text-[9px] font-mono font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 uppercase shadow-[0_0_10px_rgba(52,211,153,0.2)]">
                {dict.step2Title}
              </span>
            </div>

            <div className="flex-1 z-10 flex flex-col gap-1.5">
              <div className="flex items-center justify-between mb-0.5 flex-wrap gap-1">
                <h4 className="text-xs sm:text-sm font-bold text-white tracking-wide drop-shadow-md">
                  {dict.step2Header}
                </h4>
                <span className="text-[9px] sm:text-[10px] font-mono bg-emerald-950/80 px-2 py-0.5 rounded text-emerald-300 border border-emerald-500/30">
                  {dict.step2Badge}
                </span>
              </div>
              
              <p className="text-[11px] sm:text-xs text-slate-300 leading-normal">
                {dict.step2Desc}
              </p>

              <div className="p-2 rounded-lg bg-black/60 border border-emerald-500/30 flex items-start gap-2 my-0.5 shadow-inner">
                <MapPin className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5 animate-bounce" />
                <div className="text-[10px] text-slate-300 leading-tight">
                  <span className="text-emerald-300 font-bold">{dict.step2CoverageTitle}</span> {dict.step2CoverageText}
                  <span className="block text-[8px] sm:text-[9px] text-slate-400 mt-0.5">
                    {dict.step2CoverageNote}
                  </span>
                </div>
              </div>
              
              <div className="mt-1 pt-2 border-t border-white/10 flex items-center justify-between font-mono text-[10px] sm:text-[11px]">
                <span className="text-slate-400">{dict.step2WindLabel}</span>
                <span className="font-bold text-emerald-300 bg-emerald-950/80 px-2.5 py-0.5 rounded border border-emerald-500/30">{aromeWindFormatted}</span>
              </div>
            </div>
          </div>

          <div className="flex justify-center -my-2.5 z-10 relative">
            <div className="w-6 h-6 rounded-full bg-[#030712] border border-emerald-500/30 flex items-center justify-center text-emerald-400/70 shadow-[0_0_10px_rgba(52,211,153,0.1)] backdrop-blur-md">
              <ArrowDown className="w-3.5 h-3.5" />
            </div>
          </div>

          {/* --- PAS 3: ANÀLISI IA (Nucli Quàntic Pulsant) --- */}
          <div className="relative z-10 flex flex-col xs:flex-row items-stretch xs:items-center gap-3 sm:gap-4 p-4 rounded-2xl glass-panel border-indigo-500/40 bg-gradient-to-r from-indigo-950/50 via-purple-950/30 to-[#030712] overflow-hidden group hover:border-indigo-400/70 hover:-translate-y-0.5 hover:shadow-[0_15px_40px_rgba(99,102,241,0.2)] transition-all duration-300">
            <div className="absolute right-0 top-1/2 -translate-y-1/2 w-48 h-48 bg-indigo-500/15 rounded-full blur-[40px] pointer-events-none animate-[pulse_4s_ease-in-out_infinite]"></div>
            <div className="absolute right-10 top-1/2 -translate-y-1/2 w-24 h-24 bg-purple-500/20 rounded-full blur-[30px] pointer-events-none animate-[pulse_3s_ease-in-out_infinite_reverse]"></div>

            <div className="flex xs:flex-col items-center justify-between xs:justify-center gap-2 shrink-0 z-10 xs:w-16">
              <div className="w-10 h-10 rounded-xl bg-indigo-500/20 border border-indigo-400/40 flex items-center justify-center shadow-[0_0_20px_rgba(129,140,248,0.4)]">
                <Cpu className="w-5 h-5 text-indigo-300 animate-pulse" />
              </div>
              <span className="text-[9px] font-mono font-bold px-2 py-0.5 rounded bg-indigo-500/30 text-indigo-300 uppercase shadow-[0_0_10px_rgba(99,102,241,0.3)]">
                {dict.step3Title}
              </span>
            </div>

            <div className="flex-1 z-10 flex flex-col gap-1">
              <div className="flex items-center justify-between mb-0.5">
                <h4 className="text-xs sm:text-sm font-bold text-white tracking-wide flex items-center gap-1.5 drop-shadow-md">
                  <span>{dict.step3Header}</span>
                  <span className="bg-indigo-500 text-white text-[8px] sm:text-[9px] px-1.5 py-0.5 rounded font-mono font-bold shadow-[0_0_10px_rgba(99,102,241,0.6)]">IA ENGINE</span>
                </h4>
              </div>
              <p className="text-[11px] sm:text-xs text-slate-300 leading-normal">
                {dict.aiFooter}
              </p>
            </div>
          </div>

        </div>

        {/* =========================================================
            DISCLAIMER CIENTÍFIC (Honestedat i Probabilitat)
            ========================================================= */}
        <div className="relative z-10 p-3.5 rounded-xl bg-slate-900/80 border border-white/10 flex items-center gap-3 shrink-0 text-slate-300 text-[11px] leading-relaxed shadow-inner">
          <Info className="w-5 h-5 text-sky-400 shrink-0" />
          <div>
            <span className="font-bold text-white">{dict.transparencyTitle}</span> {dict.transparencyText}
          </div>
        </div>

        {/* =========================================================
            ESTAT DEL RECEPTOR EN STANDBY
            ========================================================= */}
        <div className="relative z-10 flex items-center justify-between p-3 rounded-xl bg-black/80 border border-sky-500/20 font-mono shrink-0 shadow-[0_0_15px_rgba(56,189,248,0.05)]">
          <div className="flex items-center gap-2 text-sky-300 font-bold text-[10px] sm:text-xs">
            <Radio className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-sky-400 shrink-0 animate-pulse" />
            <span>{dict.aligned}</span>
          </div>
          <span className="text-[9px] sm:text-[11px] text-sky-300 font-bold bg-sky-500/10 px-2 sm:px-2.5 py-1 rounded border border-sky-500/20 flex items-center gap-1.5">
            <Compass className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-sky-400 animate-[spin_10s_linear_infinite]" />
            <span>{dict.standbyReceiver}</span>
          </span>
        </div>

        {/* =========================================================
            BOTÓ DE TANCAMENT
            ========================================================= */}
        <button
          type="button"
          onClick={onClose}
          className="relative z-10 w-full py-3.5 sm:py-4 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white font-black tracking-widest uppercase text-xs transition-all shadow-[0_0_25px_rgba(56,189,248,0.4)] hover:shadow-[0_0_35px_rgba(56,189,248,0.6)] cursor-pointer flex items-center justify-center gap-2 shrink-0 active:scale-[0.98]"
        >
          <span>{dict.closeModal}</span>
          <span className="hidden sm:inline-block text-[9px] sm:text-[10px] bg-black/30 px-2 py-0.5 rounded text-sky-100 border border-white/10">ESC</span>
        </button>

      </div>
    </div>
  );
}