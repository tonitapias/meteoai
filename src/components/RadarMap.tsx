import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { AlertTriangle, RefreshCw, Play, Pause, Radio, Layers, Eye, EyeOff, Check, X as CloseIcon } from 'lucide-react';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN || '';

if (MAPBOX_TOKEN) {
  mapboxgl.accessToken = MAPBOX_TOKEN;
} else {
  console.error("Alerta: No s'ha detectat VITE_MAPBOX_TOKEN al fitxer .env");
}

const RadarFrameSchema = z.object({
  time: z.number(),
  path: z.string(),
});

const RainViewerResponseSchema = z.object({
  host: z.string(),
  radar: z.object({
    past: z.array(RadarFrameSchema).default([]),
    nowcast: z.array(RadarFrameSchema).default([]),
  }).optional(),
  satellite: z.object({
    infrared: z.array(RadarFrameSchema).default([]),
  }).optional(),
});

type RadarFrame = z.infer<typeof RadarFrameSchema>;
type BaseLayerType = 'dark' | 'light' | 'relief' | 'sat_optic';
type MapView = 'radar' | 'wind';

interface BaseLayerConfig {
  name: string;
  url: string;
  attribution: string;
}

let globalRadarCache: { data: z.infer<typeof RainViewerResponseSchema>; timestamp: number } | null = null;
let globalRadarFetchPromise: Promise<z.infer<typeof RainViewerResponseSchema>> | null = null;
const CACHE_TTL = 5 * 60 * 1000;

interface RadarMapProps {
  lat: number;
  lon: number;
  isActive: boolean;
  activeView?: MapView;
}

