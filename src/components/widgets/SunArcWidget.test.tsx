// src/components/widgets/SunArcWidget.test.tsx
// Targeta Cicle solar ("Cel viu"): paritat del compte enrere amb el modal (també després de cada tic de minut),
// textos en els 4 idiomes, el sol a la seva hora sobre la corba real, estrelles només de nit i dies polars.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { SunArcWidget } from './SunArcWidget';
import { clearSolarDayCache } from '../../utils/solar/solarDay';
import type { Language } from '../../translations';

// Girona, 2026-10-07 (CEST, UTC+2): hores locals d'Open-Meteo (a menys de 10 min de suncalc: es fan servir).
const DAILY = {
  time: ['2026-10-07', '2026-10-08'],
  sunrise: ['2026-10-07T07:51', '2026-10-08T07:52'],
  sunset: ['2026-10-07T19:20', '2026-10-08T19:18'],
};

const renderCard = (lang: Language, extra: { lat?: number; lon?: number; daily?: typeof DAILY | undefined; timezone?: string; utcOffset?: number } = {}) =>
  render(
    <SunArcWidget
      lang={lang}
      lat={'lat' in extra ? extra.lat : 41.98}
      lon={'lon' in extra ? extra.lon : 2.82}
      timezone={extra.timezone ?? 'Europe/Madrid'}
      utcOffset={extra.utcOffset ?? 7200}
      daily={'daily' in extra ? extra.daily : DAILY}
    />,
  );

beforeEach(() => { vi.useFakeTimers(); clearSolarDayCache(); });
afterEach(() => { vi.useRealTimers(); });

describe('SunArcWidget — compte enrere (idèntic al del modal)', () => {
  it('de dia compta fins a la posta d\'avui: "3h 13m"', () => {
    vi.setSystemTime(new Date('2026-10-07T14:07:00Z'));   // 16:07 local
    renderCard('ca');
    expect(screen.getByText('Posta de sol en')).toBeTruthy();
    expect(screen.getByText('3h 13m')).toBeTruthy();
  });

  it('abans de la sortida compta fins a la sortida d\'avui, no la de demà', () => {
    vi.setSystemTime(new Date('2026-10-07T03:00:00Z'));   // 05:00 local
    renderCard('ca');
    expect(screen.getByText('Sortida en')).toBeTruthy();
    expect(screen.getByText('2h 51m')).toBeTruthy();
  });

  it('després de la posta compta fins a la sortida de DEMÀ (07:52), no la d\'avui (07:51)', () => {
    vi.setSystemTime(new Date('2026-10-07T19:30:00Z'));   // 21:30 local
    renderCard('ca');
    expect(screen.getByText('Sortida en')).toBeTruthy();
    expect(screen.getByText('10h 22m')).toBeTruthy();
  });

  it('arrodoneix cap avall: a les 21:30:59 queden 10h 21m', () => {
    vi.setSystemTime(new Date('2026-10-07T19:30:59Z'));
    renderCard('ca');
    expect(screen.getByText('10h 21m')).toBeTruthy();
  });

  it('després del tic de minut continua igual que el modal (abans marcava un minut de més)', () => {
    vi.setSystemTime(new Date('2026-10-07T14:07:30Z'));   // 16:07:30 → posta 19:20:00: 3h 12m 30s
    renderCard('ca');
    expect(screen.getByText('3h 12m')).toBeTruthy();
    // Tic a les 16:08:00.050 → queden 3h 11m 59.95s: el modal, obert en aquest minut, diu "3h 11m".
    act(() => { vi.advanceTimersByTime(30_050); });
    expect(screen.getByText('3h 11m')).toBeTruthy();
    expect(screen.queryByText('3h 12m')).toBeNull();
  });
});

