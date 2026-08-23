import { useEffect, useRef, MutableRefObject } from 'react';
import type { Map } from 'mapbox-gl';
import { BaseLayerType } from '../../utils/radarPhysics';

interface UseCameraFlightProps {
  mapRef: MutableRefObject<Map | null>;
  lat: number;
  lon: number;
  activeBaseLayer: BaseLayerType;
  overlays: {
    hdGoes: boolean;
    hdMeteosat: boolean;
    hdHimawari: boolean;
    nasaReal: boolean;
    nasaFires: boolean;
    terrain3D: boolean;
    [key: string]: boolean | undefined;
  };
}

export function useCameraFlight({
  mapRef,
  lat,
  lon,
  activeBaseLayer,
  overlays
}: UseCameraFlightProps) {
  // Inicialitzem les referències prèvies per detectar canvis (comportament original intacte)
  const prevHdRef = useRef({ 
    goes: overlays.hdGoes, 
    meteosat: overlays.hdMeteosat, 
    himawari: overlays.hdHimawari 
  });
  const prevNasaRealRef = useRef(overlays.nasaReal);
  const prevNasaFiresRef = useRef(overlays.nasaFires);
  const prevTerrain3DRef = useRef(overlays.terrain3D);
  const prevBlackMarbleRef = useRef(activeBaseLayer === 'black_marble');

  // 1. Canvi de coordenades base
  useEffect(() => {
    if (mapRef.current && mapRef.current.isStyleLoaded()) {
      mapRef.current.flyTo({ center: [lon, lat], speed: 1.2 });
    }
  }, [lat, lon, mapRef]);

  // 2. Satèl·lits HD
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const goesTurnedOn = overlays.hdGoes && !prevHdRef.current.goes;
    const metTurnedOn = overlays.hdMeteosat && !prevHdRef.current.meteosat;
    const himaTurnedOn = overlays.hdHimawari && !prevHdRef.current.himawari;

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
        speed: 1.4, 
        essential: true 
      });
    };

    const tryFly = (center: [number, number]) => {
      if (map.isStyleLoaded()) {
        executeCamera(center);
      } else {
        map.once('idle', () => executeCamera(center));
      }
    };

    if (goesTurnedOn) tryFly([-95, 38]);
    else if (metTurnedOn) tryFly([15, 45]);
    else if (himaTurnedOn) tryFly([135, 20]);

  }, [overlays.hdGoes, overlays.hdMeteosat, overlays.hdHimawari, mapRef]);

  // 3. NASA Real
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
  }, [overlays.nasaReal, mapRef]);

  // 4. NASA Fires
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
  }, [overlays.nasaFires, mapRef]);

  // 5. Terrain 3D
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
  }, [overlays.terrain3D, mapRef]);

  // 6. Terra de Nit (Black Marble)
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
  }, [activeBaseLayer, mapRef]);
}