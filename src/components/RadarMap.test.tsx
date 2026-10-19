// src/components/RadarMap.test.tsx
// RadarMap sencer (hooks reals) amb un mapbox-gl fals: comprova el cicle de
// vida de les capes sense WebGL — pèrdua de context, cost per tick de
// l'animació i vol de càmera en activar un satèl·lit HD.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import RadarMap from './RadarMap';

interface FakeLayer { id: string; paint: Record<string, unknown>; layout: Record<string, unknown> }
interface FakeMapInstance {
  layers: FakeLayer[];
  sources: Map<string, unknown>;
  counters: { setTerrain: number; setFog: number };
  lastTerrain: unknown;
  flights: Record<string, unknown>[];
  zoom: number;
  errors: string[];
  // Sufixos d'id de font (p. ex. una franja HD) que encara no han carregat.
  loading: Set<string>;
  emit: (ev: string, e?: unknown) => void;
}

vi.mock('mapbox-gl', () => {
  type Handler = (e?: unknown) => void;
  class FakeMap {
    layers: FakeLayer[] = [];
    sources = new Map<string, unknown>();
    handlers: Record<string, Handler[]> = {};
    onceHandlers: Record<string, Handler[]> = {};
    counters = { setTerrain: 0, setFog: 0 };
    lastTerrain: unknown = undefined;
    flights: Record<string, unknown>[] = [];
    zoom = 7;
    errors: string[] = [];
    loading = new Set<string>();
    constructor() {
      const g = globalThis as unknown as { __radarTestMaps: FakeMap[] };
      (g.__radarTestMaps ||= []).push(this);
    }
    on(ev: string, cb: Handler) { (this.handlers[ev] ||= []).push(cb); return this; }
    off(ev: string, cb: Handler) { this.handlers[ev] = (this.handlers[ev] || []).filter((h) => h !== cb); return this; }
    once(ev: string, cb: Handler) { (this.onceHandlers[ev] ||= []).push(cb); return this; }
    emit(ev: string, e?: unknown) {
      (this.handlers[ev] || []).forEach((h) => h(e));
      const once = this.onceHandlers[ev] || [];
      this.onceHandlers[ev] = [];
      once.forEach((h) => h(e));
    }
    addControl() { return this; }
    remove() {}
    addSource(id: string, spec: unknown) {
      if (this.sources.has(id)) throw new Error(`There is already a source with ID "${id}".`);
      this.sources.set(id, spec);
    }
    getSource(id: string) { return this.sources.get(id); }
    isSourceLoaded(id: string) { return this.sources.has(id) && ![...this.loading].some((s) => id.endsWith(s)); }
    removeSource(id: string) { this.sources.delete(id); }
    addLayer(layer: { id: string; paint?: Record<string, unknown>; layout?: Record<string, unknown> }, beforeId?: string) {
      if (this.getLayer(layer.id)) throw new Error(`Layer "${layer.id}" already exists`);
      const l = { id: layer.id, paint: { ...(layer.paint || {}) }, layout: { ...(layer.layout || {}) } };
      const idx = beforeId ? this.layers.findIndex((x) => x.id === beforeId) : -1;
      if (beforeId && idx < 0) { this.errors.push(`addLayer before missing ${beforeId}`); return; }
      if (idx >= 0) this.layers.splice(idx, 0, l); else this.layers.push(l);
    }
    getLayer(id: string) { return this.layers.find((l) => l.id === id); }
    removeLayer(id: string) { this.layers = this.layers.filter((l) => l.id !== id); }
    setPaintProperty(id: string, k: string, v: unknown) {
      const l = this.getLayer(id);
      if (!l) { this.errors.push(`setPaint missing ${id}`); return; }
      l.paint[k] = v;
    }
    setLayoutProperty(id: string, k: string, v: unknown) {
      const l = this.getLayer(id);
      if (!l) { this.errors.push(`setLayout missing ${id}`); return; }
      l.layout[k] = v;
    }
    getCenter() { return { lng: 2.17, lat: 41.4 }; } // Barcelona
    getZoom() { return this.zoom; }
    setFog() { this.counters.setFog++; }
    setLights() {}
    setTerrain(t: unknown) { this.counters.setTerrain++; this.lastTerrain = t; }
    flyTo(o: Record<string, unknown>) { this.flights.push(o); }
    triggerRepaint() {}
  }
  class Control { constructor(_o?: unknown) {} }
  const mapboxgl = { Map: FakeMap, NavigationControl: Control, GeolocateControl: Control, accessToken: '' };
  return { default: mapboxgl };
});

