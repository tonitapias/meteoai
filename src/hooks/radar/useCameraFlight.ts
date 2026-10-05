import { useEffect, useRef, MutableRefObject, useCallback } from 'react';
import type { Map } from 'mapbox-gl';
import { BaseLayerType, Overlays, HD_BOUNDS, type HdAgency } from '../../utils/radarPhysics';

interface UseCameraFlightProps {
  mapRef: MutableRefObject<Map | null>;
  lat: number;
  lon: number;
  activeBaseLayer: BaseLayerType;
  overlays: Overlays;
  styleReadyRef: MutableRefObject<boolean>;
}

export function useCameraFlight({
  mapRef,
  lat,
  lon,
  activeBaseLayer,
  overlays,
  styleReadyRef
}: UseCameraFlightProps) {
  const isMountedRef = useRef<boolean>(true);

  // CORRECCIÓ (Fase 3): abans era un simple booleà compartit entre les 5+
  // crides de safeCameraExecute; si dues transicions demanaven una acció de
  // càmera abans que l'estil estigués carregat, la segona es perdia en
  // silenci. Ara és una cua: totes les accions pendents s'executen en ordre
  // quan arriba el proper 'idle'.
  const pendingActionsRef = useRef<Array<() => void>>([]);
  // Mapa on hi ha el `once('load')` pendent. Abans era un booleà: si aquell
  // mapa es destruïa abans del 'load' (pèrdua de context WebGL, o el doble
  // muntatge de StrictMode en dev), quedava a `true` per sempre i cap acció
  // de càmera del mapa nou s'executava.
  const loadListenerMapRef = useRef<Map | null>(null);

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

  const safeCameraExecute = useCallback((action: () => void) => {
    const map = mapRef.current;
    if (!map || !isMountedRef.current) return;

    if (styleReadyRef.current) {
      action();
      return;
    }

    pendingActionsRef.current.push(action);

    if (loadListenerMapRef.current !== map) {
      loadListenerMapRef.current = map;
      // CORRECCIÓ: `once('load', ...)` en lloc de `once('idle', ...)` —
      // vegeu styleReadyRef a useMapLifecycle.ts.
      map.once('load', () => {
        if (loadListenerMapRef.current === map) loadListenerMapRef.current = null;
        const actions = pendingActionsRef.current;
        pendingActionsRef.current = [];
        if (isMountedRef.current) {
          actions.forEach((pendingAction) => pendingAction());
        }
      });
    }
  }, [mapRef, styleReadyRef]);

  // 1. Canvi de coordenades base
  // CORRECCIÓ (Fase 3): abans aquest efecte NO passava per safeCameraExecute,
  // era l'únic dels 6 sense protecció d'idle-defer. Si l'usuari canviava de
  // localització abans que el mapa acabés de carregar l'estil, el flyTo es
  // perdia i el mapa quedava encallat a la posició inicial.
  useEffect(() => {
    safeCameraExecute(() => {
      const map = mapRef.current;
      if (map) map.flyTo({ center: [lon, lat], speed: 1.2 });
    });
  }, [lat, lon, mapRef, safeCameraExecute]);

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

    // Si l'usuari ja mira dins la zona del satèl·lit (p. ex. Girona amb
    // Meteosat), no se l'envia al centre de la regió a z3: es manté el lloc i
    // només s'allunya fins a z5 si estava més a prop, com fan les capes NASA.
    // Fora de la zona, vol transoceànic al centre de la regió com sempre.
    const executeCamera = (agency: HdAgency, center: [number, number]) => {
      const map = mapRef.current;
      if (!map) return;
      const [west, south, east, north] = HD_BOUNDS[agency];
      const { lng, lat: centerLat } = map.getCenter();
      if (lng >= west && lng <= east && centerLat >= south && centerLat <= north) {
        if (map.getZoom() > 5) map.flyTo({ zoom: 5, pitch: 0, speed: 1.4, essential: true });
        return;
      }
      map.flyTo({
        center,
        zoom: 3.0,
        pitch: 0,
        speed: 1.4,
        essential: true
      });
    };

    if (goesTurnedOn) safeCameraExecute(() => executeCamera('goes', [-95, 38]));
    else if (metTurnedOn) safeCameraExecute(() => executeCamera('meteosat', [15, 45]));
    else if (himaTurnedOn) safeCameraExecute(() => executeCamera('himawari', [135, 20]));

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