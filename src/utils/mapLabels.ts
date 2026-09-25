// src/utils/mapLabels.ts
// Capa «Etiquetes» del radar: noms de poblacions, regions i països.
//
// Abans eren tessel·les raster de CARTO (`light_only_labels`) sense clau. Des
// del 23-09-2026 CARTO exigeix API key a tots els seus basemaps i, sense
// `?key=`, respon igualment 200 OK amb una imatge «API KEY REQUIRED» a cada
// tessel·la (per això el gestor d'errors del mapa no ho detectava). Ara són
// etiquetes vectorials de Mapbox Streets v8, amb el mateix token que ja fa
// servir el mapa: sense clau nova, i dins les «map loads» de GL JS v3.
import type { ExpressionSpecification, FilterSpecification, SymbolLayerSpecification } from 'mapbox-gl';
import type { Language } from '../translations';

export const MAPBOX_STREETS_URL = 'mapbox://mapbox.mapbox-streets-v8';
export const MAPBOX_GLYPHS_URL = 'mapbox://fonts/mapbox/{fontstack}/{range}.pbf';
export const PLACE_LABEL_SOURCE_LAYER = 'place_label';

type Expr = ExpressionSpecification;

const COUNTRY_CLASSES = ['country', 'disputed_country'];
const STATE_CLASSES = ['state', 'disputed_state'];
const SETTLEMENT_CLASSES = ['settlement', 'disputed_settlement'];

const classIn = (classes: string[]): Expr => ['match', ['get', 'class'], classes, true, false];

// Mapbox Streets no té `name_ca`: en català el nom traduït de reserva és l'anglès.
const localizedNameKey = (lang: Language): string => (lang === 'ca' ? 'name_en' : `name_${lang}`);

// Poblacions i regions: nom oficial local si és en alfabet llatí (Girona, no
// «Gerona»; München, no «Munich»), com feia CARTO. Només els alfabets no
// llatins (Москва, 東京) es tradueixen.
const localName = (lang: Language): Expr => [
  'case',
  ['==', ['get', 'name_script'], 'Latin'], ['get', 'name'],
  ['coalesce', ['get', localizedNameKey(lang)], ['get', 'name_en'], ['get', 'name']],
];

const regionNamesCache = new Map<Language, [string, string][]>();

// Noms de països en l'idioma de l'app a partir del codi ISO (CLDR del
// navegador): és l'única manera de tenir «Espanya», «Bèlgica»... en català.
// El `name` local de Mapbox no serveix per a països («Belgique - België -
// Belgien», «Україна»).
export function getCountryNamePairs(lang: Language): [string, string][] {
  const cached = regionNamesCache.get(lang);
  if (cached) return cached;

  const pairs: [string, string][] = [];
  try {
    const names = new Intl.DisplayNames([lang], { type: 'region', fallback: 'none' });
    const A = 'A'.charCodeAt(0);
    for (let i = 0; i < 26; i++) {
      for (let j = 0; j < 26; j++) {
        const code = String.fromCharCode(A + i, A + j);
        const name = names.of(code);
        // ZZ = «regió desconeguda» a CLDR, no és cap país
        if (name && code !== 'ZZ') pairs.push([code, name]);
      }
    }
  } catch {
    // Navegador sense Intl.DisplayNames: es queda amb els noms de Mapbox.
  }
  regionNamesCache.set(lang, pairs);
  return pairs;
}

const countryName = (lang: Language): Expr => {
  const fallback: Expr = ['coalesce', ['get', localizedNameKey(lang)], ['get', 'name_en'], ['get', 'name']];
  const pairs = getCountryNamePairs(lang);
  if (pairs.length === 0) return fallback;
  return ['match', ['get', 'iso_3166_1'], ...pairs.flat(), fallback] as Expr;
};

export function buildPlaceLabelTextField(lang: Language): Expr {
  return [
    'match', ['get', 'class'],
    COUNTRY_CLASSES, countryName(lang),
    localName(lang),
  ];
}

