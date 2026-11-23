// src/components/sky/SunPanel.test.tsx
// Plafó «El sol» (la targeta «Cel viu» d'abans): paritat del compte enrere amb el modal (també després de cada tic de
// minut), la xifra gran de dia, les hores i la Δ del dia, el sol a la seva hora sobre la corba real, estrelles només de
// nit, hora daurada i nit fosca, dies polars i textos en els 4 idiomes.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, act, fireEvent } from '@testing-library/react';
import { SunPanel } from './SunPanel';
import { clearSolarDayCache } from '../../utils/solar/solarDay';
import type { Language } from '../../translations';
import type { SkyKind } from '../../utils/daySky';

// Girona, 2026-10-07 (CEST, UTC+2): hores locals d'Open-Meteo (a menys de 10 min de suncalc: es fan servir).
const DAILY = {
  time: ['2026-10-07', '2026-10-08'],
  sunrise: ['2026-10-07T07:51', '2026-10-08T07:52'],
  sunset: ['2026-10-07T19:20', '2026-10-08T19:18'],
};

type Extra = { lat?: number; lon?: number; daily?: typeof DAILY | undefined; timezone?: string; utcOffset?: number; hero?: boolean; onOpen?: () => void };
const renderPanel = (lang: Language, extra: Extra = {}) =>
  render(
    <SunPanel
      lang={lang}
      lat={'lat' in extra ? extra.lat : 41.98}
      lon={'lon' in extra ? extra.lon : 2.82}
      timezone={extra.timezone ?? 'Europe/Madrid'}
      utcOffset={extra.utcOffset ?? 7200}
      daily={'daily' in extra ? extra.daily : DAILY}
      hero={extra.hero}
      onOpen={extra.onOpen}
      label="Cicle solar · Detall"
    />,
  );

beforeEach(() => { vi.useFakeTimers(); clearSolarDayCache(); });
afterEach(() => { vi.useRealTimers(); });

describe('SunPanel — compte enrere (idèntic al del modal)', () => {
  it('de dia compta fins a la posta d\'avui: "3h 13m"', () => {
    vi.setSystemTime(new Date('2026-10-07T14:07:00Z'));   // 16:07 local
    renderPanel('ca');
    expect(screen.getByText('Posta de sol en')).toBeTruthy();
    expect(screen.getByText('3h 13m')).toBeTruthy();
  });

  it('de dia, com a primer plafó, el compte enrere és la xifra gran i diu on és el sol', () => {
    vi.setSystemTime(new Date('2026-10-07T14:07:00Z'));
    const { container } = renderPanel('ca', { hero: true });
    expect(screen.getByText("Es pon d'aquí a")).toBeTruthy();
    expect(screen.getByText('3h 13m')).toBeTruthy();
    expect(screen.queryByText('Posta de sol en')).toBeNull();
    expect(container.textContent).toMatch(/Hora daurada des de les 18:\d\d\. Ara, a \d+° · \d+° [A-Z]+\./);
  });

  it('abans de la sortida compta fins a la sortida d\'avui, no la de demà (i mai és la xifra gran)', () => {
    vi.setSystemTime(new Date('2026-10-07T03:00:00Z'));   // 05:00 local
    renderPanel('ca', { hero: true });
    expect(screen.getByText('Sortida en')).toBeTruthy();
    expect(screen.getByText('2h 51m')).toBeTruthy();
    expect(screen.queryByText("Es pon d'aquí a")).toBeNull();
  });

  it('després de la posta compta fins a la sortida de DEMÀ (07:52), no la d\'avui (07:51)', () => {
    vi.setSystemTime(new Date('2026-10-07T19:30:00Z'));   // 21:30 local
    renderPanel('ca');
    expect(screen.getByText('Sortida en')).toBeTruthy();
    expect(screen.getByText('10h 22m')).toBeTruthy();
  });

  it('arrodoneix cap avall: a les 21:30:59 queden 10h 21m', () => {
    vi.setSystemTime(new Date('2026-10-07T19:30:59Z'));
    renderPanel('ca');
    expect(screen.getByText('10h 21m')).toBeTruthy();
  });

  it('després del tic de minut continua igual que el modal', () => {
    vi.setSystemTime(new Date('2026-10-07T14:07:30Z'));   // 16:07:30 → posta 19:20:00: 3h 12m 30s
    renderPanel('ca');
    expect(screen.getByText('3h 12m')).toBeTruthy();
    act(() => { vi.advanceTimersByTime(30_050); });
    expect(screen.getByText('3h 11m')).toBeTruthy();
    expect(screen.queryByText('3h 12m')).toBeNull();
  });
});

