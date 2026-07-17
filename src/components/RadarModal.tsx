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
  
  // Sincronitzem la referència del callback per evitar dependències obsoletes
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  // Risc Zero: Tancament Tàctic Protegit
  const handleTacticalClose = useCallback(() => {
    if (window.history.state?.modalId === 'radarLive') {
      window.history.back();
    } else {
      onCloseRef.current();
    }
  }, []);

  // Risc Zero: Cicle de vida de la History API
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    
    window.history.pushState({ modalId: 'radarLive' }, '');

    const handlePopState = () => {
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
      
      if (window.history.state?.modalId === 'radarLive') {
        window.history.go(-1);
      }
    };
  }, [handleTacticalClose]);

  const isRadar = activeView === 'radar';
  
  const MATRIX_BG = `absolute inset-0 z-0 opacity-[0.03] pointer-events-none bg-[linear-gradient(to_right,#ffffff_1px,transparent_1px),linear-gradient(to_bottom,#ffffff_1px,transparent_1px)] bg-[size:12px_12px]`;

  return (
    <div className="fixed inset-0 z-[100] flex flex-col sm:p-4 md:p-6 lg:p-8 bg-[#020308]/95 sm:bg-[#020308]/85 backdrop-blur-xl sm:backdrop-blur-2xl animate-in fade-in duration-300 select-none">
      
      {/* Contenidor Principal */}
      <div className="w-full h-[100dvh] sm:h-full max-w-7xl mx-auto flex flex-col bg-[#020308] sm:bg-gradient-to-br from-[#0a0d16] to-[#040508] sm:rounded-[2rem] border-0 sm:border border-white/15 shadow-[0_0_80px_rgba(0,0,0,0.9)] relative overflow-hidden">
        
        {/* Reflexos Tàctics (Només Desktop) */}
        <div className="hidden sm:block">
          <div className={MATRIX_BG}></div>
          <div className={`absolute top-0 left-1/2 -translate-x-1/2 w-3/4 h-32 bg-gradient-to-b ${isRadar ? 'from-cyan-500/15' : 'from-emerald-500/15'} to-transparent blur-3xl pointer-events-none transition-colors duration-700`}></div>
        </div>

        {/* =========================================
            HUD UNIFICAT (Capçalera Sòlida)
            ========================================= */}
        <header className="px-4 py-4 pt-safe sm:px-6 sm:py-5 border-b border-white/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shrink-0 z-30 bg-[#050810]/80 backdrop-blur-md relative">
          
          {/* Fila superior a mòbil / Esquerra a PC */}
          <div className="flex items-center justify-between w-full sm:w-auto">
            <div className="flex items-center gap-3 sm:gap-4">
              <div className={`flex items-center justify-center w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl border transition-all duration-500 ${isRadar ? 'bg-cyan-950/40 border-cyan-500/50 text-cyan-300 shadow-[inset_0_0_20px_rgba(6,182,212,0.1),0_0_15px_rgba(6,182,212,0.2)]' : 'bg-emerald-950/40 border-emerald-500/50 text-emerald-300 shadow-[inset_0_0_20px_rgba(16,185,129,0.1),0_0_15px_rgba(16,185,129,0.2)]'}`}>
                {isRadar ? <CloudRain className="w-5 h-5 sm:w-6 sm:h-6" /> : <Wind className="w-5 h-5 sm:w-6 sm:h-6" />}
              </div>
              <div>
                <div className="flex items-center gap-2.5">
                  <h3 className="text-base sm:text-xl font-black text-white tracking-tight uppercase drop-shadow-md">
                    {isRadar ? t('radarTitle') : t('windTitle')}
                  </h3>
                  <span className={`inline-flex items-center gap-1 sm:gap-1.5 px-1.5 py-0.5 sm:px-2 rounded text-[9px] sm:text-[10px] font-mono font-bold uppercase tracking-widest border transition-colors duration-500 ${isRadar ? 'bg-cyan-500/15 text-cyan-300 border-cyan-500/40' : 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40'}`}>
                    <span className={`w-1 h-1 sm:w-1.5 sm:h-1.5 rounded-full animate-pulse ${isRadar ? 'bg-cyan-400' : 'bg-emerald-400'}`}></span>
                    {t('liveBadge')}
                  </span>
                </div>
                <p className="text-[10px] sm:text-xs text-slate-400 flex items-center gap-1.5 mt-0.5 sm:mt-1 font-mono tracking-wide">
                  <Radio className={`w-3 h-3 sm:w-3.5 sm:h-3.5 animate-pulse ${isRadar ? 'text-cyan-500/70' : 'text-emerald-500/70'}`} />
                  {isRadar ? t('dopplerSubtitle') : t('matrixSubtitle')}
                </p>
              </div>
            </div>

            {/* Botó Tancar - NOMÉS MÒBIL */}
            <button 
              type="button"
              onClick={handleTacticalClose}
              className="sm:hidden p-2.5 bg-white/5 border border-white/10 rounded-xl text-slate-300 active:bg-rose-500/20 active:border-rose-500/40 active:text-rose-400 transition-all shadow-md shrink-0"
              aria-label={t('closeWindow')}
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          
          {/* Fila inferior a mòbil / Dreta a PC */}
          <div className="flex items-center justify-between w-full sm:w-auto gap-4 sm:ml-auto">
            {/* Control Segmentat */}
            <div className="flex w-full sm:w-auto p-1 bg-black/60 border border-white/10 rounded-xl sm:rounded-2xl shadow-inner">
              <button 
                type="button"
                onClick={() => setActiveView('radar')}
                className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-3 py-2.5 sm:px-5 sm:py-2.5 rounded-lg sm:rounded-xl text-[10px] sm:text-[11px] font-black uppercase tracking-widest transition-all duration-300 ${isRadar ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/50 shadow-[0_0_15px_rgba(6,182,212,0.15)]' : 'text-slate-400 hover:text-white border border-transparent hover:bg-white/5'}`}
              >
                <CloudRain className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> {t('btnRadar')}
              </button>
              <button 
                type="button"
                onClick={() => setActiveView('wind')}
                className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-3 py-2.5 sm:px-5 sm:py-2.5 rounded-lg sm:rounded-xl text-[10px] sm:text-[11px] font-black uppercase tracking-widest transition-all duration-300 ${!isRadar ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/50 shadow-[0_0_15px_rgba(16,185,129,0.15)]' : 'text-slate-400 hover:text-white border border-transparent hover:bg-white/5'}`}
              >
                <Wind className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> {t('btnWind')} 
              </button>
            </div>

            {/* Botó Tancar - NOMÉS PC */}
            <button 
              type="button"
              onClick={handleTacticalClose}
              className="hidden sm:flex p-3 bg-white/5 border border-white/10 rounded-2xl text-slate-300 hover:bg-rose-500/20 hover:border-rose-500/40 hover:text-rose-400 active:scale-95 transition-all shadow-lg group"
              aria-label={t('closeWindow')}
            >
              <X className="w-5 h-5 group-hover:scale-110 transition-transform" />
            </button>
          </div>
        </header>

        {/* =========================================
            NUCLI DE RENDERITZAT
            ========================================= */}
        {/* En ser un contenidor relatiu amb flex-1, el mapa respectarà l'alçada de la capçalera 
            i els controls top-left de Mapbox sortiran just a sota de la línia de separació. */}
        <div className="flex-1 min-h-0 w-full relative z-10 bg-[#020308]">
          
          <div className={`absolute inset-0 transition-opacity duration-700 ease-in-out ${isRadar ? 'opacity-100 z-20' : 'opacity-0 pointer-events-none z-0'}`}>
             <RadarMap lat={lat} lon={lon} isActive={isRadar} activeView={activeView} />
          </div>

          <div className={`absolute inset-0 transition-opacity duration-700 ease-in-out ${!isRadar ? 'opacity-100 z-20' : 'opacity-0 pointer-events-none z-0'}`}>
             <WindMap lat={lat} lon={lon} />
          </div>
          
        </div>

      </div>
    </div>
  );
}