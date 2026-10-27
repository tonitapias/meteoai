import { describe, expect, it } from 'vitest';
import {
  antipode, DESCENT_MS, DESCENT_STOPS, descentFrame, descentSkip, distanceKm, EARTH_DIAMETER_M, EARTH_RADIUS_M,
  earthTemperature, formatCmRange, formatCoords, formatEarthTemperature, gibsTileUrl, latestPassDay, nearestPlace,
  parseWorldPlaces, photoAgeDays, photoLabels, photoPoint, photoTiles, photoZoom, returnRemaining, RETURN_MS,
  rulerFraction, rulerTicks, scaleBar, seasonAt, tileDate,
} from './earthElevator';

const LETTERS_CA = { north: 'N', south: 'S', east: 'E', west: 'O' };
const BARCELONA = { lat: 41.3874, lon: 2.1686 };
const DAY = 86_400_000;

describe('descentFrame', () => {
  it("surt de la superfície i arriba a les antípodes, a un diàmetre de distància", () => {
    expect(descentFrame(0)).toMatchObject({ depth: 0, stop: 0 });
    expect(descentFrame(DESCENT_MS)).toMatchObject({ depth: EARTH_DIAMETER_M, arrived: true, stop: DESCENT_STOPS.length - 1 });
  });

  it("s'atura a cada parada, a la seva profunditat, i només baixa", () => {
    const stops: number[] = [];
    let prev = 0;
    for (let t = 0; t <= DESCENT_MS; t += 25) {
      const f = descentFrame(t);
      expect(f.depth).toBeGreaterThanOrEqual(prev);
      prev = f.depth;
      if (f.leg === 1) expect(f.depth).toBe(DESCENT_STOPS[f.stop].depth);
      if (f.leg === 1 && f.hold > 0 && stops[stops.length - 1] !== f.stop) stops.push(f.stop);
    }
    expect(stops).toEqual([0, 1, 2, 3]);
  });

  it('les parades: Kola, 100 km, el nucli, el centre i l\'altra banda', () => {
    expect(DESCENT_STOPS.map(s => s.depth)).toEqual([12_262, 100_000, 2_890_000, EARTH_RADIUS_M, EARTH_DIAMETER_M]);
  });
});

describe('descentSkip', () => {
  it('de camí, arriba a la parada; aturat, surt cap a la següent; al final, s\'hi queda', () => {
    const arrived = descentSkip(500);
    expect(descentFrame(arrived)).toMatchObject({ stop: 0, leg: 1 });
    const next = descentSkip(arrived + 100);
    expect(descentFrame(next + 1).stop).toBe(1);
    expect(descentSkip(DESCENT_MS + 10)).toBe(DESCENT_MS);
  });
});

describe('returnRemaining', () => {
  it('torna de tot el diàmetre a zero', () => {
    expect(returnRemaining(0)).toBe(EARTH_DIAMETER_M);
    expect(returnRemaining(RETURN_MS)).toBe(0);
    expect(returnRemaining(RETURN_MS / 2)).toBeCloseTo(EARTH_DIAMETER_M / 2);
  });
});

describe('la regla', () => {
  it('és a escala real: el centre a la meitat i el pou de Kola gairebé a dalt de tot', () => {
    expect(rulerFraction(EARTH_RADIUS_M)).toBeCloseTo(0.5);
    expect(rulerFraction(12_262)).toBeLessThan(0.001);
    expect(rulerFraction(EARTH_DIAMETER_M * 2)).toBe(1);
  });

  it('marca els canvis de capa en km o en milles', () => {
    expect(rulerTicks('C', 'ca-ES').map(t => t.label)).toEqual(['0', '2.890', '5.150', '6.371', '12.742']);
    expect(rulerTicks('F', 'en-US').map(t => t.label)).toEqual(['0', '1,796', '3,200', '3,959', '7,918']);
  });
});

