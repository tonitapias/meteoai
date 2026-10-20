import { describe, it, expect } from 'vitest';

// Test de contracte de la capa "Meteosat HD (Europa)" del radar. El worker
// meteo-sat-proxy serveix tessel·les transparents sense cap error visible
// ("fail-open") quan EUMETSAT falla: sense aquest avís, la capa quedaria en
// blanc en silenci.
// - MSG (msg_fes:ir108): servei 0° en paral·lel amb Meteosat-12 (MTG) fins
//   cap al 2027 (data no confirmada). Quan s'aturi, aquests tests fallaran:
//   és el senyal per a la Fase 3 (la ruta antiga passa a servir MTG).
// - MTG (mtg_fd:ir105_hrfi): la capa nova, amb les mateixes peticions que fa
//   el worker (caps d'una sola capa, JPEG/PNG segons la geometria, recul
//   davant InvalidDimensionValue) i les seves rutes /hd/meteosat/latest i
//   /hd/mtg/v1.
// - Llamps (mtg_fd:li_afa) i GeoColour (mtg_fd:rgb_geocolour): les capes i
//   les rutes /lightning/* i /hd/mtg/geocolour/v1.
// - GOES i Himawari HD (NASA GIBS): DescribeDomains, WMS/WMTS i les rutes
//   /hd/{goes|himawari}/latest i /hd/gibs/v1 (al final del fitxer).

const CAPABILITIES_URL = 'https://view.eumetsat.int/geoserver/wms?service=WMS&version=1.3.0&request=GetCapabilities';
const MSG_LAYER = 'msg_fes:ir108';
const MTG_LAYER = 'mtg_fd:ir105_hrfi';
// Retard normal: ~20–35 min. Més de 2 h vol dir que la capa s'ha aturat.
const MAX_AGE_MS = 2 * 60 * 60 * 1000;
// Una tessel·la real de 512 px mai baixa d'uns pocs KB; el fallback del worker
// és un PNG transparent d'1x1 (68 bytes).
const MIN_TILE_BYTES = 4096;
// z4/8/5 (Europa central, dins el disc de Meteosat), bbox EPSG:3857 calculat
// igual que xyzToBbox al worker.
const TILE = { z: 4, x: 8, y: 5 };
const TIMEOUT_MS = 30000;
const WORKER_URL = 'https://meteo-sat-proxy.tonitapias.workers.dev';
const WORKER_HEADERS = { Origin: 'https://tonitapias.github.io' };
// Caps d'una sola capa: la mateixa URL que llegeix el worker (MTG_CAPS_URL).
const MTG_CAPS_URL = 'https://view.eumetsat.int/geoserver/mtg_fd/ir105_hrfi/ows?service=WMS&version=1.3.0&request=GetCapabilities';
// Tessel·la de vora del disc (Àsia, en part fora de la Terra): el worker hi
// demana vnd.jpeg-png, que ha de donar PNG amb transparència.
const LIMB_TILE = { z: 3, x: 5, y: 2 };
// /lightning/latest i /hd/{goes|himawari}/latest: una franja de més d'1 h vol
// dir que la capa s'ha aturat o va molt endarrerida.
const MAX_LATEST_AGE_S = 3600;

let capabilitiesPromise: Promise<string> | null = null;
function getCapabilities(): Promise<string> {
    capabilitiesPromise ??= fetch(CAPABILITIES_URL).then((res) => {
        if (!res.ok) throw new Error(`GetCapabilities d'EUMETSAT ha fallat amb status: ${res.status}`);
        return res.text();
    });
    return capabilitiesPromise;
}

// Bloc <Layer> d'una capa concreta dins del GetCapabilities.
function layerBlock(xml: string, name: string): string | null {
    const start = xml.indexOf(`<Name>${name}</Name>`);
    if (start < 0) return null;
    const end = xml.indexOf('</Layer>', start);
    return xml.slice(start, end < 0 ? undefined : end);
}

