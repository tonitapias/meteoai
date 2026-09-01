// RadarModal.tsx
import { useState, useEffect, useCallback, useRef } from 'react';
import { X, CloudRain, Wind, Radio } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import RadarMap from './RadarMap';
import WindMap from './WindMap';

interface RadarModalProps {
  lat: number;
  lon: number;
  onClose: () => void;
}

type MapView = 'radar' | 'wind';

export default function RadarModal({ lat, lon, onClose }: RadarModalProps) {
  const { t } = useTranslation();
  
  const [activeView, setActiveView] = useState<MapView>('radar');
  const onCloseRef = useRef(onClose);

  const [showLayerMenu, setShowLayerMenu] = useState(false);
  const layerMenuHistoryPushedRef = useRef(false);
  
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  const handleTacticalClose = useCallback(() => {
    if (window.history.state?.modalId === 'radarLive') {
      window.history.back();
    } else {
      onCloseRef.current();
    }
  }, []);

  const handleFullClose = useCallback(() => {
    if (window.history.state?.modalId === 'radarLive') {
      window.history.go(layerMenuHistoryPushedRef.current ? -2 : -1);
      layerMenuHistoryPushedRef.current = false;
    } else {
      onCloseRef.current();
    }
  }, []);

  // Risc Zero: Cicle de vida de la History API.
  // El pushState és idempotent (només l'apliquem si encara no hi som) perquè
  // React.StrictMode munta aquest efecte, el desmunta i el torna a muntar de
  // seguida en dev. Un cleanup que fes `history.go(-1)` aquí acabava sent una
  // crida asíncrona que es resolia DESPRÉS del segon muntatge, corrompent la
  // pila real (popstate fantasma amb state:null just en obrir el modal). Per
  // això el cleanup ja NO toca l'historial: totes les vies reals de tancament
  // (Esc/enrere via handleTacticalClose, botó X via handleFullClose) ja fan
  // la seva pròpia navegació ABANS de cridar onClose, així que quan aquest
  // efecte es desmunta de veritat l'historial ja és correcte.
  useEffect(() => {
    document.body.style.overflow = 'hidden';

    if (window.history.state?.modalId !== 'radarLive') {
      window.history.pushState({ modalId: 'radarLive' }, '');
    }

    const handlePopState = (e: PopStateEvent) => {
      const state = e.state as { modalId?: string; layerMenu?: boolean } | null;

      if (state?.modalId === 'radarLive' && state?.layerMenu) {
        layerMenuHistoryPushedRef.current = true;
        setShowLayerMenu(true);
        return;
      }

      if (state?.modalId === 'radarLive') {
        layerMenuHistoryPushedRef.current = false;
        setShowLayerMenu(false);
        return;
      }

      onCloseRef.current();
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleTacticalClose();
    };
    
    window.addEventListener('popstate', handlePopState);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('popstate', handlePopState);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleTacticalClose]);

  useEffect(() => {
    if (showLayerMenu) {
      window.history.pushState({ modalId: 'radarLive', layerMenu: true }, '');
      layerMenuHistoryPushedRef.current = true;
    } else if (layerMenuHistoryPushedRef.current) {
      if (window.history.state?.layerMenu) {
        window.history.back();
      }
      layerMenuHistoryPushedRef.current = false;
    }
  }, [showLayerMenu]);

  const isRadar = activeView === 'radar';
  
  const MATRIX_BG = `absolute inset-0 z-0 opacity-[0.04] pointer-events-none bg-[linear-gradient(to_right,#ffffff_1px,transparent_1px),linear-gradient(to_bottom,#ffffff_1px,transparent_1px)] bg-[size:16px_16px]`;

  return (
    <div className="fixed inset-0 z-[100] flex flex-col sm:p-4 md:p-6 lg:p-8 bg-[#020308]/95 sm:bg-[#020308]/85 backdrop-blur-2xl animate-in fade-in duration-300 select-none [transform:translateZ(0)]">
      
      <div className="w-full h-[100dvh] sm:h-full max-w-7xl mx-auto flex flex-col bg-[#020308] sm:bg-[#050810] sm:rounded-[2rem] border-0 sm:border border-white/10 shadow-[0_0_80px_rgba(0,0,0,0.95)] relative overflow-hidden ring-1 ring-white/5">
        
        <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden">
          <div className={MATRIX_BG}></div>
          <div className={`absolute -top-32 left-1/2 -translate-x-1/2 w-[150%] sm:w-3/4 h-64 bg-gradient-to-b ${isRadar ? 'from-cyan-500/20' : 'from-emerald-500/20'} to-transparent blur-[80px] transition-colors duration-700`}></div>
        </div>

        <header className="px-4 py-3 pt-[max(env(safe-area-inset-top,12px),12px)] sm:px-6 sm:py-5 border-b border-white/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shrink-0 z-30 bg-[#050810]/70 backdrop-blur-xl relative shadow-[0_4px_32px_rgba(0,0,0,0.5)]">
          
          <div className="flex items-center justify-between w-full sm:w-auto min-w-0 gap-2">
            <div className="flex items-center gap-3 sm:gap-4 min-w-0 w-full">
              <div className={`shrink-0 flex items-center justify-center w-11 h-11 sm:w-14 sm:h-14 rounded-xl sm:rounded-2xl border transition-all duration-500 ${isRadar ? 'bg-cyan-950/40 border-cyan-500/50 text-cyan-300 shadow-[inset_0_0_20px_rgba(6,182,212,0.1),0_0_15px_rgba(6,182,212,0.2)]' : 'bg-emerald-950/40 border-emerald-500/50 text-emerald-300 shadow-[inset_0_0_20px_rgba(16,185,129,0.1),0_0_15px_rgba(16,185,129,0.2)]'}`}>
                {isRadar ? <CloudRain className="w-5 h-5 sm:w-7 sm:h-7 drop-shadow-md" /> : <Wind className="w-5 h-5 sm:w-7 sm:h-7 drop-shadow-md" />}
              </div>
              
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2.5">
                  <h3 className="text-lg sm:text-2xl font-black text-white tracking-tight uppercase drop-shadow-lg truncate">
                    {isRadar ? t('radarTitle') : t('windTitle')}
                  </h3>
                  <span className={`shrink-0 whitespace-nowrap inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[9px] sm:text-[10px] font-mono font-bold uppercase tracking-widest border transition-colors duration-500 shadow-sm ${isRadar ? 'bg-cyan-500/15 text-cyan-300 border-cyan-500/40' : 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40'}`}>
                    <span className={`w-1.5 h-1.5 rounded-full animate-pulse ${isRadar ? 'bg-cyan-400 shadow-[0_0_8px_rgba(6,182,212,1)]' : 'bg-emerald-400 shadow-[0_0_8px_rgba(16,185,129,1)]'}`}></span>
                    {t('liveBadge')}
                  </span>
                </div>
                <p className="text-[11px] sm:text-sm text-slate-400 flex items-center gap-1.5 mt-0.5 font-mono tracking-wide truncate">
                  <Radio className={`shrink-0 w-3.5 h-3.5 sm:w-4 sm:h-4 animate-pulse ${isRadar ? 'text-cyan-500/70' : 'text-emerald-500/70'}`} />
                  <span className="truncate">{isRadar ? t('dopplerSubtitle') : t('matrixSubtitle')}</span>
                </p>
              </div>
            </div>

            <button 
              type="button"
              onClick={handleFullClose}
              className="sm:hidden shrink-0 p-3 bg-black/40 border border-white/15 rounded-xl text-slate-200 active:bg-rose-500/20 active:border-rose-500/50 active:text-rose-400 transition-all shadow-[0_4px_12px_rgba(0,0,0,0.5)] backdrop-blur-md"
              aria-label={t('closeWindow')}
            >
              <X className="w-6 h-6" />
            </button>
          </div>
          
          <div className="flex items-center justify-between w-full sm:w-auto gap-4 sm:ml-auto">
            <div className="flex w-full sm:w-auto p-1 bg-black/60 border border-white/10 rounded-xl sm:rounded-2xl shadow-[inset_0_2px_8px_rgba(0,0,0,0.8)]">
              <button 
                type="button"
                onClick={() => setActiveView('radar')}
                className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-3 sm:px-6 sm:py-3 rounded-lg sm:rounded-xl text-[11px] sm:text-xs font-black uppercase tracking-widest transition-all duration-300 whitespace-nowrap ${isRadar ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/50 shadow-[0_0_20px_rgba(6,182,212,0.2)]' : 'text-slate-400 hover:text-white border border-transparent hover:bg-white/5'}`}
              >
                <CloudRain className="w-4 h-4 sm:w-4 sm:h-4" /> {t('btnRadar')}
              </button>
              <button 
                type="button"
                onClick={() => setActiveView('wind')}
                className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-3 sm:px-6 sm:py-3 rounded-lg sm:rounded-xl text-[11px] sm:text-xs font-black uppercase tracking-widest transition-all duration-300 whitespace-nowrap ${!isRadar ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/50 shadow-[0_0_20px_rgba(16,185,129,0.2)]' : 'text-slate-400 hover:text-white border border-transparent hover:bg-white/5'}`}
              >
                <Wind className="w-4 h-4 sm:w-4 sm:h-4" /> {t('btnWind')} 
              </button>
            </div>

            <button 
              type="button"
              onClick={handleFullClose}
              className="hidden sm:flex shrink-0 p-3.5 bg-black/40 border border-white/15 rounded-2xl text-slate-200 hover:bg-rose-500/20 hover:border-rose-500/50 hover:text-rose-400 active:scale-95 transition-all shadow-[0_8px_24px_rgba(0,0,0,0.6)] backdrop-blur-md group"
              aria-label={t('closeWindow')}
            >
              <X className="w-5 h-5 group-hover:scale-110 transition-transform" />
            </button>
          </div>
        </header>

        <div className="flex-1 min-h-0 w-full relative z-10 bg-[#020308]">
          
          <div className={`absolute inset-0 transition-opacity duration-700 ease-in-out ${isRadar ? 'opacity-100 z-20 pointer-events-auto' : 'opacity-0 pointer-events-none z-0'}`}>
             <RadarMap
               lat={lat}
               lon={lon}
               isActive={isRadar}
               showLayerMenu={showLayerMenu}
               setShowLayerMenu={setShowLayerMenu}
             />
          </div>

          <div className={`absolute inset-0 transition-opacity duration-700 ease-in-out ${!isRadar ? 'opacity-100 z-20 pointer-events-auto' : 'opacity-0 pointer-events-none z-0'}`}>
             <WindMap lat={lat} lon={lon} />
          </div>
          
        </div>

      </div>
    </div>
  );
}