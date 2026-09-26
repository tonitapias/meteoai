import { describe, it, expect } from 'vitest';
import { applyShowerSky, applyTropicalRainGate } from './precipitationRules';

describe('applyTropicalRainGate', () => {
    it('pluja feble (< 0,5 mm) sense el cel quasi tapat no es pinta: queda el cel', () => {
        expect(applyTropicalRainGate(51, 0.1, 5)).toBe(0);
        expect(applyTropicalRainGate(51, 0.1, 30)).toBe(1);
        expect(applyTropicalRainGate(61, 0.4, 50)).toBe(2);
        expect(applyTropicalRainGate(80, 0.2, 40)).toBe(1);
    });

    it('amb el cel quasi tapat (> 85 %) la pluja feble es manté', () => {
        expect(applyTropicalRainGate(51, 0.1, 86)).toBe(51);
        expect(applyTropicalRainGate(51, 0.1, 85)).toBe(2);
    });

    it('a partir de 0,5 mm la pluja es manté sigui quin sigui el cel', () => {
        expect(applyTropicalRainGate(61, 0.5, 30)).toBe(61);
        expect(applyTropicalRainGate(80, 3, 10)).toBe(80);
    });

    it('no toca mai la tempesta, la neu, l\'aiguaneu, la pluja engelant ni el cel', () => {
        expect(applyTropicalRainGate(95, 0.1, 70)).toBe(95);
        expect(applyTropicalRainGate(71, 0.1, 30)).toBe(71);
        expect(applyTropicalRainGate(68, 0.1, 30)).toBe(68);
        expect(applyTropicalRainGate(66, 0.1, 30)).toBe(66);
        expect(applyTropicalRainGate(56, 0.1, 30)).toBe(56);
        expect(applyTropicalRainGate(3, 0, 30)).toBe(3);
        expect(applyTropicalRainGate(45, 0, 30)).toBe(45);
    });
});

describe('applyShowerSky', () => {
    it('pluja o plugim amb el cel trencat (<= 60 %) és un ruixat, amb la intensitat de la pluja', () => {
        expect(applyShowerSky(61, 0.3, 40)).toBe(80);
        expect(applyShowerSky(51, 0.2, 60)).toBe(80);
        expect(applyShowerSky(63, 2.0, 40)).toBe(81);
        expect(applyShowerSky(65, 5.0, 40)).toBe(82);
    });

    it('amb el cel més tapat (> 60 %) la pluja i el plugim es mantenen', () => {
        expect(applyShowerSky(61, 0.3, 61)).toBe(61);
        expect(applyShowerSky(51, 0.1, 90)).toBe(51);
    });

    it('mai al revés: un ruixat del model amb el cel tapat continua sent ruixat', () => {
        expect(applyShowerSky(80, 0.3, 95)).toBe(80);
    });

    it('no toca la tempesta, la neu, l\'aiguaneu ni la pluja engelant', () => {
        expect(applyShowerSky(95, 1, 30)).toBe(95);
        expect(applyShowerSky(71, 1, 30)).toBe(71);
        expect(applyShowerSky(69, 1, 30)).toBe(69);
        expect(applyShowerSky(66, 1, 30)).toBe(66);
        expect(applyShowerSky(57, 1, 30)).toBe(57);
    });
});