// Dimensió temps, p. ex. `default="..." nearestValue="1"` i
// `2020-09-01T00:00:00.000Z/2026-10-04T19:15:00.000Z/PT15M`.
function timeDimension(block: string): { attrs: string; extentEnd: string | null; defaultTime: string | null } {
    const match = block.match(/<Dimension name="time"([^>]*)>([^<]*)</);
    const attrs = match?.[1] ?? '';
    const extent = (match?.[2] ?? '').trim();
    const lastPeriod = extent.split(',').pop() ?? '';
    return {
        attrs,
        extentEnd: lastPeriod.split('/')[1] ?? null,
        defaultTime: attrs.match(/default="([^"]+)"/)?.[1] ?? null,
    };
}

function tileBbox({ z, x, y }: typeof TILE): string {
    const e = 20037508.34;
    const n = 2 ** z;
    return `${(x / n) * 2 * e - e},${e - ((y + 1) / n) * 2 * e},${((x + 1) / n) * 2 * e - e},${e - (y / n) * 2 * e}`;
}

function isImage(bytes: Uint8Array): boolean {
    const png = [0x89, 0x50, 0x4e, 0x47];
    const jpeg = [0xff, 0xd8, 0xff];
    return png.every((b, i) => bytes[i] === b) || jpeg.every((b, i) => bytes[i] === b);
}

describe('EUMETSAT Meteosat (msg_fes:ir108) Contract Check', () => {
    it('la capa existeix i s\'ha actualitzat fa menys de 2 h', async () => {
        const block = layerBlock(await getCapabilities(), MSG_LAYER);
        expect(block, `La capa ${MSG_LAYER} ha desaparegut del GetCapabilities d'EUMETSAT: cal migrar a ${MTG_LAYER}`).not.toBeNull();

        const { attrs, extentEnd } = timeDimension(block!);
        // El worker confia que EUMETSAT ajusti una hora no exacta a l'interval més proper.
        expect(attrs).toContain('nearestValue="1"');
        expect(extentEnd, 'No s\'ha pogut llegir el final de la dimensió temps').not.toBeNull();

        const ageMs = Date.now() - Date.parse(extentEnd!);
        const ageHours = (ageMs / 3600000).toFixed(1);
        expect(ageMs, `L'última imatge de ${MSG_LAYER} és de fa ${ageHours} h (${extentEnd}): EUMETSAT pot haver aturat el servei MSG 0° — la capa "Meteosat HD" quedarà en blanc; cal migrar a ${MTG_LAYER}`).toBeLessThan(MAX_AGE_MS);
    }, TIMEOUT_MS);

    it('serveix una imatge real sense autenticar (com el worker) per a l\'últim interval', async () => {
        const { defaultTime } = timeDimension(layerBlock(await getCapabilities(), MSG_LAYER) ?? '');
        expect(defaultTime).not.toBeNull();

        const url = `https://view.eumetsat.int/geoserver/wms?service=WMS&version=1.3.0&request=GetMap&layers=${MSG_LAYER}&styles=&crs=EPSG:3857&bbox=${tileBbox(TILE)}&width=512&height=512&format=image/vnd.jpeg-png&transparent=true&time=${defaultTime}`;
        const response = await fetch(url);
        expect(response.ok, `GetMap anònim de ${MSG_LAYER} ha fallat amb status: ${response.status} (si és 401/403, EUMETSAT torna a exigir el token)`).toBe(true);

        const bytes = new Uint8Array(await response.arrayBuffer());
        expect(isImage(bytes), `GetMap no ha tornat cap imatge (Content-Type: ${response.headers.get('content-type')})`).toBe(true);
        expect(bytes.byteLength).toBeGreaterThan(MIN_TILE_BYTES);
    }, TIMEOUT_MS);

    it('el worker de producció serveix una tessel·la real (no el fallback transparent)', async () => {
        const { defaultTime } = timeDimension(layerBlock(await getCapabilities(), MSG_LAYER) ?? '');
        expect(defaultTime).not.toBeNull();
        // Una hora abans de l'últim interval (segur que publicat) i uns segons
        // de desplaçament: el worker arrodoneix al mateix interval de 15 min,
        // però la URL no coincideix amb la de cap frame de l'app i no surt de
        // la memòria cau d'1 any — prova el camí sencer cada dia.
        const timestamp = Math.floor(Date.parse(defaultTime!) / 1000) - 3600 + 7;

        const response = await fetch(`https://meteo-sat-proxy.tonitapias.workers.dev/hd/meteosat/${timestamp}/${TILE.z}/${TILE.x}/${TILE.y}.png`, {
            headers: { Origin: 'https://tonitapias.github.io' },
        });
        expect(response.ok, `El worker ha respost amb status: ${response.status}`).toBe(true);

        const bytes = new Uint8Array(await response.arrayBuffer());
        expect(isImage(bytes)).toBe(true);
        expect(bytes.byteLength, 'El worker ha servit el fallback transparent: mira `wrangler tail` (línies "[Zero Risk] Meteosat ...")').toBeGreaterThan(MIN_TILE_BYTES);
    }, TIMEOUT_MS);

});

