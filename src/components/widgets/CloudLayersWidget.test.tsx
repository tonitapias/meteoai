import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { CloudLayersWidget } from './CloudLayersWidget';
import CloudLayersModal from '../CloudLayersModal';
import type { ExtendedWeatherData } from '../../types/weatherLogicTypes';

/** Número gran de la cobertura efectiva: a la targeta és text-4xl, al modal text-5xl. */
const cardHero = (c: HTMLElement) => c.querySelector('span.text-4xl')?.textContent;
const modalHero = (c: HTMLElement) => c.querySelector('span.text-5xl')?.textContent;

const buildWeather = (low: number, mid: number, high: number): ExtendedWeatherData => {
  const n = 48;
  const arr = <T,>(v: T) => Array.from({ length: n }, () => v);
  return {
    current: { time: '2026-10-18T21:00', cloud_cover_low: low, cloud_cover_mid: mid, cloud_cover_high: high },
    hourly: {
      time: Array.from({ length: n }, (_, i) => new Date(Date.UTC(2026, 9, 18, 21 + i)).toISOString().slice(0, 16)),
      cloud_cover_low: arr(low), cloud_cover_mid: arr(mid), cloud_cover_high: arr(high),
    },
    daily: {}, hourlyComparison: {},
  } as unknown as ExtendedWeatherData;
};

describe('CloudLayersWidget — perfil vertical del cel', () => {
  it('mostra la cobertura efectiva, el seu nivell i les tres capes de dalt a baix amb les alçades de frontera', () => {
    const { container } = render(<CloudLayersWidget low={20} mid={10} high={30} lang="ca" />);
    const text = container.textContent ?? '';
    expect(cardHero(container)).toBe('35');
    expect(text).toContain('Parcialment Ennuvolat');
    expect(text).toContain('CAPES DE NÚVOLS');
    // Alts a dalt, baixos a baix (com al cel), i les fronteres d'Open-Meteo entre capes.
    expect(text.indexOf('Alts')).toBeLessThan(text.indexOf('Mitjans'));
    expect(text.indexOf('Mitjans')).toBeLessThan(text.indexOf('Baixos'));
    expect(text.indexOf('8 km')).toBeGreaterThan(text.indexOf('Alts'));
    expect(text.indexOf('8 km')).toBeLessThan(text.indexOf('Mitjans'));
    expect(text.indexOf('3 km')).toBeGreaterThan(text.indexOf('Mitjans'));
    expect(text.indexOf('3 km')).toBeLessThan(text.indexOf('Baixos'));
  });

  it('0 % és cel net (es mostra 0) i una capa sense dada és "--", no 0', () => {
    const { container } = render(<CloudLayersWidget low={12} mid={null} high={0} lang="ca" />);
    const values = [...container.querySelectorAll('span.text-\\[15px\\]')].map(e => e.textContent);
    expect(values).toEqual(['0', '--', '12']);
  });

  it('sense cap dada no inventa cap número', () => {
    const { container } = render(<CloudLayersWidget low={undefined} mid={null} high={NaN} lang="ca" />);
    expect(cardHero(container)).toBe('--');
    expect(container.textContent).toContain('Desconegut');
    expect(container.textContent).not.toMatch(/\d+%/);
  });

  it('respecta l\'idioma (títol, etiqueta efectiva i nivell)', () => {
    const { container } = render(<CloudLayersWidget low={46} mid={100} high={100} lang="fr" />);
    expect(container.textContent).toContain('ÉTAGES NUAGEUX');
    expect(container.textContent).toContain('Couverture effective');
    expect(container.textContent).toContain('Couvert');
  });

  it.each([
    [0, 0, 5],
    [20, 10, 30],
    [50, 40, 0],
    [46, 100, 100],
  ])('targeta i modal diuen el mateix número i nivell (baixos %i, mitjans %i, alts %i)', (low, mid, high) => {
    const card = render(<CloudLayersWidget low={low} mid={mid} high={high} lang="ca" />).container;
    const modal = render(<CloudLayersModal weatherData={buildWeather(low, mid, high)} onClose={() => {}} lang="ca" />).container;
    expect(cardHero(card)).toBe(modalHero(modal));
    const cardLevel = card.querySelector('span.text-\\[11px\\]')?.textContent;
    expect(['Serè', 'Parcialment Ennuvolat', 'Molt Ennuvolat', 'Cobert']).toContain(cardLevel);
    // Coincidència exacta: "Cobert" no ha de quadrar amb "Cobertura Efectiva" ni "Hores amb Cel Cobert".
    expect([...modal.querySelectorAll('span')].some(s => s.textContent === cardLevel)).toBe(true);
  });
});
