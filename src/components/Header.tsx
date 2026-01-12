import React, { useState, useEffect, useRef } from 'react';
import { Search, MapPin, Loader2, X, Star, Trash2, LocateFixed, LayoutDashboard, LayoutTemplate } from 'lucide-react';
import { usePreferences } from '../hooks/usePreferences';

interface HeaderProps {
  onSearch: (lat: number, lon: number, name: string, country: string) => void;
  onLocate: () => void;
  loading: boolean;
}

export default function Header({ onSearch, onLocate, loading }: HeaderProps) {
  const { favorites, removeFavorite, viewMode, setViewMode, lang } = usePreferences();

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  
  const searchRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    setActiveIndex(-1);
  }, [results, showDropdown]);

  useEffect(() => {
    const timer = setTimeout(async () => {
      const trimmedQuery = query.trim();
      
      if (trimmedQuery.length > 2) {
        setIsSearching(true);
        setShowDropdown(true);
        try {
            const res = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(trimmedQuery)}&count=5&language=${lang}&format=json`);
            const data = await res.json();
            setResults(data.results || []);
        } catch (error) {
            console.error(error);
            setResults([]);
        } finally {
            setIsSearching(false);
        }
      } 
      else {
        setResults([]);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query, lang]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    const isFavMode = query.trim().length <= 2;
    const currentList = isFavMode ? favorites : results;

    if (!showDropdown || currentList.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex(prev => (prev < currentList.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex(prev => (prev > 0 ? prev - 1 : currentList.length - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (activeIndex >= 0 && currentList[activeIndex]) {
        selectCity(currentList[activeIndex]);
      } else if (!isFavMode && results.length > 0) {
        selectCity(results[0]); 
      }
    } else if (e.key === 'Escape') {
      setShowDropdown(false);
      inputRef.current?.blur();
    }
  };

  const selectCity = (city: any) => {
      const country = city.country || "";
      const name = city.name;
      const lat = city.latitude !== undefined ? city.latitude : city.lat;
      const lon = city.longitude !== undefined ? city.longitude : city.lon;

      if (lat !== undefined && lon !== undefined) {
        onSearch(lat, lon, name, country);
      }
      
      setQuery('');
      setShowDropdown(false);
      inputRef.current?.blur();
  };

  const isFavoritesMode = query.trim().length <= 2;

  // Component intern per als botons de vista (per reutilitzar estil)
  const ViewToggleButtons = () => (
    <div className="bg-slate-900/60 backdrop-blur-xl border border-white/10 rounded-xl p-1 flex items-center gap-1 shadow-lg">
        <button 
            onClick={() => setViewMode('basic')}
            className={`p-2 rounded-lg transition-all ${viewMode === 'basic' ? 'bg-indigo-500 text-white shadow-md' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
            title="Mode Essencial"
        >
            <LayoutTemplate className="w-4 h-4" />
        </button>
        <button 
            onClick={() => setViewMode('expert')}
            className={`p-2 rounded-lg transition-all ${viewMode === 'expert' ? 'bg-indigo-500 text-white shadow-md' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
            title="Mode Expert"
        >
            <LayoutDashboard className="w-4 h-4" />
        </button>
    </div>
  );

  return (
    <header className="w-full flex flex-col md:flex-row items-center gap-4 relative z-50 pointer-events-none md:pointer-events-auto">
        {/* LOGO MÒBIL */}
        <div className="flex items-center gap-2 md:hidden self-start pointer-events-auto">
            <div className="w-8 h-8 rounded-xl bg-indigo-500 flex items-center justify-center text-white font-bold shadow-lg shadow-indigo-500/30">M</div>
            <span className="font-bold text-lg tracking-tight text-white">MeteoAI</span>
        </div>

        {/* CONTROLS DE VISTA (ESQUERRA - NOMÉS ESCRIPTORI) */}
        {/* Aquests es mantenen a l'esquerra absoluta en pantalles grans */}
        <div className="hidden md:flex items-center gap-1 pointer-events-auto absolute left-0">
            <ViewToggleButtons />
        </div>

        {/* BARRA DE CERCA CENTRADA */}
        <div ref={searchRef} className="w-full max-w-md relative group pointer-events-auto md:absolute md:left-1/2 md:-translate-x-1/2 z-20">
            <div className="absolute inset-0 bg-indigo-500/20 rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
            
            <div className="relative">
                <input 
                    ref={inputRef}
                    type="text" 
                    value={query}
                    onChange={(e) => {
                        setQuery(e.target.value);
                        if (!showDropdown && (e.target.value.length > 2 || favorites.length > 0)) setShowDropdown(true);
                    }}
                    onKeyDown={handleKeyDown}
                    onFocus={() => { if(query.length > 2 || favorites.length > 0) setShowDropdown(true); }}
                    placeholder={lang === 'ca' ? "Cerca una ciutat..." : lang === 'es' ? "Buscar ciudad..." : "Search city..."}
                    className="w-full pl-12 pr-10 py-3.5 bg-slate-900/60 backdrop-blur-xl border border-white/10 rounded-2xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all shadow-lg text-sm font-medium" 
                />
                
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-indigo-400" />
                
                <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center">
                    {(loading || isSearching) ? (
                        <Loader2 className="w-4 h-4 text-indigo-400 animate-spin" />
                    ) : query.length > 0 ? (
                        <button type="button" onClick={() => { setQuery(''); inputRef.current?.focus(); }} className="text-slate-500 hover:text-white">
                            <X className="w-4 h-4" />
                        </button>
                    ) : null}
                </div>
            </div>

            {/* DESPLEGABLE DE RESULTATS (Igual que abans...) */}
            {showDropdown && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-slate-900/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-2 z-50">
                    <div className="max-h-[300px] overflow-y-auto custom-scrollbar">
                        {isFavoritesMode && favorites.length > 0 && (
                            <>
                                <div className="px-4 py-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest bg-white/5 flex items-center gap-2">
                                    <Star className="w-3 h-3 text-amber-400" fill="currentColor" /> {lang === 'ca' ? 'Favorits' : 'Favorites'}
                                </div>
                                {favorites.map((fav, idx) => (
                                    <div 
                                        key={fav.name + idx}
                                        onClick={() => selectCity(fav)}
                                        className={`w-full text-left px-5 py-3 cursor-pointer transition-colors flex items-center justify-between group/item border-b border-white/5 last:border-0 ${
                                            idx === activeIndex ? 'bg-indigo-500/20' : 'hover:bg-white/5'
                                        }`}
                                    >
                                        <div className="flex items-center gap-3">
                                            <MapPin className={`w-4 h-4 ${idx === activeIndex ? 'text-indigo-300' : 'text-indigo-400'}`} />
                                            <span className={`font-medium ${idx === activeIndex ? 'text-white' : 'text-slate-200'}`}>
                                                {fav.name}
                                            </span>
                                        </div>
                                        <button 
                                            onClick={(e) => { e.stopPropagation(); removeFavorite(fav.name); }}
                                            className="p-1.5 text-slate-600 hover:text-red-400 hover:bg-white/10 rounded opacity-0 group-hover/item:opacity-100 transition-all"
                                        >
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                ))}
                            </>
                        )}
                        {!isFavoritesMode && results.length > 0 && results.map((city, idx) => (
                            <button 
                                key={city.id} 
                                onClick={() => selectCity(city)} 
                                className={`w-full text-left px-5 py-3 transition-colors flex items-center justify-between border-b border-white/5 last:border-0 group/item ${
                                    idx === activeIndex ? 'bg-indigo-500/20' : 'hover:bg-indigo-600/30'
                                }`}
                            >
                                <div className="flex flex-col">
                                    <span className={`font-bold transition-colors ${idx === activeIndex ? 'text-white' : 'text-slate-200'}`}>
                                        {city.name}
                                    </span>
                                    <span className={`text-[10px] uppercase tracking-wider ${idx === activeIndex ? 'text-indigo-200' : 'text-slate-500'}`}>
                                        {[city.admin1, city.country].filter(Boolean).join(', ')}
                                    </span>
                                </div>
                                <div className="flex flex-col items-end gap-1">
                                     <MapPin className={`w-4 h-4 ${idx === activeIndex ? 'text-indigo-300' : 'text-slate-500'}`} />
                                </div>
                            </button>
                        ))}
                        {!isFavoritesMode && results.length === 0 && query.trim().length > 2 && !isSearching && (
                            <div className="px-5 py-4 text-center text-sm text-slate-400">
                                {lang === 'ca' ? "No s'han trobat resultats." : "No results found."}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>

        {/* BOTONS D'ACCIÓ (DRETA) */}
        <div className="flex items-center gap-3 pointer-events-auto md:ml-auto z-10">
            
            {/* --- FIX MÒBIL: CONTROLS DE VISTA AQUÍ (Només mòbil) --- */}
            {/* Això els col·loca al costat del botó de geolocalització quan estem en mòbil */}
            <div className="flex md:hidden">
                <ViewToggleButtons />
            </div>

            <button 
                onClick={onLocate} 
                className="p-3.5 rounded-2xl bg-slate-900/60 backdrop-blur-xl border border-white/10 text-indigo-400 hover:bg-indigo-600 hover:text-white hover:border-indigo-500 transition-all shadow-lg active:scale-95 group relative overflow-hidden"
                title={lang === 'ca' ? "La meva ubicació" : "My location"}
            >
                <div className="absolute inset-0 bg-indigo-400/20 blur-lg opacity-0 group-hover:opacity-100 transition-opacity"></div>
                <LocateFixed className="w-5 h-5 relative z-10 group-hover:animate-spin-slow" />
            </button>
        </div>
    </header>
  );
}