let mtgCapsPromise: Promise<string> | null = null;
function getMtgCapabilities(): Promise<string> {
    mtgCapsPromise ??= fetch(MTG_CAPS_URL).then((res) => {
        if (!res.ok) throw new Error(`GetCapabilities de ${MTG_LAYER} ha fallat amb status: ${res.status}`);
        return res.text();
    });
    return mtgCapsPromise;
}

const mtgGetMap = (time: string, tile: typeof TILE, format: string) =>
    `https://view.eumetsat.int/geoserver/wms?service=WMS&version=1.3.0&request=GetMap&layers=${MTG_LAYER}&styles=&crs=EPSG:3857&bbox=${tileBbox(tile)}&width=512&height=512&format=${format}&transparent=true&time=${time}`;

// Bloc tRNS d'un PNG (alfa de cada entrada de la paleta) amb algun 0.
function hasTransparentPaletteEntry(png: Uint8Array): boolean {
    const view = new DataView(png.buffer, png.byteOffset, png.byteLength);
    for (let i = 8; i + 8 <= png.byteLength;) {
        const length = view.getUint32(i);
        const type = String.fromCharCode(png[i + 4], png[i + 5], png[i + 6], png[i + 7]);
        if (type === 'tRNS') return png.subarray(i + 8, i + 8 + length).includes(0);
        if (type === 'IDAT') return false; // tRNS sempre va abans de les dades
        i += 12 + length;
    }
    return false;
}

async function mtgLatestTime(): Promise<string> {
    const { extentEnd } = timeDimension(await getMtgCapabilities());
    expect(extentEnd, `No s'ha pogut llegir la dimensió temps de ${MTG_LAYER}`).not.toBeNull();
    return extentEnd!;
}

