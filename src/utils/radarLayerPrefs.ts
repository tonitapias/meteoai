// Capes del radar triades per l'usuari, desades al dispositiu perquè el radar
// s'obri com el va deixar. És una comoditat: si l'emmagatzematge no hi és o
// el valor està malmès, el radar s'obre amb les capes per defecte.
//
// Què NO es desa:
// - El Relleu 3D: inclina el mapa i fa zoom; el radar s'obriria inclinat.
// - Quin satèl·lit HD: només que es volia HD. En obrir es tria el que cobreix
//   el lloc consultat (hdAgencyForPoint), perquè qui viatja no acabi a l'altra
//   punta del món.
// - La Terra de Nit (l'easter egg de "Nit"): es manté el mapa de fons desat.
import { readStorage, writeStorage } from './safeStorage';
import { BaseLayerType, Overlays, getCloudSource, hdAgencyForPoint } from './radarPhysics';

export const RADAR_LAYERS_KEY = 'meteoai_radar_layers';

export const DEFAULT_BASE_LAYER: BaseLayerType = 'sat_optic';

export const DEFAULT_OVERLAYS: Overlays = {
  precip: true,
  satIR: true,
  hdGoes: false,
  hdMeteosat: false,
  hdHimawari: false,
  night: true,
  labels: false,
  nasaReal: false,
  nasaFires: false,
  terrain3D: false,
  lightning: true,
  hdColour: false
};

type SavedBase = Exclude<BaseLayerType, 'black_marble'>;
type CloudChoice = 'none' | 'global' | 'hd';

interface SavedRadarLayers {
  base: SavedBase;
  clouds: CloudChoice;
  hdColour: boolean;
  precip: boolean;
  lightning: boolean;
  night: boolean;
  labels: boolean;
  nasaFires: boolean;
  nasaReal: boolean;
}

const SAVED_BASES: readonly SavedBase[] = ['dark', 'light', 'relief', 'sat_optic'];
const CLOUD_CHOICES: readonly CloudChoice[] = ['none', 'global', 'hd'];
const FLAGS = ['hdColour', 'precip', 'lightning', 'night', 'labels', 'nasaFires', 'nasaReal'] as const;

const readSaved = (): Partial<SavedRadarLayers> => {
  const raw = readStorage(RADAR_LAYERS_KEY);
  if (!raw) return {};
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return {};
  }
  if (!data || typeof data !== 'object') return {};
  const obj = data as Record<string, unknown>;
  // Camp a camp: un valor estrany només fa perdre aquell camp.
  const saved: Partial<SavedRadarLayers> = {};
  if (SAVED_BASES.includes(obj.base as SavedBase)) saved.base = obj.base as SavedBase;
  if (CLOUD_CHOICES.includes(obj.clouds as CloudChoice)) saved.clouds = obj.clouds as CloudChoice;
  FLAGS.forEach((flag) => {
    if (typeof obj[flag] === 'boolean') saved[flag] = obj[flag] as boolean;
  });
  return saved;
};

export function loadRadarLayers(lat: number, lon: number): { base: BaseLayerType; overlays: Overlays } {
  const saved = readSaved();
  const overlays: Overlays = { ...DEFAULT_OVERLAYS };
  FLAGS.forEach((flag) => {
    if (saved[flag] !== undefined) overlays[flag] = saved[flag] as boolean;
  });
  if (saved.clouds) {
    overlays.satIR = saved.clouds === 'global';
    if (saved.clouds === 'hd') {
      const agency = hdAgencyForPoint(lat, lon);
      overlays.hdMeteosat = agency === 'meteosat';
      overlays.hdGoes = agency === 'goes';
      overlays.hdHimawari = agency === 'himawari';
    }
  }
  return { base: saved.base ?? DEFAULT_BASE_LAYER, overlays };
}

export function saveRadarLayers(base: BaseLayerType, overlays: Overlays): void {
  const source = getCloudSource(overlays);
  const saved: SavedRadarLayers = {
    // Amb la Terra de Nit activa es manté el mapa de fons que ja hi havia.
    base: base === 'black_marble' ? (readSaved().base ?? 'sat_optic') : base,
    clouds: source === 'none' || source === 'global' ? source : 'hd',
    hdColour: overlays.hdColour,
    precip: overlays.precip,
    lightning: overlays.lightning,
    night: overlays.night,
    labels: overlays.labels,
    nasaFires: overlays.nasaFires,
    nasaReal: overlays.nasaReal
  };
  writeStorage(RADAR_LAYERS_KEY, JSON.stringify(saved));
}

// Capes actives que mostra el botó de capes (els núvols compten com una).
export const countActiveLayers = (o: Overlays): number =>
  [o.precip, o.lightning, getCloudSource(o) !== 'none', o.night, o.labels, o.terrain3D, o.nasaFires, o.nasaReal]
    .filter(Boolean).length;
