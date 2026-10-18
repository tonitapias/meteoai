import { describe, it, expect } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import CloudLayersModal from './CloudLayersModal';
import type { ExtendedWeatherData } from '../types/weatherLogicTypes';

/** Ara cobert (46 / 100 / 100 → 100 %); l'última hora de la finestra, només núvols alts (0 / 0 / 100 → 30 %). */
const buildWeather = (): ExtendedWeatherData => {
  const n = 48;
  const layer = (now: number, last: number) => Array.from({ length: n }, (_, i) => (i === n - 1 ? last : now));
  return {
    current: { time: '2026-10-18T21:00', cloud_cover_low: 46, cloud_cover_mid: 100, cloud_cover_high: 100 },
    hourly: {
      time: Array.from({ length: n }, (_, i) => new Date(Date.UTC(2026, 9, 18, 21 + i)).toISOString().slice(0, 16)),
      cloud_cover_low: layer(46, 0), cloud_cover_mid: layer(100, 0), cloud_cover_high: layer(100, 100),
    },
    daily: {}, hourlyComparison: {},
  } as unknown as ExtendedWeatherData;
};

const heroValue = (c: HTMLElement) => c.querySelector('span.text-5xl')?.textContent;
const heroCaption = (c: HTMLElement) => c.querySelector('span.text-5xl')?.previousElementSibling?.textContent;

describe('CloudLayersModal — l\'heroi segueix l\'hora explorada al gràfic', () => {
  it('en explorar una altra hora, la cobertura efectiva i el nivell són els d\'aquella hora; en tornar, els d\'ara', () => {
    const { container, getByRole } = render(<CloudLayersModal weatherData={buildWeather()} onClose={() => {}} lang="ca" />);
    const slider = getByRole('slider');

    expect(heroValue(container)).toBe('100');
    expect(heroCaption(container)).toBe('Cobertura Efectiva · ARA');
    expect([...container.querySelectorAll('span')].some(s => s.textContent === 'Cobert')).toBe(true);

    // Última hora (End): abans l'heroi es quedava a "100 · Cobert" mentre les capes deien 100 / 0 / 0 %.
    fireEvent.keyDown(slider, { key: 'End' });
    expect(heroValue(container)).toBe('30');
    expect(heroCaption(container)).toBe('Cobertura Efectiva · 20:00');
    expect([...container.querySelectorAll('span')].some(s => s.textContent === 'Parcialment Ennuvolat')).toBe(true);
    expect(slider.getAttribute('aria-valuetext')).toBe('20:00 · Cobertura Efectiva 30% · Alts 100% · Mitjans 0% · Baixos 0%');

    fireEvent.keyDown(slider, { key: 'Home' });
    expect(heroValue(container)).toBe('100');
    expect(heroCaption(container)).toBe('Cobertura Efectiva · ARA');
  });
});
