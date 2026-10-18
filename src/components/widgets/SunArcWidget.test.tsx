// src/components/widgets/SunArcWidget.test.tsx
// Paritat de la targeta Cicle solar amb el modal: després de la posta el compte enrere va cap a la sortida de
// DEMÀ, i el títol i les etiquetes surten en l'idioma de l'usuari (abans: es/fr en anglès o castellà).
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SunArcWidget } from './SunArcWidget';
import type { Language } from '../../translations';

// Girona, 2026-10-07 (CEST, UTC+2): hores locals d'Open-Meteo.
const OFFSET = 7200;
const RISE = '2026-10-07T07:51';
const SET = '2026-10-07T19:20';
const NEXT_RISE = '2026-10-08T07:52';

const renderCard = (lang: Language, extra: { sunrise?: string; sunset?: string; nextSunrise?: string } = {}) =>
  render(
    <SunArcWidget
      sunrise={extra.sunrise ?? RISE}
      sunset={extra.sunset ?? SET}
      nextSunrise={extra.nextSunrise}
      lang={lang}
      utcOffset={OFFSET}
    />,
  );

describe('SunArcWidget — compte enrere', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('de dia compta fins a la posta d\'avui (mateix text que el modal: "3h 13m")', () => {
    vi.setSystemTime(new Date('2026-10-07T14:07:00Z'));   // 16:07 local
    renderCard('ca', { nextSunrise: NEXT_RISE });
    expect(screen.getByText('Posta de sol en')).toBeTruthy();
    expect(screen.getByText('3h 13m')).toBeTruthy();
  });

  it('abans de la sortida compta fins a la sortida d\'avui, no la de demà', () => {
    vi.setSystemTime(new Date('2026-10-07T03:00:00Z'));   // 05:00 local
    renderCard('ca', { nextSunrise: NEXT_RISE });
    expect(screen.getByText('Sortida en')).toBeTruthy();
    expect(screen.getByText('2h 51m')).toBeTruthy();
  });

  it('després de la posta compta fins a la sortida de DEMÀ (07:52), no la d\'avui (07:51)', () => {
    vi.setSystemTime(new Date('2026-10-07T19:30:00Z'));   // 21:30 local
    renderCard('ca', { nextSunrise: NEXT_RISE });
    expect(screen.getByText('Sortida en')).toBeTruthy();
    // 2h 30m fins a mitjanit + 7h 52m = 10h 22m (amb la d'avui serien 10h 21m).
    expect(screen.getByText('10h 22m')).toBeTruthy();
    expect(screen.queryByText('10h 21m')).toBeNull();
  });

  it('arrodoneix cap avall i sense zeros a l\'esquerra, igual que abans', () => {
    vi.setSystemTime(new Date('2026-10-07T19:30:59Z'));   // 21:30:59 local
    renderCard('ca', { nextSunrise: NEXT_RISE });
    // 37 261 s => 10h 21m (floor), no 10h 22m.
    expect(screen.getByText('10h 21m')).toBeTruthy();
  });

  it('sense la sortida de demà (o mal formada) manté el comportament antic: la sortida d\'avui', () => {
    vi.setSystemTime(new Date('2026-10-07T19:30:00Z'));
    const { unmount } = renderCard('ca');
    expect(screen.getByText('10h 21m')).toBeTruthy();
    unmount();
    renderCard('ca', { nextSunrise: 'n/a' });
    expect(screen.getByText('10h 21m')).toBeTruthy();
  });
});

describe('SunArcWidget — tram il·luminat de l\'arc', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  const litPath = (c: HTMLElement) => c.querySelector('[data-testid="sun-arc-lit"]');
  const sunXY = (c: HTMLElement) => (c.querySelector('g[style]') as SVGGElement).style.transform.match(/-?[\d.]+/g)!.map(Number);
  const pathEnd = (d: string) => d.trim().split(/[\s,]+/).slice(-2).map(Number);

  it.each([
    ['matí', '2026-10-07T07:30:00Z'],   // 09:30 local
    ['tarda', '2026-10-07T15:30:00Z'],  // 17:30 local: abans la línia anava 20 unitats per davant del sol
    ['just abans de la posta', '2026-10-07T17:10:00Z'], // 19:10 local: abans l'arc es veia sencer
  ])('%s: acaba exactament on és el sol', (_label, iso) => {
    vi.setSystemTime(new Date(iso));
    const { container } = renderCard('ca', { nextSunrise: NEXT_RISE });
    const lit = litPath(container);
    expect(lit).not.toBeNull();
    const [ex, ey] = pathEnd(lit!.getAttribute('d')!);
    const [sx, sy] = sunXY(container);
    expect(ex).toBeCloseTo(sx, 6);
    expect(ey).toBeCloseTo(sy, 6);
    expect(ex).toBeLessThan(90); // no arriba a l'horitzó de ponent
  });

  it('de nit (abans de la sortida i després de la posta) no hi ha tram il·luminat', () => {
    vi.setSystemTime(new Date('2026-10-07T03:00:00Z'));
    const before = renderCard('ca', { nextSunrise: NEXT_RISE });
    expect(litPath(before.container)).toBeNull();
    before.unmount();
    vi.setSystemTime(new Date('2026-10-07T19:30:00Z'));
    const after = renderCard('ca', { nextSunrise: NEXT_RISE });
    expect(litPath(after.container)).toBeNull();
  });
});

describe('SunArcWidget — idioma', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  const CASES: Array<[Language, string, string, string, string]> = [
    ['ca', 'CICLE SOLAR', 'Posta de sol en', 'Sortida en', 'SENSE DADES'],
    ['es', 'CICLO SOLAR', 'Puesta de sol en', 'Salida del sol en', 'SIN DATOS'],
    ['en', 'SUN CYCLE', 'Sunset in', 'Sunrise in', 'NO DATA'],
    ['fr', 'CYCLE SOLAIRE', 'Coucher du soleil dans', 'Lever du soleil dans', 'PAS DE DONNÉES'],
  ];

  it.each(CASES)('%s: títol del modal i etiquetes del compte enrere', (lang, title, sunsetIn, sunriseIn) => {
    vi.setSystemTime(new Date('2026-10-07T14:07:00Z'));   // de dia
    const day = renderCard(lang, { nextSunrise: NEXT_RISE });
    expect(screen.getByText(title)).toBeTruthy();
    expect(screen.getByText(sunsetIn)).toBeTruthy();
    day.unmount();

    vi.setSystemTime(new Date('2026-10-07T19:30:00Z'));   // de nit
    renderCard(lang, { nextSunrise: NEXT_RISE });
    expect(screen.getByText(sunriseIn)).toBeTruthy();
    expect(screen.getByText('10h 22m')).toBeTruthy();
  });

  it.each(CASES)('%s: text sense dades', (lang, title, _sunsetIn, _sunriseIn, noData) => {
    vi.setSystemTime(new Date('2026-10-07T14:07:00Z'));
    renderCard(lang, { sunrise: '', sunset: '' });
    expect(screen.getByText(noData)).toBeTruthy();
    expect(screen.getByText(title)).toBeTruthy();
    expect(screen.getByText('--h --m')).toBeTruthy();
  });

  it('un idioma desconegut cau al català', () => {
    vi.setSystemTime(new Date('2026-10-07T14:07:00Z'));
    renderCard('xx' as Language);
    expect(screen.getByText('CICLE SOLAR')).toBeTruthy();
    expect(screen.getByText('Posta de sol en')).toBeTruthy();
  });
});
