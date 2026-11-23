// src/components/WeatherCharts.test.tsx
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { MinutelyPreciseChart } from './WeatherCharts';

const LABEL = 'Previsió Immediata (1h)';

describe('MinutelyPreciseChart', () => {
    afterEach(cleanup);

    // Abans la targeta (bento-card p-5) es pintava a DashboardContent tant si el gràfic tenia res a
    // mostrar com si no: sense pluja quedava una franja buida d'uns 42 px sota la targeta principal.
    it.each([
        ['sense pluja la pròxima hora', [0, 0, 0, 0]],
        ['valors buits o no numèrics', [null, Number.NaN, null, 0]],
        ['cap quart d\'hora', []],
    ])('%s: no pinta res, ni tan sols la targeta', (_case, data) => {
        const { container } = render(<MinutelyPreciseChart data={data} label={LABEL} />);
        expect(container.innerHTML).toBe('');
    });

    // Pas de la Casa, 23/11/2026: "Nevada feble" i la targeta deia "0,0mm" quatre vegades.
    it('si ara neva, les quantitats surten en cm (mm d\'aigua × 0,7) i una traça diu "<0,1"', () => {
        render(<MinutelyPreciseChart data={[1, 0.03, 0.5, 0]} label={LABEL} snow />);
        expect(screen.getByText('0,7')).toBeTruthy();
        expect(screen.getByText('<0,1')).toBeTruthy();
        expect(screen.getByText('0,4')).toBeTruthy(); // 0,5 mm → 0,35 cm
        expect(screen.getAllByText('cm')).toHaveLength(3);
        expect(screen.queryByText('mm')).toBeNull();
    });

    it('si plou, en mm, i tampoc no diu mai "0,0"', () => {
        render(<MinutelyPreciseChart data={[0.03, 0.4]} label={LABEL} />);
        expect(screen.getByText('<0,1')).toBeTruthy();
        expect(screen.getByText('0,4')).toBeTruthy();
        expect(screen.getAllByText('mm')).toHaveLength(2);
    });

    it('amb pluja: la targeta porta el gràfic amb els quatre quarts d\'hora', () => {
        const { container } = render(<MinutelyPreciseChart data={[0, 0.3, 1.2]} label={LABEL} />);
        const card = container.firstElementChild;
        expect(card?.classList.contains('bento-card')).toBe(true);
        expect(card?.contains(screen.getByText(LABEL))).toBe(true);
        expect(screen.getByText('0,3')).toBeTruthy();
        expect(screen.getByText('1,2')).toBeTruthy();
        // el quart sense pluja i el que faltava (s'omple fins a quatre) surten com a "-"
        expect(screen.getAllByText('-')).toHaveLength(2);
    });
});
