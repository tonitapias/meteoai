import { useCallback, useEffect, useRef, MutableRefObject } from 'react';
import type { Map } from 'mapbox-gl';
import { getSunLightConfig, computeNightFeatures, BaseLayerType } from '../../utils/radarPhysics';

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

interface UseAstroEngineProps {
  mapRef: MutableRefObject<Map | null>;
  lat: number;
  lon: number;
  activeBaseLayer: BaseLayerType;
  currentFrameTimestampRef: MutableRefObject<number | null>;
}

export function useAstroEngine({
  mapRef,
  lat,
  lon,
  activeBaseLayer,
  currentFrameTimestampRef
}: UseAstroEngineProps) {
  
  const activeBaseLayerRef = useRef(activeBaseLayer);
  const isMountedRef = useRef<boolean>(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; };
  }, []);

  useEffect(() => {
    activeBaseLayerRef.current = activeBaseLayer;
  }, [activeBaseLayer]);

  const syncAtmosphere = useCallback(() => {
    if (!isMountedRef.current) return;
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
  }, [mapRef, currentFrameTimestampRef]);

  const syncLighting = useCallback((timestampMs: number | null) => {
    if (!isMountedRef.current) return;
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
  }, [lat, lon, mapRef]);

  useEffect(() => {
    const nightTimer = setInterval(() => {
      if (!isMountedRef.current) return;
      const map = mapRef.current;
      if (map && map.isStyleLoaded() && map.getSource('night-source')) {
        try {
          const source = map.getSource('night-source') as mapboxgl.GeoJSONSource;
          source.setData(computeNightFeatures(Date.now()) as unknown as Parameters<mapboxgl.GeoJSONSource['setData']>[0]);
        } catch (e) {
          console.warn("[Zero Risk] Actualització de nit silenciada", e);
        }
      }
    }, 60000);

    return () => clearInterval(nightTimer);
  }, [mapRef]);

  return {
    syncAtmosphere,
    syncLighting
  };
}