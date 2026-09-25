// Validació de la capa d'etiquetes amb el validador oficial d'estils que porta
// mapbox-gl, i avaluació del filtre i del text amb característiques reals de
// `place_label` (Mapbox Streets v8, tessel·les de Catalunya i Europa).
import { describe, it, expect } from 'vitest';
// @ts-expect-error — mòdul intern de mapbox-gl sense declaració de tipus per a aquesta ruta
import { validate, featureFilter, expression, latest } from 'mapbox-gl/dist/style-spec/index.es.js';
import {
  MAPBOX_GLYPHS_URL,
  MAPBOX_STREETS_URL,
  PLACE_LABEL_FILTER,
  PLACE_LABEL_SOURCE_LAYER,
  buildPlaceLabelLayout,
  buildPlaceLabelPaint,
  buildPlaceLabelTextField,
  getCountryNamePairs,
} from './mapLabels';
import type { Language } from '../translations';

type Props = Record<string, string | number | boolean>;

const barcelona: Props = { class: 'settlement', type: 'city', name: 'Barcelona', name_en: 'Barcelona', name_es: 'Barcelona', name_script: 'Latin', symbolrank: 7, filterrank: 1, worldview: 'all' };
const girona: Props = { class: 'settlement', type: 'city', name: 'Girona', name_en: 'Girona', name_es: 'Gerona', name_script: 'Latin', symbolrank: 10, filterrank: 1, worldview: 'all' };
const tremp: Props = { class: 'settlement', type: 'town', name: 'Tremp', name_en: 'Tremp', name_es: 'Tremp', name_script: 'Latin', symbolrank: 13, filterrank: 1, worldview: 'all' };
const oliana: Props = { class: 'settlement', type: 'village', name: 'Oliana', name_script: 'Latin', symbolrank: 15, filterrank: 5, worldview: 'all' };
const spain: Props = { class: 'country', type: 'country', name: 'España', name_en: 'Spain', name_es: 'España', name_script: 'Latin', symbolrank: 3, filterrank: 0, worldview: 'all', iso_3166_1: 'ES' };
const belgium: Props = { class: 'country', type: 'country', name: 'Belgique - België - Belgien', name_en: 'Belgium', name_es: 'Bélgica', name_fr: 'Belgique', name_script: 'Latin', symbolrank: 4, filterrank: 0, worldview: 'all', iso_3166_1: 'BE' };
const cyprusJP: Props = { class: 'country', type: 'country', name: 'Κύπρος', name_en: 'Cyprus', name_es: 'Chipre', name_script: 'Greek', symbolrank: 5, filterrank: 0, worldview: 'JP', iso_3166_1: 'CY' };
const cyprusUS: Props = { ...cyprusJP, worldview: 'US' };
const scotland: Props = { class: 'state', type: 'state', name: 'Scotland', name_en: 'Scotland', name_es: 'Escocia', name_script: 'Latin', symbolrank: 6, filterrank: 0, worldview: 'all' };
const moscow: Props = { class: 'settlement', type: 'city', name: 'Москва', name_en: 'Moscow', name_es: 'Moscú', name_fr: 'Moscou', name_script: 'Cyrillic', symbolrank: 1, filterrank: 0, worldview: 'all' };

const passes = (props: Props, zoom: number): boolean => {
  const { filter } = featureFilter(PLACE_LABEL_FILTER);
  return filter({ zoom }, { type: 1, properties: props, geometry: [] });
};

const labelText = (lang: Language, props: Props): string => {
  const parsed = expression.createExpression(buildPlaceLabelTextField(lang), latest.layout_symbol['text-field']);
  expect(parsed.result).toBe('success');
  return String(parsed.value.evaluate({ zoom: 7 }, { type: 1, properties: props }));
};

describe('capa d\'etiquetes (Mapbox Streets v8)', () => {
  it.each(['ca', 'es', 'en', 'fr'] as Language[])('és un estil vàlid per a mapbox-gl (%s)', (lang) => {
    const style = {
      version: 8,
      glyphs: MAPBOX_GLYPHS_URL,
      sources: { 'labels-src': { type: 'vector', url: MAPBOX_STREETS_URL } },
      layers: [{
        id: 'layer-labels',
        type: 'symbol',
        source: 'labels-src',
        'source-layer': PLACE_LABEL_SOURCE_LAYER,
        filter: PLACE_LABEL_FILTER,
        layout: buildPlaceLabelLayout(lang, true),
        paint: buildPlaceLabelPaint(false),
      }],
    };
    expect(validate(style)).toEqual([]);
  });

  it('descarta els duplicats per worldview (no US)', () => {
    expect(passes(cyprusJP, 5)).toBe(false);
    expect(passes(cyprusUS, 5)).toBe(true);
  });

  it('mostra més poblacions com més zoom', () => {
    expect(passes(barcelona, 5)).toBe(true);
    expect(passes(girona, 5)).toBe(false);
    expect(passes(girona, 7)).toBe(true);
    expect(passes(tremp, 7)).toBe(false);
    expect(passes(tremp, 9)).toBe(true);
    // filterrank 5: massa secundària fins i tot a zoom alt
    expect(passes(oliana, 12)).toBe(false);
  });

  it('mostra les regions només a zooms intermedis', () => {
    expect(passes(scotland, 3)).toBe(false);
    expect(passes(scotland, 5)).toBe(true);
    expect(passes(scotland, 9)).toBe(false);
  });

  it('els països surten en l\'idioma de l\'app, també en català', () => {
    expect(labelText('ca', spain)).toBe('Espanya');
    expect(labelText('ca', belgium)).toBe('Bèlgica');
    expect(labelText('es', belgium)).toBe('Bélgica');
    expect(labelText('en', belgium)).toBe('Belgium');
    expect(labelText('fr', belgium)).toBe('Belgique');
  });

  it('les poblacions en alfabet llatí mantenen el nom oficial local', () => {
    expect(labelText('es', girona)).toBe('Girona');
    expect(labelText('ca', girona)).toBe('Girona');
  });

  it('les poblacions en altres alfabets es tradueixen (català → anglès)', () => {
    expect(labelText('fr', moscow)).toBe('Moscou');
    expect(labelText('es', moscow)).toBe('Moscú');
    expect(labelText('ca', moscow)).toBe('Moscow');
  });

  it('la llista de països exclou ZZ (regió desconeguda)', () => {
    const codes = getCountryNamePairs('ca').map(([code]) => code);
    expect(codes).toContain('ES');
    expect(codes).not.toContain('ZZ');
  });
});
