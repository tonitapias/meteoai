// src/components/radar/RadarPlaybackControls.test.tsx
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, act, fireEvent } from '@testing-library/react';
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

// Auditoria d'UX, segona volta (M6): no hi havia cap manera de moure's pels fotogrames.
describe('RadarPlaybackControls — barra de temps', () => {
    afterEach(() => { vi.useRealTimers(); });

    const TIMES = [NOW_S - 60 * 60, NOW_S - 50 * 60, NOW_S - 40 * 60, NOW_S - 30 * 60];
    const hhmm = (ts?: number | null) => (ts ? new Date(ts * 1000).toISOString().slice(11, 16) : '--:--');
    const renderBar = (frameIndex: number, onSeek = vi.fn(), frameTimes = TIMES) => {
        render(<RadarPlaybackControls isPlaying={false} togglePlay={() => {}} framesCount={frameTimes.length} currentFrameTimestamp={frameTimes[frameIndex]}
            formatTime={hhmm} loading={false} onRefresh={() => {}} timeDisplayRef={{ current: null }}
            frameIndex={frameIndex} frameTimes={frameTimes} onSeek={onSeek} />);
        return onSeek;
    };

    it('és un control lliscant amb nom, del primer a l\'últim fotograma, i diu l\'hora i quant fa', async () => {
        await i18n.changeLanguage('ca');
        vi.useFakeTimers();
        vi.setSystemTime(NOW_S * 1000);
        renderBar(1);
        await act(async () => { await vi.advanceTimersByTimeAsync(1); });
        const slider = screen.getByRole('slider', { name: 'Hora de la imatge del radar' });
        expect(slider).toHaveAttribute('min', '0');
        expect(slider).toHaveAttribute('max', '3');
        expect(slider).toHaveValue('1');
        expect(slider).toHaveAttribute('aria-valuetext', `${hhmm(TIMES[1])}, fa 50 min`);
        // Les hores dels extrems.
        expect(screen.getByText(hhmm(TIMES[0]))).toBeInTheDocument();
        expect(screen.getByText(hhmm(TIMES[3]))).toBeInTheDocument();
    });

    it("a l'últim fotograma diu que és el més recent", async () => {
        await i18n.changeLanguage('ca');
        renderBar(3);
        expect(screen.getByRole('slider')).toHaveAttribute('aria-valuetext', `${hhmm(TIMES[3])}, la més recent`);
    });

    it('moure-la demana anar a aquell fotograma', async () => {
        await i18n.changeLanguage('ca');
        const onSeek = renderBar(3);
        fireEvent.change(screen.getByRole('slider'), { target: { value: '0' } });
        expect(onSeek).toHaveBeenCalledWith(0);
    });

    it('amb un sol fotograma (o cap) no hi és', async () => {
        await i18n.changeLanguage('ca');
        renderBar(0, vi.fn(), [NOW_S]);
        expect(screen.queryByRole('slider')).toBeNull();
    });

    it('en els altres idiomes', async () => {
        await i18n.changeLanguage('en');
        vi.useFakeTimers();
        vi.setSystemTime(NOW_S * 1000);
        renderBar(2);
        await act(async () => { await vi.advanceTimersByTimeAsync(1); });
        expect(screen.getByRole('slider', { name: 'Radar image time' })).toHaveAttribute('aria-valuetext', `${hhmm(TIMES[2])}, 40 min ago`);
        await i18n.changeLanguage('ca');
    });
});
