// src/components/CurrentWeather.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import CurrentWeather from './CurrentWeather';
import * as usePreferencesHook from '../hooks/usePreferences';
import { ExtendedWeatherData } from '../utils/weatherLogic';

// Mocks
vi.mock('./WeatherIcons', () => ({
  getWeatherIcon: () => <div data-testid="weather-icon">ICON</div>,
  LivingIcon: ({ children }: { children: React.ReactNode }) => <div>{children}</div>
}));

vi.mock('./ExpertWidgets', () => ({
  default: () => <div>EXPERT_WIDGETS</div>
}));

vi.mock('../hooks/usePreferences', () => ({
  usePreferences: vi.fn()
}));

const mockedUsePreferences = vi.mocked(usePreferencesHook.usePreferences);

// Helper per crear el mock del retorn
interface MockPreferencesReturn {
  preferences: {
    unit: 'C' | 'F';
    language: 'ca' | 'es' | 'en';
  };
  addFavorite: (loc: Record<string, unknown>) => void;
  removeFavorite: (name: string) => void;
  isFavorite: (name: string) => boolean;
  [key: string]: unknown; 
}

const createMockPrefs = (unit: 'C' | 'F', lang: 'ca' | 'es' | 'en'): MockPreferencesReturn => ({
  preferences: { unit, language: lang },
  addFavorite: vi.fn(),
  removeFavorite: vi.fn(),
  isFavorite: vi.fn().mockReturnValue(false)
});

const mockData: ExtendedWeatherData = {
  current: {
    temperature_2m: 20,
    apparent_temperature: 22,
    weather_code: 1,
    relative_humidity_2m: 50,
    wind_speed_10m: 10,
    time: new Date().toISOString(),
    is_day: 1,
    precipitation: 0,
    rain: 0,
    showers: 0,
    cloud_cover: 0,
    wind_gusts_10m: 15,
    visibility: 10000
  },
  daily: {
    temperature_2m_max: [25],
    temperature_2m_min: [15],
    sunrise: ['2023-01-01T07:00'],
    sunset: ['2023-01-01T18:00'],
    time: ['2023-01-01'],
    precipitation_sum: [0],
    uv_index_max: [5],
    wind_speed_10m_max: [15]
  },
  hourly: { 
    time: [], 
    temperature_2m: [], 
    precipitation: [],
    precipitation_probability: [],
    wind_speed_10m: [],
    relative_humidity_2m: []
  },
  location: { 
    name: 'Barcelona', 
    latitude: 41.38, 
    longitude: 2.17, 
    country: 'ES' 
  },
  utc_offset_seconds: 0
};

describe('CurrentWeather Component', () => {

  it('hauria de renderitzar la temperatura i la localitat', () => {
    mockedUsePreferences.mockReturnValue(createMockPrefs('C', 'ca'));

    render(
      <CurrentWeather 
        data={mockData} 
        effectiveCode={1} 
        unit="C" 
        lang="ca" 
        isFavorite={false} 
        onToggleFavorite={() => {}} 
        onShowRadar={() => {}} 
        onShowArome={() => {}} 
        aqiData={null} 
      />
    );

    expect(screen.getByText(/Barcelona/i)).toBeInTheDocument();
    
    // CORRECCIÓ 1: Busquem específicament el Heading principal (h1)
    // Això evita conflictes amb l'hora (ex: 20:27) o el text decoratiu de fons.
    const tempHeading = screen.getByRole('heading', { level: 1 });
    expect(tempHeading).toHaveTextContent(/20/);
    
    // CORRECCIÓ 2: Usem getAllByText per si la sensació tèrmica apareix més d'un cop (o per seguretat)
    const apparentTemp = screen.getAllByText((content) => content.includes('22'));
    expect(apparentTemp.length).toBeGreaterThan(0);
  });

  it('hauria de mostrar l\'etiqueta AROME HD si la font és AROME', () => {
    mockedUsePreferences.mockReturnValue(createMockPrefs('C', 'ca'));

    const aromeData: ExtendedWeatherData = {
      ...mockData,
      current: { ...mockData.current, source: 'AROME HD' }
    };

    render(
      <CurrentWeather 
        data={aromeData} 
        effectiveCode={1} 
        unit="C" 
        lang="ca" 
        isFavorite={false} 
        onToggleFavorite={() => {}} 
        onShowRadar={() => {}} 
        onShowArome={() => {}} 
        aqiData={null} 
        showAromeBtn={true} 
      />
    );

    // CORRECCIÓ 3: Gestionem múltiples elements (Badge a dalt + Botó a baix)
    const aromeLabels = screen.getAllByText(/AROME HD/i);
    expect(aromeLabels.length).toBeGreaterThan(0);
  });

  it('NO hauria de mostrar l\'etiqueta AROME si la font és global', () => {
    mockedUsePreferences.mockReturnValue(createMockPrefs('C', 'ca'));

    const globalData: ExtendedWeatherData = {
      ...mockData,
      current: { ...mockData.current, source: 'ECMWF' }
    };

    render(
      <CurrentWeather 
        data={globalData} 
        effectiveCode={1} 
        unit="C" 
        lang="ca" 
        isFavorite={false} 
        onToggleFavorite={() => {}} 
        onShowRadar={() => {}} 
        onShowArome={() => {}} 
        aqiData={null} 
      />
    );

    // Aquí ens assegurem que el BADGE específic (que indica font activa) no hi és.
    // El botó potser sí que hi és per activar-lo, però l'indicador d'estat no.
    // Filtrem per buscar el span del badge específicament.
    const activeBadge = screen.queryAllByText((content, element) => {
      return element?.tagName.toLowerCase() === 'span' && 
             content.includes('AROME HD') && 
             element.className.includes('bg-emerald-950');
    });
    
    expect(activeBadge.length).toBe(0);
  });
});