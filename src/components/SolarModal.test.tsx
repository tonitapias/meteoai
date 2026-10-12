import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act, within } from '@testing-library/react';
import SolarModal from './SolarModal';
import type { ExtendedWeatherData } from '../types/weatherLogicTypes';
import { clearSolarDayCache } from '../utils/solar/solarDay';
import { registerSolarSkeleton } from './solar/preloadSolarModal';

/** Girona, 8 dies de daily d'Open-Meteo des del 2026-10-07 (hores locals de Madrid). */
const SUNRISE = ['07:51', '07:52', '07:53', '07:54', '07:55', '07:56', '07:57', '07:58'];
const SUNSET = ['19:20', '19:18', '19:17', '19:15', '19:13', '19:12', '19:10', '19:08'];
const DATES = SUNRISE.map((_, i) => `2026-10-${String(7 + i).padStart(2, '0')}`);

type FixtureOpts = Partial<{ lat: number; lon: number; name: string; tz: string; offset: number; dates: string[]; noDaily: boolean }>;

const gironaWeather = (over: FixtureOpts = {}): ExtendedWeatherData => {
  const dates = over.dates ?? DATES;
  const hourlyTime: string[] = [];
  for (const d of dates.slice(0, 2)) for (let h = 0; h < 24; h++) hourlyTime.push(`${d}T${String(h).padStart(2, '0')}:00`);
  return {
    location: { name: over.name ?? 'Girona', latitude: over.lat ?? 41.98, longitude: over.lon ?? 2.82 },
    timezone: over.tz ?? 'Europe/Madrid',
    utc_offset_seconds: over.offset ?? 7200,
    current: { time: '2026-10-07T16:00' },
    hourly: {
      time: hourlyTime,
      cloud_cover_mid: hourlyTime.map(() => 40),
      cloud_cover_high: hourlyTime.map(() => 50),
      relative_humidity_2m: hourlyTime.map(() => 60),
    },
    daily: over.noDaily ? undefined : {
      time: dates,
      sunrise: dates.map((d, i) => `${d}T${SUNRISE[i] ?? '07:59'}`),
      sunset: dates.map((d, i) => `${d}T${SUNSET[i] ?? '19:07'}`),
      uv_index_max: [5.45, 4.9, 5.1, 3.2, 4.4, 4.75, 2.9, 4.0].slice(0, dates.length),
      uv_index_clear_sky_max: dates.map(() => 6.1),
      sunshine_duration: dates.map(() => 23160),
      shortwave_radiation_sum: dates.map(() => 14.2),
      temperature_2m_max: dates.map(() => 22),
      temperature_2m_min: dates.map(() => 12),
    },
  } as unknown as ExtendedWeatherData;
};

const renderModal = (w: ExtendedWeatherData = gironaWeather(), lang: string = 'ca', onClose: () => void = () => {}) =>
  render(<SolarModal weatherData={w} onClose={onClose} lang={lang as never} />);

