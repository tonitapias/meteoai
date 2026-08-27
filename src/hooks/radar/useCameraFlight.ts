import { useEffect, useRef, MutableRefObject, useCallback } from 'react';
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
  const isMountedRef = useRef<boolean>(true);
  const pendingCameraActionRef = useRef<boolean>(false);

  const prevHdRef = useRef({ 
    goes: overlays.hdGoes, 
    meteosat: overlays.hdMeteosat, 
    himawari: overlays.hdHimawari 
  });
  const prevNasaRealRef = useRef(overlays.nasaReal);
  const prevNasaFiresRef = useRef(overlays.nasaFires);
  const prevTerrain3DRef = useRef(overlays.terrain3D);
  const prevBlackMarbleRef = useRef(activeBaseLayer === 'black_marble');

  useEffect(() => {
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; };
  }, []);

  // GC de Càmera Atòmic: Evita apilar crides idle de mapbox quan hi ha clics ràpids
  const safeCameraExecute = useCallback((action: () => void) => {
    const map = mapRef.current;
    if (!map || !isMountedRef.current) return;

    if (map.isStyleLoaded()) {
      action();
    } else {
      if (!pendingCameraActionRef.current) {
        pendingCameraActionRef.current = true;
        map.once('idle', () => {
          pendingCameraActionRef.current = false;
          if (isMountedRef.current) action();
        });
      }
    }
  }, [mapRef]);

  // 1. Canvi de coordenades base
  useEffect(() => {
    const map = mapRef.current;
    if (map && map.isStyleLoaded() && isMountedRef.current) {
      map.flyTo({ center: [lon, lat], speed: 1.2 });
    }
  }, [lat, lon, mapRef]);

  // 2. Satèl·lits HD
  useEffect(() => {
    const goesTurnedOn = overlays.hdGoes && !prevHdRef.current.goes;
    const metTurnedOn = overlays.hdMeteosat && !prevHdRef.current.meteosat;
    const himaTurnedOn = overlays.hdHimawari && !prevHdRef.current.himawari;

    prevHdRef.current = { 
      goes: overlays.hdGoes, 
      meteosat: overlays.hdMeteosat, 
      himawari: overlays.hdHimawari 
    };

    const executeCamera = (center: [number, number]) => {
      if (!mapRef.current) return;
      mapRef.current.flyTo({ 
        center, 
        zoom: 3.0, 
        pitch: 0, 
        speed: 1.4, 
        essential: true 
      });
    };

    if (goesTurnedOn) safeCameraExecute(() => executeCamera([-95, 38]));
    else if (metTurnedOn) safeCameraExecute(() => executeCamera([15, 45]));
    else if (himaTurnedOn) safeCameraExecute(() => executeCamera([135, 20]));

  }, [overlays.hdGoes, overlays.hdMeteosat, overlays.hdHimawari, mapRef, safeCameraExecute]);

  // 3. NASA Real
  useEffect(() => {
    const isNasaNow = overlays.nasaReal;
    const wasNasaBefore = prevNasaRealRef.current;
    prevNasaRealRef.current = isNasaNow;

    if (isNasaNow && !wasNasaBefore) {
      safeCameraExecute(() => {
        const map = mapRef.current;
        if (!map) return;
        const currentZoom = map.getZoom();
        if (currentZoom > 4.5) map.flyTo({ zoom: 3.2, pitch: 0, bearing: 0, speed: 1.3, curve: 1.42, essential: true });
      });
    } 
  }, [overlays.nasaReal, mapRef, safeCameraExecute]);

  // 4. NASA Fires
  useEffect(() => {
    const isFiresNow = overlays.nasaFires;
    const wasFiresBefore = prevNasaFiresRef.current;
    prevNasaFiresRef.current = isFiresNow;

    if (isFiresNow && !wasFiresBefore) {
      safeCameraExecute(() => {
        const map = mapRef.current;
        if (!map) return;
        const currentZoom = map.getZoom();
        if (currentZoom > 4.5) map.flyTo({ zoom: 3.5, pitch: 0, bearing: 0, speed: 1.3, curve: 1.42, essential: true });
      });
    } 
  }, [overlays.nasaFires, mapRef, safeCameraExecute]);

  // 5. Terrain 3D
  useEffect(() => {
    const isTerrainNow = overlays.terrain3D;
    const wasTerrainBefore = prevTerrain3DRef.current;
    prevTerrain3DRef.current = isTerrainNow;

    if (isTerrainNow && !wasTerrainBefore) {
      safeCameraExecute(() => {
        const map = mapRef.current;
        if (!map) return;
        const currentZoom = map.getZoom();
        map.flyTo({ zoom: Math.max(currentZoom, 11.5), pitch: 65, speed: 1.2, curve: 1.42, essential: true });
      });
    } else if (!isTerrainNow && wasTerrainBefore) {
      safeCameraExecute(() => {
        const map = mapRef.current;
        if (map) map.flyTo({ pitch: 0, speed: 1.2, essential: true });
      });
    }
  }, [overlays.terrain3D, mapRef, safeCameraExecute]);

  // 6. Terra de Nit (Black Marble)
  useEffect(() => {
    const isBlackMarbleNow = activeBaseLayer === 'black_marble';
    const wasBlackMarbleBefore = prevBlackMarbleRef.current;
    prevBlackMarbleRef.current = isBlackMarbleNow;

    if (isBlackMarbleNow && !wasBlackMarbleBefore) {
      safeCameraExecute(() => {
        const map = mapRef.current;
        if (!map) return;
        const currentZoom = map.getZoom();
        if (currentZoom > 3.0) map.flyTo({ zoom: 2.2, pitch: 0, bearing: 0, speed: 1.2, curve: 1.42, essential: true });
      });
    } 
  }, [activeBaseLayer, mapRef, safeCameraExecute]);
}