// src/components/radar/RadarPlaybackControls.test.tsx
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import '../../i18n';
import i18n from 'i18next';
import { RadarPlaybackControls } from './RadarPlaybackControls';

// Auditoria d'UX del 16/11/2026 (M6): amb l'animació aturada posava "Captura actual 19:20" a les 20:23.
const NOW_S = 1_794_870_000;
const renderAt = (ageMin: number, isPlaying = false) => render(
    <RadarPlaybackControls isPlaying={isPlaying} togglePlay={() => {}} framesCount={12} currentFrameTimestamp={NOW_S - ageMin * 60}
        formatTime={() => '19:20'} loading={false} onRefresh={() => {}} timeDisplayRef={{ current: null }} />
);

describe('RadarPlaybackControls — edat de la imatge en pausa', () => {
    afterEach(() => { vi.useRealTimers(); });

    it('una imatge de fa 63 min ho diu, en lloc de "captura actual"', async () => {
        await i18n.changeLanguage('ca');
        vi.useFakeTimers();
        vi.setSystemTime(NOW_S * 1000);
        renderAt(63);
        await act(async () => { await vi.advanceTimersByTimeAsync(1); });
        expect(screen.getByText('IMATGE DE FA 63 MIN')).toBeInTheDocument();
    });

    it('una imatge recent (fins a 10 min) continua sent la captura actual', async () => {
        await i18n.changeLanguage('ca');
        vi.useFakeTimers();
        vi.setSystemTime(NOW_S * 1000);
        renderAt(6);
        await act(async () => { await vi.advanceTimersByTimeAsync(1); });
        expect(screen.getByText('CAPTURA ACTUAL')).toBeInTheDocument();
    });
});
