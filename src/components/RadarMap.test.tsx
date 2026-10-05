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
  vi.stubGlobal('fetch', vi.fn(async (url: string) =>
    new Response(JSON.stringify(String(url).includes('librewxr') ? LIBREWXR : RAINVIEWER), { status: 200 })));
});

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

  it("el panell d'informació mostra l'atribució obligatòria d'EUMETSAT", async () => {
    await mountRadar();
    expect(screen.queryByText(/EUMETSAT/)).toBeNull();
    await act(async () => { fireEvent.click(screen.getByLabelText('radarData')); await sleep(20); });
    const link = screen.getByText(/^Contains modified EUMETSAT Meteosat data \d{4}$/);
    expect(link.closest('a')?.getAttribute('href')).toBe('https://www.eumetsat.int/');
  });
});
