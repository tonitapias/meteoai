import React from 'react';
import { X, Map } from 'lucide-react';

const RadarModal = ({ lat, lon, onClose }) => {
  // Configuració de RainViewer:
  // loc: lat,lon,zoom
  // layer: radar
  // smooth: 1 (suavitzat)
  // snow: 1 (mostrar neu)
  // colors: 1 (original)
  const radarUrl = `https://www.rainviewer.com/map.html?loc=${lat},${lon},8&oFa=0&oC=1&oU=0&oCS=1&oF=0&oAP=1&c=3&o=90&lm=1&layer=radar&sm=1&sn=1`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-white/20 w-full max-w-4xl h-[80vh] rounded-3xl flex flex-col shadow-2xl overflow-hidden relative">
        
        {/* Capçalera del Modal */}
        <div className="flex items-center justify-between p-4 bg-slate-800/50 border-b border-white/10">
          <h3 className="text-white font-bold flex items-center gap-2">
             <Map className="w-5 h-5 text-indigo-400"/> Radar de Precipitació (En Viu)
          </h3>
          <button 
            onClick={onClose} 
            className="p-2 hover:bg-white/10 rounded-full text-white transition-colors"
          >
            <X className="w-6 h-6"/>
          </button>
        </div>

        {/* Iframe del Mapa */}
        <div className="flex-1 bg-slate-950 relative">
            <iframe 
                src={radarUrl}
                width="100%" 
                height="100%" 
                frameBorder="0" 
                allowFullScreen
                className="absolute inset-0 w-full h-full"
                title="Radar RainViewer"
            />
        </div>
        
        <div className="p-2 bg-slate-900 text-center text-xs text-slate-500">
            Dades proporcionades per RainViewer
        </div>
      </div>
    </div>
  );
};

export default RadarModal;