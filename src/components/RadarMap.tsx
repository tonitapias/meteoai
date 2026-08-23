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
  getBlackMarbleOpacityExp,
  MAPBOX_DEM_URL,
  getNasaFiresWmsUrl,
  getNasaFiresOpacityExp,
  getSunLightConfig
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

// --- CIRURGIA 1: FORAT NEGRE PER A CANCEL·LACIÓ DE XARXA ---
const TRANSPARENT_PIXEL = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

// -----------------------------------------------------------------------------
// HELPER ASTRONÒMIC LOCAL PER A L'ATMOSFERA DE MAPBOX
// -----------------------------------------------------------------------------
const getSunAltitude = (timestamp: number, lat: number, lon: number): number => {
  const PI = Math.PI, rad = PI / 180, deg = 180 / PI;
  const d = (timestamp / 86400000 + 2440587.5) - 2451545.0;
  const M = (357.5291 + 0.98560028 * d) * rad;
  const C = (1.9148 * Math.sin(M) + 0.0200 * Math.sin(2 * M) + 0.0003 * Math.sin(3 * M)) * rad;
  const L = (280.4665 + 0.98564736 * d + C * deg) % 360 * rad;
  const e = 23.439 * rad;
  const sunDec = Math.asin(Math.sin(e) * Math.sin(L));
  const sunRA = Math.atan2(Math.cos(e) * Math.sin(L), Math.cos(L));
  
  const gmstDeg = (280.46061837 + 360.98564736629 * d) % 360;
  let lmstDeg = (gmstDeg + lon) % 360;
  if (lmstDeg < 0) lmstDeg += 360;
  const lmstRad = lmstDeg * rad;
  
  const hourAngle = lmstRad - sunRA;
  const latRad = lat * rad;
  const sinAlt = Math.sin(latRad) * Math.sin(sunDec) + Math.cos(latRad) * Math.cos(sunDec) * Math.cos(hourAngle);
  return Math.asin(sinAlt) * deg;
};

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const lerpColor = (c1: number[], c2: number[], t: number) => 
  `rgb(${Math.round(lerp(c1[0], c2[0], t))}, ${Math.round(lerp(c1[1], c2[1], t))}, ${Math.round(lerp(c1[2], c2[2], t))})`;
// -----------------------------------------------------------------------------

