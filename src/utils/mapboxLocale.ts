// src/utils/mapboxLocale.ts
// Textos dels controls de Mapbox al radar (botons de zoom, ubicació, nom del mapa, logo). Sense l'opció `locale` del
// mapa, Mapbox els posa en anglès: «Zoom in», «Zoom out», «Location not available»… (auditoria d'UX, segona volta, A4).
// La brúixola està amagada i l'atribució és pròpia (RadarMap), però també s'hi posen per si mai es tornen a fer servir.
// L'avís d'EUMETSAT de RadarMap no és aquí: és la fórmula de la llicència i va en anglès.
import type { MapOptions } from 'mapbox-gl';
import type { Language } from '../translations';

export type MapboxUiStrings = NonNullable<MapOptions['locale']>;

export const MAPBOX_UI_STRINGS: Record<Language, Required<Pick<MapboxUiStrings,
    | 'NavigationControl.ZoomIn'
    | 'NavigationControl.ZoomOut'
    | 'NavigationControl.ResetBearing'
    | 'GeolocateControl.FindMyLocation'
    | 'GeolocateControl.LocationNotAvailable'
    | 'Map.Title'
    | 'LogoControl.Title'
    | 'AttributionControl.ToggleAttribution'
>>> = {
    ca: {
        'NavigationControl.ZoomIn': 'Apropa',
        'NavigationControl.ZoomOut': 'Allunya',
        'NavigationControl.ResetBearing': 'Orienta el mapa al nord',
        'GeolocateControl.FindMyLocation': 'Mostra la meva ubicació',
        'GeolocateControl.LocationNotAvailable': 'Ubicació no disponible',
        'Map.Title': 'Mapa',
        'LogoControl.Title': 'Web de Mapbox',
        'AttributionControl.ToggleAttribution': 'Mostra o amaga les atribucions',
    },
    es: {
        'NavigationControl.ZoomIn': 'Acercar',
        'NavigationControl.ZoomOut': 'Alejar',
        'NavigationControl.ResetBearing': 'Orientar el mapa al norte',
        'GeolocateControl.FindMyLocation': 'Mostrar mi ubicación',
        'GeolocateControl.LocationNotAvailable': 'Ubicación no disponible',
        'Map.Title': 'Mapa',
        'LogoControl.Title': 'Web de Mapbox',
        'AttributionControl.ToggleAttribution': 'Mostrar u ocultar las atribuciones',
    },
    en: {
        'NavigationControl.ZoomIn': 'Zoom in',
        'NavigationControl.ZoomOut': 'Zoom out',
        'NavigationControl.ResetBearing': 'Reset bearing to north',
        'GeolocateControl.FindMyLocation': 'Find my location',
        'GeolocateControl.LocationNotAvailable': 'Location not available',
        'Map.Title': 'Map',
        'LogoControl.Title': 'Mapbox homepage',
        'AttributionControl.ToggleAttribution': 'Toggle attribution',
    },
    fr: {
        'NavigationControl.ZoomIn': 'Zoom avant',
        'NavigationControl.ZoomOut': 'Zoom arrière',
        'NavigationControl.ResetBearing': 'Orienter la carte vers le nord',
        'GeolocateControl.FindMyLocation': 'Afficher ma position',
        'GeolocateControl.LocationNotAvailable': 'Position non disponible',
        'Map.Title': 'Carte',
        'LogoControl.Title': 'Site de Mapbox',
        'AttributionControl.ToggleAttribution': 'Afficher ou masquer les attributions',
    },
};

/** Els textos dels controls de Mapbox en l'idioma de l'app (català si no se'n coneix cap). */
export const mapboxUiStrings = (lang: Language | string): MapboxUiStrings =>
    MAPBOX_UI_STRINGS[lang as Language] ?? MAPBOX_UI_STRINGS.ca;