beforeEach(() => {
  clearSolarDayCache();
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-10-07T14:07:00Z'));   // 16:07 a Girona
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

const slider = () => screen.getByRole('slider');
const next = () => screen.getByRole('button', { name: 'Dia següent' });
const heroText = (c: HTMLElement) => c.querySelector('.sm-hero')!.textContent ?? '';
/** Text del dia del navegador (la data llarga o curta, regió viva). */
const navDate = (c: HTMLElement) => c.querySelector('.sm-a-nav [aria-live]')!.textContent ?? '';
const advance = (ms: number) => act(() => { vi.advanceTimersByTime(ms); });

// Mateix selector que useDialogFocus.
const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';
const focusOrder = (dialog: HTMLElement) => [...dialog.querySelectorAll<HTMLElement>(FOCUSABLE)]
  .filter(el => el !== dialog)
  .map(el => (el.getAttribute('role') === 'slider' ? 'slider' : el.classList.contains('sm-arow') ? 'row' : el.getAttribute('aria-label')));

describe('SolarModal — diàleg, focus i idiomes', () => {
  it('diàleg "Cicle solar", botó Tanca i Escape', () => {
    const onClose = vi.fn();
    renderModal(gironaWeather(), 'ca', onClose);
    expect(screen.getByRole('dialog', { name: 'Cicle solar' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Tanca' })).toBeInTheDocument();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('focus inicial a Tanca, ordre de tabulació i retorn del focus a qui l\'ha obert', () => {
    const opener = document.createElement('button');
    opener.textContent = 'Targeta';
    document.body.appendChild(opener);
    opener.focus();
    const { unmount } = renderModal();
    const dialog = screen.getByRole('dialog');
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Tanca' }));
    advance(300);
    expect(focusOrder(dialog)).toEqual(['Tanca', 'Dia anterior', 'Dia següent', 'slider', ...Array(15).fill('row')]);
    // Amb un minut fixat apareix la píndola de tornada (abans del control, com al marcatge).
    fireEvent.keyDown(slider(), { key: 'ArrowRight' });
    expect(focusOrder(dialog).slice(0, 5)).toEqual(['Tanca', 'Dia anterior', 'Dia següent', "Ara, torna a l'hora actual", 'slider']);
    // Un altre dia: la píndola "Avui" va entre les dues fletxes.
    fireEvent.click(next());
    expect(focusOrder(dialog).slice(0, 4)).toEqual(['Tanca', 'Dia anterior', 'Torna a avui', 'Dia següent']);
    unmount();
    expect(document.activeElement).toBe(opener);
    opener.remove();
  });

  it('idiomes: fr "Cycle solaire"; un idioma desconegut cau al català', () => {
    const { unmount } = renderModal(gironaWeather(), 'fr');
    expect(screen.getByRole('dialog', { name: 'Cycle solaire' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Fermer' })).toBeInTheDocument();
    unmount();
    renderModal(gironaWeather(), 'xx');
    expect(screen.getByRole('dialog', { name: 'Cicle solar' })).toBeInTheDocument();
  });

  it('coordenades no vàlides: text de manca de dades i cap control lliscant', () => {
    renderModal(gironaWeather({ lat: NaN }));
    expect(screen.getByText("No hi ha prou dades d'ubicació per calcular el cicle solar.")).toBeInTheDocument();
    expect(screen.queryByRole('slider')).toBeNull();
    expect(screen.getByRole('button', { name: 'Tanca' })).toBeInTheDocument();
  });

  it('sense l\'esquelet el modal fa l\'entrada; si pren el relleu de l\'esquelet, ni el full ni el vel la repeteixen', () => {
    const first = renderModal();
    expect(screen.getByRole('dialog')).not.toHaveAttribute('data-enter');
    first.unmount();
    // L'esquelet encara és a la pantalla quan arriba el codi (per molt que hagi trigat): el modal en pren el
    // relleu sense tornar a animar el full ni el vel opac (si no, el tauler de sota s'entreveuria).
    const unregister = registerSolarSkeleton();
    const second = renderModal();
    expect(screen.getByRole('dialog')).toHaveAttribute('data-enter', 'none');
    second.unmount();
    unregister();
    // Obertures posteriors (codi ja a memòria, sense esquelet): entrada normal.
    renderModal();
    expect(screen.getByRole('dialog')).not.toHaveAttribute('data-enter');
  });
});

describe('SolarModal — avui a Girona (2026-10-07 16:07)', () => {
  it('heroi amb les hores d\'Open-Meteo, compte enrere idèntic a la targeta i "Pròxim"', () => {
    const { container } = renderModal();
    const hero = heroText(container);
    expect(hero).toContain('07:51');
    expect(hero).toContain('19:20');
    expect(hero).not.toContain('07:52');
    expect(hero).toContain('Posta de sol en 3h 13m');
    expect(hero).toContain('Pròxim:');
    expect(hero).toContain('18:43');
    expect(hero).toContain('11h 29m de llum');
    expect(container.querySelector('.sm-sheet')).toHaveAttribute('data-theme', 'day');
  });

  it('el rellotge de 30 s avança el compte enrere i el control; un minut fixat no es mou', () => {
    const { container } = renderModal();
    advance(60_000);
    expect(heroText(container)).toContain('Posta de sol en 3h 12m');
    expect(slider()).toHaveAttribute('aria-valuenow', '968');
    fireEvent.keyDown(slider(), { key: 'ArrowRight' });
    expect(slider()).toHaveAttribute('aria-valuenow', '975');
    advance(120_000);
    expect(slider()).toHaveAttribute('aria-valuenow', '975');
    expect(heroText(container)).toContain('Posta de sol en 3h 10m');
  });

  it('el gràfic (SVG) hi és des del primer render, amb els punts de sortida i posta', () => {
    const { container } = renderModal();
    expect(container.querySelector('.sm-plot svg')).not.toBeNull();
    expect(container.querySelector('[data-testid=sm-rise-marker]')).not.toBeNull();
    expect(container.querySelector('[data-testid=sm-set-marker]')).not.toBeNull();
    expect(slider()).toHaveAttribute('aria-valuenow', '967');
    expect(slider()).toHaveAttribute('aria-valuemax', '1440');
    expect(slider().getAttribute('aria-valuetext')).toMatch(/^16:07, azimut 2\d\d° SO, alçada \+3\d°, Ple dia$/);
    // La lectura imperativa també està pintada: hora, etiqueta i marcador col·locat.
    expect(container.querySelector('.sm-time')!.textContent).toBe('16:07');
    expect(container.querySelector('.sm-tag')!.textContent).toBe('Ara');
    expect((container.querySelector('.sm-marker') as HTMLElement).style.transform).toMatch(/^translate\(/);
  });

  it('teclat del control lliscant: fletxa, Re Pàg, Inici, Fi (24:00) i píndola de tornada', () => {
    renderModal();
    expect(screen.queryByRole('button', { name: "Ara, torna a l'hora actual" })).toBeNull();
    fireEvent.keyDown(slider(), { key: 'ArrowRight' });
    expect(slider()).toHaveAttribute('aria-valuenow', '975');
    expect(slider().getAttribute('aria-valuetext')).toContain('16:15');
    expect(screen.getByRole('button', { name: "Ara, torna a l'hora actual" })).toBeInTheDocument();
    fireEvent.keyDown(slider(), { key: 'PageUp' });
    expect(slider()).toHaveAttribute('aria-valuenow', '1020');
    fireEvent.keyDown(slider(), { key: 'Home' });
    expect(slider()).toHaveAttribute('aria-valuenow', '0');
    fireEvent.keyDown(slider(), { key: 'End' });
    expect(slider()).toHaveAttribute('aria-valuenow', '1440');
    expect(slider().getAttribute('aria-valuetext')).toContain('24:00');
    fireEvent.click(screen.getByRole('button', { name: "Ara, torna a l'hora actual" }));
    expect(slider()).toHaveAttribute('aria-valuenow', '967');
    expect(document.activeElement).toBe(slider());
    expect(screen.queryByRole('button', { name: "Ara, torna a l'hora actual" })).toBeNull();
  });

  it('previsió d\'avui: UV 5.5 ALT, cel serè 6.1, hores de sol, radiació i qualitat /100', () => {
    const { container } = renderModal();
    const fc = container.querySelector('.sm-a-fc')!;
    expect(fc.textContent).toContain('5.5');
    expect(fc.textContent).toContain('Amb cel serè: 6.1');
    expect(fc.textContent).toContain('6h 26m');
    expect(fc.textContent).toContain('14.2 MJ/m²');
    expect(fc.textContent).toContain('/100');
    expect(fc.textContent).toContain('Estimació');
  });

  it('efemèrides: migdia, sortida/posta, hora daurada i blava', () => {
    const { container } = renderModal();
    const eph = container.querySelector('.sm-a-eph')!;
    expect(eph.textContent).toContain('13:36');
    expect(eph.textContent).toContain('07:34–08:29');
    expect(eph.textContent).toContain('18:43–19:37');
    expect(eph.textContent).toContain('07:24–07:34');
    expect(eph.textContent).toContain('19:37–19:48');
    expect(within(eph as HTMLElement).getByRole('table')).toBeInTheDocument();
  });

  it('nota de fonts: coordenades i fus de la ubicació, i horitzó d\'Open-Meteo', () => {
    const { container } = renderModal();
    const foot = container.querySelector('.sm-a-foot')!.textContent ?? '';
    expect(foot).toContain('41.98°\u00A0N 2.82°\u00A0E (Europe/Madrid)');   // cap coordenada es parteix
    expect(foot).toContain('Open-Meteo');
  });
});

describe('SolarModal — hores clau del dia', () => {
  it('18:50: hora daurada del vespre "ara" i la posta "pròxima" a les efemèrides', () => {
    vi.setSystemTime(new Date('2026-10-07T16:50:00Z'));
    const { container } = renderModal();
    const eph = container.querySelector('.sm-a-eph') as HTMLElement;
    const cur = eph.querySelectorAll('.sm-c-cur');
    const nxt = eph.querySelectorAll('.sm-c-next');
    expect([...cur].map(e => e.textContent).join('|')).toContain('18:43–19:37');
    expect([...nxt].map(e => e.textContent).join('|')).toContain('19:20');
    expect(nxt[0].textContent).toContain('pròxim');
    expect(eph.querySelectorAll('.sm-c-past').length).toBeGreaterThan(0);
  });

  it('19:00: el "Pròxim" coincidiria amb la posta del compte enrere i s\'amaga', () => {
    vi.setSystemTime(new Date('2026-10-07T17:00:00Z'));
    const { container } = renderModal();
    expect(heroText(container)).toContain('Posta de sol en 0h 20m');
    expect(heroText(container)).not.toContain('Pròxim');
  });

  it('21:30: tema de nit, compte enrere a la sortida real de demà i "Pròxim" al crepuscle de demà', () => {
    vi.setSystemTime(new Date('2026-10-07T19:30:00Z'));
    const { container } = renderModal();
    expect(container.querySelector('.sm-sheet')).toHaveAttribute('data-theme', 'night');
    const hero = heroText(container);
    expect(hero).toContain('Sortida en 10h 22m');   // 21:30 → 07:52 (Open-Meteo de demà)
    expect(hero).toContain('Pròxim: inici del crepuscle astronòmic · 06:20');
  });
});

describe('SolarModal — navegació per dies', () => {
  it('Anterior desactivat avui, 14 dies endavant com a màxim i el focus no es perd', () => {
    renderModal();
    expect(screen.getByRole('button', { name: 'Dia anterior' })).toHaveAttribute('aria-disabled', 'true');
    const btn = next();
    btn.focus();
    for (let i = 0; i < 14; i++) fireEvent.click(btn);
    expect(btn).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByText("D'aquí a 14 dies")).toBeInTheDocument();
    expect(document.activeElement).toBe(btn);
    fireEvent.click(btn);   // ja al límit: no fa res
    expect(screen.getByText("D'aquí a 14 dies")).toBeInTheDocument();
  });

  it('←/→ de finestra canvien de dia amb el focus al body, però no des del control lliscant ni amb modificadors', () => {
    renderModal();
    (document.activeElement as HTMLElement | null)?.blur();
    fireEvent.keyDown(document.body, { key: 'ArrowRight' });
    expect(screen.getByText('Demà')).toBeInTheDocument();
    fireEvent.keyDown(document.body, { key: 'ArrowLeft' });
    expect(screen.getByText('Avui', { selector: '.sm-eyebrow' })).toBeInTheDocument();
    fireEvent.keyDown(document.body, { key: 'ArrowRight', shiftKey: true });
    expect(screen.queryByText('Demà')).toBeNull();
    slider().focus();
    fireEvent.keyDown(slider(), { key: 'ArrowRight' });
    expect(screen.queryByText('Demà')).toBeNull();
    expect(slider()).toHaveAttribute('aria-valuenow', '975');
  });

  it('un altre dia: migdia solar i alçada màxima a l\'heroi; la píndola "Avui" torna i deixa el focus a la data', () => {
    const { container } = renderModal();
    fireEvent.click(next());
    expect(screen.getByText('Demà')).toBeInTheDocument();
    expect(heroText(container)).toContain('07:52');
    expect(heroText(container)).toContain('Migdia solar');
    expect(heroText(container)).not.toContain('Posta de sol en');
    expect(slider().getAttribute('aria-valuetext')).toMatch(/^13:3\d,/);   // en un altre dia, el migdia solar
    expect(container.querySelector('.sm-tag')!.textContent).toBe('Migdia');
    fireEvent.click(screen.getByRole('button', { name: 'Torna a avui' }));
    expect(screen.getByText('Avui', { selector: '.sm-eyebrow' })).toBeInTheDocument();
    expect(document.activeElement).toBe(container.querySelector('.sm-a-nav [aria-live]'));
    expect(heroText(container)).toContain('Posta de sol en 3h 13m');
  });

  it('el migdia solar diu el mateix minut a l\'heroi, a les efemèrides, a la lectura i a l\'aria (migdia a :30 s o més)', () => {
    // 2026-10-13 a Girona: migdia a les 13:34:58. Abans la lectura arrodonia (13:35) i l'heroi truncava (13:34).
    const { container } = renderModal();
    for (let i = 0; i < 6; i++) fireEvent.click(next());
    expect(heroText(container)).toContain('Migdia solar 13:34');
    expect(container.querySelector('.sm-a-eph')!.textContent).toContain('13:34 · ');
    expect(container.querySelector('.sm-time')!.textContent).toBe('13:34');
    expect(slider().getAttribute('aria-valuetext')).toMatch(/^13:34,/);
  });

  it('←/→ de finestra amb el focus a la píndola "Avui" (que desapareix): el focus passa a la data, no al body', () => {
    const { container } = renderModal();
    fireEvent.click(next());
    const pill = screen.getByRole('button', { name: 'Torna a avui' });
    pill.focus();
    fireEvent.keyDown(pill, { key: 'ArrowLeft' });
    expect(screen.getByText('Avui', { selector: '.sm-eyebrow' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Torna a avui' })).toBeNull();
    expect(document.activeElement).toBe(container.querySelector('.sm-a-nav [aria-live]'));
  });

  it('el minut fixat es descarta en canviar de dia', () => {
    renderModal();
    fireEvent.keyDown(slider(), { key: 'PageUp' });
    expect(slider()).toHaveAttribute('aria-valuenow', '1020');
    fireEvent.click(next());
    fireEvent.click(screen.getByRole('button', { name: 'Dia anterior' }));
    expect(slider()).toHaveAttribute('aria-valuenow', '967');
    expect(screen.queryByRole('button', { name: "Ara, torna a l'hora actual" })).toBeNull();
  });

  it('lliscament horitzontal sobre el modal canvia de dia; si comença al gràfic, no', () => {
    const { container } = renderModal();
    const scroller = container.querySelector('.sm-scroll') as HTMLElement;
    const hero = container.querySelector('.sm-hero') as HTMLElement;
    fireEvent.touchStart(hero, { touches: [{ clientX: 300, clientY: 200 }] });
    fireEvent.touchEnd(hero, { changedTouches: [{ clientX: 150, clientY: 215 }] });
    expect(screen.getByText('Demà')).toBeInTheDocument();
    fireEvent.touchStart(scroller, { touches: [{ clientX: 100, clientY: 200 }] });
    fireEvent.touchEnd(scroller, { changedTouches: [{ clientX: 260, clientY: 200 }] });
    expect(screen.getByText('Avui', { selector: '.sm-eyebrow' })).toBeInTheDocument();
    fireEvent.touchStart(slider(), { touches: [{ clientX: 300, clientY: 200 }] });
    fireEvent.touchEnd(slider(), { changedTouches: [{ clientX: 150, clientY: 200 }] });
    expect(screen.queryByText('Demà')).toBeNull();
    // Massa vertical: és un scroll, no un canvi de dia.
    fireEvent.touchStart(hero, { touches: [{ clientX: 300, clientY: 100 }] });
    fireEvent.touchEnd(hero, { changedTouches: [{ clientX: 200, clientY: 300 }] });
    expect(screen.queryByText('Demà')).toBeNull();
  });

  it('el calendari es munta diferit; tocar una fila canvia de dia i torna a dalt', () => {
    const { container } = renderModal();
    expect(container.querySelector('.sm-arow')).toBeNull();
    expect(container.querySelector('.sm-alm-ph')).not.toBeNull();
    advance(300);
    const rows = container.querySelectorAll<HTMLButtonElement>('.sm-arow');
    expect(rows.length).toBe(15);
    expect(rows[0]).toHaveAttribute('aria-pressed', 'true');
    expect(rows[0]).toHaveAttribute('aria-current', 'date');
    expect(rows[0].getAttribute('aria-label')).toMatch(/^Avui, /);
    const scroller = container.querySelector('.sm-scroll') as HTMLElement;
    scroller.scrollTop = 500;
    fireEvent.click(rows[3], { detail: 1 });
    expect(rows[3]).toHaveAttribute('aria-pressed', 'true');
    expect(rows[0]).toHaveAttribute('aria-pressed', 'false');
    expect(scroller.scrollTop).toBe(0);
    expect(screen.getByText("D'aquí a 3 dies")).toBeInTheDocument();
    // L'heroi (etiquetat per la data del navegador) mostra el dia triat: 2026-10-10.
    expect(navDate(container)).toMatch(/10/);
    expect(navDate(container)).toMatch(/oct/i);
    expect(container.querySelector('.sm-hero')).toHaveAttribute('aria-labelledby', container.querySelector('.sm-a-nav [aria-live]')!.id);
    expect(heroText(container)).toContain('07:54');
    expect(heroText(container)).toContain('19:15');
  });

  it('triar una fila amb el teclat no fa scroll i el focus es queda a la fila', () => {
    const { container } = renderModal();
    advance(300);
    const rows = container.querySelectorAll<HTMLButtonElement>('.sm-arow');
    const scroller = container.querySelector('.sm-scroll') as HTMLElement;
    scroller.scrollTop = 500;
    rows[5].focus();
    fireEvent.click(rows[5], { detail: 0 });
    expect(screen.getByText("D'aquí a 5 dies")).toBeInTheDocument();
    expect(scroller.scrollTop).toBe(500);
    expect(document.activeElement).toBe(rows[5]);
  });

  it('més enllà de la previsió: una frase amb el darrer dia', () => {
    const { container } = renderModal();
    for (let i = 0; i < 9; i++) fireEvent.click(next());
    expect(screen.getByText("D'aquí a 9 dies")).toBeInTheDocument();
    const fc = container.querySelector('.sm-a-fc')!;
    expect(fc.textContent).toMatch(/La previsió d'UV, sol i radiació arriba fins al 14 d.octubre\./);
    expect(fc.querySelector('dl')).toBeNull();
  });

  it('dia de canvi d\'hora (2026-10-25, 25 h): l\'eix va fins a 1500 i les hores són les de rellotge', () => {
    vi.setSystemTime(new Date('2026-10-24T10:00:00Z'));
    const { container } = renderModal();
    fireEvent.click(next());
    expect(slider()).toHaveAttribute('aria-valuemax', '1500');
    fireEvent.keyDown(slider(), { key: 'Home' });
    expect(slider().getAttribute('aria-valuetext')).toMatch(/^00:00,/);
    for (let i = 0; i < 3; i++) fireEvent.keyDown(slider(), { key: 'PageUp' });
    expect(slider()).toHaveAttribute('aria-valuenow', '180');
    expect(slider().getAttribute('aria-valuetext')).toMatch(/^02:00,/);   // les 03:00 d'estiu tornen a ser les 02:00
    fireEvent.keyDown(slider(), { key: 'End' });
    expect(slider()).toHaveAttribute('aria-valuenow', '1500');
    expect(slider().getAttribute('aria-valuetext')).toMatch(/^24:00,/);
    // La marca "12" cau a la dreta del centre (el dia té una hora de més abans del migdia).
    const twelve = [...container.querySelectorAll('.sm-plot svg text')].find(t => t.textContent === '12')!;
    expect(Number(twelve.getAttribute('x'))).toBeGreaterThan((34 + 314) / 2 + 3);
  });
});

describe('SolarModal — casos límit', () => {
  it('Tromsø, dia polar: "Sol de mitjanit", 24h 00m i cap punt de sortida al gràfic', () => {
    vi.setSystemTime(new Date('2026-06-21T10:00:00Z'));
    const w = gironaWeather({ lat: 69.65, lon: 18.96, name: 'Tromsø', tz: 'Europe/Oslo', offset: 7200, dates: ['2026-06-21'] });
    const { container } = renderModal(w);
    const hero = heroText(container);
    expect(hero).toContain('Sol de mitjanit');
    expect(hero).toContain('24h 00m');
    expect(hero).not.toMatch(/Posta de sol en|Sortida en/);
    expect(container.querySelector('[data-testid=sm-rise-marker]')).toBeNull();
    expect(container.querySelector('[data-testid=sm-set-marker]')).toBeNull();
    expect(container.querySelector('.sm-a-eph')!.textContent).toContain('El sol no baixa tant');
  });

  it('sense daily: frase de "sense previsió diària" i l\'astronomia continua (sortida de suncalc)', () => {
    const { container } = renderModal(gironaWeather({ noDaily: true }));
    expect(container.querySelector('.sm-a-fc')!.textContent)
      .toContain('No hi ha previsió diària: només es mostra el càlcul astronòmic.');
    expect(heroText(container)).toContain('07:52');
    expect(slider()).toHaveAttribute('aria-valuenow', '967');
    expect(container.querySelector('.sm-a-foot')!.textContent).not.toContain('Open-Meteo');
  });
});

describe('SolarModal — mida del gràfic sense i amb ResizeObserver (jsdom no en té)', () => {
  const svg = (c: HTMLElement) => c.querySelector('.sm-plot svg')!;
  const xLabels = (c: HTMLElement) => [...c.querySelectorAll('.sm-plot svg text')].map(t => t.textContent);

  it('sense ResizeObserver: mida de reserva 328×156 i després l\'event resize de la finestra', () => {
    expect(typeof globalThis.ResizeObserver).toBe('undefined');
    const { container } = renderModal();
    expect(svg(container)).toHaveAttribute('width', '328');
    expect(svg(container)).toHaveAttribute('height', '156');
    expect(xLabels(container)).not.toContain('03');   // plot estret: cada 6 h
    const plot = container.querySelector('.sm-plot') as HTMLElement;
    Object.defineProperty(plot, 'clientWidth', { configurable: true, value: 600 });
    Object.defineProperty(plot, 'clientHeight', { configurable: true, value: 200 });
    act(() => { window.dispatchEvent(new Event('resize')); });
    expect(svg(container)).toHaveAttribute('width', '600');
    expect(svg(container)).toHaveAttribute('height', '200');
    expect(xLabels(container)).toContain('03');       // plot ample: cada 3 h
  });

  it('amb ResizeObserver: es redimensiona només quan canvia la mida arrodonida', () => {
    const observers: Array<{ cb: ResizeObserverCallback; targets: Element[] }> = [];
    class FakeResizeObserver {
      private rec: { cb: ResizeObserverCallback; targets: Element[] };
      constructor(cb: ResizeObserverCallback) { this.rec = { cb, targets: [] }; observers.push(this.rec); }
      observe(el: Element) { this.rec.targets.push(el); }
      unobserve() {}
      disconnect() { this.rec.targets = []; }
    }
    vi.stubGlobal('ResizeObserver', FakeResizeObserver);
    try {
      const { container } = renderModal();
      const plot = container.querySelector('.sm-plot')!;
      const ro = observers.find(o => o.targets.includes(plot))!;
      expect(ro).toBeDefined();
      const svgBefore = svg(container);
      const fire = (width: number, height: number) => act(() => {
        ro.cb([{ contentRect: { width, height } } as ResizeObserverEntry], {} as ResizeObserver);
      });
      fire(328.2, 156.3);   // la mateixa mida arrodonida: cap render
      expect(svg(container)).toBe(svgBefore);
      fire(452, 176);
      expect(svg(container)).toHaveAttribute('width', '452');
      expect(svg(container)).toHaveAttribute('height', '176');
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

describe('SolarModal — brúixola (només pantalla gran, matchMedia simulat)', () => {
  it('a ≥ 1024 px es munta diferida i el punt segueix el minut confirmat', () => {
    const queries: string[] = [];
    const matchMedia = (query: string) => {
      queries.push(query);
      return {
        matches: true, media: query, onchange: null,
        addEventListener: () => {}, removeEventListener: () => {}, addListener: () => {}, removeListener: () => {},
        dispatchEvent: () => false,
      } as unknown as MediaQueryList;
    };
    Object.defineProperty(window, 'matchMedia', { configurable: true, writable: true, value: matchMedia });
    try {
      const { container } = renderModal();
      expect(queries).toContain('(min-width:1024px) and (min-height:481px)');
      expect(container.querySelector('.sm-cmp-dot')).toBeNull();
      advance(300);
      expect(screen.getByRole('heading', { name: 'Direcció del sol' })).toBeInTheDocument();
      expect(screen.getByRole('img', { name: /Recorregut del sol/ })).toBeInTheDocument();
      const dot = container.querySelector('.sm-cmp-dot') as HTMLElement;
      const before = dot.style.transform;
      expect(before).toMatch(/^translate\(/);
      expect(dot.dataset.tone).toBe('day');
      fireEvent.keyDown(slider(), { key: 'Home' });   // 00:00: sol sota l'horitzó
      expect(dot.style.transform).not.toBe(before);
      expect(dot.dataset.tone).toBe('below');
      // Calendari en dues columnes a pantalla gran (dues capçaleres).
      expect(container.querySelectorAll('.sm-ahead').length).toBe(2);
    } finally {
      delete (window as { matchMedia?: unknown }).matchMedia;
    }
  });
});

describe('SolarModal — pressupost de DOM i guardes', () => {
  it('≤ 230 elements abans del calendari i ≤ 350 després; cap desenfocament, animació en bucle ni filtre', () => {
    renderModal();
    const dialog = screen.getByRole('dialog');
    const before = dialog.querySelectorAll('*').length;
    expect(before).toBeLessThanOrEqual(230);
    advance(300);
    const after = dialog.querySelectorAll('*').length;
    expect(after).toBeLessThanOrEqual(350);
    expect(after).toBeGreaterThan(before);
    for (const el of dialog.querySelectorAll('*')) {
      expect(el.getAttribute('class') ?? '').not.toMatch(/backdrop-blur|animate-|blur-\[|drop-shadow/);
    }
    expect(dialog.querySelectorAll('filter').length).toBe(0);
    expect(dialog.querySelectorAll('[filter]').length).toBe(0);
    expect(dialog.querySelectorAll('animate, animateTransform, animateMotion').length).toBe(0);
  });
});
