// src/types/weather.ts
import { 
    WeatherCurrent, 
    WeatherHourly, 
    WeatherDaily, 
    AirQualityData, 
    WeatherApiResponse 
} from '../schemas/weatherSchema';

// Re-exportem els tipus base perquè la resta de l'app els trobi aquí
export type { WeatherCurrent, WeatherHourly, WeatherDaily, AirQualityData };

// Estenem la resposta de l'API amb els camps que l'app afegeix al client (Location, Source)
export interface WeatherData extends WeatherApiResponse {
    location?: {
        name: string;
        latitude: number;
        longitude: number;
        country?: string; 
    };
    source?: string;
}