// Dades sintètiques amb la forma de weather-maps.json: radar cada 10 min i
// satèl·lit IR cada 20 min (LibreWXR); RainViewer sense satèl·lit.
const T0 = 1791144600;
const radarFrames = (n: number, prefix: string) =>
  Array.from({ length: n }, (_, i) => ({ time: T0 + i * 600, path: `/v2/radar/${prefix}${T0 + i * 600}` }));
const LIBREWXR = {
  host: 'https://api.librewxr.net',
  radar: { past: radarFrames(12, ''), nowcast: [] },
  satellite: { infrared: Array.from({ length: 6 }, (_, i) => T0 + i * 1200).map((t) => ({ time: t, path: `/v2/satellite/${t}` })) },
};
const RAINVIEWER = { host: 'https://tilecache.rainviewer.com', radar: { past: radarFrames(12, 'rv'), nowcast: [] }, satellite: { infrared: [] } };
// /hd/meteosat/latest del worker: per defecte MTG amb l'última imatge 3
// fotogrames abans del més nou. 'fail' = error de xarxa; una promesa = resposta
// que encara no ha arribat.
const MTG_LATEST = T0 + 8 * 600;
let hdLatest: unknown;
let libreWxr: typeof LIBREWXR;
// /lightning/latest: per defecte, l'última franja de llamps 5 min després del
// fotograma 9 (els dos més nous comparteixen aquesta).
const LIGHTNING_LATEST = T0 + 9 * 600 + 300;
let lightningLatest: unknown;

const maps = () => (globalThis as unknown as { __radarTestMaps: FakeMapInstance[] }).__radarTestMaps;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function opacityAtZoom3(layer: FakeLayer): number {
  const v = layer.paint['raster-opacity'];
  if (typeof v === 'number') return v;
  return Array.isArray(v) ? Number(v[4]) : 0; // primer valor de l'interpolate (z2)
}
const ids = (m: FakeMapInstance, prefix: string) => m.layers.filter((l) => l.id.startsWith(prefix));
const visibleTargets = (m: FakeMapInstance, prefix: string, min: number) =>
  ids(m, prefix).filter((l) => l.layout.visibility === 'visible' && opacityAtZoom3(l) > min).map((l) => l.id);

function renderRadar() {
  render(<RadarMap lat={41.4} lon={2.17} isActive={true} showLayerMenu={true} setShowLayerMenu={() => {}} />);
  return maps()[maps().length - 1];
}
async function mountRadar() {
  const map = renderRadar();
  await act(async () => { map.emit('load'); await sleep(30); });
  return map;
}
const click = async (text: string) => { await act(async () => { fireEvent.click(screen.getByText(text)); await sleep(20); }); };
const layer = (m: FakeMapInstance, id: string) => m.layers.find((l) => l.id === id);

beforeEach(() => {
  (globalThis as unknown as { __radarTestMaps: FakeMapInstance[] }).__radarTestMaps = [];
  hdLatest = { layer: 'mtg', latest: MTG_LATEST, cadence: 600, source: 'caps' };
  lightningLatest = { latest: LIGHTNING_LATEST, cadence: 300, source: 'caps' };
  libreWxr = LIBREWXR;
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    const u = String(url);
    if (u.includes('/hd/meteosat/latest')) {
      const body = await hdLatest;
      if (body === 'fail') throw new TypeError('Failed to fetch');
      return new Response(JSON.stringify(body), { status: 200 });
    }
    if (u.includes('/lightning/latest')) {
      return new Response(JSON.stringify(await lightningLatest), { status: 200 });
    }
    return new Response(JSON.stringify(u.includes('librewxr') ? libreWxr : RAINVIEWER), { status: 200 });
  }));
});

