// src/components/RadarModal.jsx
import React from 'react';
import { X, Maximize2 } from 'lucide-react';
import { TRANSLATIONS } from '../constants/translations';
import RadarMap from './RadarMap'; // <--- Importem el nou component

export default function RadarModal({ lat, lon, onClose, lang = 'ca' }) {
  const t = TRANSLATIONS[lang] || TRANSLATIONS['ca'];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-0 md:p-6 bg-slate-950/90 backdrop-blur-sm animate-in fade-in duration-300">
      
      {/* Contenidor Principal */}
      <div className="bg-slate-900 border border-white/10 md:rounded-3xl w-full h-full md:max-w-5xl md:h-[85vh] flex flex-col relative shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
        
        {/* Capçalera */}
        <div className="flex items-center justify-between p-4 md:p-5 border-b border-white/5 bg-slate-900/80 backdrop-blur z-10">
          <div className="flex items-center gap-4">
             <div className="p-2.5 bg-indigo-500/20 rounded-xl border border-indigo-500/20">
                <Maximize2 className="w-5 h-5 text-indigo-400" />
             </div>
             <div>
                <h3 className="text-xl font-bold text-slate-100 tracking-tight">{t.radarTitle}</h3>
                <p className="text-xs text-slate-400 font-medium tracking-wide flex items-center gap-1">
                   {t.radarData} 
                   <span className="w-1 h-1 rounded-full bg-slate-600"></span> 
                   RainViewer API
                </p>
             </div>
          </div>
          
          <button 
            onClick={onClose}
            className="p-2.5 bg-slate-800 hover:bg-slate-700 hover:text-white text-slate-400 rounded-full transition-all border border-transparent hover:border-slate-600"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Cos del Mapa */}
        <div className="flex-1 relative bg-slate-950 w-full h-full">
           <RadarMap lat={lat} lon={lon} />
        </div>

      </div>
    </div>
  );
}