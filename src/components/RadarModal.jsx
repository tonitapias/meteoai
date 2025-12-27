import React from 'react';
import { X } from 'lucide-react';
import { TRANSLATIONS } from '../constants/translations';
import RadarMap from './RadarMap'; // <--- Importem el nou component

export default function RadarModal({ lat, lon, onClose, lang = 'ca' }) {
  const t = TRANSLATIONS[lang];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      
      <div className="bg-slate-900 border border-white/10 rounded-3xl w-full max-w-4xl h-[80vh] flex flex-col relative shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
        
        {/* Capçalera */}
        <div className="flex items-center justify-between p-4 border-b border-white/5 bg-slate-900/50 backdrop-blur z-10">
          <div className="flex items-center gap-3">
             <div className="p-2 bg-indigo-500/20 rounded-lg">
                <svg className="w-5 h-5 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                </svg>
             </div>
             <div>
                <h3 className="text-lg font-bold text-slate-100">{t.radarTitle}</h3>
                <p className="text-xs text-slate-400">{t.radarData}</p>
             </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 bg-slate-800 hover:bg-slate-700 rounded-full text-slate-300 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Cos del Modal amb el Mapa Interactiu */}
        <div className="flex-1 relative bg-slate-950">
           <RadarMap lat={lat} lon={lon} />
        </div>

      </div>
    </div>
  );
}