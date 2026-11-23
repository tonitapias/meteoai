// src/components/sky/SkySection.test.tsx
// La pestanya Cel: sempre primer el sol i a sota «Aquesta nit»; de dia, el compte enrere fins a la posta és la xifra gran
// del sol i, de nit, va a la seva capçalera. Cada plafó obre el seu modal.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import SkySection from './SkySection';
import { clearSolarDayCache } from '../../utils/solar/solarDay';
import type { ExtendedWeatherData } from '../../types/weatherLogicTypes';

const weather = {
  location: { name: 'Barcelona', latitude: 41.38879, longitude: 2.15899 },
  timezone: 'Europe/Madrid',
  utc_offset_seconds: 3600,
  current: { time: '2026-11-23T19:15' },
  daily: { time: ['2026-11-23', '2026-11-24'] },
  hourly: { time: [] },
} as unknown as ExtendedWeatherData;

const renderAt = (iso: string, on = { onShowSolarModal: vi.fn(), onShowMoonModal: vi.fn() }) => {
  vi.setSystemTime(new Date(iso));
  const view = render(<SkySection weatherData={weather} daySky={null} lang="ca" nowMs={Date.parse(iso)} {...on} />);
  const section = screen.getByTestId('sky-section');
  const headings = Array.from(section.querySelectorAll('h3')).map(h => h.textContent);
  return { view, section, headings, on };
};

beforeEach(() => { vi.useFakeTimers(); clearSolarDayCache(); });
afterEach(() => { vi.useRealTimers(); });

describe('SkySection', () => {
  it('a les 15:15, primer el sol amb el compte enrere gran', () => {
    const { section, headings } = renderAt('2026-11-23T14:15:00Z');
    expect(section.dataset.time).toBe('day');
    expect(headings).toEqual(['El sol', 'Aquesta nit']);
    expect(screen.getByText("Es pon d'aquí a")).toBeTruthy();
  });

  it('a les 19:26 també primer el sol, ara amb el compte enrere a la capçalera, i a sota la nit', () => {
    const { section, headings } = renderAt('2026-11-23T18:26:00Z');
    expect(section.dataset.time).toBe('night');
    expect(headings).toEqual(['El sol', 'Aquesta nit']);
    expect(screen.queryByText("Es pon d'aquí a")).toBeNull();
    expect(screen.getByText('Sortida en')).toBeTruthy();
  });

  it('a les 03:00 encara és de nit', () => {
    expect(renderAt('2026-11-24T02:00:00Z').section.dataset.time).toBe('night');
  });

  it('el plafó del sol obre el modal Cicle solar i la lluna, el modal Fase lunar', () => {
    const { on } = renderAt('2026-11-23T18:26:00Z');
    fireEvent.click(screen.getByRole('button', { name: /^Cicle solar, sortida del sol a les 07:\d\d · Detall$/ }));
    fireEvent.click(screen.getByRole('button', { name: /^Fase lunar, .+ · Detall$/ }));
    expect(on.onShowSolarModal).toHaveBeenCalledTimes(1);
    expect(on.onShowMoonModal).toHaveBeenCalledTimes(1);
  });
});
