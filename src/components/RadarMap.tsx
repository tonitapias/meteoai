import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';

// 1. DOMINI FÍSIC EXTRET
import { 
  RainViewerResponseSchema, 
  RadarFrame, 
  BaseLayerType, 
  BaseLayerConfig,
  getNASADate, 
  getRadOpacityExp, 
  getSatOpacityExp, 
  getNightOpacityExp, 
  computeNightFeatures,
  getBlackMarbleUrl,
  getBlackMarbleOpacityExp
} from '../utils/radarPhysics';

// 2. DOMINI D'ESTAT EXTRET
import { useRadarData } from '../hooks/useRadarData';

// 3. COMPONENTS DE UI EXTRETS
import { RadarOverlays } from './radar/RadarOverlays';
import { RadarPlaybackControls } from './radar/RadarPlaybackControls';
import { RadarLayerMenu } from './radar/RadarLayerMenu';

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN || '';

if (MAPBOX_TOKEN) {
  mapboxgl.accessToken = MAPBOX_TOKEN;
} else {
  console.error("Alerta: No s'ha detectat VITE_MAPBOX_TOKEN al fitxer .env");
}

interface RadarMapProps {
  lat: number;
  lon: number;
  isActive: boolean;
}

export default function RadarMap({ lat, lon, isActive }: RadarMapProps) {
  const { t } = useTranslation();
  
  // Custom Hook per dades de radar
  const { loading, error, radarData, fetchRadarData } = useRadarData();
  
  // S'afegeix black_marble com un mapa base natiu més
  const BASE_LAYERS: Record<BaseLayerType, BaseLayerConfig> = useMemo(() => ({
    dark: { name: t('baseDark', 'Fosc'), url: 'https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png', attribution: '&copy; CARTO' },
    light: { name: t('baseLight', 'Clar'), url: 'https://a.basemaps.cartocdn.com/light_all/{z}/{x}/{y}@2x.png', attribution: '&copy; CARTO' },
    relief: { name: t('baseRelief', 'Relleu'), url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}', attribution: '&copy; Esri' },
    sat_optic: { name: t('baseSat', 'Satèl·lit'), url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', attribution: '&copy; Esri' },
    black_marble: { name: t('baseNightMap', 'Terra de Nit (NASA)'), url: getBlackMarbleUrl(), attribution: '&copy; NASA GIBS' }
  }), [t]);

  const [isPlaying, setIsPlaying] = useState(false);
  const [framesCount, setFramesCount] = useState(0);
  const [currentFrameTimestamp, setCurrentFrameTimestamp] = useState<number | null>(null);
  const [activeBaseLayer, setActiveBaseLayer] = useState<BaseLayerType>('sat_optic');
  
  const [overlays, setOverlays] = useState({ precip: true, satIR: true, night: true, labels: true, nasaReal: false });
  const [showLayerMenu, setShowLayerMenu] = useState(false);
  
  // Clau per ressuscitar el mapa si el mòbil mata la GPU per estalviar bateria
  const [webglKey, setWebglKey] = useState(0);

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

  const prevNasaRealRef = useRef(overlays.nasaReal);
  const tacticalCameraRef = useRef<{ 
    center: [number, number]; 
    zoom: number; 
    pitch: number; 
    bearing: number 
  } | null>(null);

  // Referències exclusives per l'Easter Egg
  const prevBlackMarbleRef = useRef(activeBaseLayer === 'black_marble');
  const tacticalCameraEasterEggRef = useRef<{ 
    center: [number, number]; 
    zoom: number; 
    pitch: number; 
    bearing: number 
  } | null>(null);

  const toggleOverlay = useCallback((key: keyof typeof overlays) => {
    setOverlays(prev => {
      const next = { ...prev, [key]: !prev[key] };
      overlaysRef.current = next;
      return next;
    });
  }, []);

  const formatTime = useCallback((ts?: number | null) => {
    if (ts === null || ts === undefined || isNaN(ts)) return "--:--";
    return new Date(ts * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }, []);

  const cleanupExpiredLayers = useCallback((validRadarFrames: RadarFrame[], validSatFrames: RadarFrame[]) => {
    const map = mapRef.current;
    if (!map) return;

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
          console.warn(`[Garbage Collector] Error netejant VRAM radar:`, e);
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
          console.warn(`[Garbage Collector] Error netejant VRAM satèl·lit:`, e);
        }
      }
    });
  }, []);

  const ensureFrameLoaded = useCallback((index: number) => {
    const map = mapRef.current;
    if (!map || !hostRef.current) return;
    
    const rFrames = radarFramesRef.current;
    const sFrames = satFramesRef.current;
    
    if (!rFrames || rFrames.length === 0 || index < 0 || index >= rFrames.length) return;
    const rFrame = rFrames[index];
    if (!rFrame || rFrame.time === null) return;

    const radSourceId = `rad-src-${rFrame.time}`;
    const radLayerId = `rad-layer-${rFrame.time}`;
    
    const isTarget = index === currentFrameIndexRef.current;
    const initialRadOpacity = (isTarget && overlaysRef.current.precip) ? 0.88 : 0;

    if (!loadedRadarIdsRef.current[index] && !map.getSource(radSourceId)) {
      map.addSource(radSourceId, {
        type: 'raster',
        tiles: [`${hostRef.current}${rFrame.path}/512/{z}/{x}/{y}/6/1_1.png`],
        tileSize: 512,
        maxzoom: 8,
      });
      map.addLayer({
        id: radLayerId,
        type: 'raster',
        source: radSourceId,
        layout: { visibility: overlaysRef.current.precip ? 'visible' : 'none' },
        paint: { 
          'raster-opacity': getRadOpacityExp(initialRadOpacity),
          'raster-opacity-transition': { duration: 400, delay: 0 }, 
          'raster-fade-duration': 0,
          'raster-resampling': 'linear' 
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
        const initialSatOpacity = (isTarget && overlaysRef.current.satIR) ? 0.85 : 0;

        if (!loadedSatIdsRef.current[closestSatIdx] && !map.getSource(satSourceId)) {
          map.addSource(satSourceId, {
            type: 'raster',
            tiles: [`${hostRef.current}${sFrame.path}/512/{z}/{x}/{y}/0/0_0.png`],
            tileSize: 512,
            maxzoom: 6,
          });
          
          map.addLayer({
            id: satLayerId,
            type: 'raster',
            source: satSourceId,
            layout: { visibility: overlaysRef.current.satIR ? 'visible' : 'none' },
            paint: {
              'raster-opacity': getSatOpacityExp(initialSatOpacity),
              'raster-opacity-transition': { duration: 400, delay: 0 }, 
              'raster-contrast': 0.35,       
              'raster-saturation': -1,       
              'raster-brightness-min': 0.15, 
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
    if (!map) return;

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

    const showPrecip = overlaysRef.current.precip;
    const showSat = overlaysRef.current.satIR;

    Object.values(loadedRadarIdsRef.current).forEach((id) => {
      if (id && map.getLayer(id)) {
        const isTarget = id === targetRadarId;
        map.setLayoutProperty(id, 'visibility', showPrecip ? 'visible' : 'none');
        const targetOpacity = (showPrecip && isTarget) ? 0.88 : 0;
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
          map.setLayoutProperty(id, 'visibility', showSat ? 'visible' : 'none');
          const targetOpacity = (showSat && isTarget) ? 0.85 : 0;
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
    if (rFrames.length > 1) { setTimeout(() => ensureFrameLoaded(0), 100); }
    applyFrameVisibility(initialIdx);

    map.once('idle', () => applyFrameVisibility(currentFrameIndexRef.current));
    setTimeout(() => applyFrameVisibility(currentFrameIndexRef.current), 150);
  }, [ensureFrameLoaded, applyFrameVisibility, cleanupExpiredLayers]);

  useEffect(() => {
    if (radarData && mapRef.current) {
      injectLayersIntoMap(radarData);
    }
  }, [radarData, injectLayersIntoMap]);

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

    // Escut protector de memòria mòbil
    map.on('webglcontextlost', (e) => {
      e.originalEvent?.preventDefault();
      console.warn("[WebGL] Memòria gràfica alliberada pel dispositiu. Ressuscitant motor...");
      setWebglKey(prev => prev + 1); 
    });

    map.on('load', () => {
      map.setFog({
        'color': 'rgb(12, 22, 40)',       
        'high-color': 'rgb(18, 30, 55)',  
        'horizon-blend': 0.40,            
        'space-color': 'rgb(2, 4, 10)',   
        'star-intensity': 0.85            
      });

      const nasaDate = getNASADate();
      map.addSource('source-nasa-real', {
        type: 'raster',
        tiles: [
          `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/VIIRS_SNPP_CorrectedReflectance_TrueColor/default/${nasaDate}/GoogleMapsCompatible_Level9/{z}/{y}/{x}.jpg`
        ],
        tileSize: 256,
        maxzoom: 9, 
        attribution: '&copy; NASA'
      });

      map.addLayer({
        id: 'layer-nasa-real',
        type: 'raster',
        source: 'source-nasa-real',
        layout: { visibility: 'visible' },
        paint: { 'raster-opacity': 1 }
      });

      (Object.keys(BASE_LAYERS) as BaseLayerType[]).forEach((key) => {
        const config = BASE_LAYERS[key];
        const isBlackMarble = key === 'black_marble';
        
        map.addSource(`base-src-${key}`, { 
          type: 'raster', 
          tiles: [config.url], 
          tileSize: 256,
          ...(isBlackMarble ? { maxzoom: 8 } : {}),
          attribution: config.attribution 
        });
        
        map.addLayer({
          id: `base-layer-${key}`,
          type: 'raster',
          source: `base-src-${key}`,
          layout: { visibility: key === activeBaseLayer ? 'visible' : 'none' },
          paint: {
            'raster-opacity': key === activeBaseLayer ? (isBlackMarble ? getBlackMarbleOpacityExp(1) : 1) : 0.000001,
            'raster-fade-duration': 400 
          }
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
          'fill-color': (activeBaseLayer === 'dark' || activeBaseLayer === 'black_marble') ? '#000000' : '#040714',
          'fill-opacity': getNightOpacityExp(activeBaseLayer === 'dark' || activeBaseLayer === 'black_marble')
        }
      });

      map.addLayer({ id: 'anchor-clouds', type: 'background', paint: { 'background-color': 'transparent', 'background-opacity': 0 } });
      map.addLayer({ id: 'anchor-radar', type: 'background', paint: { 'background-color': 'transparent', 'background-opacity': 0 } });

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

      fetchRadarData();
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
  }, [lat, lon, fetchRadarData, BASE_LAYERS, webglKey]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    
    const syncAllLayers = () => {
      if (map.getLayer('layer-nasa-real')) {
        map.setLayoutProperty('layer-nasa-real', 'visibility', overlays.nasaReal ? 'visible' : 'none');
        map.setPaintProperty('layer-nasa-real', 'raster-opacity', overlays.nasaReal ? [
          'interpolate', ['linear'], ['zoom'],
          5.5, 1,   
          7.5, 0    
        ] : 0);
      }

      (Object.keys(BASE_LAYERS) as BaseLayerType[]).forEach((key) => {
        const layerId = `base-layer-${key}`;
        if (map.getLayer(layerId)) {
          map.setLayoutProperty(layerId, 'visibility', key === activeBaseLayer ? 'visible' : 'none');
          
          let targetOpacity: number | mapboxgl.Expression = 0.000001;
          
          if (key === activeBaseLayer) {
            if (overlays.nasaReal) {
              targetOpacity = [
                'interpolate', ['linear'], ['zoom'],
                5.5, 0.000001, 
                7.5, 1         
              ];
            } else if (key === 'black_marble') {
              targetOpacity = getBlackMarbleOpacityExp(1);
            } else {
              targetOpacity = 1;
            }
          }
          
          map.setPaintProperty(layerId, 'raster-opacity', targetOpacity);
        }
      });

      if (map.getLayer('layer-night')) {
        map.setLayoutProperty('layer-night', 'visibility', overlays.night ? 'visible' : 'none');
        map.setPaintProperty('layer-night', 'fill-color', (activeBaseLayer === 'dark' || activeBaseLayer === 'black_marble') ? '#000000' : '#040714');
        map.setPaintProperty('layer-night', 'fill-opacity', getNightOpacityExp(activeBaseLayer === 'dark' || activeBaseLayer === 'black_marble'));
      }

      if (map.getLayer('layer-labels')) {
        map.setLayoutProperty('layer-labels', 'visibility', overlays.labels ? 'visible' : 'none');
      }

      applyFrameVisibility(currentFrameIndexRef.current);
      map.triggerRepaint();
    };

    syncAllLayers();
    
    if (!map.isStyleLoaded()) {
      map.once('idle', syncAllLayers);
    }
  }, [activeBaseLayer, BASE_LAYERS, overlays, applyFrameVisibility]);

  // Càmera: NASA Dia
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const isNasaNow = overlays.nasaReal;
    const wasNasaBefore = prevNasaRealRef.current;
    prevNasaRealRef.current = isNasaNow;

    if (isNasaNow && !wasNasaBefore) {
      const currentZoom = map.getZoom();
      
      if (currentZoom > 4.5) {
        const center = map.getCenter();
        
        tacticalCameraRef.current = {
          center: [center.lng, center.lat],
          zoom: currentZoom,
          pitch: map.getPitch(),
          bearing: map.getBearing()
        };

        map.flyTo({
          zoom: 3.2,
          pitch: 0,
          bearing: 0,
          speed: 1.3,
          curve: 1.42,
          essential: true
        });
      }
    } 
    else if (!isNasaNow && wasNasaBefore && tacticalCameraRef.current) {
      const saved = tacticalCameraRef.current;
      
      map.flyTo({
        center: saved.center,
        zoom: saved.zoom,
        pitch: saved.pitch,
        bearing: saved.bearing,
        speed: 1.5,
        curve: 1.42,
        essential: true
      });
      
      tacticalCameraRef.current = null; 
    }
  }, [overlays.nasaReal]);

  // Càmera: EASTER EGG (NASA Nit)
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const isBlackMarbleNow = activeBaseLayer === 'black_marble';
    const wasBlackMarbleBefore = prevBlackMarbleRef.current;
    prevBlackMarbleRef.current = isBlackMarbleNow;

    if (isBlackMarbleNow && !wasBlackMarbleBefore) {
      const currentZoom = map.getZoom();

      // Fem zoom out gairebé sempre que no estiguem ja veient la Terra sencera
      if (currentZoom > 3.0) {
        const center = map.getCenter();
        
        tacticalCameraEasterEggRef.current = {
          center: [center.lng, center.lat],
          zoom: currentZoom,
          pitch: map.getPitch(),
          bearing: map.getBearing()
        };

        map.flyTo({
          zoom: 2.2, // Zoom out màxim espectacular
          pitch: 0,
          bearing: 0,
          speed: 1.2,
          curve: 1.42,
          essential: true
        });
      }
    } 
    else if (!isBlackMarbleNow && wasBlackMarbleBefore && tacticalCameraEasterEggRef.current) {
      const saved = tacticalCameraEasterEggRef.current;
      
      map.flyTo({
        center: saved.center,
        zoom: saved.zoom,
        pitch: saved.pitch,
        bearing: saved.bearing,
        speed: 1.5,
        curve: 1.42,
        essential: true
      });
      
      tacticalCameraEasterEggRef.current = null; 
    }
  }, [activeBaseLayer]);

  useEffect(() => {
    if (!isActive) {
      const t = setTimeout(() => { setIsPlaying(false); }, 0);
      return () => clearTimeout(t);
    }
  }, [isActive]);

  useEffect(() => {
    if (isPlaying && radarFramesRef.current.length > 0 && isActive) {
      animationTimerRef.current = setInterval(() => {
        const totalFrames = radarFramesRef.current.length;
        if (totalFrames === 0) return; 
        const nextIndex = (currentFrameIndexRef.current + 1) % totalFrames;
        currentFrameIndexRef.current = nextIndex;
        applyFrameVisibility(nextIndex);
      }, 600); 
    } else {
      if (animationTimerRef.current) clearInterval(animationTimerRef.current);
    }
    return () => { if (animationTimerRef.current) clearInterval(animationTimerRef.current); };
  }, [isPlaying, isActive, applyFrameVisibility]);

  const togglePlay = () => {
    if (radarFramesRef.current.length === 0) return;
    const nextPlayState = !isPlaying;
    setIsPlaying(nextPlayState);
    if (nextPlayState) {
      currentFrameIndexRef.current = 0;
      applyFrameVisibility(0);
    }
  };

  return (
    <div className="relative w-full h-full min-h-0 overflow-hidden bg-[#020308] select-none [transform:translateZ(0)]">
      
      <RadarOverlays 
        loading={loading} 
        error={error} 
        onForceSync={() => fetchRadarData(true)} 
      />

      <div key={`mapbox-phoenix-${webglKey}`} ref={mapContainerRef} className="w-full h-full" />

      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-5 h-5 pointer-events-none z-10 flex items-center justify-center">
        <div className="absolute inset-0 bg-cyan-400/20 rounded-full animate-ping"></div>
        <div className="w-1.5 h-1.5 bg-cyan-400 rounded-full shadow-[0_0_12px_rgba(6,182,212,1)]"></div>
        <div className="absolute w-6 h-6 border border-cyan-500/30 rounded-full"></div>
      </div>

      <RadarLayerMenu 
        showLayerMenu={showLayerMenu} 
        setShowLayerMenu={setShowLayerMenu}
        activeBaseLayer={activeBaseLayer}
        setActiveBaseLayer={setActiveBaseLayer}
        overlays={overlays}
        toggleOverlay={toggleOverlay}
        baseLayers={BASE_LAYERS}
      />

      <RadarPlaybackControls 
        isPlaying={isPlaying}
        togglePlay={togglePlay}
        framesCount={framesCount}
        currentFrameTimestamp={currentFrameTimestamp}
        formatTime={formatTime}
        loading={loading}
        onRefresh={() => fetchRadarData(true)}
        timeDisplayRef={timeDisplayRef}
      />

    </div>
  );
}