describe('EUMETSAT MTG (mtg_fd:ir105_hrfi) Contract Check', () => {
    it("les caps de la capa tenen nearestValue, període de 10 min i s'han actualitzat fa menys de 2 h", async () => {
        const { attrs, extentEnd } = timeDimension(await getMtgCapabilities());
        expect(extentEnd, `Les caps de ${MTG_LAYER} no tenen dimensió temps: el worker passarà a MSG o a una hora calculada`).not.toBeNull();
        expect(attrs).toContain('nearestValue="1"');
        // El worker i l'app treballen amb franges de 10 min.
        expect(await getMtgCapabilities()).toMatch(/\/PT10M</);

        const ageMs = Date.now() - Date.parse(extentEnd!);
        expect(ageMs, `L'última imatge de ${MTG_LAYER} és de fa ${(ageMs / 3600000).toFixed(1)} h (${extentEnd})`).toBeLessThan(MAX_AGE_MS);
    }, TIMEOUT_MS);

    it('GetMap anònim: JPEG dins el disc i PNG a la vora', async () => {
        const time = await mtgLatestTime();

        const inside = await fetch(mtgGetMap(time, TILE, 'image/jpeg'));
        expect(inside.ok, `GetMap JPEG de ${MTG_LAYER} ha fallat amb status: ${inside.status} (si és 401/403, EUMETSAT exigeix el token)`).toBe(true);
        const jpeg = new Uint8Array(await inside.arrayBuffer());
        expect([jpeg[0], jpeg[1], jpeg[2]], `Dins el disc no ha tornat JPEG (Content-Type: ${inside.headers.get('content-type')})`).toEqual([0xff, 0xd8, 0xff]);
        expect(jpeg.byteLength).toBeGreaterThan(MIN_TILE_BYTES);

        const limb = await fetch(mtgGetMap(time, LIMB_TILE, 'image/vnd.jpeg-png'));
        const png = new Uint8Array(await limb.arrayBuffer());
        expect([png[0], png[1], png[2], png[3]], `A la vora vnd.jpeg-png no ha tornat PNG (Content-Type: ${limb.headers.get('content-type')}): fora del disc sortiria negre`).toEqual([0x89, 0x50, 0x4e, 0x47]);
        // MTG torna sempre PNG de paleta: la transparència de fora del disc és
        // una entrada amb alfa 0 al bloc tRNS.
        expect(hasTransparentPaletteEntry(png), 'El PNG de la vora ja no té cap color transparent: fora del disc sortiria opac').toBe(true);
    }, TIMEOUT_MS);

    it('una franja no publicada torna InvalidDimensionValue (el recul del worker en depèn)', async () => {
        const future = new Date(Date.parse(await mtgLatestTime()) + 30 * 60000).toISOString().replace('.000Z', 'Z');
        const response = await fetch(mtgGetMap(future, TILE, 'image/jpeg'));
        const contentType = response.headers.get('content-type') ?? '';
        const body = await response.text();
        expect(contentType, `Una franja futura ja no torna XML (status ${response.status}): revisa resolveMtgTile al worker`).toContain('xml');
        expect(body, "EUMETSAT ha canviat el codi d'error de franja no publicada: el worker no recularà").toContain('InvalidDimensionValue');
    }, TIMEOUT_MS);

    it('el worker de producció diu que la capa és MTG, llegida de les caps i amb la franja més nova', async () => {
        const response = await fetch(`${WORKER_URL}/hd/meteosat/latest`, { headers: WORKER_HEADERS });
        expect(response.ok, `/hd/meteosat/latest ha respost amb status: ${response.status}`).toBe(true);
        const latest = await response.json() as { layer: string; latest: number; cadence: number; source: string };

        expect(latest.layer, `El worker ha passat a MSG: MTG va endarrerit més d'1 h i MSG és més nou, o l'interruptor HD_METEOSAT_LAYER no és "auto"`).toBe('mtg');
        expect(latest.source, 'El worker no ha pogut llegir les caps de MTG (o són de fa més de 3 h) i fa servir una hora calculada').toBe('caps');
        expect(latest.cadence).toBe(600);
        // Amb EUMETSAT endarrerit, el worker ofereix igualment la franja real
        // més nova (l'antiguitat ja la vigila el primer test, < 2 h): ha de
        // coincidir amb les caps, llegides després, o anar-hi com a molt 20 min
        // per darrere (marge de publicació de 23 min + 60 s de memòria cau).
        const { extentEnd } = timeDimension(await (await fetch(MTG_CAPS_URL)).text());
        const behindMin = (Date.parse(extentEnd ?? '') / 1000 - latest.latest) / 60;
        const offered = new Date(latest.latest * 1000).toISOString();
        expect(behindMin, `La franja del worker (${offered}) és més nova que les caps de MTG (${extentEnd})`).toBeGreaterThanOrEqual(0);
        expect(behindMin, `La franja del worker (${offered}) va ${behindMin} min per darrere de les caps de MTG (${extentEnd})`).toBeLessThanOrEqual(20);
    }, TIMEOUT_MS);

    it('el worker de producció serveix una tessel·la MTG real (no el fallback transparent)', async () => {
        const latest = Math.floor(Date.parse(await mtgLatestTime()) / 1000);
        // Una hora abans i uns segons desalineada: el worker l'arrodoneix a la
        // franja de 10 min, respon no-store i no la desa, així que cada dia es
        // prova el camí sencer fins a EUMETSAT.
        const timestamp = latest - 3600 + 7;
        const response = await fetch(`${WORKER_URL}/hd/mtg/v1/${timestamp}/${TILE.z}/${TILE.x}/${TILE.y}.png`, { headers: WORKER_HEADERS });
        expect(response.ok, `El worker ha respost amb status: ${response.status}`).toBe(true);

        const bytes = new Uint8Array(await response.arrayBuffer());
        expect(isImage(bytes)).toBe(true);
        expect(bytes.byteLength, 'El worker ha servit el fallback transparent: mira `wrangler tail` (línies "[Zero Risk] MTG ...")').toBeGreaterThan(MIN_TILE_BYTES);
        expect(response.headers.get('cache-control')).toBe('no-store');
    }, TIMEOUT_MS);
});

