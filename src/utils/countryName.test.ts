import { describe, it, expect } from 'vitest';
import { countryCodeFromName, localizeCountryName } from './countryName';

// Auditoria d'UX, segona volta (A4): un enllaç fet en català (`pais=Espanya`) obert en castellà o en francès deia «ESPANYA».
describe('Nom del país en l\'idioma de l\'app', () => {
    it("reconeix el nom en qualsevol dels quatre idiomes, sense fer cas de majúscules ni d'accents", () => {
        for (const name of ['Espanya', 'España', 'Spain', 'Espagne', 'ESPANYA', 'espana']) {
            expect(countryCodeFromName(name), name).toBe('ES');
        }
        expect(countryCodeFromName('França')).toBe('FR');
        expect(countryCodeFromName('Alemanya')).toBe('DE');
        expect(countryCodeFromName('Royaume-Uni')).toBe('GB');
    });

    it('el torna en l\'idioma de l\'app', () => {
        expect(localizeCountryName('Espanya', 'es')).toBe('España');
        expect(localizeCountryName('Espanya', 'fr')).toBe('Espagne');
        expect(localizeCountryName('Espanya', 'en')).toBe('Spain');
        expect(localizeCountryName('España', 'ca')).toBe('Espanya');
        expect(localizeCountryName('Germany', 'ca')).toBe('Alemanya');
    });

    it('si no el reconeix, el deixa com és', () => {
        expect(localizeCountryName('Local', 'es')).toBe('Local');
        expect(localizeCountryName('Catalunya Nord', 'fr')).toBe('Catalunya Nord');
        expect(localizeCountryName('', 'es')).toBe('');
        expect(localizeCountryName(undefined, 'es')).toBeUndefined();
    });
});
