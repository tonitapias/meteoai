// src/components/WindMap.tsx
import { useState, useEffect } from 'react';
import { Wind, Activity, AlertTriangle, RefreshCw } from 'lucide-react';

interface WindMapProps {
  lat: number;
  lon: number;
}

export default function WindMap({ lat, lon }: WindMapProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  // DOCTRINA RISC ZERO: Blindatge estricte de coordenades
  const isValidCoords = typeof lat === 'number' && typeof lon === 'number' && !isNaN(lat) && !isNaN(lon);

  // Integrem el widget oficial de Windy configurat per vent (wind) i model ECMWF.
  const windyUrl = isValidCoords 
    ? `https://embed.windy.com/embed.html?type=map&location=coordinates&metricRain=mm&metricTemp=default&metricWind=km%2Fh&zoom=9&overlay=wind&product=ecmwf&level=surface&lat=${lat}&lon=${lon}`
    : '';

  // DOCTRINA RISC ZERO: Tallafocs per evitar pantalles de càrrega infinites
  useEffect(() => {
    if (!isLoading) return;
    
    const timeoutId = setTimeout(() => {
        if (isLoading) {
            console.warn("WindMap: Timeout de connexió amb Windy ECMWF");
            setHasError(true);
            setIsLoading(false);
        }
    }, 10000); // 10 segons de marge màxim per carregar

    return () => clearTimeout(timeoutId);
  }, [isLoading, retryCount]);

  const handleRetry = () => {
      setHasError(false);
      setIsLoading(true);
      setRetryCount(prev => prev + 1);
  };

  // SPATIAL UI BASE
  const MATRIX_BG = `absolute inset-0 z-0 opacity-[0.03] pointer-events-none bg-[linear-gradient(to_right,#ffffff_1px,transparent_1px),linear-gradient(to_bottom,#ffffff_1px,transparent_1px)] bg-[size:12px_12px]`;

  if (!isValidCoords) {
      return (
        <div className="w-full h-full min-h-0 bg-[#020308] relative overflow-hidden flex items-center justify-center">
            <div className="text-center z-10 flex flex-col items-center">
                <AlertTriangle className="w-8 h-8 text-rose-500 mb-2 drop-shadow-md" />
                <span className="text-slate-400 text-xs font-mono font-bold uppercase tracking-widest">Error de Coordenades</span>
            </div>
        </div>
      );
  }

  return (
    <div className="w-full h-full min-h-0 bg-[#020308] relative overflow-hidden flex items-center justify-center">
      
      {/* ESCUT D'ERROR TÀCTIC (Fail-Safe) */}
      {hasError && (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-gradient-to-br from-[#0f111a]/95 to-black/90 backdrop-blur-md">
             <div className={MATRIX_BG}></div>
             <div className="w-16 h-16 rounded-full bg-rose-950/40 border border-rose-500/30 shadow-[inset_0_1px_8px_rgba(244,63,94,0.3)] flex items-center justify-center mb-4 relative backdrop-blur-sm z-10">
                  <div className="absolute inset-0 rounded-full border border-rose-500/30 animate-ping opacity-50"></div>
                  <AlertTriangle className="w-8 h-8 text-rose-500 drop-shadow-[0_0_12px_rgba(244,63,94,0.6)]" />
             </div>
             <span className="text-white font-black tracking-widest uppercase mb-1 drop-shadow-md z-10">Connexió ECMWF Caiguda</span>
             <span className="text-xs text-slate-400 font-mono font-bold mb-6 z-10">Temps d&apos;espera esgotat per Windy</span>
             <button onClick={handleRetry} className="flex items-center gap-2 px-6 py-2.5 bg-[#0a0b10]/80 border border-white/10 hover:bg-white/10 text-white rounded-lg text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 shadow-[inset_0_1px_4px_rgba(255,255,255,0.05)] z-10">
                 <RefreshCw className="w-3.5 h-3.5" /> Reconnectar
             </button>
        </div>
      )}

      {/* PANTALLA DE CÀRREGA SPATIAL UI */}
      {isLoading && !hasError && (
         <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-gradient-to-br from-[#0f111a]/95 to-black/90 backdrop-blur-md">
             <div className={MATRIX_BG}></div>
             <div className="relative w-16 h-16 flex items-center justify-center mb-4 z-10">
                 <div className="absolute inset-0 border-[3px] border-emerald-900/20 rounded-full shadow-[0_0_15px_rgba(16,185,129,0.1)]"></div>
                 <div className="absolute inset-0 border-[3px] border-emerald-500 border-t-transparent border-l-transparent rounded-full animate-spin"></div>
                 <Wind className="w-6 h-6 text-emerald-400 animate-pulse drop-shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
             </div>
             <p className="text-emerald-400/90 text-[10px] md:text-xs font-mono font-bold tracking-widest uppercase animate-pulse flex items-center gap-2 z-10 drop-shadow-md">
                <Activity className="w-3 h-3" />
                Connectant Matriu ECMWF...
             </p>
         </div>
      )}

      {/* IFRAME BLINDAT */}
      {!hasError && (
        <iframe
            // Utilitzem key amb retryCount per forçar el remuntatge de l'iframe si l'usuari clica "Reconnectar"
            key={`windy-iframe-${retryCount}`}
            title="Mapa de Vent Tàctic"
            src={windyUrl}
            loading="lazy"
            onLoad={() => {
                if (isLoading) {
                    setIsLoading(false);
                    setHasError(false);
                }
            }}
            className={`absolute top-0 left-0 w-full h-full border-0 transition-opacity duration-1000 ${isLoading ? 'opacity-0' : 'opacity-100 z-10'}`}
            allowFullScreen
        ></iframe>
      )}
    </div>
  );
}