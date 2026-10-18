// src/components/widgets/MoonWidget.test.tsx
// Targeta Fase lunar ("Cel viu"): textos en els 4 idiomes, edat real, hores del dia local, on és ara (la mateixa
// funció que el modal), la pròxima plena i l'orientació a l'hemisferi sud.
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MoonWidget } from './MoonWidget';
import { getCardinalLabel, getMoonCompassPosition } from '../../utils/astronomyMath';
import type { Language } from '../../translations';

// Barcelona, 18-10-2026 16:12 UTC: quart creixent real (fase 0,25), Lluna de 8 dies.
const NOW = Date.UTC(2026, 9, 18, 16, 12);
const BCN = { lat: 41.3888, lon: 2.159 };
const renderCard = (lang: Language, extra: { ageDays?: number; date?: number; lat?: number; lon?: number; phase?: number } = {}) =>
  render(
    <MoonWidget
      phase={extra.phase ?? 0.25}
      ageDays={'ageDays' in extra ? extra.ageDays : 8}
      lat={extra.lat ?? BCN.lat}
      lon={extra.lon ?? BCN.lon}
      timezone="Europe/Madrid"
      date={extra.date ?? NOW}
      lang={lang}
    />,
  );

describe('MoonWidget — idioma', () => {
  it.each([
    ['ca', 'Quart Creixent', 'il·luminada', 'Sortida', 'Posta', 'Dia 8', 'Plena', '8 dies'],
    ['es', 'Cuarto Creciente', 'iluminada', 'Salida', 'Puesta', 'Día 8', 'Llena', '8 días'],
    ['en', 'First Quarter', 'illuminated', 'Rise', 'Set', 'Day 8', 'Full', '8 days'],
    ['fr', 'Premier Quartier', 'éclairée', 'Lever', 'Coucher', 'Jour 8', 'Pleine', '8 jours'],
  ] as Array<[Language, string, string, string, string, string, string, string]>)(
    '%s: fase, il·luminació, sortida/posta, edat i pròxima plena', (lang, name, lit, rise, set, day, full, inDays) => {
      const { container } = renderCard(lang);
      expect(screen.getByText(name)).toBeTruthy();
      expect(container.textContent).toContain(`50% ${lit}`);
      expect(screen.getByText(rise)).toBeTruthy();   // etiquetes per al lector de pantalla
      expect(screen.getByText(set)).toBeTruthy();
      expect(screen.getByText(day)).toBeTruthy();
      expect(screen.getByText(full)).toBeTruthy();
      expect(container.textContent).toMatch(new RegExp(`26 · ${inDays}`));   // plena real: 26-10 06:11 UTC
    });
});

describe('MoonWidget — dades', () => {
  it('mostra l\'edat rebuda i "--" si no n\'hi ha (no l\'estima a partir de la fase)', () => {
    const { unmount } = renderCard('ca', { ageDays: 8 });
    expect(screen.getByText('Dia 8')).toBeTruthy();
    unmount();
    renderCard('ca', { ageDays: undefined });
    expect(screen.getByText('Dia --')).toBeTruthy();
  });

  it('les hores de sortida i posta són les del dia local (posta passada mitjanit, +1d)', () => {
    renderCard('ca');
    // Contrastat amb l'USNO: sortida 15:22, cap posta el 18-10 (la següent, el 19-10 a les 00:38).
    expect(screen.getByText('15:22')).toBeTruthy();
    expect(screen.getByText('00:38')).toBeTruthy();
    expect(screen.getByText('+1d')).toBeTruthy();
  });

  it('on és ara: la mateixa lectura que la "Posició actual" del modal', () => {
    const { container } = renderCard('ca');
    const p = getMoonCompassPosition(new Date(NOW), BCN.lat, BCN.lon)!;
    expect(p.altitudeDeg).toBeGreaterThan(0);
    expect(container.textContent).toContain(`${Math.round(p.altitudeDeg)}° ${getCardinalLabel(p.azimuthDeg, 'ca')}`);
  });

  it('amb la Lluna sota l\'horitzó ho diu, en lloc d\'una alçada negativa', () => {
    renderCard('ca', { date: Date.UTC(2026, 9, 18, 8, 0) });   // −56°
    expect(screen.getByText(/sota l'horitzó/)).toBeTruthy();
  });

  it('a l\'hemisferi sud la Lluna es dibuixa girada mig volt; al nord, no', () => {
    const north = renderCard('ca');
    expect(north.container.querySelector('g[transform*="rotate(180)"]')).toBeNull();
    north.unmount();
    const south = renderCard('ca', { lat: -34.6, lon: -58.38 });
    expect(south.container.querySelector('g[transform*="rotate(180)"]')).not.toBeNull();
  });

  it('el dia de la plena diu "avui"', () => {
    const { container } = renderCard('ca', { phase: 0.5, date: Date.UTC(2026, 9, 26, 10, 0) });
    expect(container.textContent).toContain('Plenaavui');
  });

  it('sense fase: "--" i cap anell de progrés', () => {
    const { container } = renderCard('ca', { phase: NaN });
    expect(container.textContent).toContain('--%');
    expect(container.querySelector('path[stroke="#a5b4fc"]')).toBeNull();
  });
});