const hdSource = (m: FakeMapInstance, key: string) =>
  m.sources.get(`hd-meteosat-src-${key}`) as { tiles: string[]; bounds: number[] } | undefined;
const hdTargets = (m: FakeMapInstance) => visibleTargets(m, 'hd-meteosat-layer-', 0.3);
// Fotograma de radar que es veu (capa LibreWXR objectiu) → imatge HD que
// l'acompanya, la primera vegada que es veu cada fotograma.
const radarFrame = (m: FakeMapInstance) => {
  const id = visibleTargets(m, 'rad-layer-', 0.5)[0];
  return id ? Number(id.replace('rad-layer-', '')) : null;
};
async function observeFrames(m: FakeMapInstance, done: (seen: Map<number, string>) => boolean, timeoutMs = 20000) {
  const seen = new Map<number, string>();
  const start = Date.now();
  while (!done(seen) && Date.now() - start < timeoutMs) {
    await act(async () => { await sleep(20); });
    const frame = radarFrame(m);
    if (frame !== null && !seen.has(frame)) seen.set(frame, hdTargets(m).join('+'));
  }
  return seen;
}

describe('RadarMap', () => {
  it('l\'animació no fa una sincronització completa del mapa a cada tick', async () => {
    const map = await mountRadar();
    await act(async () => { fireEvent.click(screen.getByLabelText('btnPlay')); await sleep(20); });
    const terrain = map.counters.setTerrain, fog = map.counters.setFog;
    const targets: string[] = [];
    for (let i = 0; i < 3; i++) {
      await act(async () => { await sleep(650); });
      targets.push(visibleTargets(map, 'rad-layer-', 0.5).join('+'));
    }
    expect(map.counters.setTerrain - terrain).toBe(0);
    expect(map.counters.setFog - fog).toBe(0);
    // El camí lleuger continua movent l'objectiu: una sola capa LibreWXR visible per tick.
    expect(targets.every((t) => t !== '' && !t.includes('+'))).toBe(true);
    expect(new Set(targets).size).toBeGreaterThan(1);
    expect(map.errors).toEqual([]);
  }, 20000);

  it('després de perdre el context WebGL, el mapa nou recupera radar, IR global i HD', async () => {
    const map1 = await mountRadar();
    await act(async () => { fireEvent.click(screen.getByText('Meteosat HD (Europa)')); await sleep(20); });

    await act(async () => { map1.emit('webglcontextlost', { originalEvent: { preventDefault() {} } }); await sleep(20); });
    expect(maps()).toHaveLength(2);
    const map2 = maps()[1];
    await act(async () => { map2.emit('load'); await sleep(50); });

    expect(ids(map2, 'rad-layer-').length).toBeGreaterThan(0);
    expect(ids(map2, 'rad-rv-layer-').length).toBeGreaterThan(0);
    expect(ids(map2, 'sat-layer-').length).toBeGreaterThan(0);
    expect(visibleTargets(map2, 'rad-layer-', 0.5)).toHaveLength(1);
    expect(visibleTargets(map2, 'sat-layer-', 0.3)).toHaveLength(1);
    expect(visibleTargets(map2, 'hd-meteosat-layer-', 0.3)).toHaveLength(1);
    expect(map2.errors).toEqual([]);
  }, 20000);

  it('activar Meteosat HD dins la seva zona no envia la càmera a Itàlia; GOES des d\'Europa sí que vola', async () => {
    const map = await mountRadar();
    map.flights.length = 0;

    map.zoom = 7;
    await act(async () => { fireEvent.click(screen.getByText('Meteosat HD (Europa)')); await sleep(20); });
    expect(map.flights).toEqual([{ zoom: 5, pitch: 0, speed: 1.4, essential: true }]);

    await act(async () => { fireEvent.click(screen.getByText('Meteosat HD (Europa)')); await sleep(20); });
    map.zoom = 4;
    map.flights.length = 0;
    await act(async () => { fireEvent.click(screen.getByText('Meteosat HD (Europa)')); await sleep(20); });
    expect(map.flights).toEqual([]);

    await act(async () => { fireEvent.click(screen.getByText('GOES HD (Amèrica)')); await sleep(20); });
    expect(map.flights).toEqual([{ center: [-95, 38], zoom: 3, pitch: 0, speed: 1.4, essential: true }]);
  });

  it("els canvis fets al menú abans que el mapa carregui s'apliquen en carregar", async () => {
    const map = renderRadar();
    await click('Fosc');
    await click('Etiquetes i Ciutats');
    await click('Relleu 3D i Muntanyes');
    await act(async () => { map.emit('load'); await sleep(30); });

    expect(layer(map, 'base-layer-dark')?.layout.visibility).toBe('visible');
    expect(layer(map, 'base-layer-sat_optic')?.layout.visibility).toBe('none');
    expect(layer(map, 'layer-labels')?.layout.visibility).toBe('visible');
    expect(map.lastTerrain).toEqual({ source: 'mapbox-dem', exaggeration: 1.5 });
  });

  it('si el context es perd abans que el primer mapa carregui, el mapa nou se sincronitza i mou la càmera', async () => {
    const map1 = renderRadar();
    await click('Relleu 3D i Muntanyes');
    await click('GOES HD (Amèrica)');
    await act(async () => { map1.emit('webglcontextlost', { originalEvent: { preventDefault() {} } }); await sleep(20); });
    const map2 = maps()[1];
    // Una altra acció de càmera abans del 'load' del mapa nou.
    await click('GOES HD (Amèrica)');
    await click('GOES HD (Amèrica)');
    await act(async () => { map2.emit('load'); await sleep(50); });

    expect(map2.lastTerrain).toEqual({ source: 'mapbox-dem', exaggeration: 1.5 });
    expect(map2.flights).toContainEqual({ center: [-95, 38], zoom: 3, pitch: 0, speed: 1.4, essential: true });
  });

  it("amb un satèl·lit HD actiu, les capes d'IR global creades durant l'animació neixen visibles (precàrrega)", async () => {
    const map = await mountRadar();
    await click('Meteosat HD (Europa)');
    await act(async () => { fireEvent.click(screen.getByLabelText('btnPlay')); await sleep(20); });
    const before = new Set(ids(map, 'sat-layer-').map((l) => l.id));
    const hidden = new Set<string>();
    for (let i = 0; i < 4; i++) {
      await act(async () => { await sleep(650); });
      ids(map, 'sat-layer-').filter((l) => l.layout.visibility !== 'visible').forEach((l) => hidden.add(l.id));
    }
    // Hi ha capes d'IR creades pel camí lleuger (no existien en prémer play)...
    expect(ids(map, 'sat-layer-').some((l) => !before.has(l.id))).toBe(true);
    // ...i cap no ha estat amagada en cap moment.
    expect([...hidden]).toEqual([]);
  }, 20000);

  it('després de passar per la pestanya de vent, un sol clic a Play torna a reproduir', async () => {
    const props = { lat: 41.4, lon: 2.17, showLayerMenu: true, setShowLayerMenu: () => {} };
    const { rerender } = render(<RadarMap {...props} isActive={true} />);
    const map = maps()[maps().length - 1];
    await act(async () => { map.emit('load'); await sleep(30); });
    await act(async () => { fireEvent.click(screen.getByLabelText('btnPlay')); await sleep(20); });
    expect(screen.getByLabelText('btnPause')).toBeTruthy();

    // Radar → vent: l'animació es pausa.
    rerender(<RadarMap {...props} isActive={false} />);
    await act(async () => { await sleep(20); });
    expect(screen.getByLabelText('btnPlay')).toBeTruthy();

    // Vent → radar: un sol clic ha de tornar a reproduir.
    rerender(<RadarMap {...props} isActive={true} />);
    await act(async () => { await sleep(20); });
    await act(async () => { fireEvent.click(screen.getByLabelText('btnPlay')); await sleep(20); });
    expect(screen.getByLabelText('btnPause')).toBeTruthy();
    const targets = new Set<string>();
    for (let i = 0; i < 2; i++) {
      await act(async () => { await sleep(650); });
      targets.add(visibleTargets(map, 'rad-layer-', 0.5).join('+'));
    }
    expect(targets.size).toBeGreaterThan(1);
    expect(map.errors).toEqual([]);
  }, 20000);

  it('Meteosat HD és MTG amb una franja de 10 min per fotograma, alineada amb /hd/meteosat/latest', async () => {
    const map = await mountRadar();
    await click('Meteosat HD (Europa)');

    // El fotograma actual (el més nou) és posterior a l'última imatge: la fa servir.
    expect(hdTargets(map)).toEqual([`hd-meteosat-layer-mtg-${MTG_LATEST}`]);
    expect(hdSource(map, `mtg-${MTG_LATEST}`)?.tiles).toEqual([`https://meteo-sat-proxy.tonitapias.workers.dev/hd/mtg/v1/${MTG_LATEST}/{z}/{x}/{y}.png`]);
    expect(hdSource(map, `mtg-${MTG_LATEST}`)?.bounds).toEqual([-40, -60, 60, 72]);
    const paint = layer(map, `hd-meteosat-layer-mtg-${MTG_LATEST}`)!.paint;
    expect([paint['raster-saturation'], paint['raster-contrast'], paint['raster-brightness-min']]).toEqual([-1, 0.47, 0.16]);

    // Reproducció: cada fotograma de radar té la seva imatge (LibreWXR en té una cada 20 min).
    await act(async () => { fireEvent.click(screen.getByLabelText('btnPlay')); await sleep(20); });
    const seen = [hdTargets(map).join('+')];
    for (let i = 0; i < 3; i++) {
      await act(async () => { await sleep(650); });
      seen.push(hdTargets(map).join('+'));
    }
    expect(seen[0]).toBe(`hd-meteosat-layer-mtg-${T0}`);
    expect(new Set(seen).size).toBe(4);
    seen.forEach((id) => expect(id).toMatch(/^hd-meteosat-layer-mtg-\d+$/));
    expect(map.errors).toEqual([]);
  }, 20000);

  // Els tres tests següents no compten el temps: a cada mostra llegeixen
  // quin fotograma de radar es veu i quina imatge HD l'acompanya (totes dues
  // es fixen a la mateixa crida), així que no fallen amb la màquina carregada.
  it("reproduint, si la imatge HD nova encara no ha arribat es manté l'anterior (mai buida)", async () => {
    const map = await mountRadar();
    await click('Meteosat HD (Europa)');
    // La franja del fotograma 1 triga a arribar (tessel·la freda d'EUMETSAT).
    map.loading.add(`mtg-${T0 + 600}`);
    await act(async () => { fireEvent.click(screen.getByLabelText('btnPlay')); await sleep(20); });

    let seen = await observeFrames(map, (f) => f.has(T0 + 600));
    // Fotograma 1: es continua veient la del fotograma 0, i la que espera no s'ha expulsat.
    expect(seen.get(T0 + 600)).toBe(`hd-meteosat-layer-mtg-${T0}`);
    expect(layer(map, `hd-meteosat-layer-mtg-${T0 + 600}`)).toBeTruthy();

    map.loading.clear();
    seen = await observeFrames(map, (f) => f.has(T0 + 1200));
    // Ja ha arribat: el fotograma 2 porta la seva.
    expect(seen.get(T0 + 1200)).toBe(`hd-meteosat-layer-mtg-${T0 + 1200}`);
    expect(map.errors).toEqual([]);
  }, 30000);

  it('si la imatge que es veia tampoc no és a punt (mapa mogut), es mostra la carregada més propera', async () => {
    const map = await mountRadar();
    await click('Meteosat HD (Europa)');
    await act(async () => { fireEvent.click(screen.getByLabelText('btnPlay')); await sleep(20); });
    expect(hdTargets(map)).toEqual([`hd-meteosat-layer-mtg-${T0}`]);
    // Com després de moure el mapa: la que es veu i la del fotograma 1 encara
    // carreguen; la precarregada del fotograma 2 ja és a punt.
    map.loading.add(`mtg-${T0}`);
    map.loading.add(`mtg-${T0 + 600}`);
    const seen = await observeFrames(map, (f) => f.has(T0 + 600));
    expect(seen.get(T0 + 600)).toBe(`hd-meteosat-layer-mtg-${T0 + 1200}`);
  }, 30000);

  it("si la imatge nova no arriba, la substituta no és mai a més d'1 h del fotograma", async () => {
    const map = await mountRadar();
    await click('Meteosat HD (Europa)');
    for (let i = 1; i <= 11; i++) map.loading.add(`mtg-${T0 + i * 600}`);
    await act(async () => { fireEvent.click(screen.getByLabelText('btnPlay')); await sleep(20); });

    const seen = await observeFrames(map, (f) => f.has(T0 + 9 * 600));
    // Fotogrames 1-6 (fins a 60 min): la del fotograma 0. Del 7 (70 min) en
    // endavant: la del fotograma, encara que no hagi arribat, i no hi torna
    // (del 8 en endavant és l'última publicada, MTG_LATEST).
    for (let i = 1; i <= 9; i++) {
      const shown = seen.get(T0 + i * 600);
      if (shown === undefined) continue; // fotograma saltat per la càrrega de la màquina
      expect(shown).toBe(`hd-meteosat-layer-mtg-${i <= 6 ? T0 : Math.min(T0 + i * 600, MTG_LATEST)}`);
    }
    expect([...seen.keys()].filter((t) => t > T0 && t <= T0 + 9 * 600).length).toBeGreaterThanOrEqual(6);
  }, 30000);

  it('sense /hd/meteosat/latest, Meteosat HD fa servir MTG amb una hora calculada', async () => {
    hdLatest = 'fail';
    const map = await mountRadar();
    await click('Meteosat HD (Europa)');
    // Fotogrames de fa més de 30 min: la seva pròpia franja.
    expect(hdTargets(map)).toEqual([`hd-meteosat-layer-mtg-${T0 + 11 * 600}`]);
    expect(hdSource(map, `mtg-${T0 + 11 * 600}`)?.tiles[0]).toContain('/hd/mtg/v1/');
  });

  it('si el worker passa a MSG, la capa fa servir la ruta, els límits i la pintura de MSG', async () => {
    const msgLatest = T0 + 4800; // múltiple de 15 min
    hdLatest = { layer: 'msg', latest: msgLatest, cadence: 900, source: 'caps' };
    const map = await mountRadar();
    await click('Meteosat HD (Europa)');

    expect(hdTargets(map)).toEqual([`hd-meteosat-layer-msg-${msgLatest}`]);
    expect(hdSource(map, `msg-${msgLatest}`)?.tiles).toEqual([`https://meteo-sat-proxy.tonitapias.workers.dev/hd/meteosat/${msgLatest}/{z}/{x}/{y}.png`]);
    expect(hdSource(map, `msg-${msgLatest}`)?.bounds).toEqual([-40, -60, 60, 66.4]);
    const paint = layer(map, `hd-meteosat-layer-msg-${msgLatest}`)!.paint;
    expect([paint['raster-contrast'], paint['raster-brightness-min']]).toEqual([0.3, 0]);
  });

  it('Meteosat HD funciona encara que LibreWXR no doni frames de satèl·lit', async () => {
    libreWxr = { ...LIBREWXR, satellite: { infrared: [] } };
    const map = await mountRadar();
    // useRadarData desa les dades 5 min a nivell de mòdul: refresc forçat.
    await act(async () => { fireEvent.click(screen.getByLabelText('btnRefresh')); await sleep(30); });
    await click('Meteosat HD (Europa)');
    expect(ids(map, 'sat-layer-')).toEqual([]);
    expect(hdTargets(map)).toEqual([`hd-meteosat-layer-mtg-${MTG_LATEST}`]);
  });

  it('mentre /hd/meteosat/latest no respon no es baixa cap tessel·la Meteosat HD', async () => {
    let respond: (v: unknown) => void = () => {};
    hdLatest = new Promise((r) => { respond = r; });
    const map = await mountRadar();
    await click('Meteosat HD (Europa)');
    expect(ids(map, 'hd-meteosat-layer-')).toEqual([]);

    await act(async () => { respond({ layer: 'mtg', latest: MTG_LATEST, cadence: 600, source: 'caps' }); await sleep(30); });
    expect(hdTargets(map)).toEqual([`hd-meteosat-layer-mtg-${MTG_LATEST}`]);
    expect(map.errors).toEqual([]);
  });

  it('llamps: les dues franges de 5 min de cada fotograma, entre el radar i les etiquetes', async () => {
    const map = await mountRadar();
    const ltg = () => visibleTargets(map, 'ltg-layer-', 0.5);

    // Fotograma actual (el més nou): les seves dues franges passen de l'última
    // publicada, així que en queda una sola.
    expect(ltg()).toEqual([`ltg-layer-${LIGHTNING_LATEST}`]);
    expect(map.sources.get(`ltg-src-${LIGHTNING_LATEST}`)).toMatchObject({
      tiles: [`https://meteo-sat-proxy.tonitapias.workers.dev/lightning/v1/${LIGHTNING_LATEST}/{z}/{x}/{y}.png`],
      bounds: [-60, -60, 60, 72]
    });
    const order = map.layers.map((l) => l.id);
    const at = (id: string) => order.indexOf(id);
    const lastRadar = Math.max(...order.filter((id) => id.startsWith('rad-')).map(at));
    expect(at('z-index-lightning')).toBeGreaterThan(lastRadar);
    expect(at(`ltg-layer-${LIGHTNING_LATEST}`)).toBeGreaterThan(at('z-index-lightning'));
    expect(at(`ltg-layer-${LIGHTNING_LATEST}`)).toBeLessThan(at('layer-labels'));

    // Reproduint: el fotograma T es veu amb les franges T − 5 i T, i cada franja surt en un sol fotograma.
    await act(async () => { fireEvent.click(screen.getByLabelText('btnPlay')); await sleep(20); });
    const seen = new Map<number, string>();
    const start = Date.now();
    while (seen.size < 4 && Date.now() - start < 20000) {
      await act(async () => { await sleep(20); });
      const frame = radarFrame(map);
      if (frame !== null && !seen.has(frame)) seen.set(frame, ltg().sort().join('+'));
    }
    for (const [frame, shown] of seen) {
      if (frame > LIGHTNING_LATEST) continue;
      expect(shown).toBe(`ltg-layer-${frame - 300}+ltg-layer-${frame}`);
    }
    // Precàrrega acotada: el fotograma actual i els 2 següents × 2 franges.
    expect(ids(map, 'ltg-layer-').length).toBeLessThanOrEqual(6);
    expect(map.errors).toEqual([]);
  }, 30000);

  it('desactivar els llamps treu les capes i la llegenda; tornar-los a activar les recrea', async () => {
    const map = await mountRadar();
    expect(ids(map, 'ltg-layer-').length).toBeGreaterThan(0);
    expect(screen.getByText('Llamps / 5 min')).toBeTruthy();

    await click('Llamps (satèl·lit MTG)');
    expect(ids(map, 'ltg-layer-')).toEqual([]);
    expect(screen.queryByText('Llamps / 5 min')).toBeNull();

    await click('Llamps (satèl·lit MTG)');
    await act(async () => { await sleep(30); });
    expect(visibleTargets(map, 'ltg-layer-', 0.5)).toEqual([`ltg-layer-${LIGHTNING_LATEST}`]);
    expect(map.errors).toEqual([]);
  });

  it('si el Lightning Imager va endarrerit (/lightning/latest null), no es crea cap capa de llamps', async () => {
    lightningLatest = null;
    const map = await mountRadar();
    await act(async () => { await sleep(30); });
    expect(ids(map, 'ltg-layer-')).toEqual([]);
  });

  it('Meteosat HD en color: GeoColour per sobre del filtre de nit, i en tornar a IR es treu', async () => {
    const colourLatest = T0 + 7 * 600;
    hdLatest = { layer: 'mtg', latest: MTG_LATEST, cadence: 600, source: 'caps', colour: { latest: colourLatest, cadence: 600, source: 'caps' } };
    const map = await mountRadar();
    await click('Meteosat HD (Europa)');
    expect(hdTargets(map)).toEqual([`hd-meteosat-layer-mtg-${MTG_LATEST}`]);

    await click('Color');
    expect(hdTargets(map)).toEqual([`hd-meteosat-layer-mtgColour-${colourLatest}`]);
    expect(ids(map, 'hd-meteosat-layer-mtg-')).toEqual([]);
    expect(hdSource(map, `mtgColour-${colourLatest}`)?.tiles).toEqual([`https://meteo-sat-proxy.tonitapias.workers.dev/hd/mtg/geocolour/v1/${colourLatest}/{z}/{x}/{y}.png`]);
    const order = map.layers.map((l) => l.id);
    expect(order.indexOf(`hd-meteosat-layer-mtgColour-${colourLatest}`)).toBeGreaterThan(order.indexOf('layer-night'));
    const paint = layer(map, `hd-meteosat-layer-mtgColour-${colourLatest}`)!.paint;
    expect([paint['raster-saturation'], paint['raster-contrast'], paint['raster-brightness-min']]).toEqual([0, 0, 0]);
    // Fotografia: opacitat plena a zoom baix (l'IR hi deixa veure el mapa base).
    expect(opacityAtZoom3(layer(map, `hd-meteosat-layer-mtgColour-${colourLatest}`)!)).toBe(1);

    await click('IR');
    expect(hdTargets(map)).toEqual([`hd-meteosat-layer-mtg-${MTG_LATEST}`]);
    expect(ids(map, 'hd-meteosat-layer-mtgColour-')).toEqual([]);
    expect(map.errors).toEqual([]);
  });

  it('si GeoColour no està disponible (colour null), el mode color mostra l\'IR', async () => {
    hdLatest = { layer: 'mtg', latest: MTG_LATEST, cadence: 600, source: 'caps', colour: null };
    const map = await mountRadar();
    await click('Meteosat HD (Europa)');
    await click('Color');
    expect(hdTargets(map)).toEqual([`hd-meteosat-layer-mtg-${MTG_LATEST}`]);
  });

  it("el panell d'informació mostra l'atribució obligatòria d'EUMETSAT", async () => {
    await mountRadar();
    expect(screen.queryByText(/EUMETSAT/)).toBeNull();
    await act(async () => { fireEvent.click(screen.getByLabelText('radarData')); await sleep(20); });
    const link = screen.getByText(/^Contains modified EUMETSAT Meteosat data \d{4}$/);
    expect(link.closest('a')?.getAttribute('href')).toBe('https://www.eumetsat.int/');
  });
});