describe('SunPanel — dades del dia', () => {
  it('sortida, posta i durada són les d\'Open-Meteo; Δ respecte d\'ahir i azimuts astronòmics', () => {
    vi.setSystemTime(new Date('2026-10-07T14:07:00Z'));
    const { container } = renderPanel('ca');
    expect(screen.getByText('07:51')).toBeTruthy();
    expect(screen.getByText('19:20')).toBeTruthy();
    expect(screen.getByText('11h 29m')).toBeTruthy();
    expect(container.textContent).toMatch(/−2 min \d+ s menys que ahir/);
    expect(screen.getAllByText(/^\d+° [A-Z]+$/)).toHaveLength(2);   // azimuts de sortida i posta
  });

  it('sense les hores d\'Open-Meteo fa servir les astronòmiques (mai "sense dades" si hi ha coordenades)', () => {
    vi.setSystemTime(new Date('2026-10-07T14:07:00Z'));
    renderPanel('ca', { daily: undefined });
    expect(screen.queryByText('Sense dades')).toBeNull();
    expect(screen.getByText('07:52')).toBeTruthy();
    expect(screen.getByText('19:20')).toBeTruthy();
  });

  it('el sol és a la seva hora sobre la corba i el tram recorregut acaba allà', () => {
    vi.setSystemTime(new Date('2026-10-07T14:07:00Z'));   // minut 967 del dia local
    const { container } = renderPanel('ca');
    const marker = screen.getByTestId('sun-card-marker');
    expect(Number(marker.dataset.x)).toBeCloseTo((967 / 1440) * 400, 0);
    const pastClip = container.querySelector('clipPath[id$="p"] rect');
    expect(Number(pastClip?.getAttribute('width'))).toBeCloseTo((967 / 1440) * 400, 0);
  });

  it('estrelles només quan és fosc', () => {
    vi.setSystemTime(new Date('2026-10-07T14:07:00Z'));
    const day = renderPanel('ca');
    expect(day.container.querySelector('path[fill="#e2e8f0"]')).toBeNull();
    day.unmount();
    vi.setSystemTime(new Date('2026-10-07T21:00:00Z'));   // 23:00 local
    const night = renderPanel('ca');
    expect(night.container.querySelector('path[fill="#e2e8f0"]')).not.toBeNull();
  });

  it('de dia, l\'hora daurada d\'aquesta tarda i la nit fosca; de nit, la de demà i quan clareja', () => {
    vi.setSystemTime(new Date('2026-10-07T14:07:00Z'));
    const day = renderPanel('ca', { hero: true });
    expect(day.container.textContent).toMatch(/Hora daurada18:\d\d – 19:\d\d/);
    expect(day.container.textContent).toMatch(/Nit fosca20:\d\d/);
    day.unmount();
    vi.setSystemTime(new Date('2026-10-07T21:00:00Z'));
    const night = renderPanel('ca');
    expect(night.container.textContent).toMatch(/Hora dauradademà 07:\d\d – 08:\d\d/);
    expect(night.container.textContent).toMatch(/Clareja07:\d\d/);
  });

  it('tot el plafó obre el modal Cicle solar (clic i teclat)', () => {
    vi.setSystemTime(new Date('2026-10-07T14:07:00Z'));
    const onOpen = vi.fn();
    renderPanel('ca', { onOpen });
    const button = screen.getByRole('button', { name: 'Cicle solar · Detall' });
    fireEvent.click(button);
    fireEvent.keyDown(button, { key: 'Enter' });
    expect(onOpen).toHaveBeenCalledTimes(2);
  });
});

