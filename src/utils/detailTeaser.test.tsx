// src/utils/detailTeaser.test.tsx
// La targeta "Vols més detall?" ha de dir exactament el que després diuen els ginys de la vista completa.
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { buildDetailTeaser } from './detailTeaser';
import { getMoonPhase, getMoonPhaseName } from './lunarPhases';
import { ca } from '../translations/ca';
import { en } from '../translations/en';
import { AqiWidget } from '../components/widgets/AqiWidget';
import { MoonWidget } from '../components/widgets/MoonWidget';

const NOW = Date.UTC(2026, 9, 25, 16, 0);

const BASE = {
    current: { pressure_msl: 1018.6, visibility: 42300, precipitation: 0 },
    aqiCurrent: { european_aqi: 23 },
    effectiveCode: 0,
    nowMs: NOW,
    lang: 'ca',
    templates: ca.viewModes,
};

describe('buildDetailTeaser', () => {
    afterEach(cleanup);

    it('dona pressió, aire, lluna i visibilitat amb el format dels ginys', () => {
        const items = buildDetailTeaser(BASE);
        expect(items.map((i) => i.key)).toEqual(['pressure', 'air', 'moon', 'visibility']);
        expect(items[0].text).toBe('Pressió 1019 hPa'); // CircularGauge arrodoneix a l'enter
        expect(items[1].text).toBe("Qualitat de l'aire raonable");
        expect(items[2].text).toBe(getMoonPhaseName(getMoonPhase(new Date(NOW)), 'ca'));
        expect(items[3].text).toBe('Visibilitat 42.3 km');
    });

    it("el nivell d'aire i la fase lunar coincideixen amb el que pinten els ginys", () => {
        const items = buildDetailTeaser(BASE);
        render(<AqiWidget data={BASE.aqiCurrent} lang="ca" />);
        expect(screen.getByText('RAONABLE')).toBeTruthy();
        expect(items[1].text.toUpperCase()).toBe("QUALITAT DE L'AIRE RAONABLE");

        const phase = getMoonPhase(new Date(NOW));
        render(<MoonWidget phase={phase} date={NOW} lat={41.73} lon={1.82} lang="ca" />);
        expect(screen.getByText(items[2].text)).toBeTruthy();
    });

    it("amb boira confirmada fa servir el mateix límit que el giny de visibilitat", () => {
        const items = buildDetailTeaser({ ...BASE, current: { ...BASE.current, visibility: 5000 }, effectiveCode: 45 });
        expect(items.find((i) => i.key === 'visibility')?.text).toMatch(/^Visibilitat ≤\d/);
    });

    it("l'escala americana passa pels mateixos nivells", () => {
        const items = buildDetailTeaser({ ...BASE, aqiCurrent: { us_aqi: 120 } });
        expect(items.find((i) => i.key === 'air')?.text).toBe("Qualitat de l'aire sensible");
    });

    it('sense dades no inventa res: només hi queda la lluna, que és astronòmica', () => {
        const items = buildDetailTeaser({ ...BASE, current: {}, aqiCurrent: null });
        expect(items.map((i) => i.key)).toEqual(['moon']);
    });

    it("fa servir les plantilles de l'idioma actiu", () => {
        const items = buildDetailTeaser({ ...BASE, lang: 'en', templates: en.viewModes });
        expect(items[0].text).toBe('Pressure 1019 hPa');
        expect(items[1].text).toBe('Air quality: fair');
        expect(items[3].text).toBe('Visibility 42.3 km');
    });
});
