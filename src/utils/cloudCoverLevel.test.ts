import { describe, it, expect } from 'vitest';
import { cloudCoverLevel, effectiveCloudCoverNow, CLOUD_LEVEL_LABEL } from './cloudCoverLevel';
import { WEATHER_THRESHOLDS } from '../constants/weatherConfig';
import { getRealTimeWeatherCode } from './weatherLogic';
import { getWeatherLabel } from './formatters';
import type { Language } from '../translations';
import type { StrictCurrentWeather } from '../types/weatherLogicTypes';

const { CLOUDS } = WEATHER_THRESHOLDS;
const LANGS: Language[] = ['ca', 'es', 'en', 'fr'];

describe('cloudCoverLevel — els cinc estats de la capçalera', () => {
  it('talla a FEW, SCATTERED, MOSTLY_CLOUDY i OVERCAST com la capçalera (el llindar és encara del nivell de sota)', () => {
    expect(cloudCoverLevel(0)).toBe('clear');
    expect(cloudCoverLevel(CLOUDS.FEW)).toBe('clear');
    expect(cloudCoverLevel(CLOUDS.FEW + 0.1)).toBe('mostlyClear');
    expect(cloudCoverLevel(CLOUDS.SCATTERED)).toBe('mostlyClear');
    expect(cloudCoverLevel(CLOUDS.SCATTERED + 0.1)).toBe('partial');
    expect(cloudCoverLevel(CLOUDS.MOSTLY_CLOUDY)).toBe('partial');
    expect(cloudCoverLevel(CLOUDS.MOSTLY_CLOUDY + 0.1)).toBe('veryCloudy');
    expect(cloudCoverLevel(CLOUDS.OVERCAST)).toBe('veryCloudy');
    expect(cloudCoverLevel(CLOUDS.OVERCAST + 0.1)).toBe('overcast');
    expect(cloudCoverLevel(100)).toBe('overcast');
  });

  it('té etiqueta per a cada nivell en els 4 idiomes', () => {
    for (const labels of Object.values(CLOUD_LEVEL_LABEL)) {
      for (const k of ['clear', 'mostlyClear', 'partial', 'veryCloudy', 'overcast', 'unknown'] as const) expect(labels[k]).toBeTruthy();
    }
  });

  it('les etiquetes són les de la capçalera, amb la primera lletra en majúscula', () => {
    expect(CLOUD_LEVEL_LABEL.ca).toMatchObject({
      clear: 'Cel serè', mostlyClear: 'Majorment serè', partial: 'Parcialment ennuvolat', veryCloudy: 'Molt ennuvolat', overcast: 'Cel cobert',
    });
    expect(CLOUD_LEVEL_LABEL.es.clear).toBe('Cielo despejado');
    expect(CLOUD_LEVEL_LABEL.fr.overcast).toBe('Ciel couvert');
  });
});

// El cas de l'auditoria del 16/11/2026: Barcelona, a les 20:18, "Majorment serè" a la capçalera i "Parcialment
// ennuvolat" a Detall amb la mateixa cobertura efectiva del 43 % (núvols alts al 100 %). Detall i capçalera han de
// dir sempre el mateix: es comprova amb el codi real de la capçalera (getRealTimeWeatherCode + getWeatherLabel).
describe('Detall diu el mateix que la capçalera', () => {
  const headerLabel = (low: number, mid: number, high: number, lang: Language): string => {
    const current = {
      weather_code: 2, temperature_2m: 15, relative_humidity_2m: 50, precipitation: 0, cape: 0, visibility: 20000,
      cloud_cover_low: low, cloud_cover_mid: mid, cloud_cover_high: high,
    } as unknown as StrictCurrentWeather;
    const code = getRealTimeWeatherCode(current, [0, 0, 0, 0], 0, 2500, 0);
    const effective = effectiveCloudCoverNow(low, mid, high);
    return getWeatherLabel({ ...current, weather_code: code } as StrictCurrentWeather, lang, effective);
  };
  const detailLabel = (low: number, mid: number, high: number, lang: Language): string =>
    CLOUD_LEVEL_LABEL[lang][cloudCoverLevel(effectiveCloudCoverNow(low, mid, high) as number)];

  it('per a cada % de 0 a 100 i en els 4 idiomes', () => {
    for (const lang of LANGS) {
      for (let p = 0; p <= 100; p++) {
        expect(detailLabel(p, 0, 0, lang).toLocaleLowerCase(lang), `${lang} ${p} %`).toBe(headerLabel(p, 0, 0, lang).toLocaleLowerCase(lang));
      }
    }
  });

  it('un vel de núvols alts al 100 % (43 % efectiu) és "Majorment serè" a tot arreu', () => {
    expect(effectiveCloudCoverNow(0, 22, 100)).toBeCloseTo(43.2);
    expect(detailLabel(0, 22, 100, 'ca')).toBe('Majorment serè');
    expect(headerLabel(0, 22, 100, 'ca')).toBe('Majorment serè');
  });
});

describe('effectiveCloudCoverNow', () => {
  it('pondera baixos 1, mitjans 0,6 i alts 0,3, amb sostre de 100', () => {
    expect(effectiveCloudCoverNow(20, 10, 30)).toBeCloseTo(35);
    expect(effectiveCloudCoverNow(46, 100, 100)).toBe(100);
  });

  it('una capa que falta compta com a 0; si falten totes, null (no 0 %)', () => {
    expect(effectiveCloudCoverNow(12, null, 64)).toBeCloseTo(12 + 0.3 * 64);
    expect(effectiveCloudCoverNow(undefined, NaN, 50)).toBeCloseTo(15);
    expect(effectiveCloudCoverNow(null, undefined, NaN)).toBeNull();
    expect(effectiveCloudCoverNow(0, 0, 0)).toBe(0);
  });
});