describe('SunArcWidget — dades del dia', () => {
  it('sortida, posta i durada són les d\'Open-Meteo; Δ respecte d\'ahir i azimuts astronòmics', () => {
    vi.setSystemTime(new Date('2026-10-07T14:07:00Z'));
    const { container } = renderCard('ca');
    expect(screen.getByText('07:51')).toBeTruthy();
    expect(screen.getByText('19:20')).toBeTruthy();
    expect(screen.getByText('11h 29m')).toBeTruthy();
    // A l'octubre els dies s'escurcen: "−2 min … s" (i, per al lector de pantalla, "menys que ahir").
    expect(container.textContent).toMatch(/−2 min \d+ s menys que ahir/);
    expect(screen.getAllByText(/^\d+° [A-Z]+$/)).toHaveLength(3);   // azimuts de sortida, posta i del sol ara
  });

  it('sense les hores d\'Open-Meteo fa servir les astronòmiques (mai "sense dades" si hi ha coordenades)', () => {
    vi.setSystemTime(new Date('2026-10-07T14:07:00Z'));
    renderCard('ca', { daily: undefined });
    expect(screen.queryByText('SENSE DADES')).toBeNull();
    expect(screen.getByText('07:52')).toBeTruthy();   // suncalc: 07:52:03
    expect(screen.getByText('19:20')).toBeTruthy();   // suncalc: 19:20:23
  });

  it('el sol és a la seva hora sobre la corba i el tram recorregut acaba allà', () => {
    vi.setSystemTime(new Date('2026-10-07T14:07:00Z'));   // minut 967 del dia local
    const { container } = renderCard('ca');
    const marker = screen.getByTestId('sun-card-marker');
    expect(Number(marker.dataset.x)).toBeCloseTo((967 / 1440) * 400, 0);
    const pastClip = container.querySelector('clipPath[id$="p"] rect');
    expect(Number(pastClip?.getAttribute('width'))).toBeCloseTo((967 / 1440) * 400, 0);
    expect(screen.getByText(/^\+\d+°$/)).toBeTruthy();   // "Ara +NN° · azimut"
  });

  it('estrelles només quan és fosc', () => {
    vi.setSystemTime(new Date('2026-10-07T14:07:00Z'));
    const day = renderCard('ca');
    expect(day.container.querySelector('path[fill="#e2e8f0"]')).toBeNull();
    day.unmount();
    vi.setSystemTime(new Date('2026-10-07T21:00:00Z'));   // 23:00 local
    const night = renderCard('ca');
    expect(night.container.querySelector('path[fill="#e2e8f0"]')).not.toBeNull();
    expect(screen.getByText(/sota l'horitzó/)).toBeTruthy();
  });
});

describe('SunArcWidget — dies polars (Longyearbyen)', () => {
  const svalbard = { lat: 78.22, lon: 15.65, timezone: 'Europe/Oslo', daily: undefined };
  it('nit polar: cap compte enrere, sense hores i "Nit polar"', () => {
    vi.setSystemTime(new Date('2026-12-15T12:00:00Z'));
    renderCard('ca', { ...svalbard, utcOffset: 3600 });
    expect(screen.getByText('Nit polar')).toBeTruthy();
    expect(screen.getByText('0h 00m')).toBeTruthy();
    expect(screen.queryByText('Sortida en')).toBeNull();
    expect(screen.queryByText('Posta de sol en')).toBeNull();
  });

  it('sol de mitjanit: 24 h de llum', () => {
    vi.setSystemTime(new Date('2026-06-21T12:00:00Z'));
    renderCard('ca', { ...svalbard, utcOffset: 7200 });
    expect(screen.getByText('Sol de mitjanit')).toBeTruthy();
    expect(screen.getByText('24h 00m')).toBeTruthy();
  });
});

describe('SunArcWidget — idioma', () => {
  const CASES: Array<[Language, string, string, string, string, string]> = [
    ['ca', 'CICLE SOLAR', 'Posta de sol en', 'Sortida en', 'SENSE DADES', 'Llum'],
    ['es', 'CICLO SOLAR', 'Puesta de sol en', 'Salida del sol en', 'SIN DATOS', 'Luz'],
    ['en', 'SUN CYCLE', 'Sunset in', 'Sunrise in', 'NO DATA', 'Daylight'],
    ['fr', 'CYCLE SOLAIRE', 'Coucher du soleil dans', 'Lever du soleil dans', 'PAS DE DONNÉES', 'Jour'],
  ];

  it.each(CASES)('%s: títol, etiquetes del compte enrere i del peu', (lang, title, sunsetIn, sunriseIn, _noData, daylight) => {
    vi.setSystemTime(new Date('2026-10-07T14:07:00Z'));   // de dia
    const day = renderCard(lang);
    expect(screen.getByText(title)).toBeTruthy();
    expect(screen.getByText(sunsetIn)).toBeTruthy();
    expect(screen.getByText(daylight)).toBeTruthy();
    day.unmount();

    vi.setSystemTime(new Date('2026-10-07T19:30:00Z'));   // de nit
    renderCard(lang);
    expect(screen.getByText(sunriseIn)).toBeTruthy();
    expect(screen.getByText('10h 22m')).toBeTruthy();
  });

  it.each(CASES)('%s: sense coordenades, "sense dades" i cap hora inventada', (lang, title, _sunsetIn, _sunriseIn, noData) => {
    vi.setSystemTime(new Date('2026-10-07T14:07:00Z'));
    renderCard(lang, { lat: undefined, lon: undefined });
    expect(screen.getByText(noData)).toBeTruthy();
    expect(screen.getByText(title)).toBeTruthy();
    expect(screen.getAllByText('--:--')).toHaveLength(2);
    expect(screen.queryByTestId('sun-card-marker')).toBeNull();
  });
});
