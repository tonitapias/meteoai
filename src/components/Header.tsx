// src/components/Header.tsx
import React, { useState, useEffect, useRef } from 'react';
import { Search, MapPin, Loader2, X, Star, Navigation, CornerDownLeft, Layers, Activity } from 'lucide-react';
import { usePreferences, LocationData } from '../hooks/usePreferences';
import { searchCity, GeoSearchResult } from '../services/geocodingService';
import * as Sentry from "@sentry/react";
import { useAppContext } from '../context/AppContext';

// Regex de llista negra
const DANGEROUS_CHARS = /[<>{}[\]\\/]/;

function isLocationData(item: GeoSearchResult | LocationData): item is LocationData {
    return (item as LocationData).admin1 !== undefined || (item as GeoSearchResult).id === undefined;
}

// JA NO NECESSITEM INTERFACE HeaderProps NI PROPS

export default function Header() {
  // 1. CONNEXIÓ AL CONTEXT (Substitueix les props)
  const { actions, state, flags } = useAppContext();
  
  // Mapegem les variables del context als noms que feies servir abans
  // per no haver de canviar tot el codi de sota
  const onSearch = actions.fetchWeatherByCoords;
  const loading = state.loading;
  const viewMode = flags.viewMode;
  const setViewMode = actions.setViewMode;
  const onDebugToggle = actions.toggleDebug;

  // --- A PARTIR D'AQUÍ, TOT EL CODI ÉS IDÈNTIC AL QUE TENIES ---
  const { favorites } = usePreferences();
  const [query, setQuery] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [suggestions, setSuggestions] = useState<GeoSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [isLocating, setIsLocating] = useState(false); 
  const wrapperRef = useRef<HTMLDivElement>(null);

  // --- LÒGICA DEBUG MODE (5 CLICS) ---
  const [debugClicks, setDebugClicks] = useState(0);

  useEffect(() => {
    if (debugClicks === 0) return;
    const timer = setTimeout(() => setDebugClicks(0), 2000);
    return () => clearTimeout(timer);
  }, [debugClicks]);

  const handleTitleClick = () => {
    const newCount = debugClicks + 1;
    setDebugClicks(newCount);
    
    if (newCount === 5) {
      if (onDebugToggle) onDebugToggle();
      setDebugClicks(0);
    }
  };

  const showFavorites = query.length === 0 && favorites.length > 0;
  const showSuggestionsList = query.length >= 3;
  const activeList: (GeoSearchResult | LocationData)[] = showSuggestionsList ? suggestions : (showFavorites ? favorites : []);

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
      const cleanQuery = query.trim();

      if (cleanQuery.length < 3) {
        setSuggestions([]);
        return;
      }

      if (DANGEROUS_CHARS.test(cleanQuery)) {
        console.warn("Input sanitization blocked dangerous characters");
        setSuggestions([]);
        return;
      }

      setIsSearching(true);
      const results = await searchCity(cleanQuery);
      setSuggestions(results);
      setSelectedIndex(-1); 
      setIsSearching(false);
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  // --- LÒGICA DE GEOLOCALITZACIÓ ---
  const handleLocationClick = () => {
    if (isLocating || loading) return;
    setIsLocating(true);
    
    if (!navigator.geolocation) {
      alert("El teu navegador no suporta la geolocalització.");
      setIsLocating(false);
      return;
    }

    const getPosition = (highAccuracy: boolean): Promise<GeolocationPosition> => {
        return new Promise((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(
                resolve, 
                reject, 
                {
                    enableHighAccuracy: highAccuracy,
                    timeout: highAccuracy ? 5000 : 10000,
                    maximumAge: 60000 
                }
            );
        });
    };

    getPosition(true)
        .then((pos) => {
            handleLocationFound(pos);
        })
        .catch(async (err: GeolocationPositionError) => {
            if (err.code === 3) {
                console.warn("⚠️ GPS Timeout. Reintentant amb baixa precisió...");
                try {
                    const fallbackPos = await getPosition(false);
                    handleLocationFound(fallbackPos);
                    
                    Sentry.addBreadcrumb({
                        category: "geolocation",
                        message: "Recovered from GPS Timeout using Low Accuracy",
                        level: "info"
                    });
                } catch (fallbackErr) {
                    reportGeoError(fallbackErr as GeolocationPositionError);
                }
            } else {
                reportGeoError(err);
            }
        });
  };

  const handleLocationFound = async (pos: GeolocationPosition) => {
      const { latitude, longitude } = pos.coords;
      let finalName = "Ubicació detectada";
      let finalCountry = "";

      try {
          const resp = await fetch(
              `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=ca`
          );
          
          if (resp.ok) {
              const data = await resp.json();
              finalName = data.locality || data.city || data.town || data.village || "Ubicació actual";
              finalCountry = data.countryName || "";
          }
      } catch (e) {
          console.warn("Error obtenint nom de la ciutat:", e);
      }

      onSearch(latitude, longitude, finalName, finalCountry);
      setIsLocating(false);
  };

  const reportGeoError = (err: GeolocationPositionError) => {
      setIsLocating(false);
      if (err.code !== 1) { 
          console.error("❌ Error Geolocalització:", err.message);
          Sentry.captureException(new Error(`Geolocation Failed: ${err.message}`), { 
              tags: { service: 'Geolocation', strategy: 'fallback_implemented' },
              extra: { code: err.code }
          });
          alert("No s'ha pogut obtenir la ubicació precisa. Comprova el GPS o la connexió.");
      }
  };

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
             const geo = item as GeoSearchResult;
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
      <div 
        onClick={handleTitleClick}
        className="flex md:flex items-center gap-3 opacity-80 select-none cursor-pointer group transition-all w-full justify-center md:w-auto md:justify-start order-0"
      >
          <div className="relative">
             <div className="absolute inset-0 bg-indigo-500 blur-lg opacity-0 group-hover:opacity-40 transition-opacity rounded-full"></div>
             <img 
                src={`${import.meta.env.BASE_URL}maskable-icon.png`}
                alt="Logo MeteoAI"
                className="w-8 h-8 relative z-10 transition-transform duration-500 group-hover:scale-110 group-hover:rotate-6"
                onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none'; 
                }}
             />
          </div>
          <div className="flex flex-col items-start">
             <span className="text-xs font-black tracking-[0.3em] text-slate-400 group-hover:text-indigo-400 transition-colors">METEOTONI.AI</span>
             {debugClicks > 0 && debugClicks < 5 && (
                 <span className="text-[9px] text-green-500 font-mono animate-pulse">DEV MODE: {5 - debugClicks}</span>
             )}
          </div>
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
              onChange={(e) => {
                  setQuery(e.target.value);
                  setSelectedIndex(-1); 
              }}
              onFocus={() => setIsFocused(true)}
              onKeyDown={handleKeyDown}
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
              onClick={handleLocationClick}
              disabled={loading || isLocating}
              className={`p-2 rounded-xl border border-transparent transition-all active:scale-95 group relative overflow-hidden
                ${isLocating 
                    ? 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30' 
                    : 'bg-white/5 hover:bg-indigo-500/20 text-slate-400 hover:text-indigo-400 hover:border-indigo-500/30'
                }
              `}
              title="La meva ubicació"
              aria-label="Utilitzar la meva ubicació actual"
            >
                {isLocating ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                    <MapPin className="w-4 h-4 group-hover:scale-110 transition-transform" />
                )}
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