export default function RadarMap({ lat, lon, isActive, activeView = 'radar' }: RadarMapProps) {
  const { t } = useTranslation();
  
  const BASE_LAYERS: Record<BaseLayerType, BaseLayerConfig> = useMemo(() => ({
    dark: { name: t('baseDark'), url: 'https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png', attribution: '&copy; CARTO' },
    light: { name: t('baseLight'), url: 'https://a.basemaps.cartocdn.com/light_all/{z}/{x}/{y}@2x.png', attribution: '&copy; CARTO' },
    relief: { name: t('baseRelief'), url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}', attribution: '&copy; Esri' },
    sat_optic: { name: t('baseSat'), url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', attribution: '&copy; Esri' },
  }), [t]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentFrameIndex, setCurrentFrameIndex] = useState(0);
  const [activeBaseLayer, setActiveBaseLayer] = useState<BaseLayerType>('dark');
  const [overlays, setOverlays] = useState({ precip: true, satIR: true, labels: true });
  const [showLayerMenu, setShowLayerMenu] = useState(false);

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const hostRef = useRef<string>('');
  const radarFramesRef = useRef<RadarFrame[]>([]);
  const satFramesRef = useRef<RadarFrame[]>([]);
  
  const loadedRadarIdsRef = useRef<Record<number, string>>({});
  const loadedSatIdsRef = useRef<Record<number, string>>({});
  
  const animationTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const currentFrameIndexRef = useRef<number>(0);
  const timeDisplayRef = useRef<HTMLSpanElement>(null);
  const overlaysRef = useRef(overlays);
  const activeViewRef = useRef(activeView);
  const isMountedRef = useRef(true);
  
  useEffect(() => { overlaysRef.current = overlays; }, [overlays]);
  useEffect(() => { activeViewRef.current = activeView; }, [activeView]);
  useEffect(() => { if (!isActive && isPlaying) setIsPlaying(false); }, [isActive, isPlaying]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; };
  }, []);

  const formatTime = useCallback((ts?: number | null) => {
    if (!ts || isNaN(ts)) return "--:--";
    return new Date(ts * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }, []);

  const cleanupExpiredLayers = useCallback((validRadarFrames: RadarFrame[], validSatFrames: RadarFrame[]) => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;

    const activeRadarTimes = new Set(validRadarFrames.map(f => f.time));
    const activeSatTimes = new Set(validSatFrames.map(f => f.time));

    Object.keys(loadedRadarIdsRef.current).forEach((key) => {
      const idx = Number(key);
      const layerId = loadedRadarIdsRef.current[idx];
      if (!layerId) return;
      
      const timeStr = layerId.replace('rad-layer-', '');
      const timestamp = Number(timeStr);

      if (!timestamp || isNaN(timestamp) || !activeRadarTimes.has(timestamp)) {
        const radSourceId = `rad-src-${timestamp}`;
        try {
          if (map.getLayer(layerId)) map.removeLayer(layerId);
          if (map.getSource(radSourceId)) map.removeSource(radSourceId);
          delete loadedRadarIdsRef.current[idx];
        } catch (e) {
          console.warn(`[Garbage Collector] Error netejant VRAM radar (${layerId}):`, e);
        }
      }
    });

    Object.keys(loadedSatIdsRef.current).forEach((key) => {
      const idx = Number(key);
      const layerId = loadedSatIdsRef.current[idx];
      if (!layerId) return;

      const timeStr = layerId.replace('sat-layer-', '');
      const timestamp = Number(timeStr);

      if (!timestamp || isNaN(timestamp) || !activeSatTimes.has(timestamp)) {
        const satSourceId = `sat-src-${timestamp}`;
        try {
          if (map.getLayer(layerId)) map.removeLayer(layerId);
          if (map.getSource(satSourceId)) map.removeSource(satSourceId);
          delete loadedSatIdsRef.current[idx];
        } catch (e) {
          console.warn(`[Garbage Collector] Error netejant VRAM satèl·lit (${layerId}):`, e);
        }
      }
    });
  }, []);

  const ensureFrameLoaded = useCallback((index: number) => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded() || !hostRef.current) return;
    
    const rFrames = radarFramesRef.current;
    const sFrames = satFramesRef.current;
    
    if (!rFrames || rFrames.length === 0 || index < 0 || index >= rFrames.length) return;
    const rFrame = rFrames[index];
    if (!rFrame || !rFrame.time) return;

    const radSourceId = `rad-src-${rFrame.time}`;
    const radLayerId = `rad-layer-${rFrame.time}`;
    const beforeLayer = map.getLayer('layer-labels') ? 'layer-labels' : undefined;

    const isTarget = index === currentFrameIndexRef.current;
    const isRadarActive = activeViewRef.current === 'radar';
    const initialRadOpacity = (isTarget && isRadarActive && overlaysRef.current.precip) ? 0.85 : 0;

    if (!loadedRadarIdsRef.current[index] && !map.getSource(radSourceId)) {
      map.addSource(radSourceId, {
        type: 'raster',
        tiles: [`${hostRef.current}${rFrame.path}/256/{z}/{x}/{y}/6/1_1.png`],
        tileSize: 256,
        maxzoom: 6,
      });
      map.addLayer({
        id: radLayerId,
        type: 'raster',
        source: radSourceId,
        layout: { visibility: 'visible' },
        paint: { 
          'raster-opacity': initialRadOpacity, 
          'raster-fade-duration': 0,
          'raster-resampling': 'linear',
          'raster-contrast': 0.10,
        },
      }, beforeLayer);
      loadedRadarIdsRef.current[index] = radLayerId;
    }

    if (sFrames && sFrames.length > 0) {
      let closestSatIdx = 0;
      let minDiff = Infinity;
      sFrames.forEach((sFrame, sIdx) => {
        if (!sFrame || !sFrame.time) return;
        const diff = Math.abs(sFrame.time - rFrame.time);
        if (diff < minDiff) { minDiff = diff; closestSatIdx = sIdx; }
      });
      
      const sFrame = sFrames[closestSatIdx];
      if (sFrame && sFrame.time) {
        const satSourceId = `sat-src-${sFrame.time}`;
        const satLayerId = `sat-layer-${sFrame.time}`;
        const initialSatOpacity = (isTarget && isRadarActive && overlaysRef.current.satIR) ? 0.80 : 0;

        if (!loadedSatIdsRef.current[closestSatIdx] && !map.getSource(satSourceId)) {
          map.addSource(satSourceId, {
            type: 'raster',
            tiles: [`${hostRef.current}${sFrame.path}/256/{z}/{x}/{y}/0/0_0.png`],
            tileSize: 256,
            maxzoom: 5,
          });
          map.addLayer({
            id: satLayerId,
            type: 'raster',
            source: satSourceId,
            layout: { visibility: 'visible' },
            paint: {
              'raster-opacity': initialSatOpacity,
              'raster-contrast': 0.18,
              'raster-brightness-min': 0.05,
              'raster-resampling': 'linear',
              'raster-fade-duration': 0,
            },
          }, beforeLayer);
          loadedSatIdsRef.current[closestSatIdx] = satLayerId;
        }
      }
    }
  }, []);

  const applyFrameVisibility = useCallback((index: number) => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;

    const rFramesCount = radarFramesRef.current.length;
    if (rFramesCount === 0) return;

    const safeIndex = (index % rFramesCount + rFramesCount) % rFramesCount;

    ensureFrameLoaded(safeIndex);
    ensureFrameLoaded((safeIndex + 1) % rFramesCount);
    ensureFrameLoaded((safeIndex + 2) % rFramesCount);

    const targetRadarId = loadedRadarIdsRef.current[safeIndex];
    const currentRadarFrame = radarFramesRef.current[safeIndex];

    if (timeDisplayRef.current && currentRadarFrame) {
      timeDisplayRef.current.textContent = formatTime(currentRadarFrame.time);
    }

    const isRadarViewActive = activeViewRef.current === 'radar';

    Object.values(loadedRadarIdsRef.current).forEach((id) => {
      if (id && map.getLayer(id)) {
        const isTarget = id === targetRadarId;
        const targetOpacity = (isRadarViewActive && overlaysRef.current.precip && isTarget) ? 0.85 : 0;
        map.setPaintProperty(id, 'raster-opacity', targetOpacity);
      }
    });

    if (satFramesRef.current.length > 0 && currentRadarFrame) {
      let closestSatIdx = 0;
      let minDiff = Infinity;
      satFramesRef.current.forEach((sFrame, sIdx) => {
        if (!sFrame || !sFrame.time) return;
        const diff = Math.abs(sFrame.time - currentRadarFrame.time);
        if (diff < minDiff) { minDiff = diff; closestSatIdx = sIdx; }
      });
      
      const targetSatId = loadedSatIdsRef.current[closestSatIdx];
      
      Object.values(loadedSatIdsRef.current).forEach((id) => {
        if (id && map.getLayer(id)) {
          const isTarget = id === targetSatId;
          const targetOpacity = (isRadarViewActive && overlaysRef.current.satIR && isTarget) ? 0.80 : 0;
          map.setPaintProperty(id, 'raster-opacity', targetOpacity);
        }
      });
    }
  }, [ensureFrameLoaded, formatTime]);

  const injectLayersIntoMap = useCallback((parsedData: z.infer<typeof RainViewerResponseSchema>) => {
    const map = mapRef.current;
    if (!map) return;

    const { host, radar, satellite } = parsedData;
    hostRef.current = host;
    
    const rFrames = (radar?.past || []).filter(f => f && f.time);
    const sFrames = (satellite?.infrared || []).filter(f => f && f.time);

    radarFramesRef.current = rFrames;
    satFramesRef.current = sFrames;

    cleanupExpiredLayers(rFrames, sFrames);

    if (rFrames.length === 0) return;

    const initialIdx = Math.max(0, rFrames.length - 1);
    currentFrameIndexRef.current = initialIdx;
    setCurrentFrameIndex(initialIdx);
    
    ensureFrameLoaded(initialIdx);
    if (rFrames.length > 1) {
      setTimeout(() => ensureFrameLoaded(0), 100);
    }
    
    applyFrameVisibility(initialIdx);

    map.once('idle', () => applyFrameVisibility(currentFrameIndexRef.current));
    setTimeout(() => applyFrameVisibility(currentFrameIndexRef.current), 150);
  }, [ensureFrameLoaded, applyFrameVisibility, cleanupExpiredLayers]);

  const fetchAndInjectRadarData = useCallback(async (forceFetch = false) => {
    if (!isMountedRef.current) return;
    setLoading(true);
    
    try {
      const now = Date.now();
      if (!forceFetch && globalRadarCache && (now - globalRadarCache.timestamp < CACHE_TTL)) {
        injectLayersIntoMap(globalRadarCache.data);
        if (isMountedRef.current) { setError(false); setLoading(false); }
        return;
      }

      if (!globalRadarFetchPromise || forceFetch) {
        globalRadarFetchPromise = (async () => {
          const response = await fetch('https://api.librewxr.net/public/weather-maps.json');
          if (!response.ok) throw new Error(`Error HTTP: ${response.status}`);
          return await response.json();
        })();
      }

      const rawData = await globalRadarFetchPromise;
      const parsed = RainViewerResponseSchema.safeParse(rawData);
      
      if (!parsed.success) { 
        if (isMountedRef.current) setError(true); 
        return; 
      }
      
      globalRadarCache = { data: parsed.data, timestamp: now };
      if (isMountedRef.current) {
        injectLayersIntoMap(parsed.data);
        setError(false);
      }
    } catch (err) {
      console.error("Error obtenint dades de radar:", err);
      if (isMountedRef.current) setError(true);
    } finally {
      globalRadarFetchPromise = null;
      if (isMountedRef.current) setLoading(false);
    }
  }, [injectLayersIntoMap]);

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;
    
    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: { version: 8, sources: {}, layers: [] },
      center: [lon, lat],
      zoom: 7.5,
      attributionControl: false,
      maxZoom: 18,
      minZoom: 3,
      fadeDuration: 0,
    });
    mapRef.current = map;
    
    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'top-left');

    const handleTouchOrClick = () => setShowLayerMenu(false);
    map.on('mousedown', handleTouchOrClick);
    map.on('touchstart', handleTouchOrClick);

    map.on('load', () => {
      (Object.keys(BASE_LAYERS) as BaseLayerType[]).forEach((key) => {
        const config = BASE_LAYERS[key];
        map.addSource(`base-src-${key}`, { type: 'raster', tiles: [config.url], tileSize: 256, attribution: config.attribution });
        map.addLayer({
          id: `base-layer-${key}`,
          type: 'raster',
          source: `base-src-${key}`,
          layout: { visibility: key === activeBaseLayer ? 'visible' : 'none' },
          paint: { 'raster-opacity': 1 },
        });
      });
      
      map.addSource('labels-src', { type: 'raster', tiles: ['https://a.basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}@2x.png'], tileSize: 256 });
      map.addLayer({
        id: 'layer-labels',
        type: 'raster',
        source: 'labels-src',
        layout: { visibility: 'visible' },
        paint: { 'raster-opacity': 0.9 },
      });
      
      fetchAndInjectRadarData();
    });

    return () => {
      if (animationTimerRef.current) clearInterval(animationTimerRef.current);
      if (mapRef.current) { 
        mapRef.current.remove(); 
        mapRef.current = null; 
      }
      loadedRadarIdsRef.current = {};
      loadedSatIdsRef.current = {};
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lat, lon, fetchAndInjectRadarData, BASE_LAYERS]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    (Object.keys(BASE_LAYERS) as BaseLayerType[]).forEach((key) => {
      const layerId = `base-layer-${key}`;
      if (map.getLayer(layerId)) {
        map.setLayoutProperty(layerId, 'visibility', key === activeBaseLayer ? 'visible' : 'none');
      }
    });
  }, [activeBaseLayer, BASE_LAYERS]);

  useEffect(() => {
    applyFrameVisibility(currentFrameIndexRef.current);
    const map = mapRef.current;
    if (map && map.isStyleLoaded() && map.getLayer('layer-labels')) {
      map.setLayoutProperty('layer-labels', 'visibility', overlays.labels ? 'visible' : 'none');
    }
  }, [overlays, activeView, applyFrameVisibility]);

  useEffect(() => {
    if (isPlaying && radarFramesRef.current.length > 0 && isActive && activeView === 'radar') {
      animationTimerRef.current = setInterval(() => {
        const totalFrames = radarFramesRef.current.length;
        if (totalFrames === 0) return; 
        
        const nextIndex = (currentFrameIndexRef.current + 1) % totalFrames;
        currentFrameIndexRef.current = nextIndex;
        applyFrameVisibility(nextIndex);
      }, 450);
    } else {
      if (animationTimerRef.current) clearInterval(animationTimerRef.current);
    }
    return () => { if (animationTimerRef.current) clearInterval(animationTimerRef.current); };
  }, [isPlaying, isActive, activeView, applyFrameVisibility]);

  const togglePlay = () => {
    if (radarFramesRef.current.length === 0) return;
    const nextPlayState = !isPlaying;
    setIsPlaying(nextPlayState);
    if (!nextPlayState) {
      setCurrentFrameIndex(currentFrameIndexRef.current);
    } else {
      currentFrameIndexRef.current = 0;
      applyFrameVisibility(0);
    }
  };

  const currentFrame = radarFramesRef.current[currentFrameIndex] || null;
  const MATRIX_BG = `absolute inset-0 z-0 opacity-[0.03] pointer-events-none bg-[linear-gradient(to_right,#ffffff_1px,transparent_1px),linear-gradient(to_bottom,#ffffff_1px,transparent_1px)] bg-[size:12px_12px]`;

  if (error) {
    return (
      <div className="absolute inset-0 z-[1001] flex flex-col items-center justify-center bg-gradient-to-br from-[#0f111a]/95 to-black/90 backdrop-blur-md p-6 text-center">
        <div className={MATRIX_BG}></div>
        <div className="w-16 h-16 rounded-full bg-rose-950/40 border border-rose-500/30 shadow-[inset_0_1px_8px_rgba(244,63,94,0.3)] flex items-center justify-center mb-4 relative z-10">
          <AlertTriangle className="w-8 h-8 text-rose-500 drop-shadow-[0_0_12px_rgba(244,63,94,0.6)]" />
        </div>
        <span className="text-white font-black tracking-widest uppercase mb-1 z-10 text-base">{t('errRadarDown')}</span>
        <span className="text-xs text-slate-300 font-mono mb-6 max-w-xs z-10">{t('errRadarDesc')}</span>
        <button onClick={() => fetchAndInjectRadarData(true)} className="px-6 py-3 bg-[#0a0b10] border border-white/20 hover:bg-white/10 text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all active:scale-95 z-10 shadow-lg">
          {t('btnForceSync')}
        </button>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full min-h-0 overflow-hidden bg-[#020308] select-none">
      {loading && (
        <div className="absolute inset-0 z-[1001] flex flex-col items-center justify-center bg-[#020308]/80 backdrop-blur-md transition-opacity duration-300">
          <div className={MATRIX_BG}></div>
          <div className="relative w-14 h-14 flex items-center justify-center mb-4 z-10">
            <div className="absolute inset-0 border-[3px] border-cyan-500/20 rounded-full"></div>
            <div className="absolute inset-0 border-[3px] border-cyan-400 border-t-transparent rounded-full animate-spin"></div>
            <Radio className="w-6 h-6 text-cyan-400 animate-pulse" />
          </div>
          <p className="text-cyan-300 text-xs font-mono font-bold tracking-widest uppercase z-10 drop-shadow">{t('syncingDoppler')}</p>
        </div>
      )}

      <div ref={mapContainerRef} className="w-full h-full" />

      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none z-10">
        <div className="absolute inset-0 bg-cyan-400 rounded-full animate-ping opacity-75"></div>
        <div className="absolute inset-1 bg-cyan-500 border border-white rounded-full shadow-[0_0_12px_rgba(6,182,212,1)]"></div>
      </div>

      <div className="absolute top-4 right-4 z-[1010] flex flex-col items-end pointer-events-none">
        <button 
          onClick={() => setShowLayerMenu(!showLayerMenu)} 
          className={`pointer-events-auto p-3.5 rounded-xl backdrop-blur-xl border transition-all shadow-[0_8px_32px_rgba(0,0,0,0.5)] active:scale-95 ${showLayerMenu ? 'bg-black/40 border-cyan-400/50 text-cyan-300' : 'bg-black/20 border-white/15 text-slate-200 hover:bg-black/40 hover:text-white'}`} 
          title={t('layerControl')}
          aria-label={t('layerControl')}
        >
          <Layers className="w-5 h-5 drop-shadow-md" />
        </button>

        {showLayerMenu && (
          <div className="pointer-events-auto mt-2 w-[280px] sm:w-[340px] max-h-[65vh] overflow-y-auto [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-white/20 hover:[&::-webkit-scrollbar-thumb]:bg-white/40 [&::-webkit-scrollbar-thumb]:rounded-full bg-black/20 backdrop-blur-2xl border border-white/15 rounded-2xl p-4 sm:p-5 shadow-[0_15px_50px_rgba(0,0,0,0.85)] animate-in fade-in zoom-in-95 origin-top-right duration-200">
            
            <div className="flex items-center justify-between mb-3 border-b sm:border-0 border-white/15 pb-2 sm:pb-0">
              <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-slate-300 drop-shadow-md">{t('baseMapTitle')}</span>
              <button 
                onClick={() => setShowLayerMenu(false)} 
                className="sm:hidden p-1.5 rounded-full bg-black/30 hover:bg-black/50 border border-white/10 text-slate-200 transition-colors shadow-sm"
              >
                <CloseIcon className="w-4 h-4" />
              </button>
            </div>
            
            <div className="grid grid-cols-2 gap-1.5 sm:gap-2 mb-4 sm:mb-5">
              {(Object.keys(BASE_LAYERS) as BaseLayerType[]).map((key) => (
                <button key={key} onClick={() => setActiveBaseLayer(key)} className={`flex items-center justify-between px-2.5 py-2 sm:p-3 rounded-lg sm:rounded-xl text-[11px] sm:text-xs font-medium sm:font-bold transition-all backdrop-blur-md ${activeBaseLayer === key ? 'bg-cyan-500/20 text-cyan-200 border border-cyan-400/50 shadow-[0_0_15px_rgba(6,182,212,0.15)]' : 'bg-black/30 text-slate-200 hover:bg-black/50 hover:text-white border border-white/10'}`}>
                  <span className="truncate drop-shadow-md">{BASE_LAYERS[key].name}</span>
                  {activeBaseLayer === key && <Check className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0 ml-1 text-cyan-400 drop-shadow-md" />}
                </button>
              ))}
            </div>

            <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-slate-300 block mb-2 sm:mb-2.5 drop-shadow-md">{t('overlayTitle')}</span>
            
            <div className="space-y-1.5 sm:space-y-2">
              <button onClick={() => setOverlays(prev => ({ ...prev, precip: !prev.precip }))} className="w-full flex items-center justify-between p-2.5 sm:p-3 rounded-lg sm:rounded-xl bg-black/30 hover:bg-black/50 border border-white/10 transition-colors text-xs text-slate-100 font-medium sm:font-bold backdrop-blur-md">
                <span className="drop-shadow-md">{t('layerPrecip')}</span>
                {overlays.precip ? <Eye className="w-4 h-4 sm:w-5 sm:h-5 text-cyan-400 drop-shadow-md" /> : <EyeOff className="w-4 h-4 sm:w-5 sm:h-5 text-slate-400" />}
              </button>
              <button onClick={() => setOverlays(prev => ({ ...prev, satIR: !prev.satIR }))} className="w-full flex items-center justify-between p-2.5 sm:p-3 rounded-lg sm:rounded-xl bg-black/30 hover:bg-black/50 border border-white/10 transition-colors text-xs text-slate-100 font-medium sm:font-bold backdrop-blur-md">
                <span className="drop-shadow-md">{t('layerSat')}</span>
                {overlays.satIR ? <Eye className="w-4 h-4 sm:w-5 sm:h-5 text-cyan-400 drop-shadow-md" /> : <EyeOff className="w-4 h-4 sm:w-5 sm:h-5 text-slate-400" />}
              </button>
              <button onClick={() => setOverlays(prev => ({ ...prev, labels: !prev.labels }))} className="w-full flex items-center justify-between p-2.5 sm:p-3 rounded-lg sm:rounded-xl bg-black/30 hover:bg-black/50 border border-white/10 transition-colors text-xs text-slate-100 font-medium sm:font-bold backdrop-blur-md">
                <span className="drop-shadow-md">{t('layerLabels')}</span>
                {overlays.labels ? <Eye className="w-4 h-4 sm:w-5 sm:h-5 text-cyan-400 drop-shadow-md" /> : <EyeOff className="w-4 h-4 sm:w-5 sm:h-5 text-slate-400" />}
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="absolute bottom-6 sm:bottom-8 left-1/2 -translate-x-1/2 z-[1000] w-[92%] max-w-md flex items-center justify-between gap-3 sm:pb-0 pb-[env(safe-area-inset-bottom,16px)] mb-[calc(env(safe-area-inset-bottom,0px)*0.5)] pointer-events-none">
        
        <button 
          onClick={togglePlay} 
          disabled={!radarFramesRef.current || radarFramesRef.current.length === 0} 
          className={`pointer-events-auto flex items-center justify-center w-14 h-14 rounded-full transition-all shrink-0 active:scale-95 backdrop-blur-xl border shadow-[0_8px_32px_rgba(0,0,0,0.5)] ${isPlaying ? 'bg-black/30 border-white/20 text-cyan-400' : 'bg-cyan-500/90 hover:bg-cyan-400 border-cyan-400/50 text-black font-black'} disabled:opacity-40 disabled:cursor-not-allowed`} 
          aria-label={isPlaying ? t('btnPause') : t('btnPlay')}
        >
          {isPlaying ? <Pause className="w-6 h-6 fill-current drop-shadow-md" /> : <Play className="w-6 h-6 fill-current ml-1 drop-shadow-sm" />}
        </button>

        <div className="pointer-events-auto flex flex-col flex-1 items-center justify-center h-14 bg-black/20 backdrop-blur-xl border border-white/15 rounded-full shadow-[0_8px_32px_rgba(0,0,0,0.5)] px-4">
          <span className="text-[9px] text-cyan-300 font-mono font-bold uppercase tracking-[0.2em] mb-0.5 drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
            {isPlaying ? t('animPlaying') : t('animCurrent')}
          </span>
          <div className="flex items-center gap-2.5">
            <span className={`h-2 w-2 rounded-full shadow-[0_0_8px_rgba(0,0,0,0.9)] ${isPlaying ? 'bg-cyan-400 animate-ping' : 'bg-cyan-500'}`}></span>
            <span ref={timeDisplayRef} className="text-white font-mono font-black text-xl sm:text-2xl tracking-tighter tabular-nums drop-shadow-[0_2px_8px_rgba(0,0,0,0.95)]">
              {currentFrame ? formatTime(currentFrame.time) : '--:--'}
            </span>
          </div>
        </div>

        <button 
          onClick={() => fetchAndInjectRadarData(true)} 
          disabled={loading} 
          className="pointer-events-auto flex items-center justify-center w-14 h-14 rounded-full bg-black/20 hover:bg-black/40 backdrop-blur-xl border border-white/15 text-slate-100 hover:text-cyan-300 transition-all active:scale-95 shrink-0 shadow-[0_8px_32px_rgba(0,0,0,0.5)]" 
          title={t('btnRefresh')}
          aria-label={t('btnRefresh')}
        >
          <RefreshCw className={`w-5 h-5 drop-shadow-lg ${loading ? 'animate-spin text-cyan-400' : ''}`} />
        </button>
      </div>

    </div>
  );
}