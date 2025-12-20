import React, { useState, useEffect, useRef } from 'react';
import { 
  Search, MapPin, Star, RefreshCw, Trash2, LocateFixed, 
  LayoutTemplate, LayoutDashboard, BrainCircuit, ArrowRight 
} from 'lucide-react';
import { FlagIcon } from './WeatherUI';
import { TRANSLATIONS } from '../constants/translations';

export default function Header({ 
  onSearch, 
  onLocate, 
  loading, 
  favorites, 
  onRemoveFavorite, 
  lang, 
  setLang, 
  unit, 
  setUnit, 
  viewMode, 
  setViewMode 
}) {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(-1);
  const [isSearching, setIsSearching] = useState(false);
  
  const inputRef = useRef(null);
  const suggestionsListRef = useRef(null);
  const t = TRANSLATIONS[lang];

  useEffect(() => {
     setIsSearching(loading);
  }, [loading]);

  useEffect(() => {
    const timer = setTimeout(async () => {
      if (query.length > 2 && showSuggestions) {
        try {
          const res = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${query}&count=5&language=${lang}&format=json`);
          const data = await res.json();
          setSuggestions(data.results || []);
          setActiveSuggestionIndex(-1); 
        } catch (e) { console.error(e); }
      } 
    }, 300);
    return () => clearTimeout(timer);
  }, [query, showSuggestions, lang]);

  useEffect(() => {
    if (!showSuggestions) return;
    if (query.length === 0) {
        setSuggestions(favorites);
        setActiveSuggestionIndex(-1);
    }
  }, [query, showSuggestions, favorites]);

  useEffect(() => {
    if (showSuggestions && activeSuggestionIndex !== -1 && suggestionsListRef.current) {
        const list = suggestionsListRef.current;
        // Busquem tant 'button' com 'div' amb la classe 'group' per si de cas
        const items = list.querySelectorAll('.group'); 
        if (items[activeSuggestionIndex]) {
            items[activeSuggestionIndex].scrollIntoView({ block: 'nearest' });
        }
    }
  }, [activeSuggestionIndex, showSuggestions]);

  const cleanupSearch = (lat, lon, name, country) => {
    setShowSuggestions(false);
    setQuery(""); 
    if (inputRef.current) inputRef.current.blur();
    onSearch(lat, lon, name, country);
  };

  const executeSearch = () => {
    if (isSearching) return;
    const list = query.length === 0 ? favorites : suggestions;
    if (list.length > 0) {
        const index = (activeSuggestionIndex >= 0 && activeSuggestionIndex < list.length) ? activeSuggestionIndex : 0;
        const item = list[index];
        if (item) {
            cleanupSearch(item.latitude, item.longitude, item.name, item.country || item.admin1);
        }
    }
  };

  const handleKeyDown = (e) => {
    if (!showSuggestions) return;
    const list = query.length === 0 ? favorites : suggestions;
    if (list.length === 0) return;
    
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveSuggestionIndex(prev => (prev < list.length - 1 ? prev + 1 : 0)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActiveSuggestionIndex(prev => (prev > 0 ? prev - 1 : list.length - 1)); }
    else if (e.key === 'Enter') { e.preventDefault(); executeSearch(); } 
    else if (e.key === 'Escape') { setShowSuggestions(false); }
  };

  const cycleLang = () => {
    const langs = ['ca', 'es', 'en', 'fr'];
    const currentIdx = langs.indexOf(lang);
    setLang(langs[(currentIdx + 1) % langs.length]);
  };

  return (
    <div className="bg-slate-900/60 p-4 rounded-2xl border border-white/10 backdrop-blur-md flex flex-col md:flex-row gap-4 items-center justify-between sticky top-2 z-50 shadow-xl mb-6">
      
      {/* 1. SECCIÓ LOGO I CONTROLS MÒBIL */}
      <div className="flex items-center gap-3 select-none w-full md:w-auto justify-between md:justify-start md:order-1">
         <div className="flex items-center gap-3">
           <div className="bg-gradient-to-tr from-indigo-600 to-purple-600 p-2.5 rounded-xl shadow-lg shadow-indigo-500/20 animate-[pulse_4s_ease-in-out_infinite]">
             <BrainCircuit className="w-6 h-6 text-white" strokeWidth={2}/>
           </div>
           <span className="font-bold text-xl tracking-tight">Meteo Toni <span className="text-indigo-400">Ai</span></span>
         </div>
         
         {/* Mòbil: Controls bàsics */}
         <div className="md:hidden flex gap-2 items-center">
             <button 
                onClick={() => setViewMode(viewMode === 'basic' ? 'expert' : 'basic')} 
                className={`px-3 h-10 rounded-lg flex items-center gap-2 transition-all ${
                    viewMode === 'expert' 
                    ? 'bg-indigo-600 text-white shadow-md' 
                    : 'bg-slate-800/50 border border-slate-700/50 text-indigo-300'
                }`}
             >
                 {viewMode === 'basic' ? <LayoutTemplate size={16} /> : <LayoutDashboard size={16} />}
                 <span className="text-xs font-bold uppercase tracking-wide">
                     {viewMode === 'basic' ? t.modeBasic : t.modeExpert}
                 </span>
             </button>

             <button onClick={() => setUnit(unit === 'C' ? 'F' : 'C')} className="bg-slate-800/50 border border-slate-700/50 text-indigo-300 font-bold p-2 rounded-lg w-10 h-10 flex items-center justify-center active:bg-slate-700">
                 {unit === 'C' ? '°C' : '°F'}
             </button>
             <button onClick={cycleLang} className="bg-slate-800/50 border border-slate-700/50 text-indigo-300 font-bold p-2 rounded-lg w-10 h-10 flex items-center justify-center uppercase text-xs active:bg-slate-700">
                 <FlagIcon lang={lang} className="w-5 h-4 rounded shadow-sm" />
             </button>
         </div>
      </div>

      {/* 2. BARRA DE CERCA */}
      <div className="relative flex-1 w-full md:w-80 md:order-2 flex gap-2"> 
         <div className="relative flex-1">
           <button 
              className={`absolute left-3 top-3.5 transition-colors ${isSearching ? 'text-indigo-400' : 'text-slate-400 hover:text-white'}`}
              onClick={executeSearch} 
              disabled={isSearching}
           >
             {isSearching ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
           </button>
           
           <input 
             ref={inputRef}
             type="text" 
             placeholder={t.searchPlaceholder} 
             value={query}
             onFocus={() => { setShowSuggestions(true); if (query.length === 0) setSuggestions(favorites); }}
             onChange={(e) => { setQuery(e.target.value); setShowSuggestions(true); }}
             onKeyDown={handleKeyDown}
             className="w-full bg-slate-950/50 border border-slate-700/50 rounded-xl py-3 pl-10 pr-4 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none placeholder-slate-500 transition-all shadow-inner"
           />
           
           {showSuggestions && (
             <div ref={suggestionsListRef} className="absolute top-full left-0 right-0 mt-2 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl overflow-hidden z-50 max-h-[60vh] overflow-y-auto custom-scrollbar animate-in slide-in-from-top-2">
               {query.length === 0 && favorites.length > 0 && (
                 <div className="px-4 py-2 text-xs font-bold text-indigo-400 uppercase tracking-wider bg-slate-950/80 sticky top-0 backdrop-blur-sm">{t.favorites}</div>
               )}
               
               {(query.length === 0 ? favorites : suggestions).map((item, i) => (
                 // --- CANVI AQUÍ: <button> per <div> ---
                 <div 
                   key={i}
                   onMouseDown={(e) => e.preventDefault()} 
                   className={`group w-full px-4 py-3 flex items-center justify-between border-b border-white/5 last:border-0 cursor-pointer transition-colors text-left ${i === activeSuggestionIndex ? 'bg-indigo-600/20 border-l-4 border-l-indigo-500' : 'hover:bg-white/5'}`}
                   onClick={() => cleanupSearch(item.latitude, item.longitude, item.name, item.country || item.admin1)} 
                 >
                   <div className="flex items-center gap-3 pointer-events-none"> 
                     {query.length === 0 ? <Star className="w-5 h-5 text-amber-400 fill-amber-400"/> : <MapPin className="w-5 h-5 text-slate-500"/>}
                     <div className="flex flex-col text-left">
                        <span className="text-base md:text-sm font-medium text-slate-200 group-hover:text-white transition-colors">{item.name}</span>
                        <span className="text-xs text-slate-500">{item.country || item.admin1}</span>
                     </div>
                   </div>
                   
                   {query.length === 0 ? (
                     <button 
                        type="button"
                        onClick={(e) => { e.stopPropagation(); onRemoveFavorite(e, item.name); }} 
                        className="p-2 text-slate-600 hover:text-red-400 hover:bg-red-400/10 rounded-full transition-all touch-manipulation z-20 pointer-events-auto"
                        aria-label="Eliminar favorit"
                     >
                       <Trash2 className="w-5 h-5"/>
                     </button>
                   ) : (
                     i === activeSuggestionIndex && <ArrowRight className="w-4 h-4 text-indigo-400 animate-pulse"/>
                   )}
                 </div>
               ))}
             </div>
           )}
         </div>
         <button onClick={onLocate} disabled={isSearching} className="bg-indigo-600 hover:bg-indigo-500 text-white p-3 rounded-xl transition-colors shadow-lg shadow-indigo-900/20 active:scale-95 touch-manipulation disabled:bg-indigo-800 shrink-0" title="La meva ubicació">
            {isSearching ? <RefreshCw className="w-5 h-5 animate-spin" /> : <LocateFixed className="w-5 h-5" />}
         </button>
      </div>

      {/* 3. CONTROLS ESCRIPTORI */}
      <div className="hidden md:flex gap-3 w-full md:w-auto items-center md:order-3 justify-end">
         <div className="flex bg-slate-950/60 p-1 rounded-xl border border-slate-700/50 backdrop-blur-md shadow-inner">
           <button onClick={() => setViewMode('basic')} className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-bold transition-all ${viewMode === 'basic' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'}`}>
             <LayoutTemplate className="w-4 h-4" /> {t.modeBasic}
           </button>
           <button onClick={() => setViewMode('expert')} className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-bold transition-all ${viewMode === 'expert' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'}`}>
             <LayoutDashboard className="w-4 h-4" /> {t.modeExpert}
           </button>
         </div>

         <button onClick={cycleLang} className="bg-slate-950/50 border border-slate-700/50 text-indigo-300 font-bold p-3 rounded-xl hover:bg-indigo-500 hover:text-white transition-all w-12 h-12 flex items-center justify-center uppercase shadow-lg">
           <FlagIcon lang={lang} className="w-6 h-4 rounded shadow-sm" />
         </button>

         <button onClick={() => setUnit(unit === 'C' ? 'F' : 'C')} className="bg-slate-950/50 border border-slate-700/50 text-indigo-300 font-bold p-3 rounded-xl hover:bg-indigo-500 hover:text-white transition-all w-12 h-12 flex items-center justify-center shadow-lg">
           {unit === 'C' ? '°C' : '°F'}
         </button>
      </div>
    </div>
  );
}