// Llamps (mtg_fd:li_afa: capa del radar i avís "llamps a prop" del tauler) i
// GeoColour (mtg_fd:rgb_geocolour: Meteosat HD en color). Si fallen, la capa
// de llamps queda buida i l'avís i la IA deixen de veure tempestes, sense cap
// error visible; o el mode color mostra l'IR.
const LIGHTNING_LAYER = 'mtg_fd:li_afa';
const GEOCOLOUR_LAYER = 'mtg_fd:rgb_geocolour';
const capsOf = (layer: string) => `https://view.eumetsat.int/geoserver/${layer.replace(':', '/')}/ows?service=WMS&version=1.3.0&request=GetCapabilities`;
const getMapOf = (layer: string, time: string, tile: typeof TILE, format: string) =>
    `https://view.eumetsat.int/geoserver/wms?service=WMS&version=1.3.0&request=GetMap&layers=${layer}&styles=&crs=EPSG:3857&bbox=${tileBbox(tile)}&width=512&height=512&format=${format}&transparent=true&time=${time}`;
// El fallback del worker (PNG transparent d'1x1).
const FALLBACK_BYTES = 68;

async function layerLatest(layer: string, period: string): Promise<string> {
    const res = await fetch(capsOf(layer));
    expect(res.ok, `GetCapabilities de ${layer} ha fallat amb status: ${res.status}`).toBe(true);
    const xml = await res.text();
    const { attrs, extentEnd } = timeDimension(xml);
    expect(extentEnd, `Les caps de ${layer} no tenen dimensió temps`).not.toBeNull();
    expect(attrs).toContain('nearestValue="1"');
    expect(xml, `${layer} ha canviat de període (el worker i l'app treballen amb ${period})`).toContain(`/${period}<`);
    const ageMs = Date.now() - Date.parse(extentEnd!);
    expect(ageMs, `L'última imatge de ${layer} és de fa ${(ageMs / 3600000).toFixed(1)} h (${extentEnd})`).toBeLessThan(MAX_AGE_MS);
    return extentEnd!;
}

