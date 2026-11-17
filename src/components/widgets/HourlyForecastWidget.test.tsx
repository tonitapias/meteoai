// src/components/widgets/HourlyForecastWidget.test.tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { HourlyForecastWidget } from './HourlyForecastWidget';

// Auditoria d'UX del 16/11/2026 (B6): "19H 96 %" i "20H 4 mm" a la mateixa franja, sense llegenda.
const hour = (time: string, precipText: string) => ({ time, temp: 18, icon: null, precip: 0, precipText, isNow: false });

describe('HourlyForecastWidget — llegenda de la pluja', () => {
    it('amb xifres de pluja, la llegenda diu què és cada unitat', () => {
        render(<HourlyForecastWidget lang="ca" data={[hour('19H', '96%'), hour('20H', '4 mm')] as never} />);
        expect(screen.getByText('% probabilitat · mm quantitat')).toBeInTheDocument();
    });

    it('sense cap xifra de pluja, no hi ha llegenda', () => {
        render(<HourlyForecastWidget lang="es" data={[hour('19H', ''), hour('20H', '')] as never} />);
        expect(screen.queryByText('% probabilidad · mm cantidad')).toBeNull();
    });
});
