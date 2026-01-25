import React, { useState, useEffect, useRef } from 'react';
import { Search, MapPin, Loader2, X, Star, Navigation, CornerDownLeft, Layers, Activity } from 'lucide-react';
import { usePreferences, LocationData } from '../hooks/usePreferences';

interface HeaderProps {
  onSearch: (lat: number, lon: number, name?: string, country?: string) => void;
  onLocate: () => void;
  loading: boolean;
  viewMode: 'basic' | 'expert';
  setViewMode: (mode: 'basic' | 'expert') => void;
}

interface GeoResult {
  id: number;
  name: string;
  admin1?: string;
  country?: string;
  latitude: number;
  longitude: number;
}

function isLocationData(item: GeoResult | LocationData): item is LocationData {
    return (item as LocationData).admin1 !== undefined || (item as GeoResult).id === undefined;
}

export default function Header({ onSearch, onLocate, loading, viewMode, setViewMode }: HeaderProps) {
  const { favorites } = usePreferences();
  const [query, setQuery] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [suggestions, setSuggestions] = useState<GeoResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const showFavorites = query.length === 0 && favorites.length > 0;
  const showSuggestionsList = query.length >= 3;
  const activeList: (GeoResult | LocationData)[] = showSuggestionsList ? suggestions : (showFavorites ? favorites : []);

  useEffect(() => {
    setSelectedIndex(-1);
  }, [query, suggestions, showFavorites]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsFocused(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    const timer = setTimeout(async () => {
      if (query.length < 3) {
        setSuggestions([]);
        return;
      }
      setIsSearching(true);
      try {
        const response = await fetch(
          `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=5&language=ca&format=json`
        );
        const data = await response.json();
        setSuggestions(data.results || []);
      } catch (error) {
        console.error("Error:", error);
      } finally {
        setIsSearching(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  const processSelection = (lat: number, lon: number, name: string, country?: string) => {
    setQuery('');
    onSearch(lat, lon, name, country);
    setIsFocused(false);
    setSelectedIndex(-1);
  };

  const handleSelectFavorite = (fav: LocationData) => {
      if (fav.latitude && fav.longitude) {
          processSelection(fav.latitude, fav.longitude, fav.name, fav.country);
      } else {
          console.warn("Favorit sense coordenades");
      }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedIndex >= 0 && activeList[selectedIndex]) {
        const item = activeList[selectedIndex];
        
        if (isLocationData(item)) {
             handleSelectFavorite(item);
        } else {
             const geo = item as GeoResult;
             processSelection(geo.latitude, geo.longitude, geo.name, geo.country);
        }
    } else if (suggestions.length > 0) {
        const topHit = suggestions[0];
        processSelection(topHit.latitude, topHit.longitude, topHit.name, topHit.country);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
      if (!isFocused || activeList.length === 0) return;
      if (e.key === 'ArrowDown') {
          e.preventDefault();
          setSelectedIndex(prev => (prev + 1) % activeList.length);
      } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          setSelectedIndex(prev => (prev - 1 + activeList.length) % activeList.length);
      } else if (e.key === 'Escape') {
          setIsFocused(false);
          setSelectedIndex(-1);
      }
  };

  return (
    <header className="w-full flex flex-col sm:flex-row items-center justify-between gap-4 z-50 relative">
      <div className="hidden md:flex items-center gap-2 opacity-50 select-none w-[140px]">
          <div className="w-2 h-2 bg-indigo-500 rounded-full animate-pulse"></div>
          <span className="text-xs font-black tracking-[0.3em] text-slate-500">METEO.AI</span>
      </div>

      <div ref={wrapperRef} className="flex-1 w-full max-w-2xl relative order-2 md:order-1">
          <form 
            onSubmit={handleSubmit}
            className={`
                flex items-center gap-2 
                bg-[#0f111a] border transition-all duration-500 rounded-2xl p-1.5 relative z-20
                ${isFocused 
                    ? 'border-indigo-500/50 shadow-[0_0_30px_-5px_rgba(99,102,241,0.3)] ring-1 ring-indigo-500/20' 
                    : 'border-white/5 hover:border-white/10 shadow-lg'
                }
            `}
          >
            <div className="pl-3 text-slate-500">
                {loading || isSearching ? (
                    <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />
                ) : (
                    <Search className={`w-4 h-4 transition-colors ${isFocused ? 'text-indigo-400' : 'text-slate-600'}`} />
                )}
            </div>

            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onFocus={() => setIsFocused(true)}
              onKeyDown={handleKeyDown}
              // MILLORA ACCESS: Placeholder més clar (slate-500 vs slate-600)
              placeholder="CERCAR CIUTAT..."
              className="flex-1 bg-transparent border-none outline-none text-sm font-mono font-medium text-white placeholder:text-slate-500 h-9 px-2 uppercase tracking-wider w-full min-w-0"
              disabled={loading}
              autoComplete="off"
            />

            {query && !loading && (
                <button
                    type="button"
                    onClick={() => { setQuery(''); setSuggestions([]); setSelectedIndex(-1); }}
                    className="p-1.5 hover:bg-white/10 rounded-lg text-slate-500 hover:text-white transition-colors mr-1"
                    aria-label="Esborrar cerca"
                >
                    <X className="w-3.5 h-3.5" />
                </button>
            )}

            <div className="w-px h-5 bg-white/10 mx-1"></div>

            <button
              type="button"
              onClick={onLocate}
              disabled={loading}
              className="p-2 rounded-xl bg-white/5 hover:bg-indigo-500/20 text-slate-400 hover:text-indigo-400 border border-transparent hover:border-indigo-500/30 transition-all active:scale-95 group relative overflow-hidden"
              title="La meva ubicació"
              aria-label="Utilitzar la meva ubicació actual"
            >
                <MapPin className="w-4 h-4 group-hover:scale-110 transition-transform" />
            </button>
          </form>

          {isFocused && (showFavorites || (showSuggestionsList && suggestions.length > 0)) && (
            <div className="absolute top-full left-0 w-full mt-2 bg-[#0B0C15]/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200 z-10 ring-1 ring-white/5">
                {showFavorites && (
                    <div className="py-2">
                        <div className="px-4 py-2 text-[9px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                            <Star className="w-3 h-3 text-amber-500/50" /> FAVORITS
                        </div>
                        {favorites.map((fav, idx) => (
                            <button
                                key={fav.name}
                                onClick={() => handleSelectFavorite(fav)}
                                onMouseEnter={() => setSelectedIndex(idx)}
                                className={`w-full px-4 py-3 flex items-center justify-between transition-colors group text-left ${selectedIndex === idx ? 'bg-white/10' : 'hover:bg-white/5'}`}
                            >
                                <span className="text-sm font-bold text-slate-300 group-hover:text-white transition-colors">{fav.name}</span>
                                <div className="flex items-center gap-3">
                                    {selectedIndex === idx && <CornerDownLeft className="w-3.5 h-3.5 text-slate-500 animate-in fade-in slide-in-from-right-1" />}
                                    <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                                </div>
                            </button>
                        ))}
                    </div>
                )}
                {showSuggestionsList && (
                    <div className="py-2">
                         <div className="px-4 py-2 text-[9px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                            <Navigation className="w-3 h-3 text-indigo-500/50" /> RESULTATS
                        </div>
                        {suggestions.map((geo, idx) => (
                            <button
                                key={geo.id}
                                onClick={() => processSelection(geo.latitude, geo.longitude, geo.name, geo.country)}
                                onMouseEnter={() => setSelectedIndex(idx)}
                                className={`w-full px-4 py-3 flex items-center gap-3 transition-colors group text-left border-l-2 ${selectedIndex === idx ? 'bg-white/10 border-indigo-500' : 'hover:bg-white/5 border-transparent'}`}
                            >
                                <div className="flex-1">
                                    <div className="text-sm font-bold text-white">{geo.name}</div>
                                    <div className="text-xs text-slate-500 font-mono mt-0.5 opacity-70">
                                        {geo.admin1 ? `${geo.admin1}, ` : ''}{geo.country}
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <span className={`text-[10px] font-mono ${selectedIndex === idx ? 'text-indigo-300' : 'text-slate-600'}`}>
                                        {geo.latitude.toFixed(2)}, {geo.longitude.toFixed(2)}
                                    </span>
                                    {selectedIndex === idx && <CornerDownLeft className="w-3.5 h-3.5 text-indigo-500 animate-in fade-in slide-in-from-right-1" />}
                                </div>
                            </button>
                        ))}
                    </div>
                )}
            </div>
          )}
      </div>

      <div className="flex items-center gap-1 p-1 bg-[#0f111a] border border-white/5 rounded-xl order-1 md:order-2 w-full md:w-auto justify-center md:justify-end">
          <button 
            onClick={() => setViewMode && setViewMode('basic')} 
            className={`
                flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all
                ${viewMode === 'basic' ? 'bg-white/10 text-white shadow-sm' : 'text-slate-400 hover:text-slate-300'} 
            `}
            // MILLORA ACCESS: Text-slate-400 enlloc de 500 per millor contrast en estat desactivat
          >
              <Layers className="w-3 h-3" /> BÀSIC
          </button>
          <button 
            onClick={() => setViewMode && setViewMode('expert')} 
            className={`
                flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all
                ${viewMode === 'expert' ? 'bg-indigo-500/20 text-indigo-300 shadow-sm border border-indigo-500/30' : 'text-slate-400 hover:text-slate-300'}
            `}
          >
              <Activity className="w-3 h-3" /> EXPERT
          </button>
      </div>
    </header>
  );
}