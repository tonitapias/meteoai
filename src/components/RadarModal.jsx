import React, { useState } from 'react';
import { X, Map, ExternalLink, Loader2 } from 'lucide-react';
import { TRANSLATIONS } from '../constants/translations';

const RadarModal = ({ lat, lon, onClose, lang = 'ca' }) => {
  const t = TRANSLATIONS[lang] || TRANSLATIONS['ca'];
  const [loading, setLoading] = useState(true);
  
  // CANVI IMPORTANT: 'c=2' (Titan) en lloc de 3. 
  // Aquest esquema de colors és fosc i ressalta molt millor sobre la teva app.
  // També hem afegit &dark=1 per si de cas l'API ho suporta directament.
  const radarUrl = `https://www.rainviewer.com/map.html?loc=${lat},${lon},8&oFa=0&oC=1&oU=0&oCS=1&oF=0&oAP=1&c=2&o=90&lm=1&layer=radar&sm=1&sn=1&dark=1`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="bg-slate-900/90 border border-white/20 w-full max-w-4xl h-[85vh] rounded-3xl flex flex-col shadow-2xl overflow-hidden relative backdrop-blur-md">
        
        {/* HEADER: Ara és absolut i flotant (Glassmorphism) per guanyar espai */}
        <div className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between p-4 bg-slate-900/80 backdrop-blur-md border-b border-white/10 transition-all">
          <h3 className="text-white font-bold flex items-center gap-2 drop-shadow-md pl-1">
             <Map className="w-5 h-5 text-indigo-400"/> 
             <span className="hidden md:inline">{t.radarTitle}</span>
             <span className="md:hidden">{t.radarShort}</span>
          </h3>
          
          <div className="flex items-center gap-2">
              <a 
                href={radarUrl} 
                target="_blank" 
                rel="noopener noreferrer"
                className="p-2 bg-black/40 hover:bg-indigo-600 text-indigo-200 rounded-full transition-all flex items-center gap-2 px-3 border border-white/10"
                title={t.openBrowser}
              >
                  <ExternalLink className="w-4 h-4" />
                  <span className="text-xs font-bold hidden md:inline">{t.openExternal}</span>
              </a>

              <button 
                onClick={onClose} 
                className="p-2 bg-black/40 hover:bg-rose-500/20 hover:text-rose-200 text-white border border-white/10 rounded-full transition-colors"
              >
                <X className="w-5 h-5"/>
              </button>
          </div>
        </div>

        {/* COS DEL MAPA */}
        <div className="flex-1 bg-slate-950 relative w-full h-full">
            
            {/* SPINNER DE CÀRREGA (Visible mentre l'iframe carrega) */}
            {loading && (
                <div className="absolute inset-0 flex items-center justify-center z-10 bg-slate-900">
                    <div className="flex flex-col items-center gap-3 text-indigo-400">
                        <Loader2 className="w-10 h-10 animate-spin" />
                        <span className="text-xs font-bold tracking-widest animate-pulse opacity-70">CARREGANT SATÈL·LIT...</span>
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
                onLoad={() => setLoading(false)} // Quan acaba de carregar, amaguem l'spinner
                className={`absolute inset-0 w-full h-full transition-opacity duration-700 ease-in-out ${loading ? 'opacity-0' : 'opacity-100'}`}
                title={t.radarTitle}
            />
        </div>
        
        {/* FOOTER */}
        <div className="p-2 bg-slate-900/90 backdrop-blur text-center text-[10px] md:text-xs text-slate-500 flex justify-between px-4 border-t border-white/5 relative z-20">
            <span>📡 {t.radarData}</span>
            <span className="opacity-40">RainViewer API</span>
        </div>
      </div>
    </div>
  );
};

export default RadarModal;