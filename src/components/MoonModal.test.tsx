// src/components/MoonModal.test.tsx
// Modal Fase lunar: mateixos valors que la fila de la lluna del plafó «Aquesta nit» (fase, il·luminació i pròxima
// plena), navegació per dies com el modal solar, calendari de 15 dies i hemisferi sud.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import MoonModal from './MoonModal';
import { NightPanel } from './sky/NightPanel';
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

describe('MoonModal — el mateix que el plafó «Aquesta nit»', () => {
  it('fase, il·luminació i pròxima plena coincideixen amb la fila de la lluna', () => {
    const { container } = renderModal();
    const card = render(
      <NightPanel lang="ca" lat={BCN.lat} lon={BCN.lon} timezone="Europe/Madrid" utcOffset={7200} nowMs={NOW.getTime()} />,
    ).container.textContent ?? '';
    const h = hero(container);
    expect(h).toContain('Quart Creixent');
    expect(h).toContain('50% il·luminada');
    expect(card).toContain('Quart Creixent · 50%');
    expect(h).toContain('Edat 8 dies');
    // Posició d'ara al modal: alçada i punt cardinal (el plafó només la marca de nit, sobre el carril de la lluna).
    const p = getMoonCompassPosition(NOW, BCN.lat, BCN.lon)!;
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

describe('MoonModal — «Avui» és la lluna d\'ara (com la fila de la lluna)', () => {
  // Barcelona, 19-12-2026 a la 01:00: la lluna que va sortir ahir a les 13:11 encara és a dalt i es pon a les 02:45;
  // la del dia de calendari surt a les 13:35 i es pon l'endemà a les 03:58 (timeanddate).
  const NIGHT = new Date('2026-12-19T00:00:00Z');
  const riseSetCard = (c: HTMLElement) => c.querySelector('[aria-label="Sortida i posta"]')!.textContent ?? '';

  it('de matinada, amb la lluna a dalt: la seva sortida (d\'ahir, −1d) i la seva posta, les mateixes que la fila', () => {
    vi.setSystemTime(NIGHT);
    const { container } = renderModal();
    const rs = riseSetCard(container);
    expect(rs).toContain('13:11−1d');
    expect(rs).toMatch(/Posta02:45\d/);   // sense marca: avui
    expect(rs).not.toContain('03:58');
    expect(container.textContent).toMatch(/↑Sortida 13:11−1↓Posta 02:45/);
    const card = render(
      <NightPanel lang="ca" lat={BCN.lat} lon={BCN.lon} timezone="Europe/Madrid" utcOffset={3600} nowMs={NIGHT.getTime()} />,
    ).container.textContent ?? '';
    expect(card).toContain('Va sortir ahir a les 13:11 · es pon a les 02:45');
  });

  it('els altres dies, la lluna d\'aquell dia: ahir, 13:11 i 02:45+1d; demà, 14:05 i 05:15+1d', () => {
    vi.setSystemTime(NIGHT);
    const { container } = renderModal();
    fireEvent.click(screen.getByRole('button', { name: 'Dia anterior' }));
    expect(riseSetCard(container)).toMatch(/Sortida13:11\d.*Posta02:45\+1d/);
    fireEvent.click(screen.getByRole('button', { name: 'Torna a avui' }));
    fireEvent.click(screen.getByRole('button', { name: 'Dia següent' }));
    expect(riseSetCard(container)).toMatch(/Sortida14:05\d.*Posta05:15\+1d/);
  });

  it('un cop posta, la pròxima: surt a les 13:35 i es pon l\'endemà a les 03:58', () => {
    vi.setSystemTime(new Date('2026-12-19T02:00:00Z'));
    const { container } = renderModal();
    expect(riseSetCard(container)).toMatch(/Sortida13:35\d.*Posta03:58\+1d/);
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
    // Enrere fins a la primera nit de la lunació (lluna nova del 10-10): 8 dies, i prou.
    const prev = screen.getByRole('button', { name: 'Dia anterior' });
    expect(prev.getAttribute('aria-disabled')).toBe('false');
    for (let i = 0; i < 8; i++) fireEvent.click(prev);
    expect(navDate(container)).toMatch(/10 d.oct/);
    expect(screen.getByText('Fa 8 dies')).toBeTruthy();
    expect(prev.getAttribute('aria-disabled')).toBe('true');
  });

  it('el calendari és la lunació sencera (10-10 → 9-11, per setmanes) i tocar-ne un dia el tria', () => {
    const { container } = renderModal();
    const grid = container.querySelector('ol[aria-label="Tria un dia"]')!;
    const days = grid.querySelectorAll('button');
    expect(days).toHaveLength(31);
    // El 10-10-2026 és dissabte: cinc caselles buides abans (la setmana comença en dilluns).
    expect(grid.querySelectorAll('li[aria-hidden="true"]')).toHaveLength(5);
    const today = days[8];
    expect(today.getAttribute('aria-current')).toBe('date');
    expect(today.getAttribute('aria-pressed')).toBe('true');
    expect(today.textContent).toContain('QC');   // el quart creixent és avui
    // El dia triat: el mateix que l'heroi (a l'hora real) i la lluna d'aquell dia.
    expect(container.textContent).toMatch(/Avui · dg\. 18 d.oct\..*Quart Creixent · 50%/);
    fireEvent.click(days[16]);   // dl. 26: lluna plena
    expect(days[16].getAttribute('aria-pressed')).toBe('true');
    expect(hero(container)).toContain('Lluna Plena');
    expect(hero(container)).toContain('Lluna del Caçador');
    expect(navDate(container)).toMatch(/26/);
  });

  it('les fases de la lunació a l\'hora exacta, amb el nom de la plena', () => {
    const { container } = renderModal();
    expect(container.textContent).toContain("Fases d'aquesta lunació");
    // Plena del 26-10 a les 04:11 UTC: 05:11 a Barcelona (el 25-10 ja s'ha canviat a l'hora d'hivern).
    expect(container.textContent).toMatch(/Lluna PlenaLluna del Caçadordl\. 26 d.oct\.05:1\d/);
  });

  it('«Lunació següent» porta a la seva plena; d\'allà, es torna a la d\'ara', () => {
    const { container } = renderModal();
    fireEvent.click(screen.getByRole('button', { name: /Lunació següent/ }));
    expect(navDate(container)).toMatch(/24 de nov/);
    expect(hero(container)).toContain('Lluna del Castor');
    fireEvent.click(screen.getByRole('button', { name: "Torna a la lunació d'ara" }));
    expect(navDate(container)).toMatch(/^Diumenge, 18 d.octubre$/);
  });

  it('endavant, fins a l\'última nit de la lunació següent (lluna nova del 9-12)', () => {
    const { container } = renderModal();
    const next = screen.getByRole('button', { name: 'Dia següent' });
    for (let i = 0; i < 70; i++) fireEvent.click(next);
    expect(next.getAttribute('aria-disabled')).toBe('true');
    expect(navDate(container)).toMatch(/9 de des/);
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
