import { afterEach, describe, expect, it, vi } from 'vitest';
import { markSecretFound } from './secretsFound';

describe('markSecretFound', () => {
  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('compta cada secret una sola vegada', () => {
    expect(markSecretFound('earth')).toBe(1);
    expect(markSecretFound('earth')).toBe(1);
    expect(markSecretFound('sky')).toBe(2);
  });

  it("no es refia del que hi hagi desat i, sense emmagatzematge, compta aquest", () => {
    localStorage.setItem('meteoai_secrets_found', '{"no":"és una llista"}');
    expect(markSecretFound('sky')).toBe(1);
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('bloquejat'); });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('bloquejat'); });
    expect(markSecretFound('earth')).toBe(1);
  });
});
