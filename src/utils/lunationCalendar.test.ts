// src/utils/lunationCalendar.test.ts
// El calendari de la lunació del modal Fase lunar (Barcelona, 23-11-2026 19:26 CET): la lunació d'ara (9-11 → 9-12),
// fins on es pot navegar, les etiquetes de les fases, la plena amb el seu nom i la superlluna de la lunació següent.
import { describe, it, expect } from 'vitest';
import { buildLunationView, lunationRangeLabel, weekdayInitials } from './lunationCalendar';

const NOW = Date.parse('2026-11-23T18:26:00Z');
const base = {
  nowMs: NOW, liveDate: '2026-11-23', viewDate: '2026-11-23', isToday: true,
  timezone: 'Europe/Madrid', utcOffsetSec: 3600, lat: 41.38879, lon: 2.15899, lang: 'ca' as const,
};

describe('buildLunationView', () => {
  it('avui: la lunació del 9-11 al 9-12, de 29 dies i 18 h, i es pot anar del 9-11 al 7-1', () => {
    const v = buildLunationView(base)!;
    expect(v.first).toBe('2026-11-09');
    expect(v.last).toBe('2026-12-09');
    expect(v.days).toHaveLength(31);
    expect(v.lead).toBe(0);                     // el 9-11-2026 és dilluns
    expect([v.lengthD, v.lengthH]).toEqual([29, 18]);
    expect(v.minOffset).toBe(-14);
    expect(v.maxOffset).toBe(45);               // lluna nova del 7-1-2027
    expect(v.gridIsNext).toBe(false);
    expect(lunationRangeLabel(v, 'ca-ES')).toMatch(/^9 de nov\. – 9 de des\.$/);
  });

  it('les etiquetes de les fases cauen al seu dia local', () => {
    const tags = buildLunationView(base)!.days.filter(d => d.tag).map(d => `${d.dateStr} ${d.tag}`);
    expect(tags).toEqual(['2026-11-09 new', '2026-11-17 fq', '2026-11-24 full', '2026-12-01 lq', '2026-12-09 new']);
  });

  it('les fases a l\'hora local, la plena amb el seu nom; la de desembre, superlluna', () => {
    const v = buildLunationView(base)!;
    const full = v.phases.find(p => p.key === 'full')!;
    expect(full.dateStr).toBe('2026-11-24');
    expect(full.time).toMatch(/^15:5\d$/);
    expect(full.folk).toBe('Lluna del Castor');
    expect(full.superMoon).toBe(false);
    expect(v.phases.filter(p => p.past).map(p => p.key)).toEqual(['new0', 'fq']);
    expect(v.nextFull).toMatchObject({ dateStr: '2026-12-24', folk: 'Lluna Freda', superMoon: true, offset: 31 });
    expect(v.folkName).toBe('Lluna del Castor');   // la plena és demà
  });

  it('un dia de la lunació següent: el calendari passa a ser aquella i ja no hi ha enllaç a la següent', () => {
    const v = buildLunationView({ ...base, viewDate: '2026-12-24', isToday: false })!;
    expect(v.gridIsNext).toBe(true);
    expect(v.first).toBe('2026-12-09');
    expect(v.nextFull).toBeNull();
    expect(v.folkName).toBe('Lluna Freda');
  });

  it('a l\'hemisferi sud, sense noms tradicionals', () => {
    const v = buildLunationView({ ...base, lat: -34.6, lon: -58.38, timezone: 'America/Argentina/Buenos_Aires', utcOffsetSec: -10800 })!;
    expect(v.phases.every(p => p.folk === null)).toBe(true);
    expect(v.folkName).toBeNull();
  });

  it('sense coordenades vàlides, res', () => {
    expect(buildLunationView({ ...base, lat: NaN })).toBeNull();
  });
});

describe('weekdayInitials', () => {
  it('de dilluns a diumenge, en cada idioma', () => {
    expect(weekdayInitials('ca-ES')).toEqual(['dl', 'dt', 'dc', 'dj', 'dv', 'ds', 'dg']);
    expect(weekdayInitials('en-GB')).toEqual(['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su']);
    expect(weekdayInitials('es-ES')[0]).toBe('lu');
    expect(weekdayInitials('fr-FR')[6]).toBe('di');
  });
});
