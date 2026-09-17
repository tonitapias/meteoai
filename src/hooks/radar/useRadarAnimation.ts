import { useState, useRef, useCallback, useEffect, RefObject, MutableRefObject } from 'react';
import type { Map } from 'mapbox-gl';
import { z } from 'zod';
import {
  RainViewerResponseSchema,
  RadarFrame,
  Overlays,
  getRadOpacityExp,
  getSatOpacityExp,
  Z_LAYERS
} from '../../utils/radarPhysics';

interface UseRadarAnimationProps {
  mapRef: MutableRefObject<Map | null>;
  overlaysRef: MutableRefObject<Overlays>;
  currentFrameTimestampRef: MutableRefObject<number | null>;
  timeDisplayRef: RefObject<HTMLSpanElement | null>;
  formatTime: (ts?: number | null) => string;
  syncLighting: (timestampMs: number | null) => void;
  syncAtmosphere: () => void;
}

type HdAgency = 'goes' | 'meteosat' | 'himawari';

// PERF (fluïdesa): les capes HD ("Alta Resolució") no caduquen fins que
// l'API de RainViewer rota el frame de satèl·lit sencer (minuts). Com que
// el "Lazy Load Slider" precarrega frames a mesura que avança la
// reproducció, deixar una agència HD activa durant un cicle complet de
// loop acaba carregant una font+capa per a CADA frame de satèl·lit
// disponible. Amb les 3 agències actives simultàniament això pot arribar a
// desenes de tessel·les d'alta resolució vives alhora — exactament la
// pressió de VRAM que fa que el WebGL context es perdi en dispositius
// limitats (vegeu el listener 'webglcontextlost'). Limitem cada agència a
// una finestra FIFO petita: en afegir-ne una de nova per sobre del límit,
// expulsem la més antiga (mai la que és l'objectiu actual).
const MAX_LIVE_HD_FRAMES_PER_AGENCY = 4;