describe('earthTemperature', () => {
  it('passa pels valors de referència i és simètrica a l\'altra banda', () => {
    expect(earthTemperature(12_262)).toBe(180);
    expect(earthTemperature(100_000)).toBe(1300);
    expect(earthTemperature(2_890_000)).toBe(4000);
    expect(earthTemperature(EARTH_RADIUS_M)).toBe(5400);
    expect(earthTemperature(EARTH_DIAMETER_M - 100_000)).toBe(1300);
    expect(earthTemperature(EARTH_DIAMETER_M)).toBe(15);
  });

  it('el mesurat, tal qual; l\'estimat, amb ≈ i arrodonit', () => {
    expect(formatEarthTemperature(180, false, 'C', 'ca-ES')).toBe('180 °C');
    expect(formatEarthTemperature(4012, true, 'C', 'ca-ES')).toBe('≈ 4.000 °C');
    expect(formatEarthTemperature(5400, true, 'F', 'en-US')).toBe('≈ 9,800 °F');
    expect(formatEarthTemperature(5400, true, 'C', 'ca-ES', false)).toBe('5.400 °C');
  });

  it('les plaques: centímetres o polzades', () => {
    expect(formatCmRange(2, 5, 'C', 'ca-ES')).toBe('2-5 cm');
    expect(formatCmRange(2, 5, 'F', 'en-US')).toBe('1-2 in');
  });
});

describe('antipode i estació', () => {
  it("les antípodes de Barcelona són al Pacífic, prop del meridià 180", () => {
    const a = antipode(BARCELONA.lat, BARCELONA.lon);
    expect(a.lat).toBeCloseTo(-41.3874);
    expect(a.lon).toBeCloseTo(-177.8314);
    expect(antipode(-40.4, 176.3).lon).toBeCloseTo(-3.7);
    expect(distanceKm(BARCELONA.lat, BARCELONA.lon, a.lat, a.lon)).toBeCloseTo(EARTH_DIAMETER_M / 2000 * Math.PI, -1);
  });

  it("a l'octubre és tardor aquí i primavera a les antípodes; als tròpics, cap estació", () => {
    const day = new Date('2026-10-27T12:00:00Z');
    expect(seasonAt(day, 41.4)).toBe('autumn');
    expect(seasonAt(day, -41.4)).toBe('spring');
    expect(seasonAt(new Date('2026-01-10T00:00:00Z'), 41.4)).toBe('winter');
    expect(seasonAt(new Date('2026-12-25T00:00:00Z'), -40)).toBe('summer');
    expect(seasonAt(day, 10)).toBeNull();
  });

  it('coordenades amb les lletres de l\'idioma', () => {
    expect(formatCoords(-41.3874, -177.8314, 'ca-ES', LETTERS_CA)).toBe('41,39° S · 177,83° O');
    expect(formatCoords(40.42, 176.3, 'en-US', { north: 'N', south: 'S', east: 'E', west: 'W' })).toBe('40.42° N · 176.30° E');
  });
});

