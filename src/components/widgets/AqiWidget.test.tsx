// src/components/widgets/AqiWidget.test.tsx
// Giny de Qualitat de l'aire: el desglossament de PM2.5, PM10, NO₂ i O₃ amb la barra del color de la banda del seu
// subíndex, i el nivell de l'índex amb les mateixes bandes que el modal.
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { AqiWidget } from './AqiWidget';
import AqiModal from '../AqiModal';
import type { AirQualityData } from '../../types/weather';

const CURRENT = {
    time: '2026-11-19T13:00', european_aqi: 55,
    pm2_5: 31.4, pm10: 40.2, nitrogen_dioxide: 22.2, ozone: 43,
    european_aqi_pm2_5: 55, european_aqi_pm10: 33, european_aqi_nitrogen_dioxide: 18, european_aqi_ozone: 12,
};

const rows = (container: HTMLElement) =>
    [...container.querySelectorAll<HTMLElement>('li[data-pollutant]')].map(li => ({
        key: li.dataset.pollutant,
        level: li.dataset.level ?? null,
        text: li.textContent,
        bar: li.querySelector<HTMLElement>('.h-full'),
    }));

afterEach(cleanup);

describe('AqiWidget — desglossament de contaminants', () => {
    it('els quatre contaminants, amb la xifra del modal (µg/m³) i el nivell del seu subíndex', () => {
        const { container } = render(<AqiWidget data={CURRENT} lang="ca" />);
        const r = rows(container);
        expect(r.map(x => x.key)).toEqual(['pm2_5', 'pm10', 'nitrogen_dioxide', 'ozone']);
        expect(r.map(x => x.level)).toEqual(['moderate', 'fair', 'good', 'good']);
        expect(r[0].text).toBe('PM2.531,4µg/m³');
        expect(r[2].text).toContain('NO₂');
        expect(screen.getByText('Contaminants')).toBeTruthy();
    });

    it('la barra té el color de la banda (el mateix que el nivell) i la llargada del subíndex sobre 120', () => {
        const { container } = render(<AqiWidget data={CURRENT} lang="ca" />);
        const [pm25, pm10] = rows(container);
        expect(pm25.bar?.className).toContain('bg-yellow-300');   // moderada
        expect(pm10.bar?.className).toContain('bg-emerald-500');  // raonable
        expect(pm25.bar?.style.width).toBe(`${(55 / 120) * 100}%`);
    });

    it('un 55 és "Moderada" (abans "Dolenta"), igual que al modal', () => {
        render(<AqiWidget data={CURRENT} lang="ca" />);
        expect(screen.getByText('MODERADA')).toBeTruthy();
        cleanup();
        const { container } = render(<AqiModal aqiData={{ current: CURRENT } as unknown as AirQualityData} onClose={() => {}} lang="ca" />);
        expect(container.textContent).toContain('Moderada');
        expect(container.textContent).not.toContain('Dolenta');
    });

    it('DOCTRINA RISC ZERO: sense subíndex, la barra queda buida; sense xifra, "--"', () => {
        const { container } = render(<AqiWidget data={{ european_aqi: 25, pm2_5: 8.1 }} lang="ca" />);
        const [pm25, pm10] = rows(container);
        expect(pm25.text).toContain('8,1');
        expect(pm25.bar).toBeNull();
        expect(pm10.text).toBe('PM10--');
        expect(pm10.bar).toBeNull();
    });

    it("el carril s'encén fins a l'índex amb el color de cada banda (6 punts per segment)", () => {
        const { container } = render(<AqiWidget data={{ european_aqi: 27 }} lang="en" />);
        const lit = [...container.querySelectorAll<HTMLElement>('[class*="flex-1 rounded-[1px]"]')].filter(s => s.style.opacity === '1');
        expect(lit).toHaveLength(5); // 0, 6, 12, 18 i 24
        expect(lit[3].className).toContain('bg-cyan-500');     // 18: bona
        expect(lit[4].className).toContain('bg-emerald-500');  // 24: raonable
        expect(screen.getByText('Pollutants')).toBeTruthy();
    });
});

describe("AqiModal — escala a l'eix vertical del gràfic de 48 h", () => {
    it('amb el sostre de 100, les línies cauen a les vores de les bandes: 20, 40, 60 i 80', () => {
        const aqi = {
            current: CURRENT,
            hourly: { time: ['2026-11-19T13:00', '2026-11-19T14:00', '2026-11-19T15:00'], european_aqi: [55, 50, 45] },
        } as unknown as AirQualityData;
        const { container } = render(<AqiModal aqiData={aqi} onClose={() => {}} lang="ca" />);
        expect([...container.querySelectorAll('[data-tick]')].map(s => s.textContent)).toEqual(['20', '40', '60', '80']);
    });
});