describe('EUMETSAT MTG llamps (li_afa) i GeoColour Contract Check', () => {
    it('llamps: caps cada 5 min al dia i GetMap png8 anònim amb transparència', async () => {
        const time = await layerLatest(LIGHTNING_LAYER, 'PT5M');
        const response = await fetch(getMapOf(LIGHTNING_LAYER, time, TILE, 'image/png8'));
        expect(response.ok, `GetMap de ${LIGHTNING_LAYER} ha fallat amb status: ${response.status}`).toBe(true);
        const png = new Uint8Array(await response.arrayBuffer());
        expect([png[0], png[1], png[2], png[3]], `image/png8 no ha tornat PNG (Content-Type: ${response.headers.get('content-type')})`).toEqual([0x89, 0x50, 0x4e, 0x47]);
        // On no hi ha llamps ha de ser transparent: si no, la capa taparia el radar.
        expect(hasTransparentPaletteEntry(png), 'El PNG dels llamps ja no té cap color transparent').toBe(true);
    }, TIMEOUT_MS);

    it('GeoColour: caps cada 10 min al dia i GetMap JPEG anònim dins el disc', async () => {
        const time = await layerLatest(GEOCOLOUR_LAYER, 'PT10M');
        const response = await fetch(getMapOf(GEOCOLOUR_LAYER, time, TILE, 'image/jpeg'));
        expect(response.ok, `GetMap de ${GEOCOLOUR_LAYER} ha fallat amb status: ${response.status}`).toBe(true);
        const bytes = new Uint8Array(await response.arrayBuffer());
        expect(isImage(bytes)).toBe(true);
        expect(bytes.byteLength).toBeGreaterThan(MIN_TILE_BYTES);
    }, TIMEOUT_MS);

    it('el worker de producció dona la franja de llamps (caps, cada 5 min, al dia)', async () => {
        const response = await fetch(`${WORKER_URL}/lightning/latest`, { headers: WORKER_HEADERS });
        expect(response.ok, `/lightning/latest ha respost amb status: ${response.status}`).toBe(true);
        const latest = await response.json() as { latest: number; cadence: number; source: string } | null;
        expect(latest, 'El worker diu que el Lightning Imager va endarrerit més d\'1 h: capa i avís de llamps desactivats').not.toBeNull();
        expect(latest!.source, 'El worker no ha pogut llegir les caps dels llamps i fa servir una hora calculada').toBe('caps');
        expect(latest!.cadence).toBe(300);
        expect(Date.now() / 1000 - latest!.latest).toBeLessThan(MAX_LATEST_AGE_S);
    }, TIMEOUT_MS);

    it('el worker de producció dona la franja de GeoColour dins /hd/meteosat/latest', async () => {
        const response = await fetch(`${WORKER_URL}/hd/meteosat/latest`, { headers: WORKER_HEADERS });
        const latest = await response.json() as { colour?: { latest: number; cadence: number; source: string } | null };
        expect(latest.colour, 'Sense franja de GeoColour: el mode color de Meteosat HD mostra l\'IR').toBeTruthy();
        expect(latest.colour!.source).toBe('caps');
        expect(latest.colour!.cadence).toBe(600);
    }, TIMEOUT_MS);

    it('el worker de producció resol tessel·les reals de llamps i de GeoColour (no el fallback)', async () => {
        const lightning = Math.floor(Date.parse(await layerLatest(LIGHTNING_LAYER, 'PT5M')) / 1000);
        // Desalineades: no-store i sense desar, el camí sencer fins a EUMETSAT.
        const ltg = await fetch(`${WORKER_URL}/lightning/v1/${lightning - 3600 + 7}/${TILE.z}/${TILE.x}/${TILE.y}.png`, { headers: WORKER_HEADERS });
        const ltgBytes = new Uint8Array(await ltg.arrayBuffer());
        // Una tessel·la buida de llamps (369 B) és petita però real: el que la distingeix del fallback és X-Hd-Slot.
        expect(ltg.headers.get('x-hd-slot'), 'El worker ha servit el fallback dels llamps: mira `wrangler tail` ("[Zero Risk] MTG llamps ...")').toBeTruthy();
        expect(ltgBytes.byteLength).toBeGreaterThan(FALLBACK_BYTES);

        const colour = Math.floor(Date.parse(await layerLatest(GEOCOLOUR_LAYER, 'PT10M')) / 1000);
        const geo = await fetch(`${WORKER_URL}/hd/mtg/geocolour/v1/${colour - 3600 + 7}/${TILE.z}/${TILE.x}/${TILE.y}.png`, { headers: WORKER_HEADERS });
        const geoBytes = new Uint8Array(await geo.arrayBuffer());
        expect(isImage(geoBytes)).toBe(true);
        expect(geoBytes.byteLength, 'El worker ha servit el fallback de GeoColour: mira `wrangler tail` ("[Zero Risk] MTG GeoColour ...")').toBeGreaterThan(MIN_TILE_BYTES);
    }, TIMEOUT_MS);
});

