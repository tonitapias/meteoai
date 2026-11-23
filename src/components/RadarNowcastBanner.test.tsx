import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import RadarNowcastBanner from './RadarNowcastBanner';

const timing = vi.hoisted(() => ({ current: { type: 'start', inMinutes: 37 } as { type: 'start' | 'end'; inMinutes: number } | null }));
vi.mock('../hooks/useRadarNowcastTiming', () => ({ useRadarNowcastTiming: () => ({ transition: timing.current }) }));

describe('RadarNowcastBanner — pluja, neu o totes dues', () => {
    // Pica d'Estats, 23/11/2026: -8 °C, "Nevada moderada", i el banner deia "la pluja podria començar".
    it('si el que caurà és neu, parla de neu', () => {
        render(<RadarNowcastBanner lat={42.67} lon={1.4} lang="ca" kind="snow" />);
        expect(screen.getByText("Segons el radar, podria començar a nevar d'aquí a uns 37 min.")).toBeInTheDocument();
    });

    it('si és pluja (o no se sap), parla de pluja, com sempre', () => {
        render(<RadarNowcastBanner lat={41.39} lon={2.17} lang="ca" />);
        expect(screen.getByText("Segons el radar, la pluja podria començar d'aquí a uns 37 min.")).toBeInTheDocument();
    });

    it('si pot ser qualsevol de les dues, ho diu', () => {
        render(<RadarNowcastBanner lat={42.5} lon={1.7} lang="en" kind="mixed" />);
        expect(screen.getByText('Radar suggests rain or snow could start in about 37 min.')).toBeInTheDocument();
    });

    it('també quan s\'acaba ara mateix, en cada idioma', () => {
        timing.current = { type: 'end', inMinutes: 0 };
        render(<RadarNowcastBanner lat={42.67} lon={1.4} lang="es" kind="snow" />);
        expect(screen.getByText('Según el radar, podría estar dejando de nevar ahora mismo.')).toBeInTheDocument();
        timing.current = { type: 'start', inMinutes: 37 };
    });
});
