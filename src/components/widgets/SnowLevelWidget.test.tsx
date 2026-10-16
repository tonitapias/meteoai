// src/components/widgets/SnowLevelWidget.test.tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SnowLevelWidget } from './SnowLevelWidget';
import { buildSnowLevelWindow } from '../../utils/snowLevelWindow';

// 48 hores a partir de les 20:00: la cota baixa de 1.800 m a 900 m a les 14 h i torna a pujar.
const hours = (levels: (number | null)[]) => levels.map((snowLevel, i) => {
    const d = new Date(Date.UTC(2026, 9, 16, 20 + i));
    return { time: d.toISOString().slice(0, 16), snowLevel };
});
const DIP = Array.from({ length: 48 }, (_, i) => 900 + Math.abs(i - 14) * 60);

describe('buildSnowLevelWindow', () => {
    it('agafa les 48 primeres hores, la primera hora amb la cota mínima i la màxima', () => {
        const w = buildSnowLevelWindow(hours([...DIP, 100, 100]));
        expect(w.entries).toHaveLength(48);
        expect(w.min).toEqual({ idx: 14, value: 900 });
        expect(w.max).toBe(900 + 33 * 60);
    });

    it('les hores sense dada queden com a null i no compten per a la mínima', () => {
        const w = buildSnowLevelWindow(hours([null, 1200, Number.NaN, 1100]));
        expect(w.entries.map(e => e.snowLevel)).toEqual([null, 1200, null, 1100]);
        expect(w.min).toEqual({ idx: 3, value: 1100 });
    });

    it('sense sèrie no hi ha ni mínima ni màxima', () => {
        expect(buildSnowLevelWindow(undefined)).toEqual({ entries: [], min: null, max: null });
    });
});

describe('SnowLevelWidget', () => {
    it('ensenya la cota d\'ara (isoterma − 300 m), la isoterma i la mínima de 48 h amb quan arriba', () => {
        render(<SnowLevelWidget freezingLevel={2040} chartData={hours(DIP)} elevation={1608} unit="C" lang="ca" />);
        expect(screen.getByText('1740')).toBeTruthy();
        expect(screen.getByText('0 °C · 2040 m')).toBeTruthy();
        expect(screen.getByText("900 m · d'aquí a 14 h")).toBeTruthy();
        expect(screen.getByText('Aquí · 1608 m')).toBeTruthy();
    });

    it('si la mínima és ara mateix ho diu així, i en peus quan la unitat és °F', () => {
        render(<SnowLevelWidget freezingLevel={1200} chartData={hours([900, 1000, 1100])} unit="F" lang="en" />);
        expect(screen.getByText('2953')).toBeTruthy();
        expect(screen.getByText('FEET')).toBeTruthy();
        expect(screen.getByText('2953 ft · right now')).toBeTruthy();
    });

    it('sense sèrie horària encara mostra la cota d\'ara, sense mínima ni eix de temps', () => {
        render(<SnowLevelWidget freezingLevel={1500} unit="C" lang="es" />);
        expect(screen.getByText('1200')).toBeTruthy();
        expect(screen.queryByText('Mínima 48 h')).toBeNull();
        expect(screen.queryByText('+48 h')).toBeNull();
    });

    it('sense isoterma vàlida diu que no hi ha dades', () => {
        render(<SnowLevelWidget freezingLevel={Number.NaN} unit="C" lang="fr" />);
        expect(screen.getByText('--')).toBeTruthy();
        expect(screen.getByText('PAS DE DONNÉES')).toBeTruthy();
    });
});
