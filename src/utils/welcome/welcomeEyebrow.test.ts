// src/utils/welcome/welcomeEyebrow.test.ts
import { describe, it, expect } from 'vitest';
import { welcomeEyebrow } from './welcomeEyebrow';
import { welcomeMoonKey } from './moonPhaseKey';
import type { WelcomeSky } from './welcomeSky';
import { TRANSLATIONS } from '../../translations';

const w = TRANSLATIONS.ca.welcome;
// Dates en hora local: el text surt en hora local i el test no depèn de la zona horària de la màquina.
const at = (h: number, m: number) => new Date(2026, 9, 24, h, m);
const SUN = { rise: at(8, 12).getTime(), set: at(18, 59).getTime(), noon: at(13, 35).getTime() };

function sky(over: Partial<WelcomeSky>): WelcomeSky {
  return {
    phase: 'dia',
    place: { lat: 41.39, lon: 2.17, source: 'gps' },
    south: false,
    sunAngle: -40,
    sunAltitude: 20,
    sunEast: true,
    sunTimes: SUN,
    moon: { phase: 0.4, illumination: 95, angle: null },
    colors: { top: '#000000', mid: '#000000', bottom: '#000000', glow: '#000000' },
    ...over,
  };
}

describe('welcomeEyebrow', () => {
  it('abans que arribi el cel, només el dia i l\'hora', () => {
    expect(welcomeEyebrow(null, at(10, 30), 'ca-ES', w)).toEqual({ head: 'Dissabte, 10:30', moment: null, moon: false });
  });

  it('de dia amb la posició real, les hores del sol', () => {
    expect(welcomeEyebrow(sky({}), at(10, 30), 'ca-ES', w).moment).toBe('Sol de 08:12 a 18:59');
  });

  it('de dia amb només la zona horària, matí, migdia o tarda (cap hora que pugui anar desviada)', () => {
    const tz = { place: { lat: 40.42, lon: -3.7, source: 'timezone' as const } };
    expect(welcomeEyebrow(sky(tz), at(10, 30), 'ca-ES', w).moment).toBe('Matí');
    expect(welcomeEyebrow(sky({ ...tz, sunEast: true }), at(12, 50), 'ca-ES', w).moment).toBe('Migdia');
    expect(welcomeEyebrow(sky({ ...tz, sunEast: false }), at(14, 30), 'ca-ES', w).moment).toBe('Migdia');
    expect(welcomeEyebrow(sky({ ...tz, sunEast: false }), at(16, 0), 'ca-ES', w).moment).toBe('Tarda');
  });

  it('a l\'alba i a la posta, quan surt o es pon el sol (si encara no ho ha fet)', () => {
    expect(welcomeEyebrow(sky({ phase: 'alba' }), at(7, 50), 'ca-ES', w).moment).toBe('El sol surt a les 08:12');
    expect(welcomeEyebrow(sky({ phase: 'alba' }), at(8, 30), 'ca-ES', w).moment).toBe('Alba');
    expect(welcomeEyebrow(sky({ phase: 'posta', sunEast: false }), at(18, 20), 'ca-ES', w).moment).toBe('El sol es pon a les 18:59');
    expect(welcomeEyebrow(sky({ phase: 'posta', sunEast: false }), at(19, 5), 'ca-ES', w).moment).toBe('Posta de sol');
    expect(welcomeEyebrow(sky({ phase: 'posta', place: { lat: 40.42, lon: -3.7, source: 'timezone' } }), at(18, 20), 'ca-ES', w).moment).toBe('Posta de sol');
  });

  it('a la nit polar o al dia polar, sense hores', () => {
    const polar = sky({ sunTimes: { rise: null, set: null, noon: null }, sunEast: false });
    expect(welcomeEyebrow(polar, at(16, 0), 'ca-ES', w).moment).toBe('Tarda');
  });

  it('de nit, la fase en paraules de cada dia i amb la lluna dibuixada; sense lluna, "Nit"', () => {
    const night = sky({ phase: 'nit', sunAngle: null, moon: { phase: 0.4, illumination: 95, angle: 30 } });
    expect(welcomeEyebrow(night, at(22, 0), 'ca-ES', w)).toEqual({ head: 'Dissabte, 22:00', moment: 'Lluna gairebé plena', moon: true });
    const noMoon = sky({ phase: 'nit', sunAngle: null, moon: { phase: 0.4, illumination: 95, angle: null } });
    expect(welcomeEyebrow(noMoon, at(22, 0), 'ca-ES', w)).toEqual({ head: 'Dissabte, 22:00', moment: 'Nit', moon: false });
  });

  it('en anglès, amb el format d\'hora de l\'idioma', () => {
    expect(welcomeEyebrow(sky({}), at(10, 30), 'en-US', TRANSLATIONS.en.welcome).moment).toBe('Daylight 08:12 AM–06:59 PM');
  });
});

describe('welcomeMoonKey', () => {
  it('mai no contradiu la targeta Fase lunar i evita "gibosa"', () => {
    expect(welcomeMoonKey(0.1, 30)).toBe('moonWaxing');
    expect(welcomeMoonKey(0.25, 50)).toBe('moonFirstQuarter');
    expect(welcomeMoonKey(0.33, 70)).toBe('moonWaxing');
    expect(welcomeMoonKey(0.44, 95)).toBe('moonAlmostFull');
    expect(welcomeMoonKey(0.5, 100)).toBe('moonFull');
    // La nit després de la plena, al 99 %: la targeta diu gibosa minvant, aquí "gairebé plena", mai "plena".
    expect(welcomeMoonKey(0.53, 99)).toBe('moonAlmostFull');
    expect(welcomeMoonKey(0.68, 70)).toBe('moonWaning');
    expect(welcomeMoonKey(0.75, 50)).toBe('moonLastQuarter');
    expect(welcomeMoonKey(0.9, 25)).toBe('moonWaning');
    expect(welcomeMoonKey(0.99, 1)).toBe('moonNew');
  });

  it('cada clau té text a les quatre llengües', () => {
    for (const lang of ['ca', 'es', 'en', 'fr'] as const) {
      for (const p of [0, 0.1, 0.25, 0.44, 0.5, 0.75, 0.9]) {
        expect(TRANSLATIONS[lang].welcome[welcomeMoonKey(p, 95)]).toMatch(/\S/);
      }
    }
  });
});
