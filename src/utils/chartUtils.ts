// src/utils/chartUtils.ts

// Tipus compartit per a punts de dades dels gràfics
// Ho movem aquí per evitar duplicitats i referències circulars
export interface ChartDataPoint {
    time: string;
    [key: string]: string | number | null | undefined | unknown; 
}

/**
 * Calcula els dominis Y (mínim i màxim) per als gràfics segons el tipus de dada.
 * Això centralitza la "Business Logic" de visualització, traient-la de la UI.
 */
export const calculateYDomain = (values: number[], layer: string) => {
    // Si no hi ha valors, retornem un default segur
    let min = values.length ? Math.min(...values) : 0;
    let max = values.length ? Math.max(...values) : 100;

    switch (layer) {
        case 'temp':
            // Afegim marge de 2 graus per estètica
            min -= 2;
            max += 2;
            break;
        case 'rain':
        case 'cloud':
        case 'humidity':
            // Percentatges sempre 0-100
            min = 0;
            max = 100;
            break;
        case 'precip':
            // Mínim 3mm per evitar que 0.1mm sembli una tempesta gegant
            min = 0;
            max = Math.max(max * 1.2, 3); 
            break;
        case 'wind':
            // Mínim 25km/h perquè el gràfic no balli amb brises suaus
            min = 0;
            max = Math.max(max, 25); 
            break;
        case 'snowLevel':
            // Marge de 500m per veure context de muntanya
            min = Math.max(0, min - 500);
            max = max + 500;
            break;
        default:
            // Per defecte mantenim el rang calculat automàticament
            break;
    }

    // Assegurem que min mai sigui igual a max per evitar errors de divisió per zero
    if (min === max) {
        max += 1;
    }

    return { min, max };
};