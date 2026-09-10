import { describe, it, expect } from 'vitest';

// Test de contracte per a les 7 fonts d'alertes oficials. A diferència
// d'api-contract.test.ts (que prova el worker), aquí provem les APIs
// OFICIALS directament: el worker respon sempre 200+[] encara que la font
// estigui trencada (disseny "fail-open" per no petar l'app a l'usuari), així
// que provar només el worker no detectaria mai un trencament real.

const TIMEOUT_MS = 15000;

describe('NWS (EUA) Contract Check', () => {
    it('hauria de respondre amb l\'estructura GeoJSON esperada', async () => {
        const response = await fetch('https://api.weather.gov/alerts/active?point=35.2,-97.4');
        expect(response.ok, `NWS ha fallat amb status: ${response.status}`).toBe(true);

        const data = await response.json();
        expect(data).toHaveProperty('features');
        expect(Array.isArray(data.features)).toBe(true);
    }, TIMEOUT_MS);
});

describe('Météo-France (mirall Opendatasoft) Contract Check', () => {
    it('hauria de respondre amb l\'estructura de registres esperada', async () => {
        const response = await fetch('https://public.opendatasoft.com/api/records/1.0/search/?dataset=weatherref-france-vigilance-meteo-departement&rows=1');
        expect(response.ok, `Météo-France (Opendatasoft) ha fallat amb status: ${response.status}`).toBe(true);

        const data = await response.json();
        expect(Array.isArray(data.records)).toBe(true);
        expect(data.records.length).toBeGreaterThan(0);
        expect(data.records[0].fields).toHaveProperty('domain_id');
        expect(data.records[0].fields).toHaveProperty('color');
    }, TIMEOUT_MS);
});

describe('IPMA (Portugal) Contract Check', () => {
    it('hauria de donar la llista de localitats amb coordenades', async () => {
        const response = await fetch('https://api.ipma.pt/open-data/distrits-islands.json');
        expect(response.ok, `IPMA (localitats) ha fallat amb status: ${response.status}`).toBe(true);

        const data = await response.json();
        expect(Array.isArray(data.data)).toBe(true);
        expect(data.data.length).toBeGreaterThan(0);
        expect(data.data[0]).toHaveProperty('idAreaAviso');
        expect(data.data[0]).toHaveProperty('latitude');
    }, TIMEOUT_MS);

    it('hauria de donar la llista d\'avisos amb l\'estructura esperada', async () => {
        const response = await fetch('https://api.ipma.pt/open-data/forecast/warnings/warnings_www.json');
        expect(response.ok, `IPMA (avisos) ha fallat amb status: ${response.status}`).toBe(true);

        const data = await response.json();
        expect(Array.isArray(data)).toBe(true);
        if (data.length > 0) {
            expect(data[0]).toHaveProperty('awarenessLevelID');
            expect(data[0]).toHaveProperty('idAreaAviso');
        }
    }, TIMEOUT_MS);
});

describe('DWD (Alemanya) Contract Check', () => {
    it('hauria de donar el JSON de districtes (mirall Opendatasoft)', async () => {
        const response = await fetch('https://data.opendatasoft.com/api/records/1.0/search/?dataset=georef-germany-kreis%40public&rows=1&fields=krs_code,krs_name,geo_point_2d');
        expect(response.ok, `DWD (districtes) ha fallat amb status: ${response.status}`).toBe(true);

        const data = await response.json();
        expect(Array.isArray(data.records)).toBe(true);
        expect(data.records.length).toBeGreaterThan(0);
        expect(data.records[0].fields).toHaveProperty('krs_code');
        expect(data.records[0].fields).toHaveProperty('geo_point_2d');
    }, TIMEOUT_MS);

    it('hauria de donar el JSONP d\'avisos amb l\'embolcall esperat', async () => {
        const response = await fetch('https://www.dwd.de/DWD/warnungen/warnapp_landkreise/json/warnings.json');
        expect(response.ok, `DWD (avisos) ha fallat amb status: ${response.status}`).toBe(true);

        const raw = await response.text();
        expect(raw.includes('warnWetter.loadWarnings'), 'L\'embolcall JSONP esperat ha canviat').toBe(true);

        const jsonStart = raw.indexOf('{');
        const jsonEnd = raw.lastIndexOf('}');
        const parsed = JSON.parse(raw.slice(jsonStart, jsonEnd + 1));
        expect(parsed).toHaveProperty('warnings');
    }, TIMEOUT_MS);
});

