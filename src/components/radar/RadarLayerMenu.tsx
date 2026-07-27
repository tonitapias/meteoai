import { Layers, Eye, EyeOff, Check, X as CloseIcon, Moon, Camera } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { BaseLayerType, BaseLayerConfig } from '../../utils/radarPhysics';

interface RadarLayerMenuProps {
  showLayerMenu: boolean;
  setShowLayerMenu: (show: boolean) => void;
  activeBaseLayer: BaseLayerType;
  setActiveBaseLayer: (layer: BaseLayerType) => void;
  overlays: { precip: boolean; satIR: boolean; night: boolean; labels: boolean; nasaReal: boolean };
  toggleOverlay: (key: 'precip' | 'satIR' | 'night' | 'labels' | 'nasaReal') => void;
  baseLayers: Record<BaseLayerType, BaseLayerConfig>;
}

export function RadarLayerMenu({ showLayerMenu, setShowLayerMenu, activeBaseLayer, setActiveBaseLayer, overlays, toggleOverlay, baseLayers }: RadarLayerMenuProps) {
  const { t } = useTranslation();

  return (
    <div className="absolute top-[max(env(safe-area-inset-top,16px),16px)] right-[max(env(safe-area-inset-right,16px),16px)] bottom-[110px] z-[1010] flex flex-col items-end pointer-events-none">
      <button 
        onClick={() => setShowLayerMenu(!showLayerMenu)} 
        className={`shrink-0 pointer-events-auto p-3.5 sm:p-4 rounded-2xl backdrop-blur-2xl border transition-all duration-300 shadow-[0_8px_32px_rgba(0,0,0,0.8)] active:scale-95 ${
          showLayerMenu 
            ? 'bg-black/85 border-cyan-400 text-cyan-300 shadow-[0_0_25px_rgba(6,182,212,0.35)] scale-[0.98]' 
            : 'bg-black/60 border-white/15 text-slate-200 hover:bg-black/80 hover:text-white hover:border-white/30 hover:shadow-[0_0_15px_rgba(255,255,255,0.1)]'
        }`} 
        title={t('layerControl')}
        aria-label={t('layerControl')}
      >
        <Layers className="w-5 h-5 sm:w-6 sm:h-6 drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]" />
      </button>

      {showLayerMenu && (
        <div className="pointer-events-auto pt-3 w-[calc(100vw-32px)] max-w-[320px] sm:max-w-[340px] shrink min-h-0 max-h-full flex flex-col animate-in fade-in zoom-in-95 origin-top-right duration-200">
          <div className="flex flex-col flex-1 min-h-0 bg-black/85 sm:bg-black/80 backdrop-blur-2xl border border-white/20 rounded-2xl shadow-[0_25px_70px_rgba(0,0,0,0.95)] ring-1 ring-cyan-500/20 overflow-hidden transform-gpu">
            <div className="shrink-0 flex items-center justify-between py-3.5 px-4 sm:px-5 border-b border-white/15 bg-gradient-to-b from-white/[0.08] to-transparent">
              <span className="text-[11px] sm:text-xs font-mono font-black uppercase tracking-[0.2em] text-cyan-400 drop-shadow-[0_0_8px_rgba(6,182,212,0.5)] flex items-center gap-2">
                <Layers className="w-3.5 h-3.5 text-cyan-300 shrink-0" />
                <span className="truncate">{t('layerControl', 'Capes i Telemetria')}</span>
              </span>
              <button 
                onClick={() => setShowLayerMenu(false)} 
                className="p-1.5 sm:p-2 rounded-xl bg-white/5 hover:bg-white/15 border border-white/10 text-slate-300 hover:text-white transition-all shadow-sm active:scale-90"
                aria-label="Tancar menú de capes"
              >
                <CloseIcon className="w-4 h-4" />
              </button>
            </div>

            <div className="flex flex-col flex-1 min-h-0 overflow-y-auto overscroll-contain p-4 sm:p-5 space-y-5 [scrollbar-width:thin] [scrollbar-color:rgba(6,182,212,0.4)_transparent] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-cyan-500/30 hover:[&::-webkit-scrollbar-thumb]:bg-cyan-400/60 [&::-webkit-scrollbar-thumb]:rounded-full">
              <div className="space-y-2.5 shrink-0">
                <span className="text-[10px] sm:text-[11px] font-mono font-black uppercase tracking-[0.2em] text-slate-300 block drop-shadow-md">
                  {t('baseMapTitle')}
                </span>
                <div className="grid grid-cols-2 gap-2">
                  {(Object.keys(baseLayers) as BaseLayerType[]).map((key) => {
                    const layer = baseLayers[key];
                    const isActive = activeBaseLayer === key;
                    return (
                      <button 
                        key={key} 
                        onClick={() => setActiveBaseLayer(key)} 
                        className={`flex items-center justify-between p-3 rounded-xl text-xs font-bold transition-all duration-300 backdrop-blur-md ${
                          isActive 
                            ? 'bg-cyan-500/25 text-cyan-200 border border-cyan-400/70 shadow-[0_0_15px_rgba(6,182,212,0.3)] font-black' 
                            : 'bg-white/[0.04] text-slate-300 hover:bg-white/10 hover:text-white border border-white/10 active:scale-95'
                        }`}
                      >
                        <span className="truncate drop-shadow-md">{layer.name}</span>
                        {isActive && <Check className="w-4 h-4 shrink-0 ml-1.5 text-cyan-400 drop-shadow-[0_0_8px_rgba(6,182,212,0.8)]" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-2.5 shrink-0 pt-3 border-t border-white/15">
                <span className="text-[10px] sm:text-[11px] font-mono font-black uppercase tracking-[0.2em] text-slate-300 block drop-shadow-md">
                  {t('overlayTitle')}
                </span>
                <div className="space-y-2">
                  <button 
                    onClick={() => toggleOverlay('precip')} 
                    className={`w-full flex items-center justify-between p-3.5 rounded-xl border transition-all text-xs font-bold backdrop-blur-md ${
                      overlays.precip 
                        ? 'bg-cyan-950/50 border-cyan-400/60 text-cyan-100 shadow-[inset_0_0_15px_rgba(6,182,212,0.2)]' 
                        : 'bg-white/[0.04] hover:bg-white/10 border-white/10 text-slate-200 active:scale-[0.99]'
                    }`}
                  >
                    <span className="drop-shadow-md">{t('layerPrecip')}</span>
                    {overlays.precip ? <Eye className="w-5 h-5 text-cyan-400 drop-shadow-[0_0_8px_rgba(6,182,212,0.8)] shrink-0" /> : <EyeOff className="w-5 h-5 text-slate-500 shrink-0" />}
                  </button>
                  
                  <button 
                    onClick={() => toggleOverlay('satIR')} 
                    className={`w-full flex items-center justify-between p-3.5 rounded-xl border transition-all text-xs font-bold backdrop-blur-md ${
                      overlays.satIR 
                        ? 'bg-cyan-950/50 border-cyan-400/60 text-cyan-100 shadow-[inset_0_0_15px_rgba(6,182,212,0.2)]' 
                        : 'bg-white/[0.04] hover:bg-white/10 border-white/10 text-slate-200 active:scale-[0.99]'
                    }`}
                  >
                    <span className="drop-shadow-md truncate pr-2">{t('layerSat')} <span className="font-normal text-[11px] opacity-75">{t('layerSatAnim', '(IR Animació)')}</span></span>
                    {overlays.satIR ? <Eye className="w-5 h-5 text-cyan-400 drop-shadow-[0_0_8px_rgba(6,182,212,0.8)] shrink-0" /> : <EyeOff className="w-5 h-5 text-slate-500 shrink-0" />}
                  </button>
                  
                  <button 
                    onClick={() => toggleOverlay('nasaReal')} 
                    className={`w-full flex items-center justify-between p-3.5 rounded-xl transition-all text-xs font-bold backdrop-blur-md border ${
                      overlays.nasaReal 
                        ? 'bg-cyan-950/60 border-cyan-400/70 text-cyan-100 shadow-[inset_0_0_18px_rgba(6,182,212,0.25)]' 
                        : 'bg-white/[0.04] hover:bg-white/10 border-white/10 text-slate-200 active:scale-[0.99]'
                    }`}
                  >
                    <span className="drop-shadow-md flex items-center gap-2 truncate pr-2">
                      <Camera className={`w-4 h-4 shrink-0 ${overlays.nasaReal ? 'text-cyan-300 drop-shadow-[0_0_6px_rgba(6,182,212,0.8)]' : 'text-slate-400'}`} /> 
                      <span className="truncate">{t('layerNasa', 'Foto Terra (NASA)')}</span>
                    </span>
                    {overlays.nasaReal ? <Eye className="w-5 h-5 text-cyan-400 drop-shadow-[0_0_8px_rgba(6,182,212,0.8)] shrink-0" /> : <EyeOff className="w-5 h-5 text-slate-500 shrink-0" />}
                  </button>
                  
                  <button 
                    onClick={() => toggleOverlay('night')} 
                    className={`w-full flex items-center justify-between p-3.5 rounded-xl border transition-all text-xs font-bold backdrop-blur-md ${
                      overlays.night 
                        ? 'bg-cyan-950/50 border-cyan-400/60 text-cyan-100 shadow-[inset_0_0_15px_rgba(6,182,212,0.2)]' 
                        : 'bg-white/[0.04] hover:bg-white/10 border-white/10 text-slate-200 active:scale-[0.99]'
                    }`}
                  >
                    <span className="drop-shadow-md flex items-center gap-2 truncate pr-2">
                      <Moon className={`w-3.5 h-3.5 shrink-0 ${overlays.night ? 'text-cyan-300' : 'text-slate-400'}`} /> 
                      <span className="truncate">{t('layerNight', 'Nit')}</span>
                    </span>
                    {overlays.night ? <Eye className="w-5 h-5 text-cyan-400 drop-shadow-[0_0_8px_rgba(6,182,212,0.8)] shrink-0" /> : <EyeOff className="w-5 h-5 text-slate-500 shrink-0" />}
                  </button>
                  
                  <button 
                    onClick={() => toggleOverlay('labels')} 
                    className={`w-full flex items-center justify-between p-3.5 rounded-xl border transition-all text-xs font-bold backdrop-blur-md ${
                      overlays.labels 
                        ? 'bg-cyan-950/50 border-cyan-400/60 text-cyan-100 shadow-[inset_0_0_15px_rgba(6,182,212,0.2)]' 
                        : 'bg-white/[0.04] hover:bg-white/10 border-white/10 text-slate-200 active:scale-[0.99]'
                    }`}
                  >
                    <span className="drop-shadow-md truncate pr-2">{t('layerLabels')}</span>
                    {overlays.labels ? <Eye className="w-5 h-5 text-cyan-400 drop-shadow-[0_0_8px_rgba(6,182,212,0.8)] shrink-0" /> : <EyeOff className="w-5 h-5 text-slate-500 shrink-0" />}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}