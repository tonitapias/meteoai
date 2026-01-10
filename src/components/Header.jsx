// src/components/Header.jsx
import React, { useState, useEffect, useRef } from 'react';
import { 
  Search, MapPin, Star, Trash2, LocateFixed, 
  LayoutTemplate, LayoutDashboard, BrainCircuit, Loader2 
} from 'lucide-react';
import { FlagIcon } from './WeatherUI';
import { TRANSLATIONS } from '../constants/translations';
import { usePreferences } from '../hooks/usePreferences';

export default function Header({ 
  onSearch, 
  onLocate, 
  loading 
}) {
  const { 
    lang, setLang, 
    unit, setUnit, 
    viewMode, setViewMode, 
    favorites, removeFavorite 
  } = usePreferences();

  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(-1);
  const [isSearching, setIsSearching] = useState(false);
  
  const inputRef = useRef(null);
  const suggestionsListRef = useRef(null);
  const t = TRANSLATIONS[lang] || TRANSLATIONS['ca'];

  useEffect(() => {
     setIsSearching(loading);
  }, [loading]);

  useEffect(() => {
    setActiveSuggestionIndex(-1);
  }, [suggestions, showSuggestions, query]);

  // Cerca amb debounce
  useEffect(() => {
    if (query.length <= 2) {
        setSuggestions([]);
        return;
    }

    const timer = setTimeout(async () => {
      if (query.length > 2 && showSuggestions) {
        setIsSearching(true);
        try {
          const res = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${query}&count=5&language=${lang}&format=json`);
          const data = await res.json();
          setSuggestions(data.results || []);
        } catch (e) { 
            setSuggestions([]); 
        } finally {
            setIsSearching(false);
        }
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [query, lang, showSuggestions]);

  // --- GESTIÓ DEL TECLAT ---
  const handleKeyDown = (e) => {
    if (!showSuggestions) return;
    
    const isFavoritesView = query.length <= 2;
    const list = isFavoritesView ? favorites : suggestions;
    
    if (!list.length) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveSuggestionIndex(prev => (prev < list.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveSuggestionIndex(prev => (prev > 0 ? prev - 1 : list.length - 1));
    } else if (e.key === 'Enter') {
      if (activeSuggestionIndex >= 0 && list[activeSuggestionIndex]) {
        e.preventDefault(); 
        handleSelectSuggestion(list[activeSuggestionIndex]);
      }
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
      inputRef.current?.blur();
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (query.trim()) {
      onSearch(0, 0, query, '');
      setQuery('');
      setShowSuggestions(false);
      inputRef.current?.blur();
    }
  };

  const handleSelectSuggestion = (place) => {
    onSearch(place.latitude, place.longitude, place.name, place.country);
    setQuery(''); 
    setShowSuggestions(false);
    setActiveSuggestionIndex(-1);
    inputRef.current?.blur();
  };

  const cleanupSearch = () => {
    setQuery('');
    setShowSuggestions(false);
    inputRef.current?.blur();
  };

  const cycleLang = () => {
    const langs = ['ca', 'es', 'en', 'fr'];
    const idx = langs.indexOf(lang);
    setLang(langs[(idx + 1) % langs.length]);
  };

  const shouldShowDropdown = showSuggestions && (
      (query.length <= 2 && favorites.length > 0) || 
      (query.length > 2)
  );

  return (
    <header className="relative z-50">
      
      {/* TELÓ INVISIBLE (Backdrop) */}
      {shouldShowDropdown && (
        <div 
            className="fixed inset-0 z-40 bg-transparent" 
            onClick={() => setShowSuggestions(false)}
        />
      )}

      <div className="bg-slate-900/60 backdrop-blur-xl border border-white/10 rounded-2xl p-4 shadow-2xl flex flex-col md:flex-row gap-4 items-center justify-between transition-all duration-300 relative z-50">
        
        {/* LOGO */}
        <div className="flex items-center gap-3 group cursor-default">
          <div className="relative">
            <div className="absolute inset-0 bg-indigo-500 rounded-xl blur opacity-40 group-hover:opacity-60 transition-opacity"></div>
            <div className="bg-gradient-to-br from-indigo-500 to-purple-600 p-2.5 rounded-xl relative shadow-lg group-hover:scale-105 transition-transform duration-300">
              <BrainCircuit className="w-6 h-6 text-white" />
            </div>
          </div>
          <div className="flex flex-col">
            <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400 tracking-tight">
              MeteoToni <span className="text-indigo-400">AI</span>
            </h1>
            <span className="text-[10px] font-medium text-slate-500 tracking-wider uppercase">Forecast & Intelligence</span>
          </div>
        </div>

        {/* CERCA */}
        <div className="flex-1 w-full md:max-w-xl relative group/search z-50">
          <form onSubmit={handleSubmit} className="relative">
            <div className={`absolute inset-0 bg-indigo-500/10 rounded-xl blur-md transition-opacity duration-300 ${shouldShowDropdown ? 'opacity-100' : 'opacity-0'}`}></div>
            <div className="relative flex items-center bg-slate-950/50 border border-slate-700/50 rounded-xl focus-within:border-indigo-500/50 focus-within:ring-2 focus-within:ring-indigo-500/20 transition-all shadow-inner">
              <Search className={`w-5 h-5 ml-4 ${isSearching ? 'text-indigo-400 animate-pulse' : 'text-slate-400'}`} />
              
              <input 
                ref={inputRef}
                type="text" 
                value={query}
                onChange={(e) => { 
                    setQuery(e.target.value); 
                    setShowSuggestions(true); 
                }}
                onKeyDown={handleKeyDown}
                onFocus={() => setShowSuggestions(true)}
                placeholder={t.searchPlaceholder}
                className="w-full bg-transparent border-none text-slate-200 placeholder:text-slate-600 px-4 py-3 focus:ring-0 text-sm font-medium"
                autoComplete="off"
              />
              
              <div className="pr-2 flex items-center gap-1">
                 {query && (
                    <button type="button" onClick={() => setQuery('')} className="p-1.5 text-slate-500 hover:text-slate-300 hover:bg-white/5 rounded-lg transition-colors">
                        <Trash2 className="w-4 h-4" />
                    </button>
                 )}
                 <div className="h-6 w-px bg-white/10 mx-1"></div>
                 <button type="button" onClick={onLocate} className="p-2 text-indigo-400 hover:text-indigo-300 hover:bg-indigo-500/10 rounded-lg transition-all" title="Ubicació Actual">
                    <LocateFixed className="w-5 h-5" />
                 </button>
              </div>
            </div>
          </form>

          {/* SUGGERIMENTS */}
          {shouldShowDropdown && (
            <div ref={suggestionsListRef} className="absolute top-full left-0 right-0 mt-2 bg-slate-900/95 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
               
               {/* FAVORITS */}
               {query.length <= 2 && favorites.length > 0 && (
                   <div className="p-2">
                       <div className="text-xs font-bold text-slate-500 px-3 py-2 uppercase tracking-wider flex items-center gap-2">
                          <Star className="w-3 h-3" /> Favorits
                       </div>
                       {favorites.map((fav, idx) => (
                           <div 
                             key={fav.name} 
                             onClick={() => { handleSelectSuggestion({ name: fav.name, latitude: fav.latitude, longitude: fav.longitude, country: fav.country }); }} 
                             className={`w-full flex items-center justify-between px-3 py-2.5 text-sm rounded-lg transition-colors group/item cursor-pointer ${
                                idx === activeSuggestionIndex 
                                ? 'bg-indigo-500/20 text-white' 
                                : 'text-slate-300 hover:bg-indigo-500/20 hover:text-white'
                             }`}
                             role="button"
                             tabIndex={0}
                           >
                               <span className="flex items-center gap-3">
                                  <MapPin className={`w-4 h-4 ${idx === activeSuggestionIndex ? 'text-indigo-300' : 'text-indigo-400'}`} /> {fav.name}
                               </span>
                               <button onClick={(e) => { e.stopPropagation(); removeFavorite(fav.name); }} className="p-1.5 text-slate-600 hover:text-red-400 opacity-0 group-hover/item:opacity-100 transition-all rounded-md hover:bg-white/10">
                                  <Trash2 className="w-3.5 h-3.5" />
                               </button>
                           </div>
                       ))}
                   </div>
               )}

               {/* RESULTATS DE LA CERCA (AQUÍ ESTÀ LA MILLORA VISUAL) */}
               {query.length > 2 && (
                   <div>
                       {isSearching ? (
                           <div className="px-4 py-3 text-sm text-slate-400 flex items-center gap-2">
                               <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />
                               <span>Cercant...</span>
                           </div>
                       ) : (
                           <>
                               {suggestions.map((place, idx) => (
                                  <button key={place.id} onClick={() => { handleSelectSuggestion(place); }}
                                    className={`w-full text-left px-4 py-2.5 flex items-start gap-3 transition-colors border-b border-white/5 last:border-0 ${
                                        idx === activeSuggestionIndex 
                                        ? 'bg-indigo-500/20' 
                                        : 'hover:bg-white/5'
                                    }`}>
                                     {/* Icona alineada a dalt */}
                                     <MapPin className={`w-4 h-4 mt-1 shrink-0 ${idx === activeSuggestionIndex ? 'text-white' : 'text-slate-500'}`} />
                                     
                                     {/* Estructura Vertical: Nom a dalt, Detalls a sota */}
                                     <div className="flex flex-col">
                                        <span className={`text-sm font-semibold ${idx === activeSuggestionIndex ? 'text-white' : 'text-indigo-300'}`}>
                                            {place.name}
                                        </span>
                                        <span className={`text-xs ${idx === activeSuggestionIndex ? 'text-slate-300' : 'text-slate-500'}`}>
                                            {/* Mostrem Regió i País separats per coma, si existeixen */}
                                            {[place.admin1, place.country].filter(Boolean).join(', ')}
                                        </span>
                                     </div>
                                  </button>
                               ))}
                               {suggestions.length === 0 && (
                                   <div className="px-4 py-3 text-sm text-slate-500">Sense resultats</div>
                               )}
                           </>
                       )}
                   </div>
               )}
            </div>
          )}
        </div>

        {/* CONTROLS DRETA - z-50 */}
        <div className="flex items-center gap-3 w-full md:w-auto justify-end relative z-50">
         <div className="flex p-1 bg-slate-950/50 rounded-xl border border-slate-700/50 backdrop-blur-md shadow-inner">
           <button onClick={() => setViewMode('basic')} className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-bold transition-all ${viewMode === 'basic' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'}`}>
             <LayoutTemplate className="w-4 h-4" strokeWidth={2.5} /> {t.modeBasic}
           </button>
           <button onClick={() => setViewMode('expert')} className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-bold transition-all ${viewMode === 'expert' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'}`}>
             <LayoutDashboard className="w-4 h-4" strokeWidth={2.5} /> {t.modeExpert}
           </button>
         </div>
         <button onClick={cycleLang} className="bg-slate-950/50 border border-slate-700/50 text-indigo-300 font-bold p-3 rounded-xl hover:bg-indigo-500 hover:text-white transition-all w-12 h-12 flex items-center justify-center uppercase shadow-lg">
           <FlagIcon lang={lang} className="w-6 h-4 rounded shadow-sm" />
         </button>
         <button onClick={() => setUnit(unit === 'C' ? 'F' : 'C')} className="bg-slate-950/50 border border-slate-700/50 text-slate-200 font-bold p-3 rounded-xl hover:bg-indigo-500 hover:text-white transition-all w-12 h-12 flex items-center justify-center shadow-lg">
           {unit === 'C' ? '°C' : '°F'}
         </button>
        </div>
      </div>
    </header>
  );
}