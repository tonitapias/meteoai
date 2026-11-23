// src/components/sky/NightPanel.test.tsx
// Plafó «Aquesta nit» (Barcelona, 23 → 24/11/2026, UTC+1): la frase segons el cel previst i la lluna, la lluna d'ara
// amb la sortida i la posta al voltant d'ara (de nit, la posta de DEMÀ), la nit següent, la nit polar i el sol de
// mitjanit, el modal de la lluna i els 4 idiomes.
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { NightPanel, type NightPanelProps } from './NightPanel';
import { clearSolarDayCache } from '../../utils/solar/solarDay';
import { getMoonPhase, getMoonPhaseName, getNamedMoonPhase } from '../../utils/lunarPhases';
import { getMoonIlluminationPercent } from '../../utils/astronomyMath';
import type { SkyHour, SkyKind } from '../../utils/daySky';
import type { Language } from '../../translations';

const EVENING = Date.parse('2026-11-23T18:26:00Z');   // 19:26 local
const AFTERNOON = Date.parse('2026-11-23T14:15:00Z'); // 15:15 local

const hours = (kindAt: (h: number) => SkyKind): SkyHour[] => Array.from({ length: 24 }, (_, hour) => ({ hour, kind: kindAt(hour), isDay: hour >= 8 && hour < 17 }));
// Tapat tota la nit; la nit següent, pluja des de les 20 h, tapat fins a les 02 h i serè fins a l'alba.
const DAY_SKY: Record<string, SkyHour[]> = {
  '2026-11-23': hours(() => 'cloudy'),
  '2026-11-24': hours(h => (h >= 20 ? 'rain' : 'cloudy')),
  '2026-11-25': hours(h => (h < 2 ? 'cloudy' : 'clear')),
};

const renderPanel = (over: Partial<NightPanelProps> = {}) =>
  render(
    <NightPanel lang="ca" lat={41.38879} lon={2.15899} timezone="Europe/Madrid" utcOffset={3600} nowMs={EVENING} daySky={DAY_SKY} {...over} />,
  );

beforeEach(() => clearSolarDayCache());

describe('NightPanel — la nit', () => {
  it('de la posta a la sortida, amb la frase del cel i la lluna', () => {
    const { container } = renderPanel();
    expect(screen.getByRole('heading', { name: 'Aquesta nit' })).toBeTruthy();
    expect(container.textContent).toMatch(/17:2\d → 07:5\d/);
    expect(screen.getByText('La lluna, darrere dels núvols')).toBeTruthy();
    const pct = getMoonIlluminationPercent(getMoonPhase(new Date(EVENING)));
    expect(screen.getByText(`La lluna, al ${pct}%, hi és tota la nit.`)).toBeTruthy();
    expect(container.textContent).toMatch(/nit fosca 19:0\d – 06:1\d/);
  });

  it('la nit següent: amb la pluja d\'abans, s\'obre a les 02:00 (i la llegenda hi posa la pluja)', () => {
    const { container } = renderPanel();
    expect(container.textContent).toContain('Demà a la nit');
    expect(container.textContent).toContain("pluja, s'obre a les 02:00");
    expect(container.textContent).toMatch(/núvolpluja/);
  });

  it('de dia és la mateixa nit (la que ve), sense marca d\'ara', () => {
    const { container } = renderPanel({ nowMs: AFTERNOON });
    expect(container.textContent).toMatch(/17:2\d → 07:5\d/);
    expect(container.textContent).not.toMatch(/ara$/m);
    expect(screen.queryByText('ara')).toBeNull();
  });

  it('sense previsió del cel no s\'inventa res del cel: només la lluna', () => {
    renderPanel({ daySky: null });
    expect(screen.getByText('La nit al cel')).toBeTruthy();
    expect(screen.queryByText('Demà a la nit')).toBeNull();
  });
});

describe('NightPanel — la lluna', () => {
  it('fase i il·luminació d\'ara; va sortir a les 16:13 i es pon DEMÀ a les 07:46; plena demà', () => {
    const { container } = renderPanel();
    const name = getMoonPhaseName(getNamedMoonPhase(new Date(EVENING)), 'ca');
    const pct = getMoonIlluminationPercent(getMoonPhase(new Date(EVENING)));
    expect(container.textContent).toContain(`${name} · ${pct}%`);
    expect(container.textContent).toMatch(/Va sortir a les 16:1\d · es pon demà a les 07:4\d/);
    expect(container.textContent).toMatch(/Plenademà/);
  });

  it('a la tarda, abans que surti: surt a les 16:13', () => {
    const { container } = renderPanel({ nowMs: Date.parse('2026-11-23T11:00:00Z') });
    expect(container.textContent).toMatch(/Surt a les 16:1\d · es pon demà a les 07:4\d/);
  });

  it('la fila de la lluna obre el modal Fase lunar', () => {
    const onOpenMoon = vi.fn();
    renderPanel({ onOpenMoon, moonLabel: 'Fase lunar, Gibosa Creixent · Detall' });
    fireEvent.click(screen.getByRole('button', { name: 'Fase lunar, Gibosa Creixent · Detall' }));
    expect(onOpenMoon).toHaveBeenCalledTimes(1);
  });

  it('a l\'hemisferi sud la Lluna es dibuixa girada mig volt; al nord, no', () => {
    const north = renderPanel();
    expect(north.container.querySelector('g[transform="rotate(180)"]')).toBeNull();
    north.unmount();
    const south = renderPanel({ lat: -34.6, lon: -58.4, timezone: 'America/Argentina/Buenos_Aires', utcOffset: -10800, daySky: null });
    expect(south.container.querySelector('g[transform="rotate(180)"]')).not.toBeNull();
  });
});

describe('NightPanel — latituds polars (Longyearbyen)', () => {
  it('nit polar: «nit polar» a la capçalera i la nit sencera', () => {
    const { container } = renderPanel({ lat: 78.22, lon: 15.65, timezone: 'Arctic/Longyearbyen', nowMs: Date.parse('2026-12-15T12:00:00Z'), daySky: null });
    expect(container.textContent).toContain('nit polar');
  });

  it('sol de mitjanit: no hi ha nit, però sí la lluna', () => {
    renderPanel({ lat: 78.22, lon: 15.65, timezone: 'Arctic/Longyearbyen', utcOffset: 7200, nowMs: Date.parse('2026-06-21T12:00:00Z'), daySky: null });
    expect(screen.getByText('Sol de mitjanit: avui no es fa fosc.')).toBeTruthy();
    expect(screen.getByRole('button')).toBeTruthy();
  });
});

describe('NightPanel — idioma', () => {
  const CASES: Array<[Language, string, string, string]> = [
    ['ca', 'Aquesta nit', 'Núvols', 'La lluna, darrere dels núvols'],
    ['es', 'Esta noche', 'Nubes', 'La luna, tras las nubes'],
    ['en', 'Tonight', 'Clouds', 'The moon, behind the clouds'],
    ['fr', 'Cette nuit', 'Nuages', 'La lune, derrière les nuages'],
  ];
  it.each(CASES)('%s', (lang, title, clouds, verdict) => {
    renderPanel({ lang });
    expect(screen.getByRole('heading', { name: title })).toBeTruthy();
    expect(screen.getByText(clouds)).toBeTruthy();
    expect(screen.getByText(verdict)).toBeTruthy();
  });
});
