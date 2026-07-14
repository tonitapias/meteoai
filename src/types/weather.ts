// src/types/weather.ts
import { 
    WeatherCurrent as BaseCurrent, 
    WeatherHourly as BaseHourly, 
    WeatherDaily as BaseDaily, 
    AirQualityData as BaseAirQuality, 
    WeatherApiResponse as BaseApiResponse 
} from '../schemas/weatherSchema';

// DOCTRINA RISC ZERO: Forcem que qualsevol matriu que contingui números accepti sempre null.
// Això prevé trencaments de renderitzat quan l'API té forats de dades.
export type SafeNumberArray = (number | null)[];

// Tipus genèric recursiu que rastreja totes les propietats i converteix els arrays de números a SafeNumberArray
type MakeArraysSafe<T> = {
    [P in keyof T]: T[P] extends (number | undefined)[] | number[] 
        ? SafeNumberArray 
        : T[P] extends object 
            ? MakeArraysSafe<T[P]> 
            : T[P];
};

// Exportem els tipus blindats cap a la UI
export type WeatherCurrent = MakeArraysSafe<BaseCurrent>;
export type WeatherHourly = MakeArraysSafe<BaseHourly>;
export type WeatherDaily = MakeArraysSafe<BaseDaily>;
export type AirQualityData = MakeArraysSafe<BaseAirQuality>;

// Estenem la resposta de l'API amb els camps que l'app afegeix al client (Location, Source)
export interface WeatherData extends MakeArraysSafe<BaseApiResponse> {
    location?: {
        name: string;
        latitude: number;
        longitude: number;
        country?: string; 
    };
    source?: string;
}