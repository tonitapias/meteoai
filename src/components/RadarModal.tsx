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
  
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  // Tancament tàctic mitjançant la tecla Escape o botó enrere del mòbil
  const handleTacticalClose = useCallback(() => {
    if (window.history.state?.modalId === 'radarLive') {
      window.history.back();
    } else {
      onCloseRef.current();
    }
  }, []);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    window.history.pushState({ modalId: 'radarLive' }, '');

    const handlePopState = () => onCloseRef.current();
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleTacticalClose();
    };
    
    window.addEventListener('popstate', handlePopState);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('popstate', handlePopState);
      window.removeEventListener('keydown', handleKeyDown);
      if (window.history.state?.modalId === 'radarLive') {
        window.history.back();
      }
    };
  }, [handleTacticalClose]);

  const isRadar = activeView === 'radar';
  const MATRIX_BG = `absolute inset-0 z-0 opacity-[0.03] pointer-events-none bg-[linear-gradient(to_right,#ffffff_1px,transparent_1px),linear-gradient(to_bottom,#ffffff_1px,transparent_1px)] bg-[size:12px_12px]`;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-0 sm:p-4 md:p-6 bg-[#02040A]/90 backdrop-blur-2xl animate-in fade-in duration-200 select-none">
      <div className="w-full h-full sm:h-[88dvh] max-w-6xl flex flex-col bg-gradient-to-br from-[#0f111a] to-[#05060a] sm:rounded-3xl border-0 sm:border border-white/15 shadow-[0_0_50px_rgba(0,0,0,0.85)] overflow-hidden relative">
        <div className={MATRIX_BG}></div>
        <div className={`absolute top-0 left-1/2 -translate-x-1/2 w-3/4 h-24 bg-gradient-to-b ${isRadar ? 'from-cyan-500/15' : 'from-emerald-500/15'} to-transparent blur-3xl pointer-events-none transition-colors duration-500`}></div>

        <header className="px-5 py-4 border-b border-white/15 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shrink-0 z-20 bg-[#050810]/75 backdrop-blur-md relative">
          <div className="flex items-center gap-3">
            <div className={`flex items-center justify-center w-11 h-11 rounded-xl border transition-colors duration-300 ${isRadar ? 'bg-cyan-950/50 border-cyan-500/50 text-cyan-300 shadow-[0_0_15px_rgba(6,182,212,0.2)]' : 'bg-emerald-950/50 border-emerald-500/50 text-emerald-300 shadow-[0_0_15px_rgba(16,185,129,0.2)]'}`}>
              {isRadar ? <CloudRain className="w-6 h-6" /> : <Wind className="w-6 h-6" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-black text-white tracking-tight uppercase drop-shadow">
                  {isRadar ? t('radarTitle') : t('windTitle')}
                </h3>
                <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase tracking-widest border transition-colors duration-300 ${isRadar ? 'bg-cyan-500/15 text-cyan-300 border-cyan-500/40' : 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40'}`}>
                  <span className={`w-1.5 h-1.5 rounded-full animate-pulse ${isRadar ? 'bg-cyan-400' : 'bg-emerald-400'}`}></span>
                  {t('liveBadge')}
                </span>
              </div>
              <p className="text-xs text-slate-300 flex items-center gap-1.5 mt-0.5 font-mono">
                <Radio className="w-3.5 h-3.5 text-slate-400 animate-pulse" />
                {isRadar ? t('dopplerSubtitle') : t('matrixSubtitle')}
              </p>
            </div>
          </div>
          
          <div className="flex items-center justify-between w-full sm:w-auto gap-3 z-20">
            <div className="flex p-1 bg-black/70 border border-white/15 rounded-xl w-full sm:w-auto">
              <button 
                type="button"
                onClick={() => setActiveView('radar')}
                className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all active:scale-95 ${activeView === 'radar' ? 'bg-cyan-500/25 text-cyan-200 border border-cyan-500/50 shadow-md font-black' : 'text-slate-300 hover:text-white hover:bg-white/10'}`}
              >
                <CloudRain className="w-4 h-4" /> 
                {t('btnRadar')}
              </button>
              <button 
                type="button"
                onClick={() => setActiveView('wind')}
                className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all active:scale-95 ${activeView === 'wind' ? 'bg-emerald-500/25 text-emerald-200 border border-emerald-500/50 shadow-md font-black' : 'text-slate-300 hover:text-white hover:bg-white/10'}`}
              >
                <Wind className="w-4 h-4" /> 
                {t('btnWind')} 
              </button>
            </div>

            <button 
              type="button"
              onClick={handleTacticalClose}
              className="p-2.5 bg-white/10 border border-white/15 rounded-full text-slate-200 hover:bg-white/20 hover:text-white active:scale-95 transition-all shrink-0 shadow-lg"
              aria-label={t('closeWindow')}
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </header>

        <div className="flex-1 min-h-0 relative w-full h-full bg-[#020308] z-10 overflow-hidden">
          {/* Muntatge condicional per evitar duplicar instàncies WebGL a la memòria de navegadors mòbils */}
          {isRadar ? (
            <RadarMap lat={lat} lon={lon} isActive={true} activeView={activeView} />
          ) : (
            <WindMap lat={lat} lon={lon} /> 
          )}
        </div>
      </div>
    </div>
  );
}