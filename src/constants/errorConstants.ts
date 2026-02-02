// src/constants/errorConstants.ts

/**
 * LLISTA CENTRALITZADA DE CODIS D'ERROR I ESTATS DEL SISTEMA
 * Objectiu: Evitar "Magic Strings" dispersos pel codi.
 */

// Codis d'error de Geolocalització (Coincideixen amb els llançats pel Context)
export const GEO_ERRORS = {
    NOT_SUPPORTED: "GEOLOCATION_NOT_SUPPORTED",
    PERMISSION_DENIED: "PERMISSION_DENIED",
    TIMEOUT: "TIMEOUT"
} as const;

// Tipus d'errors en les peticions de xarxa
export const FETCH_ERROR_TYPES = {
    NETWORK: 'network',
    VALIDATION: 'validation',
    UNKNOWN: 'unknown'
} as const;

// Tipus de notificacions visuals (Toasts)
export const NOTIFICATION_TYPES = {
    SUCCESS: 'success',
    ERROR: 'error',
    INFO: 'info'
} as const;

// Etiquetes per a Sentry (Monitorització)
export const SENTRY_TAGS = {
    SERVICE_WEATHER_API: 'WeatherAPI',
    SERVICE_AROME_WORKER: 'AromeWorker',
    TYPE_FALLBACK: 'FallbackToBase'
} as const;