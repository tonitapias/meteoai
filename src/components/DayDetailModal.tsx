// src/components/DayDetailModal.tsx
import React from 'react';
import { X, Calendar, Droplets, Wind, Thermometer, Sun, Moon, Mountain } from 'lucide-react';
import { SmartForecastCharts } from './WeatherCharts'; 
import { TRANSLATIONS, Language } from '../constants/translations';
import { ExtendedWeatherData } from '../utils/weatherLogic';
import { WeatherUnit } from '../utils/formatters';
import { useDayDetailData } from '../hooks/useDayDetailData'; // <--- Importem el nou Hook

// Sub-component per evitar repetició de codi
const StatCard = ({ icon: Icon, label, value, sub, color }: any) => (
  <div className="bg-slate-800/50 p-4 rounded-2xl flex flex-col items-center justify-center text-center gap-2">
    <Icon className={`w-6 h-6 ${color} mb-1`} strokeWidth={2.5}/>
    <span className="text-xs text-slate-400 uppercase font-bold">{label}</span>
    <span className="text-lg font-bold text-slate-200">
      {value} {sub && <span className="text-xs ml-1 font-normal opacity-70">{sub}</span>}
    </span>
  </div>
);

interface DayDetailModalProps {
  weatherData: ExtendedWeatherData | null;
  selectedDayIndex: number | null;
  onClose: () => void;
  unit: WeatherUnit;
  lang: Language;
  shiftedNow: Date;
}

export default function DayDetailModal({ 
  weatherData, 
  selectedDayIndex, 
  onClose, 
  unit, 
  lang 
}: DayDetailModalProps) {
  const t = TRANSLATIONS[lang] || TRANSLATIONS['ca'];
  
  // 1. CRIDA AL HOOK (Sempre s'executa, sense condicional previ)
  const { dayData, hourlyData, comparisonData, snowLevelText } = useDayDetailData(weatherData, selectedDayIndex);

  // 2. CONDICIONAL DE RENDERITZAT (Ara sí és segur fer-ho aquí)
  if (!dayData) return null;

  // Helpers de formatatge
  const formatDate = (d: string) => {
      const locale = lang === 'ca' ? 'ca-ES' : lang === 'es' ? 'es-ES' : lang === 'fr' ? 'fr-FR' : 'en-US';
      return new Date(d).toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long' });
  };
  
  const formatTime = (d: string) => new Date(d).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
  
  const getUVText = (v: number) => {
      if (v > 10) return t.uvExtreme;
      if (v > 7) return t.uvVeryHigh;
      if (v > 5) return t.uvHigh;
      if (v > 2) return t.uvMod;
      return t.uvLow;
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="bg-slate-900 border border-white/10 w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-3xl shadow-2xl relative animate-in zoom-in-95 duration-300 custom-scrollbar"
        onClick={(e) => e.stopPropagation()}
      >
        <button 
            onClick={onClose} 
            className="absolute top-4 right-4 p-2 bg-white/5 hover:bg-white/10 rounded-full transition-colors z-10"
            aria-label="Tancar"
        >
          <X className="w-6 h-6 text-slate-400 hover:text-white" />
        </button>

        <div className="p-6 md:p-8">
          {/* CAPÇALERA */}
          <div className="flex flex-col md:flex-row gap-6 md:items-center justify-between mb-8 border-b border-white/5 pb-6">
            <div>
               <h2 className="text-3xl font-bold text-white capitalize mb-2">{formatDate(dayData.date)}</h2>
               <div className="flex items-center gap-2 text-slate-400">
                  <Calendar className="w-4 h-4" strokeWidth={2.5}/> 
                  <span className="text-sm font-medium">{t.dayDetailTitle}</span>
               </div>
            </div>
            
            <div className="flex items-center gap-4 bg-white/5 px-5 py-3 rounded-2xl">
               <div className="flex flex-col items-center">
                  <span className="text-xs text-rose-300 font-bold uppercase tracking-wider">{t.max}</span>
                  <span className="text-2xl font-bold text-white">{Math.round(dayData.maxTemp)}°</span>
               </div>
               <div className="w-px h-8 bg-white/10"></div>
               <div className="flex flex-col items-center">
                  <span className="text-xs text-cyan-300 font-bold uppercase tracking-wider">{t.min}</span>
                  <span className="text-2xl font-bold text-white">{Math.round(dayData.minTemp)}°</span>
               </div>
            </div>
          </div>

          {/* DADES PRINCIPALS (StatCards) */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
             <StatCard icon={Droplets} label={t.totalPrecipitation} value={`${dayData.precipSum} mm`} color="text-blue-400" />
             <StatCard icon={Wind} label={t.windMax} value={`${dayData.windMax} km/h`} color="text-teal-400" />
             <StatCard icon={Mountain} label={t.snowLevel} value={snowLevelText} color="text-indigo-300" />
             <StatCard icon={Sun} label={t.uvIndex} value={dayData.uvMax} sub={`(${getUVText(dayData.uvMax)})`} color="text-amber-400" />
          </div>
          
          {/* SORTIDA I POSTA DE SOL */}
          <div className="grid grid-cols-2 gap-4 mb-8">
              <div className="bg-gradient-to-br from-amber-500/10 to-orange-500/10 border border-amber-500/20 p-4 rounded-2xl flex items-center justify-between">
                 <div className="flex items-center gap-3">
                    <div className="p-2 bg-amber-500/20 rounded-full text-amber-400"><Sun className="w-5 h-5"/></div>
                    <div>
                        <span className="text-xs text-amber-200/70 font-bold uppercase">{t.sunrise}</span>
                        <div className="text-xl font-bold text-amber-100">{formatTime(dayData.sunrise)}</div>
                    </div>
                 </div>
              </div>

              <div className="bg-gradient-to-br from-indigo-500/10 to-purple-500/10 border border-indigo-500/20 p-4 rounded-2xl flex items-center justify-between">
                 <div className="flex items-center gap-3">
                    <div className="p-2 bg-indigo-500/20 rounded-full text-indigo-400"><Moon className="w-5 h-5"/></div>
                    <div>
                        <span className="text-xs text-indigo-200/70 font-bold uppercase">{t.sunset}</span>
                        <div className="text-xl font-bold text-indigo-100">{formatTime(dayData.sunset)}</div>
                    </div>
                 </div>
              </div>
          </div>

          {/* GRÀFICS DETALLATS */}
          <div className="bg-slate-950/50 border border-white/5 rounded-3xl p-4 md:p-6">
             <h3 className="font-bold text-white mb-6 flex items-center gap-2">
                <Thermometer className="w-5 h-5 text-indigo-400" strokeWidth={2.5}/> 
                {t.hourlyEvolution}
             </h3>
             <SmartForecastCharts 
                data={hourlyData} 
                comparisonData={comparisonData} 
                unit={unit === 'F' ? '°F' : '°C'} 
                lang={lang} 
             />
          </div>

        </div>
      </div>
    </div>
  );
}