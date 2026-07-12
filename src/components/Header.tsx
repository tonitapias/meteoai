// src/components/Header.tsx
import React, { useState, useEffect, useRef } from 'react';
import { Search, MapPin, Loader2, X, Star, Navigation, CornerDownLeft, Layers, Activity } from 'lucide-react';
import { usePreferences, LocationData } from '../hooks/usePreferences';
import { searchCity, GeoSearchResult } from '../services/geocodingService';
import * as Sentry from "@sentry/react";
import { useAppContext } from '../context/AppContext';
import { Language, TranslationType } from '../translations';

// Regex de llista negra
const DANGEROUS_CHARS = /[<>{}[\]\\/]/;

function isLocationData(item: GeoSearchResult | LocationData): item is LocationData {
    return (item as LocationData).admin1 !== undefined || (item as GeoSearchResult).id === undefined;
}

interface HeaderProps {
  lang?: Language;
  // Fem servir Partial per indicar que pot rebre l'objecte buit o incomplet
  t?: Partial<TranslationType>; 
}

export default function Header({ lang = 'ca', t = {} }: HeaderProps) {
  // 1. CONNEXIÓ AL CONTEXT
  const { actions, state, flags } = useAppContext();
  
  const onSearch = actions.fetchWeatherByCoords;
  const loading = state.loading;
  const viewMode = flags.viewMode;
  const setViewMode = actions.setViewMode;
  const onDebugToggle = actions.toggleDebug;

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

  // ============================================================================
  // SMART DICTIONARY: DICCIONARI INTERN MULTILINGÜE DEL HEADER
  // ============================================================================
  const tRecord = (t && typeof t === 'object') ? (t as Record<string, unknown>) : {};
  const tHeader = (tRecord.header && typeof tRecord.header === 'object') ? (tRecord.header as Record<string, string>) : {};

  const dict = {
    searchPlaceholder: tHeader.searchPlaceholder || (lang === 'es' ? "BUSCAR CIUDAD..." : lang === 'en' ? "SEARCH CITY..." : lang === 'fr' ? "RECHERCHER VILLE..." : "CERCAR CIUTAT..."),
    detectedLocation: tHeader.detectedLocation || (lang === 'es' ? "Ubicación detectada" : lang === 'en' ? "Detected location" : lang === 'fr' ? "Emplacement détecté" : "Ubicació detectada"),
    currentLocation: tHeader.currentLocation || (lang === 'es' ? "Ubicación actual" : lang === 'en' ? "Current location" : lang === 'fr' ? "Emplacement actuel" : "Ubicació actual"),
    geoNotSupported: tHeader.geoNotSupported || (lang === 'es' ? "Tu navegador no soporta la geolocalización." : lang === 'en' ? "Your browser does not support geolocation." : lang === 'fr' ? "Votre navigateur ne supporte pas la géolocalisation." : "El teu navegador no suporta la geolocalització."),
    geoError: tHeader.geoError || (lang === 'es' ? "No se ha podido obtener la ubicación precisa. Comprueba el GPS o la conexión." : lang === 'en' ? "Could not obtain precise location. Check GPS or connection." : lang === 'fr' ? "Impossible d'obtenir une position précise. Vérifiez le GPS ou la connexion." : "No s'ha pogut obtenir la ubicació precisa. Comprova el GPS o la connexió."),
    favorites: tHeader.favorites || (lang === 'es' ? "FAVORITOS" : lang === 'en' ? "FAVORITES" : lang === 'fr' ? "FAVORIS" : "FAVORITS"),
    results: tHeader.results || (lang === 'es' ? "RESULTADOS" : lang === 'en' ? "RESULTS" : lang === 'fr' ? "RÉSULTATS" : "RESULTATS"),
    visualMode: tHeader.visualMode || (lang === 'es' ? "MODO VISUAL" : lang === 'en' ? "VISUAL MODE" : lang === 'fr' ? "MODE VISUEL" : "MODE VISUAL"),
    basic: tHeader.basic || (lang === 'es' ? "BÁSICO" : lang === 'en' ? "BASIC" : lang === 'fr' ? "BASIQUE" : "BÀSIC"),
    expert: tHeader.expert || (lang === 'es' ? "EXPERTO" : lang === 'en' ? "EXPERT" : lang === 'fr' ? "EXPERT" : "EXPERT"),
    devMode: "DEV MODE"
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
      alert(dict.geoNotSupported);
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
      let finalName = dict.detectedLocation;
      let finalCountry = "";

      try {
          const resp = await fetch(
              `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=${lang}`
          );
          
          if (resp.ok) {
              const data = await resp.json();
              finalName = data.locality || data.city || data.town || data.village || dict.currentLocation;
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
          alert(dict.geoError);
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
    <header className="w-full flex flex-col sm:flex-row items-center justify-between gap-4 z-50 relative py-2 sm:py-0">
      
      {/* CSS INTERN PEL GLASSMORPHISM AVANÇAT I SKEUOMORFISME */}
      <style>{`
        .header-glass {
          background: linear-gradient(135deg, rgba(255, 255, 255, 0.05) 0%, rgba(255, 255, 255, 0.01) 100%);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
        }
        .physical-switch-track {
          background-color: #020617;
          box-shadow: inset 0 2px 8px rgba(0, 0, 0, 0.9), inset 0 0 0 1px rgba(255, 255, 255, 0.05);
        }
        .physical-btn-active {
          box-shadow: inset 0 1px 1px rgba(255, 255, 255, 0.3), 0 4px 15px rgba(0, 0, 0, 0.4);
        }
      `}</style>

      {/* LOGO I TÍTOL (Efecte Insígnia 3D) */}
      <div 
        onClick={handleTitleClick}
        className="flex items-center gap-3 opacity-90 hover:opacity-100 select-none cursor-pointer group transition-all w-full justify-center md:w-auto md:justify-start order-0 relative z-10"
      >
          {/* Contenidor Insígnia Físic */}
          <div className="relative p-1.5 sm:p-2 rounded-xl sm:rounded-2xl bg-gradient-to-br from-white/10 to-transparent border border-white/20 shadow-[inset_0_1px_1px_rgba(255,255,255,0.2),_0_4px_10px_rgba(0,0,0,0.5)] backdrop-blur-md group-hover:border-sky-400/50 group-hover:shadow-[0_0_20px_rgba(56,189,248,0.3)] transition-all duration-500">
             <div className="absolute inset-0 bg-sky-500/20 blur-md opacity-0 group-hover:opacity-100 transition-opacity rounded-xl"></div>
             <img 
                src={`${import.meta.env.BASE_URL}maskable-icon.png`}
                alt="Logo MeteoToni AI"
                className="w-7 h-7 sm:w-8 sm:h-8 relative z-10 transition-transform duration-500 group-hover:scale-110 drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]"
                onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none'; 
                }}
             />
          </div>
          
          <div className="flex flex-col items-center md:items-start">
             <span className="text-[10px] sm:text-xs font-black tracking-[0.3em] text-slate-300 group-hover:text-white transition-colors drop-shadow-md">METEOTONI.AI</span>
             {debugClicks > 0 && debugClicks < 5 && (
                 <span className="text-[8px] sm:text-[9px] text-emerald-400 font-mono font-bold tracking-widest bg-emerald-950/60 border border-emerald-500/30 px-1.5 py-0.5 rounded animate-pulse mt-0.5 shadow-[0_0_10px_rgba(52,211,153,0.2)]">
                     {dict.devMode}: {5 - debugClicks}
                 </span>
             )}
          </div>
      </div>

      {/* BARRA DE CERCA (Spatial UI) */}
      <div ref={wrapperRef} className="flex-1 w-full max-w-2xl relative order-2 md:order-1">
          <form 
            onSubmit={handleSubmit}
            className={`
                flex items-center gap-2 
                header-glass border transition-all duration-500 rounded-2xl p-1.5 sm:p-2 relative z-20
                ${isFocused 
                    ? 'bg-black/60 border-sky-400/50 shadow-[0_0_25px_rgba(56,189,248,0.25)] ring-1 ring-sky-400/20' 
                    : 'bg-black/40 border-white/10 hover:border-white/20 hover:bg-black/50 shadow-lg'
                }
            `}
          >
            <div className="pl-3 text-slate-500">
                {loading || isSearching ? (
                    <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 animate-spin text-sky-400" />
                ) : (
                    <Search className={`w-4 h-4 sm:w-5 sm:h-5 transition-colors ${isFocused ? 'text-sky-400' : 'text-slate-400'}`} />
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
              placeholder={dict.searchPlaceholder}
              className="flex-1 bg-transparent border-none outline-none text-xs sm:text-sm font-mono font-bold text-white placeholder:text-slate-500 h-9 px-2 uppercase tracking-wider w-full min-w-0"
              disabled={loading}
              autoComplete="off"
            />

            {query && !loading && (
                <button
                    type="button"
                    onClick={() => { setQuery(''); setSuggestions([]); setSelectedIndex(-1); }}
                    className="p-2 hover:bg-white/10 rounded-xl text-slate-400 hover:text-white transition-colors cursor-pointer"
                    aria-label="Esborrar cerca"
                >
                    <X className="w-4 h-4" />
                </button>
            )}

            <div className="w-px h-6 bg-white/10 mx-1"></div>

            <button
              type="button"
              onClick={handleLocationClick}
              disabled={loading || isLocating}
              className={`p-2.5 sm:p-3 rounded-xl border transition-all duration-300 group relative overflow-hidden cursor-pointer
                ${isLocating 
                    ? 'bg-amber-500/20 text-amber-400 border-amber-500/40 shadow-[0_0_15px_rgba(245,158,11,0.2)]' 
                    : 'bg-black/40 border-white/5 hover:bg-sky-500/20 text-slate-400 hover:text-sky-400 hover:border-sky-500/40 hover:shadow-[0_0_15px_rgba(56,189,248,0.2)]'
                }
              `}
              title="Localització"
              aria-label="Utilitzar la meva ubicació actual"
            >
                {isLocating ? (
                    <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 animate-spin drop-shadow-md" />
                ) : (
                    <MapPin className="w-4 h-4 sm:w-5 sm:h-5 group-hover:scale-110 transition-transform drop-shadow-md" />
                )}
            </button>
          </form>

          {/* DESPLEGABLE DE RESULTATS I FAVORITS */}
          {isFocused && (showFavorites || (showSuggestionsList && suggestions.length > 0)) && (
            <div className="absolute top-full left-0 w-full mt-2 bg-[#020617]/95 header-glass border border-sky-500/20 rounded-2xl shadow-[0_15px_40px_rgba(0,0,0,0.8)] overflow-hidden animate-in fade-in slide-in-from-top-2 duration-300 z-10">
                {showFavorites && (
                    <div className="py-2">
                        <div className="px-4 py-2 text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2 border-b border-white/5 bg-black/40">
                            <Star className="w-3.5 h-3.5 text-amber-400" /> {dict.favorites}
                        </div>
                        {favorites.map((fav, idx) => (
                            <button
                                key={fav.name}
                                onClick={() => handleSelectFavorite(fav)}
                                onMouseEnter={() => setSelectedIndex(idx)}
                                className={`w-full px-4 py-3 sm:py-4 flex items-center justify-between transition-all duration-200 group text-left cursor-pointer border-l-2 ${selectedIndex === idx ? 'bg-sky-950/40 border-sky-400' : 'hover:bg-white/5 border-transparent'}`}
                            >
                                <span className={`text-sm font-bold transition-colors ${selectedIndex === idx ? 'text-sky-200' : 'text-slate-300 group-hover:text-white'}`}>{fav.name}</span>
                                <div className="flex items-center gap-3">
                                    {selectedIndex === idx && <CornerDownLeft className="w-4 h-4 text-sky-400 animate-in fade-in slide-in-from-right-2" />}
                                    <Star className="w-4 h-4 text-amber-400 fill-amber-400/50 drop-shadow-[0_0_8px_rgba(251,191,36,0.6)]" />
                                </div>
                            </button>
                        ))}
                    </div>
                )}
                {showSuggestionsList && (
                    <div className="py-2">
                         <div className="px-4 py-2 text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2 border-b border-white/5 bg-black/40">
                            <Navigation className="w-3.5 h-3.5 text-sky-400" /> {dict.results}
                        </div>
                        {suggestions.map((geo, idx) => (
                            <button
                                key={geo.id}
                                onClick={() => processSelection(geo.latitude, geo.longitude, geo.name, geo.country)}
                                onMouseEnter={() => setSelectedIndex(idx)}
                                className={`w-full px-4 py-3 sm:py-4 flex items-center gap-3 transition-all duration-200 group text-left border-l-2 cursor-pointer ${selectedIndex === idx ? 'bg-sky-950/40 border-sky-400' : 'hover:bg-white/5 border-transparent'}`}
                            >
                                <div className="flex-1">
                                    <div className={`text-sm sm:text-base font-bold transition-colors ${selectedIndex === idx ? 'text-sky-200' : 'text-white'}`}>{geo.name}</div>
                                    <div className="text-[10px] sm:text-xs text-slate-400 font-mono mt-0.5">
                                        {geo.admin1 ? `${geo.admin1}, ` : ''}{geo.country}
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <span className={`text-[10px] sm:text-xs font-mono font-bold px-2 py-1 rounded bg-black/50 border border-white/5 ${selectedIndex === idx ? 'text-sky-300 border-sky-500/30 shadow-[0_0_10px_rgba(56,189,248,0.15)]' : 'text-slate-500'}`}>
                                        {geo.latitude.toFixed(2)}, {geo.longitude.toFixed(2)}
                                    </span>
                                    {selectedIndex === idx && <CornerDownLeft className="w-4 h-4 text-sky-400 animate-in fade-in slide-in-from-right-2 hidden sm:block" />}
                                </div>
                            </button>
                        ))}
                    </div>
                )}
            </div>
          )}
      </div>

      {/* SELECTOR DE MODE TÀCTIC (Efecte Carril Enfosquit i Botons Físics) */}
      <div className="flex flex-col items-center md:items-end order-1 md:order-2 w-full md:w-auto mt-1 sm:mt-0 z-10 group">
          <span className="text-[8px] sm:text-[9px] font-black text-slate-500 uppercase tracking-[0.2em] mb-1.5 hidden md:block drop-shadow-sm font-sans">
              {dict.visualMode}
          </span>
          {/* El Carril Físic Enfonsat */}
          <div className="flex items-center p-1 physical-switch-track rounded-[14px] w-full md:w-auto relative z-10">
              
              <button
                type="button"
                onClick={() => setViewMode && setViewMode('basic')}
                className={`
                    flex-1 md:flex-none flex justify-center items-center gap-2 px-4 py-2 sm:px-5 sm:py-2.5 rounded-xl text-[10px] sm:text-xs font-mono font-black uppercase tracking-widest cursor-pointer transition-all duration-300
                    ${viewMode === 'basic'
                        ? 'bg-gradient-to-b from-sky-600 to-sky-900 text-white border border-sky-400/50 physical-btn-active ring-1 ring-sky-500/30'
                        : 'text-slate-500 hover:text-slate-300 hover:bg-white/5 border border-transparent'}
                `}
                aria-pressed={viewMode === 'basic'}
              >
                  {/* Indicador LED actiu/inactiu */}
                  <div className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${viewMode === 'basic' ? 'bg-sky-300 shadow-[0_0_8px_rgba(56,189,248,1)]' : 'bg-slate-700'}`}></div>
                  <Layers className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${viewMode === 'basic' ? 'text-sky-100 drop-shadow-[0_2px_2px_rgba(0,0,0,0.5)]' : ''}`} /> 
                  <span className={viewMode === 'basic' ? 'drop-shadow-[0_2px_2px_rgba(0,0,0,0.5)]' : ''}>{dict.basic}</span>
              </button>
              
              <button
                type="button"
                onClick={() => setViewMode && setViewMode('expert')}
                className={`
                    flex-1 md:flex-none flex justify-center items-center gap-2 px-4 py-2 sm:px-5 sm:py-2.5 rounded-xl text-[10px] sm:text-xs font-mono font-black uppercase tracking-widest cursor-pointer transition-all duration-300
                    ${viewMode === 'expert'
                        ? 'bg-gradient-to-b from-indigo-600 to-indigo-900 text-white border border-indigo-400/50 physical-btn-active ring-1 ring-indigo-500/30'
                        : 'text-slate-500 hover:text-slate-300 hover:bg-white/5 border border-transparent'}
                `}
                aria-pressed={viewMode === 'expert'}
              >
                  {/* Indicador LED actiu/inactiu */}
                  <div className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${viewMode === 'expert' ? 'bg-indigo-300 shadow-[0_0_8px_rgba(129,140,248,1)] animate-pulse' : 'bg-slate-700'}`}></div>
                  <Activity className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${viewMode === 'expert' ? 'text-indigo-100 drop-shadow-[0_2px_2px_rgba(0,0,0,0.5)]' : ''}`} /> 
                  <span className={viewMode === 'expert' ? 'drop-shadow-[0_2px_2px_rgba(0,0,0,0.5)]' : ''}>{dict.expert}</span>
              </button>

          </div>
      </div>
    </header>
  );
}