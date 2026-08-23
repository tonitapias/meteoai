import { useEffect, useRef, useState, useCallback, RefObject, MutableRefObject, Dispatch, SetStateAction } from 'react';
import mapboxgl from 'mapbox-gl';
import { 
  BaseLayerType, 
  BaseLayerConfig,
  computeNightFeatures,
  getNightOpacityExp,
  getBlackMarbleOpacityExp,
  MAPBOX_DEM_URL,
  getNasaFiresWmsUrl,
  getNasaFiresOpacityExp,
  getNASADate
} from '../../utils/radarPhysics';

// --- CIRURGIA: FORAT NEGRE PER A CANCEL·LACIÓ DE XARXA ---
const TRANSPARENT_PIXEL = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

interface UseMapLifecycleProps {
  mapContainerRef: RefObject<HTMLDivElement | null>;
  lat: number;
  lon: number;
  activeBaseLayer: BaseLayerType;
  BASE_LAYERS: Record<BaseLayerType, BaseLayerConfig>;
  overlaysRef: MutableRefObject<{
    night: boolean;
    labels: boolean;
    hdGoes: boolean;
    hdMeteosat: boolean;
    hdHimawari: boolean;
    [key: string]: boolean;
  }>;
  setShowLayerMenu: Dispatch<SetStateAction<boolean>>;
  syncAtmosphere: () => void;
  syncLighting: (timestampMs: number | null) => void;
  fetchRadarData: (force?: boolean) => void;
}

export function useMapLifecycle({
  mapContainerRef,
  lat,
  lon,
  activeBaseLayer,
  BASE_LAYERS,
  overlaysRef,
  setShowLayerMenu,
  syncAtmosphere,
  syncLighting,
  fetchRadarData
}: UseMapLifecycleProps) {
  
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const [webglKey, setWebglKey] = useState(0);

  // El Hook de Cicle de Vida s'encarrega d'instanciar i destruir.
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
      antialias: false,
            
      transformRequest: (url, resourceType) => {
        if (resourceType === 'Tile' && url.includes('/hd/')) {
          const currentOverlays = overlaysRef.current;
          const isGoes = url.includes('/hd/goes/');
          const isMeteosat = url.includes('/hd/meteosat/');
          const isHimawari = url.includes('/hd/himawari/');

          if (
            (isGoes && !currentOverlays.hdGoes) ||
            (isMeteosat && !currentOverlays.hdMeteosat) ||
            (isHimawari && !currentOverlays.hdHimawari)
          ) {
            return { url: TRANSPARENT_PIXEL };
          }
        }
        return { url };
      }
    });
    mapRef.current = map;
    
    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'top-left');

    map.addControl(
      new mapboxgl.GeolocateControl({
        positionOptions: { enableHighAccuracy: true },
        trackUserLocation: false, // Risc Zero
        showUserHeading: false    
      }),
      'top-left'
    );

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

        map.addSource('mapbox-dem', {
          type: 'raster-dem',
          url: MAPBOX_DEM_URL,
          tileSize: 512,
          maxzoom: 14
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

        map.addLayer({ id: 'z-index-nasa-real', type: 'background', paint: { 'background-color': 'transparent', 'background-opacity': 0 } });
        map.addLayer({ id: 'z-index-clouds', type: 'background', paint: { 'background-color': 'transparent', 'background-opacity': 0 } });
        map.addLayer({ id: 'z-index-radar', type: 'background', paint: { 'background-color': 'transparent', 'background-opacity': 0 } });

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
        
        map.addLayer({ id: 'z-index-nasa-fires', type: 'background', paint: { 'background-color': 'transparent', 'background-opacity': 0 } });

        map.addSource('labels-src', { type: 'raster', tiles: ['https://a.basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}@2x.png'], tileSize: 256 });
        map.addLayer({
          id: 'layer-labels',
          type: 'raster',
          source: 'labels-src',
          layout: { visibility: overlaysRef.current.labels ? 'visible' : 'none' },
          paint: { 'raster-opacity': 0.9 },
        });

        fetchRadarData();
      } catch (e) {
        console.error("[Zero Risk] Fallada crítica carregant capes inicials:", e);
      }
    });

    return () => {
      if (mapRef.current) { 
        mapRef.current.off('move', syncAtmosphere);
        mapRef.current.remove(); 
        mapRef.current = null; 
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [webglKey]); // Només es reconstrueix si forcem WebGLKey

  // Aquest efecte substitueix el gran bloque syncAllLayers() original
  // Encapsulem la lògica de visibilitat segons estats
  const syncLayersState = useCallback((
    currentOverlays: typeof overlaysRef.current, 
    currentActiveBase: BaseLayerType, 
    applyFrameVisibility: (index: number) => void,
    currentFrameIndex: number,
    radarFramesLength: number
  ) => {
    const map = mapRef.current;
    if (!map) return;

    const syncAllLayers = () => {
      if (!map.isStyleLoaded()) return;

      try {
        syncAtmosphere(); 
        // SyncLighting es fa dins de applyFrameVisibility
        
        if (currentOverlays.nasaReal && !map.getSource('source-nasa-real')) {
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

        if (currentOverlays.nasaFires && !map.getSource('source-nasa-fires')) {
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
          if (currentOverlays.terrain3D) {
            map.setTerrain({ source: 'mapbox-dem', exaggeration: 1.5 });
          } else {
            map.setTerrain(null as unknown as mapboxgl.TerrainSpecification);
          }
        }

        if (map.getLayer('layer-nasa-fires')) {
          map.setLayoutProperty('layer-nasa-fires', 'visibility', currentOverlays.nasaFires ? 'visible' : 'none');
          map.setPaintProperty('layer-nasa-fires', 'raster-opacity', currentOverlays.nasaFires ? getNasaFiresOpacityExp(1) : 0);
        }

        if (map.getLayer('layer-nasa-real')) {
          map.setLayoutProperty('layer-nasa-real', 'visibility', currentOverlays.nasaReal ? 'visible' : 'none');
          map.setPaintProperty('layer-nasa-real', 'raster-opacity', currentOverlays.nasaReal ? [
            'interpolate', ['linear'], ['zoom'],
            5.5, 1,   
            8.0, 0    
          ] : 0);
        }

        (Object.keys(BASE_LAYERS) as BaseLayerType[]).forEach((key) => {
          const layerId = `base-layer-${key}`;
          if (map.getLayer(layerId)) {
            map.setLayoutProperty(layerId, 'visibility', key === currentActiveBase ? 'visible' : 'none');
            
            let targetOpacity: number | mapboxgl.Expression = 0.000001;
            
            if (key === currentActiveBase) {
              if (currentOverlays.nasaReal) {
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
          map.setLayoutProperty('layer-night', 'visibility', currentOverlays.night ? 'visible' : 'none');
          map.setPaintProperty('layer-night', 'fill-color', (currentActiveBase === 'dark' || currentActiveBase === 'black_marble') ? '#000000' : '#040714');
          map.setPaintProperty('layer-night', 'fill-opacity', getNightOpacityExp(currentActiveBase === 'dark' || currentActiveBase === 'black_marble'));
        }

        if (map.getLayer('layer-labels')) {
          map.setLayoutProperty('layer-labels', 'visibility', currentOverlays.labels ? 'visible' : 'none');
        }

        if (radarFramesLength > 0) {
           applyFrameVisibility(currentFrameIndex);
        }
        
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
    
  }, [mapRef, syncAtmosphere, BASE_LAYERS, overlaysRef]);

  return {
    mapRef,
    webglKey,
    syncLayersState
  };
}