describe('la foto', () => {
  it('al mar, menys zoom que a prop de terra; amb pantalla densa, tessel·les a 128 px', () => {
    expect(photoZoom('sea', 3)).toEqual({ zoom: 6, tilePx: 128 });
    expect(photoZoom('land', 1)).toEqual({ zoom: 6, tilePx: 256 });
  });

  it('les tessel·les cobreixen tota la foto i passen el meridià 180 sense sortir del món', () => {
    const tiles = photoTiles(-41.3874, -177.8314, 6, 128, 454, 450);
    expect(tiles.length).toBeGreaterThan(0);
    for (const t of tiles) {
      expect(t.x).toBeGreaterThanOrEqual(0);
      expect(t.x).toBeLessThan(64);
    }
    // Hi ha tessel·les a totes dues bandes del meridià 180.
    expect(tiles.some(t => t.lon > 170)).toBe(true);
    expect(tiles.some(t => t.lon < -170)).toBe(true);
    const minLeft = Math.min(...tiles.map(t => t.left)), maxRight = Math.max(...tiles.map(t => t.left + 128));
    const minTop = Math.min(...tiles.map(t => t.top)), maxBottom = Math.max(...tiles.map(t => t.top + 128));
    expect(minLeft).toBeLessThanOrEqual(0);
    expect(maxRight).toBeGreaterThanOrEqual(454);
    expect(minTop).toBeLessThanOrEqual(0);
    expect(maxBottom).toBeGreaterThanOrEqual(450);
  });

  it('un lloc a l\'altra banda del meridià 180 cau al costat, no a l\'altra punta del món', () => {
    const p = photoPoint(-38.66, 178.02, -41.3874, -177.8314, 6, 128);
    expect(p.x).toBeLessThan(0);
    expect(p.x).toBeGreaterThan(-300);
    expect(p.y).toBeLessThan(0);
  });

  it('la passada (27-10-2026, 19:04 UTC): a cada banda del meridià 180, la data que GIBS hi posa', () => {
    const now = Date.parse('2026-10-27T19:04:00Z');
    const passDay = latestPassDay(now, -177.8314);
    expect(new Date(passDay * DAY).toISOString().slice(0, 10)).toBe('2026-10-26');
    expect(tileDate(passDay, -177.8314, -175)).toBe('2026-10-26');
    expect(tileDate(passDay, -177.8314, 178)).toBe('2026-10-27');
    // Madrid → Weber (Nova Zelanda), a l'altra banda de la línia.
    const weber = latestPassDay(now, 176.3);
    expect(tileDate(weber, 176.3, 176)).toBe('2026-10-27');
    expect(tileDate(weber, 176.3, -179)).toBe('2026-10-26');
    expect(photoAgeDays(now, -177.8314, passDay)).toBe(1);
    expect(gibsTileUrl('2026-10-26', 6, 0, 40)).toBe('https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/VIIRS_NOAA20_CorrectedReflectance_TrueColor/default/2026-10-26/GoogleMapsCompatible_Level9/6/40/0.jpg');
  });

  it("l'escala és una distància rodona que hi cap", () => {
    const bar = scaleBar(-41.4, 6, 128, 'C');
    expect([100, 200]).toContain(bar.value);
    expect(bar.px).toBeLessThanOrEqual(90);
    expect(scaleBar(-41.4, 6, 128, 'F')).toMatchObject({ value: 200 });
  });
});

describe('els llocs', () => {
  const tsv = [
    '# comentari',
    '-44\t-176.4\t2\tNZ\tWaitangi',
    '-38.7\t178\t7\tNZ\tGisborne',
    '-39.5\t176.9\t8\tNZ\tNapier',
    '-41.3\t174.8\t11\tNZ\tWellington',
    'brossa',
  ].join('\n');

  it('llegeix la llista i en salta comentaris i línies dolentes', () => {
    const places = parseWorldPlaces(tsv);
    expect(places.map(p => p.name)).toEqual(['Waitangi', 'Gisborne', 'Napier', 'Wellington']);
    expect(places[0]).toEqual({ lat: -44, lon: -176.4, rank: 2, cc: 'NZ', name: 'Waitangi' });
  });

  it('el més proper a les antípodes de Barcelona és Waitangi, a les illes Chatham', () => {
    const near = nearestPlace(parseWorldPlaces(tsv), -41.3874, -177.8314);
    expect(near?.place.name).toBe('Waitangi');
    expect(near?.km).toBeGreaterThan(250);
    expect(near?.km).toBeLessThan(350);
    expect(nearestPlace([], 0, 0)).toBeNull();
  });

  it('a la foto, els més poblats que hi caben, sense tapar l\'agulla', () => {
    const labels = photoLabels(parseWorldPlaces(tsv), -40.4168, 176.2962, 7, 128, 390, 388);
    // Napier és massa a prop de l'agulla (hi taparia el rètol), Gisborne cau a la franja de les lectures de dalt i
    // Waitangi queda fora de la foto.
    expect(labels.map(l => l.place.name)).toEqual(['Wellington']);
    for (const l of labels) expect(Math.hypot(l.x, l.y)).toBeGreaterThan(70);
  });
});
