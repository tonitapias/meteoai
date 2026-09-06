// src/constants/regionalModels.ts
// Registre de models mesoescalars d'alta resolució, generalitzant l'antic
// bounding-box únic d'AROME (isAromeSupported) a una llista ordenada per
// prioritat. Cada bbox és aproximat a partir de la documentació del
// proveïdor (Open-Meteo no exposa cap polígon oficial exacte) — els IDs de
// model (`apiModelId`) sí que estan verificats en viu contra l'API real
// (vegeu la conversa que va originar aquest fitxer).

export interface RegionalModelBBox {
    minLat: number;
    maxLat: number;
    minLon: number;
    maxLon: number;
}

export interface RegionalModel {
    id: 'AROME_HD' | 'ICON_D2' | 'HRDPS' | 'HRRR';
    apiModelId: string;
    label: string;
    resolutionKm: number;
    // Un array permet cobrir formes no rectangulars amb diverses caixes
    // (necessari per a HRDPS: vegeu la nota sobre el corredor dels Grans Llacs).
    bbox: RegionalModelBBox | RegionalModelBBox[];
}

const pointInBBox = (lat: number, lon: number, b: RegionalModelBBox): boolean =>
    lat >= b.minLat && lat <= b.maxLat && lon >= b.minLon && lon <= b.maxLon;

const pointInModelBBox = (lat: number, lon: number, m: RegionalModel): boolean =>
    Array.isArray(m.bbox) ? m.bbox.some(b => pointInBBox(lat, lon, b)) : pointInBBox(lat, lon, m.bbox);

// ORDRE DE PRIORITAT: el primer bbox que conté el punt guanya. Això resol
// els solapaments a les vores sense ambigüitat:
// - ICON_D2 se solapa amb AROME_HD a l'oest (Alsàcia/Benelux) -> es queda amb AROME_HD.
// - HRDPS es comprova ABANS que HRRR (vegeu nota sota) perquè la frontera
//   EUA-Canadà NO és una línia de latitud: als Grans Llacs baixa fins a ~43°N
//   (Toronto), molt per sota de ciutats nord-americanes com Minneapolis (45°N)
//   o Seattle (47.6°N). Amb un únic rectangle per model, prioritzar HRRR
//   etiquetava Toronto com a "HRRR" (model dels EUA) — per això HRDPS té un
//   segon bbox només per al corredor Grans Llacs/Sant Llorenç i es comprova
//   primer. Detroit/Windsor (ciutats bessones, una a cada país, pràcticament
//   a les mateixes coordenades) són irresolubles amb rectangles: es queden
//   com a HRDPS, una imprecisió coneguda i acceptada.
export const REGIONAL_MODELS: RegionalModel[] = [
    {
        id: 'AROME_HD',
        apiModelId: 'meteofrance_arome_france_hd',
        label: 'AROME HD',
        resolutionKm: 1.5,
        bbox: { minLat: 38.0, maxLat: 53.0, minLon: -8.0, maxLon: 12.0 }
    },
    {
        id: 'ICON_D2',
        apiModelId: 'icon_d2',
        label: 'ICON-D2',
        resolutionKm: 2.2,
        bbox: { minLat: 42.0, maxLat: 55.0, minLon: 1.0, maxLon: 19.0 }
    },
    {
        id: 'HRDPS',
        apiModelId: 'gem_hrdps_continental',
        label: 'HRDPS',
        resolutionKm: 2.5,
        bbox: [
            // Canadà, clarament al nord del paral·lel 49 (Vancouver, Calgary, Winnipeg...)
            { minLat: 49.0, maxLat: 75.0, minLon: -141.0, maxLon: -52.0 },
            // Corredor Grans Llacs / Sant Llorenç (Toronto, Ottawa, Montreal)
            { minLat: 42.0, maxLat: 47.0, minLon: -84.0, maxLon: -72.0 }
        ]
    },
    {
        id: 'HRRR',
        apiModelId: 'ncep_hrrr_conus',
        label: 'HRRR',
        resolutionKm: 3.0,
        bbox: { minLat: 21.0, maxLat: 49.0, minLon: -125.0, maxLon: -66.0 }
    }
];

/**
 * Tria el model regional d'alta resolució per a unes coordenades, o `null`
 * si cap el cobreix (fallback al blend global — ECMWF IFS, ja inclòs a
 * API_MODELS_LIST sense cap crida addicional).
 */
export const selectRegionalModel = (
    lat: number | null | undefined,
    lon: number | null | undefined
): RegionalModel | null => {
    if (typeof lat !== 'number' || typeof lon !== 'number' || isNaN(lat) || isNaN(lon)) return null;

    return REGIONAL_MODELS.find(m => pointInModelBBox(lat, lon, m)) ?? null;
};

const REGIONAL_MODEL_LABELS = new Set(REGIONAL_MODELS.map(m => m.label));

/**
 * `current.source` només es marca amb l'etiqueta d'un model regional quan
 * `injectHighResModelsV2` ha sobreescrit de debò com a mínim un camp real
 * (vegeu aromeEngineV2.ts) — mai per a dades del blend global. Per tant,
 * comprovar pertinença a aquest conjunt equival a "hi ha un model regional
 * actiu", sense dependre d'una etiqueta fixa com abans ('AROME HD').
 */
export const isRegionalModelActive = (source: string | null | undefined): boolean =>
    typeof source === 'string' && REGIONAL_MODEL_LABELS.has(source);

/**
 * Regex compartida per netejar els sufixos de model que Open-Meteo afegeix
 * a les claus quan es demanen múltiples `models=` (p.ex. `temperature_2m_icon_d2`).
 * Es genera a partir del registre perquè aromeEngineV2.ts i useRegionalModel.ts
 * no mantinguin cadascun la seva pròpia llista hardcodejada.
 */
export const buildModelSuffixRegex = (): RegExp => {
    const suffixes = REGIONAL_MODELS.map(m => `_${m.apiModelId}`);
    suffixes.push('_best_match', '_ecmwf', '_gfs', '_icon');
    return new RegExp(suffixes.join('|'), 'g');
};
