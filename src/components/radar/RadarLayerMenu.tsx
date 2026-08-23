import { useEffect, useRef } from 'react';
import { 
  Layers, 
  Eye, 
  EyeOff, 
  Check, 
  X as CloseIcon, 
  Moon, 
  Camera, 
  CloudRain, 
  Satellite, 
  Map as MapIcon, 
  Type as TypeIcon,
  Flame,
  Mountain
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { BaseLayerType, BaseLayerConfig } from '../../utils/radarPhysics';

interface RadarLayerMenuProps {
  showLayerMenu: boolean;
  setShowLayerMenu: (show: boolean) => void;
  activeBaseLayer: BaseLayerType;
  setActiveBaseLayer: (layer: BaseLayerType) => void;
  overlays: { 
    precip: boolean; 
    satIR: boolean; 
    hdGoes: boolean;
    hdMeteosat: boolean;
    hdHimawari: boolean;
    night: boolean; 
    labels: boolean; 
    nasaReal: boolean;
    nasaFires: boolean;
    terrain3D: boolean;
  };
  toggleOverlay: (key: 'precip' | 'satIR' | 'hdGoes' | 'hdMeteosat' | 'hdHimawari' | 'night' | 'labels' | 'nasaReal' | 'nasaFires' | 'terrain3D') => void;
  baseLayers: Record<BaseLayerType, BaseLayerConfig>;
}

export function RadarLayerMenu({ 
  showLayerMenu, 
  setShowLayerMenu, 
  activeBaseLayer, 
  setActiveBaseLayer, 
  overlays, 
  toggleOverlay, 
  baseLayers 
}: RadarLayerMenuProps) {
  const { t } = useTranslation();
  
  // Referències per detectar on clica l'usuari
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Lògica per a l'Easter Egg de la NASA
  const nightClickCountRef = useRef(0);
  const nightClickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleNightEasterEgg = () => {
    // 1. Fem l'acció normal d'encendre/apagar l'ombra
    toggleOverlay('night');

    // 2. Comptabilitzem el clic per a l'Easter Egg
    nightClickCountRef.current += 1;

    if (nightClickCountRef.current >= 3) {
      // S'ha activat el codi secret! (3 tocs ràpids)
      if (activeBaseLayer === 'black_marble') {
        setActiveBaseLayer('dark'); // Si ja hi érem, tornem a un estat normal
      } else {
        setActiveBaseLayer('black_marble'); // Activem la telemetria prohibida
      }
      setShowLayerMenu(false); // Tanquem el menú dramàticament
      nightClickCountRef.current = 0;
    }

    // Reiniciem el comptador si triga massa entre tocs (1 segon de marge)
    if (nightClickTimerRef.current) {
      clearTimeout(nightClickTimerRef.current);
    }
    nightClickTimerRef.current = setTimeout(() => {
      nightClickCountRef.current = 0;
    }, 1000);
  };

  // Efecte només per controlar el Click-Outside (Sense col·lisions amb el Modal pare)
  useEffect(() => {
    if (!showLayerMenu) return;

    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node;
      if (
        menuRef.current && 
        !menuRef.current.contains(target) &&
        buttonRef.current &&
        !buttonRef.current.contains(target)
      ) {
        setShowLayerMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
      if (nightClickTimerRef.current) clearTimeout(nightClickTimerRef.current);
    };
  }, [showLayerMenu, setShowLayerMenu]);

  return (
    <div className="absolute top-[max(env(safe-area-inset-top,16px),16px)] right-[max(env(safe-area-inset-right,16px),16px)] bottom-[110px] z-[1010] flex flex-col items-end pointer-events-none">
      {/* Botó Principal */}
      <button 
        ref={buttonRef}
        onClick={() => setShowLayerMenu(!showLayerMenu)} 
        className={`shrink-0 pointer-events-auto relative p-3.5 sm:p-4 rounded-2xl backdrop-blur-2xl border transition-all duration-300 shadow-[0_8px_32px_rgba(0,0,0,0.8)] active:scale-95 group overflow-hidden ${
          showLayerMenu 
            ? 'bg-cyan-950/80 border-cyan-400 text-cyan-300 shadow-[0_0_25px_rgba(6,182,212,0.35)] scale-[0.98]' 
            : 'bg-black/65 border-white/15 text-slate-200 hover:bg-black/80 hover:text-white hover:border-white/30 hover:shadow-[0_0_15px_rgba(255,255,255,0.15)]'
        }`} 
        title={t('layerControl')}
        aria-label={t('layerControl')}
      >
        {/* Efecte de resplendor intern quan està actiu */}
        {showLayerMenu && <div className="absolute inset-0 bg-gradient-to-br from-cyan-400/20 to-transparent opacity-50 mix-blend-overlay"></div>}
        <Layers className={`relative z-10 w-5 h-5 sm:w-6 sm:h-6 drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] transition-transform duration-300 ${showLayerMenu ? 'rotate-180 scale-110' : 'group-hover:scale-110'}`} />
      </button>

      {/* Menú Desplegable */}
      {showLayerMenu && (
        <div ref={menuRef} className="pointer-events-auto pt-3 w-[calc(100vw-32px)] max-w-[340px] sm:max-w-[360px] shrink min-h-0 max-h-full flex flex-col animate-in fade-in zoom-in-95 origin-top-right duration-200">
          <div className="flex flex-col flex-1 min-h-0 bg-slate-950/85 sm:bg-slate-950/80 backdrop-blur-3xl border border-white/15 rounded-2xl shadow-[0_30px_80px_rgba(0,0,0,0.95)] ring-1 ring-white/5 overflow-hidden transform-gpu">
            
            {/* Header del Menú */}
            <div className="shrink-0 flex items-center justify-between py-3.5 px-4 border-b border-white/10 bg-gradient-to-b from-white/[0.06] to-transparent">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 rounded-lg bg-cyan-500/20 border border-cyan-400/30">
                  <Layers className="w-4 h-4 text-cyan-300" />
                </div>
                <span className="text-[11px] sm:text-xs font-mono font-black uppercase tracking-[0.15em] text-cyan-100 drop-shadow-[0_0_8px_rgba(6,182,212,0.5)] truncate">
                  {t('layerControl', 'Capes i Telemetria')}
                </span>
              </div>
              <button 
                onClick={() => setShowLayerMenu(false)} 
                className="p-1.5 sm:p-2 rounded-xl bg-white/5 hover:bg-white/20 border border-transparent hover:border-white/10 text-slate-400 hover:text-white transition-all shadow-sm active:scale-90 group"
                aria-label="Tancar menú de capes"
              >
                <CloseIcon className="w-4 h-4 group-hover:rotate-90 transition-transform duration-200" />
              </button>
            </div>

            {/* Contingut del Menú (Scrollable) */}
            <div className="flex flex-col flex-1 min-h-0 overflow-y-auto overscroll-contain p-4 space-y-6 [scrollbar-width:thin] [scrollbar-color:rgba(6,182,212,0.4)_transparent] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-cyan-500/30 hover:[&::-webkit-scrollbar-thumb]:bg-cyan-400/60 [&::-webkit-scrollbar-thumb]:rounded-full">
              
              {/* Secció: Capes Base */}
              <div className="space-y-3 shrink-0">
                <div className="flex items-center gap-2 px-1">
                  <div className="w-1 h-3 rounded-full bg-cyan-500 shadow-[0_0_8px_rgba(6,182,212,0.8)]"></div>
                  <span className="text-[10px] sm:text-[11px] font-mono font-bold uppercase tracking-[0.2em] text-slate-400 drop-shadow-md">
                    {t('baseMapTitle', 'Mapa Base')}
                  </span>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {(Object.keys(baseLayers) as BaseLayerType[])
                    .filter((key) => key !== 'black_marble') // AMAGUEM L'EASTER EGG DE LA UI
                    .map((key) => {
                      const layer = baseLayers[key];
                      const isActive = activeBaseLayer === key;
                      
                      return (
                        <button 
                          key={key} 
                          onClick={() => {
                            setActiveBaseLayer(key);
                            setShowLayerMenu(false);
                          }} 
                          className={`group relative flex items-center justify-between p-3 min-h-[44px] rounded-xl border transition-all duration-300 backdrop-blur-md overflow-hidden ${
                            isActive 
                              ? 'bg-cyan-950/60 border-cyan-400/50 shadow-[0_0_15px_rgba(6,182,212,0.2)]' 
                              : 'bg-white/[0.03] border-white/10 hover:bg-white/[0.08] hover:border-white/20 active:scale-[0.98]'
                          }`}
                        >
                          {isActive && <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/10 to-transparent"></div>}
                          <div className="relative flex items-center gap-2.5 truncate">
                            <MapIcon className={`w-4 h-4 shrink-0 transition-colors duration-200 ${isActive ? 'text-cyan-400 drop-shadow-[0_0_5px_rgba(6,182,212,0.8)]' : 'text-slate-500 group-hover:text-slate-300'}`} />
                            <span className={`text-xs font-bold truncate transition-colors duration-200 ${isActive ? 'text-cyan-100 font-black' : 'text-slate-300 group-hover:text-white'}`}>
                              {layer.name}
                            </span>
                          </div>
                          {isActive && <Check className="w-4 h-4 shrink-0 ml-2 text-cyan-400 drop-shadow-[0_0_8px_rgba(6,182,212,0.8)] relative" />}
                        </button>
                      );
                    })}
                </div>
              </div>

              {/* Línia Separadora Visual */}
              <div className="h-px w-full bg-gradient-to-r from-transparent via-white/10 to-transparent shrink-0"></div>

              {/* Secció: Overlays (Telemetria) */}
              <div className="space-y-3 shrink-0 pb-2">
                <div className="flex items-center gap-2 px-1">
                  <div className="w-1 h-3 rounded-full bg-indigo-400 shadow-[0_0_8px_rgba(129,140,248,0.8)]"></div>
                  <span className="text-[10px] sm:text-[11px] font-mono font-bold uppercase tracking-[0.2em] text-slate-400 drop-shadow-md">
                    {t('overlayTitle', 'Anomalies i Dades')}
                  </span>
                </div>
                
                <div className="space-y-2.5">
                  
                  {/* Overlay: Precipitació */}
                  <button 
                    onClick={() => toggleOverlay('precip')} 
                    className={`group relative w-full flex items-center justify-between p-3 min-h-[48px] rounded-xl border transition-all duration-300 backdrop-blur-md overflow-hidden ${
                      overlays.precip 
                        ? 'bg-cyan-950/60 border-cyan-400/50 shadow-[inset_0_0_20px_rgba(6,182,212,0.15)]' 
                        : 'bg-white/[0.03] hover:bg-white/[0.06] border-white/10 hover:border-white/20 active:scale-[0.98]'
                    }`}
                  >
                    {overlays.precip && <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/10 to-transparent"></div>}
                    <div className="relative flex items-center gap-3 truncate pr-2">
                      <div className={`p-1.5 rounded-lg transition-colors ${overlays.precip ? 'bg-cyan-500/20 text-cyan-300' : 'bg-white/5 text-slate-400 group-hover:text-slate-300 group-hover:bg-white/10'}`}>
                        <CloudRain className="w-4 h-4" />
                      </div>
                      <span className={`text-xs font-bold truncate transition-colors ${overlays.precip ? 'text-cyan-100' : 'text-slate-300 group-hover:text-white'}`}>
                        {t('layerPrecip', 'Precipitació')}
                      </span>
                    </div>
                    {overlays.precip ? <Eye className="w-5 h-5 text-cyan-400 drop-shadow-[0_0_8px_rgba(6,182,212,0.8)] shrink-0 relative" /> : <EyeOff className="w-4 h-4 text-slate-500 group-hover:text-slate-400 shrink-0" />}
                  </button>
                  
                  {/* Overlay: Satèl·lit IR (GLOBAL) */}
                  <button 
                    onClick={() => toggleOverlay('satIR')} 
                    className={`group relative w-full flex items-center justify-between p-3 min-h-[48px] rounded-xl border transition-all duration-300 backdrop-blur-md overflow-hidden ${
                      overlays.satIR 
                        ? 'bg-cyan-950/60 border-cyan-400/50 shadow-[inset_0_0_20px_rgba(6,182,212,0.15)]' 
                        : 'bg-white/[0.03] hover:bg-white/[0.06] border-white/10 hover:border-white/20 active:scale-[0.98]'
                    }`}
                  >
                    {overlays.satIR && <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/10 to-transparent"></div>}
                    <div className="relative flex items-center gap-3 truncate pr-2">
                      <div className={`p-1.5 rounded-lg transition-colors ${overlays.satIR ? 'bg-cyan-500/20 text-cyan-300' : 'bg-white/5 text-slate-400 group-hover:text-slate-300 group-hover:bg-white/10'}`}>
                        <Satellite className="w-4 h-4" />
                      </div>
                      <span className={`text-xs font-bold truncate transition-colors ${overlays.satIR ? 'text-cyan-100' : 'text-slate-300 group-hover:text-white'}`}>
                        {t('layerSat', 'Satèl·lit')} <span className={`font-normal text-[11px] transition-opacity ${overlays.satIR ? 'opacity-90' : 'opacity-60 group-hover:opacity-100'}`}>{t('layerSatAnim', '(IR Global)')}</span>
                      </span>
                    </div>
                    {overlays.satIR ? <Eye className="w-5 h-5 text-cyan-400 drop-shadow-[0_0_8px_rgba(6,182,212,0.8)] shrink-0 relative" /> : <EyeOff className="w-4 h-4 text-slate-500 group-hover:text-slate-400 shrink-0" />}
                  </button>
                  
                  {/* Overlay: NASA Real */}
                  <button 
                    onClick={() => toggleOverlay('nasaReal')} 
                    className={`group relative w-full flex items-center justify-between p-3 min-h-[48px] rounded-xl border transition-all duration-300 backdrop-blur-md overflow-hidden ${
                      overlays.nasaReal 
                        ? 'bg-cyan-950/60 border-cyan-400/50 shadow-[inset_0_0_20px_rgba(6,182,212,0.15)]' 
                        : 'bg-white/[0.03] hover:bg-white/[0.06] border-white/10 hover:border-white/20 active:scale-[0.98]'
                    }`}
                  >
                    {overlays.nasaReal && <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/10 to-transparent"></div>}
                    <div className="relative flex items-center gap-3 truncate pr-2">
                      <div className={`p-1.5 rounded-lg transition-colors ${overlays.nasaReal ? 'bg-cyan-500/20 text-cyan-300' : 'bg-white/5 text-slate-400 group-hover:text-slate-300 group-hover:bg-white/10'}`}>
                        <Camera className="w-4 h-4" />
                      </div>
                      <span className={`text-xs font-bold truncate transition-colors ${overlays.nasaReal ? 'text-cyan-100' : 'text-slate-300 group-hover:text-white'}`}>
                        {t('layerNasa', 'Imatge Satèl·lit (NASA)')}
                      </span>
                    </div>
                    {overlays.nasaReal ? <Eye className="w-5 h-5 text-cyan-400 drop-shadow-[0_0_8px_rgba(6,182,212,0.8)] shrink-0 relative" /> : <EyeOff className="w-4 h-4 text-slate-500 group-hover:text-slate-400 shrink-0" />}
                  </button>

                  {/* Overlay: NASA Incendis */}
                  <button 
                    onClick={() => toggleOverlay('nasaFires')} 
                    className={`group relative w-full flex items-center justify-between p-3 min-h-[48px] rounded-xl border transition-all duration-300 backdrop-blur-md overflow-hidden ${
                      overlays.nasaFires 
                        ? 'bg-orange-950/60 border-orange-400/50 shadow-[inset_0_0_20px_rgba(249,115,22,0.15)]' 
                        : 'bg-white/[0.03] hover:bg-white/[0.06] border-white/10 hover:border-white/20 active:scale-[0.98]'
                    }`}
                  >
                    {overlays.nasaFires && <div className="absolute inset-0 bg-gradient-to-r from-orange-500/10 to-transparent"></div>}
                    <div className="relative flex items-center gap-3 truncate pr-2">
                      <div className={`p-1.5 rounded-lg transition-colors ${overlays.nasaFires ? 'bg-orange-500/20 text-orange-400' : 'bg-white/5 text-slate-400 group-hover:text-slate-300 group-hover:bg-white/10'}`}>
                        <Flame className="w-4 h-4" />
                      </div>
                      <span className={`text-xs font-bold truncate transition-colors ${overlays.nasaFires ? 'text-orange-100' : 'text-slate-300 group-hover:text-white'}`}>
                        {t('layerNasaFires', 'Incendis Actius (NASA)')}
                      </span>
                    </div>
                    {overlays.nasaFires ? <Eye className="w-5 h-5 text-orange-400 drop-shadow-[0_0_8px_rgba(249,115,22,0.8)] shrink-0 relative" /> : <EyeOff className="w-4 h-4 text-slate-500 group-hover:text-slate-400 shrink-0" />}
                  </button>

                  {/* Overlay: Relleu 3D */}
                  <button 
                    onClick={() => toggleOverlay('terrain3D')} 
                    className={`group relative w-full flex items-center justify-between p-3 min-h-[48px] rounded-xl border transition-all duration-300 backdrop-blur-md overflow-hidden ${
                      overlays.terrain3D 
                        ? 'bg-emerald-950/60 border-emerald-400/50 shadow-[inset_0_0_20px_rgba(16,185,129,0.15)]' 
                        : 'bg-white/[0.03] hover:bg-white/[0.06] border-white/10 hover:border-white/20 active:scale-[0.98]'
                    }`}
                  >
                    {overlays.terrain3D && <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/10 to-transparent"></div>}
                    <div className="relative flex items-center gap-3 truncate pr-2">
                      <div className={`p-1.5 rounded-lg transition-colors ${overlays.terrain3D ? 'bg-emerald-500/20 text-emerald-400' : 'bg-white/5 text-slate-400 group-hover:text-slate-300 group-hover:bg-white/10'}`}>
                        <Mountain className="w-4 h-4" />
                      </div>
                      <span className={`text-xs font-bold truncate transition-colors ${overlays.terrain3D ? 'text-emerald-100' : 'text-slate-300 group-hover:text-white'}`}>
                        {t('layerTerrain3D', 'Relleu 3D i Muntanyes')}
                      </span>
                    </div>
                    {overlays.terrain3D ? <Eye className="w-5 h-5 text-emerald-400 drop-shadow-[0_0_8px_rgba(16,185,129,0.8)] shrink-0 relative" /> : <EyeOff className="w-4 h-4 text-slate-500 group-hover:text-slate-400 shrink-0" />}
                  </button>
                  
                  {/* Overlay: Nit */}
                  <button 
                    onClick={handleNightEasterEgg} 
                    className={`group relative w-full flex items-center justify-between p-3 min-h-[48px] rounded-xl border transition-all duration-300 backdrop-blur-md overflow-hidden ${
                      overlays.night 
                        ? 'bg-indigo-950/60 border-indigo-400/50 shadow-[inset_0_0_20px_rgba(99,102,241,0.15)]' 
                        : 'bg-white/[0.03] hover:bg-white/[0.06] border-white/10 hover:border-white/20 active:scale-[0.98]'
                    }`}
                  >
                    {overlays.night && <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/10 to-transparent"></div>}
                    <div className="relative flex items-center gap-3 truncate pr-2">
                      <div className={`p-1.5 rounded-lg transition-colors ${overlays.night ? 'bg-indigo-500/20 text-indigo-300' : 'bg-white/5 text-slate-400 group-hover:text-slate-300 group-hover:bg-white/10'}`}>
                        <Moon className="w-4 h-4" />
                      </div>
                      <span className={`text-xs font-bold truncate transition-colors ${overlays.night ? 'text-indigo-100' : 'text-slate-300 group-hover:text-white'}`}>
                        {t('layerNight', 'Nit en Temps Real')}
                      </span>
                    </div>
                    {overlays.night ? <Eye className="w-5 h-5 text-indigo-400 drop-shadow-[0_0_8px_rgba(129,140,248,0.8)] shrink-0 relative" /> : <EyeOff className="w-4 h-4 text-slate-500 group-hover:text-slate-400 shrink-0" />}
                  </button>
                  
                  {/* Overlay: Etiquetes */}
                  <button 
                    onClick={() => toggleOverlay('labels')} 
                    className={`group relative w-full flex items-center justify-between p-3 min-h-[48px] rounded-xl border transition-all duration-300 backdrop-blur-md overflow-hidden ${
                      overlays.labels 
                        ? 'bg-cyan-950/60 border-cyan-400/50 shadow-[inset_0_0_20px_rgba(6,182,212,0.15)]' 
                        : 'bg-white/[0.03] hover:bg-white/[0.06] border-white/10 hover:border-white/20 active:scale-[0.98]'
                    }`}
                  >
                    {overlays.labels && <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/10 to-transparent"></div>}
                    <div className="relative flex items-center gap-3 truncate pr-2">
                      <div className={`p-1.5 rounded-lg transition-colors ${overlays.labels ? 'bg-cyan-500/20 text-cyan-300' : 'bg-white/5 text-slate-400 group-hover:text-slate-300 group-hover:bg-white/10'}`}>
                        <TypeIcon className="w-4 h-4" />
                      </div>
                      <span className={`text-xs font-bold truncate transition-colors ${overlays.labels ? 'text-cyan-100' : 'text-slate-300 group-hover:text-white'}`}>
                        {t('layerLabels', 'Etiquetes i Ciutats')}
                      </span>
                    </div>
                    {overlays.labels ? <Eye className="w-5 h-5 text-cyan-400 drop-shadow-[0_0_8px_rgba(6,182,212,0.8)] shrink-0 relative" /> : <EyeOff className="w-4 h-4 text-slate-500 group-hover:text-slate-400 shrink-0" />}
                  </button>
                </div>
              </div>

              {/* Línia Separadora Visual per al Mode Expert */}
              <div className="h-px w-full bg-gradient-to-r from-transparent via-fuchsia-500/30 to-transparent shrink-0 mt-2 mb-1"></div>

              {/* --- INICI: SECCIÓ MODE EXPERT HD --- */}
              <div className="space-y-3 shrink-0 pb-2">
                <div className="flex items-center justify-between px-1">
                  <div className="flex items-center gap-2">
                    <div className="w-1 h-3 rounded-full bg-fuchsia-500 shadow-[0_0_8px_rgba(217,70,239,0.8)]"></div>
                    <span className="text-[10px] sm:text-[11px] font-mono font-bold uppercase tracking-[0.2em] text-slate-400 drop-shadow-md">
                     {t('layerHDTitle', 'Satèl·lits Alta Resolució')}
                    </span>
                  </div>
                  <span className="text-[9px] font-mono font-bold text-fuchsia-400 bg-fuchsia-950/50 border border-fuchsia-500/30 px-1.5 py-0.5 rounded tracking-wider">EXPERT</span>
                </div>
                
                <div className="space-y-2.5">
                  {/* Botó Meteosat (Europa) */}
                  <button 
                    onClick={() => toggleOverlay('hdMeteosat')} 
                    className={`group relative w-full flex items-center justify-between p-3 min-h-[48px] rounded-xl border transition-all duration-300 backdrop-blur-md overflow-hidden ${
                      overlays.hdMeteosat 
                        ? 'bg-fuchsia-950/60 border-fuchsia-400/50 shadow-[inset_0_0_20px_rgba(217,70,239,0.15)]' 
                        : 'bg-white/[0.03] hover:bg-white/[0.06] border-white/10 hover:border-white/20 active:scale-[0.98]'
                    }`}
                  >
                    {overlays.hdMeteosat && <div className="absolute inset-0 bg-gradient-to-r from-fuchsia-500/10 to-transparent"></div>}
                    <div className="relative flex items-center gap-3 truncate pr-2">
                      <div className={`p-1.5 rounded-lg transition-colors ${overlays.hdMeteosat ? 'bg-fuchsia-500/20 text-fuchsia-300' : 'bg-white/5 text-slate-400 group-hover:text-slate-300 group-hover:bg-white/10'}`}>
                        <Satellite className="w-4 h-4" />
                      </div>
                      <span className={`text-xs font-bold truncate transition-colors ${overlays.hdMeteosat ? 'text-fuchsia-100' : 'text-slate-300 group-hover:text-white'}`}>
                        {t('layerhdMeteosat', 'Meteosat HD (Europa)')}
                      </span>
                    </div>
                    {overlays.hdMeteosat ? <Eye className="w-5 h-5 text-fuchsia-400 drop-shadow-[0_0_8px_rgba(217,70,239,0.8)] shrink-0 relative" /> : <EyeOff className="w-4 h-4 text-slate-500 group-hover:text-slate-400 shrink-0" />}
                  </button>

                  {/* Botó GOES (Amèrica) */}
                  <button 
                    onClick={() => toggleOverlay('hdGoes')} 
                    className={`group relative w-full flex items-center justify-between p-3 min-h-[48px] rounded-xl border transition-all duration-300 backdrop-blur-md overflow-hidden ${
                      overlays.hdGoes 
                        ? 'bg-fuchsia-950/60 border-fuchsia-400/50 shadow-[inset_0_0_20px_rgba(217,70,239,0.15)]' 
                        : 'bg-white/[0.03] hover:bg-white/[0.06] border-white/10 hover:border-white/20 active:scale-[0.98]'
                    }`}
                  >
                    {overlays.hdGoes && <div className="absolute inset-0 bg-gradient-to-r from-fuchsia-500/10 to-transparent"></div>}
                    <div className="relative flex items-center gap-3 truncate pr-2">
                      <div className={`p-1.5 rounded-lg transition-colors ${overlays.hdGoes ? 'bg-fuchsia-500/20 text-fuchsia-300' : 'bg-white/5 text-slate-400 group-hover:text-slate-300 group-hover:bg-white/10'}`}>
                        <Satellite className="w-4 h-4" />
                      </div>
                      <span className={`text-xs font-bold truncate transition-colors ${overlays.hdGoes ? 'text-fuchsia-100' : 'text-slate-300 group-hover:text-white'}`}>
                        {t('layerhdGoes', 'GOES HD (Amèrica)')}
                      </span>
                    </div>
                    {overlays.hdGoes ? <Eye className="w-5 h-5 text-fuchsia-400 drop-shadow-[0_0_8px_rgba(217,70,239,0.8)] shrink-0 relative" /> : <EyeOff className="w-4 h-4 text-slate-500 group-hover:text-slate-400 shrink-0" />}
                  </button>

                  {/* Botó Himawari (Àsia/Pacífic) */}
                  <button 
                    onClick={() => toggleOverlay('hdHimawari')} 
                    className={`group relative w-full flex items-center justify-between p-3 min-h-[48px] rounded-xl border transition-all duration-300 backdrop-blur-md overflow-hidden ${
                      overlays.hdHimawari 
                        ? 'bg-fuchsia-950/60 border-fuchsia-400/50 shadow-[inset_0_0_20px_rgba(217,70,239,0.15)]' 
                        : 'bg-white/[0.03] hover:bg-white/[0.06] border-white/10 hover:border-white/20 active:scale-[0.98]'
                    }`}
                  >
                    {overlays.hdHimawari && <div className="absolute inset-0 bg-gradient-to-r from-fuchsia-500/10 to-transparent"></div>}
                    <div className="relative flex items-center gap-3 truncate pr-2">
                      <div className={`p-1.5 rounded-lg transition-colors ${overlays.hdHimawari ? 'bg-fuchsia-500/20 text-fuchsia-300' : 'bg-white/5 text-slate-400 group-hover:text-slate-300 group-hover:bg-white/10'}`}>
                        <Satellite className="w-4 h-4" />
                      </div>
                      <span className={`text-xs font-bold truncate transition-colors ${overlays.hdHimawari ? 'text-fuchsia-100' : 'text-slate-300 group-hover:text-white'}`}>
                        {t('layerhdHimawari', 'Himawari HD (Àsia)')}
                      </span>
                    </div>
                    {overlays.hdHimawari ? <Eye className="w-5 h-5 text-fuchsia-400 drop-shadow-[0_0_8px_rgba(217,70,239,0.8)] shrink-0 relative" /> : <EyeOff className="w-4 h-4 text-slate-500 group-hover:text-slate-400 shrink-0" />}
                  </button>
                </div>
              </div>
              {/* --- FI: SECCIÓ MODE EXPERT HD --- */}

            </div>
          </div>
        </div>
      )}
    </div>
  );
}