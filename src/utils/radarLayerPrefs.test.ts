import { describe, it, expect, beforeEach } from 'vitest';
import {
  RADAR_LAYERS_KEY,
  DEFAULT_OVERLAYS,
  loadRadarLayers,
  saveRadarLayers,
  countActiveLayers
} from './radarLayerPrefs';

const BCN = [41.39, 2.17] as const;
const NYC = [40.71, -74.01] as const;

beforeEach(() => {
  window.localStorage.clear();
});

describe('radarLayerPrefs', () => {
  it('sense res desat, les capes per defecte', () => {
    expect(loadRadarLayers(...BCN)).toEqual({ base: 'sat_optic', overlays: DEFAULT_OVERLAYS });
  });

  it('desa i recupera el mapa de fons i les capes', () => {
    saveRadarLayers('dark', { ...DEFAULT_OVERLAYS, labels: true, nasaFires: true, night: false, lightning: false });
    const { base, overlays } = loadRadarLayers(...BCN);
    expect(base).toBe('dark');
    expect(overlays).toEqual({ ...DEFAULT_OVERLAYS, labels: true, nasaFires: true, night: false, lightning: false });
  });

  it('HD es recorda com a HD i el satèl·lit és el del lloc consultat', () => {
    saveRadarLayers('sat_optic', { ...DEFAULT_OVERLAYS, satIR: false, hdGoes: true, hdColour: true });
    expect(JSON.parse(window.localStorage.getItem(RADAR_LAYERS_KEY)!).clouds).toBe('hd');

    const bcn = loadRadarLayers(...BCN).overlays;
    expect([bcn.satIR, bcn.hdMeteosat, bcn.hdGoes, bcn.hdHimawari, bcn.hdColour]).toEqual([false, true, false, false, true]);
    const nyc = loadRadarLayers(...NYC).overlays;
    expect([nyc.satIR, nyc.hdMeteosat, nyc.hdGoes, nyc.hdHimawari]).toEqual([false, false, true, false]);
  });

  it('sense núvols es recorda com a "Cap"', () => {
    saveRadarLayers('sat_optic', { ...DEFAULT_OVERLAYS, satIR: false });
    const o = loadRadarLayers(...BCN).overlays;
    expect([o.satIR, o.hdMeteosat, o.hdGoes, o.hdHimawari]).toEqual([false, false, false, false]);
  });

  it('el Relleu 3D no es recorda', () => {
    saveRadarLayers('relief', { ...DEFAULT_OVERLAYS, terrain3D: true });
    expect(loadRadarLayers(...BCN).overlays.terrain3D).toBe(false);
  });

  it('amb la Terra de Nit (easter egg) es manté el mapa de fons desat', () => {
    saveRadarLayers('relief', DEFAULT_OVERLAYS);
    saveRadarLayers('black_marble', { ...DEFAULT_OVERLAYS, night: false });
    const { base, overlays } = loadRadarLayers(...BCN);
    expect(base).toBe('relief');
    expect(overlays.night).toBe(false);
  });

  it('un valor malmès o estrany fa servir el per defecte (camp a camp)', () => {
    window.localStorage.setItem(RADAR_LAYERS_KEY, '{no és json');
    expect(loadRadarLayers(...BCN)).toEqual({ base: 'sat_optic', overlays: DEFAULT_OVERLAYS });

    window.localStorage.setItem(RADAR_LAYERS_KEY, JSON.stringify({ base: 'black_marble', clouds: 'meteosat', labels: 'sí', nasaReal: true }));
    expect(loadRadarLayers(...BCN)).toEqual({ base: 'sat_optic', overlays: { ...DEFAULT_OVERLAYS, nasaReal: true } });
  });

  it('compta les capes actives, amb els núvols com una sola', () => {
    expect(countActiveLayers(DEFAULT_OVERLAYS)).toBe(4); // pluja, llamps, núvols, nit
    expect(countActiveLayers({ ...DEFAULT_OVERLAYS, satIR: false, hdMeteosat: true })).toBe(4);
    expect(countActiveLayers({ ...DEFAULT_OVERLAYS, satIR: false })).toBe(3);
    expect(countActiveLayers({ ...DEFAULT_OVERLAYS, labels: true, terrain3D: true, nasaFires: true, nasaReal: true })).toBe(8);
  });
});