describe('Protezione Civile (Itàlia) Contract Check', () => {
    it('hauria de trobar el butlletí més recent i el seu TopoJSON', async () => {
        const repo = 'pcm-dpc/DPC-Bollettini-Criticita-Idrogeologica-Idraulica';

        const listRes = await fetch(`https://api.github.com/repos/${repo}/commits?path=files&per_page=1`, {
            headers: { 'User-Agent': 'meteoai-health-check', Accept: 'application/vnd.github+json' }
        });
        expect(listRes.ok, `GitHub (llista de commits) ha fallat amb status: ${listRes.status}`).toBe(true);
        const commits = await listRes.json();
        const sha = commits[0]?.sha;
        expect(sha, 'No s\'ha trobat cap commit recent a files/').toBeTruthy();

        const detailRes = await fetch(`https://api.github.com/repos/${repo}/commits/${sha}`, {
            headers: { 'User-Agent': 'meteoai-health-check', Accept: 'application/vnd.github+json' }
        });
        expect(detailRes.ok, `GitHub (detall del commit) ha fallat amb status: ${detailRes.status}`).toBe(true);
        const detail = await detailRes.json();
        const dateTimeToken = (detail.files || [])
            .map((f: { filename?: string }) => (f.filename || '').match(/(\d{8}_\d{4})/)?.[1])
            .find((t: string | undefined) => !!t);
        expect(dateTimeToken, 'No s\'ha pogut extreure el token de data/hora del darrer commit').toBeTruthy();

        const topoRes = await fetch(`https://raw.githubusercontent.com/${repo}/master/files/topojson/${dateTimeToken}_today.json`);
        expect(topoRes.ok, `Itàlia (TopoJSON d'avui) ha fallat amb status: ${topoRes.status}`).toBe(true);

        const topo = await topoRes.json();
        expect(topo).toHaveProperty('objects');
        expect(Object.keys(topo.objects).length).toBeGreaterThan(0);
    }, TIMEOUT_MS);
});

describe('AEMET (Espanya) Contract Check', () => {
    const apiKey = process.env.AEMET_API_KEY;

    it.skipIf(!apiKey)('hauria de respondre amb l\'embolcall JSON esperat', async () => {
        const response = await fetch('https://opendata.aemet.es/opendata/api/avisos_cap/ultimoelaborado/area/esp', {
            headers: { api_key: apiKey as string }
        });
        expect(response.ok, `AEMET ha fallat amb status: ${response.status}`).toBe(true);

        const data = await response.json();
        expect(data.estado, `AEMET ha respost amb un estat inesperat: ${JSON.stringify(data)}`).toBe(200);
        expect(data).toHaveProperty('datos');
    }, TIMEOUT_MS);
});

describe('Meteocat (Catalunya) Contract Check', () => {
    const apiKey = process.env.METEOCAT_API_KEY;

    it.skipIf(!apiKey)('hauria de donar la llista de municipis amb l\'estructura esperada', async () => {
        const response = await fetch('https://api.meteo.cat/referencia/v1/municipis', {
            headers: { 'x-api-key': apiKey as string }
        });
        expect(response.ok, `Meteocat ha fallat amb status: ${response.status}`).toBe(true);

        const data = await response.json();
        expect(Array.isArray(data)).toBe(true);
        expect(data.length).toBeGreaterThan(0);
        expect(data[0]).toHaveProperty('comarca');
        expect(data[0]).toHaveProperty('coordenades');
    }, TIMEOUT_MS);
});