export function useRadarAnimation({
  mapRef,
  overlaysRef,
  currentFrameTimestampRef,
  timeDisplayRef,
  formatTime,
  syncLighting,
  syncAtmosphere
}: UseRadarAnimationProps) {

  const [isPlaying, setIsPlaying] = useState(false);
  const [framesCount, setFramesCount] = useState(0);
  const [currentFrameTimestamp, setCurrentFrameTimestamp] = useState<number | null>(null);

  const isPlayingRef = useRef<boolean>(false);
  const hostRef = useRef<string>('');
  const radarFramesRef = useRef<RadarFrame[]>([]);
  const satFramesRef = useRef<RadarFrame[]>([]);
  const currentFrameIndexRef = useRef<number>(0);

  const loadedRadarIdsRef = useRef<Record<number, string>>({});
  const loadedSatIdsRef = useRef<Record<number, string>>({});
  const animationTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Ordre d'inserció dels timestamps HD carregats per agència (FIFO per al
  // límit MAX_LIVE_HD_FRAMES_PER_AGENCY, vegeu ensureFrameLoaded).
  const hdLoadOrderRef = useRef<Record<HdAgency, number[]>>({
    goes: [],
    meteosat: [],
    himawari: []
  });

  // CORRECCIÓ (Fase 3): abans les capes HD només es retiraven quan la
  // pròpia API de RainViewer feia caducar el timestamp (cicle de ~5 min).
  // Si l'usuari feia toggle ON/OFF repetit d'un satèl·lit HD, cada ON creava
  // fonts noves que no es reciclaven fins al següent refresc de dades,
  // acumulant pressió real sobre la VRAM. Ara detectem la transició
  // ON->OFF i alliberem la capa/font immediatament per a l'agència afectada.
  const prevHdEnabledRef = useRef<Record<HdAgency, boolean>>({
    goes: false,
    meteosat: false,
    himawari: false
  });

  const isMountedRef = useRef<boolean>(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (animationTimerRef.current) clearInterval(animationTimerRef.current);
      loadedRadarIdsRef.current = {};
      loadedSatIdsRef.current = {};
    };
  }, []);

  const safeRemoveLayerAndSource = useCallback((map: Map, layerId: string, sourceId: string) => {
    try {
      if (map.getLayer(layerId)) map.removeLayer(layerId);
      if (map.getSource(sourceId)) map.removeSource(sourceId);
    } catch (e) {
      console.warn(`[Zero Risk] Error atòmic netejant ${layerId} / ${sourceId}:`, e);
    }
  }, []);

  // Allibera totes les capes/fonts HD d'una agència concreta per a tots els
  // timestamps de satèl·lit coneguts actualment. Es crida quan l'usuari
  // desactiva l'overlay HD corresponent.
  const pruneHdAgency = useCallback((agency: HdAgency) => {
    const map = mapRef.current;
    if (!map) return;
    satFramesRef.current.forEach((sFrame) => {
      if (!sFrame || sFrame.time === null) return;
      const layerId = `hd-${agency}-layer-${sFrame.time}`;
      const sourceId = `hd-${agency}-src-${sFrame.time}`;
      safeRemoveLayerAndSource(map, layerId, sourceId);
    });
    hdLoadOrderRef.current[agency] = [];
  }, [mapRef, safeRemoveLayerAndSource]);

  // Només destrueix frames quan la pròpia API ens diu que ja han caducat en el temps
  const cleanupExpiredLayers = useCallback((validRadarFrames: RadarFrame[], validSatFrames: RadarFrame[]) => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;

    const activeRadarTimes = new Set(validRadarFrames.map(f => f.time));
    const activeSatTimes = new Set(validSatFrames.map(f => f.time));

    Object.keys(loadedRadarIdsRef.current).forEach((key) => {
      const timestampKey = Number(key);
      if (!activeRadarTimes.has(timestampKey)) {
        const layerId = loadedRadarIdsRef.current[timestampKey];
        const radSourceId = `rad-src-${timestampKey}`;
        safeRemoveLayerAndSource(map, layerId, radSourceId);
        delete loadedRadarIdsRef.current[timestampKey];
      }
    });

    Object.keys(loadedSatIdsRef.current).forEach((key) => {
      const timestampKey = Number(key);
      if (!activeSatTimes.has(timestampKey)) {
        const layerId = loadedSatIdsRef.current[timestampKey];
        const satSourceId = `sat-src-${timestampKey}`;
        safeRemoveLayerAndSource(map, layerId, satSourceId);

        const hdAgencies: HdAgency[] = ['goes', 'meteosat', 'himawari'];
        hdAgencies.forEach(agency => {
             const hdLId = `hd-${agency}-layer-${timestampKey}`;
             const hdSId = `hd-${agency}-src-${timestampKey}`;
             safeRemoveLayerAndSource(map, hdLId, hdSId);
             hdLoadOrderRef.current[agency] = hdLoadOrderRef.current[agency].filter(t => t !== timestampKey);
        });

        delete loadedSatIdsRef.current[timestampKey];
      }
    });
  }, [mapRef, safeRemoveLayerAndSource]);

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

    // HACK VRAM: 0.000001 força la pre-càrrega a GPU sense ser visible. Evita parpellejos.
    const initialRadOpacity = (isTarget && overlaysRef.current.precip) ? 0.88 : 0.000001;

    if (!loadedRadarIdsRef.current[rFrame.time] && !map.getSource(radSourceId)) {
      try {
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
        }, Z_LAYERS.PIS_6_UI);
        loadedRadarIdsRef.current[rFrame.time] = radLayerId;
      } catch (e) {
        console.warn(`[Zero Risk] Error afegint radar ${radLayerId}:`, e);
      }
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

          try {
            map.addSource(satSourceId, {
              type: 'raster',
              tiles: [`${workerHost}/sat/{z}/{x}/{y}.png?host=${rvHostEnc}&path=${rvPathEnc}`],
              tileSize: 512,
              maxzoom: 6
            });

            const targetSatOpacity = (isTarget && overlaysRef.current.satIR) ? 0.85 : 0.000001;

            map.addLayer({
              id: satLayerId,
              type: 'raster',
              source: satSourceId,
              layout: { visibility: overlaysRef.current.satIR ? 'visible' : 'none' },
              paint: {
                'raster-opacity': getSatOpacityExp(targetSatOpacity),
                'raster-opacity-transition': { duration: 0, delay: 0 },
                'raster-contrast': 0.25,
                'raster-saturation': -1.0,
                'raster-resampling': 'linear',
                'raster-fade-duration': 0
              },
            }, Z_LAYERS.PIS_4_FILTER);

            loadedSatIdsRef.current[timestamp] = satLayerId;
          } catch (e) {
            console.warn(`[Zero Risk] Error afegint satèl·lit ${satLayerId}:`, e);
          }
        }

        const hdAgencies: HdAgency[] = ['goes', 'meteosat', 'himawari'];
        const HD_BOUNDS: Record<HdAgency, [number, number, number, number]> = {
          goes: [-160, -60, -20, 60],
          meteosat: [-30, -60, 70, 60],
          himawari: [80, -60, 180, 60]
        };
        // CORRECCIÓ (diagnòstic en producció, 2026-09-15): el producte GIBS
        // "Band13_Clean_Infrared" de GOES i Himawari ve amb una paleta
        // realçada (verd/blau/vermell per a tempestes fortes), a diferència
        // del msg_fes:ir108 d'EUMETSAT (Meteosat), que ja és blanc i negre
        // natiu. Forçar `raster-saturation: -1` per igual a les tres
        // agències eliminava exactament el senyal visual que fa "HD" la
        // capa de GOES/Himawari, deixant-la com un gris pla indistingible
        // dels núvols IR normals (Meteosat no es notava perquè ja és B/N).
        const HD_SATURATION: Record<HdAgency, number> = {
          goes: 0,
          meteosat: -1,
          himawari: 0
        };

        hdAgencies.forEach((agency) => {
          const hdSourceId = `hd-${agency}-src-${timestamp}`;
          const hdLayerId = `hd-${agency}-layer-${timestamp}`;

          let isHdVisible = false;
          if (agency === 'goes') isHdVisible = overlaysRef.current.hdGoes;
          if (agency === 'meteosat') isHdVisible = overlaysRef.current.hdMeteosat;
          if (agency === 'himawari') isHdVisible = overlaysRef.current.hdHimawari;

          if (isHdVisible && !map.getSource(hdSourceId)) {
            try {
              map.addSource(hdSourceId, {
                type: 'raster',
                tiles: [`${workerHost}/hd/${agency}/${timestamp}/{z}/{x}/{y}.png`],
                tileSize: 512,
                bounds: HD_BOUNDS[agency],
                minzoom: 2,
                maxzoom: 8
              });

              const hdTargetOpacity = isTarget ? 1.0 : 0.000001;

              map.addLayer({
                id: hdLayerId,
                type: 'raster',
                source: hdSourceId,
                layout: { visibility: isHdVisible ? 'visible' : 'none' },
                paint: {
                  'raster-opacity': getSatOpacityExp(hdTargetOpacity),
                  'raster-opacity-transition': { duration: 0, delay: 0 },
                  'raster-saturation': HD_SATURATION[agency],
                  'raster-contrast': 0.3,
                  'raster-fade-duration': 0
                },
              }, Z_LAYERS.PIS_4_FILTER);

              // PERF: finestra FIFO — expulsa el frame HD més antic d'aquesta
              // agència si ja hi ha MAX_LIVE_HD_FRAMES_PER_AGENCY vius (mai
              // expulsem el que és l'objectiu actual).
              const order = hdLoadOrderRef.current[agency];
              order.push(timestamp);
              while (order.length > MAX_LIVE_HD_FRAMES_PER_AGENCY) {
                const oldestTs = order[0];
                if (oldestTs === timestamp) break;
                order.shift();
                safeRemoveLayerAndSource(map, `hd-${agency}-layer-${oldestTs}`, `hd-${agency}-src-${oldestTs}`);
              }
            } catch (e) {
              console.warn(`[Zero Risk] Error afegint HD satèl·lit ${hdLayerId}:`, e);
            }
          }
        });
      }
    }
  }, [mapRef, overlaysRef, safeRemoveLayerAndSource]);

  // PERF (fluïdesa): durant la reproducció (cada 600ms) només UNA capa de
  // radar i UNA de satèl·lit/HD deixen de ser el frame actiu i UNA altra ho
  // passa a ser. Abans, cada tick recorria TOTES les capes acumulades
  // (poden arribar a la trentena amb HD actiu) fent 2 mutacions d'estil GL
  // per capa encara que gairebé cap hagués canviat. Aquest ref recorda quin
  // era l'"objectiu" anterior perquè, en mode animació, només toquem els 2
  // que realment canvien. Els canvis provocats per un toggle d'overlay (que
  // sí afecten TOTES les capes d'un tipus, p.ex. mostrar/amagar precip)
  // continuen fent el recorregut complet — vegeu el paràmetre `animationTick`.
  const lastTargetIdsRef = useRef<{ radar: string | null; sat: string | null; hd: Record<HdAgency, string | null> }>({
    radar: null,
    sat: null,
    hd: { goes: null, meteosat: null, himawari: null }
  });

  const applyFrameVisibility = useCallback((index: number, animationTick: boolean = false) => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;

    const rFramesCount = radarFramesRef.current.length;
    if (rFramesCount === 0) return;

    const safeIndex = (index % rFramesCount + rFramesCount) % rFramesCount;

    // Lazy Load Slider: Ens assegurem que els propers 4 frames estiguin injectats a Mapbox
    // (Un cop injectats NO s'eliminen fins que l'API els caduca, solucionant el parpelleig al fer loops)
    const activeIndices = [
      safeIndex,
      (safeIndex + 1) % rFramesCount,
      (safeIndex + 2) % rFramesCount,
      (safeIndex + 3) % rFramesCount
    ];
    activeIndices.forEach(idx => ensureFrameLoaded(idx));

    // CORRECCIÓ (Fase 3): detecció de transició ON->OFF per agència HD i
    // alliberament immediat de VRAM (veure pruneHdAgency més amunt).
    (['goes', 'meteosat', 'himawari'] as HdAgency[]).forEach((agency) => {
      const isEnabledNow = agency === 'goes' ? overlaysRef.current.hdGoes
        : agency === 'meteosat' ? overlaysRef.current.hdMeteosat
        : overlaysRef.current.hdHimawari;
      const wasEnabled = prevHdEnabledRef.current[agency];

      if (wasEnabled && !isEnabledNow) {
        pruneHdAgency(agency);
      }
      prevHdEnabledRef.current[agency] = isEnabledNow;
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
    const showSat = overlaysRef.current.satIR || hasAnyHdEnabled; // HD i IR van de la mà asíncrona

    // Aplicació d'Opacitats GPU sense desmuntar capes
    if (animationTick) {
      // Mode lleuger: només l'objectiu anterior (s'apaga) i el nou (s'encén).
      const prevRadarId = lastTargetIdsRef.current.radar;
      if (prevRadarId && prevRadarId !== targetRadarId && map.getLayer(prevRadarId)) {
        map.setPaintProperty(prevRadarId, 'raster-opacity', showPrecip ? getRadOpacityExp(0.000001) : 0);
      }
      if (targetRadarId && map.getLayer(targetRadarId)) {
        map.setLayoutProperty(targetRadarId, 'visibility', showPrecip ? 'visible' : 'none');
        map.setPaintProperty(targetRadarId, 'raster-opacity', showPrecip ? getRadOpacityExp(0.88) : 0);
      }
    } else {
      Object.values(loadedRadarIdsRef.current).forEach((id) => {
        if (id && map.getLayer(id)) {
          const isTarget = id === targetRadarId;
          const targetOpacity = isTarget ? 0.88 : 0.000001;

          map.setLayoutProperty(id, 'visibility', showPrecip ? 'visible' : 'none');
          map.setPaintProperty(id, 'raster-opacity', showPrecip ? getRadOpacityExp(targetOpacity) : 0);
        }
      });
    }
    lastTargetIdsRef.current.radar = targetRadarId ?? null;

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
      const hdAgencies: HdAgency[] = ['goes', 'meteosat', 'himawari'];

      if (animationTick) {
        const prevSatId = lastTargetIdsRef.current.sat;
        if (prevSatId && prevSatId !== targetSatId && map.getLayer(prevSatId)) {
          map.setPaintProperty(prevSatId, 'raster-opacity', showSat ? getSatOpacityExp(0.000001) : 0);
        }
        if (targetSatId && map.getLayer(targetSatId)) {
          map.setLayoutProperty(targetSatId, 'visibility', showSat ? 'visible' : 'none');
          map.setPaintProperty(targetSatId, 'raster-opacity', showSat ? getSatOpacityExp(0.85) : 0);
        }

        hdAgencies.forEach(agency => {
          let isHdVisible = false;
          if (agency === 'goes') isHdVisible = overlaysRef.current.hdGoes;
          if (agency === 'meteosat') isHdVisible = overlaysRef.current.hdMeteosat;
          if (agency === 'himawari') isHdVisible = overlaysRef.current.hdHimawari;

          if (!isHdVisible) {
            lastTargetIdsRef.current.hd[agency] = null;
            return;
          }

          const newHdId = sFrame?.time !== null && sFrame?.time !== undefined ? `hd-${agency}-layer-${sFrame.time}` : null;
          const prevHdId = lastTargetIdsRef.current.hd[agency];
          if (prevHdId && prevHdId !== newHdId && map.getLayer(prevHdId)) {
            map.setPaintProperty(prevHdId, 'raster-opacity', getSatOpacityExp(0.000001));
          }
          if (newHdId && map.getLayer(newHdId)) {
            map.setLayoutProperty(newHdId, 'visibility', 'visible');
            map.setPaintProperty(newHdId, 'raster-opacity', getSatOpacityExp(1.0));
          }
          lastTargetIdsRef.current.hd[agency] = newHdId;
        });
      } else {
        Object.values(loadedSatIdsRef.current).forEach((id) => {
          if (!id) return;
          const isTarget = id === targetSatId;
          const timeStr = id.replace('sat-layer-', '');
          const timestamp = Number(timeStr);

          if (map.getLayer(id)) {
            const targetOpacity = isTarget ? 0.85 : 0.000001;
            map.setLayoutProperty(id, 'visibility', showSat ? 'visible' : 'none');
            map.setPaintProperty(id, 'raster-opacity', showSat ? getSatOpacityExp(targetOpacity) : 0);
          }

          hdAgencies.forEach(agency => {
            const hdLayerId = `hd-${agency}-layer-${timestamp}`;
            if (map.getLayer(hdLayerId)) {
              let isHdVisible = false;
              if (agency === 'goes') isHdVisible = overlaysRef.current.hdGoes;
              if (agency === 'meteosat') isHdVisible = overlaysRef.current.hdMeteosat;
              if (agency === 'himawari') isHdVisible = overlaysRef.current.hdHimawari;

              const hdTargetOpacity = isTarget ? 1.0 : 0.000001;
              map.setLayoutProperty(hdLayerId, 'visibility', isHdVisible ? 'visible' : 'none');
              map.setPaintProperty(hdLayerId, 'raster-opacity', isHdVisible ? getSatOpacityExp(hdTargetOpacity) : 0);
            }
          });
        });

        hdAgencies.forEach(agency => {
          let isHdVisible = false;
          if (agency === 'goes') isHdVisible = overlaysRef.current.hdGoes;
          if (agency === 'meteosat') isHdVisible = overlaysRef.current.hdMeteosat;
          if (agency === 'himawari') isHdVisible = overlaysRef.current.hdHimawari;
          lastTargetIdsRef.current.hd[agency] = (isHdVisible && sFrame?.time !== null && sFrame?.time !== undefined)
            ? `hd-${agency}-layer-${sFrame.time}`
            : null;
        });
      }
      lastTargetIdsRef.current.sat = targetSatId ?? null;
    }
  }, [ensureFrameLoaded, formatTime, mapRef, overlaysRef, syncAtmosphere, syncLighting, currentFrameTimestampRef, timeDisplayRef, pruneHdAgency]);

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
      setTimeout(() => {
        if (isMountedRef.current) ensureFrameLoaded(0);
      }, 100);
    }

    if (map.isStyleLoaded()) {
      applyFrameVisibility(currentFrameIndexRef.current);
    } else {
      map.once('idle', () => {
        if (isMountedRef.current) applyFrameVisibility(currentFrameIndexRef.current);
      });
    }
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
        if (!isMountedRef.current) return;
        const totalFrames = radarFramesRef.current.length;
        if (totalFrames === 0) return;
        const nextIndex = (currentFrameIndexRef.current + 1) % totalFrames;
        currentFrameIndexRef.current = nextIndex;
        applyFrameVisibility(nextIndex, true);
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