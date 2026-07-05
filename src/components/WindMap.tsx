// src/components/WindMap.tsx
import { useState } from 'react';
import { Wind, Activity } from 'lucide-react';

interface WindMapProps {
  lat: number;
  lon: number;
}

export default function WindMap({ lat, lon }: WindMapProps) {
  const [isLoading, setIsLoading] = useState(true);

  // Integrem el widget oficial de Windy configurat per vent (wind) i model ECMWF.
  const windyUrl = `https://embed.windy.com/embed.html?type=map&location=coordinates&metricRain=mm&metricTemp=default&metricWind=km%2Fh&zoom=9&overlay=wind&product=ecmwf&level=surface&lat=${lat}&lon=${lon}`;

  return (
    <div className="w-full h-full min-h-0 bg-[#020308] relative overflow-hidden flex items-center justify-center">
      
      {/* PANTALLA DE CÀRREGA TÀCTICA */}
      {isLoading && (
         <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-[#020308] backdrop-blur-md">
             <div className="relative w-16 h-16 flex items-center justify-center mb-4">
                 <div className="absolute inset-0 border-[3px] border-emerald-900/20 rounded-full"></div>
                 <div className="absolute inset-0 border-[3px] border-emerald-500 border-t-transparent border-l-transparent rounded-full animate-spin"></div>
                 <Wind className="w-6 h-6 text-emerald-400 animate-pulse" />
             </div>
             <p className="text-emerald-400/80 text-[10px] md:text-xs font-mono tracking-widest uppercase animate-pulse flex items-center gap-2">
                <Activity className="w-3 h-3" />
                Connectant Matriu ECMWF...
             </p>
         </div>
      )}

      {/* IFRAME BLINDAT */}
      <iframe
        title="Mapa de Vent Tàctic"
        src={windyUrl}
        loading="lazy"
        onLoad={() => setIsLoading(false)}
        className={`absolute top-0 left-0 w-full h-full border-0 transition-opacity duration-1000 ${isLoading ? 'opacity-0' : 'opacity-100 z-10'}`}
        allowFullScreen
      ></iframe>
    </div>
  );
}