import React, { useState } from 'react';
import { X, Map, ExternalLink, Loader2 } from 'lucide-react';
import { TRANSLATIONS } from '../constants/translations';

const RadarModal = ({ lat, lon, onClose, lang = 'ca' }) => {
  const t = TRANSLATIONS[lang] || TRANSLATIONS['ca'];
  const [loading, setLoading] = useState(true);
  
  // URL simplificada i robusta per assegurar que els controls funcionen.
  // forecast=1: Activa la predicció futura
  // dark=1: Mode fosc
  // sm=1: Suavitzat
  // sn=1: Neu
  // c=2: Color Titan (lila/fosc)
  const radarUrl = `https://www.rainviewer.com/map.html?loc=${lat},${lon},8&layer=radar&dark=1&smooth=1&forecast=1&snow=1&c=2&o=90`;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="bg-slate-900/90 border border-white/20 w-full max-w-5xl h-[85vh] rounded-3xl flex flex-col shadow-2xl overflow-hidden relative backdrop-blur-md">
        
        {/* HEADER FLOTANT */}
        <div className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between p-4 bg-gradient-to-b from-slate-900/90 to-transparent pointer-events-none">
          {/* Títol */}
          <div className="pointer-events-auto bg-slate-900/60 backdrop-blur-md border border-white/10 px-4 py-2 rounded-full flex items-center gap-2 shadow-lg">
             <Map className="w-4 h-4 text-indigo-400" strokeWidth={2.5}/> 
             <h3 className="text-white font-bold text-sm drop-shadow-md">
                <span className="hidden md:inline">{t.radarTitle}</span>
                <span className="md:hidden">{t.radarShort}</span>
             </h3>
             {/* Indicador de "En Viu" */}
             <span className="flex h-2 w-2 relative ml-1">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
             </span>
          </div>
          
          <div className="flex items-center gap-2 pointer-events-auto">
              <a 
                href={radarUrl} 
                target="_blank" 
                rel="noopener noreferrer"
                className="p-2 bg-slate-900/60 hover:bg-indigo-600 text-indigo-200 rounded-full transition-all flex items-center gap-2 px-3 border border-white/10 backdrop-blur-md shadow-lg group"
                title={t.openBrowser}
              >
                  <ExternalLink className="w-4 h-4 group-hover:scale-110 transition-transform" />
                  <span className="text-xs font-bold hidden md:inline">{t.openExternal}</span>
              </a>

              <button 
                onClick={onClose} 
                className="p-2 bg-slate-900/60 hover:bg-rose-500/80 hover:text-white text-slate-300 border border-white/10 rounded-full transition-all backdrop-blur-md shadow-lg"
              >
                <X className="w-5 h-5"/>
              </button>
          </div>
        </div>

        {/* COS DEL MAPA */}
        <div className="flex-1 bg-slate-950 relative w-full h-full">
            
            {/* SPINNER DE CÀRREGA */}
            {loading && (
                <div className="absolute inset-0 flex items-center justify-center z-10 bg-slate-950">
                    <div className="flex flex-col items-center gap-4">
                        <div className="relative">
                            <div className="absolute inset-0 bg-indigo-500/20 blur-xl rounded-full"></div>
                            <Loader2 className="w-12 h-12 text-indigo-400 animate-spin relative z-10" />
                        </div>
                        <span className="text-xs font-bold text-indigo-200 tracking-[0.2em] animate-pulse">CARREGANT RADAR...</span>
                    </div>
                </div>
            )}

            <iframe 
                src={radarUrl}
                width="100%" 
                height="100%" 
                frameBorder="0" 
                allowFullScreen
                referrerPolicy="no-referrer"
                onLoad={() => setLoading(false)} 
                className={`absolute inset-0 w-full h-full transition-opacity duration-700 ease-in-out ${loading ? 'opacity-0' : 'opacity-100'}`}
                title={t.radarTitle}
                style={{ pointerEvents: 'auto' }} 
            />
        </div>
        
        {/* FOOTER */}
        <div className="p-2 bg-slate-900/90 backdrop-blur text-center text-[10px] md:text-xs text-slate-500 flex justify-between px-6 border-t border-white/5 relative z-20">
            <span className="flex items-center gap-1">
                📡 {t.radarData} <span className="hidden sm:inline">| Nowcasting (+2h)</span>
            </span>
            <span className="opacity-40 hover:opacity-100 transition-opacity">RainViewer API</span>
        </div>
      </div>
    </div>
  );
};

export default RadarModal;