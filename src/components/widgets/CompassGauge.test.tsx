// src/components/widgets/CompassGauge.test.tsx
// Brúixola del vent (giny del Detall i WindModal, tots dos amb WindDial): la direcció és l'agulla de l'anell i la
// velocitat i les ratxes, l'arc de baix; l'arc no depèn de la direcció (abans sortia del Nord i semblava una direcció).
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { CompassGauge } from './CompassGauge';
import WindModal from '../WindModal';
import { speedArcPath, speedFraction } from '../../utils/windDial';
import type { ExtendedWeatherData } from '../../types/weatherLogicTypes';

const renderGauge = (props: { degrees?: number; speed?: number; gusts?: number }) =>
    render(<CompassGauge degrees={props.degrees} speed={props.speed} gusts={props.gusts} lang="ca" />);

const part = (container: HTMLElement, id: string) => container.querySelector(`[data-testid="${id}"]`);

afterEach(cleanup);

describe('CompassGauge — direcció i velocitat separades', () => {
    it("l'agulla va a l'angle d'on ve el vent; la velocitat, a l'arc de baix", () => {
        const { container } = renderGauge({ degrees: 225, speed: 29, gusts: 30 });
        expect((part(container, 'wind-dial-needle') as HTMLElement).dataset.deg).toBe('225');
        expect(part(container, 'wind-dial-speed')?.getAttribute('d')).toBe(speedArcPath(speedFraction(29), 100, 100, 60));
    });

    it("l'arc de velocitat és el mateix sigui quina sigui la direcció (abans, amb vent de SO, s'il·luminava entre el N i el NE)", () => {
        const arcFor = (degrees: number) => {
            const { container } = renderGauge({ degrees, speed: 29 });
            const d = part(container, 'wind-dial-speed')?.getAttribute('d');
            cleanup();
            return d;
        };
        const fromSouthWest = arcFor(225);
        expect(fromSouthWest).toBeTruthy();
        expect(arcFor(0)).toBe(fromSouthWest);
        expect(arcFor(90)).toBe(fromSouthWest);
    });

    it('ratxes: arc tènue i xip a sota, només quan superen la velocitat en més de 5 km/h', () => {
        const { container } = renderGauge({ degrees: 293, speed: 29, gusts: 63 });
        expect(part(container, 'wind-dial-gusts')?.getAttribute('d')).toBe(speedArcPath(speedFraction(63), 100, 100, 60));
        expect(screen.getByText('63')).toBeTruthy();
        cleanup();
        const calm = renderGauge({ degrees: 293, speed: 29, gusts: 32 });
        expect(part(calm.container, 'wind-dial-gusts')).toBeNull();
        expect(calm.container.textContent).not.toContain('32');
    });

    it("manté l'escala de Beaufort i la lectura en graus", () => {
        renderGauge({ degrees: 292.4, speed: 29 });
        expect(screen.getByText('292° O')).toBeTruthy();
        expect(screen.getByText('29')).toBeTruthy();
        expect(screen.getByText(/moderat/i)).toBeTruthy();
    });

    it('DOCTRINA RISC ZERO: sense dades, ni agulla ni arc, i "--"', () => {
        const { container } = render(<CompassGauge lang="ca" />);
        expect(part(container, 'wind-dial-needle')).toBeNull();
        expect(part(container, 'wind-dial-speed')).toBeNull();
        expect(screen.getByText('--')).toBeTruthy();
    });
});

describe('WindModal — la mateixa brúixola', () => {
    const weather = {
        current: { time: '2026-11-19T14:00', wind_speed_10m: 29, wind_direction_10m: 293, wind_gusts_10m: 63, is_day: 1 },
        hourly: {
            time: ['2026-11-19T14:00', '2026-11-19T15:00'],
            wind_speed_10m: [29, 27], wind_direction_10m: [293, 290], wind_gusts_10m: [63, 55],
        },
        daily: {},
    } as unknown as ExtendedWeatherData;

    it("agulla a l'angle del vent, arc de velocitat i de ratxes a baix, i el xip de ratxes", () => {
        const { container } = render(<WindModal weatherData={weather} onClose={() => {}} lang="ca" />);
        expect((part(container, 'wind-dial-needle') as HTMLElement).dataset.deg).toBe('293');
        expect(part(container, 'wind-dial-speed')?.getAttribute('d')).toBe(speedArcPath(speedFraction(29), 100, 100, 60));
        expect(part(container, 'wind-dial-gusts')).not.toBeNull();
        expect(container.textContent).toContain('293° NO');
    });

    it("escala a l'eix del gràfic de 48 h: km/h rodons de 0 al sostre (ratxa màx. 63 × 1,15)", () => {
        const { container } = render(<WindModal weatherData={weather} onClose={() => {}} lang="ca" />);
        expect([...container.querySelectorAll('[data-tick]')].map(s => s.textContent)).toEqual(['20', '40', '60']);
    });
});
