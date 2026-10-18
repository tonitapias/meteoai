// src/components/MoonModal.test.tsx
// Modal Fase lunar amb el llenguatge de la seva targeta: mateixos valors que el giny (fase, il·luminació, edat,
// posició i pròxima plena), navegació per dies com el modal solar, calendari de 15 dies i hemisferi sud.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import MoonModal from './MoonModal';
import { MoonWidget } from './widgets/MoonWidget';
import { getMoonPhase } from '../utils/weatherMath';
import { getMoonAgeDays } from '../utils/lunarPhases';
import { getCardinalLabel, getMoonCompassPosition } from '../utils/astronomyMath';
import type { ExtendedWeatherData } from '../types/weatherLogicTypes';

// Barcelona, 18-10-2026 16:12 UTC (18:12 local): quart creixent real (USNO).
const NOW = new Date('2026-10-18T16:12:00Z');
const BCN = { lat: 41.3888, lon: 2.159 };

const weather = (over: Partial<{ lat: number; lon: number; name: string }> = {}): ExtendedWeatherData => ({
  location: { name: over.name ?? 'Barcelona', latitude: over.lat ?? BCN.lat, longitude: over.lon ?? BCN.lon },
  timezone: 'Europe/Madrid',
  utc_offset_seconds: 7200,
  current: { time: '2026-10-18T18:00' },
  daily: { time: ['2026-10-18', '2026-10-19'] },
} as unknown as ExtendedWeatherData);

const renderModal = (w: ExtendedWeatherData = weather(), lang = 'ca') =>
  render(<MoonModal weatherData={w} onClose={() => {}} lang={lang as never} />);
const hero = (c: HTMLElement) => c.querySelector('.sm-hero')!.textContent ?? '';
const navDate = (c: HTMLElement) => c.querySelector('[aria-live]')!.textContent ?? '';

beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(NOW); });
afterEach(() => { vi.useRealTimers(); });

describe('MoonModal — el mateix que la targeta', () => {
  it('fase, il·luminació, edat, posició d\'ara i pròxima plena coincideixen amb el giny', () => {
    const { container } = renderModal();
    const card = render(
      <MoonWidget phase={getMoonPhase(NOW)} ageDays={getMoonAgeDays(NOW)} lat={BCN.lat} lon={BCN.lon} timezone="Europe/Madrid" date={NOW.getTime()} lang="ca" />,
    ).container.textContent ?? '';
    const h = hero(container);
    expect(h).toContain('Quart Creixent');
    expect(card).toContain('Quart Creixent');
    expect(h).toContain('50% il·luminada');
    expect(card).toContain('50% il·luminada');
    expect(h).toContain('Edat 8 dies');
    expect(card).toContain('Dia 8');
    // Posició: la targeta diu alçada + punt cardinal; el modal hi afegeix l'azimut en graus.
    const p = getMoonCompassPosition(NOW, BCN.lat, BCN.lon)!;
    expect(card).toContain(`${Math.round(p.altitudeDeg)}° ${getCardinalLabel(p.azimuthDeg, 'ca')}`);
    expect(h).toContain(`+${Math.round(p.altitudeDeg)}°`);
    expect(h).toContain(getCardinalLabel(p.azimuthDeg, 'ca'));
    // Pròxima plena: 26-10 a les 06:11 UTC (USNO) → "en 8 dies" al modal i "8 dies" a la targeta.
    expect(container.textContent).toMatch(/Lluna plena.*26 d.oct\..*en 8 dies/);
    expect(card).toMatch(/26 · 8 dies/);
    expect(container.textContent).toMatch(/Lluna nova.*9 de nov\..*en 22 dies/);
  });

  it('sortida i posta del dia local amb l\'azimut (contrastat amb l\'USNO: 15:22, posta l\'endemà 00:38)', () => {
    const { container } = renderModal();
    const rs = container.querySelector('[aria-label="Sortida i posta"]')!.textContent ?? '';
    expect(rs).toContain('15:22');
    expect(rs).toContain('00:38+1d');
    expect(rs).toMatch(/\d+° ESE/);
  });
});

describe('MoonModal — navegació per dies', () => {
  it('les fletxes, la tecla → i "Avui" canvien el dia de tot el modal; l\'"Ara" només surt avui', () => {
    const { container } = renderModal();
    expect(navDate(container)).toMatch(/^Diumenge, 18 d.octubre$/);
    expect(hero(container)).toContain('Ara');
    fireEvent.click(screen.getByRole('button', { name: 'Dia següent' }));
    expect(navDate(container)).toMatch(/19/);
    expect(hero(container)).not.toContain('Ara');
    expect(hero(container)).toMatch(/\d+% il·luminada/);
    act(() => { fireEvent.keyDown(window, { key: 'ArrowRight' }); });
    expect(navDate(container)).toMatch(/20/);
    fireEvent.click(screen.getByRole('button', { name: 'Torna a avui' }));
    expect(navDate(container)).toMatch(/^Diumenge, 18 d.octubre$/);
    expect(screen.getByRole('button', { name: 'Dia anterior' }).getAttribute('aria-disabled')).toBe('true');
  });

  it('el calendari té avui + 14 dies i tocar-ne una fila tria aquell dia', () => {
    const { container } = renderModal();
    const rows = container.querySelectorAll('ol button');
    expect(rows).toHaveLength(15);
    expect(rows[0].getAttribute('aria-current')).toBe('date');
    expect(rows[0].getAttribute('aria-pressed')).toBe('true');
    // La fila d'avui diu el mateix que l'heroi (a l'hora real, no al migdia).
    expect(rows[0].textContent).toContain('50%');
    fireEvent.click(rows[8]);   // dl. 26: lluna plena
    expect(rows[8].getAttribute('aria-pressed')).toBe('true');
    expect(hero(container)).toContain('Lluna Plena');
    expect(navDate(container)).toMatch(/26/);
  });

  it('no deixa anar més enllà de 14 dies', () => {
    renderModal();
    const next = screen.getByRole('button', { name: 'Dia següent' });
    for (let i = 0; i < 20; i++) fireEvent.click(next);
    expect(next.getAttribute('aria-disabled')).toBe('true');
  });
});

describe('MoonModal — casos', () => {
  it('a l\'hemisferi sud la Lluna es dibuixa girada mig volt', () => {
    const north = renderModal();
    expect(north.container.querySelector('.sm-hero g[transform*="rotate(180)"]')).toBeNull();
    north.unmount();
    const south = renderModal(weather({ lat: -34.6, lon: -58.38, name: 'Buenos Aires' }));
    expect(south.container.querySelector('.sm-hero g[transform*="rotate(180)"]')).not.toBeNull();
  });

  it('sense coordenades: un missatge en lloc de xifres', () => {
    renderModal(weather({ lat: NaN, lon: NaN }));
    expect(screen.getByText('Sense dades de la ubicació')).toBeTruthy();
  });

  it.each([
    ['es', 'Fase lunar', 'Cuarto Creciente', 'iluminada'],
    ['en', 'Moon phase', 'First Quarter', 'illuminated'],
    ['fr', 'Phase lunaire', 'Premier Quartier', 'éclairée'],
  ])('%s: títol, fase i il·luminació en l\'idioma', (lang, title, phase, lit) => {
    const { container } = renderModal(weather(), lang);
    expect(screen.getByRole('dialog').getAttribute('aria-labelledby')).toBeTruthy();
    expect(screen.getByText(title)).toBeTruthy();
    expect(hero(container)).toContain(phase);
    expect(hero(container)).toContain(`50% ${lit}`);
  });
});
