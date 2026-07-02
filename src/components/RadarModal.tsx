import { useState } from 'react';
import { X, CloudRain, Wind } from 'lucide-react';
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
  
  // Nou estat per controlar quin mapa mostrem
  const [activeView, setActiveView] = useState<MapView>('radar');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-0 md:p-6 bg-slate-950/90 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="bg-slate-900 border border-white/10 md:rounded-3xl w-full h-full md:max-w-5xl md:h-[85vh] flex flex-col relative shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
        
        {/* CAPÇALERA AMB SELECTOR DE MAPA */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 md:p-5 border-b border-white/5 bg-slate-900/80 backdrop-blur z-10 gap-4">
          
          <div className="flex items-center gap-4">
             <div className={`p-2.5 rounded-xl border transition-colors ${activeView === 'radar' ? 'bg-indigo-500/20 border-indigo-500/20 text-indigo-400' : 'bg-emerald-500/20 border-emerald-500/20 text-emerald-400'}`}>
                {activeView === 'radar' ? <CloudRain className="w-5 h-5" /> : <Wind className="w-5 h-5" />}
             </div>
             <div>
                <h3 className="text-xl font-bold text-slate-100 tracking-tight">
                    {activeView === 'radar' ? t.radarTitle : (lang === 'ca' ? 'Mapa de Vent' : 'Wind Map')}
                </h3>
                <p className="text-xs text-slate-400 font-medium tracking-wide flex items-center gap-1">
                   {t.radarData} 
                   <span className="w-1 h-1 rounded-full bg-slate-600"></span> 
                   {activeView === 'radar' ? 'RainViewer API' : 'Windy.com'}
                </p>
             </div>
          </div>
          
          <div className="flex items-center gap-3">
            {/* SELECTOR TIPUS DE MAPA */}
            <div className="flex bg-black/40 p-1 rounded-lg border border-white/5">
                <button 
                    onClick={() => setActiveView('radar')}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${activeView === 'radar' ? 'bg-slate-700 text-white shadow' : 'text-slate-400 hover:text-slate-200'}`}
                >
                    <CloudRain className="w-3.5 h-3.5" /> Radar
                </button>
                <button 
                    onClick={() => setActiveView('wind')}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${activeView === 'wind' ? 'bg-slate-700 text-white shadow' : 'text-slate-400 hover:text-slate-200'}`}
                >
                    <Wind className="w-3.5 h-3.5" /> Vent
                </button>
            </div>

            <button 
              onClick={onClose}
              className="p-2.5 bg-slate-800 hover:bg-slate-700 hover:text-white text-slate-400 rounded-full transition-all border border-transparent hover:border-slate-600 ml-auto"
            >
              <X className="w-5 h-5 sm:w-6 sm:h-6" />
            </button>
          </div>
        </div>

        {/* CONTENIDOR DEL MAPA DINÀMIC */}
        <div className="flex-1 relative bg-slate-950 w-full h-full">
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