// GOES i Himawari HD (NASA GIBS): el worker treu les franges de DescribeDomains
// del WMTS i dona cada tessel·la de 256 px del WMS en JPEG o, mentre el WMS
// encara no la té, en PNG del WMTS (rutes /hd/{goes|himawari}/latest i
// /hd/gibs/v1). Si GIBS canvia res d'això, la capa queda buida o vella sense
// cap error visible.
const GIBS_LAYERS = [
    ['GOES-East_ABI_Band13_Clean_Infrared', 'GoogleMapsCompatible_Level6'],
    ['GOES-West_ABI_Band13_Clean_Infrared', 'GoogleMapsCompatible_Level6'],
    ['Himawari_AHI_Band13_Clean_Infrared', 'GoogleMapsCompatible_Level6'],
    ['GOES-East_ABI_GeoColor', 'GoogleMapsCompatible_Level7'],
    ['GOES-West_ABI_GeoColor', 'GoogleMapsCompatible_Level7'],
] as const;
// Florida (GOES-East, dins el disc), tessel·la de 256 px.
const GOES_TILE = { z: 5, x: 8, y: 13 };
const isoSeconds = (s: number) => new Date(s * 1000).toISOString().slice(0, 19) + 'Z';
// Una tessel·la de 256 px real fa 4 KB o més; la buida del WMS, 668 B (JPEG).
const MIN_GIBS_TILE_BYTES = 1024;

async function gibsNewestSlot(layer: string, tileMatrixSet: string): Promise<number> {
    const now = Date.now() / 1000;
    const res = await fetch(`https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/wmts.cgi?SERVICE=WMTS&REQUEST=DescribeDomains&VERSION=1.0.0&LAYER=${layer}&TILEMATRIXSET=${tileMatrixSet}&TIME=${isoSeconds(now - 86400)}/${isoSeconds(now + 3600)}`);
    expect(res.ok, `DescribeDomains de ${layer} ha fallat amb status: ${res.status}`).toBe(true);
    const domain = (await res.text()).match(/<Domain>([^<]*)<\/Domain>/)?.[1];
    expect(domain, `DescribeDomains de ${layer} ja no porta <Domain>: el worker farà servir hores calculades`).toBeTruthy();
    expect(domain, `${layer} ha canviat de període (el worker treballa amb PT10M)`).toContain('/PT10M');
    const last = domain!.split(',').pop()!.split('/');
    return Date.parse(last[1] ?? last[0]) / 1000;
}