describe('SunPanel — dies polars (Longyearbyen)', () => {
  const svalbard = { lat: 78.22, lon: 15.65, timezone: 'Europe/Oslo', daily: undefined };
  it('nit polar: cap compte enrere, sense hores i "Nit polar"', () => {
    vi.setSystemTime(new Date('2026-12-15T12:00:00Z'));
    renderPanel('ca', { ...svalbard, utcOffset: 3600, hero: true });
    expect(screen.getByText('Nit polar')).toBeTruthy();
    expect(screen.getByText('0h 00m')).toBeTruthy();
    expect(screen.queryByText('Sortida en')).toBeNull();
    expect(screen.queryByText("Es pon d'aquí a")).toBeNull();
  });

  it('sol de mitjanit: 24 h de llum', () => {
    vi.setSystemTime(new Date('2026-06-21T12:00:00Z'));
    renderPanel('ca', { ...svalbard, utcOffset: 7200 });
    expect(screen.getByText('Sol de mitjanit')).toBeTruthy();
    expect(screen.getByText('24h 00m')).toBeTruthy();
  });
});

describe('SunPanel — idioma', () => {
  const CASES: Array<[Language, string, string, string, string, string]> = [
    ['ca', 'El sol', 'Posta de sol en', 'Sortida en', 'Sense dades', 'Llum'],
    ['es', 'El sol', 'Puesta de sol en', 'Salida del sol en', 'Sin datos', 'Luz'],
    ['en', 'The sun', 'Sunset in', 'Sunrise in', 'No data', 'Daylight'],
    ['fr', 'Le soleil', 'Coucher du soleil dans', 'Lever du soleil dans', 'Pas de données', 'Jour'],
  ];

  it.each(CASES)('%s: títol, compte enrere i etiquetes del peu', (lang, title, sunsetIn, sunriseIn, noData, daylight) => {
    vi.setSystemTime(new Date('2026-10-07T14:07:00Z'));
    const day = renderPanel(lang);
    expect(screen.getByText(title)).toBeTruthy();
    expect(screen.getByText(sunsetIn)).toBeTruthy();
    expect(screen.getByText(daylight)).toBeTruthy();
    day.unmount();
    vi.setSystemTime(new Date('2026-10-07T19:30:00Z'));
    const night = renderPanel(lang);
    expect(screen.getByText(sunriseIn)).toBeTruthy();
    night.unmount();
    renderPanel(lang, { lat: undefined, lon: undefined });
    expect(screen.getByText(noData)).toBeTruthy();
  });
});

describe('SunPanel — núvols del dia', () => {
  // Girona, 7-10-2026: serè fins a les 14 h, núvol de 14 a 18 h i pluja a les 18 h (de dia de 8 a 19 h).
  const kindAt = (h: number) => (h < 14 ? 'clear' : h < 18 ? 'cloudy' : h === 18 ? 'rain' : 'partly');
  const daySky = { '2026-10-07': Array.from({ length: 24 }, (_, hour) => ({ hour, kind: kindAt(hour) as SkyKind, isDay: hour >= 8 && hour < 19 })) };

  it('la franja de núvols, la llegenda amb els colors del dia i el sol puntejat on queda tapat', () => {
    vi.setSystemTime(new Date('2026-10-07T10:00:00Z'));   // 12:00 local
    const { container } = render(
      <SunPanel lang="ca" lat={41.98} lon={2.82} timezone="Europe/Madrid" utcOffset={7200} daily={DAILY} daySky={daySky} hero />,
    );
    expect(container.textContent).toContain('Núvols');
    expect(container.textContent).toMatch(/solnúvolplujanites veutapat/);
    // Una capa puntejada, retallada a les hores de dia tapades (14-19 h).
    const dashed = container.querySelectorAll('path[stroke-dasharray="3 3"]');
    expect(dashed.length).toBeGreaterThan(0);
    const hiddenClip = container.querySelector('clipPath[id$="h"] rect');
    expect(Number(hiddenClip?.getAttribute('x'))).toBeCloseTo((14 / 24) * 400, 0);
  });

  it('sense previsió del cel, cap franja de núvols i la corba contínua', () => {
    vi.setSystemTime(new Date('2026-10-07T10:00:00Z'));
    const { container } = renderPanel('ca');
    expect(container.textContent).not.toContain('Núvols');
    expect(container.querySelector('path[stroke-dasharray="3 3"]')).toBeNull();
  });
});