export default function RadarMap({ lat, lon, isActive }: RadarMapProps) {
  const { t } = useTranslation();
  
  const { loading, error, radarData, fetchRadarData } = useRadarData();
  
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
  
  // SISTEMA HÍBRID: Afegeixo estat HD
  const [overlays, setOverlays] = useState({ 
    precip: true, 
    satIR: true, // Capa Global Edge Proxy
    hdGoes: false, // Amèrica
    hdMeteosat: false, // Europa
    hdHimawari: false, // Àsia
    night: true, 
    labels: false, 
    nasaReal: false,
    nasaFires: false,
    terrain3D: false
  });
  const [showLayerMenu, setShowLayerMenu] = useState(false);
  
  const [webglKey, setWebglKey] = useState(0);

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const hostRef = useRef<string>('');
  const radarFramesRef = useRef<RadarFrame[]>([]);
  const satFramesRef = useRef<RadarFrame[]>([]);
  
  const animationTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const nightTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const preloadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const currentFrameIndexRef = useRef<number>(0);
  const timeDisplayRef = useRef<HTMLSpanElement>(null);
  
  const loadedRadarIdsRef = useRef<Record<number, string>>({});
  const loadedSatIdsRef = useRef<Record<number, string>>({});
  const overlaysRef = useRef(overlays);
  const activeBaseLayerRef = useRef(activeBaseLayer);
  const currentFrameTimestampRef = useRef<number | null>(null);

  const prevNasaRealRef = useRef(overlays.nasaReal);
  const prevBlackMarbleRef = useRef(activeBaseLayer === 'black_marble');
  const prevNasaFiresRef = useRef(overlays.nasaFires);
  const prevTerrain3DRef = useRef(overlays.terrain3D);

  useEffect(() => { activeBaseLayerRef.current = activeBaseLayer; }, [activeBaseLayer]);

  const toggleOverlay = useCallback((key: keyof typeof overlays) => {
    setOverlays(prev => {
      const next = { ...prev, [key]: !prev[key] };
      
      // LÒGICA D'ARQUITECTE: Exclusivitat de Satèl·lits
      // Evita solapaments i millora l'experiència d'usuari
      if (key === 'hdGoes' && next.hdGoes) {
        next.satIR = false; next.hdMeteosat = false; next.hdHimawari = false;
      } else if (key === 'hdMeteosat' && next.hdMeteosat) {
        next.satIR = false; next.hdGoes = false; next.hdHimawari = false;
      } else if (key === 'hdHimawari' && next.hdHimawari) {
        next.satIR = false; next.hdGoes = false; next.hdMeteosat = false;
      } else if (key === 'satIR' && next.satIR) {
        next.hdGoes = false; next.hdMeteosat = false; next.hdHimawari = false;
      }

      overlaysRef.current = next;
      return next;
    });
  }, []);

  const formatTime = useCallback((ts?: number | null) => {
    if (ts === null || ts === undefined || isNaN(ts)) return "--:--";
    return new Date(ts * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }, []);

  const syncAtmosphere = useCallback(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;

    try {
      const center = map.getCenter();
      const evalTime = currentFrameTimestampRef.current ? currentFrameTimestampRef.current * 1000 : Date.now();
      const alt = getSunAltitude(evalTime, center.lat, center.lng);

      const isDarkTheme = activeBaseLayerRef.current === 'dark' || activeBaseLayerRef.current === 'black_marble';
      
      let factor = 0; 
      if (isDarkTheme) {
        factor = 1; 
      } else {
        if (alt < -12) factor = 1; 
        else if (alt < 0) factor = Math.abs(alt) / 12; 
      }

      const colorDay = [186, 210, 235], colorNight = [12, 22, 40];
      const highDay = [36, 92, 223], highNight = [18, 30, 55];
      const spaceDay = [11, 23, 44], spaceNight = [2, 4, 10];

      map.setFog({
        'color': lerpColor(colorDay, colorNight, factor),
        'high-color': lerpColor(highDay, highNight, factor),
        'space-color': lerpColor(spaceDay, spaceNight, factor),
        'horizon-blend': lerp(0.15, 0.40, factor),
        'star-intensity': lerp(0.0, 0.85, factor)
      });
    } catch (e) {
      console.warn("[Zero Risk] Atmosfera silenciada", e);
    }
  }, []);

  const syncLighting = useCallback((timestampMs: number | null) => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;

    const evalTime = timestampMs || Date.now();
    const { position, intensity } = getSunLightConfig(evalTime, lat, lon);

    const isDarkTheme = activeBaseLayerRef.current === 'dark' || activeBaseLayerRef.current === 'black_marble';
    const finalIntensity = isDarkTheme ? 0.15 : intensity; 
    
    try {
      map.setLights([{
        id: 'flat-light',
        type: 'flat',
        properties: {
          anchor: 'map',
          position: position,
          color: isDarkTheme ? '#8ba1c5' : '#ffffff', 
          intensity: finalIntensity
        }
      }]);
    } catch (e) {
      console.warn("[Zero Risk] Llums silenciades", e);
    }
  }, [lat, lon]);

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
          console.warn("[Zero Risk] Neteja de radar silenciada", e);
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
          
          // NETEJA HD: Esborrem també les capes satèl·lit natives
          const hdAgencies = ['goes', 'meteosat', 'himawari'] as const;
          hdAgencies.forEach(agency => {
             const hdLId = `hd-${agency}-layer-${timestamp}`;
             const hdSId = `hd-${agency}-src-${timestamp}`;
             if (map.getLayer(hdLId)) map.removeLayer(hdLId);
             if (map.getSource(hdSId)) map.removeSource(hdSId);
          });

          delete loadedSatIdsRef.current[idx];
        } catch (e) {
          console.warn("[Zero Risk] Neteja de satèl·lit silenciada", e);
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
    const initialRadOpacity = (isTarget && overlaysRef.current.precip) ? 0.88 : 0;

    // --- 1. CAPA DE PRECIPITACIÓ ---
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
          'raster-opacity-transition': { duration: 0, delay: 0 }, 
          'raster-fade-duration': 0,
          'raster-resampling': 'linear' 
        },
      }, 'z-index-radar'); 
      loadedRadarIdsRef.current[index] = radLayerId;
    }

    // --- 2. SISTEMA HÍBRID DE SATÈL·LIT ---
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
        const timestamp = sFrame.time;
        const satSourceId = `sat-src-${timestamp}`;
        const satLayerId = `sat-layer-${timestamp}`;
        
        const workerHost = 'https://meteo-sat-proxy.tonitapias.workers.dev';

        // --- A. SATÈL·LIT GLOBAL (Edge Proxy) ---
        if (!loadedSatIdsRef.current[closestSatIdx] && !map.getSource(satSourceId)) {
          const rvHostEnc = encodeURIComponent(hostRef.current);
          const rvPathEnc = encodeURIComponent(sFrame.path);

          map.addSource(satSourceId, {
            type: 'raster',
            tiles: [`${workerHost}/sat/{z}/{x}/{y}.png?host=${rvHostEnc}&path=${rvPathEnc}`],
            tileSize: 512,
            maxzoom: 6
          });
          
          map.addLayer({
            id: satLayerId,
            type: 'raster',
            source: satSourceId,
            layout: { visibility: overlaysRef.current.satIR ? 'visible' : 'none' },
            paint: {
              'raster-opacity': getSatOpacityExp(isTarget && overlaysRef.current.satIR ? 0.85 : 0),
              'raster-opacity-transition': { duration: 0, delay: 0 }, 
              'raster-contrast': 0.25,
              'raster-saturation': -1.0, 
              'raster-resampling': 'linear',
              'raster-fade-duration': 0
            },
          }, 'z-index-clouds'); 
          
          loadedSatIdsRef.current[closestSatIdx] = satLayerId;
        }

        // --- B. SATÈL·LITS HD CRUS (Generació Exclusiva i Protegida) ---
        const hdAgencies = ['goes', 'meteosat', 'himawari'] as const;
        
        // TALLAFOCS 1: Límits geogràfics. Evita peticions 404/504 a zones buides.
        const HD_BOUNDS: Record<string, [number, number, number, number]> = {
          goes: [-160, -60, -20, 60],      // Amèrica
          meteosat: [-30, -60, 70, 60],    // Europa i Àfrica
          himawari: [80, -60, 180, 60]     // Àsia (Mapbox tolera fins a 180)
        };

        hdAgencies.forEach((agency) => {
          const hdSourceId = `hd-${agency}-src-${timestamp}`;
          const hdLayerId = `hd-${agency}-layer-${timestamp}`;
          
          let isHdVisible = false;
          if (agency === 'goes') isHdVisible = overlaysRef.current.hdGoes;
          if (agency === 'meteosat') isHdVisible = overlaysRef.current.hdMeteosat;
          if (agency === 'himawari') isHdVisible = overlaysRef.current.hdHimawari;

          if (isHdVisible && !map.getSource(hdSourceId)) {
            map.addSource(hdSourceId, {
              type: 'raster',
              tiles: [`${workerHost}/hd/${agency}/${timestamp}/{z}/{x}/{y}.png`],
              tileSize: 512, // TALLAFOCS 2: Demana menys tiles però més grans (75% menys de HTTPs)
              bounds: HD_BOUNDS[agency], 
              minzoom: 2,
              maxzoom: 8
            });
            
            map.addLayer({
              id: hdLayerId,
              type: 'raster',
              source: hdSourceId,
              // TALLAFOCS 3: La capa NEIX OCULTA per evitar el DDoS inicial
              layout: { visibility: (isTarget && isHdVisible) ? 'visible' : 'none' },
              paint: {
                'raster-opacity': getSatOpacityExp(isTarget ? 1.0 : 0),
                'raster-opacity-transition': { duration: 0, delay: 0 }, 
                'raster-saturation': -1.0, 
                'raster-contrast': 0.3,
                'raster-fade-duration': 0
              },
            }, 'z-index-clouds');
          }
        });
      }
    }
  }, []);

  const applyFrameVisibility = useCallback((index: number) => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return; 

    const rFramesCount = radarFramesRef.current.length;
    if (rFramesCount === 0) return;

    const safeIndex = (index % rFramesCount + rFramesCount) % rFramesCount;
    
    // ESTRATÈGIA DE FINESTRA: Carreguem només l'actual i els 3 següents.
    // Això permet a la NASA processar sense saturar la xarxa del navegador.
    ensureFrameLoaded(safeIndex);
    ensureFrameLoaded((safeIndex + 1) % rFramesCount);
    ensureFrameLoaded((safeIndex + 2) % rFramesCount);
    ensureFrameLoaded((safeIndex + 3) % rFramesCount);

    const targetRadarId = loadedRadarIdsRef.current[safeIndex];
    const currentRadarFrame = radarFramesRef.current[safeIndex];

    if (currentRadarFrame && currentRadarFrame.time !== null) {
      if (timeDisplayRef.current) {
         timeDisplayRef.current.textContent = formatTime(currentRadarFrame.time);
      }
      setCurrentFrameTimestamp(currentRadarFrame.time);
      currentFrameTimestampRef.current = currentRadarFrame.time; 
      syncLighting(currentRadarFrame.time * 1000); 
      syncAtmosphere();
    }

    const showPrecip = overlaysRef.current.precip;
    const showSat = overlaysRef.current.satIR;

    // Actualitza Visibilitat Radar
    Object.values(loadedRadarIdsRef.current).forEach((id) => {
      if (id && map.getLayer(id)) {
        const isTarget = id === targetRadarId;
        map.setLayoutProperty(id, 'visibility', showPrecip ? 'visible' : 'none');
        map.setPaintProperty(id, 'raster-opacity', getRadOpacityExp((showPrecip && isTarget) ? 0.88 : 0));
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
      // Calculem el fotograma immediatament següent per a la finestra de precàrrega
      const nextSatId = loadedSatIdsRef.current[(closestSatIdx + 1) % satFramesRef.current.length];

      // --- Neteja del timer anterior per evitar solapaments si cliques ràpid ---
      if (preloadTimerRef.current) clearTimeout(preloadTimerRef.current);

      // --- FASE 1: PRIORITAT AL TARGET (Síncron, 100% ample de banda) ---
      Object.values(loadedSatIdsRef.current).forEach((id) => {
        if (!id) return;
        const isTarget = id === targetSatId;
        const timeStr = id.replace('sat-layer-', '');
        const timestamp = Number(timeStr);

        // Visibilitat Satèl·lit Global
        if (map.getLayer(id)) {
          map.setLayoutProperty(id, 'visibility', (showSat && isTarget) ? 'visible' : 'none');
          map.setPaintProperty(id, 'raster-opacity', getSatOpacityExp((showSat && isTarget) ? 0.85 : 0));
        }

        // Visibilitat Estricta Satèl·lits HD Natius
        const hdAgencies = ['goes', 'meteosat', 'himawari'] as const;
        hdAgencies.forEach(agency => {
          const hdLayerId = `hd-${agency}-layer-${timestamp}`;
          if (map.getLayer(hdLayerId)) {
            let isHdVisible = false;
            if (agency === 'goes') isHdVisible = overlaysRef.current.hdGoes;
            if (agency === 'meteosat') isHdVisible = overlaysRef.current.hdMeteosat;
            if (agency === 'himawari') isHdVisible = overlaysRef.current.hdHimawari;

            // Només el TARGET es pinta ara. Els altres, a 'none' absolut.
            map.setLayoutProperty(hdLayerId, 'visibility', (isHdVisible && isTarget) ? 'visible' : 'none');
            map.setPaintProperty(hdLayerId, 'raster-opacity', getSatOpacityExp((isTarget && isHdVisible) ? 1.0 : 0));
          }
        });
      });

      // --- FASE 2: STAGGERED LOADING (+400ms decalatge per a mòbils) ---
      preloadTimerRef.current = setTimeout(() => {
        // Usem mapRef.current per evitar errors si el component es desmunta en aquests 400ms
        const currentMap = mapRef.current;
        if (!currentMap || !currentMap.isStyleLoaded()) return;

        Object.values(loadedSatIdsRef.current).forEach((id) => {
          if (!id || id !== nextSatId) return; // Només ens interessa el fotograma NEXT

          const timeStr = id.replace('sat-layer-', '');
          const timestamp = Number(timeStr);

          // Precàrrega Satèl·lit Global a l'ombra (visible però opacitat 0)
          if (currentMap.getLayer(id) && overlaysRef.current.satIR) {
            currentMap.setLayoutProperty(id, 'visibility', 'visible');
            currentMap.setPaintProperty(id, 'raster-opacity', 0);
          }

          // Precàrrega Satèl·lit HD a l'ombra
          const hdAgencies = ['goes', 'meteosat', 'himawari'] as const;
          hdAgencies.forEach(agency => {
            const hdLayerId = `hd-${agency}-layer-${timestamp}`;
            if (currentMap.getLayer(hdLayerId)) {
              let isHdVisible = false;
              if (agency === 'goes') isHdVisible = overlaysRef.current.hdGoes;
              if (agency === 'meteosat') isHdVisible = overlaysRef.current.hdMeteosat;
              if (agency === 'himawari') isHdVisible = overlaysRef.current.hdHimawari;

              if (isHdVisible) {
                currentMap.setLayoutProperty(hdLayerId, 'visibility', 'visible');
                currentMap.setPaintProperty(hdLayerId, 'raster-opacity', 0);
              }
            }
          });
        });
      }, 400); 
    }
  }, [ensureFrameLoaded, formatTime, syncLighting, syncAtmosphere]);

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
      zoom: 7, 
      attributionControl: false,
      maxZoom: 18,
      minZoom: 2,
      fadeDuration: 0,
      projection: { name: 'globe' } as unknown as mapboxgl.MapboxOptions['projection'], 
      
      // --- CIRURGIA 2: INTERCEPTOR DE XARXA NADIU (NETWORK FIREWALL) ---
      transformRequest: (url, resourceType) => {
        // Interceptem només les tessel·les WMS del nostre Worker
        if (resourceType === 'Tile' && url.includes('/hd/')) {
          
          // Llegim l'estat exacte gràcies al teu Ref, trencant el closure de React
          const currentOverlays = overlaysRef.current;
          
          const isGoes = url.includes('/hd/goes/');
          const isMeteosat = url.includes('/hd/meteosat/');
          const isHimawari = url.includes('/hd/himawari/');

          // Si el mapa intenta carregar una tessel·la d'una capa que acaba de ser desactivada...
          if (
            (isGoes && !currentOverlays.hdGoes) ||
            (isMeteosat && !currentOverlays.hdMeteosat) ||
            (isHimawari && !currentOverlays.hdHimawari)
          ) {
            // ...avortem la connexió HTTP i servim el píxel de la RAM a 0ms
            return { url: TRANSPARENT_PIXEL };
          }
        }
        
        // Via lliure per a la resta de peticions (BaseMaps, Radar, NASA Fires, etc.)
        return { url };
      }
    });
    mapRef.current = map;
    
    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'top-left');

    // --- TALLAFOCS D'ERRORS (DOCTRINA RISC ZERO) ---
        map.on('error', (e) => {
      const mapError = e.error as unknown as Record<string, unknown> | undefined;
      const status = mapError?.status as number | undefined;
      const message = (mapError?.message as string | undefined)?.toLowerCase() || '';
      
      const is404 = status === 404 || message.includes('404') || message.includes('not found');
      const sourceId = (e as unknown as Record<string, unknown>).sourceId as string | undefined;
      const isVolatileSource = sourceId && (sourceId.includes('nasa') || sourceId.includes('sat-') || sourceId.includes('rad-') || sourceId.includes('hd-'));
      
      if (is404 || isVolatileSource) return;
    });

    const handleTouchOrClick = () => setShowLayerMenu(false);
    map.on('mousedown', handleTouchOrClick);
    map.on('touchstart', handleTouchOrClick);

    map.on('move', syncAtmosphere);

    map.on('webglcontextlost', (e) => {
      e.originalEvent?.preventDefault();
      console.warn("[WebGL] Memòria gràfica alliberada pel dispositiu. Ressuscitant motor...");
      setWebglKey(prev => prev + 1); 
    });

    map.on('load', () => {
      try {
        syncAtmosphere(); 
        syncLighting(null);

        // 1. TERRAIN 3D
        map.addSource('mapbox-dem', {
          type: 'raster-dem',
          url: MAPBOX_DEM_URL,
          tileSize: 512,
          maxzoom: 14
        });

        // 2. MAPES BASE 
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

        // 3. ESTRUCTURA Z-INDEX RISC ZERO
        map.addLayer({ id: 'z-index-nasa-real', type: 'background', paint: { 'background-color': 'transparent', 'background-opacity': 0 } });
        map.addLayer({ id: 'z-index-clouds', type: 'background', paint: { 'background-color': 'transparent', 'background-opacity': 0 } });
        map.addLayer({ id: 'z-index-radar', type: 'background', paint: { 'background-color': 'transparent', 'background-opacity': 0 } });

        // 4. CAPA DE NIT 
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
        }, 'z-index-radar');
        
        // 5. INCENDIS NASA 
        map.addLayer({ id: 'z-index-nasa-fires', type: 'background', paint: { 'background-color': 'transparent', 'background-opacity': 0 } });

        // 6. ETIQUETES DE CIUTATS
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
      } catch (e) {
        console.error("[Zero Risk] Fallada crítica carregant capes inicials:", e);
      }
    });

    return () => {
      if (animationTimerRef.current) clearInterval(animationTimerRef.current);
      if (nightTimerRef.current) clearInterval(nightTimerRef.current);
      if (mapRef.current) { 
        mapRef.current.off('move', syncAtmosphere);
        mapRef.current.remove(); 
        mapRef.current = null; 
      }
      loadedRadarIdsRef.current = {};
      loadedSatIdsRef.current = {};
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lat, lon, fetchRadarData, BASE_LAYERS, webglKey, syncLighting, syncAtmosphere]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    
    const syncAllLayers = () => {
      if (!map.isStyleLoaded()) return;

      try {
        syncAtmosphere(); 
        syncLighting(currentFrameIndexRef.current ? (radarFramesRef.current[currentFrameIndexRef.current]?.time || null) : null);

        if (overlays.nasaReal && !map.getSource('source-nasa-real')) {
          const nasaDate = getNASADate();
          map.addSource('source-nasa-real', {
            type: 'raster',
            tiles: [
              `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/VIIRS_NOAA20_CorrectedReflectance_TrueColor/default/${nasaDate}/GoogleMapsCompatible_Level9/{z}/{y}/{x}.jpg`
            ],
            tileSize: 256,
            maxzoom: 8,
            attribution: '&copy; NASA / NOAA'
          });
          map.addLayer({
            id: 'layer-nasa-real',
            type: 'raster',
            source: 'source-nasa-real',
            layout: { visibility: 'none' }, 
            paint: { 'raster-opacity': 0 }
          }, 'z-index-nasa-real'); 
        }

        if (overlays.nasaFires && !map.getSource('source-nasa-fires')) {
          map.addSource('source-nasa-fires', {
            type: 'raster',
            tiles: [getNasaFiresWmsUrl()],
            tileSize: 256,
          });
          map.addLayer({
            id: 'layer-nasa-fires',
            type: 'raster',
            source: 'source-nasa-fires',
            layout: { visibility: 'none' },
            paint: { 
              'raster-opacity': 0,
              'raster-fade-duration': 400,
              'raster-resampling': 'nearest',
              'raster-contrast': 0.35,  
              'raster-saturation': 0.8  
            }
          }, 'z-index-nasa-fires'); 
        }

        if (map.getSource('mapbox-dem')) {
          if (overlays.terrain3D) {
            map.setTerrain({ source: 'mapbox-dem', exaggeration: 1.5 });
          } else {
            map.setTerrain(null as unknown as mapboxgl.TerrainSpecification);
          }
        }

        if (map.getLayer('layer-nasa-fires')) {
          map.setLayoutProperty('layer-nasa-fires', 'visibility', overlays.nasaFires ? 'visible' : 'none');
          map.setPaintProperty('layer-nasa-fires', 'raster-opacity', overlays.nasaFires ? getNasaFiresOpacityExp(1) : 0);
        }

        if (map.getLayer('layer-nasa-real')) {
          map.setLayoutProperty('layer-nasa-real', 'visibility', overlays.nasaReal ? 'visible' : 'none');
          map.setPaintProperty('layer-nasa-real', 'raster-opacity', overlays.nasaReal ? [
            'interpolate', ['linear'], ['zoom'],
            5.5, 1,   
            8.0, 0    
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
                  8.0, 1         
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
      } catch (error) {
        console.error("[Zero Risk] Error sincronitzant capes:", error);
      }
    };

    if (map.isStyleLoaded()) {
      syncAllLayers();
    } else {
      map.once('idle', syncAllLayers);
    }
  }, [activeBaseLayer, BASE_LAYERS, overlays, applyFrameVisibility, syncLighting, syncAtmosphere]);

  // --- NAVEGACIÓ CÀMERA HD (REFACTORITZADA) ---
  // Guardem l'estat previ per volar NOMÉS quan passem de OFF a ON (evita vols infinits)
  const prevHdRef = useRef({ 
    goes: overlays.hdGoes, 
    meteosat: overlays.hdMeteosat, 
    himawari: overlays.hdHimawari 
  });

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Detectem qui acaba de ser activat ara mateix
    const goesTurnedOn = overlays.hdGoes && !prevHdRef.current.goes;
    const metTurnedOn = overlays.hdMeteosat && !prevHdRef.current.meteosat;
    const himaTurnedOn = overlays.hdHimawari && !prevHdRef.current.himawari;

    // Actualitzem la memòria històrica
    prevHdRef.current = { 
      goes: overlays.hdGoes, 
      meteosat: overlays.hdMeteosat, 
      himawari: overlays.hdHimawari 
    };

    const executeCamera = (center: [number, number]) => {
      map.flyTo({ 
        center, 
        zoom: 3.0, 
        pitch: 0, 
        speed: 1.4, // Pujat a 1.4 per fer el viatge transoceànic més àgil 
        essential: true 
      });
    };

    const tryFly = (center: [number, number]) => {
      // Si el mapa està ocupat component les noves capes HD WebGL (isStyleLoaded = false),
      // NO avortem el vol (com feies abans). El posem a la cua fins que el mapa quedi lliure ('idle').
      if (map.isStyleLoaded()) {
        executeCamera(center);
      } else {
        map.once('idle', () => executeCamera(center));
      }
    };

    // Dispariem el vol segons qui s'hagi encès
    if (goesTurnedOn) tryFly([-95, 38]);
    else if (metTurnedOn) tryFly([15, 45]);
    else if (himaTurnedOn) tryFly([135, 20]);

  }, [overlays.hdGoes, overlays.hdMeteosat, overlays.hdHimawari]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const isNasaNow = overlays.nasaReal;
    const wasNasaBefore = prevNasaRealRef.current;
    prevNasaRealRef.current = isNasaNow;

    if (isNasaNow && !wasNasaBefore) {
      const executeCamera = () => {
        const currentZoom = map.getZoom();
        if (currentZoom > 4.5) map.flyTo({ zoom: 3.2, pitch: 0, bearing: 0, speed: 1.3, curve: 1.42, essential: true });
      };
      if (map.isStyleLoaded()) executeCamera();
      else map.once('idle', executeCamera);
    } 
  }, [overlays.nasaReal]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const isFiresNow = overlays.nasaFires;
    const wasFiresBefore = prevNasaFiresRef.current;
    prevNasaFiresRef.current = isFiresNow;

    if (isFiresNow && !wasFiresBefore) {
      const executeCamera = () => {
        const currentZoom = map.getZoom();
        if (currentZoom > 4.5) map.flyTo({ zoom: 3.5, pitch: 0, bearing: 0, speed: 1.3, curve: 1.42, essential: true });
      };
      if (map.isStyleLoaded()) executeCamera();
      else map.once('idle', executeCamera);
    } 
  }, [overlays.nasaFires]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    
    const isTerrainNow = overlays.terrain3D;
    const wasTerrainBefore = prevTerrain3DRef.current;
    prevTerrain3DRef.current = isTerrainNow;

    if (isTerrainNow && !wasTerrainBefore) {
      const executeCamera = () => {
        const currentZoom = map.getZoom();
        map.flyTo({ zoom: Math.max(currentZoom, 11.5), pitch: 65, speed: 1.2, curve: 1.42, essential: true });
      };
      if (map.isStyleLoaded()) executeCamera();
      else map.once('idle', executeCamera);
    } else if (!isTerrainNow && wasTerrainBefore) {
      const executeCamera = () => {
        map.flyTo({ pitch: 0, speed: 1.2, essential: true });
      };
      if (map.isStyleLoaded()) executeCamera();
      else map.once('idle', executeCamera);
    }
  }, [overlays.terrain3D]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const isBlackMarbleNow = activeBaseLayer === 'black_marble';
    const wasBlackMarbleBefore = prevBlackMarbleRef.current;
    prevBlackMarbleRef.current = isBlackMarbleNow;

    if (isBlackMarbleNow && !wasBlackMarbleBefore) {
      const executeCamera = () => {
        const currentZoom = map.getZoom();
        if (currentZoom > 3.0) map.flyTo({ zoom: 2.2, pitch: 0, bearing: 0, speed: 1.2, curve: 1.42, essential: true });
      };
      if (map.isStyleLoaded()) executeCamera();
      else map.once('idle', executeCamera);
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