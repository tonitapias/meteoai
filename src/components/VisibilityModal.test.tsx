import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import VisibilityModal from './VisibilityModal';
import { resolveCurrentDisplayVisibility } from '../utils/visibilityDisplay';
import type { ExtendedWeatherData } from '../types/weatherLogicTypes';

/**
 * Nit amb el senyal de boira d'ICON (codi 45 + visibilitat < 1 km) com la de Vic (18→19/09/2026).
 * Només varia la humitat: HR 94 % (T−Td ≈ 1 °C) NO confirma la boira; HR 99 % sí.
 */
const buildWeather = (rh: number, visibility = 840): ExtendedWeatherData => {
    const n = 24;
    const arr = <T,>(v: T) => Array.from({ length: n }, () => v);
    return {
        elevation: 504,
        current: {
            time: '2026-09-19T00:00', weather_code: 45, temperature_2m: 15.2, relative_humidity_2m: rh,
            wind_speed_10m: 3, is_day: 0, precipitation: 0, visibility,
        },
        hourly: {
            time: Array.from({ length: n }, (_, i) => `2026-09-19T${String(i).padStart(2, '0')}:00`),
            weather_code: arr(45), visibility: arr(visibility),
            temperature_2m: arr(15.2), relative_humidity_2m: arr(rh), precipitation: arr(0),
            // Capa baixa: la boira n'implica una (la política de boira exigeix >= CLOUDS.FOG_MIN_LOW).
            cloud_cover_low: arr(100), cloud_cover_mid: arr(0), cloud_cover_high: arr(0),
            wind_speed_10m: arr(3), is_day: arr(0), cape: arr(0), freezing_level_height: arr(4000),
        },
        daily: {}, hourlyComparison: {},
    } as unknown as ExtendedWeatherData;
};

/** Número gran del hero ("Visibilitat Actual"), aïllat de la resta de xifres del modal. */
const heroValue = (container: HTMLElement) => container.querySelector('span.text-5xl')?.textContent;

describe('VisibilityModal — alineat amb la política de boira', () => {
    it('ICON diu boira però la saturació no ho confirma: "≥2 km · Calitja", cap avís de boira i nota explicativa', () => {
        const weather = buildWeather(94);
        const { container } = render(<VisibilityModal weatherData={weather} effectiveCode={3} onClose={() => {}} lang="ca" />);
        const text = container.textContent ?? '';
        expect(heroValue(container)).toBe('≥2');
        expect(text).toContain('Calitja');
        expect(text).toContain('Sense boira prevista en 48h');
        expect(text).not.toContain('Activa ara mateix');
        expect(text).toContain('≥ / ≤');           // nota explicativa
    });

    it('les hores amb límit "≥ 2 km" no es compten com a visibilitat reduïda', () => {
        const { container } = render(<VisibilityModal weatherData={buildWeather(94)} effectiveCode={3} onClose={() => {}} lang="ca" />);
        expect(container.textContent).toContain('Hores amb Visibilitat Reduïda');
        expect(container.textContent).toContain('0h');
    });

    it('amb boira confirmada totes les hores de la finestra compten com a visibilitat reduïda', () => {
        const { container } = render(<VisibilityModal weatherData={buildWeather(99)} effectiveCode={45} onClose={() => {}} lang="ca" />);
        expect(container.textContent).toContain('24h');
    });

    it('amb boira confirmada: valor del model, "Boira" i avís actiu ara mateix', () => {
        const weather = buildWeather(99);
        const { container } = render(<VisibilityModal weatherData={weather} effectiveCode={45} onClose={() => {}} lang="ca" />);
        const text = container.textContent ?? '';
        expect(heroValue(container)).toBe('0.8');
        expect(text).toContain('Boira');
        expect(text).toContain('Activa ara mateix');
        expect(text).not.toContain('Sense boira prevista en 48h');
    });

    it('amb boira confirmada però visibilitat de model alta: "≤1 km"', () => {
        const weather = buildWeather(99, 3200);
        const { container } = render(<VisibilityModal weatherData={weather} effectiveCode={45} onClose={() => {}} lang="ca" />);
        expect(heroValue(container)).toBe('≤1');
    });

    it('el valor "ara" del modal és el mateix que resol el giny (font única)', () => {
        const weather = buildWeather(94);
        const expected = resolveCurrentDisplayVisibility(weather.current, 3);
        expect(expected).toEqual({ meters: 2000, bound: 'min' });
        const { container } = render(<VisibilityModal weatherData={weather} effectiveCode={3} onClose={() => {}} lang="ca" />);
        expect(heroValue(container)).toBe('≥2');
    });

    it('el hero segueix el codi efectiu de la capçalera, no les hores de la finestra', () => {
        // HR 99 %: les hores de la finestra sí que són boira, però la capçalera diu "no boira" (codi 3).
        const weather = buildWeather(99);
        const { container } = render(<VisibilityModal weatherData={weather} effectiveCode={3} onClose={() => {}} lang="ca" />);
        expect(heroValue(container)).toBe('≥2');
    });

    it("sense codi efectiu, el valor \"ara\" del hero no es confirma com a boira (≥2 km)", () => {
        // A l'app el codi efectiu sempre hi és; aquest cas només fixa que, sense confirmació, el
        // hero no diu mai "Boira" per pròpia iniciativa.
        const weather = buildWeather(99);
        const { container } = render(<VisibilityModal weatherData={weather} onClose={() => {}} lang="ca" />);
        expect(heroValue(container)).toBe('≥2');
    });
});
