import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { AlertTriangle, RefreshCw, Play, Pause, Radio, Layers, Eye, EyeOff, Check, X as CloseIcon, Moon } from 'lucide-react';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN || '';

if (MAPBOX_TOKEN) {
  mapboxgl.accessToken = MAPBOX_TOKEN;
} else {
  console.error("Alerta: No s'ha detectat VITE_MAPBOX_TOKEN al fitxer .env");
}

const RadarFrameSchema = z.object({
  time: z.number().nullable(),
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

interface GeoPolygon {
  type: 'Polygon';
  coordinates: number[][][];
}
interface GeoFeature {
  type: 'Feature';
  properties: { level: number };
  geometry: GeoPolygon;
}
interface GeoFeatureCollection {
  type: 'FeatureCollection';
  features: GeoFeature[];
}

let globalRadarCache: { data: z.infer<typeof RainViewerResponseSchema>; timestamp: number } | null = null;
let globalRadarFetchPromise: Promise<z.infer<typeof RainViewerResponseSchema>> | null = null;
const CACHE_TTL = 5 * 60 * 1000;

/* --- FUNCIONS PURES CORREGIDES (Sense canvi de tipus) --- */

const getRadOpacityExp = (baseOp: number): mapboxgl.Expression => {
  // Retornem SEMPRE l'expressió. Si baseOp és 0, tota la corba valdrà 0.
  // Això prevé el "Type-Switching bug" de WebGL a MapLibre.
  return [
    'interpolate', ['linear'], ['zoom'],
    2, baseOp * 0.95,
    6, baseOp * 0.85,
    10, baseOp * 0.65,
    15, baseOp * 0.35
  ];
};

const getSatOpacityExp = (baseOp: number): mapboxgl.Expression => {
  return [
    'interpolate', ['linear'], ['zoom'],
    2, baseOp,
    5, baseOp * 0.75,
    7, baseOp * 0.25,
    9, 0
  ];
};

const getNightOpacityExp = (isDark: boolean): mapboxgl.Expression => {
  const baseOp = isDark ? 0.75 : 0.45;
  return [
    'interpolate', ['linear'], ['zoom'],
    2, baseOp,          
    6, baseOp * 0.60,   
    10, 0               
  ];
};

const computeNightFeatures = (timestamp: number): GeoFeatureCollection => {
  const PI = Math.PI;
  const rad = PI / 180;
  const deg = 180 / PI;

  const date = new Date(timestamp);
  const jd = date.getTime() / 86400000 + 2440587.5;
  const d = jd - 2451545.0; 

  const M = (357.5291 + 0.98560028 * d) * rad;
  const C = (1.9148 * Math.sin(M) + 0.0200 * Math.sin(2 * M) + 0.0003 * Math.sin(3 * M)) * rad;
  const L = (280.4665 + 0.98564736 * d + C * deg) % 360 * rad; 

  const e = 23.439 * rad; 
  const sunDec = Math.asin(Math.sin(e) * Math.sin(L));
  const sunRA = Math.atan2(Math.cos(e) * Math.sin(L), Math.cos(L));

  const gmst = (280.46061837 + 360.98564736629 * d) % 360 * rad;

  let sunLon = sunRA - gmst;
  while (sunLon < -PI) sunLon += 2 * PI;
  while (sunLon > PI) sunLon -= 2 * PI;

  const coords: number[][] = [];
  const safeSunDec = sunDec === 0 ? 0.000001 : sunDec;

  if (safeSunDec > 0) {
    coords.push([-180, -90]);
    coords.push([180, -90]);
    for (let lonDeg = 180; lonDeg >= -180; lonDeg -= 1) {
      const lon = lonDeg * rad;
      const lat = Math.atan(-Math.cos(lon - sunLon) / Math.tan(safeSunDec));
      coords.push([lonDeg, lat * deg]);
    }
    coords.push([-180, -90]); 
  } else {
    coords.push([180, 90]);
    coords.push([-180, 90]);
    for (let lonDeg = -180; lonDeg <= 180; lonDeg += 1) {
      const lon = lonDeg * rad;
      const lat = Math.atan(-Math.cos(lon - sunLon) / Math.tan(safeSunDec));
      coords.push([lonDeg, lat * deg]);
    }
    coords.push([180, 90]); 
  }

  return {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        properties: { level: 0 },
        geometry: { type: 'Polygon', coordinates: [coords] }
      }
    ]
  };
};

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
  
  const [framesCount, setFramesCount] = useState(0);
  const [currentFrameTimestamp, setCurrentFrameTimestamp] = useState<number | null>(null);

  const [activeBaseLayer, setActiveBaseLayer] = useState<BaseLayerType>('sat_optic');
  
  const [overlays, setOverlays] = useState({ precip: true, satIR: true, night: true, labels: true });
  const [showLayerMenu, setShowLayerMenu] = useState(false);

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const hostRef = useRef<string>('');
  const radarFramesRef = useRef<RadarFrame[]>([]);
  const satFramesRef = useRef<RadarFrame[]>([]);
  
  const loadedRadarIdsRef = useRef<Record<number, string>>({});
  const loadedSatIdsRef = useRef<Record<number, string>>({});
  
  const animationTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const nightTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const currentFrameIndexRef = useRef<number>(0);
  const timeDisplayRef = useRef<HTMLSpanElement>(null);
  const overlaysRef = useRef(overlays);
  const activeViewRef = useRef(activeView);
  const isMountedRef = useRef(true);
  
  useEffect(() => { overlaysRef.current = overlays; }, [overlays]);
  useEffect(() => { activeViewRef.current = activeView; }, [activeView]);
  
  useEffect(() => {
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; };
  }, []);

  const formatTime = useCallback((ts?: number | null) => {
    if (ts === null || ts === undefined || isNaN(ts)) return "--:--";
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
    if (!rFrame || rFrame.time === null) return;

    const radSourceId = `rad-src-${rFrame.time}`;
    const radLayerId = `rad-layer-${rFrame.time}`;
    
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
          'raster-opacity': getRadOpacityExp(initialRadOpacity), 
          'raster-fade-duration': 0,
          'raster-resampling': 'linear', 
          // CORRECCIÓ: Valors dins del rang estrictament permès [-1, 1]
          'raster-contrast': 0.25, 
          'raster-saturation': 0.8, 
        },
      }, 'anchor-radar');
      loadedRadarIdsRef.current[index] = radLayerId;
    }

    if (sFrames && sFrames.length > 0) {
      let closestSatIdx = 0;
      let minDiff = Infinity;
      sFrames.forEach((sFrame, sIdx) => {
        if (!sFrame || sFrame.time === null) return;
        const diff = Math.abs(sFrame.time - rFrame.time!);
        if (diff < minDiff) { minDiff = diff; closestSatIdx = sIdx; }
      });
      
      const sFrame = sFrames[closestSatIdx];
      if (sFrame && sFrame.time !== null) {
        const satSourceId = `sat-src-${sFrame.time}`;
        const satLayerId = `sat-layer-${sFrame.time}`;
        const initialSatOpacity = (isTarget && isRadarActive && overlaysRef.current.satIR) ? 0.95 : 0;

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
              'raster-opacity': getSatOpacityExp(initialSatOpacity),
              'raster-contrast': 0.20,
              'raster-resampling': 'linear',
              'raster-fade-duration': 0
            },
          }, 'anchor-clouds');
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

    if (currentRadarFrame && currentRadarFrame.time !== null) {
      if (timeDisplayRef.current) {
         timeDisplayRef.current.textContent = formatTime(currentRadarFrame.time);
      }
      setCurrentFrameTimestamp(currentRadarFrame.time);
    }

    const isRadarViewActive = activeViewRef.current === 'radar';

    Object.values(loadedRadarIdsRef.current).forEach((id) => {
      if (id && map.getLayer(id)) {
        const isTarget = id === targetRadarId;
        const targetOpacity = (isRadarViewActive && overlaysRef.current.precip && isTarget) ? 0.85 : 0;
        map.setPaintProperty(id, 'raster-opacity', getRadOpacityExp(targetOpacity));
      }
    });

    if (satFramesRef.current.length > 0 && currentRadarFrame && currentRadarFrame.time !== null) {
      let closestSatIdx = 0;
      let minDiff = Infinity;
      satFramesRef.current.forEach((sFrame, sIdx) => {
        if (!sFrame || sFrame.time === null) return;
        const diff = Math.abs(sFrame.time - currentRadarFrame.time!);
        if (diff < minDiff) { minDiff = diff; closestSatIdx = sIdx; }
      });
      
      const targetSatId = loadedSatIdsRef.current[closestSatIdx];
      
      Object.values(loadedSatIdsRef.current).forEach((id) => {
        if (id && map.getLayer(id)) {
          const isTarget = id === targetSatId;
          const targetOpacity = (isRadarViewActive && overlaysRef.current.satIR && isTarget) ? 0.95 : 0;
          map.setPaintProperty(id, 'raster-opacity', getSatOpacityExp(targetOpacity));
        }
      });
    }
  }, [ensureFrameLoaded, formatTime]);

  const injectLayersIntoMap = useCallback((parsedData: z.infer<typeof RainViewerResponseSchema>) => {
    const map = mapRef.current;
    if (!map) return;

    const { host, radar, satellite } = parsedData;
    hostRef.current = host;
    
    const rFrames = (radar?.past || []).filter(f => f && f.time !== null);
    const sFrames = (satellite?.infrared || []).filter(f => f && f.time !== null);

    radarFramesRef.current = rFrames;
    satFramesRef.current = sFrames;
    setFramesCount(rFrames.length);

    cleanupExpiredLayers(rFrames, sFrames);

    if (rFrames.length === 0) return;

    const initialIdx = Math.max(0, rFrames.length - 1);
    currentFrameIndexRef.current = initialIdx;
    
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
      zoom: 8.5, 
      attributionControl: false,
      maxZoom: 18,
      minZoom: 2,
      fadeDuration: 0,
      projection: { name: 'globe' } as unknown as mapboxgl.MapboxOptions['projection'], 
    });
    mapRef.current = map;
    
    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'top-left');

    const handleTouchOrClick = () => setShowLayerMenu(false);
    map.on('mousedown', handleTouchOrClick);
    map.on('touchstart', handleTouchOrClick);

    map.on('load', () => {
      map.setFog({
        'color': 'rgb(6, 12, 28)', 
        'high-color': 'rgb(12, 24, 48)',
        'horizon-blend': 0.25, 
        'space-color': 'rgb(1, 2, 6)', 
        'star-intensity': 0.65 
      });

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
      
      const initialNightTime = Date.now();
      map.addSource('night-source', { 
        type: 'geojson', 
        data: computeNightFeatures(initialNightTime) as unknown as Parameters<mapboxgl.GeoJSONSource['setData']>[0] 
      });
      map.addLayer({
        id: 'layer-night',
        type: 'fill',
        source: 'night-source',
        layout: { visibility: overlaysRef.current.night ? 'visible' : 'none' },
        paint: {
          'fill-color': activeBaseLayer === 'dark' ? '#000000' : '#040714',
          'fill-opacity': getNightOpacityExp(activeBaseLayer === 'dark')
        }
      });

      map.addLayer({ id: 'anchor-clouds', type: 'background', paint: { 'background-color': 'transparent', 'background-opacity': 0 } });
      map.addLayer({ id: 'anchor-radar', type: 'background', paint: { 'background-color': 'transparent', 'background-opacity': 0 } });
      map.addLayer({ id: 'anchor-wind', type: 'background', paint: { 'background-color': 'transparent', 'background-opacity': 0 } });

      map.addSource('labels-src', { type: 'raster', tiles: ['https://a.basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}@2x.png'], tileSize: 256 });
      map.addLayer({
        id: 'layer-labels',
        type: 'raster',
        source: 'labels-src',
        layout: { visibility: overlaysRef.current.labels ? 'visible' : 'none' },
        paint: { 'raster-opacity': 0.9 },
      });
      
      nightTimerRef.current = setInterval(() => {
        if (mapRef.current && mapRef.current.getSource('night-source')) {
          const source = mapRef.current.getSource('night-source') as mapboxgl.GeoJSONSource;
          source.setData(computeNightFeatures(Date.now()) as unknown as Parameters<mapboxgl.GeoJSONSource['setData']>[0]);
        }
      }, 60000);

      fetchAndInjectRadarData();
    });

    return () => {
      if (animationTimerRef.current) clearInterval(animationTimerRef.current);
      if (nightTimerRef.current) clearInterval(nightTimerRef.current);
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

    if (map.getLayer('layer-night')) {
      map.setPaintProperty('layer-night', 'fill-color', activeBaseLayer === 'dark' ? '#000000' : '#040714');
      map.setPaintProperty('layer-night', 'fill-opacity', getNightOpacityExp(activeBaseLayer === 'dark'));
    }

    map.triggerRepaint();
  }, [activeBaseLayer, BASE_LAYERS]);

  useEffect(() => {
    applyFrameVisibility(currentFrameIndexRef.current);
    const map = mapRef.current;
    if (map && map.isStyleLoaded()) {
      if (map.getLayer('layer-labels')) {
        map.setLayoutProperty('layer-labels', 'visibility', overlays.labels ? 'visible' : 'none');
      }
      if (map.getLayer('layer-night')) {
        map.setLayoutProperty('layer-night', 'visibility', overlays.night ? 'visible' : 'none');
      }
    }
  }, [overlays, activeView, applyFrameVisibility]);

  useEffect(() => {
    if (!isActive || activeView !== 'radar') {
      const t = setTimeout(() => {
        setIsPlaying(false);
      }, 0);
      return () => clearTimeout(t);
    }
  }, [isActive, activeView]);

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
    if (nextPlayState) {
      currentFrameIndexRef.current = 0;
      applyFrameVisibility(0);
    }
  };

  const MATRIX_BG = `absolute inset-0 z-0 opacity-[0.05] pointer-events-none bg-[linear-gradient(to_right,#ffffff_1px,transparent_1px),linear-gradient(to_bottom,#ffffff_1px,transparent_1px)] bg-[size:16px_16px]`;

  if (error) {
    return (
      <div className="absolute inset-0 z-[1001] flex flex-col items-center justify-center bg-gradient-to-br from-[#0a0d16]/95 to-[#020308]/95 backdrop-blur-2xl p-6 text-center">
        <div className={MATRIX_BG}></div>
        <div className="w-20 h-20 rounded-2xl bg-rose-950/40 border border-rose-500/40 shadow-[inset_0_2px_15px_rgba(244,63,94,0.2),0_10px_30px_rgba(244,63,94,0.3)] flex items-center justify-center mb-6 relative z-10">
          <AlertTriangle className="w-10 h-10 text-rose-500 drop-shadow-[0_0_15px_rgba(244,63,94,0.8)]" />
        </div>
        <span className="text-white font-black tracking-[0.2em] uppercase mb-2 z-10 text-lg drop-shadow-md text-center px-4 max-w-[90vw] leading-tight">{t('errRadarDown')}</span>
        <span className="text-sm text-slate-400 font-mono mb-8 max-w-sm z-10 leading-relaxed text-center px-4">{t('errRadarDesc')}</span>
        <button onClick={() => fetchAndInjectRadarData(true)} className="px-8 py-4 bg-black/40 border border-white/20 hover:bg-white/10 hover:border-white/40 text-white rounded-xl text-sm font-black uppercase tracking-widest transition-all active:scale-95 z-10 shadow-[0_8px_32px_rgba(0,0,0,0.6)] backdrop-blur-md">
          {t('btnForceSync')}
        </button>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full min-h-0 overflow-hidden bg-[#020308] select-none [transform:translateZ(0)]">
      {loading && (
        <div className="absolute inset-0 z-[1001] flex flex-col items-center justify-center bg-[#020308]/90 backdrop-blur-2xl transition-opacity duration-300">
          <div className={MATRIX_BG}></div>
          <div className="relative w-16 h-16 flex items-center justify-center mb-5 z-10">
            <div className="absolute inset-0 border-[4px] border-cyan-500/20 rounded-full shadow-[inset_0_0_20px_rgba(6,182,212,0.1)]"></div>
            <div className="absolute inset-0 border-[4px] border-cyan-400 border-t-transparent rounded-full animate-spin shadow-[0_0_15px_rgba(6,182,212,0.5)]"></div>
            <Radio className="w-7 h-7 text-cyan-400 animate-pulse drop-shadow-[0_0_10px_rgba(6,182,212,1)]" />
          </div>
          <p className="text-cyan-300 text-sm font-mono font-bold tracking-[0.2em] uppercase z-10 drop-shadow-lg text-center px-4 max-w-[80vw] leading-relaxed">
            {t('syncingDoppler')}
          </p>
        </div>
      )}

      <div ref={mapContainerRef} className="w-full h-full" />

      {/* Punt de mira Tàctic Central */}
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-5 h-5 pointer-events-none z-10 flex items-center justify-center">
        <div className="absolute inset-0 bg-cyan-400/20 rounded-full animate-ping"></div>
        <div className="w-1.5 h-1.5 bg-cyan-400 rounded-full shadow-[0_0_12px_rgba(6,182,212,1)]"></div>
        <div className="absolute w-6 h-6 border border-cyan-500/30 rounded-full"></div>
      </div>

      {/* Menú de Capes Flotant */}
      <div className="absolute top-4 right-4 z-[1010] flex flex-col items-end pointer-events-none">
        <button 
          onClick={() => setShowLayerMenu(!showLayerMenu)} 
          className={`pointer-events-auto p-4 rounded-2xl backdrop-blur-2xl border transition-all duration-300 shadow-[0_8px_32px_rgba(0,0,0,0.6)] active:scale-95 ${showLayerMenu ? 'bg-black/60 border-cyan-400/50 text-cyan-300 shadow-[0_0_20px_rgba(6,182,212,0.2)]' : 'bg-black/40 border-white/15 text-slate-200 hover:bg-black/60 hover:text-white'}`} 
          title={t('layerControl')}
          aria-label={t('layerControl')}
        >
          <Layers className="w-6 h-6 drop-shadow-md" />
        </button>

        {showLayerMenu && (
          <div className="pointer-events-auto mt-3 w-[calc(100vw-32px)] max-w-[320px] max-h-[60vh] overflow-y-auto [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-white/20 hover:[&::-webkit-scrollbar-thumb]:bg-white/40 [&::-webkit-scrollbar-thumb]:rounded-full bg-black/60 backdrop-blur-2xl border border-white/15 rounded-2xl p-5 shadow-[0_20px_60px_rgba(0,0,0,0.9)] animate-in fade-in zoom-in-95 origin-top-right duration-200 ring-1 ring-white/5">
            
            <div className="flex items-center justify-between mb-4 border-b border-white/10 pb-3">
              <span className="text-[11px] font-mono font-black uppercase tracking-[0.2em] text-slate-300 drop-shadow-md">{t('baseMapTitle')}</span>
              <button 
                onClick={() => setShowLayerMenu(false)} 
                className="p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 transition-colors shadow-sm active:scale-95"
              >
                <CloseIcon className="w-4 h-4" />
              </button>
            </div>
            
            <div className="grid grid-cols-2 gap-2 mb-5">
              {(Object.keys(BASE_LAYERS) as BaseLayerType[]).map((key) => (
                <button key={key} onClick={() => setActiveBaseLayer(key)} className={`flex items-center justify-between p-3 rounded-xl text-xs font-bold transition-all duration-300 backdrop-blur-md ${activeBaseLayer === key ? 'bg-cyan-500/20 text-cyan-200 border border-cyan-400/50 shadow-[0_0_15px_rgba(6,182,212,0.2)]' : 'bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white border border-white/10'}`}>
                  <span className="truncate drop-shadow-md">{BASE_LAYERS[key].name}</span>
                  {activeBaseLayer === key && <Check className="w-4 h-4 shrink-0 ml-1.5 text-cyan-400 drop-shadow-[0_0_8px_rgba(6,182,212,0.8)]" />}
                </button>
              ))}
            </div>

            <span className="text-[11px] font-mono font-black uppercase tracking-[0.2em] text-slate-300 block mb-3 drop-shadow-md">{t('overlayTitle')}</span>
            
            <div className="space-y-2">
              <button onClick={() => setOverlays(prev => ({ ...prev, precip: !prev.precip }))} className="w-full flex items-center justify-between p-3.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 transition-colors text-xs text-slate-100 font-bold backdrop-blur-md">
                <span className="drop-shadow-md">{t('layerPrecip')}</span>
                {overlays.precip ? <Eye className="w-5 h-5 text-cyan-400 drop-shadow-[0_0_8px_rgba(6,182,212,0.8)]" /> : <EyeOff className="w-5 h-5 text-slate-500" />}
              </button>
              <button onClick={() => setOverlays(prev => ({ ...prev, satIR: !prev.satIR }))} className="w-full flex items-center justify-between p-3.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 transition-colors text-xs text-slate-100 font-bold backdrop-blur-md">
                <span className="drop-shadow-md">{t('layerSat')}</span>
                {overlays.satIR ? <Eye className="w-5 h-5 text-cyan-400 drop-shadow-[0_0_8px_rgba(6,182,212,0.8)]" /> : <EyeOff className="w-5 h-5 text-slate-500" />}
              </button>
              
              <button onClick={() => setOverlays(prev => ({ ...prev, night: !prev.night }))} className="w-full flex items-center justify-between p-3.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 transition-colors text-xs text-slate-100 font-bold backdrop-blur-md">
                <span className="drop-shadow-md flex items-center gap-2">
                  <Moon className="w-3.5 h-3.5 text-slate-400" /> {t('layerNight', 'Nit')}
                </span>
                {overlays.night ? <Eye className="w-5 h-5 text-cyan-400 drop-shadow-[0_0_8px_rgba(6,182,212,0.8)]" /> : <EyeOff className="w-5 h-5 text-slate-500" />}
              </button>
              
              <button onClick={() => setOverlays(prev => ({ ...prev, labels: !prev.labels }))} className="w-full flex items-center justify-between p-3.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 transition-colors text-xs text-slate-100 font-bold backdrop-blur-md">
                <span className="drop-shadow-md">{t('layerLabels')}</span>
                {overlays.labels ? <Eye className="w-5 h-5 text-cyan-400 drop-shadow-[0_0_8px_rgba(6,182,212,0.8)]" /> : <EyeOff className="w-5 h-5 text-slate-500" />}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Control Inferior Flotant Spatial UI (Càpsula) */}
      <div className="absolute bottom-[max(env(safe-area-inset-bottom,24px),24px)] left-1/2 -translate-x-1/2 z-[1000] w-[94%] sm:w-[450px] flex items-center justify-between gap-3 pointer-events-none">
        
        <button 
          onClick={togglePlay} 
          disabled={framesCount === 0} 
          className={`pointer-events-auto flex items-center justify-center w-16 h-16 rounded-2xl transition-all duration-300 shrink-0 active:scale-95 backdrop-blur-2xl border shadow-[0_8px_32px_rgba(0,0,0,0.6)] ${isPlaying ? 'bg-black/60 border-white/20 text-cyan-400 shadow-[inset_0_0_15px_rgba(6,182,212,0.15)]' : 'bg-cyan-500 border-cyan-400/50 text-black shadow-[0_0_20px_rgba(6,182,212,0.4)]'} disabled:opacity-30 disabled:cursor-not-allowed`} 
          aria-label={isPlaying ? t('btnPause') : t('btnPlay')}
        >
          {isPlaying ? <Pause className="w-7 h-7 fill-current drop-shadow-md" /> : <Play className="w-7 h-7 fill-current ml-1.5 drop-shadow-sm" />}
        </button>

        <div className="pointer-events-auto flex flex-col flex-1 items-center justify-center h-16 bg-black/50 backdrop-blur-2xl border border-white/15 rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.6)] px-5 ring-1 ring-white/5">
          <span className="text-[10px] text-cyan-300 font-mono font-black uppercase tracking-[0.25em] mb-0.5 drop-shadow-[0_1px_4px_rgba(0,0,0,1)]">
            {isPlaying ? t('animPlaying') : t('animCurrent')}
          </span>
          <div className="flex items-center gap-3">
            <span className={`h-2.5 w-2.5 rounded-full shadow-[0_0_10px_rgba(0,0,0,1)] ${isPlaying ? 'bg-cyan-400 animate-ping shadow-[0_0_15px_rgba(6,182,212,0.8)]' : 'bg-cyan-500'}`}></span>
            <span ref={timeDisplayRef} className="text-white font-mono font-black text-2xl tracking-tighter tabular-nums drop-shadow-[0_2px_12px_rgba(0,0,0,1)]">
              {currentFrameTimestamp ? formatTime(currentFrameTimestamp) : '--:--'}
            </span>
          </div>
        </div>

        <button 
          onClick={() => fetchAndInjectRadarData(true)} 
          disabled={loading} 
          className="pointer-events-auto flex items-center justify-center w-16 h-16 rounded-2xl bg-black/40 hover:bg-black/60 backdrop-blur-2xl border border-white/15 text-slate-200 hover:text-cyan-300 transition-all duration-300 active:scale-95 shrink-0 shadow-[0_8px_32px_rgba(0,0,0,0.6)]" 
          title={t('btnRefresh')}
          aria-label={t('btnRefresh')}
        >
          <RefreshCw className={`w-6 h-6 drop-shadow-lg ${loading ? 'animate-spin text-cyan-400 drop-shadow-[0_0_10px_rgba(6,182,212,0.8)]' : ''}`} />
        </button>
      </div>

    </div>
  );
}