// Cada element geogràfic en disputa ve repetit un cop per «worldview» (US, CN,
// IN, JP); sense aquest filtre Xipre o Kosovo sortirien 4 vegades. `all` + `US`
// és el mateix criteri que fan servir els estils de Mapbox.
export const PLACE_LABEL_FILTER: FilterSpecification = [
  'all',
  ['match', ['get', 'worldview'], ['all', 'US'], true, false],
  [
    'any',
    classIn(COUNTRY_CLASSES),
    ['all', classIn(STATE_CLASSES), ['step', ['zoom'], false, 4, true, 8, false]],
    [
      'all',
      classIn(SETTLEMENT_CLASSES),
      ['<=', ['get', 'filterrank'], 3],
      // symbolrank: 1 = més important. Com més zoom, més poblacions petites.
      ['step', ['zoom'],
        ['<=', ['get', 'symbolrank'], 6],
        4, ['<=', ['get', 'symbolrank'], 8],
        6, ['<=', ['get', 'symbolrank'], 10],
        7, ['<=', ['get', 'symbolrank'], 12],
        9, ['<=', ['get', 'symbolrank'], 14],
        11, true,
      ],
    ],
  ],
];

// Mida de les poblacions per importància (symbolrank) a un zoom donat.
const settlementSize = (big: number, mid: number, small: number, tiny: number): Expr =>
  ['step', ['get', 'symbolrank'], big, 8, mid, 11, small, 13, tiny];

const sizeAt = (country: number, state: number, settlement: Expr): Expr =>
  ['match', ['get', 'class'], COUNTRY_CLASSES, country, STATE_CLASSES, state, settlement];

export function buildPlaceLabelLayout(lang: Language, visible: boolean): NonNullable<SymbolLayerSpecification['layout']> {
  return {
    visibility: visible ? 'visible' : 'none',
    'text-field': buildPlaceLabelTextField(lang),
    'text-font': [
      'match', ['get', 'class'],
      COUNTRY_CLASSES, ['literal', ['DIN Pro Bold', 'Arial Unicode MS Bold']],
      STATE_CLASSES, ['literal', ['DIN Pro Regular', 'Arial Unicode MS Regular']],
      ['literal', ['DIN Pro Medium', 'Arial Unicode MS Regular']],
    ],
    'text-size': [
      'interpolate', ['linear'], ['zoom'],
      2, sizeAt(10, 9, settlementSize(11, 10, 9, 9)),
      6, sizeAt(14, 11, settlementSize(15, 13, 12, 11)),
      10, sizeAt(18, 13, settlementSize(19, 16, 14, 13)),
      14, sizeAt(20, 15, settlementSize(22, 19, 17, 15)),
    ],
    'text-transform': ['match', ['get', 'class'], [...COUNTRY_CLASSES, ...STATE_CLASSES], 'uppercase', 'none'],
    'text-letter-spacing': ['match', ['get', 'class'], COUNTRY_CLASSES, 0.15, STATE_CLASSES, 0.1, 0.02],
    'text-max-width': 8,
    'text-padding': 3,
    // Les més importants es col·loquen primer quan dues etiquetes xoquen.
    'symbol-sort-key': ['get', 'symbolrank'],
  };
}

// Sobre bases clares (Clar, Relleu) text fosc amb halo blanc, com les antigues
// etiquetes de CARTO; sobre la resta (Fosc, Satèl·lit, Terra de Nit) text
// blanc amb halo fosc.
export function getPlaceLabelColors(isLightBase: boolean): { text: string; halo: string } {
  return isLightBase
    ? { text: '#1e293b', halo: 'rgba(255, 255, 255, 0.9)' }
    : { text: '#f8fafc', halo: 'rgba(2, 6, 23, 0.85)' };
}

export function buildPlaceLabelPaint(isLightBase: boolean): NonNullable<SymbolLayerSpecification['paint']> {
  const colors = getPlaceLabelColors(isLightBase);
  return {
    'text-color': colors.text,
    'text-halo-color': colors.halo,
    'text-halo-width': 1.5,
    'text-halo-blur': 0.5,
  };
}