describe('NASA GIBS GOES i Himawari Contract Check', () => {
    it('DescribeDomains: les 5 capes cada 10 min, amb la imatge més nova de fa menys de 2 h', async () => {
        for (const [layer, tileMatrixSet] of GIBS_LAYERS) {
            const ageMs = Date.now() - (await gibsNewestSlot(layer, tileMatrixSet)) * 1000;
            expect(ageMs, `L'última imatge de ${layer} és de fa ${(ageMs / 3600000).toFixed(1)} h`).toBeLessThan(MAX_AGE_MS);
        }
    }, TIMEOUT_MS * 2);

    it('WMS: JPEG de 256 px real una hora enrere; WMTS: PNG de la franja més nova i 404 per a una de futura', async () => {
        const newest = await gibsNewestSlot('GOES-East_ABI_Band13_Clean_Infrared', 'GoogleMapsCompatible_Level6');
        const wms = await fetch(`https://gibs.earthdata.nasa.gov/wms/epsg3857/best/wms.cgi?SERVICE=WMS&REQUEST=GetMap&VERSION=1.3.0&LAYERS=GOES-East_ABI_Band13_Clean_Infrared&STYLES=&FORMAT=image/jpeg&TRANSPARENT=true&HEIGHT=256&WIDTH=256&TIME=${isoSeconds(newest - 3600)}&CRS=EPSG:3857&BBOX=${tileBbox(GOES_TILE)}`);
        const jpeg = new Uint8Array(await wms.arrayBuffer());
        expect([jpeg[0], jpeg[1], jpeg[2]], `El WMS ja no dona JPEG (Content-Type: ${wms.headers.get('content-type')})`).toEqual([0xff, 0xd8, 0xff]);
        expect(jpeg.byteLength, 'El WMS no té la imatge d\'una hora enrere: el worker hauria de servir-ho tot en PNG').toBeGreaterThan(MIN_GIBS_TILE_BYTES);

        const wmts = (time: number) => fetch(`https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/GOES-East_ABI_Band13_Clean_Infrared/default/${isoSeconds(time)}/GoogleMapsCompatible_Level6/${GOES_TILE.z}/${GOES_TILE.y}/${GOES_TILE.x}.png`);
        // GIBS anuncia les franges abans que les tessel·les arribin a tots els
        // servidors: el 2026-10-20 la penúltima també donava 404 des dels
        // runners. El worker recula com a molt 2 franges (GIBS_MAX_STEPBACK)
        // abans del fallback transparent, així que n'hi ha prou amb una de les 3.
        const tried: string[] = [];
        let served = false;
        for (let step = 0; step <= 2 && !served; step++) {
            const res = await wmts(newest - step * 600);
            const bytes = new Uint8Array(await res.arrayBuffer());
            served = res.status === 200 && isImage(bytes);
            tried.push(`${isoSeconds(newest - step * 600)} → ${res.status}`);
        }
        expect(served, `El WMTS no té cap de les 3 últimes imatges anunciades (el worker només recula 2): ${tried.join(', ')}`).toBe(true);
        const future = await wmts(newest + 7200);
        await future.arrayBuffer();
        expect(future.status, 'El WMTS ja no respon 404 a una franja sense dades: el worker no sabrà que ha de recular').toBe(404);
    }, TIMEOUT_MS);

    it('el worker de producció dona les franges de GOES (IR i GeoColor) i de Himawari, llegides de GIBS i al dia', async () => {
        for (const agency of ['goes', 'himawari']) {
            const response = await fetch(`${WORKER_URL}/hd/${agency}/latest`, { headers: WORKER_HEADERS });
            expect(response.ok, `/hd/${agency}/latest ha respost amb status: ${response.status}`).toBe(true);
            const latest = await response.json() as { ir: { latest: number; source: string; slots: number[] }; colour: { source: string } | null };
            expect(latest.ir.source, `El worker no ha pogut llegir DescribeDomains de ${agency} i fa servir hores calculades`).toBe('caps');
            expect(latest.ir.slots.length).toBeGreaterThan(6);
            expect(Date.now() / 1000 - latest.ir.latest).toBeLessThan(MAX_LATEST_AGE_S);
            if (agency === 'goes') expect(latest.colour?.source, 'Sense franges de GeoColor: el mode color de GOES mostra l\'IR').toBe('caps');
            else expect(latest.colour).toBeNull();
        }
    }, TIMEOUT_MS);

    it('el worker de producció resol una tessel·la GOES real (no el fallback transparent)', async () => {
        const newest = await gibsNewestSlot('GOES-East_ABI_Band13_Clean_Infrared', 'GoogleMapsCompatible_Level6');
        // Una hora abans i desalineada: no-store i sense desar, el camí sencer fins a GIBS.
        const response = await fetch(`${WORKER_URL}/hd/gibs/v1/goes/ir/${newest - 3600 + 7}/${GOES_TILE.z}/${GOES_TILE.x}/${GOES_TILE.y}.png`, { headers: WORKER_HEADERS });
        const bytes = new Uint8Array(await response.arrayBuffer());
        expect(response.headers.get('x-hd-slot'), 'El worker ha servit el fallback: mira `wrangler tail` ("[Zero Risk] GIBS ...")').toBeTruthy();
        expect(isImage(bytes)).toBe(true);
        expect(bytes.byteLength).toBeGreaterThan(MIN_GIBS_TILE_BYTES);
        expect(response.headers.get('cache-control')).toBe('no-store');
    }, TIMEOUT_MS);
});
