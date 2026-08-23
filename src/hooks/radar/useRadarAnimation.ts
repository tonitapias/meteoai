import { useState, useRef, useCallback, useEffect, RefObject, MutableRefObject } from 'react';
import type { Map } from 'mapbox-gl';
import { z } from 'zod';
import { 
  RainViewerResponseSchema, 
  RadarFrame, 
  getRadOpacityExp, 
  getSatOpacityExp 
} from '../../utils/radarPhysics';

interface UseRadarAnimationProps {
  mapRef: MutableRefObject<Map | null>;
  overlaysRef: MutableRefObject<{
    precip: boolean;
    satIR: boolean;
    hdGoes: boolean;
    hdMeteosat: boolean;
    hdHimawari: boolean;
    [key: string]: boolean;
  }>;
  currentFrameTimestampRef: MutableRefObject<number | null>;
  timeDisplayRef: RefObject<HTMLSpanElement | null>;
  formatTime: (ts?: number | null) => string;
  syncLighting: (timestampMs: number | null) => void;
  syncAtmosphere: () => void;
}

export function useRadarAnimation({
  mapRef,
  overlaysRef,
  currentFrameTimestampRef,
  timeDisplayRef,
  formatTime,
  syncLighting,
  syncAtmosphere
}: UseRadarAnimationProps) {
  
  // Estats
  const [isPlaying, setIsPlaying] = useState(false);
  const [framesCount, setFramesCount] = useState(0);
  const [currentFrameTimestamp, setCurrentFrameTimestamp] = useState<number | null>(null);

  // Referències d'estat
  const isPlayingRef = useRef<boolean>(false);
  const hostRef = useRef<string>('');
  const radarFramesRef = useRef<RadarFrame[]>([]);
  const satFramesRef = useRef<RadarFrame[]>([]);
  const currentFrameIndexRef = useRef<number>(0);
  
  // Referències a diccionaris de memòria i timers
  const loadedRadarIdsRef = useRef<Record<number, string>>({});
  const loadedSatIdsRef = useRef<Record<number, string>>({});
  const animationTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const preloadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Neteja en desmuntar el hook (Prevé fuites de memòria generals)
  useEffect(() => {
    return () => {
      if (animationTimerRef.current) clearInterval(animationTimerRef.current);
      if (preloadTimerRef.current) clearTimeout(preloadTimerRef.current);
      loadedRadarIdsRef.current = {};
      loadedSatIdsRef.current = {};
    };
  }, []);

  const cleanupExpiredLayers = useCallback((validRadarFrames: RadarFrame[], validSatFrames: RadarFrame[]) => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;

    const activeRadarTimes = new Set(validRadarFrames.map(f => f.time));
    const activeSatTimes = new Set(validSatFrames.map(f => f.time));

    Object.keys(loadedRadarIdsRef.current).forEach((key) => {
      const timestampKey = Number(key);
      const layerId = loadedRadarIdsRef.current[timestampKey];
      if (!layerId) return;
      
      if (!activeRadarTimes.has(timestampKey)) {
        const radSourceId = `rad-src-${timestampKey}`;
        try {
          if (map.getLayer(layerId)) map.removeLayer(layerId);
          if (map.getSource(radSourceId)) map.removeSource(radSourceId);
          delete loadedRadarIdsRef.current[timestampKey];
        } catch (e) {
          console.warn("[Zero Risk] Neteja de radar silenciada", e);
        }
      }
    });

    Object.keys(loadedSatIdsRef.current).forEach((key) => {
      const timestampKey = Number(key);
      const layerId = loadedSatIdsRef.current[timestampKey];
      if (!layerId) return;
      
      if (!activeSatTimes.has(timestampKey)) {
        const satSourceId = `sat-src-${timestampKey}`;
        try {
          if (map.getLayer(layerId)) map.removeLayer(layerId);
          if (map.getSource(satSourceId)) map.removeSource(satSourceId);
          
          const hdAgencies = ['goes', 'meteosat', 'himawari'] as const;
          hdAgencies.forEach(agency => {
             const hdLId = `hd-${agency}-layer-${timestampKey}`;
             const hdSId = `hd-${agency}-src-${timestampKey}`;
             if (map.getLayer(hdLId)) map.removeLayer(hdLId);
             if (map.getSource(hdSId)) map.removeSource(hdSId);
          });

          delete loadedSatIdsRef.current[timestampKey];
        } catch (e) {
          console.warn("[Zero Risk] Neteja de satèl·lit silenciada", e);
        }
      }
    });
  }, [mapRef]);

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

    if (!loadedRadarIdsRef.current[rFrame.time] && !map.getSource(radSourceId)) {
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
      loadedRadarIdsRef.current[rFrame.time] = radLayerId;
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
        const timestamp = sFrame.time;
        const satSourceId = `sat-src-${timestamp}`;
        const satLayerId = `sat-layer-${timestamp}`;
        const workerHost = 'https://meteo-sat-proxy.tonitapias.workers.dev';

        if (!loadedSatIdsRef.current[timestamp] && !map.getSource(satSourceId)) {
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
          
          loadedSatIdsRef.current[timestamp] = satLayerId;
        }

        const hdAgencies = ['goes', 'meteosat', 'himawari'] as const;
        const HD_BOUNDS: Record<string, [number, number, number, number]> = {
          goes: [-160, -60, -20, 60],
          meteosat: [-30, -60, 70, 60],
          himawari: [80, -60, 180, 60]
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
              tileSize: 512,
              bounds: HD_BOUNDS[agency], 
              minzoom: 2,
              maxzoom: 8
            });
            
            map.addLayer({
              id: hdLayerId,
              type: 'raster',
              source: hdSourceId,
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
  }, [mapRef, overlaysRef]);

  const applyFrameVisibility = useCallback((index: number) => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return; 

    const rFramesCount = radarFramesRef.current.length;
    if (rFramesCount === 0) return;

    const safeIndex = (index % rFramesCount + rFramesCount) % rFramesCount;
    
    const activeIndices = [
      safeIndex,
      (safeIndex + 1) % rFramesCount,
      (safeIndex + 2) % rFramesCount,
      (safeIndex + 3) % rFramesCount
    ];

    activeIndices.forEach(idx => ensureFrameLoaded(idx));

    // --- GARBAGE COLLECTOR ---
    const activeRadarTimestamps = new Set(
      activeIndices.map(idx => radarFramesRef.current[idx]?.time).filter(t => t !== null && t !== undefined)
    );
    
    const activeSatTimestamps = new Set<number>();
    if (satFramesRef.current.length > 0) {
      activeIndices.forEach(idx => {
        const rTime = radarFramesRef.current[idx]?.time;
        if (rTime) {
          let closestSatIdx = 0;
          let minDiff = Infinity;
          satFramesRef.current.forEach((sFrame, sIdx) => {
            if (!sFrame || sFrame.time === null) return;
            const diff = Math.abs(sFrame.time - rTime);
            if (diff < minDiff) { minDiff = diff; closestSatIdx = sIdx; }
          });
          const sTime = satFramesRef.current[closestSatIdx]?.time;
          if (sTime) activeSatTimestamps.add(sTime);
        }
      });
    }

    Object.keys(loadedRadarIdsRef.current).forEach((key) => {
      const ts = Number(key);
      if (!activeRadarTimestamps.has(ts)) {
        const layerId = loadedRadarIdsRef.current[ts];
        const sourceId = `rad-src-${ts}`;
        try {
          if (map.getLayer(layerId)) map.removeLayer(layerId);
          if (map.getSource(sourceId)) map.removeSource(sourceId);
          delete loadedRadarIdsRef.current[ts];
        } catch { /* silenci */ }
      }
    });

    Object.keys(loadedSatIdsRef.current).forEach((key) => {
      const ts = Number(key);
      if (!activeSatTimestamps.has(ts)) {
        const layerId = loadedSatIdsRef.current[ts];
        const sourceId = `sat-src-${ts}`;
        try {
          if (map.getLayer(layerId)) map.removeLayer(layerId);
          if (map.getSource(sourceId)) map.removeSource(sourceId);
          
          const hdAgencies = ['goes', 'meteosat', 'himawari'] as const;
          hdAgencies.forEach(agency => {
             const hdLId = `hd-${agency}-layer-${ts}`;
             const hdSId = `hd-${agency}-src-${ts}`;
             if (map.getLayer(hdLId)) map.removeLayer(hdLId);
             if (map.getSource(hdSId)) map.removeSource(hdSId);
          });
          
          delete loadedSatIdsRef.current[ts];
        } catch { /* silenci */ }
      }
    });

    const currentRadarFrame = radarFramesRef.current[safeIndex];
    const targetRadarId = currentRadarFrame?.time ? loadedRadarIdsRef.current[currentRadarFrame.time] : undefined;

    if (currentRadarFrame && currentRadarFrame.time !== null) {
      if (timeDisplayRef.current) {
         timeDisplayRef.current.textContent = formatTime(currentRadarFrame.time);
      }
      setCurrentFrameTimestamp(currentRadarFrame.time);
      currentFrameTimestampRef.current = currentRadarFrame.time; 
      
      if (!isPlayingRef.current) {
        syncLighting(currentRadarFrame.time * 1000);
        syncAtmosphere();
      }
    }

    const showPrecip = overlaysRef.current.precip;
    const hasAnyHdEnabled = overlaysRef.current.hdGoes || overlaysRef.current.hdMeteosat || overlaysRef.current.hdHimawari;
    const showSat = overlaysRef.current.satIR || (isPlayingRef.current && hasAnyHdEnabled);

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
      
      const sFrame = satFramesRef.current[closestSatIdx];
      const targetSatId = sFrame?.time ? loadedSatIdsRef.current[sFrame.time] : undefined;
      
      const nextSFrame = satFramesRef.current[(closestSatIdx + 1) % satFramesRef.current.length];
      const nextSatId = nextSFrame?.time ? loadedSatIdsRef.current[nextSFrame.time] : undefined;

      if (preloadTimerRef.current) clearTimeout(preloadTimerRef.current);

      Object.values(loadedSatIdsRef.current).forEach((id) => {
        if (!id) return;
        const isTarget = id === targetSatId;
        const timeStr = id.replace('sat-layer-', '');
        const timestamp = Number(timeStr);

        if (map.getLayer(id)) {
          map.setLayoutProperty(id, 'visibility', (showSat && isTarget) ? 'visible' : 'none');
          map.setPaintProperty(id, 'raster-opacity', getSatOpacityExp((showSat && isTarget) ? 0.85 : 0));
        }

        const hdAgencies = ['goes', 'meteosat', 'himawari'] as const;
        hdAgencies.forEach(agency => {
          const hdLayerId = `hd-${agency}-layer-${timestamp}`;
          if (map.getLayer(hdLayerId)) {
            let isHdVisible = false;
            if (!isPlayingRef.current) {
              if (agency === 'goes') isHdVisible = overlaysRef.current.hdGoes;
              if (agency === 'meteosat') isHdVisible = overlaysRef.current.hdMeteosat;
              if (agency === 'himawari') isHdVisible = overlaysRef.current.hdHimawari;
            }

            map.setLayoutProperty(hdLayerId, 'visibility', (isHdVisible && isTarget) ? 'visible' : 'none');
            map.setPaintProperty(hdLayerId, 'raster-opacity', getSatOpacityExp((isTarget && isHdVisible) ? 1.0 : 0));
          }
        });
      });

      preloadTimerRef.current = setTimeout(() => {
        const currentMap = mapRef.current;
        if (!currentMap || !currentMap.isStyleLoaded()) return;

        Object.values(loadedSatIdsRef.current).forEach((id) => {
          if (!id || id !== nextSatId) return; 

          const timeStr = id.replace('sat-layer-', '');
          const timestamp = Number(timeStr);

          if (currentMap.getLayer(id) && showSat) { 
            currentMap.setLayoutProperty(id, 'visibility', 'visible');
            currentMap.setPaintProperty(id, 'raster-opacity', 0);
          }

          const hdAgencies = ['goes', 'meteosat', 'himawari'] as const;
          hdAgencies.forEach(agency => {
            const hdLayerId = `hd-${agency}-layer-${timestamp}`;
            if (currentMap.getLayer(hdLayerId)) {
              let isHdVisible = false;
              if (!isPlayingRef.current) {
                if (agency === 'goes') isHdVisible = overlaysRef.current.hdGoes;
                if (agency === 'meteosat') isHdVisible = overlaysRef.current.hdMeteosat;
                if (agency === 'himawari') isHdVisible = overlaysRef.current.hdHimawari;
              }

              if (isHdVisible) {
                currentMap.setLayoutProperty(hdLayerId, 'visibility', 'visible');
                currentMap.setPaintProperty(hdLayerId, 'raster-opacity', 0);
              }
            }
          });
        });
      }, 400); 
    }
  }, [ensureFrameLoaded, formatTime, mapRef, overlaysRef, syncAtmosphere, syncLighting, currentFrameTimestampRef, timeDisplayRef]);

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
  }, [ensureFrameLoaded, applyFrameVisibility, cleanupExpiredLayers, mapRef]);

  const togglePlay = useCallback(() => {
    if (radarFramesRef.current.length === 0) return;
    const nextPlayState = !isPlayingRef.current;
    setIsPlaying(nextPlayState);
    isPlayingRef.current = nextPlayState;
    
    if (nextPlayState) {
      currentFrameIndexRef.current = 0;
      applyFrameVisibility(0);
    } else {
      applyFrameVisibility(currentFrameIndexRef.current);
    }
  }, [applyFrameVisibility]);

  const setAnimationActive = useCallback((active: boolean) => {
    if (active && isPlayingRef.current && radarFramesRef.current.length > 0) {
      if (animationTimerRef.current) clearInterval(animationTimerRef.current);
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
  }, [applyFrameVisibility]);

  return {
    isPlaying,
    setIsPlaying,
    isPlayingRef,
    framesCount,
    currentFrameTimestamp,
    injectLayersIntoMap,
    togglePlay,
    setAnimationActive,
    applyFrameVisibility,
    radarFramesRef,
    currentFrameIndexRef
  };
}