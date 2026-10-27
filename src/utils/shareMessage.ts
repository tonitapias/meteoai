// src/utils/shareMessage.ts
// El missatge del botó Compartir. Diu si és la posició de qui l'envia (GPS) o un lloc que ha consultat, perquè qui el
// rep no ho hagi d'endevinar: amb la posició hi van les coordenades (es poden dictar) i un enllaç de mapa.
import { formatCoordsText, googleMapsLink, isPositionOrigin, type SharedPlace } from './placeLink';
import type { ShareContent } from './shareLink';
import type { TranslationType } from '../translations';

export type ShareTexts = TranslationType['share'];

// Amb funció: un nom amb "$&" o "$1" no s'ha d'interpretar com a patró de substitució.
const fill = (template: string, key: string, value: string) => template.replace(`{${key}}`, () => value);

/**
 * Títol, text i el que es copia si no hi ha full de compartir. `url` és l'enllaç de l'app (vegeu buildPlaceLink): el
 * full de compartir l'afegeix després del text; al porta-retalls, amb la posició es copia el missatge sencer (les
 * coordenades i el mapa no són a l'enllaç de l'app) i, amb un lloc consultat, només l'enllaç.
 */
export const buildShareMessage = (place: SharedPlace, url: string, texts: ShareTexts): ShareContent => {
    const coords = formatCoordsText(place.latitude, place.longitude);

    if (isPositionOrigin(place.origin)) {
        // La pròpia ("La meva posició") o una de rebuda que es reenvia ("Posició compartida": no és la de qui l'envia).
        const mine = place.origin === 'gps';
        const nearName = place.name ? ` (${place.name})` : '';
        const text = [
            `${fill(mine ? texts.positionLine : texts.sharedPositionLine, 'coords', coords)}${nearName}`,
            googleMapsLink(place.latitude, place.longitude),
            texts.weatherHere
        ].join('\n');
        return { title: mine ? texts.positionTitle : texts.sharedPosition, text, url, clipboardText: `${text}\n${url}` };
    }

    // Sense nom (enllaç sense `nom` i geocodificació inversa fallida), el lloc són les coordenades.
    const label = place.name ?? coords;
    return { title: fill(texts.title, 'place', label), text: fill(texts.text, 'place', label), url };
};
