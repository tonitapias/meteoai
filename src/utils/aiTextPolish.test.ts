// src/utils/aiTextPolish.test.ts
import { describe, it, expect } from 'vitest';
import { polishAiText } from './aiTextPolish';

const ca = (t: string) => polishAiText(t, 'ca');

// Frases reals de Gemini i Groq (03-11-2026): cada regla amb l'error que la va motivar.
describe('polishAiText — errors mecànics del català de la IA', () => {
    it("apostrofa davant d'1 i d'11", () => {
        expect(ca('El cel està cobert i la temperatura és de 11 °C.')).toBe("El cel està cobert i la temperatura és d'11 °C.");
        expect(ca('amb una temperatura actual de 1 °C')).toBe("amb una temperatura actual d'1 °C");
        expect(ca('De 11 °C es passarà a 8 °C.')).toBe("D'11 °C es passarà a 8 °C.");
        // No s'apostrofa davant de consonant (8 = "vuit", 12 = "dotze", -1 = "menys u") ni dins d'un nombre més llarg.
        expect(ca('una temperatura de 8 °C, de 12 °C, de -1 °C, de 110 mm i de 19 km/h')).toBe('una temperatura de 8 °C, de 12 °C, de -1 °C, de 110 mm i de 19 km/h');
    });

    // Gemini amb la regla de llengua del prompt (03-11-2026): "d'5 °C", "d'19 °C", "d'13 °C".
    it("desfà l'apostrofació davant de qualsevol altre nombre", () => {
        expect(ca("baixarà fins a uns 5 °C, amb una mínima d'5 °C i una màxima d'19 °C")).toBe('baixarà fins a uns 5 °C, amb una mínima de 5 °C i una màxima de 19 °C');
        expect(ca("D'13 °C a 10 °C, d'110 mm i d'-1 °C")).toBe('De 13 °C a 10 °C, de 110 mm i de -1 °C');
        // Les bones es queden.
        const ok = "una temperatura d'11 °C, d'1 °C i d'1,5 mm, i l'estat d'alerta";
        expect(ca(ok)).toBe(ok);
    });

    // Gemini, 03-11-2026: "Ara mateix tenim el cel cobert amb plugim feble i fa d'11 °C."
    it('"fer" no porta "de" davant de la temperatura', () => {
        expect(ca("el cel cobert amb plugim feble i fa d'11 °C.")).toBe('el cel cobert amb plugim feble i fa 11 °C.');
        expect(ca('Fa de 5 °C i demà farà de -1 °C.')).toBe('Fa 5 °C i demà farà -1 °C.');
        // "una temperatura de 5 °C", "fa un dia de 20 °C" i "fa de mal dir" no es toquen.
        const ok = 'Fa una temperatura de 5 °C, fa un dia de 20 °C i fa de mal dir.';
        expect(ca(ok)).toBe(ok);
    });

    it("posa l'article davant de l'hora, i la una és singular", () => {
        expect(ca('El cel està completament tapat amb 11 °C a 17:00.')).toBe("El cel està completament tapat amb 11 °C a les 17:00.");
        expect(ca('Plourà de 09:00 fins a 14:00 amb intensitat feble.')).toBe('Plourà de les 09:00 fins a les 14:00 amb intensitat feble.');
        expect(ca('entre les 16:00 i 18:00')).toBe('entre les 16:00 i les 18:00');
        expect(ca('Pot ploure cap a 01:00 i fins a les 1:00.')).toBe('Pot ploure cap a la 01:00 i fins a la 1:00.');
        expect(ca('De 09:00 a 11:00')).toBe('De les 09:00 a les 11:00');
        // Ja correcte: no es toca.
        expect(ca('A partir de les 20:00 i fins cap a les 22:00, i a la 1:00.')).toBe('A partir de les 20:00 i fins cap a les 22:00, i a la 1:00.');
    });

    it("l'adjectiu no fa d'adverbi després de ploure o nevar", () => {
        expect(ca('A partir de les 20:00 pot ploure moderada fins a les 22:00.')).toBe('A partir de les 20:00 pot ploure de manera moderada fins a les 22:00.');
        expect(ca('Plourà moderada entre les 02:00 i les 03:00.')).toBe('Plourà de manera moderada entre les 02:00 i les 03:00.');
        expect(ca('Pot ploure feble cap a les 20:00.')).toBe('Pot ploure de manera feble cap a les 20:00.');
        expect(ca('Nevarà forta a la tarda.')).toBe('Nevarà de manera forta a la tarda.');
        expect(ca('Cap a les 20:00 pot ploure amb moderada intensitat.')).toBe('Cap a les 20:00 pot ploure amb intensitat moderada.');
        // Correctes: "plou fort" (adverbi), "pluja feble" i "nevada moderada" (noms), "plourà moderadament".
        const ok = 'Ara plou fort; després hi haurà pluja feble, una nevada moderada i plourà moderadament.';
        expect(ca(ok)).toBe(ok);
    });

    it('canvia els calcs del castellà que es repetien', () => {
        expect(ca('El cel està completament tapat amb 11 °C en aquests moments.')).toBe('El cel està completament tapat amb 11 °C ara mateix.');
        expect(ca('De cara al vespre, el termòmetre baixarà.')).toBe('Cap al vespre, el termòmetre baixarà.');
        expect(ca('i de cara a la nit refrescarà')).toBe('i cap a la nit refrescarà');
        // "en aquest moment" és correcte.
        expect(ca('Fa 11 °C en aquest moment.')).toBe('Fa 11 °C en aquest moment.');
    });

    it('espai abans de °C i coma decimal davant d\'una unitat, però no a les hores', () => {
        expect(ca('la temperatura és -1°C i baixarà a -3°C')).toBe('la temperatura és -1 °C i baixarà a -3 °C');
        expect(ca('amb un total previst de 4.8 mm i 2.4 mm/h')).toBe('amb un total previst de 4,8 mm i 2,4 mm/h');
        expect(ca('a les 20.00 h')).toBe('a les 20.00 h');
    });

    it('un text correcte surt igual', () => {
        const good = "Ara el cel està cobert i fa 11 °C. Cap a les 20:00 pot ploure de manera moderada fins cap a les 22:00.";
        expect(ca(good)).toBe(good);
    });

    it('els altres idiomes no es toquen', () => {
        const es = 'La temperatura es de 11 °C a 17:00 y puede llover moderada.';
        expect(polishAiText(es, 'es')).toBe(es);
        expect(polishAiText('It is 11°C at 17:00.', 'en')).toBe('It is 11°C at 17:00.');
        expect(polishAiText('Il fait 11 °C à 17:00.', 'fr')).toBe('Il fait 11 °C à 17:00.');
    });
});
