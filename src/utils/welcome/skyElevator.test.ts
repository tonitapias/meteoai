import { describe, expect, it } from 'vitest';
import {
  ASCENT_MS, ELEVATOR_STOPS, elevatorFrame, elevatorSkip, formatAltitude, formatDistance, formatSpeed,
  GEO_ALTITUDE_M, latestImageTime, meteosatDiscPoint, reentryAltitude, REENTRY_MS, rulerFraction, rulerTicks,
  viewingSatellite,
} from './skyElevator';

describe('elevatorFrame', () => {
  it('surt de terra i arriba al Meteosat', () => {
    expect(elevatorFrame(0).altitude).toBeCloseTo(10);
    expect(elevatorFrame(0).stop).toBe(0);
    const end = elevatorFrame(ASCENT_MS);
    expect(end).toMatchObject({ altitude: GEO_ALTITUDE_M, arrived: true, stop: ELEVATOR_STOPS.length - 1 });
  });

  it("s'atura a cada parada abans de seguir", () => {
    const stops: number[] = [];
    for (let t = 0; t < ASCENT_MS; t += 50) {
      const f = elevatorFrame(t);
      if (f.leg === 1 && f.hold > 0 && stops[stops.length - 1] !== f.stop) stops.push(f.stop);
      if (f.leg === 1) expect(f.altitude).toBe(ELEVATOR_STOPS[f.stop].altitude);
    }
    // Totes menys l'última, on el viatge s'acaba.
    expect(stops).toEqual([0, 1, 2, 3]);
  });

  it("l'altitud només puja", () => {
    let prev = 0;
    for (let t = 0; t <= ASCENT_MS; t += 25) {
      const { altitude } = elevatorFrame(t);
      expect(altitude).toBeGreaterThanOrEqual(prev);
      prev = altitude;
    }
  });
});

describe('elevatorSkip', () => {
  it('de camí, arriba a la parada; aturat, surt cap a la següent', () => {
    const midLeg = 500;
    const arrived = elevatorSkip(midLeg);
    expect(elevatorFrame(arrived)).toMatchObject({ stop: 0, leg: 1 });
    const next = elevatorSkip(arrived + 100);
    expect(elevatorFrame(next + 1).stop).toBe(1);
    expect(elevatorFrame(next + 1).leg).toBeLessThan(1);
  });

  it("a l'última parada no va més enllà", () => {
    expect(elevatorSkip(ASCENT_MS + 500)).toBe(ASCENT_MS);
  });
});

describe('reentryAltitude', () => {
  it('cau del Meteosat a terra', () => {
    expect(reentryAltitude(0)).toBeCloseTo(GEO_ALTITUDE_M);
    expect(reentryAltitude(REENTRY_MS)).toBe(0);
    expect(reentryAltitude(REENTRY_MS / 2)).toBeLessThan(GEO_ALTITUDE_M);
  });
});

describe('rulerFraction i rulerTicks', () => {
  it('va de 0 a terra fins a 1 al Meteosat', () => {
    expect(rulerFraction(0)).toBe(0);
    expect(rulerFraction(GEO_ALTITUDE_M)).toBe(1);
    expect(rulerFraction(100_000)).toBeGreaterThan(rulerFraction(12_000));
  });

  it('marques creixents, en km o en milles', () => {
    for (const unit of ['C', 'F'] as const) {
      const ticks = rulerTicks(unit, 'ca-ES');
      expect(ticks[0].label).toBe('0');
      ticks.slice(1).forEach((tick, i) => expect(tick.altitude).toBeGreaterThan(ticks[i].altitude));
    }
    expect(rulerTicks('F', 'en-US')[1].label).toBe('1\u00a0mi');
  });
});

describe('formats', () => {
  it('altímetre en metres i km, o en peus i milles', () => {
    expect(formatAltitude(4300, 'C', 'en-US')).toBe('4,300\u00a0m');
    expect(formatAltitude(12_004, 'C', 'en-US')).toBe('12,000\u00a0m');
    expect(formatAltitude(100_000, 'C', 'en-US')).toBe('100\u00a0km');
    expect(formatAltitude(GEO_ALTITUDE_M, 'C', 'en-US')).toBe('35,786\u00a0km');
    expect(formatAltitude(4300, 'F', 'en-US')).toBe('14,110\u00a0ft');
    expect(formatAltitude(GEO_ALTITUDE_M, 'F', 'en-US')).toBe('22,236\u00a0mi');
    expect(formatAltitude(-3, 'C', 'en-US')).toBe('0\u00a0m');
  });

  it('distàncies i velocitats dels textos', () => {
    expect(formatDistance(100, 'C', 'en-US')).toBe('100\u00a0km');
    expect(formatDistance(12, 'F', 'en-US')).toBe('7.5\u00a0mi');
    expect(formatSpeed(27_600, 'C', 'en-US')).toBe('27,600\u00a0km/h');
    expect(formatSpeed(28_000, 'F', 'en-US')).toBe('17,400\u00a0mph');
  });
});

describe('viewingSatellite i meteosatDiscPoint', () => {
  it('Barcelona la veu el Meteosat, a dalt i una mica a l\'est del centre', () => {
    expect(viewingSatellite(41.39, 2.17)).toEqual({ satellite: 'meteosat', visible: true });
    const p = meteosatDiscPoint(41.39, 2.17)!;
    expect(p.y).toBeCloseTo(Math.sin((41.39 * Math.PI) / 180));
    expect(p.x).toBeGreaterThan(0);
    expect(p.x).toBeLessThan(0.05);
  });

  it('Amèrica i el Japó els veuen els GOES i l\'Himawari', () => {
    expect(viewingSatellite(40.71, -74.01)).toEqual({ satellite: 'goesEast', visible: true });
    expect(viewingSatellite(37.77, -122.42)).toEqual({ satellite: 'goesWest', visible: true });
    expect(viewingSatellite(35.68, 139.69)).toEqual({ satellite: 'himawari', visible: true });
    expect(meteosatDiscPoint(35.68, 139.69)).toBeNull();
  });

  it('prop del pol, cap satèl·lit geoestacionari no hi veu bé', () => {
    expect(viewingSatellite(78.2, 15.6).visible).toBe(false);
    expect(meteosatDiscPoint(78.2, 15.6)).toBeNull();
  });
});

describe('latestImageTime', () => {
  it("llegeix el `default` de la dimensió temps", () => {
    const xml = '<Layer><Name>rgb_geocolour</Name><Dimension name="time" default="2026-10-27T13:10:00Z" units="ISO8601">2024/2026/PT10M</Dimension></Layer>';
    expect(latestImageTime(xml)).toBe(Date.parse('2026-10-27T13:10:00Z'));
    expect(latestImageTime('<Layer/>')).toBeNull();
  });
});
