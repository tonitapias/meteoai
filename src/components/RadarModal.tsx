// src/components/RadarModal.tsx
import { useState, useEffect, useCallback, useRef } from 'react';
import { X, CloudRain, Wind, Radio } from 'lucide-react';
import { TRANSLATIONS, Language } from '../translations';
import RadarMap from './RadarMap';
import WindMap from './WindMap';

interface RadarModalProps {
  lat: number;
  lon: number;
  onClose: () => void;
  lang?: Language;
}

type MapView = 'radar' | 'wind';

export default function RadarModal({ lat, lon, onClose, lang = 'ca' }: RadarModalProps) {
  const t = TRANSLATIONS[lang] || TRANSLATIONS['ca'];
  
  const [activeView, setActiveView] = useState<MapView>('radar');
  
  // Tàctica Anti-Tancament: Guardem onClose en una referència per evitar renderitzats innecessaris
  const onCloseRef = useRef(onClose);
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

  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, []);

  useEffect(() => {
    // Array buit: assegurem que el History API es configura exclusivament a l'inici
    window.history.pushState({ modalId: 'radarLive' }, '');

    const handlePopState = () => {
      onCloseRef.current();
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleTacticalClose();
      }
    };
    
    window.addEventListener('popstate', handlePopState);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('popstate', handlePopState);
      window.removeEventListener('keydown', handleKeyDown);
      if (window.history.state?.modalId === 'radarLive') {
        window.history.back();
      }
    };
  }, [handleTacticalClose]);

  const isRadar = activeView === 'radar';

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 md:p-6 landscape:p-0 landscape:sm:p-6 bg-[#02040A]/95 backdrop-blur-3xl backdrop-saturate-150 animate-in fade-in duration-200">
      
      {/* TÀCTICA DVH + LANDSCAPE + Flex i Min-H-0 per contenció de mapes mòbils */}
      <div className="w-full h-[96dvh] sm:h-[85dvh] landscape:h-[100dvh] landscape:sm:h-[85dvh] max-w-sm md:max-w-4xl lg:max-w-6xl flex flex-col min-h-0 bg-[#050810]/95 rounded-t-[24px] sm:rounded-[32px] landscape:rounded-none landscape:sm:rounded-[32px] border-t landscape:border-t-0 sm:border border-white/5 shadow-[0_0_80px_rgba(0,0,0,0.8),inset_0_1px_1px_rgba(255,255,255,0.05)] overflow-hidden transform-gpu translate-z-0 relative animate-in slide-in-from-bottom-8 sm:zoom-in-95 duration-300">
        
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.01)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.01)_1px,transparent_1px)] bg-[size:16px_16px] pointer-events-none mix-blend-screen opacity-30"></div>
        <div className={`absolute top-0 left-1/2 -translate-x-1/2 w-full h-32 bg-gradient-to-b ${isRadar ? 'from-cyan-900/10' : 'from-emerald-900/10'} to-transparent blur-[60px] pointer-events-none transition-colors duration-500`}></div>

        {/* TÀCTICA HUD HORITZONTAL */}
        <div className="bg-transparent border-b border-white/[0.04] p-3 sm:p-5 landscape:p-2 landscape:sm:p-5 flex flex-col sm:flex-row landscape:flex-row justify-between items-start sm:items-center landscape:items-center gap-3 sm:gap-4 shrink-0 relative z-20 backdrop-blur-xl">
          
          <div className="flex items-center gap-3">
             <div className={`relative flex items-center justify-center w-8 h-8 sm:w-10 sm:h-10 rounded-xl border transition-colors duration-300 ${isRadar ? 'bg-cyan-950/30 border-cyan-500/30 text-cyan-400 shadow-[inset_0_0_15px_rgba(6,182,212,0.2)]' : 'bg-emerald-950/30 border-emerald-500/30 text-emerald-400 shadow-[inset_0_0_15px_rgba(16,185,129,0.2)]'}`}>
                {isRadar ? <CloudRain className="w-4 h-4 sm:w-5 sm:h-5" /> : <Wind className="w-4 h-4 sm:w-5 sm:h-5" />}
             </div>
             
             <div className="flex flex-col">
                <div className="flex items-center gap-2">
                    <h3 className="text-base sm:text-lg md:text-xl font-black text-white tracking-tighter leading-none">
                        {isRadar ? t.radarTitle : (lang === 'ca' ? 'Mapa de Vent' : 'Wind Map')}
                    </h3>
                    <div className={`hidden landscape:flex sm:flex items-center gap-1.5 px-1.5 py-0.5 rounded uppercase font-black text-[8px] tracking-widest border ${isRadar ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30' : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'}`}>
                        <span className="relative flex h-1.5 w-1.5">
                            <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${isRadar ? 'bg-cyan-400' : 'bg-emerald-400'}`}></span>
                            <span className={`relative inline-flex rounded-full h-1.5 w-1.5 ${isRadar ? 'bg-cyan-500' : 'bg-emerald-500'}`}></span>
                        </span>
                        LIVE
                    </div>
                </div>
                <p className="hidden sm:flex landscape:hidden landscape:sm:flex text-[10px] md:text-xs text-slate-500 font-mono tracking-widest uppercase mt-1 items-center gap-1.5">
                   <Radio className="w-3 h-3" />
                   {isRadar ? 'DOPPLER RAINVIEWER' : 'GFS/ECMWF MATRIX'}
                </p>
             </div>
          </div>
          
          <div className="flex items-center justify-between w-full sm:w-auto landscape:w-auto gap-3 sm:gap-6">
            
            <div className="flex bg-[#020308] p-1 rounded-lg border border-white/5 shadow-[inset_0_2px_4px_rgba(0,0,0,0.5)]">
                <button 
                    onClick={() => setActiveView('radar')}
                    className={`flex items-center justify-center gap-1 sm:gap-2 px-3 sm:px-4 py-1.5 rounded-md text-[9px] sm:text-[10px] md:text-xs font-black uppercase tracking-widest transition-all duration-300 w-1/2 sm:w-auto ${activeView === 'radar' ? 'bg-[#0F172A] text-cyan-400 border border-white/5 shadow-sm' : 'text-slate-500 hover:text-slate-300 hover:bg-white/[0.02]'}`}
                >
                    <CloudRain className="w-3 h-3 sm:w-3.5 sm:h-3.5" /> Radar
                </button>
                <button 
                    onClick={() => setActiveView('wind')}
                    className={`flex items-center justify-center gap-1 sm:gap-2 px-3 sm:px-4 py-1.5 rounded-md text-[9px] sm:text-[10px] md:text-xs font-black uppercase tracking-widest transition-all duration-300 w-1/2 sm:w-auto ${activeView === 'wind' ? 'bg-[#0F172A] text-emerald-400 border border-white/5 shadow-sm' : 'text-slate-500 hover:text-slate-300 hover:bg-white/[0.02]'}`}
                >
                    <Wind className="w-3 h-3 sm:w-3.5 sm:h-3.5" /> Vent
                </button>
            </div>

            <button 
              onClick={handleTacticalClose}
              className="p-2 sm:p-2.5 bg-white/[0.03] border border-white/5 rounded-full text-slate-400 hover:bg-white/10 hover:text-white active:scale-90 transition-all duration-200 group relative shrink-0"
            >
              <X className="w-4 h-4 sm:w-5 sm:h-5 group-hover:rotate-90 transition-transform duration-300" />
              <span className="absolute -bottom-8 left-1/2 -translate-x-1/2 text-[10px] font-mono text-slate-500 opacity-0 group-hover:opacity-100 hidden md:block transition-opacity">ESC</span>
            </button>
          </div>
        </div>

        {/* L'ús de min-h-0 forçarà que els iframes i el mapa Leaflet no desbordin el grid del pare en l'eix Y en mòbils */}
        <div className="flex-1 min-h-0 relative bg-[#020308] w-full h-full overflow-hidden shadow-[inset_0_10px_20px_rgba(0,0,0,0.5)] z-10">
           {activeView === 'radar' ? (
               <RadarMap lat={lat} lon={lon} />
           ) : (
               <WindMap lat={lat} lon={lon} />
           )}
        </div>

      </div>
    </div>
  );
}