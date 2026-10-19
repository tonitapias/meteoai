import { useState, useRef, useCallback, useEffect, RefObject, MutableRefObject } from 'react';
import type { Map } from 'mapbox-gl';
import { z } from 'zod';
import {
  RainViewerResponseSchema,
  RadarFrame,
  Overlays,
  getRadOpacityExp,
  getSatOpacityExp,
  Z_LAYERS,
  HD_BOUNDS,
  HD_VARIANTS,
  SAT_PROXY_HOST,
  computeMeteosatSlot,
  computeGibsSlot,
  type HdAgency,
  type HdVariant
} from '../../utils/radarPhysics';
import type { HdTimelineState } from './useHdTimeline';

interface UseRadarAnimationProps {
  mapRef: MutableRefObject<Map | null>;
  overlaysRef: MutableRefObject<Overlays>;
  currentFrameTimestampRef: MutableRefObject<number | null>;
  timeDisplayRef: RefObject<HTMLSpanElement | null>;
  formatTime: (ts?: number | null) => string;
  syncLighting: (timestampMs: number | null) => void;
  syncAtmosphere: () => void;
  styleReadyRef: MutableRefObject<boolean>;
  hdTimelineRef: MutableRefObject<HdTimelineState>;
}

const HD_AGENCIES: HdAgency[] = ['goes', 'meteosat', 'himawari'];

const isHdEnabled = (o: Overlays, agency: HdAgency): boolean =>
  agency === 'goes' ? o.hdGoes : agency === 'meteosat' ? o.hdMeteosat : o.hdHimawari;

// Capa HD d'un fotograma: la clau porta la variant perquè una franja MSG de
// :00/:30 no xoqui amb la mateixa hora de MTG.
interface HdTarget { key: string; variant: HdVariant; slot: number }
const hdLayerId = (agency: HdAgency, key: string) => `hd-${agency}-layer-${key}`;
const hdSourceId = (agency: HdAgency, key: string) => `hd-${agency}-src-${key}`;

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

// PERF/VRAM: el radar abans només tenia LibreWXR (~12-13 frames com a màxim,
// mida fixa de l'API). Ara cada frame pot tenir DUES fonts vives (LibreWXR +
// RainViewer com a capa prioritària), i la unió de línies temporals dels dos
// proveïdors pot ser més llarga que la de qualsevol dels dos sols. Sense
// límit, un cicle complet de reproducció acaba mantenint totes les fonts
// vives alhora (mateix problema que a l'HD, més amunt). Apliquem el mateix
// patró FIFO, un per pista, per no doblar la pressió de VRAM.
const MAX_LIVE_RADAR_FRAMES = 6;

// Cerca el frame amb el timestamp més proper a `targetTime`. S'usa perquè la
// línia temporal "mestra" (unió de LibreWXR + RainViewer) pot tenir instants
// on només un dels dos proveïdors té frame exacte — mai deixem la capa de
// LibreWXR (cobertura global) sense base, o es veuria un buit transparent
// real allà on RainViewer no té cobertura de radar terrestre.
const findClosestFrame = (frames: RadarFrame[], targetTime: number): RadarFrame | undefined => {
  let closest: RadarFrame | undefined;
  let minDiff = Infinity;
  frames.forEach((f) => {
    if (!f || f.time === null) return;
    const diff = Math.abs(f.time - targetTime);
    if (diff < minDiff) { minDiff = diff; closest = f; }
  });
  return closest;
};

