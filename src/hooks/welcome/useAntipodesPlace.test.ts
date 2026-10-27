import { describe, expect, it } from 'vitest';
import { parseReversePlace } from './useAntipodesPlace';

describe('parseReversePlace', () => {
  it('a terra, el poble i el país', () => {
    expect(parseReversePlace({ city: '', locality: 'Weber', countryName: 'Nova Zelanda', localityInfo: { informative: [] } }))
      .toEqual({ locality: 'Weber', country: 'Nova Zelanda', sea: null });
  });

  it("al mar, el nom de l'oceà (de la llista informativa o, sense país, de la localitat)", () => {
    expect(parseReversePlace({ locality: '', countryName: '', localityInfo: { informative: [{ name: 'Oceà Pacífic', description: 'oceà' }] } }))
      .toEqual({ locality: null, country: null, sea: 'Oceà Pacífic' });
    expect(parseReversePlace({ locality: 'South Pacific Ocean', countryName: '' }))
      .toEqual({ locality: null, country: null, sea: 'South Pacific Ocean' });
  });

  it('sense resposta, res', () => {
    expect(parseReversePlace(null)).toEqual({ locality: null, country: null, sea: null });
  });
});