export function useRadarAnimation({
  mapRef,
  overlaysRef,
  currentFrameTimestampRef,
  timeDisplayRef,
  formatTime,
  syncLighting,
  syncAtmosphere,
  styleReadyRef,
  hdTimelineRef
}: UseRadarAnimationProps) {

  const [isPlaying, setIsPlaying] = useState(false);
  const [framesCount, setFramesCount] = useState(0);
  const [currentFrameTimestamp, setCurrentFrameTimestamp] = useState<number | null>(null);

  const isPlayingRef = useRef<boolean>(false);
  const hostRef = useRef<string>('');
  // Línia temporal "mestra" del reproductor: unió ordenada dels timestamps
  // que té CADASCUN dels dos proveïdors (no només LibreWXR). Així el frame
  // "ara" reflecteix el més recent disponible entre tots dos. Els detalls
  // de cada frame (host+path) es busquen per timestamp a
  // lwFramesByTimeRef/rvFramesByTimeRef, amb fallback al frame de LibreWXR
  // més proper quan no hi ha coincidència exacta (vegeu findClosestFrame).
  const radarFramesRef = useRef<number[]>([]);
  const satFramesRef = useRef<RadarFrame[]>([]);
  const currentFrameIndexRef = useRef<number>(0);

  // Capa de LibreWXR (cobertura global) i capa "prioritària" de RainViewer
  // (cobertura real de radar, allà on n'hi ha). La de RainViewer es
  // renderitza PER SOBRE: com que els seus PNG són transparents fora de
  // cobertura, es veu LibreWXR per sota sense lògica addicional.
  const lwFramesRef = useRef<RadarFrame[]>([]);
  const lwFramesByTimeRef = useRef<Record<number, RadarFrame>>({});
  const rvHostRef = useRef<string>('');
  const rvFramesByTimeRef = useRef<Record<number, RadarFrame>>({});

  const loadedRadarIdsRef = useRef<Record<number, string>>({});
  const loadedRvRadarIdsRef = useRef<Record<number, string>>({});
  const loadedSatIdsRef = useRef<Record<number, string>>({});
  const animationTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Ordre d'inserció dels timestamps de radar carregats, un per pista (FIFO
  // per al límit MAX_LIVE_RADAR_FRAMES, vegeu ensureFrameLoaded).
  const radarLoadOrderRef = useRef<number[]>([]);
  const rvRadarLoadOrderRef = useRef<number[]>([]);

  // Ordre d'inserció de les capes HD vives per agència (claus de HdTarget):
  // FIFO per al límit MAX_LIVE_HD_FRAMES_PER_AGENCY i registre de les capes
  // que existeixen (vegeu ensureFrameLoaded).
  const hdLoadOrderRef = useRef<Record<HdAgency, string[]>>({
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
      loadedRvRadarIdsRef.current = {};
      loadedSatIdsRef.current = {};
      radarLoadOrderRef.current = [];
      rvRadarLoadOrderRef.current = [];
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

  // PERF (fluïdesa): durant la reproducció (cada 600ms) només UNA capa de
  // radar i UNA de satèl·lit/HD deixen de ser el frame actiu i UNA altra ho
  // passa a ser. Abans, cada tick recorria TOTES les capes acumulades
  // (poden arribar a la trentena amb HD actiu) fent 2 mutacions d'estil GL
  // per capa encara que gairebé cap hagués canviat. Aquest ref recorda quin
  // era l'"objectiu" anterior perquè, en mode animació, només toquem els 2
  // que realment canvien. Els canvis provocats per un toggle d'overlay (que
  // sí afecten TOTES les capes d'un tipus, p.ex. mostrar/amagar precip)
  // continuen fent el recorregut complet — vegeu el paràmetre `animationTick`.
  const lastTargetIdsRef = useRef<{ radar: string | null; rvRadar: string | null; sat: string | null; hd: Record<HdAgency, string | null> }>({
    radar: null,
    rvRadar: null,
    sat: null,
    hd: { goes: null, meteosat: null, himawari: null }
  });

  // Allibera totes les capes/fonts HD d'una agència. Es crida quan l'usuari
  // desactiva l'overlay HD corresponent.
  const pruneHdAgency = useCallback((agency: HdAgency) => {
    const map = mapRef.current;
    if (!map) return;
    hdLoadOrderRef.current[agency].forEach((key) => {
      safeRemoveLayerAndSource(map, hdLayerId(agency, key), hdSourceId(agency, key));
    });
    hdLoadOrderRef.current[agency] = [];
    lastTargetIdsRef.current.hd[agency] = null;
  }, [mapRef, safeRemoveLayerAndSource]);

  // Capa HD que correspon a un fotograma de radar. Meteosat té hores pròpies
  // (cada 10 min amb MTG) alineades amb /hd/meteosat/latest; mentre no se sap
  // la capa (MTG o MSG) no se'n crea cap. GOES/Himawari segueixen el frame de
  // satèl·lit de LibreWXR més proper.
  const hdTargetFor = useCallback((agency: HdAgency, frameTime: number | null | undefined): HdTarget | null => {
    if (frameTime === null || frameTime === undefined) return null;
    if (agency === 'meteosat') {
      const state = hdTimelineRef.current;
      if (state.status === 'idle' || state.status === 'pending') return null;
      const { variant, slot } = computeMeteosatSlot(frameTime, state.timeline, state.nowSec);
      return { key: `${variant}-${slot}`, variant, slot };
    }
    const slot = computeGibsSlot(frameTime, satFramesRef.current);
    return { key: `gibs-${slot}`, variant: 'gibs', slot };
  }, [hdTimelineRef]);

  // Treu les capes HD que ja no necessita cap fotograma de la línia temporal
  // actual (dades de radar noves, o una altra franja/variant de Meteosat).
  const pruneUnneededHd = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    HD_AGENCIES.forEach((agency) => {
      const needed = new Set(radarFramesRef.current.map((t) => hdTargetFor(agency, t)?.key));
      hdLoadOrderRef.current[agency] = hdLoadOrderRef.current[agency].filter((key) => {
        if (needed.has(key)) return true;
        safeRemoveLayerAndSource(map, hdLayerId(agency, key), hdSourceId(agency, key));
        if (lastTargetIdsRef.current.hd[agency] === hdLayerId(agency, key)) lastTargetIdsRef.current.hd[agency] = null;
        return false;
      });
    });
  }, [mapRef, hdTargetFor, safeRemoveLayerAndSource]);

  // Només destrueix frames quan la pròpia API ens diu que ja han caducat en el temps
  const cleanupExpiredLayers = useCallback((validLwFrames: RadarFrame[], validRvFrames: RadarFrame[], validSatFrames: RadarFrame[]) => {
    const map = mapRef.current;
    if (!map || !styleReadyRef.current) return;

    const activeLwTimes = new Set(validLwFrames.map(f => f.time));
    const activeRvTimes = new Set(validRvFrames.map(f => f.time));
    const activeSatTimes = new Set(validSatFrames.map(f => f.time));

    Object.keys(loadedRadarIdsRef.current).forEach((key) => {
      const timestampKey = Number(key);
      if (!activeLwTimes.has(timestampKey)) {
        const layerId = loadedRadarIdsRef.current[timestampKey];
        const radSourceId = `rad-src-${timestampKey}`;
        safeRemoveLayerAndSource(map, layerId, radSourceId);
        delete loadedRadarIdsRef.current[timestampKey];
        radarLoadOrderRef.current = radarLoadOrderRef.current.filter(t => t !== timestampKey);
      }
    });

    Object.keys(loadedRvRadarIdsRef.current).forEach((key) => {
      const timestampKey = Number(key);
      if (!activeRvTimes.has(timestampKey)) {
        const layerId = loadedRvRadarIdsRef.current[timestampKey];
        const radRvSourceId = `rad-rv-src-${timestampKey}`;
        safeRemoveLayerAndSource(map, layerId, radRvSourceId);
        delete loadedRvRadarIdsRef.current[timestampKey];
        rvRadarLoadOrderRef.current = rvRadarLoadOrderRef.current.filter(t => t !== timestampKey);
      }
    });

    Object.keys(loadedSatIdsRef.current).forEach((key) => {
      const timestampKey = Number(key);
      if (!activeSatTimes.has(timestampKey)) {
        const layerId = loadedSatIdsRef.current[timestampKey];
        const satSourceId = `sat-src-${timestampKey}`;
        safeRemoveLayerAndSource(map, layerId, satSourceId);
        delete loadedSatIdsRef.current[timestampKey];
      }
    });
  }, [mapRef, safeRemoveLayerAndSource, styleReadyRef]);

  const ensureFrameLoaded = useCallback((index: number) => {
    const map = mapRef.current;
    if (!map || !styleReadyRef.current) return;

    const rFrames = radarFramesRef.current;
    const sFrames = satFramesRef.current;

    if (!rFrames || rFrames.length === 0 || index < 0 || index >= rFrames.length) return;
    const frameTime = rFrames[index];
    if (frameTime === null || frameTime === undefined) return;

    const isTarget = index === currentFrameIndexRef.current;

    // HACK VRAM: 0.000001 força la pre-càrrega a GPU sense ser visible. Evita parpellejos.
    const initialRadOpacity = (isTarget && overlaysRef.current.precip) ? 0.88 : 0.000001;

    // Capa de LibreWXR (cobertura global): mai l'ometem, ni que aquest
    // instant de la línia temporal mestra només tingui frame exacte a
    // RainViewer — agafem el frame de LibreWXR més proper en el temps
    // perquè sempre hi hagi una base de color sota RainViewer (mai un buit
    // transparent real).
    const lwFrame = hostRef.current
      ? (lwFramesByTimeRef.current[frameTime] ?? findClosestFrame(lwFramesRef.current, frameTime))
      : undefined;

    if (lwFrame && lwFrame.time !== null) {
      const radSourceId = `rad-src-${lwFrame.time}`;
      const radLayerId = `rad-layer-${lwFrame.time}`;

      if (!loadedRadarIdsRef.current[lwFrame.time] && !map.getSource(radSourceId)) {
        try {
          map.addSource(radSourceId, {
            type: 'raster',
            tiles: [`${hostRef.current}${lwFrame.path}/512/{z}/{x}/{y}/6/1_1.png`],
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
          loadedRadarIdsRef.current[lwFrame.time] = radLayerId;

          // PERF/VRAM: mateix FIFO que a les agències HD — expulsa el frame
          // més antic d'aquesta pista si superem el límit (mai el que
          // acabem d'afegir).
          const order = radarLoadOrderRef.current;
          order.push(lwFrame.time);
          while (order.length > MAX_LIVE_RADAR_FRAMES) {
            const oldestTs = order[0];
            if (oldestTs === lwFrame.time) break;
            order.shift();
            safeRemoveLayerAndSource(map, `rad-layer-${oldestTs}`, `rad-src-${oldestTs}`);
            delete loadedRadarIdsRef.current[oldestTs];
          }
        } catch (e) {
          console.warn(`[Zero Risk] Error afegint radar ${radLayerId}:`, e);
        }
      }
    }

    // Capa prioritària de RainViewer per a aquest mateix instant (si en té
    // dades): es renderitza PER SOBRE de LibreWXR — com que els seus PNG
    // són transparents fora de cobertura real, es veu LibreWXR per sota
    // sense cap lògica addicional.
    const rvFrame = rvFramesByTimeRef.current[frameTime];
    if (rvFrame && rvFrame.time !== null && rvHostRef.current && !loadedRvRadarIdsRef.current[frameTime]) {
      const radRvSourceId = `rad-rv-src-${frameTime}`;
      const radRvLayerId = `rad-rv-layer-${frameTime}`;

      if (!map.getSource(radRvSourceId)) {
        try {
          map.addSource(radRvSourceId, {
            type: 'raster',
            tiles: [`${rvHostRef.current}${rvFrame.path}/512/{z}/{x}/{y}/6/1_1.png`],
            tileSize: 512,
            // El servidor de RainViewer no suporta zoom 8: hi retorna una
            // imatge d'error "Zoom Level Not Supported" en lloc d'una
            // tessel·la transparent, que taparia tot el mapa perquè aquesta
            // capa va per sobre. maxzoom:7 fa que Mapbox ampliï el tile de
            // z=7 en lloc de demanar-ne un que no existeix.
            maxzoom: 7,
          });
          map.addLayer({
            id: radRvLayerId,
            type: 'raster',
            source: radRvSourceId,
            layout: { visibility: overlaysRef.current.precip ? 'visible' : 'none' },
            paint: {
              'raster-opacity': getRadOpacityExp(initialRadOpacity),
              'raster-opacity-transition': { duration: 0, delay: 0 },
              'raster-fade-duration': 0,
              'raster-resampling': 'linear'
            },
          }, Z_LAYERS.PIS_6_UI);
          loadedRvRadarIdsRef.current[frameTime] = radRvLayerId;

          const rvOrder = rvRadarLoadOrderRef.current;
          rvOrder.push(frameTime);
          while (rvOrder.length > MAX_LIVE_RADAR_FRAMES) {
            const oldestTs = rvOrder[0];
            if (oldestTs === frameTime) break;
            rvOrder.shift();
            safeRemoveLayerAndSource(map, `rad-rv-layer-${oldestTs}`, `rad-rv-src-${oldestTs}`);
            delete loadedRvRadarIdsRef.current[oldestTs];
          }
        } catch (e) {
          console.warn(`[Zero Risk] Error afegint radar RainViewer ${radRvLayerId}:`, e);
        }
      }
    }

    if (sFrames && sFrames.length > 0) {
      let closestSatIdx = 0;
      let minDiff = Infinity;
      sFrames.forEach((sFrame, sIdx) => {
        if (!sFrame || sFrame.time === null) return;
        const diff = Math.abs(sFrame.time - frameTime);
        if (diff < minDiff) { minDiff = diff; closestSatIdx = sIdx; }
      });

      const sFrame = sFrames[closestSatIdx];
      if (sFrame && sFrame.time !== null) {
        const timestamp = sFrame.time;
        const satSourceId = `sat-src-${timestamp}`;
        const satLayerId = `sat-layer-${timestamp}`;

        if (!loadedSatIdsRef.current[timestamp] && !map.getSource(satSourceId)) {
          const rvHostEnc = encodeURIComponent(hostRef.current);
          const rvPathEnc = encodeURIComponent(sFrame.path);

          try {
            map.addSource(satSourceId, {
              type: 'raster',
              tiles: [`${SAT_PROXY_HOST}/sat/{z}/{x}/{y}.png?host=${rvHostEnc}&path=${rvPathEnc}`],
              tileSize: 512,
              maxzoom: 6
            });

            // Mateixa regla que `showSat` a applyFrameVisibility: amb un
            // satèl·lit HD actiu, l'IR global també es dibuixa (fora de la
            // zona HD). Si la capa nasqués amagada, el camí lleuger de
            // l'animació no la mostraria fins al tick en què és l'objectiu,
            // sense haver precarregat les tessel·les.
            const o = overlaysRef.current;
            const showSat = o.satIR || o.hdGoes || o.hdMeteosat || o.hdHimawari;
            const targetSatOpacity = (isTarget && showSat) ? 0.85 : 0.000001;

            map.addLayer({
              id: satLayerId,
              type: 'raster',
              source: satSourceId,
              layout: { visibility: showSat ? 'visible' : 'none' },
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
      }
    }

    // Capes HD: independents de la llista de satèl·lit de LibreWXR (Meteosat
    // té hores pròpies; si LibreWXR cau, la capa HD continua).
    HD_AGENCIES.forEach((agency) => {
      if (!isHdEnabled(overlaysRef.current, agency)) return;
      const target = hdTargetFor(agency, frameTime);
      if (!target) return;
      const sourceId = hdSourceId(agency, target.key);
      const layerId = hdLayerId(agency, target.key);
      if (map.getSource(sourceId)) return;

      // Diversos fotogrames poden compartir franja: és visible si és la del
      // fotograma actual, encara que s'estigui precarregant per a un altre.
      const currentKey = hdTargetFor(agency, rFrames[currentFrameIndexRef.current])?.key;
      const cfg = HD_VARIANTS[target.variant];
      const route = target.variant === 'gibs' ? `${cfg.route}/${agency}` : cfg.route;

      try {
        map.addSource(sourceId, {
          type: 'raster',
          tiles: [`${SAT_PROXY_HOST}/${route}/${target.slot}/{z}/{x}/{y}.png`],
          tileSize: 512,
          bounds: cfg.bounds ?? HD_BOUNDS[agency],
          minzoom: 2,
          maxzoom: 8
        });

        map.addLayer({
          id: layerId,
          type: 'raster',
          source: sourceId,
          layout: { visibility: 'visible' },
          paint: {
            'raster-opacity': getSatOpacityExp(target.key === currentKey ? 1.0 : 0.000001),
            'raster-opacity-transition': { duration: 0, delay: 0 },
            'raster-saturation': cfg.saturation,
            'raster-contrast': cfg.contrast,
            'raster-brightness-min': cfg.brightnessMin,
            'raster-fade-duration': 0
          },
        }, Z_LAYERS.PIS_4_FILTER);

        // PERF: finestra FIFO — expulsa la capa HD més antiga d'aquesta
        // agència si ja n'hi ha MAX_LIVE_HD_FRAMES_PER_AGENCY vives, mai la
        // que s'acaba d'afegir ni la del fotograma actual.
        const order = hdLoadOrderRef.current[agency];
        order.push(target.key);
        while (order.length > MAX_LIVE_HD_FRAMES_PER_AGENCY) {
          const victimIdx = order.findIndex((k) => k !== target.key && k !== currentKey);
          if (victimIdx < 0) break;
          const [victim] = order.splice(victimIdx, 1);
          safeRemoveLayerAndSource(map, hdLayerId(agency, victim), hdSourceId(agency, victim));
        }
      } catch (e) {
        console.warn(`[Zero Risk] Error afegint HD satèl·lit ${layerId}:`, e);
      }
    });
  }, [mapRef, overlaysRef, safeRemoveLayerAndSource, styleReadyRef, hdTargetFor]);

  // CORRECCIÓ: quan el dispositiu perd el context WebGL, useMapLifecycle
  // destrueix el mapa i en crea un de nou, però aquest hook no es remunta:
  // els registres de capes "ja carregades" seguien plens amb les del mapa
  // destruït i ensureFrameLoaded no tornava a afegir el radar ni l'IR global
  // (només l'HD, que comprova map.getSource). Es buiden en crear un mapa nou;
  // les línies temporals (frames) continuen sent vàlides.
  const resetLayerBookkeeping = useCallback(() => {
    loadedRadarIdsRef.current = {};
    loadedRvRadarIdsRef.current = {};
    loadedSatIdsRef.current = {};
    radarLoadOrderRef.current = [];
    rvRadarLoadOrderRef.current = [];
    hdLoadOrderRef.current = { goes: [], meteosat: [], himawari: [] };
    prevHdEnabledRef.current = { goes: false, meteosat: false, himawari: false };
    lastTargetIdsRef.current = { radar: null, rvRadar: null, sat: null, hd: { goes: null, meteosat: null, himawari: null } };
  }, []);

  const applyFrameVisibility = useCallback((index: number, animationTick: boolean = false) => {
    const map = mapRef.current;
    if (!map || !styleReadyRef.current) return;

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
    HD_AGENCIES.forEach((agency) => {
      const isEnabledNow = isHdEnabled(overlaysRef.current, agency);
      const wasEnabled = prevHdEnabledRef.current[agency];

      if (wasEnabled && !isEnabledNow) {
        pruneHdAgency(agency);
      }
      prevHdEnabledRef.current[agency] = isEnabledNow;
    });

    const currentFrameTime = radarFramesRef.current[safeIndex];
    const lwTargetFrame = currentFrameTime !== null && currentFrameTime !== undefined
      ? (lwFramesByTimeRef.current[currentFrameTime] ?? findClosestFrame(lwFramesRef.current, currentFrameTime))
      : undefined;
    const targetRadarId = lwTargetFrame?.time ? loadedRadarIdsRef.current[lwTargetFrame.time] : undefined;
    const targetRvRadarId = currentFrameTime !== null && currentFrameTime !== undefined
      ? loadedRvRadarIdsRef.current[currentFrameTime]
      : undefined;

    if (currentFrameTime !== null && currentFrameTime !== undefined) {
      if (timeDisplayRef.current) {
         timeDisplayRef.current.textContent = formatTime(currentFrameTime);
      }
      setCurrentFrameTimestamp(currentFrameTime);
      currentFrameTimestampRef.current = currentFrameTime;

      if (!isPlayingRef.current) {
        syncLighting(currentFrameTime * 1000);
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

      const prevRvRadarId = lastTargetIdsRef.current.rvRadar;
      if (prevRvRadarId && prevRvRadarId !== targetRvRadarId && map.getLayer(prevRvRadarId)) {
        map.setPaintProperty(prevRvRadarId, 'raster-opacity', showPrecip ? getRadOpacityExp(0.000001) : 0);
      }
      if (targetRvRadarId && map.getLayer(targetRvRadarId)) {
        map.setLayoutProperty(targetRvRadarId, 'visibility', showPrecip ? 'visible' : 'none');
        map.setPaintProperty(targetRvRadarId, 'raster-opacity', showPrecip ? getRadOpacityExp(0.88) : 0);
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
      Object.values(loadedRvRadarIdsRef.current).forEach((id) => {
        if (id && map.getLayer(id)) {
          const isTarget = id === targetRvRadarId;
          const targetOpacity = isTarget ? 0.88 : 0.000001;

          map.setLayoutProperty(id, 'visibility', showPrecip ? 'visible' : 'none');
          map.setPaintProperty(id, 'raster-opacity', showPrecip ? getRadOpacityExp(targetOpacity) : 0);
        }
      });
    }
    lastTargetIdsRef.current.radar = targetRadarId ?? null;
    lastTargetIdsRef.current.rvRadar = targetRvRadarId ?? null;

    if (satFramesRef.current.length > 0 && currentFrameTime !== null && currentFrameTime !== undefined) {
      let closestSatIdx = 0;
      let minDiff = Infinity;
      satFramesRef.current.forEach((sFrame, sIdx) => {
        if (!sFrame || sFrame.time === null) return;
        const diff = Math.abs(sFrame.time - currentFrameTime);
        if (diff < minDiff) { minDiff = diff; closestSatIdx = sIdx; }
      });

      const sFrame = satFramesRef.current[closestSatIdx];
      const targetSatId = sFrame?.time ? loadedSatIdsRef.current[sFrame.time] : undefined;

      if (animationTick) {
        const prevSatId = lastTargetIdsRef.current.sat;
        if (prevSatId && prevSatId !== targetSatId && map.getLayer(prevSatId)) {
          map.setPaintProperty(prevSatId, 'raster-opacity', showSat ? getSatOpacityExp(0.000001) : 0);
        }
        if (targetSatId && map.getLayer(targetSatId)) {
          map.setLayoutProperty(targetSatId, 'visibility', showSat ? 'visible' : 'none');
          map.setPaintProperty(targetSatId, 'raster-opacity', showSat ? getSatOpacityExp(0.85) : 0);
        }
      } else {
        Object.values(loadedSatIdsRef.current).forEach((id) => {
          if (!id || !map.getLayer(id)) return;
          const targetOpacity = id === targetSatId ? 0.85 : 0.000001;
          map.setLayoutProperty(id, 'visibility', showSat ? 'visible' : 'none');
          map.setPaintProperty(id, 'raster-opacity', showSat ? getSatOpacityExp(targetOpacity) : 0);
        });
      }
      lastTargetIdsRef.current.sat = targetSatId ?? null;
    }

    // HD: la capa de la franja del fotograma actual a opacitat plena, les
    // altres precarregades (0.000001).
    HD_AGENCIES.forEach((agency) => {
      const enabled = isHdEnabled(overlaysRef.current, agency);
      const target = enabled ? hdTargetFor(agency, currentFrameTime) : null;
      const newHdId = target ? hdLayerId(agency, target.key) : null;

      if (animationTick) {
        const prevHdId = lastTargetIdsRef.current.hd[agency];
        if (prevHdId && prevHdId !== newHdId && map.getLayer(prevHdId)) {
          map.setPaintProperty(prevHdId, 'raster-opacity', getSatOpacityExp(0.000001));
        }
        if (newHdId && map.getLayer(newHdId)) {
          map.setLayoutProperty(newHdId, 'visibility', 'visible');
          map.setPaintProperty(newHdId, 'raster-opacity', getSatOpacityExp(1.0));
        }
      } else {
        hdLoadOrderRef.current[agency].forEach((key) => {
          const id = hdLayerId(agency, key);
          if (!map.getLayer(id)) return;
          map.setLayoutProperty(id, 'visibility', enabled ? 'visible' : 'none');
          map.setPaintProperty(id, 'raster-opacity', enabled ? getSatOpacityExp(id === newHdId ? 1.0 : 0.000001) : 0);
        });
      }
      lastTargetIdsRef.current.hd[agency] = newHdId;
    });
  }, [ensureFrameLoaded, formatTime, mapRef, overlaysRef, syncAtmosphere, syncLighting, currentFrameTimestampRef, timeDisplayRef, pruneHdAgency, styleReadyRef, hdTargetFor]);

  // /hd/meteosat/latest ha canviat (primera resposta, franja nova o una altra
  // capa): fora les capes que ja no toquen i es creen les que falten.
  const refreshHdTimeline = useCallback(() => {
    pruneUnneededHd();
    applyFrameVisibility(currentFrameIndexRef.current);
  }, [pruneUnneededHd, applyFrameVisibility]);

  const injectLayersIntoMap = useCallback((
    parsedData: z.infer<typeof RainViewerResponseSchema>,
    rvParsedData?: z.infer<typeof RainViewerResponseSchema> | null
  ) => {
    const map = mapRef.current;
    if (!map) return;

    const { host, radar, satellite } = parsedData;
    hostRef.current = host;

    const lwFrames = (radar?.past || []).filter(f => f && f.time !== null);
    lwFramesRef.current = lwFrames;
    lwFramesByTimeRef.current = {};
    lwFrames.forEach((f) => { lwFramesByTimeRef.current[f.time!] = f; });

    rvHostRef.current = rvParsedData?.host || '';
    const rvFrames = (rvParsedData?.radar?.past || []).filter(f => f && f.time !== null);
    rvFramesByTimeRef.current = {};
    rvFrames.forEach((f) => { rvFramesByTimeRef.current[f.time!] = f; });

    const sFrames = (satellite?.infrared || []).filter(f => f && f.time !== null);

    // Unió ordenada dels timestamps dels dos proveïdors: el frame "ara" i el
    // rang del reproductor reflecteixen el més recent disponible entre tots
    // dos, no només LibreWXR (que sol anar més endarrerit).
    const timeSet = new Set<number>();
    lwFrames.forEach(f => timeSet.add(f.time!));
    rvFrames.forEach(f => timeSet.add(f.time!));
    const unionTimes = Array.from(timeSet).sort((a, b) => a - b);

    radarFramesRef.current = unionTimes;
    satFramesRef.current = sFrames;
    setFramesCount(unionTimes.length);

    cleanupExpiredLayers(lwFrames, rvFrames, sFrames);
    pruneUnneededHd();

    if (unionTimes.length === 0) return;

    const initialIdx = Math.max(0, unionTimes.length - 1);
    currentFrameIndexRef.current = initialIdx;

    ensureFrameLoaded(initialIdx);
    if (unionTimes.length > 1) {
      setTimeout(() => {
        if (isMountedRef.current) ensureFrameLoaded(0);
      }, 100);
    }

    if (styleReadyRef.current) {
      applyFrameVisibility(currentFrameIndexRef.current);
    } else {
      // CORRECCIÓ: `once('load', ...)` en lloc de `once('idle', ...)` —
      // vegeu styleReadyRef a useMapLifecycle.ts.
      map.once('load', () => {
        if (isMountedRef.current) applyFrameVisibility(currentFrameIndexRef.current);
      });
    }
  }, [ensureFrameLoaded, applyFrameVisibility, cleanupExpiredLayers, pruneUnneededHd, mapRef, styleReadyRef]);

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

  // Pausa des de fora (p. ex. en passar a la pestanya de vent). Ha d'actualitzar
  // també isPlayingRef: togglePlay decideix a partir de la ref, i si quedava a
  // true el primer clic a Play en tornar al radar tornava a "pausar".
  const pausePlayback = useCallback(() => {
    if (!isPlayingRef.current) return;
    isPlayingRef.current = false;
    setIsPlaying(false);
    applyFrameVisibility(currentFrameIndexRef.current);
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
    pausePlayback,
    isPlayingRef,
    framesCount,
    currentFrameTimestamp,
    injectLayersIntoMap,
    togglePlay,
    setAnimationActive,
    applyFrameVisibility,
    refreshHdTimeline,
    resetLayerBookkeeping,
    radarFramesRef,
    currentFrameIndexRef
  };
}